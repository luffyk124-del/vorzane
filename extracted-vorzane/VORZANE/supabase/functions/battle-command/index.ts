import { createClient } from "npm:@supabase/supabase-js@2";
import { createBattleSequence } from "../../../src/game/engine.ts";
import { normalizeGameState, type BattleMode } from "../../../src/game/model.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type RequestBody = {
  commandId: string;
  expectedUpdatedAt: string;
  mode: BattleMode;
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

function parseBody(value: unknown): RequestBody | null {
  if (!isRecord(value)) return null;
  const modes: BattleMode[] = ["cave", "dungeon", "tower", "hard"];
  if (
    typeof value.commandId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.commandId) ||
    typeof value.expectedUpdatedAt !== "string" ||
    !Number.isFinite(Date.parse(value.expectedUpdatedAt)) ||
    typeof value.mode !== "string" ||
    !modes.includes(value.mode as BattleMode)
  ) return null;
  return {
    commandId: value.commandId,
    expectedUpdatedAt: value.expectedUpdatedAt,
    mode: value.mode as BattleMode,
  };
}

function secureRandom(): number {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return values[0] / 0x1_0000_0000;
}

export function createBattleCommandHandler(
  makeClient: typeof createClient = createClient,
  getEnv: (name: string) => string | undefined = (name) => Deno.env.get(name),
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

    let body: RequestBody;
    try {
      body = parseBody(await request.json()) as RequestBody;
      if (!body) return json({ error: "Invalid battle command" }, 400);
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    // The caller JWT is used for identity and the owner-scoped save read.
    const client = makeClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError || !userData.user) return json({ error: "Unauthorized" }, 401);

    const userId = userData.user.id;
    const { data: save, error: readError } = await client
      .from("player_saves")
      .select("game_state, updated_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (readError) return json({ error: "Could not load save" }, 500);
    if (!save) return json({ error: "Player save not found" }, 404);

    const state = normalizeGameState(save.game_state);
    if (!state) return json({ error: "Player state is invalid" }, 409);

    // Check receipts before version checks so a network retry cannot start
    // another fight or grant the same result twice.
    const adminClient = makeClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: receipt, error: receiptError } = await adminClient
      .from("player_command_receipts")
      .select("result")
      .eq("user_id", userId)
      .eq("command_id", body.commandId)
      .maybeSingle();

    if (receiptError) return json({ error: "Could not check battle receipt" }, 500);
    if (receipt && isRecord(receipt.result) && isRecord(receipt.result.sequence)) {
      return json({
        sequence: receipt.result.sequence,
        updatedAt: save.updated_at,
        replayed: true,
      });
    }

    if (!state.hero) return json({ error: "Create a hero first" }, 409);
    if (body.expectedUpdatedAt !== save.updated_at) {
      return json({ error: "Save changed; reload and retry", updatedAt: save.updated_at }, 409);
    }

    // All combat outcomes and rewards are computed here from the canonical engine.
    // The client receives display data only; the resulting GameState stays server-side.
    const sequence = createBattleSequence(state, body.mode, secureRandom);
    if (!sequence) return json({ error: "Battle could not be started" }, 409);
    const { state: nextState, ...displayResult } = sequence.result;
    const displaySequence = { ...sequence, result: displayResult };
    const receiptResult = { sequence: displaySequence };

    const { data: committed, error: commitError } = await adminClient.rpc("commit_player_command", {
      p_user_id: userId,
      p_command_id: body.commandId,
      p_expected_updated_at: body.expectedUpdatedAt,
      p_game_state: nextState,
      p_result: receiptResult,
    });

    if (commitError) return json({ error: "Could not commit battle result" }, 500);
    if (!isRecord(committed)) return json({ error: "Invalid battle commit response" }, 500);
    if (committed.conflict === true) {
      return json({ error: "Save changed; reload and retry", updatedAt: committed.updatedAt }, 409);
    }
    if (!isRecord(committed.result) || !isRecord(committed.result.sequence)) {
      return json({ error: "Battle result was not recorded" }, 500);
    }

    return json({
      sequence: committed.result.sequence,
      updatedAt: committed.updatedAt,
      replayed: committed.replayed === true,
    });
  };
}

if (import.meta.main) {
  Deno.serve(createBattleCommandHandler());
}
