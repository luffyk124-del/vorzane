import assert from "node:assert/strict";
import test from "node:test";
import { writeSaveConditionally } from "./saveConcurrency.ts";

const RECORD = {
  user_id: "player-1",
  game_state: { gold: 42 },
  updated_at: "2026-11-09T12:00:00.000Z",
};
const CURRENT_VERSION = "2026-11-09T11:00:00.000Z";

function adapter(overrides = {}) {
  return {
    insert: async () => ({ data: { updated_at: RECORD.updated_at }, error: null }),
    update: async () => ({ data: { updated_at: RECORD.updated_at }, error: null }),
    ...overrides,
  };
}

test("a save without a known cloud version uses insert only", async () => {
  let inserted = false;
  let updated = false;
  const result = await writeSaveConditionally(adapter({
    insert: async (record) => {
      inserted = true;
      assert.deepEqual(record, RECORD);
      return { data: { updated_at: RECORD.updated_at }, error: null };
    },
    update: async () => {
      updated = true;
      return { data: null, error: null };
    },
  }), RECORD, null);

  assert.deepEqual(result, { kind: "saved", updatedAt: RECORD.updated_at });
  assert.equal(inserted, true);
  assert.equal(updated, false);
});

test("an insert uniqueness collision is reported as a conflict, never an overwrite", async () => {
  let updated = false;
  const result = await writeSaveConditionally(adapter({
    insert: async () => ({ data: null, error: { code: "23505", message: "duplicate key" } }),
    update: async () => {
      updated = true;
      return { data: null, error: null };
    },
  }), RECORD, null);

  assert.deepEqual(result, { kind: "conflict" });
  assert.equal(updated, false);
});

test("a known cloud version uses a conditional update with that exact version", async () => {
  let receivedVersion = null;
  const result = await writeSaveConditionally(adapter({
    insert: async () => {
      assert.fail("existing saves must never use insert");
    },
    update: async (record, expectedUpdatedAt) => {
      assert.deepEqual(record, RECORD);
      receivedVersion = expectedUpdatedAt;
      return { data: { updated_at: RECORD.updated_at }, error: null };
    },
  }), RECORD, CURRENT_VERSION);

  assert.deepEqual(result, { kind: "saved", updatedAt: RECORD.updated_at });
  assert.equal(receivedVersion, CURRENT_VERSION);
});

test("an update matching no row is reported as a version conflict", async () => {
  const result = await writeSaveConditionally(adapter({
    update: async () => ({ data: null, error: null }),
  }), RECORD, CURRENT_VERSION);

  assert.deepEqual(result, { kind: "conflict" });
});

test("permission and network errors remain failures, not version conflicts", async () => {
  const result = await writeSaveConditionally(adapter({
    update: async () => ({ data: null, error: { code: "42501", message: "permission denied" } }),
  }), RECORD, CURRENT_VERSION);

  assert.equal(result.kind, "failed");
  if (result.kind === "failed") assert.match(result.error.message, /permission denied/i);
});

test("invalid expected versions are rejected before any database request", async () => {
  let called = false;
  const result = await writeSaveConditionally(adapter({
    update: async () => {
      called = true;
      return { data: null, error: null };
    },
  }), RECORD, "not-a-timestamp");

  assert.equal(result.kind, "failed");
  assert.equal(called, false);
});

test("invalid versions returned by the database are rejected", async () => {
  const result = await writeSaveConditionally(adapter({
    insert: async () => ({ data: { updated_at: "invalid" }, error: null }),
  }), RECORD, null);

  assert.equal(result.kind, "failed");
  if (result.kind === "failed") assert.match(result.error.message, /invalid version/i);
});
