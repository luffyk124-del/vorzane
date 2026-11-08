import { createGameStateHandler } from "./index.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function json(response: Response): Promise<Record<string, unknown>> {
  return await response.json() as Record<string, unknown>;
}

function fixture(options: {
  user?: { id: string } | null;
  authError?: unknown;
  save?: { game_state: unknown; updated_at: string } | null;
  queryError?: unknown;
  env?: Record<string, string>;
} = {}) {
  const calls: Record<string, unknown> = {};
  const builder = {
    select(columns: string) { calls.columns = columns; return this; },
    eq(column: string, value: string) { calls.filter = [column, value]; return this; },
    async maybeSingle() {
      return { data: options.save ?? null, error: options.queryError ?? null };
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
  };
  const factory = ((url: string, key: string, config: unknown) => {
    calls.url = url;
    calls.key = key;
    calls.config = config;
    return fakeClient;
  }) as unknown as Parameters<typeof createGameStateHandler>[0];
  const env = options.env ?? { SUPABASE_URL: "https://test.supabase.co", SUPABASE_ANON_KEY: "test-anon-key" };
  return { handler: createGameStateHandler(factory, (name) => env[name]), calls };
}

Deno.test("OPTIONS returns CORS headers without contacting Supabase", async () => {
  const { handler, calls } = fixture();
  const response = await handler(new Request("https://local.test/game-state", { method: "OPTIONS" }));
  assert(response.status === 200, "expected 200");
  assert(response.headers.get("Access-Control-Allow-Methods") === "GET, OPTIONS", "expected allowed methods");
  assert(Object.keys(calls).length === 0, "preflight must not call Supabase");
});

Deno.test("non-GET requests are rejected", async () => {
  const { handler, calls } = fixture();
  const response = await handler(new Request("https://local.test/game-state", { method: "POST" }));
  assert(response.status === 405, "expected 405");
  assert(Object.keys(calls).length === 0, "unsupported method must not call Supabase");
});

Deno.test("missing bearer token is rejected", async () => {
  const { handler, calls } = fixture();
  const response = await handler(new Request("https://local.test/game-state"));
  assert(response.status === 401, "expected 401");
  assert(Object.keys(calls).length === 0, "unauthenticated request must not call Supabase");
});

Deno.test("missing Supabase configuration fails closed", async () => {
  const { handler, calls } = fixture({ env: {} });
  const response = await handler(new Request("https://local.test/game-state", { headers: { Authorization: "Bearer token" } }));
  assert(response.status === 500, "expected 500");
  assert(Object.keys(calls).length === 0, "missing configuration must not call Supabase");
});

Deno.test("invalid JWT is rejected", async () => {
  const { handler, calls } = fixture({ user: null, authError: new Error("invalid token") });
  const response = await handler(new Request("https://local.test/game-state", { headers: { Authorization: "Bearer invalid" } }));
  assert(response.status === 401, "expected 401");
  assert(calls.url === "https://test.supabase.co", "expected authenticated Supabase client");
});

Deno.test("valid JWT reads only the caller's own save through RLS", async () => {
  const save = { game_state: { gold: 17 }, updated_at: "2026-11-08T20:00:00Z" };
  const { handler, calls } = fixture({ user: { id: "user-a" }, save });
  const response = await handler(new Request("https://local.test/game-state", { headers: { Authorization: "Bearer valid" } }));
  const body = await json(response);
  assert(response.status === 200, "expected 200");
  assert(calls.table === "player_saves", "expected player_saves table");
  assert(calls.columns === "game_state, updated_at", "unexpected selected columns");
  assert(JSON.stringify(calls.filter) === JSON.stringify(["user_id", "user-a"]), "query must be scoped to authenticated user");
  assert((calls.config as { global?: { headers?: { Authorization?: string } } }).global?.headers?.Authorization === "Bearer valid", "caller JWT must be forwarded");
  assert(JSON.stringify(body.state) === JSON.stringify(save.game_state), "save state mismatch");
  assert(body.updatedAt === save.updated_at, "updated timestamp mismatch");
});

Deno.test("database errors return a generic server error", async () => {
  const { handler } = fixture({ queryError: new Error("private database details") });
  const response = await handler(new Request("https://local.test/game-state", { headers: { Authorization: "Bearer valid" } }));
  const body = await json(response);
  assert(response.status === 500, "expected 500");
  assert(body.error === "Could not load save", "database internals must not be exposed");
});
