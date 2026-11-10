import type { GameState } from "./model.ts";
import { addExperience } from "./stats.ts";

export type RoamingOutcome = { gold?: number; gems?: number; xp?: number; fragments?: number; damage?: number; heal?: number; chain?: string; chainEnd?: boolean };
export type RoamingChoice = { id: string; label: string; hint: string; outcome: RoamingOutcome };
export type RoamingEvent = { id: string; title: string; region: string; story: string; kind: "encounter" | "traveler" | "cache" | "omen" | "chain"; choices: RoamingChoice[]; chainId?: string; chainStage?: number };

const REGIONS = ["غابة الرماد", "سهول الزجاج", "مستنقع الهمس", "طريق الملوك", "وادي الشهب", "أطلال القمر", "مرتفعات الصقيع", "ساحل العظام", "سراديب النور", "حدود العاصفة", "بساتين الظلال", "ممرّ العمالقة"];
const SCENES = [
  { title: "أثر أقدام غريب", story: "تظهر آثار أقدام حديثة قرب صخرة مشقوقة. بعضها يتجه نحو الأشجار وبعضها يختفي عند حافة هاوية.", kind: "omen" as const },
  { title: "عربة مقلوبة", story: "عربة تاجر مقلوبة والطريق حولها مليء بصناديق متناثرة. لا يظهر صاحبها في المكان.", kind: "traveler" as const },
  { title: "صوت خلف الضباب", story: "يصل إليك نداء متقطع من خلف الضباب، ثم تسمع حركة سريعة تقترب.", kind: "encounter" as const },
  { title: "مذبح قديم", story: "مذبح حجري مغطى برموز باهتة. في وسطه قطعة متوهجة لا تزال تحتفظ بحرارتها.", kind: "cache" as const },
  { title: "مسافر متعب", story: "يعترض طريقك مسافر يحمل خريطة ممزقة ويطلب المساعدة للوصول إلى أقرب مأوى.", kind: "traveler" as const },
  { title: "صياد الكنوز", story: "شخص غريب يعرض عليك صفقة سريعة مقابل جزء من غنيمتك، لكنه يرفض كشف مصدر البضاعة.", kind: "traveler" as const },
  { title: "كمين اللصوص", story: "ثلاثة لصوص يخرجون من مخبئهم ويطالبونك بتسليم ما تحمله قبل أن تتابع الطريق.", kind: "encounter" as const },
  { title: "حارس البوابة", story: "حارس ضخم يقف أمام بوابة حجرية ويطلب منك إثبات أنك جدير بالعبور.", kind: "encounter" as const },
  { title: "صندوق مختوم", story: "صندوق صغير عليه ختم سحري. تستطيع محاولة فتحه أو تركه في مكانه.", kind: "cache" as const },
  { title: "وميض في السماء", story: "وميض أزرق يشق السماء ويسقط بعيدًا. يتبعه صدى عميق يهز الأرض تحت قدميك.", kind: "omen" as const },
  { title: "قطيع جريح", story: "تجد مخلوقات صغيرة محاصرة بين الصخور، ويبدو أن مفترسًا يراقبها من بعيد.", kind: "traveler" as const },
  { title: "حجر الذاكرة", story: "حجر أسود يعرض مشهدًا من ماضٍ لا تعرفه. لمسُه قد يكشف سرًا أو يستنزف طاقتك.", kind: "omen" as const },
  { title: "جسر متصدع", story: "جسر قديم يعبر شقًا عميقًا. الحبال مهترئة، لكن على الطرف الآخر آثار مخبأ.", kind: "cache" as const },
  { title: "وحش الحطام", story: "كتلة من الحطام تتحرك فجأة وتكشف عن وحش يحرس بقايا قافلة قديمة.", kind: "encounter" as const },
];
const VARIANTS = ["تحت ضوء القمر", "قبل هبوب العاصفة", "بعد مرور قافلة مجهولة", "في ساعة السكون", "قرب شجرة محترقة", "عند منعطف ضيق", "بين أعمدة مهدمة", "على حافة النهر", "داخل ممر صخري", "بعد سقوط نيزك", "عند بئر مهجور", "في أرض مغطاة بالرماد"];

