import type { EquipmentItem, GameState } from "./model.ts";
import { PETS } from "./catalog.ts";
import { EVENT_RELICS } from "./dungeonItems.ts";
import { addExperience } from "./stats.ts";
import { createItemInstance, getDungeonDrop } from "./dungeonItems.ts";

export type RoamingOutcome = { gold?: number; gems?: number; xp?: number; damage?: number; heal?: number; chain?: string; chainEnd?: boolean; gear?: boolean; battle?: boolean; companion?: string; fairyRescue?: boolean; fairyReturn?: boolean; relic?: string; echoAction?: "trust" | "listen" | "challenge" };
export type RoamingChoice = { id: string; label: string; hint: string; outcome: RoamingOutcome };
export type RoamingEvent = { id: string; title: string; region: string; story: string; kind: "encounter" | "traveler" | "cache" | "omen" | "chain" | "merchant" | "special"; choices: RoamingChoice[]; chainId?: string; chainStage?: number };
export type RoamingMerchantItem = { id: string; name: string; description: string; price: number; currency: "gold"; stock: number; gearTemplate?: EquipmentItem; heal?: number; gems?: number; gold?: number; xp?: number };

export type RoamingArchiveEntry = { id: string; title: string; region: string; cost: number; summary: string; story: string };
export const ROAMING_ARCHIVE_ENTRIES: RoamingArchiveEntry[] = [
  { id: "first-map", title: "سجل الملاح الأول", region: "طريق الملوك", cost: 3, summary: "كيف رُسمت أول خريطة للممرات القديمة.", story: "لم تكن خريطة الملاح الأول ترسم الطرق كما تبدو للعين، بل كما تتذكرها الأرض. كتب في هامشها: «إذا اختفى الطريق، ابحث عن العلامة التي تركها المسافرون لبعضهم». ولهذا بقيت خرائطه نافعة حتى بعد تغيّر المعالم." },
  { id: "moon-observatory", title: "رسالة مرصد القمر", region: "أطلال القمر", cost: 5, summary: "رسالة فلكي ترك نافذة مفتوحة للسماء.", story: "يشرح الفلكي أن النجوم لا تشير إلى كنز، بل إلى مواسم عودة الطيور ومواعيد امتلاء الينابيع. وفي آخر الرسالة يعتذر لأنه أمضى عمره يراقب السماء ونسي أن يرفع عينيه إلى من ينتظرونه عند الباب." },
  { id: "red-orchard", title: "حكاية البستان الأحمر", region: "بساتين الظلال", cost: 8, summary: "سرّ البستان الذي استعاد لونه بعد سنوات من الذبول.", story: "كان البستان يُروى بماء نبع واحد، وحين انسد مجراه جفّت الجذور وتحوّلت الأوراق إلى الحمرة. لم يُنقذ المكان سحرٌ عظيم؛ بل أعاد أهل القرية تنظيف القنوات وزراعة البذور التي احتفظوا بها جيلاً بعد جيل." },
  { id: "silent-bell", title: "نقش الجرس الصامت", region: "سراديب النور", cost: 12, summary: "نقش يشرح لماذا لا يرن الجرس إلا عند اجتماع الغرباء.", story: "صُنع الجرس ليجمع المسافرين لا ليحذرهم. لا يصدر صوتاً حين يلمسه شخص واحد، لكنه يرن عندما يقف عنده اثنان من طريقين مختلفين. أراد صانعه أن يتذكر الناس أن المعرفة تكتمل بالمشاركة." },
  { id: "black-sail", title: "دفتر قافلة الشراع", region: "ساحل العظام", cost: 16, summary: "دفتر بحّارة كانوا يرسمون أسماء الموانئ التي ساعدتهم.", story: "تسجل الصفحات أسماء مرافئ صغيرة لا تظهر على الخرائط الرسمية. بجانب كل اسم ملاحظة عن شخص قدّم الماء أو أصلح شراعاً أو دلّ قافلة على الطريق. لم يعتبر البحّارة تلك الأعمال ديوناً، بل روابط تحفظ العالم متصلاً." },
  { id: "shard-covenant", title: "ميثاق الشظايا", region: "وادي الشهب", cost: 22, summary: "الحكاية التي تفسّر أصل شظايا الأثر.", story: "تقول الحكاية إن الشظايا بقايا مرآة قديمة كانت تحفظ صور الأماكن قبل أن تتغير. جمعها الرحالة الأوائل لا ليعيدوا المرآة، بل ليحفظوا حكايات الناس والأماكن. وكل شظية تُفتح اليوم تعيد جزءاً من تلك الذاكرة إلى النور." },
];

export function unlockRoamingArchiveEntry(state: GameState, entryId: string): { state: GameState; error?: string; entry?: RoamingArchiveEntry } {
  const entry = ROAMING_ARCHIVE_ENTRIES.find((item) => item.id === entryId);
  if (!entry) return { state, error: "صفحة الأرشيف غير موجودة." };
  if (!state.hero) return { state, error: "أنشئ شخصيتك أولاً." };
  const flag = `archive:${entry.id}`;
  if (state.roaming.storyFlags.includes(flag)) return { state, error: "فتحت هذه الصفحة من قبل." };
  if (state.roaming.fragments < entry.cost) return { state, error: "لا تملك شظايا أثر كافية." };
  const next = JSON.parse(JSON.stringify(state)) as GameState;
  next.roaming.fragments -= entry.cost;
  next.roaming.storyFlags = [...new Set([...next.roaming.storyFlags, flag])].slice(-100);
  return { state: next, entry };
}


