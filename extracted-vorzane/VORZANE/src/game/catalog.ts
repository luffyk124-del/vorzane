import type { BattleMode, ClassId, EquipmentItem, StatKey } from "./model";

export const PETS: { id: string; name: string; icon: string; bonus: Partial<Record<StatKey, number>>; price: number; requiredLevel: number; description: string }[] = [
  { id: "wolf", name: "ذئب الرماد", icon: "paw", bonus: { agi: 2 }, price: 300, requiredLevel: 1, description: "رفيق البداية؛ يرفع الرشاقة قليلًا." },
  { id: "golem", name: "حارس الصخر", icon: "shield", bonus: { def: 4 }, price: 450, requiredLevel: 4, description: "درع حيّ يمنح صمودًا أكبر من المستوى الرابع." },
  { id: "fox", name: "ثعلب السراب", icon: "sparkles", bonus: { luck: 9 }, price: 540, requiredLevel: 7, description: "حظّه الأقوى يرافق الصيادين بعد المستوى السابع." },
  { id: "phoenix", name: "عنقاء الفجر", icon: "sunny", bonus: { vit: 10 }, price: 620, requiredLevel: 10, description: "نور متجدد يمنح حيوية عالية من المستوى العاشر." },
  { id: "dragon", name: "تنين الياقوت", icon: "flame", bonus: { str: 9 }, price: 700, requiredLevel: 15, description: "رفيق متقدم يرفع القوة الهجومية بعد المستوى الخامس عشر." },
  { id: "owl", name: "بومة الحكمة", icon: "eye", bonus: { luck: 18, agi: 8 }, price: 18_000, requiredLevel: 20, description: "رفيق نادر يزيد الحظ وسرعة الحركة." },
  { id: "moon-deer", name: "أيل القمر", icon: "moon", bonus: { vit: 35, def: 12 }, price: 90_000, requiredLevel: 30, description: "رفيق أسطوري يمنح الحيوية والصمود." },
  { id: "star-drake", name: "تنين الشهب", icon: "star", bonus: { str: 60, luck: 24 }, price: 450_000, requiredLevel: 45, description: "رفيق عظيم يعزز القوة والحظ." },
];

export const STARTER_ITEMS: EquipmentItem[] = [
  { id: "sword1", name: "نصل البدايات", slot: "سلاح", rarity: "common", bonus: { str: 3 }, price: 100, requiredLevel: 1, icon: "flash" },
  { id: "staff5", name: "صولجان البلور", slot: "سلاح", rarity: "uncommon", bonus: { str: 12, luck: 3 }, price: 2_500, requiredLevel: 5, icon: "sparkles" },
  { id: "bow10", name: "قوس الشفق", slot: "سلاح", rarity: "rare", bonus: { str: 24, agi: 10 }, price: 12_000, requiredLevel: 10, icon: "navigate" },
  { id: "rune-blade20", name: "نصل الرونية", slot: "سلاح", rarity: "epic", bonus: { str: 52, luck: 14 }, price: 75_000, requiredLevel: 20, icon: "moon" },
  { id: "astral-staff35", name: "صولجان النجوم", slot: "سلاح", rarity: "legendary", bonus: { str: 95, vit: 30, luck: 25 }, price: 400_000, requiredLevel: 35, icon: "sparkles" },
  { id: "eclipse-bow50", name: "قوس الكسوف", slot: "سلاح", rarity: "mythic", bonus: { str: 180, agi: 70, luck: 45 }, price: 1_500_000, requiredLevel: 50, icon: "sunny" },

  { id: "armor1", name: "درع الحارس", slot: "درع", rarity: "common", bonus: { def: 4, vit: 2 }, price: 180, requiredLevel: 1, icon: "shield" },
  { id: "armor10", name: "درع الفولاذ الأزرق", slot: "درع", rarity: "rare", bonus: { def: 28, vit: 16 }, price: 14_000, requiredLevel: 10, icon: "shield" },
  { id: "armor30", name: "درع حارس الأطلال", slot: "درع", rarity: "legendary", bonus: { def: 110, vit: 65, luck: 18 }, price: 320_000, requiredLevel: 30, icon: "shield-checkmark" },
  { id: "helm1", name: "خوذة الحديد", slot: "خوذة", rarity: "common", bonus: { def: 3 }, price: 150, requiredLevel: 1, icon: "skull" },
  { id: "helm15", name: "تاج المرايا", slot: "خوذة", rarity: "epic", bonus: { def: 38, luck: 16 }, price: 42_000, requiredLevel: 15, icon: "sparkles" },
  { id: "gloves1", name: "قفازات الحارس", slot: "قفازات", rarity: "common", bonus: { str: 2, def: 1 }, price: 210, requiredLevel: 1, icon: "hand-left" },
  { id: "gloves25", name: "قفازات الشفق", slot: "قفازات", rarity: "epic", bonus: { str: 45, agi: 24 }, price: 95_000, requiredLevel: 25, icon: "hand-left" },
  { id: "boots1", name: "حذاء المسافر", slot: "حذاء", rarity: "common", bonus: { agi: 2 }, price: 90, requiredLevel: 1, icon: "footsteps" },
  { id: "boots20", name: "خطوات الريح", slot: "حذاء", rarity: "epic", bonus: { agi: 48, vit: 18 }, price: 80_000, requiredLevel: 20, icon: "footsteps" },
  { id: "amulet1", name: "قلادة الفجر", slot: "قلادة", rarity: "common", bonus: { vit: 3, luck: 1 }, price: 330, requiredLevel: 1, icon: "diamond" },
  { id: "amulet30", name: "قلادة قلب النجم", slot: "قلادة", rarity: "legendary", bonus: { vit: 70, luck: 42 }, price: 280_000, requiredLevel: 30, icon: "diamond" },
  { id: "ring1", name: "خاتم الحظ", slot: "خاتم أول", rarity: "common", bonus: { luck: 4 }, price: 250, requiredLevel: 1, icon: "ellipse" },
  { id: "ring15", name: "خاتم المجرّة", slot: "خاتم أول", rarity: "epic", bonus: { luck: 35, str: 20 }, price: 55_000, requiredLevel: 15, icon: "ellipse" },
  { id: "ring2-25", name: "خاتم العهد", slot: "خاتم ثانٍ", rarity: "epic", bonus: { def: 24, vit: 28 }, price: 68_000, requiredLevel: 25, icon: "ellipse" },
];

