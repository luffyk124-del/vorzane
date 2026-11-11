import type { BattleMode, ClassId, EquipmentItem, StatKey } from "./model.ts";

export type CompanionRarity = "rare" | "epic" | "legendary" | "mythic";
export type Companion = { id: string; name: string; icon: string; bonus: Partial<Record<StatKey, number>>; price: number; requiredLevel: number; description: string; rarity: CompanionRarity; source: string; shopAvailable: boolean };
export const PETS: Companion[] = [
  { id: "wolf", name: "ذئب الرماد", icon: "paw", bonus: { agi: 18, vit: 10 }, price: 60_000, requiredLevel: 40, rarity: "rare", description: "رفيق سريع يحمي أطراف القوافل من مفترسات البراري.", source: "متجر الرفقاء", shopAvailable: true },
  { id: "golem", name: "حارس الصخر", icon: "shield", bonus: { def: 32, vit: 25 }, price: 115_000, requiredLevel: 45, rarity: "rare", description: "حارس حجري بطيء لكنه شديد الصمود.", source: "متجر الرفقاء", shopAvailable: true },
  { id: "fox", name: "ثعلب السراب", icon: "sparkles", bonus: { luck: 38, agi: 26 }, price: 235_000, requiredLevel: 50, rarity: "epic", description: "يتلاعب بالمسارات ويقود صاحبه إلى الفرص الخفية.", source: "متجر الرفقاء", shopAvailable: true },
  { id: "phoenix", name: "عنقاء الفجر", icon: "sunny", bonus: { vit: 62, def: 22, luck: 20 }, price: 520_000, requiredLevel: 60, rarity: "epic", description: "تجدد ناري يمنح الحيوية والثبات.", source: "متجر الرفقاء", shopAvailable: true },
  { id: "dragon", name: "تنين الياقوت", icon: "flame", bonus: { str: 65, vit: 38, def: 18 }, price: 820_000, requiredLevel: 65, rarity: "epic", description: "تنين صغير يحرس جوهرة ياقوتية قديمة.", source: "متجر الرفقاء", shopAvailable: true },
  { id: "cave-bear", name: "دب الكهوف", icon: "paw", bonus: { def: 38, vit: 42, str: 12 }, price: 165_000, requiredLevel: 48, rarity: "rare", description: "رفيق ثقيل يتحمل الضربات ويحمي صاحبه في المواجهات الطويلة.", source: "متجر الرفقاء", shopAvailable: true },
  { id: "storm-falcon", name: "صقر العاصفة", icon: "navigate", bonus: { agi: 48, luck: 24, str: 15 }, price: 360_000, requiredLevel: 55, rarity: "epic", description: "يرصد الفرص من بعيد ويمنح صاحبه سرعة ومباغتة.", source: "متجر الرفقاء", shopAvailable: true },
  { id: "crystal-serpent", name: "أفعى البلور", icon: "flash", bonus: { str: 42, luck: 34, agi: 18 }, price: 470_000, requiredLevel: 58, rarity: "epic", description: "تتبع مسارات الطاقة وتزيد دقة الهجمات.", source: "متجر الرفقاء", shopAvailable: true },
  { id: "mountain-tortoise", name: "سلحفاة الجبل", icon: "shield", bonus: { def: 76, vit: 88 }, price: 980_000, requiredLevel: 70, rarity: "epic", description: "رفيق شديد التحمل يوازن بين الدفاع والحيوية.", source: "متجر الرفقاء", shopAvailable: true },
  { id: "silver-griffin", name: "غريفون الفضة", icon: "airplane", bonus: { str: 62, def: 48, agi: 54 }, price: 1_850_000, requiredLevel: 80, rarity: "legendary", description: "حارس جوي يجمع القوة والسرعة.", source: "متجر الرفقاء", shopAvailable: true },
  { id: "frost-lynx", name: "وشق الجليد", icon: "snow", bonus: { agi: 82, vit: 48, luck: 42 }, price: 2_450_000, requiredLevel: 85, rarity: "legendary", description: "صياد نادر يرفع سرعة الحركة والحظ.", source: "متجر الرفقاء", shopAvailable: true },
  { id: "owl", name: "بومة الحكمة", icon: "eye", bonus: { luck: 58, agi: 32, vit: 18 }, price: 1_350_000, requiredLevel: 70, rarity: "legendary", description: "تقرأ حركة الخصم قبل أن يبدأ هجومه.", source: "جائزة اجتياز الطابق 75 من الديماس", shopAvailable: false },
  { id: "fairy-warden", name: "حارسة الندى", icon: "flower", bonus: { vit: 58, luck: 44, agi: 38 }, price: 2_250_000, requiredLevel: 75, rarity: "legendary", description: "حارسة قبيلة الجنيات، تحفظ عهد من أنقذها.", source: "لقاء الجنية اللاحق بعد إنقاذها في التجوال", shopAvailable: false },
  { id: "moon-deer", name: "أيل القمر", icon: "moon", bonus: { vit: 100, def: 58, luck: 28 }, price: 2_800_000, requiredLevel: 80, rarity: "legendary", description: "روح غابية تعزز الصمود وتوازن الطاقة.", source: "جائزة اجتياز الطابق 150 من الديماس", shopAvailable: false },
  { id: "star-drake", name: "تنين الشهب", icon: "star", bonus: { str: 125, luck: 72, agi: 35 }, price: 5_200_000, requiredLevel: 90, rarity: "mythic", description: "تنين سماوي يضاعف القوة والحدس.", source: "جائزة اجتياز الطابق 225 من الديماس", shopAvailable: false },
  { id: "dimas-royal-drake", name: "تنين العرش الأزلي", icon: "flame", bonus: { str: 210, def: 155, vit: 185, luck: 90 }, price: 18_000_000, requiredLevel: 100, rarity: "mythic", description: "رفيق العرش الذي لا يظهر إلا بعد إتمام الديماس.", source: "الجائزة الحصرية لاجتياز الطابق 300 من الديماس", shopAvailable: false },
  { id: "shattered-echo", name: "الــصــدى المـتـشـظّ", icon: "sparkles", bonus: { str: 320, def: 250, vit: 290, agi: 190, luck: 170 }, price: 55_000_000, requiredLevel: 120, rarity: "mythic", description: "وجود متشظٍّ لا يستجيب إلا لمن يثبت اتزانه.", source: "اجتياز اختباراته العشرة في الحدث المميز", shopAvailable: false },
];