const COMPANION_EVENT_BANK = [
  { petId: "wolf", kind: "encounter" as const, title: "ذئب الرماد الجريح", region: "ممرّ الصنوبر", story: "تجد ذئبًا رماديًا مصابًا قرب آثار قطيع مفترس. لا يهاجمك، لكنه يراقب يديك بحذر، وعلى عنقه أثر طوق قديم.", choices: [
    { id: "treat", label: "عالج جرحه وأبعد المفترسات", hint: "تخاطر بوقتك لتكسب ثقته.", outcome: { xp: 220, companion: "wolf" } },
    { id: "leave", label: "اترك له الطعام وانسحب", hint: "تساعده دون أن تقترب.", outcome: { xp: 90, gold: 70 } },
  ] },
  { petId: "golem", kind: "cache" as const, title: "قلب الحارس الحجري", region: "مقلع الحراس", story: "تجد تمثالًا حجريًا متشققًا يحرس بوابة منسية. في صدره نواة خامدة، وعلى الأرض نقوش إصلاح قديمة.", choices: [
    { id: "restore", label: "أعد تثبيت النواة", hint: "تحتاج إلى الصبر وفهم النقوش.", outcome: { xp: 280, companion: "golem" } },
    { id: "take", label: "اجمع شظايا الحجر", hint: "مكسب سريع دون إيقاظ الحارس.", outcome: { gold: 240, xp: 80 } },
  ] },
  { petId: "fox", kind: "traveler" as const, title: "صفقة ثعلب السراب", region: "سهول الزجاج", story: "يظهر ثعلب بلون الرمال ويحمل في فمه مفتاحًا فضيًا. يقودك إلى صندوق صغير ثم ينتظر ليرى إن كنت ستفي بوعدك.", choices: [
    { id: "share", label: "شاركه الغنيمة", hint: "تختار الوفاء بالاتفاق.", outcome: { xp: 340, companion: "fox" } },
    { id: "keep", label: "احتفظ بالصندوق لنفسك", hint: "تربح بعض الذهب لكن الثعلب يختفي.", outcome: { gold: 320, xp: 75 } },
  ] },
  { petId: "phoenix", kind: "omen" as const, title: "رماد العنقاء", region: "فوهة الفجر", story: "تجد عشًا متفحمًا تتوهج في وسطه جمرة لا تنطفئ. تحوم فوقها طيور سوداء وتنتظر أن تبتعد.", choices: [
    { id: "shield", label: "احمِ الجمرة حتى تفقس", hint: "تتحمل حرارة المكان حتى يظهر أثرها.", outcome: { xp: 460, damage: 14, companion: "phoenix" } },
    { id: "collect", label: "اجمع الرماد المتوهج", hint: "تحصل على مادة نادرة وتغادر.", outcome: { gold: 450, xp: 120 } },
  ] },
  { petId: "dragon", kind: "cache" as const, title: "بيضة تنين الياقوت", region: "كهف الياقوت", story: "بين بلورات حمراء تجد بيضة تنبض بضوء خافت. آثار المخالب حولها حديثة، ويبدو أن الحارس قد يعود في أي لحظة.", choices: [
    { id: "guard", label: "احرس البيضة حتى تفقس", hint: "تختار حماية المخلوق بدل الاستيلاء على جوهره.", outcome: { xp: 520, damage: 18, companion: "dragon" } },
    { id: "retreat", label: "ابتعد عن العش", hint: "تتفادى مواجهة الحارس.", outcome: { xp: 140, gold: 180 } },
  ] },
] satisfies { petId: string; kind: "encounter" | "cache" | "traveler" | "omen"; title: string; region: string; story: string; choices: RoamingChoice[] }[];

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
const SCENE_DETAILS = [
  "تلاحظ أن التراب حول الأثر مضغوط حديثًا، وأن صاحب الخطوات عاد إلى المكان أكثر من مرة. هناك شيء ما يحاول إخفاء اتجاهه الحقيقي.",
  "بعض الصناديق تحمل ختم نقابة التجار، بينما الآخر مفتوح من الداخل. عجلات العربة لم تنكسر وحدها؛ يبدو أن صاحبها غادر على عجل.",
  "يتكرر النداء ثلاث مرات، لكن مصدره يتغير في كل مرة. تلمح حركة بين الضباب ثم يسود صمت غير طبيعي.",
  "الرموز على المذبح ليست للزينة؛ إنها سجلّ لقرابين قديمة. الضوء يزداد كلما اقتربت، وكأن المكان يستجيب لوجودك.",
  "المسافر يضغط على جرح في ذراعه ويخفي نصف الخريطة. يشرح أن الطريق إلى المأوى تغيّر بعد انهيار الجسر، ويطلب منك ألا تثق بالعلامات الحمراء.",
  "يعرض صياد الكنوز بضاعة نظيفة أكثر مما ينبغي لشخص يعيش في البراري. يراقب حقيبتك باستمرار، ويبدو مستعدًا لتغيير شروط الصفقة.",
  "اللصوص لا يهاجمون فورًا؛ أحدهم يفاوضك بينما يحاول آخر الالتفاف خلفك. يبدو أنهم يعرفون شيئًا عن الطريق الذي تسلكه.",
  "الحارس لا يتحرك من مكانه، لكنه يذكر اسم معلم تجاوزته قبل ساعات. الاختبار الذي يطلبه يبدو مرتبطًا بما فعلته في رحلتك.",
  "الختم يحمل طبقتين من الشمع، وتحت الأولى نقش لعائلة اختفت منذ زمن. تسمع حركة خفيفة داخل الصندوق كلما ابتعدت عنه.",
  "الوميض ترك وراءه حفرة زجاجية وحجارة دافئة. آثار أقدام صغيرة تحيط بالموقع، لكن لا توجد آثار عودة.",
  "المخلوقات لا تقترب منك رغم خوفها؛ أحدها يعرج، والآخر يحرس جحرًا ضيقًا. المفترس يراقبك وينتظر أن تنشغل بها.",
  "الحجر يعرض ذكرى ليست لك، لكن الشخص الظاهر فيها يرتدي شارة مألوفة. كلما أطلت النظر، بدأت التفاصيل تتغير.",
  "ألواح الجسر تتحرك مع الريح، وعلى الجانب الآخر حبل مربوط بصندوق صغير. هناك طريق أطول يبدو أكثر أمانًا، لكنه يمر قرب آثار وحش.",
  "الحطام يتحرك كأنه يتنفس، ثم تنفصل منه أطراف معدنية قديمة. خلف الوحش بقايا قافلة، وبعض الصناديق ما زالت تحمل أقفالها."
];
const SCENE_CHOICES: RoamingChoice[][] = [
  [
    { id: "follow-fresh", label: "اتبع الأثر الأحدث", hint: "تتعقب الخطوات التي لم تطمسها الرياح بعد.", outcome: { xp: 65, gold: 35, chain: "lost-cartographer" } },
    { id: "compare-marks", label: "قارن العلامات عند الصخرة", hint: "تبحث عن الرابط بين المسارين قبل أن تختار.", outcome: { xp: 95, gems: 1 } },
    { id: "mark-trail", label: "علّم الموقع وتراجع للمراقبة", hint: "تحتفظ بمعلومة دقيقة للعودة إليها.", outcome: { xp: 35, heal: 8 } },
  ],
  [
    { id: "sort-cargo", label: "رتّب الصناديق وافحص الأختام", hint: "تبحث عن البضاعة التي بقيت سليمة.", outcome: { gold: 105, xp: 55 } },
    { id: "follow-wheels", label: "اتبع آثار العجلات إلى المنحدر", hint: "تبحث عن سبب انقلاب العربة وصاحبها.", outcome: { xp: 100, gold: 30, chain: "lost-cartographer" } },
    { id: "leave-supplies", label: "اترك مؤونة لصاحب العربة", hint: "تساعد الغائب وتواصل طريقك.", outcome: { xp: 45, heal: 12 } },
  ],
  [
    { id: "answer-call", label: "أجب عن النداء بإشارة واضحة", hint: "تمنح صاحب الصوت فرصة لتحديد موقعه.", outcome: { xp: 85, gold: 35 } },
    { id: "ring-bell", label: "استخدم الجرس لتحديد مصدر الصدى", hint: "تقارن اتجاهات الصوت قبل الاقتراب.", outcome: { xp: 115, gems: 1 } },
    { id: "open-path", label: "اسلك الممر المكشوف وانتظر", hint: "تختار طريقًا واضحًا بدل الضباب.", outcome: { xp: 45, heal: 10 } },
  ],
  [
    { id: "read-offerings", label: "اقرأ سجل القرابين المنقوش", hint: "تفك رموز الطقوس وتاريخ المذبح.", outcome: { xp: 125, gold: 25 } },
    { id: "stabilize-shard", label: "ثبّت الشظية في تجويفها", hint: "تعيد التوازن إلى الضوء المتذبذب.", outcome: { xp: 85, gems: 2, damage: 5 } },
    { id: "leave-offering", label: "ضع قربانًا واترك المذبح", hint: "تحترم المكان دون أخذ ما فيه.", outcome: { xp: 55, heal: 15 } },
  ],
  [
    { id: "read-map", label: "افرد الخريطة وحدد الطريق البديل", hint: "تساعده على فهم العلامات التي اختلطت عليه.", outcome: { xp: 105, gold: 45, chain: "lost-cartographer" } },
    { id: "share-rations", label: "شاركه المؤونة حتى يستعيد قوته", hint: "تمنحه ما يحتاجه لإكمال الطريق.", outcome: { xp: 75, heal: 20 } },
    { id: "guide-shelter", label: "أرشده إلى مأوى قريب", hint: "توصله إلى مكان آمن ثم تتابع رحلتك.", outcome: { xp: 55, gold: 25 } },
  ],
  [
    { id: "inspect-goods", label: "افحص مصدر البضاعة قبل التفاوض", hint: "تتحقق من العلامات وتكشف القطع المشبوهة.", outcome: { xp: 90, gold: 65 } },
    { id: "trade-rumor", label: "بادل معلومة عن الطريق بقطعة نادرة", hint: "تحصل على فائدة واضحة من الصفقة.", outcome: { xp: 70, gems: 1 } },
    { id: "decline-hunter", label: "ارفض الصفقة واطلب منه الابتعاد", hint: "تنهي اللقاء دون إنفاق مواردك.", outcome: { xp: 35, heal: 8 } },
  ],
  [
    { id: "negotiate-toll", label: "فاوضهم على عبور الطريق", hint: "تحاول إنهاء الموقف باتفاق واضح.", outcome: { gold: 95, xp: 80 } },
    { id: "find-detour", label: "اكشف لهم الممر الجانبي", hint: "تستغل معرفتك بالمكان لتفادي التوتر.", outcome: { xp: 110, gold: 35 } },
    { id: "leave-ambush", label: "انسحب إلى الطريق المفتوح", hint: "تختار الابتعاد وتحافظ على مواردك.", outcome: { xp: 25, heal: 10 } },
  ],
  [
    { id: "answer-riddle", label: "أجب عن لغز البوابة", hint: "تثبت معرفتك بتاريخ المنطقة.", outcome: { xp: 125, gold: 55 } },
    { id: "show-emblem", label: "أرِه الشارة التي وجدتها", hint: "تربط الشارة بالاسم الذي ذكره الحارس.", outcome: { xp: 95, gems: 1, chain: "silent-bell" } },
    { id: "ask-another-way", label: "اطلب منه دليلًا إلى مدخل آخر", hint: "تبحث عن عبور يناسب ما تعرفه.", outcome: { xp: 55, heal: 12 } },
  ],
  [
    { id: "peel-seal", label: "افصل طبقات الختم بالترتيب", hint: "تتعامل مع الشمع دون إتلاف النقش.", outcome: { gold: 100, xp: 80, gems: 1 } },
    { id: "solve-inscription", label: "حل نقش العائلة أولًا", hint: "تبحث عن اسم صاحب الصندوق قبل فتحه.", outcome: { xp: 135, chain: "hollow-mask" } },
    { id: "leave-chest", label: "اترك الصندوق في موضعه", hint: "تحترم الختم وتغادر دون مخاطرة.", outcome: { xp: 30, heal: 8 } },
  ],
  [
    { id: "trace-crater", label: "تتبع مسار الوميض إلى الحفرة", hint: "تبحث عن نقطة السقوط وما تركه الضوء.", outcome: { xp: 110, gold: 55 } },
    { id: "collect-fragments", label: "اجمع الشظايا الزجاجية المتناثرة", hint: "تلتقط القطع التي بردت بالفعل.", outcome: { gems: 2, xp: 75, damage: 4 } },
    { id: "mark-crater", label: "سجّل موقع الحفرة وابتعد", hint: "تحفظ الموقع للباحثين دون الاقتراب.", outcome: { xp: 50, heal: 12 } },
  ],
  [
    { id: "lead-herd", label: "افتح للقطيع ممرًا نحو الماء", hint: "تساعد المخلوقات على الخروج من الحصار.", outcome: { xp: 115, gold: 35 } },
    { id: "treat-young", label: "عالج المخلوق الصغير واتركه مع القطيع", hint: "تعتني بالأضعف قبل متابعة الطريق.", outcome: { xp: 95, heal: 20 } },
    { id: "leave-feed", label: "اترك طعامًا قرب الجحر", hint: "تساعد من مسافة آمنة.", outcome: { xp: 45, gold: 20 } },
  ],
  [
    { id: "focus-memory", label: "ركّز على الشارة داخل الذكرى", hint: "تتبع التفصيل الذي يتكرر في المشهد.", outcome: { xp: 130, gems: 1 } },
    { id: "question-echo", label: "اسأل الصدى عن صاحب الذكرى", hint: "تحاول فهم الصوت بدل لمس الحجر.", outcome: { xp: 100, chain: "moon-letters" } },
    { id: "step-away", label: "ابتعد واترك الحجر ساكنًا", hint: "تنهي الرؤية قبل أن تستنزف طاقتك.", outcome: { xp: 35, heal: 15 } },
  ],
  [
    { id: "secure-ropes", label: "ثبّت الحبال قبل العبور", hint: "تزيد ثبات الألواح وتقلل اهتزازها.", outcome: { xp: 105, gold: 45 } },
    { id: "cross-boards", label: "اعبر فوق الألواح الأقرب إلى الدعائم", hint: "تختار المسار الأقصر بعد فحصه.", outcome: { xp: 75, gems: 1, damage: 5 } },
    { id: "long-route", label: "اسلك الطريق الطويل حول الشق", hint: "تتجنب الجسر وتصل من جهة أخرى.", outcome: { xp: 55, heal: 12 } },
  ],
  [
    { id: "draw-scrap-beast", label: "اجذب المخلوق بعيدًا عن القافلة", hint: "تفتح مجالًا للوصول إلى الصناديق.", outcome: { xp: 105, gold: 70 } },
    { id: "recover-ledger", label: "استعد سجل القافلة من بين الحطام", hint: "تبحث عن وثائق أصحاب البضاعة.", outcome: { xp: 125, gems: 1, chain: "black-sail" } },
    { id: "leave-wreck", label: "اترك القافلة وابحث عن طريق آمن", hint: "تبتعد عن الموقع دون خسارة إضافية.", outcome: { xp: 30, heal: 10 } },
  ],
];const SCENE_RESULTS: string[][] = [
  ["تتبعت الأثر حتى وصل إلى علامة ملاح قديمة محفورة أسفل الصخرة. أصبح لديك اتجاه واضح للخطوة التالية.", "قارنت العلامات واكتشفت أن المسارين يلتقيان عند شجرة تحمل نقشًا مماثلًا. احتفظت بالمعلومة في خريطتك.", "وضعت علامة عند الصخرة وراقبت المكان من بعيد؛ لاحظت أن الأثر يتجه نحو الممر الشمالي."],
  ["فرزت الصناديق وعثرت على بضاعة سليمة تحمل ختم النقابة، فجمعتها قبل أن تتابع الطريق.", "اتبعت آثار العجلات حتى المنحدر، وهناك وجدت جزءًا من خريطة صاحب العربة يقود إلى معبر مخفي.", "تركت المؤونة قرب العربة، وبعد قليل ظهرت آثار عودة صاحبها إلى المكان. غادرت مطمئنًا."],
  ["أجبت عن النداء، فجاءك الرد من خلف صخرة قريبة وظهرت علامة تدل على مصدر الصوت.", "استخدمت رنين الجرس لمقارنة الصدى وحددت ممرًا جانبيًا يقود إلى مصدر النداء.", "اخترت الممر المكشوف وانتظرت حتى هدأ الضباب؛ ظهر الطريق أمامك بوضوح."],
  ["قرأت سجل القرابين واكتشفت أن الشظية جزء من ختم قديم يحمي المذبح.", "أعدت الشظية إلى تجويفها، فاستقر الضوء وانكشف نقش صغير أسفلها.", "وضعت قربانًا بسيطًا وأغلقت المذبح؛ خفت الضوء وبقي المكان ساكنًا."],
  ["راجعت الخريطة معه وحددتما طريقًا بديلًا يتجاوز الجسر المنهار. أشار لك إلى علامة الملاح الضائع.", "تقاسم المسافر المؤونة واستعاد قوته، ثم أعطاك نسخة من العلامات التي تقود إلى المأوى.", "أرشدته إلى المأوى القريب، وترك لك علامة على الخريطة لتجنب الطريق المنهار."],
  ["كشفت الأختام أن بعض البضاعة لا تخص الصياد؛ عدّل عرضه بعد أن عرف أنك انتبهت لذلك.", "أتممت الصفقة مقابل معلومة دقيقة عن الطريق، وأضاف الصياد علامة إلى خريطتك.", "رفضت العرض، فجمع الصياد بضاعته وغادر دون أن يطيل الحديث."],
  ["قبل اللصوص التفاوض على العبور، وتركوا لك الطريق مقابل جزء من المؤونة.", "كشفت الممر الجانبي، فتراجع التوتر واختاروا طريقًا آخر بعيدًا عن القافلة.", "ابتعدت عن الموقع حتى عاد الطريق هادئًا، ثم تابعت رحلتك من المسار المفتوح."],
  ["أجبت عن اللغز، فارتفعت بوابة الحجر وكُشف نقش يشرح تاريخ المكان.", "تعرّف الحارس على الشارة وفتح لك البوابة، ثم أشار إلى رمز الجرس الصامت.", "دلّك الحارس على مدخل جانبي يمر خلف الأعمدة ويصل إلى الجهة الأخرى."],
  ["فصلت طبقات الختم دون إتلافه، ووجدت داخل الصندوق سجلًا يحمل اسم العائلة المفقودة.", "حللت النقش وربطت الاسم برسالة قديمة؛ بدا أن القناع الأجوف جزء من الحكاية نفسها.", "تركت الصندوق مغلقًا وأعدته إلى موضعه، ثم غادرت المكان."],
  ["اتبعت مسار الوميض حتى الحفرة، وعثرت على أثر دائري يشير إلى نقطة سقوط الشظية.", "جمعت الشظايا الباردة، ولاحظت أن نقوشها تتطابق مع علامات أطلال القمر.", "سجلت موقع الحفرة على خريطتك وابتعدت قبل أن تتغير حرارة الأرض."],
  ["فتحت للقطيع ممرًا نحو الماء، فابتعدت المخلوقات الصغيرة عن الصخور وتفرّق المفترس.", "عالجت المخلوق المصاب، فعاد إلى القطيع وترك لك أثرًا يقود إلى موطنه.", "تركت الطعام قرب الجحر، وبعد أن ابتعدت بدأت المخلوقات تخرج واحدًا تلو الآخر."],
  ["ثبتت الشارة في ذاكرتك، فتغير المشهد وكشف اسمًا مرتبطًا برسائل القمر.", "أجاب الصدى باسم لم تسمعه من قبل، ثم أضاءت علامة تقود إلى مرصد مهجور.", "ابتعدت عن الحجر، فعادت الصورة إلى السكون وبقيت الشارة محفورة في ذاكرتك."],
  ["ثبّت الحبال واجتزت الجسر بثبات؛ على الطرف الآخر وجدت صندوقًا يحمل ختم قافلة قديمة.", "عبرت فوق الألواح القريبة من الدعائم، وعثرت على علامة تؤكد أن أحدهم مر من هنا مؤخرًا.", "سلكت الطريق الطويل ووصلت إلى الطرف الآخر دون الاقتراب من الجسر المتصدع."],
  ["أبعدت المخلوق عن القافلة، فتمكنت من الوصول إلى الصناديق واستعادة بعض محتوياتها.", "استعدت سجل القافلة من بين الحطام، وكشف السجل اسم سفينة تحمل راية الشراع الأسود.", "تركت الموقع خلفك واخترت طريقًا آمنًا بعيدًا عن الحطام المتحرك."]
];

