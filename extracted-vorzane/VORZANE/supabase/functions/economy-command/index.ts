import { createClient } from "npm:@supabase/supabase-js@2";
import { buyItem, equipItem, sellItem, unequipItem } from "../../../src/game/engine.ts";
import { normalizeGameState } from "../../../src/game/model.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type EconomyCommand =
  | { type: "buyItem"; itemId: string }
  | { type: "sellItem"; itemId: string }
  | { type: "equipItem"; itemId: string }
  | { type: "unequipItem"; slot: string };

type RequestBody = {
  commandId: string;
  expectedUpdatedAt: string;
  command: EconomyCommand;
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function parseCommand(value: unknown): EconomyCommand | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const command = value as Record<string, unknown>;
  if (command.type === "buyItem" || command.type === "sellItem" || command.type === "equipItem") {
    if (typeof command.itemId !== "string" || !command.itemId.trim() || command.itemId.length > 160) return null;
    return { type: command.type, itemId: command.itemId };
  }
  if (command.type === "unequipItem") {
    if (typeof command.slot !== "string" || !command.slot.trim() || command.slot.length > 40) return null;
    return { type: "unequipItem", slot: command.slot };
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
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
      if (
        typeof parsed.commandId !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(parsed.commandId) ||
        typeof parsed.expectedUpdatedAt !== "string" ||
        !Number.isFinite(Date.parse(parsed.expectedUpdatedAt)) ||
        !command
      ) return json({ error: "Invalid command payload" }, 400);
      body = { commandId: parsed.commandId, expectedUpdatedAt: parsed.expectedUpdatedAt, command };
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    // Forward the caller JWT so auth.uid() inside the transaction RPC is the caller.
    const client = makeClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError || !userData.user) return json({ error: "Unauthorized" }, 401);

    const { data: save, error: readError } = await client
      .from("player_saves")
      .select("game_state, updated_at")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (readError) return json({ error: "Could not load save" }, 500);
    if (!save) return json({ error: "Player save not found" }, 404);
    if (body.expectedUpdatedAt !== save.updated_at) {
      return json({ error: "Save changed; reload and retry", updatedAt: save.updated_at }, 409);
    }

    const state = normalizeGameState(save.game_state);
    if (!state || !state.hero) return json({ error: "Player state is invalid" }, 409);

    let next = state;
    let soldPrice: number | null = null;
    if (body.command.type === "buyItem") {
      const result = buyItem(state, body.command.itemId);
      if (result.error) return json({ error: result.error }, 400);
      next = result.state;
    } else if (body.command.type === "sellItem") {
      const result = sellItem(state, body.command.itemId);
      if (result.error) return json({ error: result.error }, 400);
      next = result.state;
      soldPrice = result.soldPrice ?? null;
    } else if (body.command.type === "equipItem") {
      next = equipItem(state, body.command.itemId);
      if (next === state) return json({ error: "Item cannot be equipped" }, 400);
    } else {
      next = unequipItem(state, body.command.slot);
      if (next === state) return json({ error: "Item cannot be unequipped" }, 400);
    }

    // The privileged RPC is called only with the service-role key after the
    // caller has been authenticated and their save has been scoped above.
    const adminClient = makeClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const result = {
      commandId: body.commandId,
      commandType: body.command.type,
      state: next,
      soldPrice,
    };
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

    return json({
      state: commit.result.state,
      soldPrice: typeof commit.result.soldPrice === "number" ? commit.result.soldPrice : null,
      updatedAt: commit.updatedAt,
      replayed: commit.replayed === true,
    });
  };
}

if (import.meta.main) {
  Deno.serve(createEconomyCommandHandler());
}
