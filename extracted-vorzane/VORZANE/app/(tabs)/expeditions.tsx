import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AppButton, AppScreen, Card, Icon, Meter, PageTitle, Pill, SectionTitle, Txt } from "../../src/components/ui";
import { EXPEDITIONS, findExpedition } from "../../src/game/catalog";
import { beginOrQueueExpedition } from "../../src/game/engine";
import { useGame } from "../../src/contexts/GameContext";
import { palette } from "../../src/theme";

const durationLabel = (seconds: number) => seconds < 60 ? `${seconds} ثانية` : seconds < 3600 ? `${Math.round(seconds / 60)} دقيقة` : `${Math.round(seconds / 3600)} ساعة`;
const timeLabel = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}` : `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
};

export default function ExpeditionsScreen() {
  const { state, update, clearReport } = useGame();
  const [now, setNow] = useState(Date.now());
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const begin = (planId: string) => {
    const result = beginOrQueueExpedition(state, planId, now);
    if (result.error) { setNotice(result.error); return; }
    update(() => result.state);
    const plan = findExpedition(planId);
    setNotice(result.queued ? `أُضيفت «${plan?.name}» إلى صف الرحلات.` : `انطلق بطلك في «${plan?.name}».`);
  };

  const active = state.activeExpedition;
  const activePlan = active ? findExpedition(active.planId) : null;
  const activeProgress = active ? Math.min(100, Math.max(0, ((now - active.startedAt) / Math.max(1, active.endsAt - active.startedAt)) * 100)) : 0;
  const remaining = active ? active.endsAt - now : 0;

  return <AppScreen>
    <PageTitle eyebrow="نظام التقدم الخامل" title="الرحلات" subtitle="خطّط لمغامرتك؛ يعمل الوقت لصالحك حتى عندما تغلق اللعبة." trailing={<View style={styles.wallet}><Pill label={state.gold.toLocaleString("ar-EG")} icon="cash-outline" tone="gold" /></View>} />
    {notice ? <Pressable onPress={() => setNotice("")}><Card style={styles.notice}><Icon name="information-circle-outline" color={palette.jade} size={18} /><Txt style={styles.noticeText}>{notice}</Txt></Card></Pressable> : null}

    {active && activePlan ? <Card style={styles.activeCard}>
      <View style={styles.activeHeader}>
        <Pill label={remaining <= 0 ? "اكتملت الرحلة" : `متبقٍ ${timeLabel(remaining)}`} tone={remaining <= 0 ? "gold" : "jade"} icon="time-outline" />
        <View style={styles.activeName}><Txt style={styles.activeTitle}>{activePlan.name}</Txt><Txt muted style={styles.activeSub}>{activePlan.region}</Txt></View>
        <View style={styles.activeIcon}><Icon name={activePlan.icon as never} size={21} color={palette.gold} /></View>
      </View>
      <Meter value={activeProgress} max={100} color={remaining <= 0 ? palette.gold : palette.jade} height={8} />
      <View style={styles.rewardRow}><Txt muted style={styles.rewardSmall}>الغنائم المؤكدة عند الوصول</Txt><Txt style={styles.reward}>{activePlan.rewardGold} ذهب • {activePlan.rewardXP} خبرة</Txt></View>
    </Card> : <Card style={styles.emptyActive}><View style={styles.emptyIcon}><Icon name="compass-outline" color={palette.jade} size={22} /></View><View style={{ flex: 1, alignItems: "flex-end" }}><Txt style={styles.activeTitle}>لا توجد رحلة نشطة</Txt><Txt muted style={styles.activeSub}>اختر إحدى الخرائط أدناه لبدء مغامرتك.</Txt></View></Card>}

    {state.expeditionQueue.length > 0 ? <>
      <SectionTitle title={`صف الرحلات (${state.expeditionQueue.length}/3)`} icon="list-outline" />
      {state.expeditionQueue.map((item, index) => {
        const plan = findExpedition(item.planId);
        return <Card key={item.queueId} style={styles.queueCard}>
          <Pill label={`#${index + 1}`} tone="muted" />
          <View style={{ flex: 1, alignItems: "flex-end" }}><Txt style={styles.queueTitle}>{plan?.name ?? "رحلة"}</Txt><Txt muted style={styles.activeSub}>{plan?.region} • {durationLabel(plan?.durationSeconds ?? 0)}</Txt></View>
          <Icon name="hourglass-outline" size={18} color={palette.gold} />
        </Card>;
      })}
    </> : null}

    <SectionTitle title="اختر وجهتك" icon="map-outline" />
    <View style={styles.planList}>
      {EXPEDITIONS.map((plan, index) => {
        const queued = !!active && state.expeditionQueue.length >= 3;
        const levelLocked = !state.hero || state.hero.level < plan.requiredLevel;
        const difficultyTone = plan.difficulty === "سهل" ? "jade" : plan.difficulty === "متوسط" ? "gold" : "red";
        return <Card key={plan.id} style={styles.planCard}>
          <View style={styles.planTop}>
            <Pill label={plan.difficulty} tone={difficultyTone} />
            <View style={styles.planIcon}><Icon name={plan.icon as never} size={22} color={index % 2 ? palette.jade : palette.gold} /></View>
          </View>
          <Txt style={styles.planName}>{plan.name}</Txt>
          <Txt muted style={styles.region}>{plan.region}</Txt>
          <Txt muted style={styles.description}>{plan.description}</Txt>
          <View style={styles.planMeta}><Pill label={durationLabel(plan.durationSeconds)} icon="time-outline" tone="muted" /><Txt style={styles.reward}>{plan.rewardGold} ذهب • {plan.rewardXP} خبرة</Txt></View>
          <Pill label={`المستوى المطلوب ${plan.requiredLevel}`} icon={levelLocked ? "lock-closed-outline" : "checkmark-circle-outline"} tone={levelLocked ? "red" : "muted"} />
          <AppButton label={levelLocked ? `يتطلب المستوى ${plan.requiredLevel}` : queued ? "الصف ممتلئ" : active ? "أضف إلى الصف" : "ابدأ الرحلة"} icon={levelLocked ? "lock-closed-outline" : active ? "add-circle-outline" : "navigate"} onPress={() => begin(plan.id)} disabled={queued || levelLocked} variant={levelLocked ? "secondary" : active ? "secondary" : "jade"} small />
        </Card>;
      })}
    </View>

    {state.offlineSummary.length ? <>
      <SectionTitle title="غنائم عودتك" icon="gift-outline" />
      {state.offlineSummary.slice().reverse().map((report) => {
        const plan = findExpedition(report.planId);
        return <Card key={report.id} style={styles.reportCard}>
          <View style={{ flex: 1, alignItems: "flex-end" }}><Txt style={styles.queueTitle}>{plan?.name ?? "رحلة مكتملة"}</Txt><Txt muted style={styles.activeSub}>{report.failure ?? `+${report.gold} ذهب • +${report.xp} خبرة`}</Txt></View>
          <AppButton label="إخفاء" onPress={() => clearReport(report.id)} variant="ghost" small />
        </Card>;
      })}
    </> : null}
  </AppScreen>;
}

