import assert from "node:assert/strict";
import test from "node:test";
import { advanceExpeditions, allocateStatPoint, buyItem, canClaimQuest, claimQuest, createBattleSequence, createHeroState } from "./engine.ts";
import { SHOP_ITEMS } from "./catalog.ts";
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

test("level-up stat points can be spent exactly once per point", () => {
  const state = createHeroState("اختبار", "Warrior");
  state.hero.statPoints = 2;

  const first = allocateStatPoint(state, "str");
  const second = allocateStatPoint(first.state, "str");
  const exhausted = allocateStatPoint(second.state, "str");

  assert.equal(first.state.hero.stats.str, state.hero.stats.str + 1);
  assert.equal(first.state.hero.statPoints, 1);
  assert.equal(second.state.hero.stats.str, state.hero.stats.str + 2);
  assert.equal(second.state.hero.statPoints, 0);
  assert.ok(exhausted.error);
  assert.equal(exhausted.state.hero.statPoints, 0);
});

test("stat allocation requires a hero and respects the stat ceiling", () => {
  const fresh = createFreshState();
  const hero = createHeroState("اختبار", "Warrior");
  hero.hero.statPoints = 1;
  hero.hero.stats.str = 999_999;

  assert.ok(allocateStatPoint(fresh, "str").error);
  assert.ok(allocateStatPoint(hero, "str").error);
  assert.equal(hero.hero.statPoints, 1);
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

test("expanded shop retains 7 starter items and adds 192 items", () => {
  const state = createHeroState("اختبار", "Warrior");
  assert.equal(SHOP_ITEMS.length, 199);
  assert.ok(SHOP_ITEMS.every((item) => ["common", "uncommon", "rare", "epic"].includes(item.rarity)));
  const item = SHOP_ITEMS[0];
  const bought = buyItem(state, item.id);
  assert.equal(bought.error, undefined);
  assert.equal(bought.state.gold, state.gold - item.price);
  assert.equal(bought.state.inventory.length, 1);
  assert.equal(bought.state.inventory[0].catalogId, item.id);
});

test("shop refuses legendary and mythic dungeon-only equipment", () => {
  const state = createHeroState("اختبار", "Warrior");
  const legendary = buyItem(state, "dun-1-legendary-1");
  const mythic = buyItem(state, "dun-1-mythic-1");
  assert.ok(legendary.error);
  assert.ok(mythic.error);
  assert.equal(state.gold, 500);
  assert.equal(state.inventory.length, 0);
});


test("shop rejects purchases when the player cannot afford the item", () => {
  const state = createHeroState("اختبار", "Warrior");
  state.gold = 0;
  const before = structuredClone(state);
  const result = buyItem(state, "sword1");
  assert.ok(result.error);
  assert.deepEqual(result.state, before);
});

test("shop enforces the item's required hero level", () => {
  const state = createHeroState("اختبار", "Warrior");
  const rareItem = SHOP_ITEMS.find((item) => item.rarity === "rare");
  assert.ok(rareItem);
  assert.ok((rareItem.requiredLevel ?? 1) > state.hero.level);
  const result = buyItem(state, rareItem.id);
  assert.ok(result.error);
  assert.equal(result.state.gold, state.gold);
  assert.equal(result.state.inventory.length, 0);
});
