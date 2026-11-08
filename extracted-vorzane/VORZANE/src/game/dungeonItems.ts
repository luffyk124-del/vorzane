import type { EquipmentItem, Rarity, StatKey } from "./model";
import { SHOP_ITEMS, STARTER_ITEMS } from "./catalog";

type ItemProfile = { main: StatKey; secondary: StatKey; tertiary?: StatKey };
type SlotBlueprint = { slot: string; icon: string; basePrice: number; profiles: ItemProfile[] };
type TierBlueprint = { label: string; minLevel: number; minFloor: number; statBase: number; priceMultiplier: number };

const RARITY_ORDER: Rarity[] = ["common", "uncommon", "rare", "epic", "legendary", "mythic"];
const TIERS: Record<Rarity, TierBlueprint> = {
  common: { label: "الخامد", minLevel: 1, minFloor: 1, statBase: 1.5, priceMultiplier: 1 },
  uncommon: { label: "المشحون", minLevel: 2, minFloor: 2, statBase: 1.9, priceMultiplier: 1.25 },
  rare: { label: "المنقوش", minLevel: 5, minFloor: 5, statBase: 2.3, priceMultiplier: 1.6 },
  epic: { label: "المسحور", minLevel: 10, minFloor: 10, statBase: 2.8, priceMultiplier: 2.2 },
  legendary: { label: "الأثيري", minLevel: 20, minFloor: 20, statBase: 3.4, priceMultiplier: 3.2 },
  mythic: { label: "الأزلي", minLevel: 35, minFloor: 40, statBase: 4, priceMultiplier: 4.5 },
};

const SLOT_BLUEPRINTS: SlotBlueprint[] = [
  { slot: "سلاح", icon: "flash", basePrice: 30, profiles: [{ main: "str", secondary: "agi" }, { main: "str", secondary: "luck" }, { main: "agi", secondary: "str" }, { main: "str", secondary: "def" }, { main: "agi", secondary: "vit" }, { main: "str", secondary: "vit", tertiary: "luck" }] },
  { slot: "درع", icon: "shield", basePrice: 28, profiles: [{ main: "def", secondary: "vit" }, { main: "def", secondary: "str" }, { main: "vit", secondary: "def" }, { main: "def", secondary: "luck" }, { main: "vit", secondary: "agi" }, { main: "def", secondary: "vit", tertiary: "str" }] },
  { slot: "خوذة", icon: "skull", basePrice: 22, profiles: [{ main: "def", secondary: "vit" }, { main: "def", secondary: "luck" }, { main: "vit", secondary: "agi" }, { main: "def", secondary: "str" }, { main: "luck", secondary: "def" }, { main: "def", secondary: "vit", tertiary: "agi" }] },
  { slot: "قفازات", icon: "hand-left", basePrice: 20, profiles: [{ main: "str", secondary: "agi" }, { main: "agi", secondary: "luck" }, { main: "str", secondary: "def" }, { main: "agi", secondary: "str" }, { main: "str", secondary: "vit" }, { main: "agi", secondary: "str", tertiary: "luck" }] },
  { slot: "حذاء", icon: "footsteps", basePrice: 18, profiles: [{ main: "agi", secondary: "vit" }, { main: "agi", secondary: "luck" }, { main: "vit", secondary: "def" }, { main: "agi", secondary: "str" }, { main: "luck", secondary: "agi" }, { main: "agi", secondary: "vit", tertiary: "def" }] },
  { slot: "قلادة", icon: "diamond", basePrice: 22, profiles: [{ main: "vit", secondary: "luck" }, { main: "luck", secondary: "agi" }, { main: "vit", secondary: "def" }, { main: "luck", secondary: "str" }, { main: "vit", secondary: "str" }, { main: "luck", secondary: "vit", tertiary: "agi" }] },
  { slot: "خاتم أول", icon: "ellipse", basePrice: 16, profiles: [{ main: "luck", secondary: "str" }, { main: "luck", secondary: "agi" }, { main: "str", secondary: "vit" }, { main: "agi", secondary: "luck" }, { main: "luck", secondary: "def" }, { main: "luck", secondary: "str", tertiary: "vit" }] },
  { slot: "خاتم ثانٍ", icon: "ellipse", basePrice: 16, profiles: [{ main: "luck", secondary: "def" }, { main: "luck", secondary: "agi" }, { main: "def", secondary: "vit" }, { main: "agi", secondary: "str" }, { main: "luck", secondary: "str" }, { main: "luck", secondary: "def", tertiary: "vit" }] },
];

