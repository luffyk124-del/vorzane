import { CLASS_STATS, createFreshState, type ActiveExpedition, type ClassId, type EquipmentItem, type GameState, type OfflineReport, type StatKey } from "./model";
import { EXPEDITIONS, findExpedition, PETS, QUESTS, SHOP_ITEMS } from "./catalog";
import { createItemInstance, findEquipmentTemplate, getEquipmentSellPrice } from "./dungeonItems";
import { addExperience } from "./stats";

export { addExperience, combatStats, totalStats } from "./stats";
export { createBattleSequence, resolveBattle } from "./battle";
export type { BattleResult, BattleSequence, BattleTurn } from "./battle";
export type { BattleMode } from "./model";

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export function createHeroState(name: string, className: ClassId): GameState {
  const state = createFreshState();
  const stats = { ...CLASS_STATS[className] };
  state.hero = { name: name.trim().slice(0, 24), className, level: 1, exp: 0, statPoints: 0, stats, baseStats: { ...stats } };
  return state;
}

export function allocateStatPoint(state: GameState, key: StatKey): { state: GameState; error?: string } {
  if (!state.hero) return { state, error: "أنشئ شخصية أولًا." };
  if (state.hero.statPoints < 1) return { state, error: "لا توجد نقاط سمات متاحة." };
  if (!Object.hasOwn(state.hero.stats, key)) return { state, error: "هذه السمة غير متاحة." };
  if (state.hero.stats[key] >= 999_999) return { state, error: "بلغت السمة الحد الأقصى." };

  const next = clone(state);
  next.hero!.stats[key] += 1;
  next.hero!.statPoints -= 1;
  return { state: next };
}

export function beginOrQueueExpedition(state: GameState, planId: string, now = Date.now()): { state: GameState; queued: boolean; error?: string } {
  if (!state.hero) return { state, queued: false, error: "أنشئ شخصية قبل الانطلاق." };
  const plan = findExpedition(planId);
  if (!plan) return { state, queued: false, error: "هذه الرحلة غير متاحة." };
  if (state.hero.level < plan.requiredLevel) return { state, queued: false, error: `تتطلب هذه الرحلة المستوى ${plan.requiredLevel}.` };
  if (state.activeExpedition && state.expeditionQueue.length >= 3) return { state, queued: false, error: "صف الرحلات ممتلئ؛ استلم رحلة مكتملة أولًا." };
  const next = clone(state);
  const queueId = `${planId}-${now}-${Math.random().toString(36).slice(2, 7)}`;
  if (!next.activeExpedition) next.activeExpedition = { queueId, planId, startedAt: now, endsAt: now + plan.durationSeconds * 1000 };
  else next.expeditionQueue.push({ queueId, planId, queuedAt: now });
  return { state: next, queued: !!state.activeExpedition };
}

function startQueuedExpedition(queueId: string, planId: string, startedAt: number): ActiveExpedition | null {
  const plan = findExpedition(planId);
  if (!plan) return null;
  return { queueId, planId, startedAt, endsAt: startedAt + plan.durationSeconds * 1000 };
}

export function advanceExpeditions(state: GameState, now = Date.now()): { state: GameState; reports: OfflineReport[] } {
  if (!state.hero || !state.activeExpedition || state.activeExpedition.endsAt > now) return { state, reports: [] };
  const next = clone(state);
  const reports: OfflineReport[] = [];
  let successfulCompletions = 0;
  let loops = 0;
  while (next.activeExpedition && next.activeExpedition.endsAt <= now && loops < 20) {
    loops += 1;
    const completed = next.activeExpedition;
    const plan = findExpedition(completed.planId);
    if (plan && next.hero && next.hero.level >= plan.requiredLevel) {
      next.gold = Math.min(1_000_000_000, next.gold + plan.rewardGold);
      const leveled = addExperience(next, plan.rewardXP);
      Object.assign(next, leveled.state);
      reports.push({ id: `${completed.queueId}-reward`, planId: completed.planId, completedAt: completed.endsAt, gold: plan.rewardGold, xp: plan.rewardXP });
      successfulCompletions += 1;
    } else if (plan) {
      reports.push({ id: `${completed.queueId}-locked`, planId: completed.planId, completedAt: completed.endsAt, gold: 0, xp: 0, failure: `لم تُصرف المكافأة؛ تتطلب الرحلة المستوى ${plan.requiredLevel}.` });
    }
    next.activeExpedition = null;
    while (next.expeditionQueue.length && !next.activeExpedition) {
      const queued = next.expeditionQueue.shift()!;
      const queuedPlan = findExpedition(queued.planId);
      if (!queuedPlan) continue;
      if (!next.hero || next.hero.level < queuedPlan.requiredLevel) {
        reports.push({ id: `${queued.queueId}-locked`, planId: queued.planId, completedAt: completed.endsAt, gold: 0, xp: 0, failure: `أُزيلت من الصف؛ تتطلب الرحلة المستوى ${queuedPlan.requiredLevel}.` });
        continue;
      }
      next.activeExpedition = startQueuedExpedition(queued.queueId, queued.planId, completed.endsAt);
    }
  }
  next.lastSeenAt = now;
  if (reports.length) {
    next.offlineSummary = [...next.offlineSummary, ...reports].slice(-5);
  }
  next.expeditionsCompleted = Math.min(1_000_000_000, next.expeditionsCompleted + successfulCompletions);
  return { state: next, reports };
}

export function dismissOfflineReport(state: GameState, id: string): GameState {
  return { ...state, offlineSummary: state.offlineSummary.filter((item) => item.id !== id) };
}

