import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { AppButton, AppScreen, Card, Icon, PageTitle, Pill, SectionTitle, Txt } from "../../src/components/ui";
import { clearDimasFloor, getDimasFloor, getDimasFloors, getDimasEvent, getDimasMerchantStock, resolveDimasEvent, buyDimasMerchantItem, type DimasEvent } from "../../src/game/dimas";
import { combatStats } from "../../src/game/stats";
import { useGame } from "../../src/contexts/GameContext";
import { palette } from "../../src/theme";

const milestoneLabel = (reward?: { kind: string; name: string; amount?: number }) => {
  if (!reward) return "";
  if (reward.kind === "weapon") return `سلاح نادر: ${reward.name}`;
  if (reward.kind === "companion") return `مرافق نادر: ${reward.name}`;
  return `+${reward.amount ?? 0} ${reward.kind === "gems" ? "جوهرة" : "قطعة"}`;
};

export default function DimasScreen() {
  const { state, update } = useGame();
  const [selected, setSelected] = useState(Math.min(300, state.dimas.highestFloor + 1));
  const [notice, setNotice] = useState("");
  const [event, setEvent] = useState<DimasEvent | null>(null);
  const floors = useMemo(() => getDimasFloors(), []);
  const current = getDimasFloor(selected);
  const power = state.hero ? combatStats(state).power : 0;
  const challenge = () => {
    const result = clearDimasFloor(state, selected);
    if (result.error) { setNotice(result.error); return; }
    update(() => result.state);
    const extra = result.loot ? ` وسقط لك ${result.loot.name}.` : "";
    setNotice(result.reward?.reward ? `اجتزت الطابق ${selected}! المكافأة الإضافية: ${milestoneLabel(result.reward.reward)}.${extra}` : `اجتزت الطابق ${selected} وحصلت على الذهب والخبرة.${extra}`);
    setSelected(Math.min(300, result.state.dimas.highestFloor + 1));
    setEvent(getDimasEvent(selected, result.state.hero?.level ?? 1, Date.now()));
  };

  return <AppScreen>
    <PageTitle eyebrow="الميدان الأسطوري" title="الديماس" subtitle="300 طابق متصاعد الصعوبة. كل طابق يمنح ذهبًا وخبرة، ومحطات محددة تخفي جوائز استثنائية." trailing={<Pill label={`${state.dimas.highestFloor}/300`} icon="layers" tone="gold" />} />
    <Card style={styles.hero}>
      <View style={styles.heroTop}><Icon name="trophy" color={palette.gold} size={27} /><View style={{ flex: 1, alignItems: "flex-end" }}><Txt style={styles.heroTitle}>درج المجد</Txt><Txt muted style={styles.small}>أعلى طابق وصلت إليه: {state.dimas.highestFloor}</Txt></View></View>
      <View style={styles.stats}>
        <View style={styles.stat}><Txt style={styles.value}>{power.toLocaleString("en-US")}</Txt><Txt muted style={styles.small}>قوتك</Txt></View>
        <View style={styles.stat}><Txt style={styles.value}>{state.gold.toLocaleString("en-US")}</Txt><Txt muted style={styles.small}>ذهب</Txt></View>
        <View style={styles.stat}><Txt style={styles.value}>{state.hero?.level ?? 0}</Txt><Txt muted style={styles.small}>المستوى</Txt></View>
      </View>
      <Txt style={styles.selectedTitle}>{current.title} — {current.name}</Txt>
      <Txt muted style={styles.small}>القوة المطلوبة: {current.requiredPower.toLocaleString("en-US")}</Txt>
      <View style={styles.rewardRow}>
        <Pill label={`+${current.gold.toLocaleString("en-US")} ذهب`} tone="gold" />
        <Pill label={`+${current.xp.toLocaleString("en-US")} خبرة`} tone="jade" />
      </View>
      {current.reward ? <Card style={styles.milestone}><Pill label="مكافأة محطة مميزة" tone="gold" /><Txt style={styles.milestoneText}>{milestoneLabel(current.reward)}</Txt></Card> : null}
      <AppButton label={selected <= state.dimas.highestFloor ? "تم اجتيازه" : selected === state.dimas.highestFloor + 1 ? "ابدأ تحدي الطابق" : "افتح الطوابق بالتتابع"} icon="sword" onPress={challenge} disabled={!state.hero || selected !== state.dimas.highestFloor + 1 || power < current.requiredPower} />
      {power < current.requiredPower && selected === state.dimas.highestFloor + 1 ? <Txt muted style={styles.warning}>تحتاج إلى {current.requiredPower - power} قوة إضافية لتجاوز هذا الطابق.</Txt> : null}
    </Card>

    {notice ? <Card style={styles.notice}><Icon name="information-circle-outline" color={palette.gold} size={18} /><Txt style={styles.noticeText}>{notice}</Txt></Card> : null}
    {event ? <Card style={styles.eventCard}>
      <View style={styles.eventTop}>
        <Pill label={event.kind === "merchant" ? "تاجر متنقل" : event.kind === "encounter" ? "مواجهة" : event.kind === "cache" ? "اكتشاف" : event.kind === "traveler" ? "لقاء" : "حدث غامض"} tone="gold" />
        <Icon name={event.kind === "merchant" ? "storefront" : "sparkles"} size={21} color={palette.gold} />
      </View>
      <Txt style={styles.eventRegion}>{event.region}</Txt>
      <Txt style={styles.eventTitle}>{event.title}</Txt>
      <Txt muted style={styles.eventStory}>{event.story}</Txt>
      {event.kind === "merchant" ? <View style={styles.merchantStock}>
        {getDimasMerchantStock(state.hero?.level ?? 1, state.dimas.highestFloor, Number(event.id.split("-").pop()) || Date.now()).map((item) => <View key={item.id} style={styles.merchantRow}>
          <View style={styles.merchantInfo}>
            <Txt style={styles.merchantName}>{item.name}</Txt>
            <Txt muted style={styles.eventHint}>{item.description}</Txt>
            <Txt style={styles.merchantPrice}>{item.price.toLocaleString("en-US")} ذهب</Txt>
          </View>
          <AppButton label="شراء" icon="cart-outline" small variant="secondary" onPress={() => {
            const bought = buyDimasMerchantItem(state, state.dimas.highestFloor, item.id, Number(event.id.split("-").pop()) || Date.now());
            if (bought.error) { setNotice(bought.error); return; }
            update(() => bought.state);
            setNotice("تمت الصفقة؛ أضيفت البضاعة إلى ممتلكاتك.");
          }} />
        </View>)}
      </View> : null}
      <SectionTitle title={event.kind === "merchant" ? "كيف تتصرف؟" : "اختر تصرفك"} icon="git-branch-outline" />
      {event.choices.map((choice) => <View key={choice.id} style={styles.eventChoice}>
        <AppButton label={choice.label} onPress={() => {
          const result = resolveDimasEvent(state, event, choice.id);
          update(() => result.state);
          setNotice(result.message);
          setEvent(null);
        }} variant="secondary" />
        <Txt muted style={styles.eventHint}>{choice.hint}</Txt>
      </View>)}
      <AppButton label="غادر اللقاء" onPress={() => setEvent(null)} variant="ghost" small />
    </Card> : null}

    <SectionTitle title="خريطة الطوابق" icon="grid-outline" action={<Pill label="1 — 300" tone="muted" />} />
    <ScrollView style={styles.floorScroll} nestedScrollEnabled contentContainerStyle={styles.floorGrid}>
      {floors.map((floor) => {
        const cleared = floor.floor <= state.dimas.highestFloor;
        const available = floor.floor === state.dimas.highestFloor + 1;
        const active = selected === floor.floor;
        return <Pressable key={floor.floor} onPress={() => setSelected(floor.floor)} style={[styles.floorTile, cleared && styles.floorCleared, active && styles.floorActive, floor.milestone && styles.floorMilestone]}>
          <Txt style={[styles.floorNumber, cleared && styles.clearedText]}>{floor.floor.toString().padStart(3, "0")}</Txt>
          <Txt muted style={styles.floorReward}>+{floor.xp.toLocaleString("en-US")} XP</Txt>
          <Txt muted style={styles.floorReward}>+{floor.gold.toLocaleString("en-US")} G</Txt>
          {floor.milestone ? <Icon name="gift" size={13} color={palette.gold} /> : available ? <Icon name="lock-open" size={13} color={palette.jade} /> : null}
        </Pressable>;
      })}
    </ScrollView>
    <SectionTitle title="المحطات الكبرى" icon="gift-outline" />
    <Card style={styles.milestoneList}>
      {[10,25,50,75,100,125,150,175,200,225,250,275,300].map((floor) => {
        const item = getDimasFloor(floor);
        return <View key={floor} style={styles.milestoneRow}>
          <Pill label={`طابق ${floor}`} tone={state.dimas.highestFloor >= floor ? "jade" : "gold"} />
          <Txt style={styles.milestoneName}>{milestoneLabel(item.reward)}</Txt>
        </View>;
      })}
    </Card>
  </AppScreen>;
}