const VARIANTS = ["تحت ضوء القمر", "قبل هبوب العاصفة", "بعد مرور قافلة مجهولة", "في ساعة السكون", "قرب شجرة محترقة", "عند منعطف ضيق", "بين أعمدة مهدمة", "على حافة النهر", "داخل ممر صخري", "بعد سقوط نيزك", "عند بئر مهجور", "في أرض مغطاة بالرماد"];

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
  "تظهر علامة جديدة تقودك إلى مكان لم يكن موجودًا على الخرائط. تقودك التفاصيل إلى خطوة تالية في الحكاية.",
  "تجد دليلًا صغيرًا يربط هذا المكان بالحادثة الأولى. يتضح أن قرارك السابق ترك أثرًا هنا.",
  "تصل إلى معلم يحفظ جزءًا من الحقيقة، وتحتاج إلى فهم الإشارة قبل متابعة الطريق.",
  "تكشف الأدلة أن ما حدث لم يكن مصادفة؛ تتضح الآن صلة هذا المكان ببداية الحكاية.",
  "تصل إلى آخر موضع ناقص في الرواية، وتقترب من جمع الأجزاء المتفرقة.",
  "تكتمل الحكاية وتظهر الصلة بين أول دليل وآخره، وتغلق الرحلة على نتيجتها."
];