export function getQuestProgress(state: GameState, questId: string): number {
  const quest = QUESTS.find((item) => item.id === questId);
  if (!quest) return 0;
  switch (quest.metric) {
    case "wins": return state.wins;
    case "level": return state.hero?.level ?? 1;
    case "caveWins": return state.battleWinsByMode.cave;
    case "dungeonWins": return state.battleWinsByMode.dungeon;
    case "towerWins": return state.battleWinsByMode.tower;
    case "hardWins": return state.battleWinsByMode.hard;
    case "expeditions": return state.expeditionsCompleted;
    case "equipped": return Object.values(state.equipped).filter(Boolean).length;
    default: return 0;
  }
}

export function canClaimQuest(state: GameState, questId: string): boolean {
  if (state.claimedQuestRewards[questId]) return false;
  const quest = QUESTS.find((item) => item.id === questId);
  return !!quest && getQuestProgress(state, questId) >= quest.target;
}

export function claimQuest(state: GameState, questId: string): GameState {
  if (!canClaimQuest(state, questId)) return state;
  const quest = QUESTS.find((item) => item.id === questId);
  if (!quest) return state;
  return {
    ...state,
    gold: Math.min(1_000_000_000, state.gold + quest.rewardGold),
    quests: { ...state.quests, [questId]: true },
    claimedQuestRewards: { ...state.claimedQuestRewards, [questId]: true },
  };
}

export function buyItem(state: GameState, itemId: string): { state: GameState; error?: string } {
  const item = SHOP_ITEMS.find((candidate) => candidate.id === itemId);
  if (!item) return { state, error: "هذا العنصر غير متاح للشراء؛ عتاد الزنزانة يُكتسب من القتال فقط." };
  if (!state.hero) return { state, error: "أنشئ شخصية أولًا." };
  if (state.hero.level < (item.requiredLevel ?? 1)) return { state, error: `يتطلب هذا العتاد المستوى ${item.requiredLevel ?? 1}.` };
  if (state.gold < item.price) return { state, error: "الذهب غير كافٍ." };
  return { state: { ...state, gold: state.gold - item.price, inventory: [...state.inventory, createItemInstance(item)] } };
}

export function equipItem(state: GameState, itemId: string): GameState {
  const item = state.inventory.find((candidate) => candidate.id === itemId);
  if (!item || !state.hero) return state;
  const template = findEquipmentTemplate(item);
  if (!template) return state;
  if ((state.hero?.level ?? 1) < (template.requiredLevel ?? item.requiredLevel ?? 1)) return state;
  if (state.dungeonFloor < (template.requiredDungeonFloor ?? item.requiredDungeonFloor ?? 1)) return state;
  const canonicalItem = { ...template, id: item.id, catalogId: template.id, bonus: { ...template.bonus } };
  const nextInventory = state.inventory.filter((candidate) => candidate.id !== itemId);
  const old = state.equipped[canonicalItem.slot];
  if (old) nextInventory.push(old);
  return { ...state, inventory: nextInventory, equipped: { ...state.equipped, [canonicalItem.slot]: canonicalItem } };
}

export function unequipItem(state: GameState, slot: string): GameState {
  const item = state.equipped[slot];
  if (!item) return state;
  const equipped = { ...state.equipped };
  delete equipped[slot];
  return { ...state, equipped, inventory: [...state.inventory, item] };
}

export function sellItem(state: GameState, itemId: string): { state: GameState; soldPrice?: number; error?: string } {
  const bagItems = state.inventory.filter((item) => item.id === itemId);
  const equippedEntries = Object.entries(state.equipped).filter(([, item]) => item?.id === itemId);
  if (bagItems.length + equippedEntries.length > 1) return { state, error: "تعذر التحقق من نسخة القطعة؛ لم يتم البيع." };
  const item = bagItems[0] ?? equippedEntries[0]?.[1] ?? undefined;
  if (!item) return { state, error: "هذه القطعة لم تعد ضمن ممتلكاتك." };
  const soldPrice = getEquipmentSellPrice(item);
  if (soldPrice === null) return { state, error: "تعذر التحقق من سعر هذه القطعة؛ لم يتم بيعها." };
  const next = clone(state);
  next.inventory = next.inventory.filter((candidate) => candidate.id !== itemId);
  for (const [slot, equippedItem] of Object.entries(next.equipped)) {
    if (equippedItem?.id === itemId) delete next.equipped[slot];
  }
  next.gold = Math.min(1_000_000_000, next.gold + soldPrice);
  return { state: next, soldPrice };
}

export function buyPet(state: GameState, petId: string): { state: GameState; error?: string } {
  const pet = PETS.find((item) => item.id === petId);
  if (!pet) return { state, error: "الرفيق غير متاح." };
  if (!state.hero) return { state, error: "أنشئ شخصية أولًا." };
  if (state.pets.includes(petId)) return { state, error: "هذا الرفيق لديك بالفعل." };
  if (state.hero.level < pet.requiredLevel) return { state, error: `يتطلب هذا الرفيق المستوى ${pet.requiredLevel}.` };
  if (state.gold < pet.price) return { state, error: "الذهب غير كافٍ." };
  return { state: { ...state, gold: state.gold - pet.price, pets: [...state.pets, petId], activePet: state.activePet ?? petId } };
}

export function setPet(state: GameState, petId: string | null): GameState {
  if (!petId) return { ...state, activePet: null };
  const pet = PETS.find((item) => item.id === petId);
  if (!state.hero || !pet || !state.pets.includes(petId) || state.hero.level < pet.requiredLevel) return state;
  return { ...state, activePet: petId };
}
