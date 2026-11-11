import assert from "node:assert/strict";
import test from "node:test";
import { createHeroState } from "./engine.ts";
import { createFreshState, normalizeGameState } from "./model.ts";
import { clearDimasFloor, getDimasFloor, getDimasFloors } from "./dimas.ts";
import { LONG_QUESTS, claimLongQuest, getLongQuestProgress } from "./longQuests.ts";
import { getRoamingEvent, resolveRoamingChoice, ROAMING_EVENT_COUNT } from "./roaming.ts";

test("roaming library contains more than two hundred events", () => {
  assert.equal(ROAMING_EVENT_COUNT, 228);
});

test("roaming story chains preserve a branch and reveal the first sequel stage", () => {
  const state = createHeroState("رحّالة", "Warrior");
  const opening = {
    id: "test-opening",
    title: "مسافر ضائع",
    region: "غابة الرماد",
    story: "يطلب منك مسافر المساعدة.",
    kind: "traveler",
    choices: [{
      id: "help",
      label: "ساعده",
      hint: "تبدأ الحكاية.",
      outcome: { chain: "lost-cartographer", gold: 10, xp: 10 },
    }],
  };
  const started = resolveRoamingChoice(state, opening, "help");
  assert.equal(started.state.roaming.activeChain, "lost-cartographer");
  assert.equal(started.state.roaming.chainStage, 0);
  assert.equal(started.state.roaming.chainRoute, "cautious");

  started.state.roaming.eventsCompleted = 5;
  started.state.roaming.chainCooldown = 0;
  const sequel = getRoamingEvent(started.state, 3_005);
  assert.equal(sequel.kind, "chain");
  assert.equal(sequel.title, "الملاح الضائع");
  assert.match(sequel.story, /تفاصيل لم تكن ظاهرة من الطريق الرئيسي/);

  const boldChoice = resolveRoamingChoice(started.state, sequel, "press");
  assert.equal(boldChoice.state.roaming.chainStage, 1);
  assert.equal(boldChoice.state.roaming.chainRoute, "bold");
});

test("Dimas has 300 independent floors, starts at 150 power, and gates milestones", () => {
  const floors = getDimasFloors();
  assert.equal(floors.length, 300);
  assert.equal(getDimasFloor(1).requiredPower, 150);
  assert.ok(getDimasFloor(2).requiredPower > getDimasFloor(1).requiredPower);
  assert.equal(getDimasFloor(50).reward?.kind, "weapon");
  assert.equal(getDimasFloor(75).reward?.kind, "companion");
  assert.equal(getDimasFloor(300).reward?.kind, "companion");

  const state = createHeroState("بطل الديماس", "Warrior");
  const blocked = clearDimasFloor(state, 1);
  assert.match(blocked.error ?? "", /قوة 150/);
  assert.equal(blocked.state.dimas.highestFloor, 0);
  assert.equal(blocked.state.tower, state.tower, "Dimas progress must not advance the legacy combat tower");
});

test("long quests progress across five tiers and pay their reward only once", () => {
  const state = createHeroState("صائد الجوائز", "Warrior");
  assert.equal(LONG_QUESTS.length, 36);
  assert.equal(new Set(LONG_QUESTS.map((quest) => quest.tier)).size, 5);
  state.wins = 3;
  const quest = LONG_QUESTS.find((item) => item.id === "long-3");
  assert.ok(quest);
  assert.equal(getLongQuestProgress(state, quest), 3);
  const claimed = claimLongQuest(state, quest.id);
  assert.equal(claimed.error, undefined);
  assert.equal(claimed.state.claimedLongQuestIds.includes(quest.id), true);
  assert.equal(claimLongQuest(claimed.state, quest.id).error, "استلمت مكافأة هذه المهمة سابقًا.");
});

test("legacy saves receive safe defaults for new roaming branch state", () => {
  const legacy = createFreshState();
  delete legacy.roaming.chainRoute;
  const normalized = normalizeGameState(legacy);
  assert.equal(normalized?.roaming.chainRoute, null);
});
