import assert from "node:assert/strict";
import test from "node:test";
import { advanceExpeditions, allocateStatPoint, buyItem, buyPet, equipItem, setPet, canClaimQuest, claimQuest, createBattleSequence, createHeroState, canClaimExplorationAchievement, claimExplorationAchievement, getExplorationAchievementProgress, canClaimExpeditionTask, claimExpeditionTask } from "./engine.ts";
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

test("weapon-category items are not purchasable from the store", () => {
  const state = createHeroState("اختبار", "Warrior");
  const result = buyItem(state, "sword1");
  assert.ok(result.error);
  assert.equal(result.state, state);
  assert.equal(state.gold, 500);
  assert.equal(state.inventory.length, 0);
});

test("players can buy high-level armor early but cannot equip it before its level", () => {
  const state = createHeroState("اختبار", "Mage");
  state.gold = 1_000_000;

  const purchased = buyItem(state, "armor30");
  assert.equal(purchased.error, undefined);
  assert.equal(purchased.state.gold, 680_000);
  assert.equal(purchased.state.inventory.length, 1);
  const ownedItem = purchased.state.inventory[0];
  assert.equal(ownedItem.catalogId, "armor30");

  const blocked = equipItem(purchased.state, ownedItem.id);
  assert.equal(blocked, purchased.state, "level requirement must block equipping");
  assert.equal(blocked.equipped["درع"], undefined);

  const eligible = { ...purchased.state, hero: { ...purchased.state.hero, level: 30 } };
  const equipped = equipItem(eligible, ownedItem.id);
  assert.equal(equipped.equipped["درع"]?.catalogId, "armor30");
  assert.equal(equipped.inventory.length, 0);
});

test("non-weapon dungeon equipment can be purchased early but remains level and floor gated", () => {
  const state = createHeroState("اختبار", "Mage");
  state.gold = 10_000;

  const purchased = buyItem(state, "dun-2-mythic-1");
  assert.equal(purchased.error, undefined);
  assert.equal(purchased.state.inventory.length, 1);
  const owned = purchased.state.inventory[0];
  assert.equal(owned.catalogId, "dun-2-mythic-1");

  const earlyEquip = equipItem(purchased.state, owned.id);
  assert.equal(earlyEquip, purchased.state);

  const levelReady = { ...purchased.state, hero: { ...purchased.state.hero, level: 35 } };
  assert.equal(equipItem(levelReady, owned.id), levelReady, "dungeon floor requirement must still apply");

  const floorReady = { ...levelReady, dungeonFloor: 40 };
  assert.equal(equipItem(floorReady, owned.id).equipped["درع"]?.catalogId, "dun-2-mythic-1");
});

test("players can buy high-level companions early but cannot activate them early", () => {
  const state = createHeroState("اختبار", "Warrior");
  state.gold = 500_000;

  const purchased = buyPet(state, "star-drake");
  assert.equal(purchased.error, undefined);
  assert.equal(purchased.state.gold, 50_000);
  assert.ok(purchased.state.pets.includes("star-drake"));
  assert.equal(purchased.state.activePet, null);

  const blocked = setPet(purchased.state, "star-drake");
  assert.equal(blocked.activePet, null);

  const eligible = { ...purchased.state, hero: { ...purchased.state.hero, level: 45 } };
  assert.equal(setPet(eligible, "star-drake").activePet, "star-drake");
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
  const battle = createBattleSequence(state, "dungeon", () => 0.01);

  assert.ok(battle);
  assert.equal(battle.result.won, true);
  assert.equal(state.dungeonFloor, 1);
  assert.equal(state.inventory.length, 0);
  assert.equal(battle.result.state.dungeonFloor, 2);
  assert.equal(battle.result.state.inventory.length, 1);
  assert.ok(battle.result.gold > 0);
  assert.ok(battle.result.xp > 0);
});

test("dungeon victories can yield no item when the random drop roll fails", () => {
  const state = createHeroState("اختبار", "Warrior");
  const battle = createBattleSequence(state, "dungeon", () => 0.99);

  assert.ok(battle);
  assert.equal(battle.result.won, true);
  assert.equal(battle.result.dropped, null);
  assert.equal(battle.result.state.inventory.length, 0);
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

test("exploration achievements unlock from non-combat progress and pay once", () => {
  const state = createHeroState("اختبار", "Mage");
  state.expeditionsCompleted = 1;

  assert.equal(getExplorationAchievementProgress(state, "explorer_first"), 1);
  assert.equal(canClaimExplorationAchievement(state, "explorer_first"), true);
  assert.equal(canClaimExplorationAchievement(state, "explorer_five"), false);

  const claimed = claimExplorationAchievement(state, "explorer_first");
  assert.equal(claimed.gold, state.gold + 75);
  assert.equal(claimed.achievements.explorer_first, true);
  assert.equal(claimExplorationAchievement(claimed, "explorer_first").gold, claimed.gold);
  assert.equal(state.gold, 500, "claiming must not mutate the original save");
});

test("exploration achievements enforce level and expedition thresholds", () => {
  const state = createHeroState("اختبار", "Mage");
  state.expeditionsCompleted = 19;
  state.hero.level = 4;

  assert.equal(canClaimExplorationAchievement(state, "explorer_twenty"), false);
  assert.equal(canClaimExplorationAchievement(state, "level_five"), false);

  state.expeditionsCompleted = 20;
  state.hero.level = 5;
  assert.equal(canClaimExplorationAchievement(state, "explorer_twenty"), true);
  assert.equal(canClaimExplorationAchievement(state, "level_five"), true);
});


test("expedition tasks require their threshold and grant a one-time reward", () => {
  const state = createHeroState("اختبار", "Mage");
  state.expeditionsCompleted = 2;
  assert.equal(canClaimExpeditionTask(state, "expedition_task_one"), true);
  assert.equal(canClaimExpeditionTask(state, "expedition_task_three"), false);

  const claimed = claimExpeditionTask(state, "expedition_task_one");
  assert.equal(claimed.gold, state.gold + 50);
  assert.equal(claimed.quests.expedition_task_one, true);
  assert.equal(claimExpeditionTask(claimed, "expedition_task_one").gold, claimed.gold);
  assert.equal(state.gold, 500);
});
