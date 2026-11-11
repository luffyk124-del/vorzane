import type { EquipmentItem, GameState } from "./model.ts";
import { addExperience, combatStats } from "./stats.ts";
import { createItemInstance, getDungeonDrop } from "./dungeonItems.ts";

export type DimasFloor = {
  floor: number; name: string; title: string; requiredPower: number; gold: number; xp: number;
  milestone: boolean;
  reward?: { kind: "weapon" | "companion" | "gems"; name: string; amount?: number };
};
export type DimasChoice = { id: string; label: string; hint: string; gold?: number; xp?: number; damage?: number; heal?: number; gear?: boolean; };
export type DimasEvent = {
  id: string; kind: "encounter" | "cache" | "traveler" | "merchant" | "omen";
  title: string; region: string; story: string; choices: DimasChoice[];
};
export type DimasMerchantItem = { id: string; name: string; description: string; price: number; kind: "gear" | "tonic" | "gold"; };

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

const EVENT_BANK: Omit<DimasEvent, "id">[] = [
  { kind: "encounter", title: "دورية الحراس المنشقّة", region: "ممرّ الحراس", story: "تسمع وقع دروع قبل أن يظهر ثلاثة حراس بزيّ الديماس القديم. قائدهم يرفع يده ويقول إنهم لم يعودوا يحمون البرج؛ إنهم يبحثون عن شخص سرق ختم القيادة. يلاحظ أحدهم شعارك ويتقدم بحذر. يمكنك مواجهتهم، أو إثبات أنك لست هدفهم، أو استغلال انشغالهم والمرور.", choices: [
    { id: "duel", label: "اقبل مبارزة القائد", hint: "مخاطرة مرتفعة ومكافأة أكبر.", gold: 150, xp: 125, damage: 16, gear: true },
    { id: "explain", label: "اعرض مساعدتهم في البحث", hint: "اختبار ثقة قد يفتح لك طريقًا آمنًا.", gold: 90, xp: 160 },
    { id: "sneak", label: "تجاوزهم عبر الممر الجانبي", hint: "تستخدم الحذر بدل المواجهة.", xp: 95 },
  ]},
  { kind: "cache", title: "خزانة المهندس الأخيرة", region: "ورشة الطابق", story: "تجد ورشة مهجورة وأدوات مبعثرة فوق طاولة حجرية. في الخزانة ثلاث آليات: واحدة تصدر طقطقة منتظمة، والثانية مغطاة برموز صيانة، والثالثة موصولة بسلك يمتد إلى باب ثقيل. يبدو أن المهندس ترك وراءه مخزونًا لم يصل إليه أحد.", choices: [
    { id: "decode", label: "فك رموز الصيانة", hint: "وقت أطول لكن احتمال الحصول على عتاد أفضل.", xp: 150, gear: true },
    { id: "force", label: "افتح الخزانة بالقوة", hint: "ذهب سريع مع احتمال إصابة.", gold: 190, xp: 70, damage: 12 },
    { id: "mechanism", label: "جرّب الآلية الهادئة", hint: "خيار متوازن وآمن نسبيًا.", gold: 105, xp: 95 },
  ]},
  { kind: "traveler", title: "الأسير الذي يعرف الطريق", region: "دهليز جانبي", story: "تسمع طرقًا خافتًا من خلف باب شبكي. خلفه مستكشف مسنّ يحمل خريطة للطوابق العليا، ويقول إن رفيقه أغلق عليه الباب بعد خلاف على تقسيم الغنائم. يطلب تحريره، لكنه لا يملك ما يثبت قصته سوى علامة محفورة على الخريطة.", choices: [
    { id: "free", label: "حرّره وافحص الخريطة", hint: "تساعده وقد يرشدك إلى مخبأ.", gold: 120, xp: 150, gear: true },
    { id: "question", label: "اطلب دليلًا قبل فتح الباب", hint: "تقلل احتمال الوقوع في خدعة.", xp: 115, heal: 8 },
    { id: "leave", label: "اتركه وتابع الصعود", hint: "تتجنب الالتزام بقصته.", gold: 25, xp: 35 },
  ]},
  { kind: "omen", title: "صدى الطابق المفقود", region: "قاعة المرايا", story: "تنعكس صورتك في المرايا، لكن انعكاسًا واحدًا يتحرك متأخرًا عنك. يكتب على الزجاج رقم طابق غير موجود في السجل، ثم تظهر ثلاثة رموز: القوة، والذاكرة، والتوازن. يبدو أن اختيار الرمز سيحدد نوع الأثر الذي يتركه الصدى.", choices: [
    { id: "power", label: "اختر رمز القوة", hint: "مكافأة ذهبية مع اختبار صعب.", gold: 175, xp: 105, damage: 10 },
    { id: "memory", label: "اختر رمز الذاكرة", hint: "خبرة أكبر وفرصة عتاد.", xp: 190, gear: true },
    { id: "balance", label: "اختر رمز التوازن", hint: "استعادة بسيطة وخبرة مستقرة.", gold: 65, xp: 110, heal: 18 },
  ]},
  { kind: "merchant", title: "قافلة ساهر المفقودة", region: "ساحة القوافل", story: "تلمح ضوء مصباح خلف عمود مكسور. إنها عربة صغيرة محمية بألواح معدنية، وبجانبها تاجر اسمه ساهر يراجع بضاعته. يقول إنه لا يفتح متجره إلا للمغامرين الذين وصلوا إلى هذا العمق، ويعرض عليك صفقة قبل أن يغادر إلى الطابق التالي.", choices: [
    { id: "rumor", label: "اسأله عن الطابق القادم", hint: "يشاركك معلومة عن مخاطر الممرات العليا.", xp: 65 },
    { id: "bargain", label: "فاوضه على السعر", hint: "قد تحصل على خصم مقابل خدمة صغيرة.", gold: 45, xp: 65 },
    { id: "decline", label: "اشكره ودعه يرحل", hint: "تحتفظ بمواردك وتواصل التقدم.", xp: 20 },
  ]},
];

