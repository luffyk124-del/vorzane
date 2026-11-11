import type { EquipmentItem, GameState } from "./model.ts";
import { addExperience, combatStats } from "./stats.ts";
import { createItemInstance, getDungeonDrop } from "./dungeonItems.ts";

export type DimasFloor = {
  floor: number; name: string; title: string; requiredPower: number; gold: number; xp: number;
  milestone: boolean;
  reward?: { kind: "weapon" | "companion" | "gems"; name: string; amount?: number };
};

const MILESTONES: Record<number, DimasFloor["reward"]> = {
  10: { kind: "gems", name: "جواهر الديماس", amount: 10 },
  25: { kind: "weapon", name: "درع ختم الديماس" },
  50: { kind: "weapon", name: "نصل حارس الديماس" },
  75: { kind: "companion", name: "بومة الحكمة" },
  100: { kind: "weapon", name: "رمح العرش المكسور" },
  125: { kind: "gems", name: "جواهر الديماس", amount: 35 },
  150: { kind: "companion", name: "أيل القمر" },
  175: { kind: "weapon", name: "قلادة أصداء الديماس" },
  200: { kind: "weapon", name: "سيف الشفق الأبدي" },
  225: { kind: "companion", name: "تنين الشهب" },
  250: { kind: "weapon", name: "قاطع النجوم الأسطوري" },
  275: { kind: "gems", name: "جواهر الديماس", amount: 100 },
  300: { kind: "companion", name: "تنين العرش الأزلي" },
};
const FLOOR_NAMES = ["دهليز الحراس", "قاعة المرايا", "سلالم الرماد", "ممرّ العروش", "قبو النيازك", "معبد الصمت", "جسر العمالقة", "مكتبة الظلال", "ساحة الأختام", "قلب الديماس"];

export function getDimasFloor(floor: number, level = 1): DimasFloor {
  const safe = Math.max(1, Math.min(300, Math.floor(floor)));
  const milestoneReward = MILESTONES[safe];
  const levelFactor = 1 + Math.log2(Math.max(1, level)) * 0.11;
  const boss = safe % 10 === 0;
  return {
    floor: safe, name: FLOOR_NAMES[(safe - 1) % FLOOR_NAMES.length],
    title: boss ? `حارس الطابق ${safe}` : `اختبار الطابق ${safe}`,
    requiredPower: Math.round(150 + (safe - 1) * 24 + (Math.pow(safe, 1.25) - 1) * 2.2),
    gold: Math.round((350 + safe * 130 + Math.floor(safe * safe * 1.8)) * levelFactor),
    xp: Math.round((220 + safe * 95 + Math.floor(safe * safe * 1.1)) * levelFactor),
    milestone: !!milestoneReward, ...(milestoneReward ? { reward: milestoneReward } : {}),
  };
}
export function getDimasFloors(level = 1): DimasFloor[] {
  return Array.from({ length: 300 }, (_, index) => getDimasFloor(index + 1, level));
}

function rareWeapon(floor: number, rewardName: string, level: number): EquipmentItem {
  // Use a real catalogue template so the reward is immediately equippable and sellable.
  const template = getDungeonDrop(floor, level, () => 0.999999);
  const item = createItemInstance(template, `dimas-milestone-${floor}`);
  return { ...item, name: rewardName, bonus: { ...item.bonus } };
}

export function clearDimasFloor(state: GameState, floor: number): { state: GameState; error?: string; reward?: DimasFloor; loot?: EquipmentItem } {
  if (!state.hero) return { state, error: "أنشئ شخصيتك أولًا." };
  const nextFloor = state.dimas.highestFloor + 1;
  if (floor !== nextFloor || floor < 1 || floor > 300) return { state, error: `الطابق التالي المتاح هو ${nextFloor}.` };
  const reward = getDimasFloor(floor, state.hero.level);
  const power = combatStats(state).power;
  if (power < reward.requiredPower) return { state, error: `تحتاج إلى قوة ${reward.requiredPower} على الأقل. قوتك الحالية ${power}.` };

  const next = JSON.parse(JSON.stringify(state)) as GameState;
  next.dimas.highestFloor = floor;
  next.dimas.lastCompletedAt = Date.now();
  next.gold = Math.min(1_000_000_000, next.gold + reward.gold);
  const trained = addExperience(next, reward.xp);
  Object.assign(next, trained.state);

  if (reward.reward) {
    if (reward.reward.kind === "gems") next.gems += reward.reward.amount ?? 0;
    if (reward.reward.kind === "weapon") {
      const item = rareWeapon(floor, reward.reward.name, next.hero?.level ?? 1);
      if (next.inventory.length < 500) next.inventory.unshift(item);
    }
    if (reward.reward.kind === "companion") {
      const petId = floor === 75 ? "owl" : floor === 150 ? "moon-deer" : floor === 225 ? "star-drake" : "dimas-royal-drake";
      if (!next.pets.includes(petId)) next.pets.push(petId);
    }
    next.dimas.claimedMilestones = [...new Set([...next.dimas.claimedMilestones, floor])];
  }

  // Ordinary floor victories can also drop real catalogue equipment, not a separate currency/item.
  const heroLevel = next.hero?.level ?? 1;
  const luck = next.hero?.stats.luck ?? 0;
  const dropChance = Math.min(0.32, 0.07 + Math.log2(heroLevel + 1) * 0.025 + Math.min(0.08, luck * 0.001) + Math.min(0.05, floor / 600));
  let loot: EquipmentItem | undefined;
  if (next.inventory.length < 500 && Math.random() < dropChance) {
    loot = createItemInstance(getDungeonDrop(floor, heroLevel), `dimas-${floor}-${Date.now()}`);
    next.inventory.unshift(loot);
  }
  return { state: next, reward, ...(loot ? { loot } : {}) };
}
