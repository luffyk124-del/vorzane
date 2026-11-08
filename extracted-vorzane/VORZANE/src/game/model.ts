export type ClassId = "Warrior" | "Mage" | "Assassin" | "Archer";
export type StatKey = "str" | "def" | "vit" | "agi" | "luck";
export type StatBlock = Record<StatKey, number>;
export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary" | "mythic";
export type BattleMode = "cave" | "dungeon" | "tower" | "hard";
export type EquipmentItem = {
  id: string;
  name: string;
  slot: string;
  rarity: Rarity;
  bonus: Partial<StatBlock>;
  price: number;
  catalogId?: string;
  requiredLevel?: number;
  requiredDungeonFloor?: number;
  icon?: string;
};

export type Hero = {
  name: string;
  className: ClassId;
  level: number;
  exp: number;
  statPoints: number;
  stats: StatBlock;
  baseStats: StatBlock;
};

export type ActiveExpedition = {
  queueId: string;
  planId: string;
  startedAt: number;
  endsAt: number;
};

export type QueuedExpedition = {
  queueId: string;
  planId: string;
  queuedAt: number;
};

export type OfflineReport = {
  id: string;
  planId: string;
  completedAt: number;
  gold: number;
  xp: number;
  failure?: string;
};

export type CharacterStyle = { gender: "male" | "female"; appearance: 0 | 1 | 2 | 3 };

export type GameState = {
  hero: Hero | null;
  characterStyle: CharacterStyle;
  profileAvatarId: ClassId | "brand";
  gold: number;
  gems: number;
  inventory: EquipmentItem[];
  equipped: Record<string, EquipmentItem | null>;
  pets: string[];
  activePet: string | null;
  tower: number;
  story: number;
  dungeonFloor: number;
  battleWinsByMode: Record<BattleMode, number>;
  battles: number;
  wins: number;
  expeditionsCompleted: number;
  quests: { first: boolean; battles: boolean; level: boolean; [key: string]: boolean };
  achievements: { first: boolean; level: boolean; wins: boolean; [key: string]: boolean };
  claimedQuestRewards: Record<string, boolean>;
  activeExpedition: ActiveExpedition | null;
  expeditionQueue: QueuedExpedition[];
  offlineSummary: OfflineReport[];
  lastSeenAt: number;
  settings: {
    sfx: boolean;
    volume: number;
    musicEnabled: boolean;
    musicVolume: number;
  };
};

export const CLASS_STATS: Record<ClassId, StatBlock> = {
  Warrior: { str: 13, def: 12, vit: 12, agi: 8, luck: 5 },
  Mage: { str: 15, def: 7, vit: 9, agi: 10, luck: 9 },
  Assassin: { str: 10, def: 8, vit: 9, agi: 16, luck: 10 },
  Archer: { str: 11, def: 9, vit: 10, agi: 13, luck: 12 },
};

export const CLASS_NAMES: Record<ClassId, string> = {
  Warrior: "المحارب",
  Mage: "الساحر",
  Assassin: "المغتال",
  Archer: "رامي السهام",
};

export const CLASS_DESCRIPTIONS: Record<ClassId, string> = {
  Warrior: "خط الدفاع الأول؛ صمود وقوة في المواجهة.",
  Mage: "سحر هجومي يوازن بين الطاقة والحكمة.",
  Assassin: "سرعة عالية وضربات حرجة دقيقة.",
  Archer: "قتال بعيد المدى وفرص متوازنة للضربة الحرجة.",
};

export const SLOT_NAMES = ["سلاح", "درع", "خوذة", "قفازات", "حذاء", "قلادة", "خاتم أول", "خاتم ثانٍ"];