const THEMES = ["الرماد", "العاصفة", "الشق", "الليل", "المدّ", "الهاوية"];
const VARIANCE = [0.9, 0.94, 0.98, 1.02, 1.06, 1.1];

function generateDungeonItems(): EquipmentItem[] {
  return SLOT_BLUEPRINTS.flatMap((slot, slotIndex) => RARITY_ORDER.flatMap((rarity) => {
    const tier = TIERS[rarity];
    return slot.profiles.map((profile, variant) => {
      const requiredLevel = tier.minLevel + (variant >= 3 ? 3 : 0);
      const requiredDungeonFloor = tier.minFloor + (variant >= 3 ? 4 : 0);
      const levelScale = 1 + (requiredLevel - 1) * 0.11;
      const main = Math.max(1, Math.round(tier.statBase * levelScale * VARIANCE[variant]));
      const bonus: Partial<Record<StatKey, number>> = {
        [profile.main]: main,
        [profile.secondary]: Math.max(1, Math.round(main * 0.27)),
      };
      if (profile.tertiary && variant % 3 === 2) bonus[profile.tertiary] = Math.max(1, Math.round(main * 0.13));
      const price = Math.round(slot.basePrice * tier.priceMultiplier * (1 + (requiredLevel - 1) * 0.1) * VARIANCE[variant]);
      return {
        id: `dun-${slotIndex + 1}-${rarity}-${variant + 1}`,
        name: `${slot.slot} ${tier.label} ${THEMES[variant]}`,
        slot: slot.slot,
        rarity,
        bonus,
        price,
        catalogId: `dun-${slotIndex + 1}-${rarity}-${variant + 1}`,
        requiredLevel,
        requiredDungeonFloor,
        icon: slot.icon,
      };
    });
  }));
}

export const DUNGEON_ITEMS = generateDungeonItems();
export const DUNGEON_ITEM_POOL_SIZE = DUNGEON_ITEMS.length;

function rarityWeights(floor: number): Record<Rarity, number> {
  if (floor >= 40) return { common: 20, uncommon: 25, rare: 25, epic: 18, legendary: 10, mythic: 2 };
  if (floor >= 20) return { common: 30, uncommon: 28, rare: 24, epic: 13, legendary: 5, mythic: 0 };
  if (floor >= 10) return { common: 42, uncommon: 29, rare: 20, epic: 8, legendary: 1, mythic: 0 };
  if (floor >= 5) return { common: 55, uncommon: 28, rare: 15, epic: 2, legendary: 0, mythic: 0 };
  if (floor >= 3) return { common: 70, uncommon: 25, rare: 5, epic: 0, legendary: 0, mythic: 0 };
  return { common: 86, uncommon: 14, rare: 0, epic: 0, legendary: 0, mythic: 0 };
}

export function getDungeonDrop(floorValue: number, levelValue: number, random: () => number = Math.random): EquipmentItem {
  const floor = Math.max(1, Math.floor(floorValue));
  const level = Math.max(1, Math.floor(levelValue));
  const sample = () => {
    const value = random();
    return Number.isFinite(value) ? Math.min(0.999999999, Math.max(0, value)) : 0;
  };
  const weights = rarityWeights(floor);
  const eligible = RARITY_ORDER.flatMap((rarity) => {
    const pool = DUNGEON_ITEMS.filter((item) => item.rarity === rarity && (item.requiredLevel ?? 1) <= level && (item.requiredDungeonFloor ?? 1) <= floor);
    const weight = weights[rarity];
    return weight > 0 && pool.length ? [{ rarity, weight, pool }] : [];
  });
  if (!eligible.length) throw new Error("No eligible dungeon loot exists for the current floor and level.");
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
  const all = [...STARTER_ITEMS, ...SHOP_ITEMS, ...DUNGEON_ITEMS];
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