const COMMON_CHOICES: RoamingChoice[][] = [
  [
    { id: "help", label: "ساعده", hint: "تضحي ببعض الوقت والموارد لمساعدة الغريب.", outcome: { gold: 35, xp: 45, fragments: 1, chain: "lost-cartographer" } },
    { id: "trade", label: "اعرض صفقة", hint: "تحاول تحويل الموقف إلى تبادل مفيد.", outcome: { gold: 70, xp: 20 } },
    { id: "ignore", label: "تابع طريقك", hint: "تتجنب المخاطرة وتواصل التجوال.", outcome: { xp: 12 } },
  ],
  [
    { id: "fight", label: "واجه الخطر", hint: "مكافأة أكبر مقابل مخاطرة أعلى.", outcome: { gold: 90, xp: 75, fragments: 2, damage: 12 } },
    { id: "sneak", label: "تسلل من الخلف", hint: "تعتمد على الرشاقة والحذر.", outcome: { gold: 45, xp: 55, fragments: 1 } },
    { id: "retreat", label: "انسحب", hint: "تتجنب المواجهة وتحافظ على صحتك.", outcome: { xp: 10 } },
  ],
  [
    { id: "open", label: "افتحه", hint: "قد تجد غنيمة ثمينة أو فخًا قديمًا.", outcome: { gold: 110, gems: 1, xp: 45, fragments: 2, damage: 8 } },
    { id: "study", label: "افحص الرموز", hint: "تبحث عن طريقة آمنة لفهم الختم.", outcome: { xp: 80, fragments: 2 } },
    { id: "leave", label: "اتركه", hint: "لا تخاطر بما تملكه.", outcome: { xp: 8 } },
  ],
  [
    { id: "touch", label: "المس الحجر", hint: "تقبل أثره المجهول.", outcome: { gems: 2, xp: 90, fragments: 2, damage: 18 } },
    { id: "pray", label: "تأمل بهدوء", hint: "تستعيد بعض توازنك.", outcome: { heal: 25, xp: 35, fragments: 1 } },
    { id: "break", label: "حطّمه", hint: "تحصل على ما بداخله بالقوة.", outcome: { gold: 65, fragments: 3, damage: 10 } },
  ],
];

const CHAINS = [
  { id: "lost-cartographer", name: "خرائط الملاح الضائع", stages: ["الملاح الضائع", "علامة على جذع قديم", "المعبر المخفي", "حارس الخريطة", "الجزء الأول من الأطلس", "العودة إلى الملاح"] },
  { id: "black-sail", name: "راية الشراع الأسود", stages: ["راية ممزقة", "رسالة في زجاجة", "صوت من الساحل", "مخزن القراصنة", "قائد الشراع", "كنز المد الأسود"] },
  { id: "silent-bell", name: "الجرس الصامت", stages: ["جرس بلا صوت", "أصداء تحت الأرض", "ثلاثة مفاتيح", "قاعة النبض", "ظل الحارس", "سر الجرس"] },
  { id: "ember-crown", name: "تاج الجمر", stages: ["شظية حمراء", "حداد الجبل", "فرن مهجور", "اختبار اللهب", "قلب التنين", "تاج الجمر"] },
  { id: "moon-letters", name: "رسائل القمر", stages: ["رسالة بلا توقيع", "حبر فضي", "مرصد مهجور", "ممر المرايا", "رسالة أخيرة", "وعد القمر"] },
  { id: "glass-king", name: "ملك الزجاج", stages: ["قناع زجاجي", "قصر منعكس", "خادم بلا وجه", "قاعة الشظايا", "عرش مكسور", "سقوط الملك"] },
  { id: "wanderer", name: "العابر بين العوالم", stages: ["مسافر غريب", "بوابة ناقصة", "أثر من عالم آخر", "حارس العبور", "الاختيار الأخير", "هدية العابر"] },
  { id: "red-orchard", name: "البستان الأحمر", stages: ["بذرة داكنة", "بستاني متوارٍ", "أشجار تتكلم", "جذر مسموم", "زهرة الندرة", "حصاد البستان"] },
  { id: "star-forge", name: "مطرقة النجوم", stages: ["معدن ساقط", "خريطة المنجم", "عامل المنجم", "القلب المشتعل", "المطرقة القديمة", "سلاح النجمة"] },
  { id: "hollow-mask", name: "القناع الأجوف", stages: ["قناع على الطريق", "صوت داخل القناع", "ثلاثة شهود", "مسرح الظلال", "وجه الحقيقة", "إغلاق الحكاية"] },
];

