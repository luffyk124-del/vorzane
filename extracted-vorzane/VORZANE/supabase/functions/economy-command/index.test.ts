import { createHeroState, buyItem } from "../../../src/game/engine.ts";
import { createEconomyCommandHandler } from "./index.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  return await response.json() as Record<string, unknown>;
}

function fixture(options: {
  state?: ReturnType<typeof createHeroState>;
  user?: { id: string } | null;
  authError?: unknown;
  readError?: unknown;
  commit?: Record<string, unknown>;
  commitError?: { code?: string } | null;
} = {}) {
  const state = options.state ?? createHeroState("Test", "Warrior");
  const calls: Record<string, unknown> = {};
  const builder = {
    select(columns: string) { calls.columns = columns; return this; },
    eq(column: string, value: string) { calls.filter = [column, value]; return this; },
    async maybeSingle() {
      return {
        data: options.readError ? null : { game_state: state, updated_at: "2026-11-08T20:00:00.000Z" },
        error: options.readError ?? null,
      };
    },
  };
  const fakeClient = {
    auth: { async getUser() {
      return { data: { user: options.user === undefined ? { id: "user-a" } : options.user }, error: options.authError ?? null };
    } },
    from(table: string) { calls.table = table; return builder; },
    async rpc(name: string, args: Record<string, unknown>) {
      calls.rpc = name;
      calls.args = args;
      return {
        data: options.commit ?? { replayed: false, result: args.p_result, updatedAt: "2026-11-08T20:01:00.000Z" },
        error: options.commitError ?? null,
      };
    },
  };
  const factory = ((url: string, key: string, config: unknown) => {
    calls.url = url;
    calls.key = key;
    calls.config = config;
    return fakeClient;
  }) as unknown as Parameters<typeof createEconomyCommandHandler>[0];
  const handler = createEconomyCommandHandler(factory, (name) => ({
    SUPABASE_URL: "https://test.supabase.co",
    SUPABASE_ANON_KEY: "test-anon-key",
  }[name]));
  return { handler, calls, state };
}

function commandRequest(command: unknown, overrides: Record<string, unknown> = {}) {
  return new Request("https://local.test/economy-command", {
    method: "POST",
    headers: { Authorization: "Bearer valid", "Content-Type": "application/json" },
    body: JSON.stringify({
      commandId: "10000000-0000-4000-8000-000000000001",
      expectedUpdatedAt: "2026-11-08T20:00:00.000Z",
      command,
      ...overrides,
    }),
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

Deno.test("malformed command is rejected before reading or committing", async () => {
  const { handler, calls } = fixture();
  const response = await handler(commandRequest({ type: "buyItem", itemId: "" }));
  assert(response.status === 400, "expected 400");
  assert(calls.table === undefined && calls.rpc === undefined, "invalid command must not touch save or RPC");
});

Deno.test("buyItem uses canonical game rules and commits the caller's save", async () => {
  const state = createHeroState("Test", "Warrior");
  state.gold = 1_000;
  const { handler, calls } = fixture({ state });
  const response = await handler(commandRequest({ type: "buyItem", itemId: "sword1" }));
  const body = await readJson(response);
  assert(response.status === 200, "expected 200");
  assert(calls.table === "player_saves", "expected player save read");
  assert(JSON.stringify(calls.filter) === JSON.stringify(["user_id", "user-a"]), "save read must be scoped to caller");
  assert(calls.rpc === "commit_player_command", "expected atomic command commit");
  const args = calls.args as Record<string, unknown>;
  const saved = args.p_game_state as ReturnType<typeof createHeroState>;
  assert(saved.gold === 900, "canonical purchase price must be deducted");
  assert(saved.inventory.length === 1, "purchased item must be added");
  assert(body.replayed === false, "expected first execution");
});

Deno.test("insufficient gold is rejected without a database commit", async () => {
  const state = createHeroState("Test", "Warrior");
  state.gold = 0;
  const { handler, calls } = fixture({ state });
  const response = await handler(commandRequest({ type: "buyItem", itemId: "sword1" }));
  assert(response.status === 400, "expected 400");
  assert(calls.rpc === undefined, "invalid purchase must not be committed");
});

Deno.test("stale save version is returned as a conflict", async () => {
  const { handler } = fixture({ commit: { conflict: true, updatedAt: "2026-11-08T20:02:00.000Z" } });
  const response = await handler(commandRequest({ type: "buyItem", itemId: "sword1" }));
  const body = await readJson(response);
  assert(response.status === 409, "expected 409");
  assert(body.updatedAt === "2026-11-08T20:02:00.000Z", "expected current version in conflict response");
});

Deno.test("another unauthenticated identity cannot invoke commands", async () => {
  const { handler } = fixture({ user: null, authError: new Error("invalid token") });
  const response = await handler(commandRequest({ type: "buyItem", itemId: "sword1" }));
  assert(response.status === 401, "expected 401");
});