const CHAIN_STAGE_ACTIONS: Record<string, string[][]> = {
  "lost-cartographer": [["اقرأ دفتر الملاح", "اتبع العلامة على الخريطة"], ["افحص النقش على الجذع", "قارن اتجاه الظلال"], ["اعبر المعبر المخفي", "ابحث عن طريق النهر"], ["استمع إلى حارس الخريطة", "قدّم له العلامة القديمة"], ["رتّب صفحات الأطلس", "طابق أطراف الخريطة"], ["أعد الأطلس إلى الملاح", "احتفظ بنسخة من المسار"]],
  "black-sail": [["ارفع الراية الممزقة", "افحص الخيط البحري"], ["افتح الرسالة بحذر", "طابق ختم الزجاجة"], ["اتبع صدى الساحل", "راقب حركة المد"], ["فتش مخزن القافلة", "ابحث عن سجل الشحن"], ["اسأل قائد الشراع عن الختم", "اعرض عليه الرسالة"], ["استعد الصندوق الأخير", "أغلق سجل الرحلة"]],
  "silent-bell": [["افحص الجرس الصامت", "ابحث عن موضع اللسان"], ["تتبع الأصداء إلى الأسفل", "قارن النغمات الثلاث"], ["اجمع المفاتيح الثلاثة", "طابق رموز المفاتيح"], ["افتح قاعة النبض", "استمع إلى الإيقاع"], ["اقرأ نقش ظل الحارس", "أعد ترتيب العلامات"], ["أعد النغمة إلى الجرس", "احتفظ بسر الجرس"]],
  "ember-crown": [["افحص الشظية الحمراء", "قارنها بآثار الفرن"], ["ابحث عن الحداد", "اعرض عليه المعدن"], ["أعد تشغيل الفرن القديم", "نظف مجرى الهواء"], ["وازن حرارة اللهب", "اتبع نقش الحداد"], ["افحص قلب التنين", "استمع إلى نبضه"], ["أكمل تاج الجمر", "سلّم التاج إلى الحداد"]],
  "moon-letters": [["افتح الرسالة بلا توقيع", "افحص أثر الحبر"], ["اختبر الحبر الفضي", "طابق شكل الختم"], ["اصعد إلى المرصد", "أعد ضبط العدسة"], ["اعبر ممر المرايا", "اتبع الانعكاس الصحيح"], ["اقرأ الرسالة الأخيرة", "قارنها بالرسالة الأولى"], ["أرسل وعد القمر", "احتفظ بالرسائل مجموعة"]],
  "glass-king": [["افحص القناع الزجاجي", "تتبع انعكاسه"], ["ادخل القصر المنعكس", "ابحث عن الباب الحقيقي"], ["اسأل الخادم عن اسمه", "راقب ما لا يعكسه"], ["رتب شظايا القاعة", "طابق ألوان الزجاج"], ["افحص العرش المكسور", "اجمع أجزاء النقش"], ["أغلق حكاية الملك", "احفظ القناع في مكانه"]],
  "wanderer": [["اسأل المسافر عن موطنه", "افحص خريطته الغريبة"], ["أكمل شكل البوابة", "ابحث عن القطعة الناقصة"], ["قارن أثر العالم الآخر", "سجّل اختلاف العلامات"], ["استمع إلى حارس العبور", "اعرض عليه الرمز"], ["اختر وجهة العابر", "اطلب منه كشف الطريق"], ["ودّع العابر بعهد", "احتفظ بعلامة البوابة"]],
  "red-orchard": [["ازرع البذرة الداكنة", "افحص تربتها"], ["ابحث عن البستاني", "اتبع أثر أدواته"], ["أنصت إلى الأشجار", "قارن همسات الأغصان"], ["نقِّ الجذر من السم", "اعثر على مصدر الماء"], ["اقطف زهرة الندرة", "احفظ بذورها"], ["أعد الحياة إلى البستان", "اجمع حصاد الموسم"]],
  "star-forge": [["افحص المعدن الساقط", "قارن لمعانه بالنجوم"], ["ارسم خريطة المنجم", "اتبع عروق المعدن"], ["اسأل عامل المنجم", "اعرض عليه الشظية"], ["وازن حرارة القلب", "رتب أدوات الفرن"], ["استعد المطرقة القديمة", "اقرأ نقش المقبض"], ["أكمل سلاح النجمة", "أعد المطرقة إلى موضعها"]],
  "hollow-mask": [["ارفع القناع عن الطريق", "افحص النقش خلفه"], ["أنصت للصوت داخل القناع", "اسأله عن الاسم"], ["اجمع روايات الشهود", "قارن التفاصيل المتناقضة"], ["افتح ستارة مسرح الظلال", "افحص المقاعد الخالية"], ["اكشف وجه الحقيقة", "طابق الشهادة الأخيرة"], ["أغلق الحكاية وأعد القناع", "احتفظ بسجل الشهود"]]
};

