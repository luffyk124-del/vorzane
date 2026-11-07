import assert from "node:assert/strict";
import test from "node:test";
import { advanceExpeditions, buyItem, canClaimQuest, claimQuest, createBattleSequence, createHeroState } from "./engine.ts";
import { createFreshState } from "./model.ts";

test("quest rewards are one-time and require completed progress", () => {
  const state = createHeroState("اختبار", "Warrior");
  assert.equal(canClaimQuest(state, "first"), false);

  const ready = { ...state, wins: 1 };
  assert.equal(canClaimQuest(ready, "first"), true);
  const claimed = claimQuest(ready, "first");
  assert.equal(claimed.gold, ready.gold + 100);
  assert.equal(claimQuest(claimed, "first").gold, claimed.gold);
});

test("shop rejects unknown items without changing the save", () => {
  const state = createHeroState("اختبار", "Warrior");
  const result = buyItem(state, "client-invented-item");

  assert.ok(result.error);
  assert.equal(result.state, state);
  assert.equal(state.gold, 500);
  assert.equal(state.inventory.length, 0);
});

test("winning a dungeon battle advances the floor and grants catalog loot", () => {
  const state = createHeroState("اختبار", "Warrior");
  const battle = createBattleSequence(state, "dungeon", () => 0.99);

  assert.ok(battle);
  assert.equal(battle.result.won, true);
  assert.equal(state.dungeonFloor, 1);
  assert.equal(state.inventory.length, 0);
  assert.equal(battle.result.state.dungeonFloor, 2);
  assert.equal(battle.result.state.inventory.length, 1);
  assert.ok(battle.result.gold > 0);
  assert.ok(battle.result.xp > 0);
});

test("completed expedition pays its reward once and clears the active slot", () => {
  const state = createFreshState();
  state.hero = createHeroState("اختبار", "Warrior").hero;
  state.activeExpedition = { queueId: "expedition-1", planId: "ashen-pass", startedAt: 0, endsAt: 600_000 };

  const completed = advanceExpeditions(state, 600_001);

  assert.equal(completed.reports.length, 1);
  assert.equal(completed.reports[0].gold, 40);
  assert.equal(completed.state.gold, state.gold + 40);
  assert.equal(completed.state.expeditionsCompleted, 1);
  assert.equal(completed.state.activeExpedition, null);
  assert.equal(advanceExpeditions(completed.state, 600_002).reports.length, 0);
});