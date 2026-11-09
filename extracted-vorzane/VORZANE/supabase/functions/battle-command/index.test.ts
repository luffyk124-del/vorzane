import { createHeroState } from "../../../src/game/engine.ts";
import { createFreshState } from "../../../src/game/model.ts";
import { createBattleCommandHandler } from "./index.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  return await response.json() as Record<string, unknown>;
}

function fixture(options: {
  state?: ReturnType<typeof createHeroState>;
  saveMissing?: boolean;
  readError?: unknown;
  user?: { id: string } | null;
  authError?: unknown;
  receipt?: { result: Record<string, unknown> } | null;
  commit?: Record<string, unknown>;
  commitError?: unknown;
} = {}) {
  const state = options.state ?? createHeroState("Test", "Warrior");
  const calls: Record<string, unknown> = {};
  const builder = {
    select(columns: string) { calls.columns = columns; return this; },
    eq(column: string, value: string) {
      const filters = (calls.filters ??= []) as unknown[];
      filters.push([column, value]);
      return this;
    },
    async maybeSingle() {
      if (calls.table === "player_command_receipts") {
        return { data: options.receipt ?? null, error: null };
      }
      return {
        data: options.saveMissing || options.readError ? null : { game_state: state, updated_at: "2026-11-09T06:00:00.000Z" },
        error: options.readError ?? null,
      };
    },
  };
  const fakeClient = {
    auth: {
      async getUser() {
        return {
          data: { user: options.user === undefined ? { id: "user-a" } : options.user },
          error: options.authError ?? null,
        };
      },
    },
    from(table: string) {
      calls.table = table;
      return builder;
    },
    async rpc(name: string, args: Record<string, unknown>) {
      calls.rpc = name;
      calls.args = args;
      return {
        data: options.commit ?? {
          replayed: false,
          result: args.p_result,
          updatedAt: "2026-11-09T06:01:00.000Z",
        },
        error: options.commitError ?? null,
      };
    },
  };
  const factory = ((url: string, key: string, config: unknown) => {
    ((calls.clients ??= []) as unknown[]).push({ url, key, config });
    return fakeClient;
  }) as unknown as Parameters<typeof createBattleCommandHandler>[0];
  const handler = createBattleCommandHandler(factory, (name) => ({
    SUPABASE_URL: "https://test.supabase.co",
    SUPABASE_ANON_KEY: "test-anon-key",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
  }[name]));
  return { handler, calls, state };
}

function battleRequest(overrides: Record<string, unknown> = {}) {
  return new Request("https://local.test/battle-command", {
    method: "POST",
    headers: { Authorization: "Bearer valid", "Content-Type": "application/json" },
    body: JSON.stringify({
      commandId: "10000000-0000-4000-8000-000000000001",
      expectedUpdatedAt: "2026-11-09T06:00:00.000Z",
      mode: "cave",
      ...overrides,
    }),
  });
}

Deno.test("OPTIONS and unsupported methods do not contact Supabase", async () => {
  const first = fixture();
  const preflight = await first.handler(new Request("https://local.test/battle-command", { method: "OPTIONS" }));
  assert(preflight.status === 200, "expected preflight 200");
  assert(Object.keys(first.calls).length === 0, "preflight must not contact Supabase");

  const second = fixture();
  const get = await second.handler(new Request("https://local.test/battle-command", { method: "GET" }));
  assert(get.status === 405, "expected method rejection");
  assert(Object.keys(second.calls).length === 0, "GET must not contact Supabase");
});

Deno.test("missing or invalid authentication is rejected", async () => {
  const missing = fixture();
  const noToken = await missing.handler(new Request("https://local.test/battle-command", { method: "POST" }));
  assert(noToken.status === 401, "missing token must be rejected");

  const invalid = fixture({ user: null, authError: new Error("invalid token") });
  const badToken = await invalid.handler(battleRequest());
  assert(badToken.status === 401, "invalid token must be rejected");
  assert(invalid.calls.rpc === undefined, "invalid token must not commit");
});

Deno.test("malformed payload and unsupported mode are rejected before database access", async () => {
  const malformed = fixture();
  const badId = await malformed.handler(battleRequest({ commandId: "not-a-uuid" }));
  assert(badId.status === 400, "invalid command ID must be rejected");
  assert(Object.keys(malformed.calls).length === 0, "malformed payload must not access database");

  const unsupported = fixture();
  const badMode = await unsupported.handler(battleRequest({ mode: "custom" }));
  assert(badMode.status === 400, "unsupported mode must be rejected");
  assert(Object.keys(unsupported.calls).length === 0, "unsupported mode must not access database");
});

Deno.test("battle is computed on the server and only sanitized display data is returned", async () => {
  const { handler, calls, state } = fixture();
  const response = await handler(battleRequest());
  const body = await readJson(response);
  assert(response.status === 200, "expected battle success");
  assert(calls.rpc === "commit_player_command", "battle must use atomic command commit");
  const filters = calls.filters as unknown[];
  assert(JSON.stringify(filters.slice(0, 2)) === JSON.stringify([["user_id", "user-a"], ["user_id", "user-a"]]), "save and receipt reads must be scoped to caller");
  const args = calls.args as Record<string, unknown>;
  const saved = args.p_game_state as ReturnType<typeof createHeroState>;
  assert(saved.battles === state.battles + 1, "server must advance the battle counter");
  const result = args.p_result as Record<string, unknown>;
  const sequence = result.sequence as Record<string, unknown>;
  const sequenceResult = sequence.result as Record<string, unknown>;
  assert(!Object.hasOwn(sequenceResult, "state"), "receipt must not contain client-readable game state");
  const returnedSequence = body.sequence as Record<string, unknown>;
  const returnedResult = returnedSequence.result as Record<string, unknown>;
  assert(!Object.hasOwn(returnedResult, "state"), "response must not expose resulting game state");
  assert(body.updatedAt === "2026-11-09T06:01:00.000Z", "expected committed save version");
});

Deno.test("a replay returns the stored battle display without committing again", async () => {
  const storedSequence = { id: "battle-receipt", mode: "cave", result: { won: true, gold: 4, xp: 16, dropped: null, log: [] } };
  const { handler, calls } = fixture({ receipt: { result: { sequence: storedSequence } } });
  const response = await handler(battleRequest({ expectedUpdatedAt: "2026-11-09T05:00:00.000Z" }));
  const body = await readJson(response);
  assert(response.status === 200, "receipt replay must succeed even with an old version");
  assert(body.replayed === true, "response must identify a replay");
  assert(JSON.stringify(body.sequence) === JSON.stringify(storedSequence), "replay must return original sequence");
  assert(calls.rpc === undefined, "replay must not commit again");
});

Deno.test("stale versions, missing saves, and saves without a hero fail without committing", async () => {
  const stale = fixture();
  const staleResponse = await stale.handler(battleRequest({ expectedUpdatedAt: "2026-11-09T05:00:00.000Z" }));
  assert(staleResponse.status === 409, "stale version must be rejected");
  assert(stale.calls.rpc === undefined, "stale version must not commit");

  const missing = fixture({ saveMissing: true });
  const missingResponse = await missing.handler(battleRequest());
  assert(missingResponse.status === 404, "missing save must be rejected");
  assert(missing.calls.rpc === undefined, "missing save must not commit");

  const noHero = fixture({ state: createFreshState() });
  const noHeroResponse = await noHero.handler(battleRequest());
  assert(noHeroResponse.status === 409, "save without a hero must be rejected");
  assert(noHero.calls.rpc === undefined, "save without a hero must not commit");
});
