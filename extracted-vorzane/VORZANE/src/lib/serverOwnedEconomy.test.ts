import assert from "node:assert/strict";
import test from "node:test";
import { createFreshState } from "../game/model";
import {
  hasNonEconomyProgressChanged,
  hasServerOwnedEconomyChanged,
  reconcileServerOwnedEconomy,
} from "./serverOwnedEconomy";

test("server-owned currency, items, pets, and fragments replace client values", () => {
  const server = createFreshState();
  server.serverResetEpoch = "server-epoch";
  server.gold = 500;
  server.gems = 50;
  server.inventory = [{
    id: "server-item",
    name: "Server Item",
    slot: "helmet",
    rarity: "rare",
    bonus: { def: 4 },
    price: 120,
  }];
  server.equipped = { helmet: null };
  server.pets = ["fairy-warden"];
  server.activePet = "fairy-warden";
  server.roaming.fragments = 7;
  server.roaming.fragmentsCollected = 9;
  server.roaming.gemRefillDate = "2026-11-15";
  server.roaming.gemRefillsUsed = 1;

  const client = {
    ...server,
    serverResetEpoch: "forged-epoch",
    gold: 999999,
    gems: 999999,
    inventory: [{ ...server.inventory[0], id: "forged-item" }],
    equipped: { helmet: { ...server.inventory[0], id: "forged-equipped" } },
    pets: ["forged-pet"],
    activePet: "forged-pet",
    roaming: {
      ...server.roaming,
      fragments: 999999,
      fragmentsCollected: 999999,
      gemRefillDate: "2099-01-01",
      gemRefillsUsed: 0,
      eventsCompleted: 4,
    },
    lastSeenAt: server.lastSeenAt + 1000,
  };

  const reconciled = reconcileServerOwnedEconomy(client, server);
  assert.equal(reconciled.serverResetEpoch, "server-epoch");
  assert.equal(reconciled.gold, 500);
  assert.equal(reconciled.gems, 50);
  assert.equal(reconciled.inventory[0].id, "server-item");
  assert.equal(reconciled.equipped.helmet, null);
  assert.deepEqual(reconciled.pets, ["fairy-warden"]);
  assert.equal(reconciled.activePet, "fairy-warden");
  assert.equal(reconciled.roaming.fragments, 7);
  assert.equal(reconciled.roaming.fragmentsCollected, 9);
  assert.equal(reconciled.roaming.gemRefillsUsed, 1);
  assert.equal(reconciled.roaming.eventsCompleted, 4);
  assert.equal(reconciled.lastSeenAt, client.lastSeenAt);
  assert.equal(hasServerOwnedEconomyChanged(client, reconciled), true);
  assert.equal(hasNonEconomyProgressChanged(client, reconciled), false);
});

test("non-economic changes made while a save is in flight remain detectable", () => {
  const first = createFreshState();
  const later = { ...first, lastSeenAt: first.lastSeenAt + 1000 };
  assert.equal(hasNonEconomyProgressChanged(later, first), true);
  assert.equal(hasNonEconomyProgressChanged(first, first), false);
});