export const ROAMING_EVENT_COUNT = SCENES.length * VARIANTS.length + CHAINS.length * 6;
export const ROAMING_EVENT_PREVIEW = SCENES.flatMap((scene, sceneIndex) => VARIANTS.map((variant, variantIndex) => ({
  id: `roam-${sceneIndex}-${variantIndex}`,
  title: `${scene.title} — ${variant}`,
  region: REGIONS[(sceneIndex + variantIndex) % REGIONS.length],
  story: `${scene.story} ${SCENE_DETAILS[sceneIndex]}`,
  kind: scene.kind,
  choices: SCENE_CHOICES[sceneIndex],
} satisfies RoamingEvent)));

export function getRoamingEvent(state: GameState, seed = Date.now()): RoamingEvent {
  const roaming = state.roaming;
  if (roaming.echoStarted) {
    const stage = Math.min(9, roaming.echoStage);
    const routeOffset = roaming.echoRoute === "trust" ? 0 : roaming.echoRoute === "listen" ? 1 : roaming.echoRoute === "challenge" ? 2 : 0;
    const expected = (["listen", "trust", "listen", "challenge", "trust", "listen", "challenge", "trust", "listen", "trust"] as const)[(stage + routeOffset) % 10];
    const stories = [
      "تتحرك شظية وحيدة فوق الأرض، ثم تستقر قرب أثر خطوات قديمة.",
      "يعود الوميض من جهة مختلفة، وكأن المكان يتذكر قرارك السابق.",
      "تسمع نغمة قصيرة تتكرر، لكن صداها يتغير كلما اقتربت.",
      "تنفتح فجوة ضيقة بين الصخور وتظهر خلفها علامة غير مكتملة.",
      "تتجمع الشظايا للحظة، ثم تتباعد في ثلاثة اتجاهات.",
      "يخفت الضوء وتبقى علامة واحدة مضيئة قرب الممر.",
      "يتردد صوت مألوف من خلف الجدار، ولا يظهر صاحبه.",
      "تتحرك الظلال على الأرض وفق ترتيب يشبه اختياراتك السابقة.",
      "يصبح الهواء ساكنًا، وتقترب الشظايا من بعضها للمرة الأولى.",
      "يخفت كل شيء إلا الوميض الذي ينتظر قرارك.",
    ];
    return { id: `shattered-echo-${stage}`, title: "أثر الشظايا", region: REGIONS[(stage * 3 + roaming.eventsCompleted) % REGIONS.length], story: stories[stage] + (roaming.echoRoute ? " يتغير المشهد استجابةً لما اخترته سابقًا." : ""), kind: "special", choices: [
      { id: "trust", label: "اقترب بثبات", hint: "تمنح الإشارة فرصة دون استعجال.", outcome: { xp: 180 + stage * 14, echoAction: "trust" } },
      { id: "listen", label: "أنصت إلى النبض", hint: "تحاول قراءة الإيقاع قبل التحرك.", outcome: { xp: 170 + stage * 12, heal: 4, echoAction: "listen" } },
      { id: "challenge", label: "واجه الاضطراب", hint: "تختبر ثباتك أمام القوة الغامضة.", outcome: { xp: 210 + stage * 15, damage: 7 + stage, echoAction: "challenge" } },
    ] };
  }
  if (state.hero && state.hero.level >= 100 && !state.pets.includes("shattered-echo") && seed >= roaming.echoNextAt && Math.abs(Math.floor(seed / 1000)) % 211 === 0) {
    return { id: "shattered-echo-awakening", title: "وميض لا يشبه سواه", region: REGIONS[Math.abs(Math.floor(seed / 13)) % REGIONS.length], story: "ينشق الصمت عن وميض متقطع. تتحرك شظايا صغيرة في الهواء كأنها تتبع إيقاعًا لا تسمعه سواك.", kind: "special", choices: [
      { id: "trust", label: "اقترب من الوميض", hint: "تقترب دون أن تعرف ما ينتظرك.", outcome: { xp: 130, echoAction: "trust" } },
      { id: "listen", label: "أنصت إلى النبض", hint: "تحاول فهم الإيقاع أولًا.", outcome: { xp: 150, echoAction: "listen" } },
      { id: "challenge", label: "اختبر قوته", hint: "تواجه الظاهرة بدل الابتعاد عنها.", outcome: { xp: 160, damage: 10, echoAction: "challenge" } },
    ] };
  }
  if (roaming.storyFlags.includes("fairy-rescued") && !roaming.fairyReunited && roaming.fairyNextAt > 0 && seed >= roaming.fairyNextAt && roaming.eventsCompleted >= 4) {
    return { id: "fairy-reunion", title: "أثر يعرفك", region: "غابة الندى", story: "تظهر الجنية التي أنقذتها من قطيع الغيلان، وتدعوك إلى موطن قبيلتها. يفتح أفراد القبيلة الطريق أمامك ويقدمون لك عهدًا قديمًا.", kind: "traveler", choices: [
      { id: "follow", label: "اتبعها إلى موطن القبيلة", hint: "تقبل دعوتها وتكمل المعروف.", outcome: { xp: 520, gold: 800, companion: "fairy-warden", fairyReturn: true } },
      { id: "farewell", label: "ودّعها وتابع طريقك", hint: "تكتفي بالاطمئنان عليها.", outcome: { xp: 240, fairyReturn: true } },
    ] };
  }
  if (!roaming.storyFlags.includes("fairy-rescued") && Math.abs(Math.floor(seed / 41)) % 37 === 0) {
    return { id: "fairy-rescue", title: "أسيرة بين الغيلان", region: "وادي الغيلان", story: "تسمع نداءً خافتًا خلف الصخور. جنية صغيرة محاصرة قرب قطيع من الغيلان، وعلى الأرض أثر ممر ضيق يمكن فتحه دون الاقتراب من القطيع.", kind: "traveler", choices: [
      { id: "rescue", label: "افتح الممر وأنقذها", hint: "تتدخل رغم الخطر.", outcome: { xp: 260, damage: 12, gold: 140, fairyRescue: true } },
      { id: "distract", label: "شتّت الغيلان بالحيلة", hint: "تستخدم البيئة لصنع فرصة للهروب.", outcome: { xp: 220, gold: 90, fairyRescue: true } },
      { id: "leave", label: "انسحب بهدوء", hint: "تتجنب المخاطرة.", outcome: { xp: 20 } },
    ] };
  }
  if (state.hero && state.hero.level >= 40 && Math.abs(Math.floor(seed / 29)) % 13 === 0) {
    const eligible = COMPANION_EVENT_BANK.filter((entry) => {
      const pet = PETS.find((item) => item.id === entry.petId);
      return !!pet && state.hero!.level >= pet.requiredLevel && !state.pets.includes(entry.petId);
    });
    if (eligible.length) {
      const entry = eligible[Math.abs(Math.floor(seed / 7)) % eligible.length]!;
      return { id: `companion-${entry.petId}`, title: entry.title, region: entry.region, story: entry.story, kind: entry.kind, choices: entry.choices };
    }
  }
  const chainReady = roaming.activeChain && roaming.eventsCompleted >= roaming.chainNextAtEvent;
  const chainAppears = chainReady && Math.abs(Math.floor(seed / 13)) % 4 === 0;
  if (chainAppears) {
    const chain = CHAINS.find((item) => item.id === roaming.activeChain);
    if (chain) {
      const stage = Math.min(chain.stages.length - 1, roaming.chainStage);
      const actions = CHAIN_STAGE_ACTIONS[chain.id]?.[stage] ?? ["افحص " + chain.stages[stage], "اتبع أثر " + chain.stages[stage]];
      const routeNote = roaming.chainRoute === "cautious"
        ? "تلاحظ أن اختيارك السابق قادك إلى تفاصيل لم تكن ظاهرة من الطريق الرئيسي."
        : roaming.chainRoute === "bold"
          ? "تجد أن قرارك السابق فتح هذا الجزء من الحكاية، لكن بقيت تفاصيل تحتاج إلى تفسير."
          : "تبدأ الحكاية من دليلها الأول، وما زالت أمامك أكثر من طريقة لفهمه.";
      return {
        id: "chain-" + chain.id + "-" + stage,
        title: chain.stages[stage],
        region: REGIONS[(stage * 3 + roaming.eventsCompleted) % REGIONS.length],
        story: CHAIN_STORIES[stage] + " " + routeNote + " يرتبط هذا الفصل بحكاية «" + chain.name + "».",
        kind: "chain",
        chainId: chain.id,
        chainStage: stage,
        choices: [
          { id: "press", label: actions[0], hint: "تتابع الدليل الخاص بهذا الفصل من زاوية مباشرة.", outcome: { gold: 100 + stage * 70, xp: 90 + stage * 60, chain: chain.id, chainEnd: stage === chain.stages.length - 1 } },
          { id: "careful", label: actions[1], hint: "تفحص تفاصيل هذا الفصل قبل الانتقال.", outcome: { gold: 45 + stage * 25, xp: 120 + stage * 45, chain: chain.id, chainEnd: stage === chain.stages.length - 1 } },
        ],
      };
    }
  }
  if (Math.abs(Math.floor(seed / 5)) % 8 === 0) return { id: `roam-merchant-${roaming.eventsCompleted}-${Math.floor(seed)}`, title: "قافلة ساهر عند مفترق الطرق", region: REGIONS[Math.abs(Math.floor(seed)) % REGIONS.length], story: "تسمع رنين أجراس صغيرة قبل أن تظهر عربة مغطاة بقماش أزرق. يرفع التاجر ساهر غطاء المصباح ويحييك كأنه يعرف أنك قادم. يفتح صناديق القافلة لتتفقّد بضاعة مختلفة في كل لقاء، ثم يستعد لمواصلة رحلته.", kind: "merchant", choices: [] };
  // Rotate through every base scene before showing another variant of a scene already seen.
  const unseenSceneIndexes = SCENES.map((_, index) => index).filter((sceneIndex) =>
    !roaming.eventsSeen.some((id) => id.startsWith(`roam-${sceneIndex}-`))
  );
  const preferredPool = unseenSceneIndexes.length
    ? ROAMING_EVENT_PREVIEW.filter((event) => unseenSceneIndexes.includes(Number(event.id.split("-")[1] ?? 0)))
    : ROAMING_EVENT_PREVIEW.filter((event) => !roaming.eventsSeen.includes(event.id));
  const pool = preferredPool.length ? preferredPool : ROAMING_EVENT_PREVIEW;
  // Mix the timestamp and progression counter instead of using the raw timestamp remainder.
  let mixedSeed = (Math.floor(seed) ^ Math.imul(roaming.eventsCompleted + 1, 0x9e3779b1)) >>> 0;
  mixedSeed ^= mixedSeed >>> 16;
  mixedSeed = Math.imul(mixedSeed, 0x7feb352d);
  mixedSeed ^= mixedSeed >>> 15;
  mixedSeed = Math.imul(mixedSeed, 0x846ca68b);
  mixedSeed ^= mixedSeed >>> 16;
  const index = (mixedSeed >>> 0) % pool.length;
  const scene = pool[index]!;
  const chainStart = CHAINS[Math.abs(Math.floor(seed / 7)) % CHAINS.length];
  const choices = scene.choices.map((choice) => ({
    ...choice,
    outcome: { ...choice.outcome, ...(choice.outcome.chain ? {} : Math.abs(Math.floor(seed / 11)) % 9 === 0 && !choice.id.includes("leave") && !choice.id.includes("long") && !choice.id.includes("step") ? { chain: chainStart.id } : {}) },
  }));
  return { ...scene, choices };
}

