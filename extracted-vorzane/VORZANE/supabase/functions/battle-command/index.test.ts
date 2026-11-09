import { createHeroState } from "../../../src/game/engine.ts";
import { createFreshState, type GameState } from "../../../src/game/model.ts";
import { createBattleCommandHandler } from "./index.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  return await response.json() as Record<string, unknown>;
}

const commandId = "10000000-0000-4000-8000-000000000001";
const updatedAt = "2026-11-09T08:00:00.000Z";

function fixture(options: {
  state?: GameState;
  user?: { id: string } | null;
  authError?: unknown;
  receipt?: { result: Record<string, unknown> } | null;
  readError?: unknown;
  commit?: Record<string, unknown>;
  commitError?: { code?: string } | null;
} = {}) {
  const state = options.state ?? createHeroState("Test", "Warrior");
  const calls: Record<string, unknown> = { tables: [], filters: {}, rpcCalls: [], keys: [] };
  const fakeClient = (key: string) => ({
    auth: {
      async getUser() {
        return {
          data: { user: options.user === undefined ? { id: "user-a" } : options.user },
          error: options.authError ?? null,
        };
      },
    },
    from(table: string) {
      (calls.tables as string[]).push(table);
      let selected = "";
      const filters: [string, string][] = [];
      const builder = {
        select(columns: string) { selected = columns; return this; },
        eq(column: string, value: string) { filters.push([column, value]); return this; },
        async maybeSingle() {
          ((calls.filters as Record<string, unknown[]>)[table] ??= []).push(filters);
          if (table === "player_command_receipts") {
            return { data: options.receipt ?? null, error: null };
          }
          return {
            data: options.readError ? null : { game_state: state, updated_at: updatedAt },
            error: options.readError ?? null,
          };
        },
      };
      void selected;
      return builder;
    },
    async rpc(name: string, args: Record<string, unknown>) {
      (calls.rpcCalls as unknown[]).push({ name, args });
      return {
        data: options.commit ?? { replayed: false, result: args.p_result, updatedAt: "2026-11-09T08:01:00.000Z" },
        error: options.commitError ?? null,
      };
    },
  });

  const factory = ((url: string, key: string, config: unknown) => {
    ((calls.clients ??= []) as unknown[]).push({ url, key, config });
    return fakeClient(key);
  }) as unknown as Parameters<typeof createBattleCommandHandler>[0];
  const handler = createBattleCommandHandler(
    factory,
    (name) => ({
      SUPABASE_URL: "https://test.supabase.co",
      SUPABASE_ANON_KEY: "test-anon-key",
      SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
    }[name]),
    () => 0.99,
  );
  return { handler, calls, state };
}

