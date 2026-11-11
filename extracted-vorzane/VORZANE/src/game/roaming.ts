import type { GameState } from "./model.ts";
import { PETS } from "./catalog.ts";
import { EVENT_RELICS } from "./dungeonItems.ts";
import { addExperience } from "./stats.ts";
import { createItemInstance, getDungeonDrop } from "./dungeonItems.ts";

export type RoamingOutcome = { gold?: number; gems?: number; xp?: number; damage?: number; heal?: number; chain?: string; chainEnd?: boolean; gear?: boolean; battle?: boolean; companion?: string; fairyRescue?: boolean; fairyReturn?: boolean; relic?: string; echoAction?: "trust" | "listen" | "challenge" };
export type RoamingChoice = { id: string; label: string; hint: string; outcome: RoamingOutcome };
export type RoamingEvent = { id: string; title: string; region: string; story: string; kind: "encounter" | "traveler" | "cache" | "omen" | "chain" | "merchant" | "special"; choices: RoamingChoice[]; chainId?: string; chainStage?: number };
type RoamingMerchantItem = { id: string; name: string; description: string; price: number; currency: "gold"; stock: number; gear?: boolean; heal?: number; gems?: number; gold?: number; xp?: number };

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
const SCENE_CHOICE_LABELS = [
  ["تتبع الأثر الأحدث", "قارن العلامات عند الصخرة", "اترك المكان وراقب من بعيد"],
  ["أنقذ ما بقي من البضاعة", "ابحث عن صاحب العربة", "فتش آثار العجلات"],
  ["نادِ صاحب الصوت", "جهّز نفسك وتقدم", "انسحب نحو الطريق المفتوح"],
  ["افحص سجل القرابين", "خذ الشظية المتوهجة", "أغلق المذبح وغادر"],
  ["رافقه إلى المأوى", "اطلب رؤية الخريطة كاملة", "اعتذر وتابع طريقك"],
  ["اختبر صدق الصفقة", "بادل قطعة مقابل معلومة", "ارفض العرض"],
  ["اكسر طوق الكمين", "فاوض زعيم اللصوص", "انسحب قبل تطويقك"],
  ["اقبل اختبار الحارس", "اسأله عن الشارة", "ابحث عن مدخل آخر"],
  ["افتح الختم من طبقاته", "حلّ النقش أولًا", "اترك الصندوق"],
  ["اتبع مسار سقوط الوميض", "اجمع الحجارة الدافئة", "ابتعد عن الحفرة"],
  ["حرر القطيع واصرف المفترس", "عالج المخلوق المصاب", "لا تتدخل"],
  ["المس الحجر واقرأ الذكرى", "راقب الشارة دون لمس", "حطّم الحجر"],
  ["اعبر الجسر بحذر", "ثبّت الحبال أولًا", "اسلك الطريق الطويل"],
  ["واجه وحش الحطام", "استدرجه بعيدًا عن القافلة", "تراجع وابحث عن طريق آخر"]
];
const VARIANTS = ["تحت ضوء القمر", "قبل هبوب العاصفة", "بعد مرور قافلة مجهولة", "في ساعة السكون", "قرب شجرة محترقة", "عند منعطف ضيق", "بين أعمدة مهدمة", "على حافة النهر", "داخل ممر صخري", "بعد سقوط نيزك", "عند بئر مهجور", "في أرض مغطاة بالرماد"];

