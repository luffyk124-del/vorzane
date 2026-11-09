import { createClient } from "npm:@supabase/supabase-js@2";
import { createBattleSequence, type BattleMode, type BattleSequence } from "../../../src/game/engine.ts";
import { normalizeGameState } from "../../../src/game/model.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BATTLE_MODES = ["cave", "dungeon", "tower", "hard"] as const;

type BattlePresentation = Omit<BattleSequence, "result"> & {
  result: Omit<BattleSequence["result"], "state">;
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function parseBody(value: unknown): { commandId: string; mode: BattleMode } | null {
  if (!isRecord(value) || Object.keys(value).some((key) => !["commandId", "mode"].includes(key))) return null;
  if (typeof value.commandId !== "string" || !UUID_PATTERN.test(value.commandId)) return null;
  if (typeof value.mode !== "string" || !BATTLE_MODES.includes(value.mode as BattleMode)) return null;
  return { commandId: value.commandId, mode: value.mode as BattleMode };
}

function toPresentation(sequence: BattleSequence): BattlePresentation {
  const { state: _serverState, ...result } = sequence.result;
  return { ...sequence, result };
}

export function createBattleCommandHandler(
  makeClient: typeof createClient = createClient,
  getEnv: (name: string) => string | undefined = (name) => Deno.env.get(name),
  random: () => number = Math.random,
) {
  return async (request: Request): Promise<Response> => {
    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

    const authHeader = request.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const url = getEnv("SUPABASE_URL");
    const anonKey = getEnv("SUPABASE_ANON_KEY");
    const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !anonKey || !serviceRoleKey) return json({ error: "Server configuration is incomplete" }, 500);

    let body: { commandId: string; mode: BattleMode };
    try {
      const raw = await request.text();
      if (new TextEncoder().encode(raw).byteLength > 4096) return json({ error: "Request is too large" }, 413);
      const parsed = parseBody(JSON.parse(raw));
      if (!parsed) return json({ error: "Invalid battle command" }, 400);
      body = parsed;
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    const caller = makeClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await caller.auth.getUser();
    if (userError || !userData.user) return json({ error: "Unauthorized" }, 401);

    const admin = makeClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: receipt, error: receiptError } = await admin
      .from("player_command_receipts")
      .select("result")
      .eq("user_id", userData.user.id)
      .eq("command_id", body.commandId)
      .maybeSingle();
    if (receiptError) return json({ error: "Could not verify battle command receipt" }, 500);

    const readCurrentSave = async () => await caller
      .from("player_saves")
      .select("game_state, updated_at")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    const { data: save, error: readError } = await readCurrentSave();
    if (readError) return json({ error: "Could not load save" }, 500);
    if (!save) return json({ error: "Player save not found" }, 404);
    const state = normalizeGameState(save.game_state);
    if (!state) return json({ error: "Player state is invalid" }, 409);

    if (receipt) {
      if (!isRecord(receipt.result) || !isRecord(receipt.result.sequence)) {
        return json({ error: "Invalid battle command receipt" }, 500);
      }
      return json({
        sequence: receipt.result.sequence,
        state,
        updatedAt: save.updated_at,
        replayed: true,
      });
    }

    if (!state.hero) return json({ error: "Create a hero first" }, 409);

    const sequence = createBattleSequence(state, body.mode, random);
    if (!sequence) return json({ error: "Battle could not be created" }, 409);
    const presentation = toPresentation(sequence);
    const receiptResult = { sequence: presentation };

    const { data: commit, error: commitError } = await admin.rpc("commit_player_command", {
      p_user_id: userData.user.id,
      p_command_id: body.commandId,
      p_expected_updated_at: save.updated_at,
      p_game_state: sequence.result.state,
      p_result: receiptResult,
    });

    if (commitError) {
      if (commitError.code === "P0002") return json({ error: "Player save not found" }, 404);
      if (commitError.code === "42501") return json({ error: "Unauthorized" }, 401);
      if (commitError.code === "22023") return json({ error: "Invalid command payload" }, 400);
      return json({ error: "Could not commit battle" }, 500);
    }
    if (!isRecord(commit)) return json({ error: "Invalid command response" }, 500);
    if (commit.conflict === true) return json({ error: "Save changed; reload and retry", updatedAt: commit.updatedAt }, 409);
    if (!isRecord(commit.result) || !isRecord(commit.result.sequence)) {
      return json({ error: "Invalid battle command receipt" }, 500);
    }

    let authoritativeState = sequence.result.state;
    let updatedAt = commit.updatedAt;
    if (commit.replayed === true) {
      const current = await readCurrentSave();
      if (current.error || !current.data) return json({ error: "Could not reload committed battle state" }, 500);
      const normalized = normalizeGameState(current.data.game_state);
      if (!normalized) return json({ error: "Player state is invalid" }, 409);
      authoritativeState = normalized;
      updatedAt = current.data.updated_at;
    }

    return json({
      sequence: commit.result.sequence,
      state: authoritativeState,
      updatedAt,
      replayed: commit.replayed === true,
    });
  };
}

if (import.meta.main) {
  Deno.serve(createBattleCommandHandler());
}