const styles = StyleSheet.create({
  hero: { padding: 16, gap: 12, backgroundColor: "#1B1C2B", borderColor: "rgba(190,155,255,0.25)" },
  eventCard: { padding: 15, gap: 11, backgroundColor: "#20232B", borderColor: "rgba(230,199,124,0.35)" },
  eventTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  eventRegion: { color: palette.jade, textAlign: "right", fontSize: 10, fontWeight: "800" },
  eventTitle: { textAlign: "right", fontSize: 18, fontWeight: "900" },
  eventStory: { textAlign: "right", fontSize: 12, lineHeight: 21 },
  eventChoice: { gap: 4 },
  eventHint: { textAlign: "right", fontSize: 10, lineHeight: 16 },
  merchantStock: { gap: 8 },
  merchantRow: { flexDirection: "row", alignItems: "center", gap: 9, borderTopWidth: 1, borderTopColor: palette.line, paddingTop: 9 },
  merchantInfo: { flex: 1, alignItems: "flex-end", gap: 3 },
  merchantName: { fontSize: 12, fontWeight: "900", textAlign: "right" },
  merchantPrice: { color: palette.gold, fontSize: 11, fontWeight: "900" },
  heroTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  heroTitle: { fontSize: 19, fontWeight: "900" },
  small: { fontSize: 10, lineHeight: 16, textAlign: "right" },
  stats: { flexDirection: "row", justifyContent: "space-around", paddingVertical: 8, borderTopWidth: 1, borderBottomWidth: 1, borderColor: palette.line },
  stat: { alignItems: "center", gap: 3 },
  value: { color: palette.gold, fontSize: 16, fontWeight: "900" },
  selectedTitle: { fontSize: 17, fontWeight: "900", textAlign: "right" },
  rewardRow: { flexDirection: "row", gap: 8, justifyContent: "flex-end" },
  milestone: { padding: 10, alignItems: "flex-end", gap: 6, backgroundColor: "rgba(230,199,124,0.08)" },
  milestoneText: { color: palette.gold, fontWeight: "900", fontSize: 12, textAlign: "right" },
  warning: { color: palette.red, textAlign: "right", fontSize: 11 },
  notice: { padding: 11, flexDirection: "row", gap: 8, alignItems: "center" },
  noticeText: { flex: 1, fontSize: 11, textAlign: "right" },
  floorScroll: { maxHeight: 540 },
  floorGrid: { flexDirection: "row", flexWrap: "wrap", gap: 7, paddingBottom: 8 },
  floorTile: { width: "18.5%", minHeight: 76, padding: 5, borderWidth: 1, borderColor: palette.line, borderRadius: 10, backgroundColor: "#101D25", alignItems: "center", justifyContent: "center", gap: 2 },
  floorCleared: { backgroundColor: "rgba(98,216,195,0.10)", borderColor: "rgba(98,216,195,0.30)" },
  floorActive: { borderColor: palette.gold, borderWidth: 2 },
  floorMilestone: { backgroundColor: "rgba(230,199,124,0.09)" },
  floorNumber: { color: palette.text, fontSize: 14, fontWeight: "900" },
  clearedText: { color: palette.jade },
  floorReward: { fontSize: 8 },
  milestoneList: { padding: 13, gap: 10 },
  milestoneRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  milestoneName: { flex: 1, textAlign: "right", fontSize: 11, fontWeight: "700" },
});
