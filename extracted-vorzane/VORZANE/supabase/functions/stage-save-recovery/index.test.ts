import { createStageSaveRecoveryHandler } from "./index.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  return await response.json() as Record<string, unknown>;
}

function fixture(options: {
  user?: { id: string } | null;
  authError?: unknown;
  insertError?: { code?: string } | null;
  inserted?: { recovery_id: string; status: string } | null;
  existing?: { recovery_id: string; status: string } | null;
  readError?: unknown;
} = {}) {
  const calls: Record<string, unknown> = { tables: [], inserts: [] };
  const caller = {
    auth: {
      async getUser() {
        return {
          data: { user: options.user === undefined ? { id: "user-a" } : options.user },
          error: options.authError ?? null,
        };
      },
    },
  };
  let readCount = 0;
  const admin = {
    from(table: string) {
      (calls.tables as string[]).push(table);
      const builder = {
        insert(row: Record<string, unknown>) {
          (calls.inserts as unknown[]).push(row);
          return this;
        },
        select(columns: string) {
          (calls.selects ??= []).push({ table, columns });
          return this;
        },
        eq(column: string, value: string) {
          (calls.filters ??= []).push({ table, column, value });
          return this;
        },
        async maybeSingle() {
          readCount += 1;
          if (readCount === 1) {
            return {
              data: options.inserted ?? null,
              error: options.insertError ?? null,
            };
          }
          return {
            data: options.existing ?? null,
            error: options.readError ?? null,
          };
        },
      };
      return builder;
    },
  };
  const factory = ((url: string, key: string, config: unknown) => {
    ((calls.clients ??= []) as unknown[]).push({ url, key, config });
    return key === "test-service-role-key" ? admin : caller;
  }) as unknown as Parameters<typeof createStageSaveRecoveryHandler>[0];
  const handler = createStageSaveRecoveryHandler(factory, (name) => ({
    SUPABASE_URL: "https://test.supabase.co",
    SUPABASE_ANON_KEY: "test-anon-key",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
  }[name]));
  return { handler, calls };
}

const recoveryKey = "10000000-0000-4000-8000-000000000001";
function request(body: unknown = {
  recoveryKey,
  source: "legacy",
  snapshot: { gold: 999999999, hero: { level: 999 }, inventory: [{ id: "forged" }] },
}) {
  return new Request("https://local.test/stage-save-recovery", {
    method: "POST",
    headers: { Authorization: "Bearer valid", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

Deno.test("OPTIONS and unsupported methods do not contact Supabase", async () => {
  const first = fixture();
  const optionsResponse = await first.handler(new Request("https://local.test/stage-save-recovery", { method: "OPTIONS" }));
  assert(optionsResponse.status === 200, "expected CORS preflight");
  assert((first.calls.clients as unknown[] | undefined) === undefined, "preflight must not create clients");

  const second = fixture();
  const get = await second.handler(new Request("https://local.test/stage-save-recovery", { method: "GET" }));
  assert(get.status === 405, "GET must be rejected");
  assert((second.calls.clients as unknown[] | undefined) === undefined, "GET must not create clients");
});

Deno.test("missing bearer token and invalid users are rejected", async () => {
  const missing = fixture();
  const noToken = await missing.handler(new Request("https://local.test/stage-save-recovery", { method: "POST", body: "{}" }));
  assert(noToken.status === 401, "missing token must be rejected");

  const invalid = fixture({ user: null, authError: new Error("invalid token") });
  const badToken = await invalid.handler(request());
  assert(badToken.status === 401, "invalid user must be rejected");
  assert((invalid.calls.clients as unknown[]).length === 1, "invalid user must not create an admin client");
  assert((invalid.calls.inserts as unknown[]).length === 0, "invalid user must not stage a snapshot");
});

Deno.test("malformed payloads and unsupported source types are rejected", async () => {
  for (const body of [
    { recoveryKey: "not-a-uuid", source: "legacy", snapshot: {} },
    { recoveryKey, source: "other", snapshot: {} },
    { recoveryKey, source: "legacy", snapshot: [] },
    { recoveryKey, source: "legacy", snapshot: {}, unexpected: true },
  ]) {
    const { handler, calls } = fixture();
    const response = await handler(request(body));
    assert(response.status === 400, "invalid payload must be rejected");
    assert((calls.clients as unknown[] | undefined) === undefined, "invalid payload must be rejected before database access");
  }
});

Deno.test("oversized request and snapshot are rejected", async () => {
  const tooLarge = fixture();
  const hugeRequest = await tooLarge.handler(request({
    recoveryKey,
    source: "offline",
    snapshot: { data: "x".repeat(290 * 1024) },
  }));
  assert(hugeRequest.status === 413, "oversized body must be rejected");
  assert((tooLarge.calls.clients as unknown[] | undefined) === undefined, "oversized body must not access database");

  const tooLargeSnapshot = fixture();
  const large = await tooLargeSnapshot.handler(request({
    recoveryKey,
    source: "offline",
    snapshot: { data: "x".repeat(257 * 1024) },
  }));
  assert(large.status === 413, "snapshot above database cap must be rejected");
});

Deno.test("snapshot is stored in quarantine only and never written to player_saves", async () => {
  const inserted = { recovery_id: "20000000-0000-4000-8000-000000000001", status: "pending" };
  const { handler, calls } = fixture({ inserted });
  const response = await handler(request());
  const body = await readJson(response);
  assert(response.status === 200, "snapshot should be staged");
  assert(body.created === true && body.replayed === false, "new recovery should be reported");
  assert(body.recoveryId === inserted.recovery_id, "recovery id should be returned");
  assert(JSON.stringify(calls.tables) === JSON.stringify(["player_save_recovery"]), "only the recovery table may be accessed");
  const row = (calls.inserts as Record<string, unknown>[])[0]!;
  assert(row.user_id === "user-a", "recovery must be scoped to authenticated user");
  assert(row.source === "legacy", "recovery source must be stored");
  assert((row.snapshot as { gold: number }).gold === 999999999, "original payload must remain intact in quarantine");
  const clients = calls.clients as { key: string }[];
  assert(clients.some(client => client.key === "test-service-role-key"), "insert must use server-only service role");
});

Deno.test("duplicate recovery key is idempotent and does not replace the first snapshot", async () => {
  const existing = { recovery_id: "20000000-0000-4000-8000-000000000002", status: "pending" };
  const { handler, calls } = fixture({ insertError: { code: "23505" }, existing });
  const response = await handler(request({
    recoveryKey,
    source: "offline",
    snapshot: { gold: 1, hero: { level: 1 } },
  }));
  const body = await readJson(response);
  assert(response.status === 200, "duplicate key should return existing recovery");
  assert(body.replayed === true && body.created === false, "duplicate should be reported as replay");
  assert(body.recoveryId === existing.recovery_id, "existing recovery id should be returned");
  assert((calls.inserts as unknown[]).length === 1, "duplicate must not retry insert with replacement data");
  assert((calls.tables as string[]).length === 2, "duplicate path should read only the existing quarantine row");
});

Deno.test("database errors fail closed", async () => {
  const { handler } = fixture({ insertError: { code: "XX000" } });
  const response = await handler(request());
  assert(response.status === 500, "unexpected insert errors must fail closed");

  const duplicate = fixture({ insertError: { code: "23505" }, readError: new Error("read failed") });
  const readResponse = await duplicate.handler(request());
  assert(readResponse.status === 500, "unverifiable duplicate must fail closed");
});