export function getDimasEvent(floor: number, level: number, seed = Date.now()): DimasEvent {
  const index = Math.abs(Math.floor(seed / 13 + floor * 7 + level * 3)) % EVENT_BANK.length;
  return { ...EVENT_BANK[index]!, id: `dimas-event-${floor}-${seed}` };
}
export function getDimasMerchantStock(level: number, floor: number, seed = Date.now()): DimasMerchantItem[] {
  const sample = getDungeonDrop(floor, Math.max(1, level), () => Math.min(0.999, Math.abs(Math.sin(seed * 0.001)) * 0.999));
  const factor = 1 + Math.log2(Math.max(1, level)) * 0.22 + floor * 0.003;
  return [
    { id: "dimas-gear", name: sample.name, description: `${sample.slot} • ${sample.rarity} • يتطلب مستوى ${sample.requiredLevel ?? 1}`, price: Math.max(80, Math.round(sample.price * factor * 0.72)), kind: "gear" },
    { id: "dimas-tonic", name: "إكسير الديماس", description: "استعادة صحية بعد المواجهات.", price: Math.round(90 * factor), kind: "tonic" },
    { id: "dimas-supply", name: "صندوق إمداد الحراس", description: "ذهب إضافي لمواصلة الصعود.", price: Math.round(190 * factor), kind: "gold" },
  ];
}
export function buyDimasMerchantItem(state: GameState, floor: number, itemId: string, seed = Date.now()): { state: GameState; error?: string } {
  if (!state.hero) return { state, error: "أنشئ شخصيتك أولًا." };
  const stock = getDimasMerchantStock(state.hero.level, floor, seed);
  const item = stock.find((entry) => entry.id === itemId);
  if (!item) return { state, error: "انتهى عرض هذا التاجر." };
  if (state.gold < item.price) return { state, error: "ذهبك لا يكفي لهذه الصفقة." };
  const next = JSON.parse(JSON.stringify(state)) as GameState;
  next.gold -= item.price;
  if (item.kind === "gear") {
    if (next.inventory.length >= 500) return { state, error: "حقيبتك ممتلئة." };
    const template = getDungeonDrop(floor, next.hero?.level ?? 1, () => Math.min(0.999, Math.abs(Math.sin(seed * 0.001)) * 0.999));
    next.inventory.unshift(createItemInstance(template, `merchant-${seed}`));
  } else if (item.kind === "tonic") {
    next.roaming.health = Math.min(next.roaming.maxHealth, next.roaming.health + 35);
  } else {
    next.gold += Math.round(item.price * 0.9);
  }
  return { state: next };
}
export function resolveDimasEvent(state: GameState, event: DimasEvent, choiceId: string): { state: GameState; message: string; loot?: EquipmentItem } {
  const choice = event.choices.find((entry) => entry.id === choiceId);
  if (!choice || !state.hero) return { state, message: "هذا الاختيار غير متاح." };
  const next = JSON.parse(JSON.stringify(state)) as GameState;
  const levelFactor = 1 + Math.log2(Math.max(1, next.hero?.level ?? 1)) * 0.16;
  const gold = Math.round((choice.gold ?? 0) * levelFactor);
  const xp = Math.round((choice.xp ?? 0) * levelFactor);
  next.gold = Math.min(1_000_000_000, next.gold + gold);
  if (choice.damage) next.roaming.health = Math.max(1, next.roaming.health - choice.damage);
  if (choice.heal) next.roaming.health = Math.min(next.roaming.maxHealth, next.roaming.health + choice.heal);
  if (xp) Object.assign(next, addExperience(next, xp).state);
  let loot: EquipmentItem | undefined;
  const level = next.hero?.level ?? 1;
  if (choice.gear && next.inventory.length < 500) {
    loot = createItemInstance(getDungeonDrop(event.id.length, level), `event-${Date.now()}`);
    next.inventory.unshift(loot);
  }
  const message = [gold ? `+${gold} ذهب` : "", xp ? `+${xp} خبرة` : "", loot ? `غنيمة: ${loot.name}` : "", choice.damage ? `-${choice.damage} صحة` : "", choice.heal ? `+${choice.heal} صحة` : ""].filter(Boolean).join(" • ") || "انتهى اللقاء دون مكاسب.";
  return { state: next, message, ...(loot ? { loot } : {}) };
}
