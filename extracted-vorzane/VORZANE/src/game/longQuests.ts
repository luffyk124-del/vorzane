import type { GameState } from "./model.ts";
import { addExperience } from "./stats.ts";

export type LongQuestMetric = "wins" | "battles" | "level" | "roaming" | "fragments" | "dimas" | "days" | "gear";
export type LongQuest = { id: string; title: string; description: string; tier: "سهل" | "متوسط" | "صعب" | "نخبوي" | "ملحمي"; metric: LongQuestMetric; target: number; gold: number; xp: number; gems?: number; fragments?: number; rewardName?: string };

const rows: Omit<LongQuest, "id">[] = [
  { title: "خطوة في المجهول", description: "أكمل أول حدث أثناء التجوال.", tier: "سهل", metric: "roaming", target: 1, gold: 120, xp: 80, fragments: 2 },
  { title: "جامع الشظايا", description: "اجمع 8 قطع من أحداث التجوال.", tier: "سهل", metric: "fragments", target: 8, gold: 160, xp: 100, gems: 2 },
  { title: "اختبار الشجاعة", description: "اربح 3 معارك.", tier: "سهل", metric: "wins", target: 3, gold: 180, xp: 120 },
  { title: "مغامر ناشئ", description: "أكمل 5 أحداث تجوال.", tier: "سهل", metric: "roaming", target: 5, gold: 220, xp: 150, fragments: 3 },
  { title: "أول ترقية", description: "بلغ المستوى 3.", tier: "سهل", metric: "level", target: 3, gold: 250, xp: 180, gems: 3 },
  { title: "عدة المسافر", description: "جهّز 3 قطع عتاد في الوقت نفسه.", tier: "سهل", metric: "gear", target: 3, gold: 260, xp: 190 },
  { title: "صياد الرماد", description: "اربح 10 معارك.", tier: "متوسط", metric: "wins", target: 10, gold: 650, xp: 420, fragments: 5 },
  { title: "أثر وراء أثر", description: "أكمل 15 حدث تجوال.", tier: "متوسط", metric: "roaming", target: 15, gold: 700, xp: 480, gems: 5 },
  { title: "مخزون القطع", description: "اجمع 25 قطعة.", tier: "متوسط", metric: "fragments", target: 25, gold: 750, xp: 500, fragments: 8 },
  { title: "مواجهة طويلة", description: "خض 30 معركة.", tier: "متوسط", metric: "battles", target: 30, gold: 800, xp: 540 },
  { title: "خطوة في الديماس", description: "تجاوز أول 5 طوابق في الديماس.", tier: "متوسط", metric: "dimas", target: 5, gold: 850, xp: 600, gems: 6 },
  { title: "رحّالة الأسبوع", description: "استمر في رحلتك يومين على الأقل منذ بدء المهمة.", tier: "متوسط", metric: "days", target: 2, gold: 900, xp: 650, fragments: 8 },
  { title: "اسم يتردد", description: "بلغ المستوى 10.", tier: "متوسط", metric: "level", target: 10, gold: 1_100, xp: 750, gems: 8 },
  { title: "سجل الحكايات", description: "أكمل 25 حدث تجوال.", tier: "متوسط", metric: "roaming", target: 25, gold: 1_200, xp: 800, fragments: 10 },
  { title: "كاسر الحصون", description: "اربح 35 معركة.", tier: "صعب", metric: "wins", target: 35, gold: 2_500, xp: 1_500, gems: 12 },
  { title: "الطريق الملتف", description: "أكمل 45 حدث تجوال.", tier: "صعب", metric: "roaming", target: 45, gold: 2_800, xp: 1_700, fragments: 18 },
  { title: "خزنة الأثر", description: "اجمع 60 قطعة.", tier: "صعب", metric: "fragments", target: 60, gold: 3_000, xp: 1_800, gems: 15 },
  { title: "قلب الديماس", description: "تجاوز الطابق 25 في الديماس.", tier: "صعب", metric: "dimas", target: 25, gold: 3_500, xp: 2_000, fragments: 20 },
  { title: "خبرة الميدان", description: "بلغ المستوى 20.", tier: "صعب", metric: "level", target: 20, gold: 4_000, xp: 2_200, gems: 20 },
  { title: "سبعة أيام من العزم", description: "أكمل 7 أيام منذ بدء رحلتك.", tier: "صعب", metric: "days", target: 7, gold: 4_500, xp: 2_500, fragments: 25 },
  { title: "قائد المواجهات", description: "خض 100 معركة.", tier: "صعب", metric: "battles", target: 100, gold: 5_000, xp: 2_800, gems: 25 },
  { title: "صائد الأسرار", description: "أكمل 80 حدث تجوال.", tier: "صعب", metric: "roaming", target: 80, gold: 5_500, xp: 3_000, fragments: 30 },
  { title: "سيد الساحة", description: "اربح 100 معركة.", tier: "نخبوي", metric: "wins", target: 100, gold: 12_000, xp: 6_500, gems: 40, fragments: 40 },
  { title: "مئة أثر", description: "أكمل 100 حدث تجوال.", tier: "نخبوي", metric: "roaming", target: 100, gold: 13_000, xp: 7_000, gems: 45 },
  { title: "طريق الطوابق", description: "تجاوز الطابق 75 في الديماس.", tier: "نخبوي", metric: "dimas", target: 75, gold: 15_000, xp: 8_000, fragments: 50 },
  { title: "قوة لا تلين", description: "بلغ المستوى 35.", tier: "نخبوي", metric: "level", target: 35, gold: 17_000, xp: 9_000, gems: 60 },
  { title: "عشرة أيام في البراري", description: "أكمل أكمل 10 أيام منذ بدء رحلتك.", tier: "نخبوي", metric: "days", target: 10, gold: 18_000, xp: 10_000, fragments: 60 },
  { title: "حارس العتاد", description: "جهّز 8 قطع في جميع الخانات.", tier: "نخبوي", metric: "gear", target: 8, gold: 20_000, xp: 11_000, gems: 65 },
  { title: "حكاية لا تنتهي", description: "أكمل 160 حدث تجوال.", tier: "ملحمي", metric: "roaming", target: 160, gold: 55_000, xp: 25_000, gems: 120, fragments: 100 },
  { title: "مئة وخمسون انتصارًا", description: "اربح 150 معركة.", tier: "ملحمي", metric: "wins", target: 150, gold: 60_000, xp: 28_000, gems: 140 },
  { title: "الديماس الأعظم", description: "تجاوز الطابق 150 في الديماس.", tier: "ملحمي", metric: "dimas", target: 150, gold: 70_000, xp: 32_000, gems: 150, fragments: 120 },
  { title: "رحلة نصف شهر", description: "أكمل 15 يومًا منذ بدء رحلتك.", tier: "ملحمي", metric: "days", target: 15, gold: 80_000, xp: 35_000, gems: 180 },
  { title: "جامع الآثار الأكبر", description: "اجمع 250 قطعة.", tier: "ملحمي", metric: "fragments", target: 250, gold: 85_000, xp: 38_000, gems: 200 },
  { title: "آخر العتبات", description: "بلغ المستوى 60.", tier: "ملحمي", metric: "level", target: 60, gold: 100_000, xp: 45_000, gems: 250 },
  { title: "سيد الديماس", description: "أكمل الطابق 300 في الديماس.", tier: "ملحمي", metric: "dimas", target: 300, gold: 250_000, xp: 100_000, gems: 500, fragments: 300 },
  { title: "شهر في عالم الأساطير", description: "أكمل 30 يومًا منذ بدء رحلتك.", tier: "ملحمي", metric: "days", target: 30, gold: 150_000, xp: 70_000, gems: 300, fragments: 500 },
];
export const LONG_QUESTS: LongQuest[] = rows.map((quest, index) => ({ ...quest, id: `long-${index + 1}` }));

