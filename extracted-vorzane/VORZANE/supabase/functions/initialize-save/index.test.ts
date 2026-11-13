import { createFreshState } from "../../../src/game/model.ts";
import { createInitializeSaveHandler } from "./index.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  return await response.json() as Record<string, unknown>;
}

function fixture(options: {
  user?: { id: string } | null;
  authError?: unknown;
  existing?: { game_state: unknown; updated_at: string } | null;
  readError?: unknown;
  insertError?: unknown;
} = {}) {
  let save = options.existing ?? null;
  const calls: Record<string, unknown> = { inserts: 0, reads: 0 };
  const caller = {
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
      return {
        select(columns: string) { calls.columns = columns; return this; },
        eq(column: string, value: string) { calls.filter = [column, value]; return this; },
        async maybeSingle() {
          calls.reads = Number(calls.reads) + 1;
          return { data: save, error: options.readError ?? null };
        },
      };
    },
  };
  let inserted = false;
  const adminBuilder = {
    upsert(row: Record<string, unknown>, config: Record<string, unknown>) {
      calls.inserts = Number(calls.inserts) + 1;
      calls.insertedRow = row;
      calls.insertConfig = config;
      if (!options.insertError && !save) {
        save = {
          game_state: row.game_state,
          updated_at: "2026-11-09T06:30:00.000Z",
        };
        inserted = true;
      }
      return this;
    },
    select(columns: string) { calls.adminColumns = columns; return this; },
    async maybeSingle() {
      return {
        data: inserted ? { user_id: "user-a" } : null,
        error: options.insertError ?? null,
      };
    },
  };
  const admin = {
    from(table: string) {
      calls.adminTable = table;
      return adminBuilder;
    },
  };
  const factory = ((url: string, key: string, config: unknown) => {
    ((calls.clients ??= []) as unknown[]).push({ url, key, config });
    return key === "test-service-role-key" ? admin : caller;
  }) as unknown as Parameters<typeof createInitializeSaveHandler>[0];
  const handler = createInitializeSaveHandler(factory, (name) => ({
    SUPABASE_URL: "https://test.supabase.co",
    SUPABASE_ANON_KEY: "test-anon-key",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
  }[name]));
  return { handler, calls };
}

function request(body: unknown = {}) {
  return new Request("https://local.test/initialize-save", {
    method: "POST",
    headers: { Authorization: "Bearer valid", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

Deno.test("OPTIONS and unsupported methods do not contact Supabase", async () => {
  const first = fixture();
  const options = await first.handler(new Request("https://local.test/initialize-save", { method: "OPTIONS" }));
  assert(options.status === 200, "expected CORS preflight");
  assert(Number(first.calls.reads) === 0, "preflight must not query database");

  const second = fixture();
  const get = await second.handler(new Request("https://local.test/initialize-save", { method: "GET" }));
  assert(get.status === 405, "GET must be rejected");
  assert(Number(second.calls.reads) === 0, "GET must not query database");
});

Deno.test("missing and invalid authentication are rejected", async () => {
  const missing = fixture();
  const noToken = await missing.handler(new Request("https://local.test/initialize-save", { method: "POST", body: "{}" }));
  assert(noToken.status === 401, "missing bearer token must be rejected");

  const invalid = fixture({ user: null, authError: new Error("invalid token") });
  const badToken = await invalid.handler(request());
  assert(badToken.status === 401, "invalid user token must be rejected");
  assert(Number(invalid.calls.inserts) === 0, "invalid user must not initialize a save");
});

Deno.test("client-supplied state is rejected", async () => {
  const { handler, calls } = fixture();
  const response = await handler(request({ game_state: { gold: 999999999 } }));
  assert(response.status === 400, "client-supplied state must be rejected");
  assert(Number(calls.inserts) === 0, "invalid payload must not write");
});

Deno.test("existing save is returned unchanged without an insert", async () => {
  const existingState = createFreshState();
  existingState.gold = 321;
  const { handler, calls } = fixture({
    existing: { game_state: existingState, updated_at: "2026-11-09T06:00:00.000Z" },
  });
  const response = await handler(request());
  const body = await readJson(response);
  assert(response.status === 200, "existing save should be returned");
  assert(body.created === false, "existing save must not be reported as new");
  assert((body.state as { gold: number }).gold === 321, "existing player progress must be preserved");
  assert(Number(calls.inserts) === 0, "existing save must never be overwritten");
});

Deno.test("missing save is initialized from canonical server state and verified through caller RLS", async () => {
  const { handler, calls } = fixture();
  const response = await handler(request());
  const body = await readJson(response);
  assert(response.status === 200, "new save should be initialized");
  assert(body.created === true, "new save must be reported as created");
  const initializedState = body.state as { gold: number; serverResetEpoch?: string };
  assert(initializedState.gold === 0, "server must use canonical fresh state");
  assert(typeof initializedState.serverResetEpoch === "string" && /^[0-9a-f-]{36}$/i.test(initializedState.serverResetEpoch),
    "every new account must receive a server-issued reset epoch");
  const insertedRow = calls.insertedRow as { game_state: { serverResetEpoch?: string } };
  assert(insertedRow.game_state.serverResetEpoch === initializedState.serverResetEpoch,
    "the server-issued reset epoch must be persisted with the new save");
  assert(Number(calls.inserts) === 1, "exactly one insert should be attempted");
  assert(Number(calls.reads) === 2, "save must be verified after insertion");
  assert((calls.insertConfig as Record<string, unknown>).ignoreDuplicates === true, "concurrent initialization must not overwrite an existing row");
  assert(JSON.stringify(calls.filter) === JSON.stringify(["user_id", "user-a"]), "verification read must be scoped to caller");
});

Deno.test("database errors fail closed", async () => {
  const read = fixture({ readError: new Error("private database details") });
  const readResponse = await read.handler(request());
  assert(readResponse.status === 500, "read failure must not create a save");
  assert(Number(read.calls.inserts) === 0, "read failure must not write");

  const insert = fixture({ insertError: new Error("insert failed") });
  const insertResponse = await insert.handler(request());
  assert(insertResponse.status === 500, "insert failure must be reported generically");
});