const CHAIN_STORIES = [
  "تظهر علامة جديدة تقودك إلى مكان لم يكن موجودًا على الخرائط. تشعر أن أحدهم يراقب خطواتك.",
  "تجد دليلًا صغيرًا يربط هذا المكان بالحادثة الأولى. أمامك قرار سيحدد الطريق التالي.",
  "يظهر حارس أو خصم يحاول منعك من الاقتراب من الحقيقة. يمكنك المواجهة أو البحث عن ممر بديل.",
  "تكتشف أن ما حدث لم يكن مصادفة، وأن اختيارك السابق غيّر تفاصيل هذه الحكاية.",
  "تصل إلى نقطة الحسم؛ المخاطرة كبيرة لكن الغنيمة قد تكون نادرة.",
  "تكتمل الحكاية وتترك خلفها أثرًا دائمًا في سجل رحلاتك.",
];

export const ROAMING_EVENT_COUNT = SCENES.length * VARIANTS.length + CHAINS.length * 6;
export const ROAMING_EVENT_PREVIEW = SCENES.flatMap((scene, sceneIndex) => VARIANTS.map((variant, variantIndex) => ({
  id: `roam-${sceneIndex}-${variantIndex}`,
  title: `${scene.title} — ${variant}`,
  region: REGIONS[(sceneIndex + variantIndex) % REGIONS.length],
  story: scene.story,
  kind: scene.kind,
  choices: COMMON_CHOICES[(sceneIndex + variantIndex) % COMMON_CHOICES.length],
} satisfies RoamingEvent)));

export function getRoamingEvent(state: GameState, seed = Date.now()): RoamingEvent {
  const roaming = state.roaming;
  if (roaming.activeChain && roaming.eventsCompleted > 0 && roaming.eventsCompleted % 5 === 0) {
    const chain = CHAINS.find((item) => item.id === roaming.activeChain);
    if (chain) {
      const stage = Math.min(chain.stages.length - 1, roaming.chainStage);
      return {
        id: `chain-${chain.id}-${stage}`,
        title: `${chain.stages[stage]} • ${roaming.chainRoute === "cautious" ? "مسار الحكمة" : "مسار المواجهة"}`,
        region: REGIONS[(stage * 3 + roaming.eventsCompleted) % REGIONS.length],
        story: roaming.chainRoute === "cautious"
          ? `${CHAIN_STORIES[stage]} اخترت التروي، فتكشف لك الحكاية أدلة خفية وممرات بديلة.`
          : `${CHAIN_STORIES[stage]} اخترت المواجهة، فتقودك الحكاية إلى اختبارات أشد وغنائم أعلى.`,
        kind: "chain",
        chainId: chain.id,
        chainStage: stage,
        choices: [
          { id: "press", label: "تابع التحقيق", hint: "تقترب من نهاية الحكاية.", outcome: { gold: 100 + stage * 70, xp: 90 + stage * 60, fragments: 2 + Math.floor(stage / 2), chain: chain.id, chainEnd: stage === chain.stages.length - 1 } },
          { id: "careful", label: "تقدم بحذر", hint: "تقلل المخاطر وتحصل على خبرة.", outcome: { gold: 45 + stage * 25, xp: 120 + stage * 45, fragments: 1 + Math.floor(stage / 3), chain: chain.id, chainEnd: stage === chain.stages.length - 1 } },
        ],
      };
    }
  }
  const available = ROAMING_EVENT_PREVIEW.filter((event) => !roaming.eventsSeen.includes(event.id));
  const pool = available.length ? available : ROAMING_EVENT_PREVIEW;
  const index = Math.abs(Math.floor(seed)) % pool.length;
  const scene = pool[index];
  const chainStart = CHAINS[Math.abs(Math.floor(seed / 7)) % CHAINS.length];
  const choices = scene.choices.map((choice) => ({
    ...choice,
    outcome: { ...choice.outcome, ...(choice.outcome.chain ? {} : Math.abs(Math.floor(seed / 11)) % 9 === 0 && choice.id !== "ignore" && choice.id !== "retreat" ? { chain: chainStart.id } : {}) },
  }));
  return { ...scene, choices };
}