const COMMON_CHOICES: RoamingChoice[][] = [
  [
    { id: "help", label: "ساعده", hint: "تضحي ببعض الوقت والموارد لمساعدة الغريب.", outcome: { gold: 35, xp: 45, chain: "lost-cartographer" } },
    { id: "trade", label: "اعرض صفقة", hint: "تحاول تحويل الموقف إلى تبادل مفيد.", outcome: { gold: 70, xp: 20 } },
    { id: "ignore", label: "تابع طريقك", hint: "تتجنب المخاطرة وتواصل التجوال.", outcome: { xp: 12 } },
  ],
  [
    { id: "fight", label: "واجه الخطر", hint: "مكافأة أكبر مقابل مخاطرة أعلى.", outcome: { gold: 90, xp: 75, battle: true } },
    { id: "sneak", label: "تسلل من الخلف", hint: "تعتمد على الرشاقة والحذر.", outcome: { gold: 45, xp: 55, } },
    { id: "retreat", label: "انسحب", hint: "تتجنب المواجهة وتحافظ على صحتك.", outcome: { xp: 10 } },
  ],
  [
    { id: "open", label: "افتحه", hint: "قد تجد غنيمة ثمينة أو فخًا قديمًا.", outcome: { gold: 110, gems: 1, xp: 45, damage: 8 } },
    { id: "study", label: "افحص الرموز", hint: "تبحث عن طريقة آمنة لفهم الختم.", outcome: { xp: 80, } },
    { id: "leave", label: "اتركه", hint: "لا تخاطر بما تملكه.", outcome: { xp: 8 } },
  ],
  [
    { id: "touch", label: "المس الحجر", hint: "تقبل أثره المجهول.", outcome: { gems: 2, xp: 90, damage: 18 } },
    { id: "pray", label: "تأمل بهدوء", hint: "تستعيد بعض توازنك.", outcome: { heal: 25, xp: 35, } },
    { id: "break", label: "حطّمه", hint: "تحصل على ما بداخله بالقوة.", outcome: { gold: 65, damage: 10 } },
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
  story: `${scene.story} ${SCENE_DETAILS[sceneIndex]}`,
  kind: scene.kind,
  choices: COMMON_CHOICES[scene.kind === "encounter" ? 1 : scene.kind === "traveler" ? 0 : scene.kind === "cache" ? 2 : 3],
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
          { id: "press", label: "تابع التحقيق", hint: "تقترب من نهاية الحكاية.", outcome: { gold: 100 + stage * 70, xp: 90 + stage * 60, chain: chain.id, chainEnd: stage === chain.stages.length - 1 } },
          { id: "careful", label: "تقدم بحذر", hint: "تقلل المخاطر وتحصل على خبرة.", outcome: { gold: 45 + stage * 25, xp: 120 + stage * 45, chain: chain.id, chainEnd: stage === chain.stages.length - 1 } },
        ],
      };
    }
  }
  if (Math.abs(Math.floor(seed / 5)) % 8 === 0) return { id: `roam-merchant-${roaming.eventsCompleted}-${Math.floor(seed)}`, title: "قافلة ساهر عند مفترق الطرق", region: REGIONS[Math.abs(Math.floor(seed)) % REGIONS.length], story: "تسمع رنين أجراس صغيرة قبل أن تظهر عربة مغطاة بقماش أزرق. يرفع التاجر ساهر غطاء المصباح ويحييك كأنه يعرف أنك قادم. يشرح أن الطريق أمامه غير آمن، ولذلك سيبيع جزءًا من بضاعته هنا فقط. يلمح إلى أن بعض القطع جمعها من أطلال لا تظهر على الخرائط، ثم يمنحك وقتًا قصيرًا لتفقدها قبل أن تتحرك القافلة.", kind: "merchant", choices: [
    { id: "rumor", label: "اسأل ساهر عن الطريق", hint: "تحصل على معلومة قبل أن تغادر القافلة.", outcome: { xp: 55 } },
    { id: "bargain", label: "فاوض ساهر", hint: "تفاوضه على السعر مقابل أن تدله على طريق آمن.", outcome: { gold: 35, xp: 65, chain: "lost-cartographer" } },
    { id: "leave", label: "ودّعه وتابع طريقك", hint: "لا تنفق مواردك الآن.", outcome: { xp: 18 } },
  ] };
  const available = ROAMING_EVENT_PREVIEW.filter((event) => !roaming.eventsSeen.includes(event.id));
  const pool = available.length ? available : ROAMING_EVENT_PREVIEW;
  const index = Math.abs(Math.floor(seed)) % pool.length;
  const scene = pool[index];
  const chainStart = CHAINS[Math.abs(Math.floor(seed / 7)) % CHAINS.length];
  const sceneIndex = Number(scene.id.split("-")[1] ?? 0);
  const choices = scene.choices.map((choice, choiceIndex) => ({
    ...choice,
    label: SCENE_CHOICE_LABELS[sceneIndex]?.[choiceIndex] ?? choice.label,
    hint: choiceIndex === 0 ? "مكسب أكبر، لكنك تتحمل مسؤولية القرار." : choiceIndex === 1 ? "تحتاج إلى قراءة الموقف قبل الالتزام." : "تقلل المخاطرة وتحتفظ بحرية المتابعة.",
    outcome: { ...choice.outcome, ...(choice.outcome.chain ? {} : Math.abs(Math.floor(seed / 11)) % 9 === 0 && choice.id !== "ignore" && choice.id !== "retreat" ? { chain: chainStart.id } : {}) },
  }));
  return { ...scene, choices };
}

