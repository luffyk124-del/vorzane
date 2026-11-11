import { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { AppButton, AppScreen, Card, Icon, Meter, PageTitle, Pill, SectionTitle, Txt } from "../../src/components/ui";
import { QUESTS, STORY_CHAPTERS } from "../../src/game/catalog";
import { canClaimQuest, claimQuest, getQuestProgress, EXPLORATION_ACHIEVEMENTS, canClaimExplorationAchievement, claimExplorationAchievement, getExplorationAchievementProgress, EXPEDITION_TASKS, canClaimExpeditionTask, claimExpeditionTask, ensureMissionPeriods, getRecurringMissions, claimRecurringMission, getStoryChapterProgress, canClaimStoryChapter, claimStoryChapter, type MissionScope } from "../../src/game/engine";
import { LONG_QUESTS, getLongQuestProgress, claimLongQuest, type LongQuest } from "../../src/game/longQuests";
import { useGame } from "../../src/contexts/GameContext";
import { palette } from "../../src/theme";

const achievementRows = [
  { id: "first", title: "بداية الرحلة", description: "اربح أول معركة", icon: "sparkles" as const },
  { id: "level", title: "ارتقاء", description: "بلغ المستوى الخامس", icon: "trending-up" as const },
  { id: "wins", title: "صاحب النصر", description: "اربح خمس معارك", icon: "trophy" as const },
];
const TIERS: LongQuest["tier"][] = ["سهل", "متوسط", "صعب", "نخبوي", "ملحمي"];
const TONES: Record<LongQuest["tier"], "jade" | "gold" | "red" | "gold" | "muted"> = {
  "سهل": "jade", "متوسط": "gold", "صعب": "red", "نخبوي": "gold", "ملحمي": "gold",
};

export default function QuestsScreen() {
  const { state, update } = useGame();
  const [notice, setNotice] = useState("");
  const [now] = useState(Date.now());
  useEffect(() => { update((current) => ensureMissionPeriods(current)); }, [update]);
  const recurringGroups: { scope: MissionScope; title: string; subtitle: string; icon: string; missions: ReturnType<typeof getRecurringMissions> }[] = [
    { scope: "daily", title: "المهام اليومية", subtitle: "تتجدد كل يوم", icon: "sunny", missions: getRecurringMissions(state, "daily") },
    { scope: "weekly", title: "المهام الأسبوعية", subtitle: "تتجدد مع بداية الأسبوع", icon: "calendar", missions: getRecurringMissions(state, "weekly") },
    { scope: "season", title: "تحديات الموسم", subtitle: "موسم جديد كل شهر", icon: "trophy", missions: getRecurringMissions(state, "season") },
  ];
  const quests = QUESTS.map((quest) => ({
    ...quest,
    progress: Math.min(getQuestProgress(state, quest.id), quest.target),
    available: canClaimQuest(state, quest.id),
    claimed: !!state.claimedQuestRewards[quest.id],
  }));
  const groups = useMemo(() => TIERS.map((tier) => ({
    tier,
    quests: LONG_QUESTS.filter((quest) => quest.tier === tier).map((quest) => ({
      ...quest,
      progress: Math.min(getLongQuestProgress(state, quest, now), quest.target),
      claimed: state.claimedLongQuestIds.includes(quest.id),
    })),
  })), [state, now]);
  const claimLong = (id: string) => {
    const result = claimLongQuest(state, id, now);
    if (result.error) { setNotice(result.error); return; }
    update(() => result.state);
    setNotice("تم استلام المكافأة وإضافتها إلى رصيدك.");
  };
  const claimedCount = state.claimedLongQuestIds.filter((id) => LONG_QUESTS.some((quest) => quest.id === id)).length;
  const readyCount = LONG_QUESTS.filter((quest) => !state.claimedLongQuestIds.includes(quest.id) && getLongQuestProgress(state, quest, now) >= quest.target).length;

  return <AppScreen>
    <PageTitle eyebrow="سجل التكليفات" title="المهام" subtitle="مهام يومية وأسبوعية وقصصية وإنجازات، إضافة إلى تحديات طويلة مستقلة عن ميادين القتال والتجوال." trailing={<Pill label={`${state.wins} انتصار`} icon="trophy" tone="gold" />} />
    <SectionTitle title="حملة الرماد" icon="book-outline" action={<Pill label={`${state.story}/${STORY_CHAPTERS.length} فصول`} tone="gold" />} />
    <Card style={styles.storyIntro}>
      <Txt style={styles.storyIntroTitle}>حكاية عالم VORZANE</Txt>
      <Txt muted style={styles.cardCopy}>خمسة فصول تربط معاركك ورحلاتك بقصة واحدة. افتح كل فصل بالتقدم، ثم استلم مكافأته لمواصلة الحكاية.</Txt>
    </Card>
    {STORY_CHAPTERS.map((chapter) => {
      const progress = Math.min(getStoryChapterProgress(state, chapter.id), chapter.target);
      const completed = state.story >= chapter.id;
      const available = canClaimStoryChapter(state, chapter.id);
      const tone = completed ? "jade" : available ? "gold" : "muted";
      return <Card key={chapter.id} style={[styles.storyCard, completed && styles.storyComplete]}>
        <View style={styles.storyTop}>
          <Pill label={completed ? "مكتمل" : available ? "جاهز للاستلام" : chapter.id === state.story + 1 ? "قيد التقدم" : "مغلق"} tone={tone} />
          <Txt muted style={styles.storyChapter}>{chapter.chapter}</Txt>
        </View>
        <Txt style={styles.storyTitle}>{chapter.title}</Txt>
        <Txt muted style={styles.storyNarrative}>{chapter.narrative}</Txt>
        <Txt style={styles.storyObjective}>{chapter.objective}</Txt>
        <View style={styles.storyProgress}>
          <Txt muted style={styles.progressLabel}>{progress} / {chapter.target}</Txt>
          <Meter value={progress} max={chapter.target} color={completed ? palette.jade : palette.gold} height={6} />
        </View>
        <View style={styles.storyFooter}>
          <Pill label={`+${chapter.rewardGold} ذهب`} tone="gold" />
          <Pill label={`+${chapter.rewardXP} خبرة`} tone="jade" />
          <AppButton label={completed ? "تم الفصل" : available ? "استلام المكافأة" : "واصل التقدم"} icon={completed ? "checkmark" : "gift-outline"} onPress={() => update((current) => claimStoryChapter(current, chapter.id))} variant={available ? "jade" : "secondary"} small disabled={!available} />
        </View>
      </Card>;
    })}

    <SectionTitle title="المهام المتجددة" icon="calendar-outline" action={<Pill label="مكافآت متجددة" tone="gold" />} />
    {recurringGroups.map((group) => <View key={group.scope} style={styles.recurringGroup}>
      <View style={styles.recurringHeading}>
        <View style={styles.recurringHeadingText}><Txt style={styles.recurringTitle}>{group.title}</Txt><Txt muted style={styles.recurringSubtitle}>{group.subtitle}</Txt></View>
        <Icon name={group.icon as never} color={palette.gold} size={21} />
      </View>
      {group.missions.map((mission) => <Card key={mission.id} style={styles.questCard}>
        <AppButton
          label={mission.claimed ? "استُلمت" : mission.available ? "استلام" : "تابع التقدم"}
          icon={mission.claimed ? "checkmark" : "gift-outline"}
          onPress={() => update((current) => claimRecurringMission(current, group.scope, mission.id))}
          variant={mission.available ? "jade" : "secondary"}
          small
          disabled={!mission.available || mission.claimed}
        />
        <View style={styles.questBody}>
          <View style={styles.questHeading}><Pill label={group.scope === "daily" ? "يومي" : group.scope === "weekly" ? "أسبوعي" : "موسمي"} tone={group.scope === "season" ? "gold" : "jade"} /><Pill label={"+" + mission.rewardGold + " ذهب"} tone="gold" /></View>
          <Txt style={styles.questTitle}>{mission.title}</Txt>
          <Txt muted style={styles.questCopy}>{mission.description}</Txt>
          <View style={styles.questProgress}><Txt muted style={styles.progressLabel}>{mission.progress} / {mission.target}</Txt><Meter value={mission.progress} max={mission.target} color={mission.claimed ? palette.dim : palette.jade} height={6} /></View>
        </View>
        <View style={styles.questIcon}><Icon name={mission.icon as never} color={mission.claimed ? palette.dim : palette.gold} size={20} /></View>
      </Card>)}
    </View>)}

    <SectionTitle title="مهام اللاعب" icon="list-circle-outline" action={<Pill label={`${quests.filter((quest) => quest.available).length} جاهزة`} tone="jade" />} />
    {quests.map((quest) => {
      const tone = quest.category === "الزنزانة" || quest.category === "البرج" ? "gold" : quest.category === "الرحلات" ? "jade" : quest.category === "قتال" ? "red" : "muted";
      return <Card key={quest.id} style={styles.questCard}>
        <AppButton label={quest.claimed ? "استُلمت" : quest.available ? `استلم ${quest.rewardGold}` : "غير مكتملة"} icon={quest.claimed ? "checkmark" : "gift-outline"} onPress={() => quest.available && update((current) => claimQuest(current, quest.id))} variant={quest.available ? "jade" : "secondary"} small disabled={!quest.available || quest.claimed} />
        <View style={styles.questBody}>
          <View style={styles.questHeading}><Pill label={quest.category} tone={tone} /><Pill label={`+${quest.rewardGold} ذهب`} tone="gold" /></View>
          <Txt style={styles.questTitle}>{quest.title}</Txt>
          <Txt muted style={styles.questCopy}>{quest.description}</Txt>
          <View style={styles.questProgress}><Txt muted style={styles.progressLabel}>{quest.progress} / {quest.target}</Txt><Meter value={quest.progress} max={quest.target} color={quest.claimed ? palette.dim : palette.jade} height={6} /></View>
        </View>
        <View style={styles.questIcon}><Icon name={quest.icon as never} color={quest.claimed ? palette.dim : palette.gold} size={20} /></View>
      </Card>;
    })}

    <SectionTitle title="الأوسمة" icon="ribbon-outline" />
    <View style={styles.achievementList}>
      {achievementRows.map((item) => {
        const unlocked = !!state.achievements[item.id as keyof typeof state.achievements];
        return <Card key={item.id} style={[styles.achievementCard, unlocked && styles.achievementUnlocked]}>
          <View style={[styles.achievementIcon, unlocked && { backgroundColor: "rgba(230,199,124,0.13)" }]}><Icon name={item.icon} color={unlocked ? palette.gold : palette.dim} size={19} /></View>
          <View style={{ flex: 1, alignItems: "flex-end" }}><Txt style={[styles.questTitle, !unlocked && { color: palette.muted }]}>{item.title}</Txt><Txt muted style={styles.questCopy}>{item.description}</Txt></View>
          <Icon name={unlocked ? "checkmark-circle" : "lock-closed-outline"} color={unlocked ? palette.jade : palette.dim} size={18} />
        </Card>;
      })}
    </View>
    <SectionTitle title="مهام الاستكشاف" icon="map-outline" action={<Pill label="مكافآت ذهبية" tone="gold" />} />
    {EXPEDITION_TASKS.map((task) => {
      const progress = Math.min(state.expeditionsCompleted, task.target);
      const claimed = !!state.claimedQuestRewards[`task:${task.id}`];
      const available = canClaimExpeditionTask(state, task.id);
      return <Card key={task.id} style={styles.questCard}>
        <AppButton
          label={claimed ? "استُلمت" : available ? `استلم ${task.rewardGold}` : "غير مكتملة"}
          icon={claimed ? "checkmark" : "gift-outline"}
          onPress={() => update((current) => claimExpeditionTask(current, task.id))}
          variant={available ? "jade" : "secondary"}
          small
          disabled={!available || claimed}
        />
        <View style={styles.questBody}>
          <View style={styles.questHeading}>
            <Pill label="استكشاف" tone="jade" />
            <Pill label={`+${task.rewardGold} ذهب`} tone="gold" />
          </View>
          <Txt style={styles.questTitle}>{task.title}</Txt>
          <Txt muted style={styles.questCopy}>{task.description}</Txt>
          <View style={styles.questProgress}>
            <Txt muted style={styles.progressLabel}>{progress} / {task.target}</Txt>
            <Meter value={progress} max={task.target} color={claimed ? palette.dim : palette.jade} height={6} />
          </View>
        </View>
        <View style={styles.questIcon}><Icon name={task.icon as never} color={claimed ? palette.dim : palette.gold} size={20} /></View>
      </Card>;
    })}

    <SectionTitle title="إنجازات الاستكشاف" icon="compass-outline" action={<Pill label="مكافآت ذهبية" tone="gold" />} />
    {EXPLORATION_ACHIEVEMENTS.map((achievement) => {
      const progress = Math.min(getExplorationAchievementProgress(state, achievement.id), achievement.target);
      const claimed = !!state.claimedQuestRewards[`achievement:${achievement.id}`];
      const available = canClaimExplorationAchievement(state, achievement.id);
      return <Card key={achievement.id} style={styles.questCard}>
        <AppButton
          label={claimed ? "استُلمت" : available ? `استلم ${achievement.rewardGold}` : "غير مكتمل"}
          icon={claimed ? "checkmark" : "gift-outline"}
          onPress={() => update((current) => claimExplorationAchievement(current, achievement.id))}
          variant={available ? "jade" : "secondary"}
          small
          disabled={!available || claimed}
        />
        <View style={styles.questBody}>
          <View style={styles.questHeading}>
            <Pill label="استكشاف" tone="jade" />
            <Pill label={`+${achievement.rewardGold} ذهب`} tone="gold" />
          </View>
          <Txt style={styles.questTitle}>{achievement.title}</Txt>
          <Txt muted style={styles.questCopy}>{achievement.description}</Txt>
          <View style={styles.questProgress}>
            <Txt muted style={styles.progressLabel}>{progress} / {achievement.target}</Txt>
            <Meter value={progress} max={achievement.target} color={claimed ? palette.dim : palette.jade} height={6} />
          </View>
        </View>
        <View style={styles.questIcon}><Icon name={achievement.icon as never} color={claimed ? palette.dim : palette.gold} size={20} /></View>
      </Card>;
    })}

    <Card style={styles.summary}>
      <View style={styles.summaryTop}><Icon name="book-outline" color={palette.gold} size={23} /><Txt style={styles.summaryTitle}>لوحة التكليفات</Txt></View>
      <View style={styles.summaryStats}>
        <View style={styles.stat}><Txt style={styles.statValue}>{LONG_QUESTS.length}</Txt><Txt muted style={styles.statLabel}>مهمة متنوعة</Txt></View>
        <View style={styles.stat}><Txt style={styles.statValue}>{readyCount}</Txt><Txt muted style={styles.statLabel}>جاهزة للاستلام</Txt></View>
        <View style={styles.stat}><Txt style={styles.statValue}>{claimedCount}</Txt><Txt muted style={styles.statLabel}>مكتملة</Txt></View>
      </View>
      <Meter value={claimedCount} max={LONG_QUESTS.length} color={palette.gold} height={8} />
    </Card>
    {notice ? <Card style={styles.notice}><Icon name="information-circle-outline" color={palette.jade} size={17} /><Txt style={styles.noticeText}>{notice}</Txt></Card> : null}
    {groups.map((group) => <View key={group.tier} style={styles.group}>
      <SectionTitle title={`مهام ${group.tier}`} icon="flag-outline" action={<Pill label={`${group.quests.filter((q) => q.claimed).length}/${group.quests.length}`} tone={TONES[group.tier]} />} />
      {group.quests.map((quest) => {
        const ready = quest.progress >= quest.target && !quest.claimed;
        return <Card key={quest.id} style={[styles.longQuest, ready && styles.questReady, quest.claimed && styles.questClaimed]}>
          <View style={styles.questTop}>
            <AppButton label={quest.claimed ? "تم الاستلام" : ready ? "استلام المكافأة" : "قيد التقدم"} icon={quest.claimed ? "checkmark" : "gift-outline"} onPress={() => claimLong(quest.id)} variant={ready ? "jade" : "secondary"} small disabled={!ready} />
            <View style={styles.questTitleBlock}>
              <Pill label={quest.metric === "days" ? "مهمة طويلة" : group.tier} tone={quest.metric === "days" ? "gold" : TONES[group.tier]} />
              <Txt style={styles.longQuestTitle}>{quest.title}</Txt>
            </View>
          </View>
          <Txt muted style={styles.questDescription}>{quest.description}</Txt>
          <View style={styles.progressHeader}><Txt style={styles.progressText}>{quest.progress.toLocaleString("en-US")} / {quest.target.toLocaleString("en-US")}</Txt><Txt muted style={styles.progressText}>التقدم</Txt></View>
          <Meter value={quest.progress} max={quest.target} color={quest.claimed ? palette.dim : ready ? palette.gold : palette.jade} height={6} />
          <View style={styles.rewards}>
            <Pill label={`+${quest.gold.toLocaleString("en-US")} ذهب`} tone="gold" />
            <Pill label={`+${quest.xp.toLocaleString("en-US")} خبرة`} tone="jade" />
            {quest.gems ? <Pill label={`+${quest.gems} جوهرة`} tone="gold" /> : null}
            {quest.fragments ? <Pill label={`+${quest.fragments} قطعة`} tone="muted" /> : null}
          </View>
        </Card>;
      })}
    </View>)}

  </AppScreen>;
}

const styles = StyleSheet.create({
  storyIntro: { padding: 14, gap: 5, borderColor: "rgba(230,199,124,0.22)", backgroundColor: "#141C27" },
  storyIntroTitle: { fontSize: 14, fontWeight: "900", color: palette.gold },
  storyCard: { padding: 13, gap: 8, backgroundColor: "#111A25" },
  storyComplete: { borderColor: "rgba(98,216,195,0.28)" },
  storyTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  storyChapter: { fontSize: 10, fontWeight: "800" },
  storyTitle: { fontSize: 16, fontWeight: "900", color: palette.text },
  storyNarrative: { fontSize: 11, lineHeight: 18, textAlign: "right" },
  storyObjective: { fontSize: 11, lineHeight: 17, fontWeight: "800", color: palette.jade, textAlign: "right" },
  storyProgress: { width: "100%", flexDirection: "row", alignItems: "center", gap: 8 },
  storyFooter: { flexDirection: "row-reverse", alignItems: "center", flexWrap: "wrap", gap: 7 },
  dungeonCard: { padding: 15, flexDirection: "row", alignItems: "center", gap: 10, borderColor: "rgba(230,199,124,0.28)", backgroundColor: "#171C25" },
  dungeonIcon: { width: 43, height: 43, borderRadius: 15, backgroundColor: "rgba(230,199,124,0.11)", alignItems: "center", justifyContent: "center" },
  dungeonBody: { flex: 1, alignItems: "flex-end", gap: 4 },
  dungeonTitle: { fontSize: 16, fontWeight: "900" },
  cardCopy: { fontSize: 11, lineHeight: 17, textAlign: "right" },
  towerCard: { padding: 15, flexDirection: "row", alignItems: "center", gap: 10 },
  towerBadge: { width: 43, height: 43, borderRadius: 15, backgroundColor: "rgba(169,154,232,0.11)", alignItems: "center", justifyContent: "center" },
  towerBody: { flex: 1, alignItems: "flex-end", gap: 4 },
  towerTitle: { fontSize: 15, fontWeight: "900" },
  modeCard: { gap: 9, padding: 14, backgroundColor: "#171C25" },
  modeIntro: { flexDirection: "row", alignItems: "center", justifyContent: "flex-start", gap: 7 },
  modeTitle: { fontSize: 13, fontWeight: "900" },
  modeButtons: { flexDirection: "row", gap: 8 },
  modeHint: { fontSize: 10, lineHeight: 15, textAlign: "right" },
  recurringGroup: { gap: 8, marginBottom: 5 },
  recurringHeading: { flexDirection: "row", alignItems: "center", justifyContent: "flex-start", gap: 10, paddingHorizontal: 3, paddingVertical: 4 },
  recurringHeadingText: { flex: 1, alignItems: "flex-end", gap: 2 },
  recurringTitle: { fontSize: 15, fontWeight: "900" },
  recurringSubtitle: { fontSize: 10 },
  recurringNote: { fontSize: 10, textAlign: "right", lineHeight: 16 },
  questCard: { padding: 12, flexDirection: "row", alignItems: "center", gap: 9 },
  questBody: { flex: 1, alignItems: "flex-end", gap: 5 },
  questHeading: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 },
  questTitle: { fontSize: 13, fontWeight: "900" },
  questCopy: { fontSize: 11, lineHeight: 16, textAlign: "right" },
  questProgress: { width: "100%", flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 },
  progressLabel: { fontSize: 10, minWidth: 36 },
  questIcon: { width: 37, height: 37, borderRadius: 13, backgroundColor: "rgba(230,199,124,0.08)", alignItems: "center", justifyContent: "center" },
  achievementList: { gap: 8 },
  achievementCard: { padding: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  achievementUnlocked: { borderColor: "rgba(98,216,195,0.25)" },
  achievementIcon: { width: 39, height: 39, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.05)", alignItems: "center", justifyContent: "center" },

  summary: { padding: 15, gap: 13, backgroundColor: "#17252B", borderColor: "rgba(230,199,124,0.22)" },
  summaryTop: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 9 },
  summaryTitle: { fontSize: 16, fontWeight: "900" },
  summaryStats: { flexDirection: "row", justifyContent: "space-around" },
  stat: { alignItems: "center", gap: 3 },
  statValue: { color: palette.gold, fontSize: 20, fontWeight: "900" },
  statLabel: { fontSize: 10 },
  notice: { padding: 11, flexDirection: "row", alignItems: "center", gap: 8 },
  noticeText: { flex: 1, textAlign: "right", fontSize: 11 },
  group: { gap: 9, marginTop: 8 },
  longQuest: { padding: 13, gap: 9 },
  questReady: { borderColor: "rgba(230,199,124,0.5)", backgroundColor: "rgba(230,199,124,0.06)" },
  questClaimed: { opacity: 0.65 },
  questTop: { flexDirection: "row", alignItems: "center", gap: 9 },
  questTitleBlock: { flex: 1, alignItems: "flex-end", gap: 5 },
  longQuestTitle: { fontSize: 14, fontWeight: "900", textAlign: "right" },
  questDescription: { fontSize: 11, lineHeight: 18, textAlign: "right" },
  progressHeader: { flexDirection: "row", justifyContent: "space-between" },
  progressText: { fontSize: 10, color: palette.muted },
  rewards: { flexDirection: "row", flexWrap: "wrap", gap: 6, justifyContent: "flex-end" },
});