export const EXPEDITIONS = [
  { id: "ashen-pass", name: "ممرّ الرماد", region: "الحدود المنسية", icon: "trail-sign", durationSeconds: 10 * 60, rewardGold: 40, rewardXP: 35, requiredLevel: 1, difficulty: "سهل", description: "رحلة قصيرة لاستعادة الأنفاس واختبار العتاد." },
  { id: "sunken-archive", name: "الأرشيف الغارق", region: "السرداب الأزرق", icon: "library", durationSeconds: 15 * 60, rewardGold: 100, rewardXP: 55, requiredLevel: 3, difficulty: "متوسط", description: "اكتشف سجلّات قديمة قبل أن تبتلعها المياه." },
  { id: "silverwood", name: "غابة الفضة", region: "الأشجار الموشومة", icon: "leaf", durationSeconds: 30 * 60, rewardGold: 180, rewardXP: 100, requiredLevel: 6, difficulty: "متوسط", description: "تتبّع آثار الوحوش واجمع غنائم نادرة." },
  { id: "eclipse-fortress", name: "حصن الكسوف", region: "قلب الظلال", icon: "business", durationSeconds: 60 * 60, rewardGold: 360, rewardXP: 210, requiredLevel: 15, difficulty: "صعب", description: "مهمة طويلة لا يعود منها إلا المستعدّون." },
] as const;

export type ExpeditionPlan = (typeof EXPEDITIONS)[number];
export const findExpedition = (id: string) => EXPEDITIONS.find((item) => item.id === id);

export type EnemyBlueprint = {
  id: string;
  name: string;
  title: string;
  icon: string;
  tint: string;
  hpScale: number;
  attackScale: number;
  defenseScale: number;
  agility: number;
};