export function resolveRoamingChoice(state: GameState, event: RoamingEvent, choiceId: string, now = Date.now()): { state: GameState; message: string } {
  const choice = event.choices.find((item) => item.id === choiceId);
  if (!choice || !state.hero) return { state, message: "هذا الاختيار غير متاح." };
  const next = JSON.parse(JSON.stringify(state)) as GameState;
  const reward = choice.outcome;
  next.gold = Math.max(0, next.gold + (reward.gold ?? 0));
  next.gems = Math.max(0, next.gems + (reward.gems ?? 0));
  next.roaming.fragments += reward.fragments ?? 0;
  next.roaming.health = Math.min(next.roaming.maxHealth, Math.max(0, next.roaming.health - (reward.damage ?? 0) + (reward.heal ?? 0)));
  if (reward.xp) { const trained = addExperience(next, reward.xp); Object.assign(next, trained.state); }
  next.roaming.eventsCompleted += 1;
  next.roaming.lastEventAt = now;
  next.roaming.eventsSeen = [...next.roaming.eventsSeen.filter((id) => id !== event.id), event.id].slice(-500);
  if (event.chainId && reward.chainEnd) {
    next.roaming.activeChain = null;
    next.roaming.chainStage = 0;
    next.roaming.chainRoute = null;
  } else if (reward.chain) {
    next.roaming.activeChain = reward.chain;
    next.roaming.chainStage = event.chainId ? (event.chainStage ?? 0) + 1 : 0;
    next.roaming.chainRoute = ["careful", "study", "sneak", "pray", "help", "trade"].includes(choice.id) ? "cautious" : "bold";
  }
  if (next.roaming.health <= 0) {
    next.roaming.health = Math.max(1, Math.floor(next.roaming.maxHealth * 0.35));
    next.gold = Math.max(0, next.gold - 25);
    return { state: next, message: "أُنهكت في الطريق؛ عدت إلى نقطة آمنة وفقدت 25 ذهبًا. استعدت جزءًا من صحتك." };
  }
  const rewards = [
    reward.gold ? `+${reward.gold} ذهب` : "",
    reward.gems ? `+${reward.gems} جوهرة` : "",
    reward.xp ? `+${reward.xp} خبرة` : "",
    reward.fragments ? `+${reward.fragments} قطعة` : "",
    reward.heal ? `استعدت ${reward.heal} صحة` : "",
    reward.damage ? `تضررت ${reward.damage} صحة` : "",
  ].filter(Boolean).join(" • ");
  return { state: next, message: rewards || "تابعت طريقك دون غنيمة." };
}

export function getTravellingMerchant(state: GameState, now = Date.now()) {
  const cycle = Math.floor(now / (6 * 60 * 60 * 1000));
  const stock = [
    { id: "fragment-pouch", name: "كيس القطع", description: "ثلاث قطع نادرة لصناعة المكافآت.", price: 180, currency: "gold" as const, fragments: 3 },
    { id: "healing-tonic", name: "إكسير المسافر", description: "يعيد 45 نقطة من صحتك في التجوال.", price: 90, currency: "gold" as const, heal: 45 },
    { id: "gem-satchel", name: "حقيبة الجواهر", description: "جوهرة واحدة مقابل قطع ثمينة.", price: 8, currency: "fragments" as const, gems: 1 },
    { id: "mystery-cache", name: "صندوق الأسرار", description: "مكافأة عشوائية من الذهب والخبرة والقطع.", price: 5, currency: "fragments" as const, gold: 220, xp: 180, fragments: 1 },
  ];
  return stock.map((item, index) => ({ ...item, stock: 1 + ((cycle + index) % 3) }));
}

export function buyMerchantItem(state: GameState, itemId: string) {
  const item = getTravellingMerchant(state).find((entry) => entry.id === itemId);
  if (!item) return { state, error: "هذا المنتج غير متاح." };
  if (item.currency === "gold" && state.gold < item.price) return { state, error: "لا تملك ذهبًا كافيًا." };
  if (item.currency === "fragments" && state.roaming.fragments < item.price) return { state, error: "لا تملك قطعًا كافية." };
  const next = JSON.parse(JSON.stringify(state)) as GameState;
  if (item.currency === "gold") next.gold -= item.price;
  else next.roaming.fragments -= item.price;
  next.roaming.fragments += item.fragments ?? 0;
  next.gems += item.gems ?? 0;
  next.gold += item.gold ?? 0;
  if (item.heal) next.roaming.health = Math.min(next.roaming.maxHealth, next.roaming.health + item.heal);
  if (item.xp && next.hero) { const trained = addExperience(next, item.xp); Object.assign(next, trained.state); }
  return { state: next };
}