export function resolveRoamingChoice(state: GameState, event: RoamingEvent, choiceId: string, now = Date.now()): { state: GameState; message: string; rewards: string } {
  const choice = event.choices.find((item) => item.id === choiceId);
  if (!choice || !state.hero) return { state, message: "هذا الاختيار غير متاح.", rewards: "" };
  const next = JSON.parse(JSON.stringify(state)) as GameState;
  const reward = choice.outcome;
  const level = Math.max(1, next.hero?.level ?? 1);
  const scale = 1 + Math.log2(level) * 0.13;
  const gold = Math.round((reward.gold ?? 0) * scale);
  const xp = Math.round((reward.xp ?? 0) * scale);
  const damage = Math.round((reward.damage ?? 0) * (1 + Math.log2(level) * 0.065));
  next.gold = Math.max(0, next.gold + gold);
  next.gems = Math.max(0, next.gems + (reward.gems ?? 0));
  next.roaming.health = Math.min(next.roaming.maxHealth, Math.max(0, next.roaming.health - damage + (reward.heal ?? 0)));
  if (xp) { const trained = addExperience(next, xp); Object.assign(next, trained.state); }
  let lootName = "";
  if (reward.companion && PETS.some((pet) => pet.id === reward.companion) && !next.pets.includes(reward.companion)) {
    next.pets.push(reward.companion);
    lootName = `رفيق جديد: ${PETS.find((pet) => pet.id === reward.companion)?.name ?? reward.companion}`;
  }
  if (reward.fairyRescue) {
    next.roaming.storyFlags = [...new Set([...next.roaming.storyFlags, "fairy-rescued"])];
    next.roaming.fairyNextAt = now + (4 + Math.floor(Math.random() * 8)) * 60 * 60 * 1000;
    const pendant = EVENT_RELICS.find((item) => item.id === "event-fairy-pendant");
    if (pendant && next.inventory.length < 500) { next.inventory.unshift(createItemInstance(pendant, `fairy-${now}`)); lootName = pendant.name; }
  }
  if (reward.fairyReturn) next.roaming.fairyReunited = true;
  if (reward.echoAction) {
    const stage = next.roaming.echoStage;
    const routeOffset = next.roaming.echoRoute === "trust" ? 0 : next.roaming.echoRoute === "listen" ? 1 : next.roaming.echoRoute === "challenge" ? 2 : 0;
    const expected = (["listen", "trust", "listen", "challenge", "trust", "listen", "challenge", "trust", "listen", "trust"] as const)[(stage + routeOffset) % 10];
    if (reward.echoAction === expected) {
      next.roaming.echoStarted = true;
      next.roaming.echoStage = stage + 1;
      next.roaming.echoRoute = reward.echoAction;
      if (next.roaming.echoStage >= 10) {
        if (!next.pets.includes("shattered-echo")) next.pets.push("shattered-echo");
        next.roaming.echoStarted = false; next.roaming.echoStage = 0; next.roaming.echoFailures = 0; next.roaming.echoRoute = null;
        next.roaming.echoNextAt = now + 365 * 24 * 60 * 60 * 1000;
        lootName = "الــصــدى المـتـشـظّ";
      }
    } else {
      next.roaming.echoFailures += 1; next.roaming.echoStarted = false; next.roaming.echoStage = 0; next.roaming.echoRoute = null;
      next.roaming.echoNextAt = now + (next.roaming.echoFailures >= 2 ? 30 : 3) * 24 * 60 * 60 * 1000;
    }
  }
  if (reward.relic) {
    const relic = EVENT_RELICS.find((item) => item.id === reward.relic);
    if (relic && next.inventory.length < 500) { next.inventory.unshift(createItemInstance(relic, `event-${now}`)); lootName = relic.name; }
  }

  const lootChance = Math.min(0.28, 0.055 + Math.log2(level) * 0.025 + Math.min(0.07, (next.hero?.stats.luck ?? 0) * 0.001));
  if ((reward.gear || (gold > 0 && choice.id !== "ignore" && choice.id !== "retreat" && Math.random() < lootChance)) && next.inventory.length < 500) {
    const loot = createItemInstance(getDungeonDrop(0, level), `roam-${now}`);
    next.inventory.unshift(loot);
    lootName = loot.name;
  }
  next.roaming.eventsCompleted += 1;
  next.roaming.fragmentProgress += 1;
  let fragmentEarned = 0;
  if (next.roaming.fragmentProgress >= 2) {
    next.roaming.fragments += 1;
    next.roaming.fragmentsCollected += 1;
    next.roaming.fragmentProgress = 0;
    fragmentEarned = 1;
  }
  next.roaming.lastEventAt = now;
  next.roaming.healthUpdatedAt = now;
  if (!event.id.startsWith("companion-") || reward.companion) next.roaming.eventsSeen = [...next.roaming.eventsSeen.filter((id) => id !== event.id), event.id].slice(-500);
  if (event.chainId && reward.chainEnd) {
    next.roaming.activeChain = null;
    next.roaming.chainStage = 0;
    next.roaming.chainRoute = null;
    next.roaming.chainNextAtEvent = 0;
  } else if (reward.chain) {
    next.roaming.activeChain = reward.chain;
    next.roaming.chainStage = event.chainId ? (event.chainStage ?? 0) + 1 : 0;
    next.roaming.chainRoute = ["careful", "study", "sneak", "pray", "help", "trade"].includes(choice.id) ? "cautious" : "bold";
    next.roaming.chainNextAtEvent = next.roaming.eventsCompleted + 2 + (Math.abs(Math.floor(now / 1000)) % 3);
  }
  if (next.roaming.health <= 0) {
    next.roaming.health = 0;
    next.gold = Math.max(0, next.gold - 25);
    return { state: next, message: "أُنهكت في الطريق. توقفت رحلتك حتى تستعيد 20 نقطة صحة على الأقل.", rewards: fragmentEarned ? "+1 شظية أثر" : "" };
  }
  const rewards = [
    gold ? `+${gold} ذهب` : "",
    reward.gems ? `+${reward.gems} جوهرة` : "",
    xp ? `+${xp} خبرة` : "",
    reward.heal ? `استعدت ${reward.heal} صحة` : "",
    damage ? `تضررت ${damage} صحة` : "",
    lootName ? `غنيمة: ${lootName}` : "",
    fragmentEarned ? `+1 شظية أثر` : "",
  ].filter(Boolean).join(" • ");
  const sceneIndex = event.id.startsWith("roam-") ? Number(event.id.split("-")[1]) : -1;
  const choiceIndex = event.choices.findIndex((item) => item.id === choiceId);
  const sceneResult = sceneIndex >= 0 ? SCENE_RESULTS[sceneIndex]?.[choiceIndex] : undefined;
  const chainStage = event.chainStage ?? 0;
  const chainContinuations: Record<string, string[]> = {
    "lost-cartographer": ["تفتح الدفتر فتنساب منه ورقة مطوية، وعلى حافتها رسم لشجرة تحمل العلامة نفسها. ترفع عينيك نحو الغابة وتدرك أن الطريق لم ينتهِ بعد.", "تتبع الظلال حتى تتلاقى عند صخرة ملساء؛ تحتها أثر قديم يشبه توقيع الملاح، فتحتفظ بمكانه في ذاكرتك."],
    "black-sail": ["تهب نسمة بحرية فتتحرك الراية، ويسقط من طياتها ختم نحاسي عليه رمز السفينة المفقودة.", "تزيل الملح عن الزجاجة فتظهر كتابة باهتة، وتكشف كلماتها عن سر لم يكن واضحًا من قبل."],
    "silent-bell": ["يمرر الهواء نغمة خافتة عبر الجرس، ثم يضيء نقش صغير على حافته كأنه يجيب عن سؤالك.", "تتبع الصدى إلى أسفل الدرج، وهناك تجد ثلاث علامات محفورة في الحجر."],
    "ember-crown": ["تستقر الشظية في راحة يدك ويخرج منها دفء خفيف، ثم يظهر على سطحها نقش يقود إلى الفرن القديم.", "يعرض الحداد أثر المعدن على لوح حجري، فتتضح له علامة لم يرها منذ سنوات."],
    "moon-letters": ["تضع الرسالة تحت الضوء، فيظهر سطر فضي بين الكلمات ويكشف اسمًا غاب عن الرسالة الأولى.", "تتبع أثر الحبر حتى طرف الورقة، فتجد علامة صغيرة تشير إلى المرصد المهجور."],
    "glass-king": ["يتغير انعكاس القناع للحظة، ويظهر خلفك باب لم يكن موجودًا قبل أن تلمسه.", "تجمع الشظايا المتناثرة، فتتطابق أطرافها وتكشف ممرًا خفيًا في القصر."],
    "wanderer": ["تضيء علامة البوابة ثم تنفتح في سطحها صورة مكان بعيد، كأن العابر يرسل إليك إشارة من عالمه.", "تراجع خريطة المسافر وتجد خطًا لم يكن ظاهرًا، يرسم طريقًا جديدًا بين العلامات."],
    "red-orchard": ["تسند يدك إلى الجذر وتزيل عنه الطبقة الفاسدة، ثم تغسله بماء النبع. يعود النسغ إلى العروق اليابسة، وترتجف الأغصان فوقك وقد بدأت تستعيد لونها.", "تتبع مجرى الماء إلى منبعه وتوقف ما كان يفسد التربة. يعود الماء صافيًا إلى الجذور، وتنتشر رائحة التراب النقي بين الأشجار."],
    "star-forge": ["يلتقط المعدن ضوء النجوم، فتظهر على سطحه خطوط دقيقة ترسم طريقًا إلى المنجم.", "تقلب الشظية قرب ضوء الفرن، فتلمع علامة قديمة على حافتها وتشير إلى موضع المطرقة."],
    "hollow-mask": ["تسمع همسًا خافتًا من داخل القناع، ثم يظهر على باطنه نصف اسم كان مخفيًا.", "تعدل القناع أمام الضوء، فينعكس على جداره نقش يقود إلى شاهد جديد."]
  };
  const chainEndings: Record<string, string> = {
    "lost-cartographer": "تضع آخر صفحة في موضعها، فتكتمل الخريطة أمامك. يظهر الملاح عند نهاية الطريق، وقد عرف من العلامات أنك أعدت إليه ما فقده.",
    "black-sail": "ينكشف سر الراية أخيرًا؛ لم يكن الكنز صندوقًا من الذهب فحسب، بل سجل الرحلة الذي حفظ حكاية السفينة وطاقمها. تطوي السجل وتترك البحر يحتفظ ببقية أسراره.",
    "silent-bell": "تعود النغمة إلى الجرس، فيضيء النقش الأخير وتفهم سر الصمت الذي أحاط بالمكان. تغادر القاعة وقد عاد إليها صوتها.",
    "ember-crown": "يستقر التاج بعد اكتمال صنعه، ويخفت وهج الفرن للمرة الأولى منذ زمن. تنتهي الرحلة ويبقى أثرها محفورًا في المعدن.",
    "moon-letters": "تجتمع الرسائل أخيرًا، وتتضح الصلة بين كلماتها. ترسل الوعد إلى صاحبه، ثم ينطفئ ضوء المرصد بهدوء.",
    "glass-king": "تكتمل صورة القناع، وينعكس وجه الحقيقة على العرش المتصدع. يغادر آخر أسرار القصر معك، وتُطوى الحكاية.",
    "wanderer": "تستقر البوابة ويظهر الطريق الذي ظل العابر يبحث عنه. يودعك وقد وجد وجهته، ويترك لك علامة تذكرك باللقاء.",
    "red-orchard": "تمتد الحياة من جديد بين أشجار البستان، وتخضر الأغصان التي ظلت صامتة طويلًا. يعود عطر المكان، ولا يبقى من اللعنة إلا ذكرى بعيدة.",
    "star-forge": "يستعيد المعدن بريقه تحت ضوء الفرن، ويكتمل العمل الذي بدأ بالشظية الساقطة. تهدأ المطرقة ويبقى أثر النجمة شاهدًا على الرحلة.",
    "hollow-mask": "تنكشف الروايات المتضاربة وتجتمع الشهادات على حقيقة واحدة. تعيد القناع إلى موضعه، وتُسدل الستارة على الحكاية."
  };
  const redOrchardRootResult = event.chainId === "red-orchard" && chainStage === 3
    ? choiceId === "press"
      ? "تنحني فوق الجذر وتزيل عنه السم المتراكم، ثم تغسله بماء النبع حتى يعود النسغ إلى عروقه. يخفّ السواد عن اللحاء، وتستعيد الأغصان شيئًا من لونها بعد طول ذبول."
      : "تتبع مجرى الماء حتى تصل إلى موضع التلوث، فتغلق مصدره وتعيد الماء الصافي إلى التربة. يتشرب الجذر الماء النقي، وتبدأ الأشجار باستعادة حيويتها."
    : null;
  const redOrchardFlowerResult = event.chainId === "red-orchard" && chainStage === 4
    ? choiceId === "press"
      ? "تقطف الزهرة برفق بعد أن تفتحت أخيرًا، وتلف بذورها في قطعة قماش كي لا تضيع. ينساب عطرها في البستان، وتعرف أن الجذر تعافى كما ينبغي."
      : "تجمع البذور الناضجة وتحفظها في التربة القريبة من النبع. تتفتح بتلات الزهرة تحت ضوء الصباح، ويصبح للبستان أمل بموسم جديد."
    : null;
  const storyResult = event.chainId
    ? reward.chainEnd
      ? chainEndings[event.chainId] ?? "تكتمل الحكاية أخيرًا، وتتضح لك حقيقة العلامات التي قادتك منذ البداية."
      : redOrchardRootResult ?? redOrchardFlowerResult ?? chainContinuations[event.chainId]?.[choiceId === "press" ? 0 : 1] ?? "تتكشف أمامك علامة جديدة، وتفهم من تفاصيلها شيئًا لم يكن واضحًا من قبل."
    : sceneResult ?? `تختار «${choice.label}»، ويهدأ المكان من حولك وتترك خطوتك أثرًا في هذا اللقاء قبل أن تواصل الطريق.`;
  return { state: next, message: storyResult, rewards: rewards || "لم تحصل على مكافآت في هذا الاختيار." };
}

