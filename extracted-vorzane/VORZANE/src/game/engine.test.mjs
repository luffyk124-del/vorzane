import assert from "node:assert/strict";
import test from "node:test";
import { addExperience, advanceExpeditions, allocateStatPoint, buyItem, buyPet, equipItem, unequipItem, setPet, canClaimQuest, claimQuest, createBattleSequence, createHeroState, canClaimExplorationAchievement, claimExplorationAchievement, getExplorationAchievementProgress, canClaimExpeditionTask, claimExpeditionTask, ensureMissionPeriods, getRecurringMissions, claimRecurringMission } from "./engine.ts";
import { createFreshState, normalizeGameState } from "./model.ts";

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

test("weapon-category items can be purchased from the store", () => {
  const state = createHeroState("اختبار", "Warrior");
  const result = buyItem(state, "sword1");
  assert.equal(result.error, undefined);
  assert.equal(result.state.gold, 400);
  assert.equal(result.state.inventory[0]?.catalogId, "sword1");
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

test("equipment can be purchased early and only its player-level requirement gates equipping", () => {
  const state = createHeroState("اختبار", "Mage");
  state.gold = 100_000_000;

  const purchased = buyItem(state, "dun-2-mythic-1");
  assert.equal(purchased.error, undefined);
  assert.equal(purchased.state.inventory.length, 1);
  const owned = purchased.state.inventory[0];
  assert.equal(owned.catalogId, "dun-2-mythic-1");

  const earlyEquip = equipItem(purchased.state, owned.id);
  assert.equal(earlyEquip, purchased.state);

  const levelReady = { ...purchased.state, hero: { ...purchased.state.hero, level: 70 } };
  assert.equal(equipItem(levelReady, owned.id).equipped["درع"]?.catalogId, "dun-2-mythic-1", "dungeon floor must not gate equipment");
});

test("unequipping is blocked when the bag is full to prevent item overflow", () => {
  const state = createHeroState("اختبار", "Warrior");
  const purchased = buyItem(state, "sword1");
  assert.equal(purchased.error, undefined);
  const equipped = equipItem(purchased.state, purchased.state.inventory[0].id);
  assert.ok(equipped.equipped["سلاح"]);
  equipped.inventory = Array.from({ length: 500 }, (_, index) => ({
    ...equipped.equipped["سلاح"],
    id: `bag-item-${index}`,
  }));

  const blocked = unequipItem(equipped, "سلاح");
  assert.equal(blocked, equipped, "full bag must leave equipped item untouched");
  assert.equal(blocked.inventory.length, 500);
  assert.ok(blocked.equipped["سلاح"]);
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

test("each level grants exactly one stat point, including multiple levels at once", () => {
  const state = createHeroState("اختبار", "Warrior");
  const oneLevel = addExperience(state, 100);
  assert.equal(oneLevel.levelsGained, 1);
  assert.equal(oneLevel.state.hero.level, 2);
  assert.equal(oneLevel.state.hero.statPoints, 1);

  const multipleLevels = addExperience(state, 100 + 160 + 220);
  assert.equal(multipleLevels.levelsGained, 3);
  assert.equal(multipleLevels.state.hero.level, 4);
  assert.equal(multipleLevels.state.hero.statPoints, 3);
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


test("character appearance choices persist and old saves receive safe defaults", () => {
  const defaults = { gender: "male", appearance: 0, hairstyle: "short", hairColor: "obsidian", face: "classic", outfit: "adventurer", body: "balanced" };
  const fresh = createFreshState();
  assert.deepEqual(fresh.characterStyle, defaults);

  const selectedStyle = { gender: "female", appearance: 3, hairstyle: "braids", hairColor: "silver", face: "noble", outfit: "royal", body: "sturdy" };
  const customized = normalizeGameState({
    ...fresh,
    hero: createHeroState("مغامر", "Mage").hero,
    characterStyle: selectedStyle,
  });
  assert.deepEqual(customized.characterStyle, selectedStyle);

  const legacy = normalizeGameState({ hero: createHeroState("قديم", "Warrior").hero });
  assert.deepEqual(legacy.characterStyle, defaults);
});


test("daily missions reset by date and rewards can only be claimed once", () => {
  const start = Date.UTC(2026, 0, 1, 12);
  let state = ensureMissionPeriods(createHeroState("مهمات", "Mage"), start);
  state.wins = 2;
  const daily = getRecurringMissions(state, "daily", start).find((mission) => mission.id === "daily-wins");
  assert.equal(daily?.available, true);

  const claimed = claimRecurringMission(state, "daily", "daily-wins", start);
  assert.equal(claimed.gold, state.gold + 120);
  assert.equal(claimRecurringMission(claimed, "daily", "daily-wins", start).gold, claimed.gold);

  const nextDay = ensureMissionPeriods(claimed, start + 86_400_000);
  assert.equal(getRecurringMissions(nextDay, "daily", start + 86_400_000).find((mission) => mission.id === "daily-wins")?.progress, 0);
  assert.equal(getRecurringMissions(nextDay, "weekly", start + 86_400_000).find((mission) => mission.id === "weekly-wins")?.progress, 2, "weekly progress must continue across days");
});

test("weekly and seasonal mission progress uses period baselines", () => {
  const start = Date.UTC(2026, 0, 5, 12);
  let state = ensureMissionPeriods(createHeroState("مهمات", "Warrior"), start);
  state.wins = 10;
  state.expeditionsCompleted = 4;
  state.hero.level = 3;
  const weekly = getRecurringMissions(state, "weekly", start);
  assert.equal(weekly.find((mission) => mission.id === "weekly-wins")?.available, true);
  assert.equal(weekly.find((mission) => mission.id === "weekly-expeditions")?.available, true);
  assert.equal(weekly.find((mission) => mission.id === "weekly-levels")?.available, true);

  const nextMonth = ensureMissionPeriods(state, Date.UTC(2026, 1, 1, 12));
  assert.equal(getRecurringMissions(nextMonth, "season", Date.UTC(2026, 1, 1, 12)).find((mission) => mission.id === "season-wins")?.progress, 0);
});
