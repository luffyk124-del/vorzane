import { createClient } from "npm:@supabase/supabase-js@2";
import { createFreshState, normalizeGameState, type GameState } from "./state.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type SettingsPatch = Partial<GameState["settings"]>;
type EconomyCommand = { type: "resetSave" } | { type: "updateSettings"; settings: SettingsPatch };
type RequestBody = { commandId: string; expectedUpdatedAt: string; command: EconomyCommand };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function parseCommand(value: unknown): EconomyCommand | null {
  if (!isRecord(value)) return null;
  if (value.type === "resetSave") return Object.keys(value).length === 1 ? { type: "resetSave" } : null;
  if (value.type !== "updateSettings" || Object.keys(value).length !== 2 || !isRecord(value.settings)) return null;

  const settings = value.settings;
  const allowed = new Set(["sfx", "musicEnabled", "volume", "musicVolume"]);
  if (!Object.keys(settings).length || Object.keys(settings).some((key) => !allowed.has(key))) return null;
  const patch: SettingsPatch = {};
  if ("sfx" in settings) { if (typeof settings.sfx !== "boolean") return null; patch.sfx = settings.sfx; }
  if ("musicEnabled" in settings) { if (typeof settings.musicEnabled !== "boolean") return null; patch.musicEnabled = settings.musicEnabled; }
  if ("volume" in settings) { if (typeof settings.volume !== "number" || !Number.isFinite(settings.volume) || settings.volume < 0 || settings.volume > 100) return null; patch.volume = settings.volume; }
  if ("musicVolume" in settings) { if (typeof settings.musicVolume !== "number" || !Number.isFinite(settings.musicVolume) || settings.musicVolume < 0 || settings.musicVolume > 100) return null; patch.musicVolume = settings.musicVolume; }
  return { type: "updateSettings", settings: patch };
}

export function createEconomyCommandHandler(
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
      const parsed = await request.json();
      if (!isRecord(parsed)) return json({ error: "Invalid command payload" }, 400);
      const command = parseCommand(parsed.command);
      if (typeof parsed.commandId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(parsed.commandId) ||
          typeof parsed.expectedUpdatedAt !== "string" || !Number.isFinite(Date.parse(parsed.expectedUpdatedAt)) || !command) {
        return json({ error: "Invalid command payload" }, 400);
      }
      body = { commandId: parsed.commandId, expectedUpdatedAt: parsed.expectedUpdatedAt, command };
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    const client = makeClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError || !userData.user) return json({ error: "Unauthorized" }, 401);

    const { data: save, error: readError } = await client.from("player_saves")
      .select("game_state, updated_at").eq("user_id", userData.user.id).maybeSingle();
    if (readError) return json({ error: "Could not load save" }, 500);
    if (!save) return json({ error: "Player save not found" }, 404);
    if (!isRecord(save.game_state) || !("hero" in save.game_state)) return json({ error: "Player state is invalid" }, 409);
    const fresh = createFreshState();
    const rawSettings = isRecord(save.game_state.settings) ? save.game_state.settings : fresh.settings;
    const state = { ...save.game_state, settings: { ...fresh.settings, ...rawSettings } } as GameState;

    const adminClient = makeClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: receipt, error: receiptError } = await adminClient.from("player_command_receipts")
      .select("result").eq("user_id", userData.user.id).eq("command_id", body.commandId).maybeSingle();
    if (receiptError) return json({ error: "Could not check command receipt" }, 500);
    if (receipt && isRecord(receipt.result)) {
      return json({ state, soldPrice: null, updatedAt: save.updated_at, replayed: true });
    }
    if (body.expectedUpdatedAt !== save.updated_at) {
      return json({ error: "Save changed; reload and retry", updatedAt: save.updated_at }, 409);
    }

    const next = body.command.type === "resetSave"
      ? createFreshState()
      : { ...state, settings: { ...state.settings, ...body.command.settings } };
    const result = { commandId: body.commandId, commandType: body.command.type, state: next };
    const { data: commit, error: commitError } = await adminClient.rpc("commit_player_command", {
      p_user_id: userData.user.id,
      p_command_id: body.commandId,
      p_expected_updated_at: save.updated_at,
      p_game_state: next,
      p_result: result,
    });
    if (commitError) {
      if (commitError.code === "P0002") return json({ error: "Player save not found" }, 404);
      if (commitError.code === "42501") return json({ error: "Unauthorized" }, 401);
      if (commitError.code === "22023") return json({ error: "Invalid command payload" }, 400);
      return json({ error: "Could not commit command" }, 500);
    }
    if (!isRecord(commit)) return json({ error: "Invalid command response" }, 500);
    if (commit.conflict === true) return json({ error: "Save changed; reload and retry", updatedAt: commit.updatedAt }, 409);
    if (!isRecord(commit.result) || !("state" in commit.result)) return json({ error: "Invalid command receipt" }, 500);
    return json({ state: commit.result.state, updatedAt: commit.updatedAt, replayed: commit.replayed === true });
  };
}

if (import.meta.main) Deno.serve(createEconomyCommandHandler());