export const STARTER_ITEMS: EquipmentItem[] = [
  { id: "sword1", name: "سيف المبتدئ", slot: "سلاح", rarity: "common", bonus: { str: 3 }, price: 100, requiredLevel: 1, icon: "flash" },

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
  { id: "astral-observatory", name: "مرصد النجوم", region: "قمم الأثير", icon: "telescope", durationSeconds: 2 * 60 * 60, rewardGold: 2_500, rewardXP: 1_200, requiredLevel: 20, difficulty: "صعب", description: "رحلة بعيدة تكشف خرائط ومقتنيات من العصور الأولى." },
  { id: "sunken-kingdom", name: "مملكة الأعماق", region: "البحر المنسي", icon: "water", durationSeconds: 4 * 60 * 60, rewardGold: 12_000, rewardXP: 5_500, requiredLevel: 40, difficulty: "نخبة", description: "استكشف أطلال مملكة غارقة وعد بمكافآت ثمينة." },
  { id: "eternal-frontier", name: "الحدود الأبدية", region: "ما وراء الخريطة", icon: "infinite", durationSeconds: 8 * 60 * 60, rewardGold: 65_000, rewardXP: 18_000, requiredLevel: 60, difficulty: "أسطوري", description: "أطول رحلات العالم؛ مكافآتها مخصصة للمستكشفين المخضرمين." },
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
  roaming: [
    { id: "roam-ogre", name: "غول الممرات", title: "مفترس الطريق", icon: "skull", tint: "#B67E70", hpScale: 1.18, attackScale: 1.12, defenseScale: 0.95, agility: 8 },
    { id: "roam-raider", name: "قاطع الطريق", title: "صياد المسافرين", icon: "swords", tint: "#C58B65", hpScale: 0.92, attackScale: 1.2, defenseScale: 0.82, agility: 16 },
    { id: "roam-wraith", name: "طيف البراري", title: "صدى الغابة", icon: "moon", tint: "#9C91D4", hpScale: 1.04, attackScale: 1.16, defenseScale: 1.12, agility: 13 },
  ],
};

export type StoryMetric = "wins" | "dungeonFloors" | "towerFloors" | "expeditions" | "level";
export const STORY_CHAPTERS = [
  { id: 1, title: "همس تحت الرماد", chapter: "الفصل الأول", narrative: "استيقظت الهاوية بعد قرون من الصمت. أثرٌ غامض يقودك إلى أول حارس.", objective: "حقق أول انتصار في القتال.", metric: "wins", target: 1, rewardGold: 120, rewardXP: 60 },
  { id: 2, title: "أختام الممر", chapter: "الفصل الثاني", narrative: "تتصدع الأختام مع كل طابق تجتازه، ويقترب صوتٌ من قلب الزنزانة.", objective: "اجتز ثلاثة طوابق في زنزانة الهاوية.", metric: "dungeonFloors", target: 3, rewardGold: 240, rewardXP: 120 },
  { id: 3, title: "برج الحراس", chapter: "الفصل الثالث", narrative: "يحرس البرج خريطةً منسية. لن يمنحك الحراس سرّها بسهولة.", objective: "اهزم حارسيْن في برج الحراس.", metric: "towerFloors", target: 2, rewardGold: 360, rewardXP: 180 },
  { id: 4, title: "خرائط الغياب", chapter: "الفصل الرابع", narrative: "تقودك الخرائط إلى أطراف العالم، حيث تختبئ بقايا مملكة الرماد.", objective: "أكمل رحلتين استكشافيتين.", metric: "expeditions", target: 2, rewardGold: 520, rewardXP: 260 },
  { id: 5, title: "قلب الكسوف", chapter: "الفصل الخامس", narrative: "اكتملت العلامات. حان وقت مواجهة القوة التي أيقظت الهاوية.", objective: "بلغ المستوى العاشر واستعد للمواجهة الأخيرة.", metric: "level", target: 10, rewardGold: 900, rewardXP: 450 },
] as const;

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