export const BATTLE_ENEMIES: Record<BattleMode, EnemyBlueprint[]> = {
  cave: [
    { id: "ash-wolf", name: "ذئب الرماد", title: "مفترس الأطراف", icon: "paw", tint: "#C98C6A", hpScale: 0.88, attackScale: 1.02, defenseScale: 0.78, agility: 15 },
    { id: "crystal-spider", name: "عنكبوت البلور", title: "حارس الشقوق", icon: "bug", tint: "#78B7C6", hpScale: 0.8, attackScale: 1.12, defenseScale: 0.68, agility: 17 },
    { id: "cave-ogre", name: "غول الكهوف", title: "كسارة الصخور", icon: "skull", tint: "#A47D74", hpScale: 1.24, attackScale: 0.92, defenseScale: 1.16, agility: 7 },
    { id: "ash-witch", name: "ساحرة الرماد", title: "صوت الممر", icon: "flame", tint: "#D27D73", hpScale: 0.9, attackScale: 1.16, defenseScale: 0.74, agility: 13 },
  ],
  dungeon: [
    { id: "dungeon-hound", name: "كلب الهاوية", title: "حارس الطابق", icon: "paw", tint: "#C77861", hpScale: 1, attackScale: 1, defenseScale: 1, agility: 12 },
    { id: "dungeon-wraith", name: "طيف الشق", title: "مطارد الأرواح", icon: "eye", tint: "#A99AE8", hpScale: 1, attackScale: 1, defenseScale: 1, agility: 15 },
    { id: "dungeon-sentinel", name: "حارس العظام", title: "درع الممر", icon: "shield", tint: "#91A4AA", hpScale: 1, attackScale: 1, defenseScale: 1, agility: 9 },
    { id: "dungeon-seer", name: "رائي الظلال", title: "موقظ الهاوية", icon: "moon", tint: "#8A84C8", hpScale: 1, attackScale: 1, defenseScale: 1, agility: 13 },
  ],
  tower: [
    { id: "tower-guard", name: "حارس الطابق", title: "حامي السلالم", icon: "shield", tint: "#A99AE8", hpScale: 1.06, attackScale: 1.02, defenseScale: 1.15, agility: 8 },
    { id: "tower-knight", name: "فارس الصدى", title: "سيف البرج", icon: "flash", tint: "#83ACD2", hpScale: 0.96, attackScale: 1.12, defenseScale: 0.92, agility: 12 },
    { id: "tower-oracle", name: "عرّافة القمة", title: "عين المراقبة", icon: "eye", tint: "#C1A0E8", hpScale: 0.92, attackScale: 1.18, defenseScale: 0.84, agility: 14 },
  ],
  hard: [
    { id: "eclipse-hunter", name: "مفترس الكسوف", title: "صياد العتمة", icon: "moon", tint: "#E67970", hpScale: 1.12, attackScale: 1.16, defenseScale: 1.02, agility: 14 },
    { id: "rift-champion", name: "بطل الشق", title: "سيد الساحة", icon: "flash", tint: "#CC7180", hpScale: 1.18, attackScale: 1.08, defenseScale: 1.1, agility: 11 },
    { id: "abyss-giant", name: "عملاق الهاوية", title: "ثقل الظلام", icon: "skull", tint: "#BA8269", hpScale: 1.42, attackScale: 0.96, defenseScale: 1.24, agility: 6 },
    { id: "night-sorcerer", name: "ساحر الليل", title: "حاصد النور", icon: "sparkles", tint: "#9986CE", hpScale: 0.94, attackScale: 1.27, defenseScale: 0.88, agility: 16 },
  ],
};

export type QuestMetric = "wins" | "level" | "caveWins" | "dungeonWins" | "towerWins" | "hardWins" | "expeditions" | "equipped";
export type QuestCategory = "قتال" | "الزنزانة" | "البرج" | "الرحلات" | "العتاد" | "تطور";
export const DUNGEON_ITEM_POOL_SIZE = 8 * 6 * 6;
export const QUESTS = [
  { id: "first", title: "الخطوة الأولى", description: "أكمل أول معركة", rewardGold: 100, icon: "sparkles", category: "قتال", metric: "wins", target: 1 },
  { id: "battles", title: "صاحب العزم", description: "اربح ثلاث معارك بأي نمط", rewardGold: 150, icon: "trophy", category: "قتال", metric: "wins", target: 3 },
  { id: "level", title: "بداية الصعود", description: "بلغ المستوى الثاني", rewardGold: 200, icon: "trending-up", category: "تطور", metric: "level", target: 2 },
  { id: "cave", title: "صياد الكهوف", description: "اهزم ثلاثة أعداء في كهف الرماد", rewardGold: 170, icon: "bonfire", category: "قتال", metric: "caveWins", target: 3 },
  { id: "dungeon", title: "نازل الهاوية", description: "اهزم خمسة أعداء في الزنزانة", rewardGold: 220, icon: "skull", category: "الزنزانة", metric: "dungeonWins", target: 5 },
  { id: "tower", title: "قاهر الطوابق", description: "اجتز طابقين في برج الحراس", rewardGold: 220, icon: "business", category: "البرج", metric: "towerWins", target: 2 },
  { id: "hard", title: "مواجهة الكسوف", description: "انتصر مرة في تحدي الكسوف", rewardGold: 300, icon: "moon", category: "قتال", metric: "hardWins", target: 1 },
  { id: "expeditions", title: "رحّالة الحدود", description: "أكمل رحلتين استكشافيتين", rewardGold: 180, icon: "compass", category: "الرحلات", metric: "expeditions", target: 2 },
  { id: "gear", title: "استعداد الأسطورة", description: "جهّز ثلاث قطع عتاد", rewardGold: 120, icon: "shield-checkmark", category: "العتاد", metric: "equipped", target: 3 },
] as const;

export const RARITY_LABELS = {
  common: "عادي",
  uncommon: "غير شائع",
  rare: "نادر",
  epic: "ملحمي",
  legendary: "أسطوري",
  mythic: "خرافي",
} as const;

export const CLASS_ICON: Record<ClassId, string> = {
  Warrior: "shield-half",
  Mage: "sparkles",
  Assassin: "eye-off",
  Archer: "navigate",
};