export function getLongQuestProgress(state: GameState, quest: LongQuest, now = Date.now()): number {
  switch (quest.metric) {
    case "wins": return state.wins;
    case "battles": return state.battles;
    case "level": return state.hero?.level ?? 0;
    case "roaming": return state.roaming.eventsCompleted;
    case "fragments": return state.roaming.fragments;
    case "dimas": return state.dimas.highestFloor;
    case "days": return Math.floor(Math.max(0, now - state.longQuestStartedAt) / 86_400_000);
    case "gear": return Object.values(state.equipped).filter(Boolean).length;
  }
}

export function claimLongQuest(state: GameState, questId: string, now = Date.now()): { state: GameState; error?: string } {
  const quest = LONG_QUESTS.find((item) => item.id === questId);
  if (!quest) return { state, error: "المهمة غير موجودة." };
  if (state.claimedLongQuestIds.includes(questId)) return { state, error: "استلمت مكافأة هذه المهمة سابقًا." };
  if (getLongQuestProgress(state, quest, now) < quest.target) return { state, error: "لم يكتمل هدف المهمة بعد." };
  const next = JSON.parse(JSON.stringify(state)) as GameState;
  next.gold += quest.gold;
  next.gems += quest.gems ?? 0;
  next.roaming.fragments += quest.fragments ?? 0;
  const trained = addExperience(next, quest.xp);
  Object.assign(next, trained.state);
  next.claimedLongQuestIds.push(questId);
  return { state: next };
}