export function createFreshState(): GameState {
  return {
    hero: null,
    characterStyle: { gender: "male", appearance: 0 },
    profileAvatarId: "brand",
    gold: 500,
    gems: 50,
    inventory: [],
    equipped: {},
    pets: [],
    activePet: null,
    tower: 0,
    story: 0,
    dungeonFloor: 1,
    battleWinsByMode: { cave: 0, dungeon: 0, tower: 0, hard: 0 },
    battles: 0,
    wins: 0,
    expeditionsCompleted: 0,
    quests: { first: false, battles: false, level: false },
    achievements: { first: false, level: false, wins: false },
    claimedQuestRewards: {},
    activeExpedition: null,
    expeditionQueue: [],
    offlineSummary: [],
    lastSeenAt: Date.now(),
    settings: { sfx: true, volume: 20, musicEnabled: true, musicVolume: 24 },
  };
}

function finite(value: unknown, fallback: number, min = 0, max = Number.MAX_SAFE_INTEGER) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

function normalizeItem(value: unknown): EquipmentItem | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<EquipmentItem>;
  if (typeof item.id !== "string" || typeof item.name !== "string" || typeof item.slot !== "string") return null;
  const bonus = item.bonus && typeof item.bonus === "object" ? item.bonus : {};
  return {
    id: item.id,
    name: item.name,
    slot: item.slot,
    rarity: ["common", "uncommon", "rare", "epic", "legendary", "mythic"].includes(String(item.rarity)) ? item.rarity as Rarity : "common",
    bonus: Object.fromEntries(Object.entries(bonus).filter(([key]) => ["str", "def", "vit", "agi", "luck"].includes(key)).map(([key, amount]) => [key, finite(amount, 0, 0, 999)])) as Partial<StatBlock>,
    price: finite(item.price, 0, 0, 1_000_000),
    ...(typeof item.catalogId === "string" ? { catalogId: item.catalogId.slice(0, 120) } : {}),
    ...(item.requiredLevel !== undefined ? { requiredLevel: finite(item.requiredLevel, 1, 1, 999) } : {}),
    ...(item.requiredDungeonFloor !== undefined ? { requiredDungeonFloor: finite(item.requiredDungeonFloor, 1, 1, 100_000) } : {}),
    ...(typeof item.icon === "string" ? { icon: item.icon } : {}),
  };
}

function normalizeExpedition(value: unknown): ActiveExpedition | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<ActiveExpedition>;
  if (typeof item.planId !== "string") return null;
  const startedAt = finite(item.startedAt, 0, 0);
  const endsAt = finite(item.endsAt, 0, startedAt);
  return { queueId: typeof item.queueId === "string" ? item.queueId : `${item.planId}-${startedAt}`, planId: item.planId, startedAt, endsAt };
}

