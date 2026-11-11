import type { EquipmentItem, Rarity, StatKey } from "./model.ts";
import { STARTER_ITEMS } from "./catalog.ts";

type ItemProfile = { main: StatKey; secondary: StatKey; tertiary?: StatKey };
type SlotBlueprint = { slot: string; icon: string; basePrice: number; profiles: ItemProfile[] };
type TierBlueprint = { label: string; minLevel: number; statBase: number; priceMultiplier: number };

const RARITY_ORDER: Rarity[] = ["common", "uncommon", "rare", "epic", "legendary", "mythic"];
const TIERS: Record<Rarity, TierBlueprint> = {
  common: { label: "الخامد", minLevel: 1, statBase: 3, priceMultiplier: 1 },
  uncommon: { label: "المشحون", minLevel: 4, statBase: 5, priceMultiplier: 2.4 },
  rare: { label: "المنقوش", minLevel: 10, statBase: 9, priceMultiplier: 7 },
  epic: { label: "المسحور", minLevel: 22, statBase: 16, priceMultiplier: 22 },
  legendary: { label: "الأثيري", minLevel: 42, statBase: 29, priceMultiplier: 85 },
  mythic: { label: "الأزلي", minLevel: 70, statBase: 48, priceMultiplier: 320 },
};

const SLOT_BLUEPRINTS: SlotBlueprint[] = [
  { slot: "سلاح", icon: "flash", basePrice: 850, profiles: [{ main: "str", secondary: "agi" }, { main: "str", secondary: "luck" }, { main: "agi", secondary: "str" }, { main: "str", secondary: "def" }, { main: "agi", secondary: "vit" }, { main: "str", secondary: "vit", tertiary: "luck" }] },
  { slot: "درع", icon: "shield", basePrice: 780, profiles: [{ main: "def", secondary: "vit" }, { main: "def", secondary: "str" }, { main: "vit", secondary: "def" }, { main: "def", secondary: "luck" }, { main: "vit", secondary: "agi" }, { main: "def", secondary: "vit", tertiary: "str" }] },
  { slot: "خوذة", icon: "skull", basePrice: 540, profiles: [{ main: "def", secondary: "vit" }, { main: "def", secondary: "luck" }, { main: "vit", secondary: "agi" }, { main: "def", secondary: "str" }, { main: "luck", secondary: "def" }, { main: "def", secondary: "vit", tertiary: "agi" }] },
  { slot: "قفازات", icon: "hand-left", basePrice: 460, profiles: [{ main: "str", secondary: "agi" }, { main: "agi", secondary: "luck" }, { main: "str", secondary: "def" }, { main: "agi", secondary: "str" }, { main: "str", secondary: "vit" }, { main: "agi", secondary: "str", tertiary: "luck" }] },
  { slot: "حذاء", icon: "footsteps", basePrice: 420, profiles: [{ main: "agi", secondary: "vit" }, { main: "agi", secondary: "luck" }, { main: "vit", secondary: "def" }, { main: "agi", secondary: "str" }, { main: "luck", secondary: "agi" }, { main: "agi", secondary: "vit", tertiary: "def" }] },
  { slot: "قلادة", icon: "diamond", basePrice: 560, profiles: [{ main: "vit", secondary: "luck" }, { main: "luck", secondary: "agi" }, { main: "vit", secondary: "def" }, { main: "luck", secondary: "str" }, { main: "vit", secondary: "str" }, { main: "luck", secondary: "vit", tertiary: "agi" }] },
  { slot: "خاتم أول", icon: "ellipse", basePrice: 390, profiles: [{ main: "luck", secondary: "str" }, { main: "luck", secondary: "agi" }, { main: "str", secondary: "vit" }, { main: "agi", secondary: "luck" }, { main: "luck", secondary: "def" }, { main: "luck", secondary: "str", tertiary: "vit" }] },
  { slot: "خاتم ثانٍ", icon: "ellipse", basePrice: 390, profiles: [{ main: "luck", secondary: "def" }, { main: "luck", secondary: "agi" }, { main: "def", secondary: "vit" }, { main: "agi", secondary: "str" }, { main: "luck", secondary: "str" }, { main: "luck", secondary: "def", tertiary: "vit" }] },
];

const THEMES = ["الرماد", "العاصفة", "الشق", "الليل", "المدّ", "الهاوية"];
const VARIANCE = [0.9, 0.94, 0.98, 1.02, 1.06, 1.1];

