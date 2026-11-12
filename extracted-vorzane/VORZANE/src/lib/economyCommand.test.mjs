import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createCommandId,
  invokeEconomyCommand,
  invokeProfileAvatarUpdate,
  invokeResetSave,
  invokeSettingsUpdate,
} from "./economyCommand.ts";

const SAVE_VERSION = "2026-11-09T09:00:00.000Z";
const SERVER_VERSION = "2026-11-09T10:00:00.000Z";
const COMMAND_ID = "10000000-0000-4000-8000-000000000001";

test("command IDs are valid UUIDs", () => {
  assert.match(createCommandId(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
});

test("generic command transport preserves the typed command and validates its response", async () => {
  let received;
  const result = await invokeEconomyCommand(async (body) => {
    received = body;
    return { data: { state: { settings: { musicEnabled: false } }, updatedAt: SERVER_VERSION, replayed: false }, error: null };
  }, SAVE_VERSION, { type: "updateSettings", settings: { musicEnabled: false } }, COMMAND_ID);

  assert.deepEqual(received, {
    commandId: COMMAND_ID,
    expectedUpdatedAt: SAVE_VERSION,
    command: { type: "updateSettings", settings: { musicEnabled: false } },
  });
  assert.equal(result.error, null);
  assert.equal(result.data?.updatedAt, SERVER_VERSION);
});

test("reset sends a typed command with the expected save version", async () => {
  let received;
  const result = await invokeResetSave(async (body) => {
    received = body;
    return { data: { state: { gold: 0 }, updatedAt: SERVER_VERSION, replayed: false }, error: null };
  }, SAVE_VERSION, COMMAND_ID);

  assert.deepEqual(received, {
    commandId: COMMAND_ID,
    expectedUpdatedAt: SAVE_VERSION,
    command: { type: "resetSave" },
  });
  assert.equal(result.error, null);
  assert.equal(result.data?.updatedAt, SERVER_VERSION);
  assert.equal(result.data?.replayed, false);
});

test("reset refuses an invalid save version before calling the server", async () => {
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
  }), SAVE_VERSION);

  assert.equal(result.data, null);
  assert.equal(result.error?.message, "Save changed; reload and retry");
});

test("reset rejects malformed successful responses", async () => {
  const result = await invokeResetSave(async () => ({
    data: { state: {}, updatedAt: null, replayed: "false" },
    error: null,
  }), SAVE_VERSION);

  assert.equal(result.data, null);
  assert.match(result.error?.message ?? "", /invalid save-reset response/i);
});

test("settings update sends only supported settings and a save version", async () => {
  let received;
  const settings = { musicEnabled: false, volume: 65, musicVolume: 35, sfx: true };
  const result = await invokeSettingsUpdate(async (body) => {
    received = body;
    return { data: { state: {}, updatedAt: SERVER_VERSION, replayed: false }, error: null };
  }, SAVE_VERSION, settings, COMMAND_ID);

  assert.deepEqual(received, {
    commandId: COMMAND_ID,
    expectedUpdatedAt: SAVE_VERSION,
    command: { type: "updateSettings", settings },
  });
  assert.equal(result.error, null);
});

test("settings update rejects empty, unsupported, and out-of-range values before invoking", async () => {
  let calls = 0;
  const invoke = async () => {
    calls += 1;
    return { data: null, error: null };
  };

  for (const settings of [
    {},
    { volume: 101 },
    { musicVolume: -1 },
    { sfx: "yes" },
    { admin: true },
  ]) {
    const result = await invokeSettingsUpdate(invoke, SAVE_VERSION, settings);
    assert.ok(result.error);
  }

  assert.equal(calls, 0);
});

test("profile avatar update accepts only the supported avatar identifiers", async () => {
  let received;
  const result = await invokeProfileAvatarUpdate(async (body) => {
    received = body;
    return { data: { state: {}, updatedAt: SERVER_VERSION, replayed: true }, error: null };
  }, SAVE_VERSION, "Mage", COMMAND_ID);

  assert.deepEqual(received, {
    commandId: COMMAND_ID,
    expectedUpdatedAt: SAVE_VERSION,
    command: { type: "setProfileAvatar", avatarId: "Mage" },
  });
  assert.equal(result.data?.replayed, true);
});

test("profile avatar update rejects unknown identifiers before invoking", async () => {
  let called = false;
  const result = await invokeProfileAvatarUpdate(async () => {
    called = true;
    return { data: null, error: null };
  }, SAVE_VERSION, "Admin");

  assert.equal(called, false);
  assert.match(result.error?.message ?? "", /unsupported profile avatar/i);
});
