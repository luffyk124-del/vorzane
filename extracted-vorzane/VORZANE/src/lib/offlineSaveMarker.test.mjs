import assert from "node:assert/strict";
import test from "node:test";
import { clearOfflineSavePending, getOfflineSavePendingToken, hasOfflineSavePending, markOfflineSavePending } from "./offlineSaveMarker.ts";

function memoryStorage() {
  const values = new Map();
  return {
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => values.set(key, value),
    removeItem: async (key) => values.delete(key),
  };
}

test("failed sync marker survives reload and is scoped to the player", async () => {
  const storage = memoryStorage();
  await markOfflineSavePending("player-1", storage);

  assert.equal(await hasOfflineSavePending("player-1", storage), true);
  assert.equal(await hasOfflineSavePending("player-2", storage), false);

  await clearOfflineSavePending("player-1", storage);
  assert.equal(await hasOfflineSavePending("player-1", storage), false);
});

test("an older successful save cannot clear a newer pending marker", async () => {
  const storage = memoryStorage();
  const oldToken = await markOfflineSavePending("player-1", storage);
  const newToken = await markOfflineSavePending("player-1", storage);

  await clearOfflineSavePending("player-1", storage, oldToken);

  assert.notEqual(newToken, oldToken);
  assert.equal(await getOfflineSavePendingToken("player-1", storage), newToken);
});

test("storage failures do not crash gameplay", async () => {
  const unavailableStorage = {
    getItem: async () => { throw new Error("storage disabled"); },
    setItem: async () => { throw new Error("storage disabled"); },
    removeItem: async () => { throw new Error("storage disabled"); },
  };

  await assert.doesNotReject(() => markOfflineSavePending("player-1", unavailableStorage));
  assert.equal(await hasOfflineSavePending("player-1", unavailableStorage), false);
  await assert.doesNotReject(() => clearOfflineSavePending("player-1", unavailableStorage));
});