function request(body: unknown = { commandId, mode: "cave" }) {
  return new Request("https://local.test/battle-command", {
    method: "POST",
    headers: { Authorization: "Bearer valid", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

Deno.test("OPTIONS and unsupported methods do not contact Supabase", async () => {
  const first = fixture();
  const optionsResponse = await first.handler(new Request("https://local.test/battle-command", { method: "OPTIONS" }));
  assert(optionsResponse.status === 200, "expected CORS preflight");
  assert((first.calls.clients as unknown[] | undefined) === undefined, "preflight must not create clients");

  const second = fixture();
  const get = await second.handler(new Request("https://local.test/battle-command", { method: "GET" }));
  assert(get.status === 405, "GET must be rejected");
  assert((second.calls.clients as unknown[] | undefined) === undefined, "GET must not create clients");
});

Deno.test("missing or invalid bearer token is rejected", async () => {
  const missing = fixture();
  const response = await missing.handler(new Request("https://local.test/battle-command", { method: "POST" }));
  assert(response.status === 401, "missing bearer token must be rejected");
  assert((missing.calls.clients as unknown[] | undefined) === undefined, "missing token must not contact Supabase");

  const invalid = fixture({ user: null, authError: new Error("invalid token") });
  assert((await invalid.handler(request())).status === 401, "invalid identity must be rejected");
});

Deno.test("malformed battle payloads are rejected before database access", async () => {
  for (const body of [
    { commandId: "not-a-uuid", mode: "cave" },
    { commandId, mode: "unknown" },
    { commandId, mode: "cave", state: { gold: 999999 } },
  ]) {
    const { handler, calls } = fixture();
    const response = await handler(request(body));
    assert(response.status === 400, "malformed command must be rejected");
    assert((calls.clients as unknown[] | undefined) === undefined, "invalid payload must not contact Supabase");
  }
});

Deno.test("server generates, resolves, and commits battle outcome without returning client-authoritative state in the sequence", async () => {
  const { handler, calls, state } = fixture();
  const response = await handler(request({ commandId, mode: "cave" }));
  const body = await readJson(response);
  assert(response.status === 200, "battle should commit");
  assert(body.replayed === false, "first command must not be a replay");
  assert(typeof body.updatedAt === "string", "commit version must be returned");

  const sequence = body.sequence as Record<string, unknown>;
  assert(sequence.mode === "cave", "server must preserve requested battle mode");
  const presentationResult = sequence.result as Record<string, unknown>;
  assert(!("state" in presentationResult), "animation receipt must not expose a client-supplied result state");

  const rpcCalls = calls.rpcCalls as { name: string; args: Record<string, unknown> }[];
  assert(rpcCalls.length === 1 && rpcCalls[0]!.name === "commit_player_command", "one atomic receipt commit is required");
  const args = rpcCalls[0]!.args;
  const saved = args.p_game_state as GameState;
  assert(saved.battles === state.battles + 1, "server must increment battle count");
  assert(saved.wins >= state.wins, "server must calculate the win counter");
  assert((args.p_result as Record<string, unknown>).sequence !== undefined, "idempotency receipt must store the presentation sequence");
  assert(!("state" in ((args.p_result as { sequence: { result: Record<string, unknown> } }).sequence.result)), "receipt must not store a client-facing state snapshot");
  assert((calls.keys as string[]).includes("test-service-role-key"), "atomic commit must use server-only credentials");
});

Deno.test("replayed battle command returns its original sequence and current save without recommitting", async () => {
  const replaySequence = { id: "battle-original", mode: "tower", result: { won: true, gold: 10, xp: 12, dropped: null, log: [] } };
  const current = createHeroState("Test", "Warrior");
  current.gold = 500;
  const { handler, calls } = fixture({
    state: current,
    receipt: { result: { sequence: replaySequence } },
  });
  const response = await handler(request({ commandId, mode: "cave" }));
  const body = await readJson(response);
  assert(response.status === 200, "replay should succeed");
  assert(body.replayed === true, "existing command should be marked replayed");
  assert(JSON.stringify(body.sequence) === JSON.stringify(replaySequence), "replay must return original animation");
  assert((body.state as GameState).gold === 500, "replay must return current save, not old state");
  assert((calls.rpcCalls as unknown[]).length === 0, "replay must not commit twice");
});

Deno.test("save version conflict is rejected without returning a generated battle", async () => {
  const { handler } = fixture({ commit: { conflict: true, updatedAt: "2026-11-09T08:02:00.000Z" } });
  const response = await handler(request());
  const body = await readJson(response);
  assert(response.status === 409, "stale version must be rejected");
  assert(body.sequence === undefined, "conflicted battle must not be presented as committed");
});

Deno.test("oversized battle request is rejected before database access", async () => {
  const { handler, calls } = fixture();
  const oversized = new Request("https://local.test/battle-command", {
    method: "POST",
    headers: { Authorization: "Bearer valid", "Content-Type": "application/json" },
    body: JSON.stringify({ commandId, mode: "cave", padding: "x".repeat(5000) }),
  });
  const response = await handler(oversized);
  assert(response.status === 413, "oversized request must be rejected");
  assert((calls.clients as unknown[] | undefined) === undefined, "oversized request must not contact Supabase");
});

Deno.test("new account without a hero cannot start battle", async () => {
  const { handler, calls } = fixture({ state: createFreshState() });
  const response = await handler(request());
  assert(response.status === 409, "hero is required");
  assert((calls.rpcCalls as unknown[]).length === 0, "no battle may be committed without a hero");
});