export function getTravellingMerchant(state: GameState, now = Date.now(), random: () => number = Math.random): RoamingMerchantItem[] {
  const level = Math.max(1, state.hero?.level ?? 1);
  const scale = 1 + Math.log2(level) * 0.22;
  const stock: RoamingMerchantItem[] = [];
  const usedGear = new Set<string>();
  for (let index = 0; index < 3; index += 1) {
    let template = getDungeonDrop(0, level, random);
    for (let attempt = 0; attempt < 12 && usedGear.has(template.id); attempt += 1) template = getDungeonDrop(0, level, random);
    usedGear.add(template.id);
    stock.push({
      id: `merchant-gear-${Math.floor(now)}-${index}`,
      name: template.name,
      description: `${template.slot} • ${template.rarity} • يتطلب مستوى ${template.requiredLevel ?? 1}`,
      price: Math.max(80, Math.round(template.price * scale * 0.72)),
      currency: "gold",
      stock: 1,
      gearTemplate: template,
    });
  }
  stock.push(
    { id: `healing-tonic-${Math.floor(now)}`, name: "إكسير المسافر", description: "يعيد 45 نقطة من صحتك في التجوال.", price: Math.round((75 + Math.floor(random() * 61)) * scale), currency: "gold", heal: 45, stock: 1 + Math.floor(random() * 2) },
    { id: `mystery-cache-${Math.floor(now)}`, name: "صندوق الأسرار", description: "ذهب وخبرة من مخزون القافلة.", price: Math.round((210 + Math.floor(random() * 121)) * scale), currency: "gold", gold: Math.round((160 + Math.floor(random() * 141)) * scale), xp: Math.round((130 + Math.floor(random() * 121)) * scale), stock: 1 },
  );
  return stock;
}
export function buyMerchantItem(state: GameState, item: RoamingMerchantItem) {
  if (!item) return { state, error: "هذا المنتج غير متاح." };
  if (!state.hero) return { state, error: "أنشئ شخصيتك أولًا." };
  if (item.currency === "gold" && state.gold < item.price) return { state, error: "لا تملك الذهب الكافي." };
  if (item.gearTemplate && state.inventory.length >= 500) return { state, error: "حقيبتك ممتلئة." };
  const next = JSON.parse(JSON.stringify(state)) as GameState;
  if (item.currency === "gold") next.gold -= item.price;
  if (item.gearTemplate) next.inventory.unshift(createItemInstance(item.gearTemplate, `merchant-${Date.now()}`));
  next.gems += item.gems ?? 0;
  next.gold += item.gold ?? 0;
  if (item.heal) next.roaming.health = Math.min(next.roaming.maxHealth, next.roaming.health + item.heal);
  if (item.xp && next.hero) Object.assign(next, addExperience(next, item.xp).state);
  return { state: next };
}

