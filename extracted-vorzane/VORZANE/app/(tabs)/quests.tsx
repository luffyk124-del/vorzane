import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { AppButton, AppScreen, Card, Icon, Meter, PageTitle, Pill, SectionTitle, Txt } from "../../src/components/ui";
import { LONG_QUESTS, getLongQuestProgress, claimLongQuest, type LongQuest } from "../../src/game/longQuests";
import { useGame } from "../../src/contexts/GameContext";
import { palette } from "../../src/theme";

const TIERS: LongQuest["tier"][] = ["سهل", "متوسط", "صعب", "نخبوي", "ملحمي"];
const TONES: Record<LongQuest["tier"], "jade" | "gold" | "red" | "violet" | "muted"> = {
  "سهل": "jade", "متوسط": "gold", "صعب": "red", "نخبوي": "violet", "ملحمي": "gold",
};

export default function QuestsScreen() {
  const { state, update } = useGame();
  const [notice, setNotice] = useState("");
  const [now] = useState(Date.now());
  const groups = useMemo(() => TIERS.map((tier) => ({
    tier,
    quests: LONG_QUESTS.filter((quest) => quest.tier === tier).map((quest) => ({
      ...quest,
      progress: Math.min(getLongQuestProgress(state, quest, now), quest.target),
      claimed: state.claimedLongQuestIds.includes(quest.id),
    })),
  })), [state, now]);
  const claim = (id: string) => {
    const result = claimLongQuest(state, id, now);
    if (result.error) { setNotice(result.error); return; }
    update(() => result.state);
    setNotice("تم استلام المكافأة وإضافتها إلى رصيدك.");
  };
  const claimedCount = state.claimedLongQuestIds.filter((id) => LONG_QUESTS.some((quest) => quest.id === id)).length;
  const readyCount = LONG_QUESTS.filter((quest) => !state.claimedLongQuestIds.includes(quest.id) && getLongQuestProgress(state, quest, now) >= quest.target).length;

  return <AppScreen>
    <PageTitle eyebrow="سجل الإنجازات" title="المهام" subtitle="أهداف مستقلة عن التجوال والميادين. ابدأ من المهام السهلة، ثم افتح تحديات تمتد لأيام وأسابيع." trailing={<Pill label={`${claimedCount}/${LONG_QUESTS.length}`} icon="trophy" tone="gold" />} />
    <Card style={styles.summary}>
      <View style={styles.summaryTop}><Icon name="scroll" color={palette.gold} size={23} /><Txt style={styles.summaryTitle}>لوحة التكليفات</Txt></View>
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
        return <Card key={quest.id} style={[styles.quest, ready && styles.questReady, quest.claimed && styles.questClaimed]}>
          <View style={styles.questTop}>
            <AppButton label={quest.claimed ? "تم الاستلام" : ready ? "استلام المكافأة" : "قيد التقدم"} icon={quest.claimed ? "checkmark" : "gift-outline"} onPress={() => claim(quest.id)} variant={ready ? "jade" : "secondary"} small disabled={!ready} />
            <View style={styles.questTitleBlock}>
              <Pill label={quest.metric === "days" ? "مهمة طويلة" : group.tier} tone={quest.metric === "days" ? "violet" : TONES[group.tier]} />
              <Txt style={styles.questTitle}>{quest.title}</Txt>
            </View>
          </View>
          <Txt muted style={styles.questDescription}>{quest.description}</Txt>
          <View style={styles.progressHeader}><Txt style={styles.progressText}>{quest.progress.toLocaleString("en-US")} / {quest.target.toLocaleString("en-US")}</Txt><Txt muted style={styles.progressText}>التقدم</Txt></View>
          <Meter value={quest.progress} max={quest.target} color={quest.claimed ? palette.dim : ready ? palette.gold : palette.jade} height={6} />
          <View style={styles.rewards}>
            <Pill label={`+${quest.gold.toLocaleString("en-US")} ذهب`} tone="gold" />
            <Pill label={`+${quest.xp.toLocaleString("en-US")} خبرة`} tone="jade" />
            {quest.gems ? <Pill label={`+${quest.gems} جوهرة`} tone="violet" /> : null}
            {quest.fragments ? <Pill label={`+${quest.fragments} قطعة`} tone="muted" /> : null}
          </View>
        </Card>;
      })}
    </View>)}
  </AppScreen>;
}

const styles = StyleSheet.create({
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
  quest: { padding: 13, gap: 9 },
  questReady: { borderColor: "rgba(230,199,124,0.5)", backgroundColor: "rgba(230,199,124,0.06)" },
  questClaimed: { opacity: 0.65 },
  questTop: { flexDirection: "row", alignItems: "center", gap: 9 },
  questTitleBlock: { flex: 1, alignItems: "flex-end", gap: 5 },
  questTitle: { fontSize: 14, fontWeight: "900", textAlign: "right" },
  questDescription: { fontSize: 11, lineHeight: 18, textAlign: "right" },
  progressHeader: { flexDirection: "row", justifyContent: "space-between" },
  progressText: { fontSize: 10, color: palette.muted },
  rewards: { flexDirection: "row", flexWrap: "wrap", gap: 6, justifyContent: "flex-end" },
});