export function normalizeGameState(value: unknown): GameState | null {
  if (!value || typeof value !== "object" || Array.isArray(value) || !("hero" in value)) return null;
  const source = value as Partial<GameState> & { hero?: unknown };
  const fresh = createFreshState();
  let hero: Hero | null = null;

  if (source.hero !== null && source.hero !== undefined) {
    if (typeof source.hero !== "object" || Array.isArray(source.hero)) return null;
    const input = source.hero as Partial<Hero>;
    const className = (Object.keys(CLASS_STATS) as ClassId[]).includes(input.className as ClassId) ? input.className as ClassId : "Warrior";
    const stats = input.stats && typeof input.stats === "object" ? input.stats as Partial<StatBlock> : {};
    const baseStats = input.baseStats && typeof input.baseStats === "object" ? input.baseStats as Partial<StatBlock> : {};
    hero = {
      name: String(input.name ?? "مغامر").trim().slice(0, 24) || "مغامر",
      className,
      level: finite(input.level, 1, 1, 999),
      exp: finite(input.exp, 0, 0, 1_000_000),
      statPoints: finite(input.statPoints, 0, 0, 100_000),
      stats: Object.fromEntries((Object.keys(CLASS_STATS[className]) as StatKey[]).map((key) => [key, finite(stats[key], CLASS_STATS[className][key], 0, 999_999)])) as StatBlock,
      baseStats: Object.fromEntries((Object.keys(CLASS_STATS[className]) as StatKey[]).map((key) => [key, finite(baseStats[key], CLASS_STATS[className][key], 0, 999_999)])) as StatBlock,
    };
  }

  const inventory = Array.isArray(source.inventory) ? source.inventory.map(normalizeItem).filter((item): item is EquipmentItem => item !== null).slice(0, 500) : [];
  const equipped: Record<string, EquipmentItem | null> = {};
  if (source.equipped && typeof source.equipped === "object" && !Array.isArray(source.equipped)) {
    for (const [slot, item] of Object.entries(source.equipped)) equipped[slot] = normalizeItem(item);
  }
  const settings = source.settings && typeof source.settings === "object" ? source.settings as Partial<GameState["settings"]> : {};
  const oldVolume = finite(settings.volume, fresh.settings.volume, 0, 100);
  const quests = source.quests && typeof source.quests === "object" ? source.quests : {};
  const achievements = source.achievements && typeof source.achievements === "object" ? source.achievements : {};
  const queue = Array.isArray(source.expeditionQueue) ? source.expeditionQueue.filter((item): item is QueuedExpedition => !!item && typeof item === "object" && typeof (item as QueuedExpedition).planId === "string").slice(0, 3) : [];
  const reports = Array.isArray(source.offlineSummary) ? source.offlineSummary.filter((item): item is OfflineReport => !!item && typeof item === "object" && typeof (item as OfflineReport).planId === "string").slice(-5) : [];

  return {
    ...fresh,
    ...source,
    hero,
    characterStyle: {
      gender: source.characterStyle?.gender === "female" ? "female" : "male",
      appearance: ([0, 1, 2, 3].includes(Number(source.characterStyle?.appearance)) ? Number(source.characterStyle?.appearance) : 0) as 0 | 1 | 2 | 3,
    },
    profileAvatarId: ["brand", "Warrior", "Mage", "Assassin", "Archer"].includes(String(source.profileAvatarId)) ? source.profileAvatarId as ClassId | "brand" : "brand",
    gold: finite(source.gold, fresh.gold, 0, 1_000_000_000),
    gems: finite(source.gems, fresh.gems, 0, 1_000_000_000),
    inventory,
    equipped,
    pets: Array.isArray(source.pets) ? source.pets.filter((id): id is string => typeof id === "string").slice(0, 100) : [],
    activePet: typeof source.activePet === "string" ? source.activePet : null,
    tower: finite(source.tower, 0, 0, 100_000),
    story: finite(source.story, 0, 0, 100_000),
    dungeonFloor: finite(source.dungeonFloor, fresh.dungeonFloor, 1, 100_000),
    battleWinsByMode: {
      cave: finite(source.battleWinsByMode?.cave, 0, 0, 1_000_000_000),
      dungeon: finite(source.battleWinsByMode?.dungeon, 0, 0, 1_000_000_000),
      tower: finite(source.battleWinsByMode?.tower, 0, 0, 1_000_000_000),
      hard: finite(source.battleWinsByMode?.hard, 0, 0, 1_000_000_000),
    },
    battles: finite(source.battles, 0, 0, 1_000_000_000),
    wins: finite(source.wins, 0, 0, 1_000_000_000),
    expeditionsCompleted: finite(source.expeditionsCompleted, 0, 0, 1_000_000_000),
    quests: { ...fresh.quests, ...quests },
    achievements: { ...fresh.achievements, ...achievements },
    claimedQuestRewards: source.claimedQuestRewards && typeof source.claimedQuestRewards === "object" ? source.claimedQuestRewards : {},
    activeExpedition: normalizeExpedition(source.activeExpedition),
    expeditionQueue: queue,
    offlineSummary: reports,
    lastSeenAt: finite(source.lastSeenAt, Date.now(), 0),
    settings: {
      sfx: typeof settings.sfx === "boolean" ? settings.sfx : fresh.settings.sfx,
      volume: oldVolume,
      musicEnabled: typeof settings.musicEnabled === "boolean" ? settings.musicEnabled : true,
      musicVolume: finite(settings.musicVolume, oldVolume || fresh.settings.musicVolume, 0, 100),
    },
  };
}

export const LEGACY_SAVE_KEY = "vorzane_save_v2";
export const LEGACY_CLAIM_KEY = "vorzane_legacy_save_claimed_by";
export const USER_SAVE_PREFIX = "vorzane_save_v2_user_";
