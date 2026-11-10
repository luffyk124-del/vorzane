import type { EquipmentItem, GameState } from "./model.ts";
import { addExperience, combatStats } from "./stats.ts";

export type DimasFloor = {
  floor: number;
  name: string;
  title: string;
  requiredPower: number;
  gold: number;
  xp: number;
  milestone: boolean;
  reward?: { kind: "weapon" | "companion" | "gems" | "fragments"; name: string; amount?: number };
};

const MILESTONES: Record<number, DimasFloor["reward"]> = {
  10: { kind: "gems", name: "جواهر الديماس", amount: 10 },
  25: { kind: "fragments", name: "قطع أثرية", amount: 12 },
  50: { kind: "weapon", name: "نصل حارس الديماس" },
  75: { kind: "companion", name: "بومة الحكمة" },
  100: { kind: "weapon", name: "رمح العرش المكسور" },
  125: { kind: "gems", name: "جواهر الديماس", amount: 35 },
  150: { kind: "companion", name: "أيل القمر" },
  175: { kind: "fragments", name: "قطع أثرية", amount: 60 },
  200: { kind: "weapon", name: "سيف الشفق الأبدي" },
  225: { kind: "companion", name: "تنين الشهب" },
  250: { kind: "weapon", name: "قاطع النجوم الأسطوري" },
  275: { kind: "gems", name: "جواهر الديماس", amount: 100 },
  300: { kind: "companion", name: "تنين العرش الأزلي" },
};

const FLOOR_NAMES = ["دهليز الحراس", "قاعة المرايا", "سلالم الرماد", "ممرّ العروش", "قبو النيازك", "معبد الصمت", "جسر العمالقة", "مكتبة الظلال", "ساحة الأختام", "قلب الديماس"];

export function getDimasFloor(floor: number): DimasFloor {
  const safe = Math.max(1, Math.min(300, Math.floor(floor)));
  const milestoneReward = MILESTONES[safe];
  const boss = safe % 10 === 0;
  return {
    floor: safe,
    name: FLOOR_NAMES[(safe - 1) % FLOOR_NAMES.length],
    title: boss ? `حارس الطابق ${safe}` : `اختبار الطابق ${safe}`,
    requiredPower: Math.round(38 + safe * 8.5 + Math.pow(safe, 1.18) * 1.4),
    gold: 70 + safe * 48 + Math.floor(safe * safe * 0.35),
    xp: 45 + safe * 34 + Math.floor(safe * safe * 0.22),
    milestone: !!milestoneReward,
    ...(milestoneReward ? { reward: milestoneReward } : {}),
  };
}

export function getDimasFloors(): DimasFloor[] {
  return Array.from({ length: 300 }, (_, index) => getDimasFloor(index + 1));
}

function rareWeapon(floor: number, rewardName: string): EquipmentItem {
  const legendary = floor >= 150;
  return {
    id: `dimas-weapon-${floor}`,
    catalogId: `dimas-weapon-${floor}`,
    name: rewardName,
    slot: "سلاح",
    rarity: legendary ? "mythic" : "legendary",
    bonus: { str: 12 + floor * 1.4, agi: 6 + floor * 0.55, luck: Math.floor(floor / 8) },
    price: floor * 1800,
    requiredLevel: Math.min(999, Math.max(1, Math.floor(floor / 2))),
    requiredDungeonFloor: floor,
    icon: "sword",
  };
}

export function clearDimasFloor(state: GameState, floor: number): { state: GameState; error?: string; reward?: DimasFloor } {
  if (!state.hero) return { state, error: "أنشئ شخصيتك أولًا." };
  const nextFloor = state.dimas.highestFloor + 1;
  if (floor !== nextFloor || floor < 1 || floor > 300) return { state, error: `الطابق التالي المتاح هو ${nextFloor}.` };
  const reward = getDimasFloor(floor);
  const power = combatStats(state).power;
  if (power < reward.requiredPower) return { state, error: `تحتاج إلى قوة ${reward.requiredPower} على الأقل. قوتك الحالية ${power}.` };

  const next = JSON.parse(JSON.stringify(state)) as GameState;
  next.dimas.highestFloor = floor;
  next.dimas.lastCompletedAt = Date.now();
  next.tower = Math.max(next.tower, floor);
  next.gold += reward.gold;
  const trained = addExperience(next, reward.xp);
  Object.assign(next, trained.state);

  if (reward.reward) {
    if (reward.reward.kind === "gems") next.gems += reward.reward.amount ?? 0;
    if (reward.reward.kind === "fragments") next.roaming.fragments += reward.reward.amount ?? 0;
    if (reward.reward.kind === "weapon") {
      const item = rareWeapon(floor, reward.reward.name);
      next.inventory.unshift(item);
      next.inventory = next.inventory.slice(0, 500);
    }
    if (reward.reward.kind === "companion") {
      const petId = floor === 75 ? "owl" : floor === 150 ? "moon-deer" : floor === 225 ? "star-drake" : "dimas-royal-drake";
      if (!next.pets.includes(petId)) next.pets.push(petId);
    }
    next.dimas.claimedMilestones = [...new Set([...next.dimas.claimedMilestones, floor])];
  }
  return { state: next, reward };
}
