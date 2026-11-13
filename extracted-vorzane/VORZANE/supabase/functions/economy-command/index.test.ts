import { createFreshState, type GameState } from "./state.ts";
import { createEconomyCommandHandler } from "./index.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  return await response.json() as Record<string, unknown>;
}

function fixture(options: {
  state?: GameState;
  user?: { id: string } | null;
  authError?: unknown;
  readError?: unknown;
  receipt?: { result: Record<string, unknown> } | null;
  commit?: Record<string, unknown>;
  commitError?: { code?: string } | null;
} = {}) {
  const state = options.state ?? createFreshState();
  const calls: Record<string, unknown> = {};
  const builder = {
    select(columns: string) { calls.columns = columns; return this; },
    eq(column: string, value: string) { ((calls.filters ??= []) as unknown[]).push([column, value]); return this; },
    async maybeSingle() {
      if (calls.table === "player_command_receipts") return { data: options.receipt ?? null, error: null };
      return { data: options.readError ? null : { game_state: state, updated_at: "2026-11-08T20:00:00.000Z" }, error: options.readError ?? null };
    },
  };
  const fakeClient = {
    auth: { async getUser() { return { data: { user: options.user === undefined ? { id: "user-a" } : options.user }, error: options.authError ?? null }; } },
    from(table: string) { calls.table = table; ((calls.tables ??= []) as string[]).push(table); return builder; },
    async rpc(name: string, args: Record<string, unknown>) {
      calls.rpc = name;
      calls.args = args;
      return { data: options.commit ?? { replayed: false, result: args.p_result, updatedAt: "2026-11-08T20:01:00.000Z" }, error: options.commitError ?? null };
    },
  };
  const factory = (() => fakeClient) as unknown as Parameters<typeof createEconomyCommandHandler>[0];
  const handler = createEconomyCommandHandler(factory, (name) => ({
    SUPABASE_URL: "https://test.supabase.co",
    SUPABASE_ANON_KEY: "test-anon-key",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
  }[name]));
  return { handler, calls, state };
}

function commandRequest(command: unknown, overrides: Record<string, unknown> = {}) {
  return new Request("https://local.test/economy-command", {
    method: "POST",
    headers: { Authorization: "Bearer valid", "Content-Type": "application/json" },
    body: JSON.stringify({ commandId: "10000000-0000-4000-8000-000000000001", expectedUpdatedAt: "2026-11-08T20:00:00.000Z", command, ...overrides }),
  });
}

Deno.test("OPTIONS does not contact Supabase", async () => {
  const { handler, calls } = fixture();
  const response = await handler(new Request("https://local.test/economy-command", { method: "OPTIONS" }));
  assert(response.status === 200, "expected 200");
  assert(Object.keys(calls).length === 0, "preflight must not contact Supabase");
});

Deno.test("non-POST requests are rejected", async () => {
  const { handler, calls } = fixture();
  const response = await handler(new Request("https://local.test/economy-command", { method: "GET" }));
  assert(response.status === 405, "expected 405");
  assert(Object.keys(calls).length === 0, "unsupported method must not contact Supabase");
});

Deno.test("missing bearer token is rejected", async () => {
  const { handler, calls } = fixture();
  const response = await handler(new Request("https://local.test/economy-command", { method: "POST" }));
  assert(response.status === 401, "expected 401");
  assert(Object.keys(calls).length === 0, "unauthenticated request must not contact Supabase");
});

Deno.test("unsupported commands and settings keys are rejected before reading a save", async () => {
  const { handler, calls } = fixture();
  const response = await handler(commandRequest({ type: "buyItem", itemId: "x" }));
  assert(response.status === 400, "unsupported commands must be rejected");
  assert(calls.table === undefined && calls.rpc === undefined, "unsupported command must not touch the database");
  const invalidSettings = await handler(commandRequest({ type: "updateSettings", settings: { gold: 999999 } }));
  assert(invalidSettings.status === 400, "unknown settings must be rejected");
});

Deno.test("settings command updates only validated settings and commits atomically", async () => {
  const state = createFreshState();
  state.gold = 321;
  const { handler, calls } = fixture({ state });
  const response = await handler(commandRequest({ type: "updateSettings", settings: { musicEnabled: false, musicVolume: 45 } }));
  const body = await readJson(response);
  assert(response.status === 200, "expected 200");
  assert(calls.rpc === "commit_player_command", "settings must use atomic server commit");
  const saved = (calls.args as Record<string, unknown>).p_game_state as GameState;
  assert(saved.settings.musicEnabled === false && saved.settings.musicVolume === 45, "settings patch must be applied");
  assert(saved.gold === 321, "unrelated player progress must be preserved");
  assert(body.replayed === false, "expected first execution");
});

Deno.test("resetSave creates a fresh state without deleting the player save row", async () => {
  const state = createFreshState();
  state.gold = 9999;
  state.serverResetEpoch = "reset-epoch-before-reset";
  const { handler, calls } = fixture({ state });
  const response = await handler(commandRequest({ type: "resetSave" }));
  assert(response.status === 200, "expected 200");
  assert(calls.rpc === "commit_player_command", "reset must use atomic server commit");
  const saved = (calls.args as Record<string, unknown>).p_game_state as GameState;
  assert(saved.gold === 500 && saved.hero === null, "reset must use canonical fresh state");
  assert(typeof saved.serverResetEpoch === "string" && /^[0-9a-f-]{36}$/i.test(saved.serverResetEpoch),
    "reset must rotate to a fresh server-generated epoch");
  assert(saved.serverResetEpoch !== state.serverResetEpoch, "reset must invalidate every pre-reset client snapshot");
  assert((calls.tables as string[]).includes("player_saves"), "existing save row must be read and updated through RPC");
});

Deno.test("stale save version is returned as a conflict", async () => {
  const { handler } = fixture({ commit: { conflict: true, updatedAt: "2026-11-08T20:02:00.000Z" } });
  const response = await handler(commandRequest({ type: "resetSave" }));
  const body = await readJson(response);
  assert(response.status === 409, "expected 409");
  assert(body.updatedAt === "2026-11-08T20:02:00.000Z", "expected current version in conflict response");
});

Deno.test("replayed commands return current save without committing again", async () => {
  const state = createFreshState();
  const { handler, calls } = fixture({ state, receipt: { result: { state: { gold: 1 } } } });
  const response = await handler(commandRequest({ type: "resetSave" }, { expectedUpdatedAt: "2026-11-08T19:59:00.000Z" }));
  const body = await readJson(response);
  assert(response.status === 200, "replayed command must succeed");
  assert(body.replayed === true, "expected replay response");
  assert(calls.rpc === undefined, "replay must not execute the command again");
});

Deno.test("concurrent replay reloads the latest save instead of returning an older receipt snapshot", async () => {
  const state = createFreshState();
  state.gold = 900;
  const { handler, calls } = fixture({
    state,
    commit: { replayed: true, result: { state: { gold: 500 } }, updatedAt: "2026-11-08T20:02:00.000Z" },
  });
  const response = await handler(commandRequest({ type: "resetSave" }));
  const body = await readJson(response);
  assert(response.status === 200, "concurrent replay must succeed");
  assert(body.replayed === true, "expected replay response");
  assert((body.state as GameState).gold === 900, "replay must return the latest saved state");
  assert((calls.tables as string[]).filter((table) => table === "player_saves").length === 2, "replay must reload the save after commit receipt check");
});