export function resolveRoamingChoice(state: GameState, event: RoamingEvent, choiceId: string, now = Date.now()): { state: GameState; message: string } {
  const choice = event.choices.find((item) => item.id === choiceId);
  if (!choice || !state.hero) return { state, message: "هذا الاختيار غير متاح." };
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
  next.roaming.lastEventAt = now;
  next.roaming.healthUpdatedAt = now;
  if (!event.id.startsWith("companion-") || reward.companion) next.roaming.eventsSeen = [...next.roaming.eventsSeen.filter((id) => id !== event.id), event.id].slice(-500);
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
    next.roaming.health = 0;
    next.gold = Math.max(0, next.gold - 25);
    return { state: next, message: "أُنهكت في الطريق. توقفت رحلتك حتى تستعيد 20 نقطة صحة على الأقل." };
  }
  const rewards = [
    gold ? `+${gold} ذهب` : "",
    reward.gems ? `+${reward.gems} جوهرة` : "",
    xp ? `+${xp} خبرة` : "",
    reward.heal ? `استعدت ${reward.heal} صحة` : "",
    damage ? `تضررت ${damage} صحة` : "",
    lootName ? `غنيمة: ${lootName}` : "",
  ].filter(Boolean).join(" • ");
  const continuation = event.title.includes("اللصوص")
    ? (gold > 0 || lootName
      ? "اندفعت من بين اللصوص وكسرت تطويقهم. تراجعوا بعد أن فقدوا القدرة على مواصلة المواجهة، فجمعت الذهب والغنائم التي تركوها خلفهم ثم تابعت طريقك."
      : "لم تجد فرصة آمنة لقلب الموقف؛ ابتعدت عن اللصوص وتابعت الطريق بحذر دون مكسب يُذكر.")
    : event.kind === "encounter" && (gold > 0 || lootName)
      ? "هدأ المكان بعد المواجهة. تفقدت ما تركه خصمك، وجمعت ما استطعت حمله قبل أن تواصل رحلتك."
      : "";
  return { state: next, message: [continuation, rewards || "تابعت طريقك دون غنيمة."].filter(Boolean).join("\\n\\n") };
}

export function getTravellingMerchant(state: GameState, now = Date.now()): RoamingMerchantItem[] {
  const cycle = Math.floor(now / (6 * 60 * 60 * 1000));
  const level = Math.max(1, state.hero?.level ?? 1);
  const sample = getDungeonDrop(0, level, () => 0.37);
  const scale = 1 + Math.log2(level) * 0.22;
  return [
    { id: "merchant-gear", name: sample.name, description: `${sample.slot} • ${sample.rarity} • يتطلب مستوى ${sample.requiredLevel ?? 1}`, price: Math.max(80, Math.round(sample.price * scale * 0.72)), currency: "gold" as const, gear: true, stock: 1 },
    { id: "healing-tonic", name: "إكسير المسافر", description: "يعيد 45 نقطة من صحتك في التجوال.", price: Math.round(90 * scale), currency: "gold" as const, heal: 45, stock: 1 + (cycle % 2) },
    { id: "mystery-cache", name: "صندوق الأسرار", description: "ذهب وخبرة من مخزون القافلة.", price: Math.round(260 * scale), currency: "gold" as const, gold: Math.round(220 * scale), xp: Math.round(180 * scale), stock: 1 },
  ];
}
export function buyMerchantItem(state: GameState, itemId: string) {
  const item = getTravellingMerchant(state).find((entry) => entry.id === itemId);
  if (!item) return { state, error: "هذا المنتج غير متاح." };
  if (!state.hero) return { state, error: "أنشئ شخصيتك أولًا." };
  if (item.currency === "gold" && state.gold < item.price) return { state, error: "لا تملك ذهبًا كافيًا." };
  if (item.gear && state.inventory.length >= 500) return { state, error: "حقيبتك ممتلئة." };
  const next = JSON.parse(JSON.stringify(state)) as GameState;
  if (item.currency === "gold") next.gold -= item.price;
  if (item.gear) next.inventory.unshift(createItemInstance(getDungeonDrop(0, next.hero?.level ?? 1, () => 0.37), `merchant-${Date.now()}`));
  next.gems += item.gems ?? 0;
  next.gold += item.gold ?? 0;
  if (item.heal) next.roaming.health = Math.min(next.roaming.maxHealth, next.roaming.health + item.heal);
  if (item.xp && next.hero) Object.assign(next, addExperience(next, item.xp).state);
  return { state: next };
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
