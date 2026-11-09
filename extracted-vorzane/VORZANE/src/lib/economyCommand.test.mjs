import { test } from "node:test";
import assert from "node:assert/strict";
import { createCommandId, invokeResetSave } from "./economyCommand.ts";

test("command IDs are valid UUIDs", () => {
  assert.match(createCommandId(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
});

test("reset sends a typed command with the expected save version", async () => {
  let received;
  const result = await invokeResetSave(async (body) => {
    received = body;
    return {
      data: { state: { gold: 0 }, updatedAt: "2026-11-09T10:00:00.000Z", replayed: false },
      error: null,
    };
  }, "2026-11-09T09:00:00.000Z", "10000000-0000-4000-8000-000000000001");

  assert.deepEqual(received, {
    commandId: "10000000-0000-4000-8000-000000000001",
    expectedUpdatedAt: "2026-11-09T09:00:00.000Z",
    command: { type: "resetSave" },
  });
  assert.equal(result.error, null);
  assert.equal(result.data?.updatedAt, "2026-11-09T10:00:00.000Z");
  assert.equal(result.data?.replayed, false);
});

test("reset refuses a missing or invalid save version before calling the server", async () => {
  let called = false;
  const result = await invokeResetSave(async () => {
    called = true;
    return { data: null, error: null };
  }, "not-a-date");

  assert.equal(called, false);
  assert.match(result.error?.message ?? "", /valid save version/i);
});

test("reset preserves server errors", async () => {
  const result = await invokeResetSave(async () => ({
    data: null,
    error: { message: "Save changed; reload and retry" },
  }), "2026-11-09T09:00:00.000Z");

  assert.equal(result.data, null);
  assert.equal(result.error?.message, "Save changed; reload and retry");
});

test("reset rejects malformed successful responses", async () => {
  const result = await invokeResetSave(async () => ({
    data: { state: {}, updatedAt: null, replayed: "false" },
    error: null,
  }), "2026-11-09T09:00:00.000Z");

  assert.equal(result.data, null);
  assert.match(result.error?.message ?? "", /invalid save-reset response/i);
});