export function completeRoamingMerchantVisit(state: GameState, event: RoamingEvent, now = Date.now()): GameState {
  if (!state.hero || event.kind !== "merchant") return state;
  const next = JSON.parse(JSON.stringify(state)) as GameState;
  next.roaming.eventsCompleted += 1;
  next.roaming.fragmentProgress += 1;
  if (next.roaming.fragmentProgress >= 2) {
    next.roaming.fragments += 1;
    next.roaming.fragmentsCollected += 1;
    next.roaming.fragmentProgress = 0;
  }
  next.roaming.lastEventAt = now;
  next.roaming.healthUpdatedAt = now;
  next.roaming.eventsSeen = [...next.roaming.eventsSeen.filter((id) => id !== event.id), event.id].slice(-500);
  return next;
}


/** Regenerate one roaming health point for each full minute elapsed. */
export function buyRoamingHealthRefill(state: GameState, now = Date.now()): { state: GameState; error?: string; restored?: number } {
  if (!state.hero) return { state, error: "أنشئ شخصيتك أولًا." };
  if (state.roaming.health >= state.roaming.maxHealth) return { state, error: "صحتك مكتملة بالفعل." };
  const today = new Date(now).toISOString().slice(0, 10);
  const used = state.roaming.gemRefillDate === today ? state.roaming.gemRefillsUsed : 0;
  if (used >= 10) return { state, error: "وصلت إلى الحد اليومي: 10 تعبئات." };
  if (state.gems < 20) return { state, error: "لا تملك 20 جوهرة كافية." };
  const restored = Math.min(20, state.roaming.maxHealth - state.roaming.health);
  const next = JSON.parse(JSON.stringify(state)) as GameState;
  next.gems -= 20;
  next.roaming.health += restored;
  next.roaming.healthUpdatedAt = now;
  next.roaming.gemRefillDate = today;
  next.roaming.gemRefillsUsed = used + 1;
  return { state: next, restored };
}

export function refreshRoamingHealth(state: GameState, now = Date.now()): GameState {
  const last = state.roaming.healthUpdatedAt || now;
  const minutes = Math.floor(Math.max(0, now - last) / 60_000);
  if (!minutes) return state;
  const health = Math.min(state.roaming.maxHealth, state.roaming.health + minutes);
  return { ...state, roaming: { ...state.roaming, health, healthUpdatedAt: last + minutes * 60_000 } };
}