function generateDungeonItems(): EquipmentItem[] {
  return SLOT_BLUEPRINTS.flatMap((slot, slotIndex) => RARITY_ORDER.flatMap((rarity) => {
    const tier = TIERS[rarity];
    return slot.profiles.map((profile, variant) => {
      const requiredLevel = tier.minLevel + (variant >= 3 ? 3 : 0);
      const levelScale = 1 + requiredLevel * 0.16;
      const main = Math.max(1, Math.round(tier.statBase * levelScale * VARIANCE[variant]));
      const bonus: Partial<Record<StatKey, number>> = {
        [profile.main]: main,
        [profile.secondary]: Math.max(1, Math.round(main * 0.32)),
      };
      if (profile.tertiary && variant % 3 === 2) bonus[profile.tertiary] = Math.max(1, Math.round(main * 0.16));
      const price = Math.round(slot.basePrice * tier.priceMultiplier * Math.pow(1 + requiredLevel * 0.11, 2.35) * VARIANCE[variant]);
      return {
        id: `dun-${slotIndex + 1}-${rarity}-${variant + 1}`,
        name: `${slot.slot} ${tier.label} ${THEMES[variant]}`,
        slot: slot.slot,
        rarity,
        bonus,
        price,
        catalogId: `dun-${slotIndex + 1}-${rarity}-${variant + 1}`,
        requiredLevel,
        icon: slot.icon,
      };
    });
  }));
}

export const DUNGEON_ITEMS = generateDungeonItems();
export const DUNGEON_ITEM_POOL_SIZE = DUNGEON_ITEMS.length;
export const EVENT_RELICS: EquipmentItem[] = [
  { id: "event-fairy-pendant", name: "قلادة عهد الجنية", slot: "قلادة", rarity: "rare", bonus: { vit: 18, luck: 14 }, price: 28_000, requiredLevel: 10, icon: "flower" },
  { id: "event-echo-seal", name: "ختم الصدى المتشظي", slot: "خاتم أول", rarity: "mythic", bonus: { str: 65, def: 42, agi: 30 }, price: 1_250_000, requiredLevel: 35, icon: "sparkles" },
  { id: "event-warden-blade", name: "نصل حارس العهد", slot: "سلاح", rarity: "epic", bonus: { str: 48, luck: 18 }, price: 165_000, requiredLevel: 25, icon: "flash" },
];

// Loot rarity is driven by hero progression, never by the current dungeon floor.
function rarityWeights(level: number): Record<Rarity, number> {
  if (level >= 70) return { common: 8, uncommon: 16, rare: 24, epic: 25, legendary: 20, mythic: 7 };
  if (level >= 42) return { common: 12, uncommon: 22, rare: 28, epic: 23, legendary: 13, mythic: 2 };
  if (level >= 22) return { common: 22, uncommon: 30, rare: 28, epic: 16, legendary: 4, mythic: 0 };
  if (level >= 10) return { common: 38, uncommon: 34, rare: 21, epic: 7, legendary: 0, mythic: 0 };
  if (level >= 4) return { common: 62, uncommon: 29, rare: 9, epic: 0, legendary: 0, mythic: 0 };
  return { common: 86, uncommon: 14, rare: 0, epic: 0, legendary: 0, mythic: 0 };
}

export function getDungeonDrop(_floorValue: number, levelValue: number, random: () => number = Math.random): EquipmentItem {
  const level = Math.max(1, Math.floor(levelValue));
  const sample = () => {
    const value = random();
    return Number.isFinite(value) ? Math.min(0.999999999, Math.max(0, value)) : 0;
  };
  const weights = rarityWeights(level);
  const eligible = RARITY_ORDER.flatMap((rarity) => {
    const pool = DUNGEON_ITEMS.filter((item) => item.rarity === rarity && (item.requiredLevel ?? 1) <= level);
    const weight = weights[rarity];
    return weight > 0 && pool.length ? [{ rarity, weight, pool }] : [];
  });
  if (!eligible.length) throw new Error("No eligible equipment loot exists for the current player level.");
  const total = eligible.reduce((sum, tier) => sum + tier.weight, 0);
  let roll = sample() * total;
  let chosen = eligible[0]!;
  for (const tier of eligible) {
    roll -= tier.weight;
    if (roll < 0) { chosen = tier; break; }
  }
  const itemRoll = Math.min(chosen.pool.length - 1, Math.floor(sample() * chosen.pool.length));
  return chosen.pool[itemRoll] ?? chosen.pool[0]!;
}

export function createItemInstance(template: EquipmentItem, suffix?: string): EquipmentItem {
  const catalogId = template.catalogId ?? template.id;
  const instance = suffix ?? `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  return { ...template, id: `${catalogId}-${instance}`, catalogId, bonus: { ...template.bonus } };
}

export function findEquipmentTemplate(item: EquipmentItem): EquipmentItem | undefined {
  const all = [...STARTER_ITEMS, ...DUNGEON_ITEMS, ...EVENT_RELICS];
  const catalogMatch = item.catalogId ? all.find((candidate) => candidate.id === item.catalogId) : undefined;
  if (catalogMatch && (item.id === catalogMatch.id || item.id.startsWith(`${catalogMatch.id}-`))) return catalogMatch;
  const exactMatch = all.find((candidate) => candidate.id === item.id);
  if (exactMatch) return exactMatch;
  return all.find((candidate) => item.id.startsWith(`${candidate.id}-`));
}

export function getEquipmentSellPrice(item: EquipmentItem): number | null {
  const template = findEquipmentTemplate(item);
  return template ? Math.floor(template.price / 2) : null;
}
