import assert from "node:assert/strict";
import test from "node:test";
import { createHeroState, getQuestProgress, getStoryChapterProgress } from "./engine.ts";
import { buyRoamingHealthRefill, refreshRoamingHealth, getRoamingEvent, resolveRoamingChoice } from "./roaming.ts";

test("roaming health regenerates one point per minute and respects its maximum", () => {
  const now = Date.UTC(2026, 10, 11, 12, 0, 0);
  const state = createHeroState("اختبار الصحة", "Warrior");
  state.roaming.health = 10;
  state.roaming.healthUpdatedAt = now;

  const afterThree = refreshRoamingHealth(state, now + 3 * 60_000 + 59_000);
  assert.equal(afterThree.roaming.health, 13);
  assert.equal(afterThree.roaming.healthUpdatedAt, now + 3 * 60_000);

  const nearlyFull = { ...afterThree, roaming: { ...afterThree.roaming, health: afterThree.roaming.maxHealth - 1 } };
  const capped = refreshRoamingHealth(nearlyFull, now + 20 * 60_000);
  assert.equal(capped.roaming.health, capped.roaming.maxHealth);
});

test("roaming gem refills cost 20 gems and enforce ten purchases per day", () => {
  const now = Date.UTC(2026, 10, 11, 12, 0, 0);
  let state = createHeroState("اختبار التعبئة", "Warrior");
  state.gems = 250;
  state.roaming.health = 0;
  state.roaming.healthUpdatedAt = now;
  state.roaming.gemRefillDate = new Date(now).toISOString().slice(0, 10);
  state.roaming.gemRefillsUsed = 0;

  for (let index = 0; index < 10; index += 1) {
    const result = buyRoamingHealthRefill(state, now + index);
    assert.equal(result.error, undefined);
    assert.equal(result.restored, 20);
    state = { ...result.state, roaming: { ...result.state.roaming, health: 0 } };
  }

  assert.equal(state.gems, 50);
  assert.equal(state.roaming.gemRefillsUsed, 10);
  const capped = buyRoamingHealthRefill(state, now + 20);
  assert.equal(capped.error, "وصلت إلى الحد اليومي: 10 تعبئات.");
  assert.equal(capped.state.gems, 50);

  const nextDay = buyRoamingHealthRefill(state, now + 86_400_000);
  assert.equal(nextDay.error, undefined);
  assert.equal(nextDay.state.roaming.gemRefillsUsed, 1);
});

test("story and player quests now track Dimas and roaming progression", () => {
  const state = createHeroState("اختبار التقدم", "Warrior");
  state.dimas.highestFloor = 3;
  state.roaming.eventsCompleted = 5;

  assert.equal(getStoryChapterProgress(state, 2), 3);
  assert.equal(getStoryChapterProgress(state, 3), 5);
  assert.equal(getQuestProgress(state, "dimas-entry"), 3);
  assert.equal(getQuestProgress(state, "roaming-path"), 5);
});


test("roaming choices return story and rewards separately", () => {
  const state = createHeroState("اختبار نتيجة التجوال", "Warrior");
  const event = {
    id: "test-footprints",
    title: "أثر أقدام غريب",
    region: "غابة الرماد",
    story: "تظهر آثار أقدام قرب صخرة.",
    kind: "omen",
    choices: [{ id: "follow", label: "تتبع الأثر", hint: "اختبار", outcome: { gold: 50, xp: 25 } }],
  };
  const result = resolveRoamingChoice(state, event, "follow", Date.UTC(2026, 10, 11));
  assert.match(result.message, /تتبع الأثر/);
  assert.match(result.rewards, /ذهب/);
  assert.doesNotMatch(result.message, /ذهب|خبرة/);
});

test("active roaming story chains advance immediately to their next choice", () => {
  const state = createHeroState("اختبار تسلسل الحكاية", "Warrior");
  state.roaming.activeChain = "lost-cartographer";
  state.roaming.chainStage = 0;
  state.roaming.eventsCompleted = 1;
  const event = getRoamingEvent(state, Date.UTC(2026, 10, 11));
  assert.equal(event.kind, "chain");
  assert.equal(event.chainStage, 0);

  const result = resolveRoamingChoice(state, event, "press", Date.UTC(2026, 10, 11));
  assert.equal(result.state.roaming.chainStage, 1);
  assert.match(result.message, /آثار أقدام/);
  const nextEvent = getRoamingEvent(result.state, Date.UTC(2026, 10, 11) + 1);
  assert.equal(nextEvent.kind, "chain");
  assert.equal(nextEvent.chainStage, 1);
});