const styles = StyleSheet.create({
  wallet: { alignSelf: "flex-start" },
  notice: { padding: 12, flexDirection: "row", alignItems: "center", gap: 8, borderColor: "rgba(98,216,195,0.24)" },
  noticeText: { flex: 1, fontSize: 12, lineHeight: 18 },
  activeCard: { padding: 16, gap: 13, borderColor: "rgba(98,216,195,0.27)", backgroundColor: "#11252A" },
  activeHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 9 },
  activeName: { flex: 1, alignItems: "flex-end" },
  activeTitle: { fontSize: 15, fontWeight: "900" },
  activeSub: { fontSize: 11, marginTop: 4 },
  activeIcon: { width: 39, height: 39, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(230,199,124,0.10)" },
  rewardRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rewardSmall: { fontSize: 10 },
  reward: { color: palette.gold, fontWeight: "900", fontSize: 12 },
  emptyActive: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  emptyIcon: { width: 43, height: 43, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(98,216,195,0.10)" },
  queueCard: { padding: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  queueTitle: { fontSize: 13, fontWeight: "800" },
  planList: { gap: 11 },
  planCard: { padding: 15, gap: 8 },
  planTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  planIcon: { width: 43, height: 43, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(230,199,124,0.10)", borderWidth: 1, borderColor: "rgba(230,199,124,0.20)" },
  planName: { fontSize: 17, fontWeight: "900" },
  region: { fontSize: 11, marginTop: -5 },
  description: { fontSize: 12, lineHeight: 19, marginTop: 2 },
  planMeta: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 3, marginBottom: 2 },
  reportCard: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12 },
});
