import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { AppButton, AppScreen, Card, Icon, Meter, PageTitle, Pill, SectionTitle, Txt } from "../../src/components/ui";
import { getRoamingEvent, resolveRoamingChoice, getTravellingMerchant, buyMerchantItem, completeRoamingMerchantVisit, buyRoamingHealthRefill, refreshRoamingHealth, ROAMING_EVENT_COUNT, type RoamingEvent, type RoamingMerchantItem } from "../../src/game/roaming";
import { useGame } from "../../src/contexts/GameContext";
import { BattleArena } from "../../src/components/BattleArena";
import { createBattleSequence, type BattleSequence, type BattleResult } from "../../src/game/engine";
import { palette } from "../../src/theme";

export default function RoamingScreen() {
  const { state, update } = useGame();
  const [event, setEvent] = useState<RoamingEvent | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [merchantBought, setMerchantBought] = useState<string[]>([]);
  const [merchantStock, setMerchantStock] = useState<RoamingMerchantItem[]>([]);
  const [eventResult, setEventResult] = useState("");
  const [eventRewards, setEventRewards] = useState("");
  const [battleSequence, setBattleSequence] = useState<BattleSequence | null>(null);
  const [clock, setClock] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setClock(Date.now()), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => { const timer = setInterval(() => update((current) => refreshRoamingHealth(current)), 60_000); update((current) => refreshRoamingHealth(current)); return () => clearInterval(timer); }, [update]);
  const explore = () => {
    if (!state.hero) { setNotice("أنشئ شخصيتك أولًا."); return; }
    if (state.roaming.health < 20) { setNotice("تحتاج إلى 20 صحة على الأقل لبدء التجوال."); return; }
    setMerchantBought([]);
    const eventSeed = Date.now() + state.roaming.eventsCompleted * 97;
    const nextEvent = getRoamingEvent(state, eventSeed);
    setEvent(nextEvent);
    setMerchantStock(nextEvent.kind === "merchant" ? getTravellingMerchant(state, eventSeed) : []);
    setNotice("");
    setEventResult("");
    setEventRewards("");
  };
  const choose = (choiceId: string) => {
    if (!event || busy) return;
    const selected = event.choices.find((choice) => choice.id === choiceId);
    if (selected?.outcome.battle) { const sequence = createBattleSequence(state, "roaming"); if (!sequence) { setNotice("تعذر بدء المواجهة."); return; } setBattleSequence(sequence); setEvent(null); setEventResult(""); setEventRewards(""); return; }
    setBusy(true);
    const result = resolveRoamingChoice(state, event, choiceId);
    update(() => result.state);
    setNotice("");
    setEventResult(result.message);
    setEventRewards(result.rewards);
    setEvent(null);
    setBusy(false);
  };
  const buy = (item: RoamingMerchantItem) => {
    const result = buyMerchantItem(state, item);
    if (result.error) { setNotice(result.error); return false; }
    update(() => result.state);
    setNotice("تمت الصفقة. أضيفت المكافأة إلى ممتلكاتك.");
    return true;
  };

  return <AppScreen>
    <PageTitle eyebrow="استكشف العالم المفتوح" title="التجوال" subtitle="تحرك بحرية بين المناطق؛ كل رحلة قد تحمل لقاءً أو خطرًا أو فرصة لا تتكرر." trailing={<Pill label={`${state.roaming.eventsCompleted} حدث`} icon="compass" tone="jade" />} />
    <Card style={styles.travelCard}>
      <View style={styles.travelTop}>
        <View style={styles.travelIcon}><Icon name="compass" color={palette.gold} size={24} /></View>
        <View style={styles.travelText}>
          <Txt style={styles.travelTitle}>دروب VORZANE</Txt>
          <Txt muted style={styles.travelCopy}>مكتبة تضم {ROAMING_EVENT_COUNT}+ حدثًا متنوعًا في مناطق العالم.</Txt>
        </View>
      </View>
      <View style={styles.healthHeader}><Txt muted style={styles.small}>الصحة أثناء التجوال</Txt><Txt style={styles.healthValue}>{state.roaming.health} / {state.roaming.maxHealth}</Txt></View>
      <Meter value={state.roaming.health} max={state.roaming.maxHealth} color={state.roaming.health < 35 ? palette.red : palette.jade} height={9} />
      <Txt muted style={styles.small}>{state.roaming.health >= state.roaming.maxHealth ? "الصحة مكتملة." : `الصحة التالية بعد ${Math.max(1, 60 - Math.floor(Math.max(0, clock - (state.roaming.healthUpdatedAt || clock)) / 1000) % 60)} ثانية • نقطة واحدة كل دقيقة`}</Txt>
      <AppButton label={`تعبئة +20 صحة • 20 جوهرة (${state.roaming.gemRefillDate === new Date().toISOString().slice(0, 10) ? state.roaming.gemRefillsUsed : 0}/10 اليوم)`} icon="heart" variant="secondary" small disabled={!state.hero || state.roaming.health >= state.roaming.maxHealth || state.gems < 20 || (state.roaming.gemRefillDate === new Date().toISOString().slice(0, 10) && state.roaming.gemRefillsUsed >= 10)} onPress={() => { const result = buyRoamingHealthRefill(state); if (result.error) { setNotice(result.error); return; } update(() => result.state); setNotice(`تمت تعبئة ${result.restored} نقطة صحة مقابل 20 جوهرة.`); }} />
      <View style={styles.resources}>
        <Pill label={`${state.gold.toLocaleString("en-US")} ذهب`} icon="logo-usd" tone="muted" />
        <Pill label={`${state.gems.toLocaleString("en-US")} جوهرة`} icon="diamond" tone="jade" />
      </View>
      <AppButton label={event ? "أكمل الحدث الحالي" : eventResult ? "تابع التجوال" : "ابدأ التجوال"} icon="compass" onPress={event ? () => {} : eventResult ? () => { if (state.roaming.health < 20) { setNotice("انخفضت صحتك عن 20؛ لا يمكنك مواصلة السير الآن."); return; } setEventResult(""); setEventRewards(""); setNotice(""); explore(); } : explore} disabled={!!event || busy || !state.hero || (!event && !eventResult && state.roaming.health < 20)} />
    </Card>

    {event ? <Card style={styles.eventCard}>
      <View style={styles.eventTop}>
        <Icon name={event.kind === "merchant" ? "storefront" : "sparkles"} size={21} color={palette.gold} />
      </View>
      <Txt style={styles.region}>{event.region}</Txt>
      <Txt style={styles.eventTitle}>{event.title}</Txt>
      <View style={styles.storyPanel}><Txt style={styles.storyHeading}>الحكاية</Txt><Txt style={styles.eventStory}>{event.story}</Txt></View>
      {event.kind === "merchant" ? <Card style={styles.merchantCard}>
        <View style={styles.merchantHeader}><Icon name="storefront" color={palette.gold} size={22} /><View style={{ flex: 1, alignItems: "flex-end" }}><Txt style={styles.merchantTitle}>بضاعة ساهر لهذا اللقاء</Txt><Txt muted style={styles.small}>هذه القافلة لن تبقى هنا طويلًا</Txt></View></View>
        {merchantStock.map((item) => <View key={item.id} style={styles.merchantRow}>
          <View style={styles.merchantInfo}>
            <Txt style={styles.itemName}>{item.name}</Txt>
            <Txt muted style={styles.small}>{item.description}</Txt>
            <Txt style={styles.price}>{item.price.toLocaleString("en-US")} ذهب</Txt>
          </View>
          <AppButton label={merchantBought.includes(item.id) ? "تم الشراء" : "شراء"} icon="cart-outline" small variant="secondary" disabled={merchantBought.includes(item.id)} onPress={() => { if (buy(item)) setMerchantBought((items) => [...items, item.id]); }} />
        </View>)}
      </Card> : null}
      {event.kind === "merchant" ? (
        <AppButton label="تابع الطريق" icon="compass" onPress={() => {
          update(() => completeRoamingMerchantVisit(state, event));
          setEvent(null);
          setMerchantStock([]);
          setNotice("غادرت قافلة ساهر، ويمكنك مواصلة التجوال.");
        }} />
      ) : (
        <>
          <SectionTitle title="ماذا ستفعل؟" icon="git-branch-outline" />
          {event.choices.map((choice) => <PressChoice key={choice.id} label={choice.label} onPress={() => choose(choice.id)} disabled={busy} />)}
        </>
      )}
    </Card> : null}

    {eventResult ? <Card style={styles.resultCard}>
      <Txt style={styles.resultTitle}>نتيجة اختيارك</Txt>
      <Txt style={styles.resultStory}>{eventResult}</Txt>
      {eventRewards ? <Txt style={styles.resultRewards}>{eventRewards}</Txt> : null}
    </Card> : null}

    {battleSequence ? <BattleArena sequence={battleSequence} onBattleSettled={(result: BattleResult) => { const last = battleSequence.turns[battleSequence.turns.length - 1]; const remaining = last?.heroHP ?? 0; const health = Math.max(0, Math.round(state.roaming.maxHealth * remaining / battleSequence.heroMaxHP)); update(() => ({ ...result.state, roaming: { ...result.state.roaming, health, healthUpdatedAt: Date.now(), eventsCompleted: result.state.roaming.eventsCompleted + 1 } })); setEventResult(result.won ? "انتصرت في المواجهة وتستطيع متابعة الطريق." : "لم تنجح في المواجهة؛ تحتاج إلى استعادة صحتك قبل متابعة الطريق."); setEventRewards(result.won ? "تم تسجيل نتيجة المواجهة." : "استعد صحتك قبل العودة إلى الطريق."); setNotice(result.won ? "انتصرت في المواجهة." : "انتهت المواجهة بهزيمتك."); }} onClose={() => setBattleSequence(null)} /> : null}
    {notice ? <Card style={styles.notice}><Icon name="information-circle-outline" color={palette.jade} size={18} /><Txt style={styles.noticeText}>{notice}</Txt></Card> : null}

  </AppScreen>;
}

function PressChoice({ label, onPress, disabled }: { label: string; onPress: () => void; disabled: boolean }) {
  return <View style={styles.choiceWrap}>
    <AppButton label={label} onPress={onPress} disabled={disabled} variant="secondary" style={styles.choiceButton} />
  </View>;
}

const styles = StyleSheet.create({
  travelCard: { padding: 16, gap: 12, backgroundColor: "#13242C", borderColor: "rgba(98,216,195,0.22)" },
  travelTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  travelIcon: { width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(230,199,124,0.12)" },
  travelText: { flex: 1, alignItems: "flex-end", gap: 4 },
  travelTitle: { fontSize: 16, fontWeight: "900" },
  travelCopy: { fontSize: 11, lineHeight: 18, textAlign: "right" },
  healthHeader: { flexDirection: "row", justifyContent: "space-between" },
  healthValue: { color: palette.jade, fontWeight: "900", fontSize: 12 },
  small: { fontSize: 10, lineHeight: 16 },
  resources: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  eventCard: { padding: 16, gap: 12, borderColor: "rgba(230,199,124,0.32)", backgroundColor: "#1B2529" },
  eventTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  region: { color: palette.jade, fontSize: 11, fontWeight: "800", textAlign: "right" },
  eventTitle: { fontSize: 21, fontWeight: "900", textAlign: "right" },
  storyPanel: { padding: 12, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.035)", borderWidth: 1, borderColor: "rgba(230,199,124,0.16)", gap: 7 },
  storyHeading: { color: palette.gold, fontSize: 12, fontWeight: "900", textAlign: "right" },
  eventStory: { fontSize: 13, lineHeight: 23, textAlign: "right" },
  choiceButton: { marginTop: 1 },
  choiceWrap: { gap: 0 },
  resultCard: { padding: 16, gap: 9, borderColor: "rgba(98,216,195,0.3)", backgroundColor: "#14272A" },
  resultTitle: { fontSize: 14, fontWeight: "900", textAlign: "right", color: palette.jade },
  resultStory: { fontSize: 13, lineHeight: 22, textAlign: "right" },
  resultRewards: { fontSize: 12, lineHeight: 19, textAlign: "right", color: palette.gold, fontWeight: "900" },
  notice: { padding: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  noticeText: { flex: 1, fontSize: 12, textAlign: "right" },
  merchantCard: { padding: 14, gap: 12, backgroundColor: "#25251F", borderColor: "rgba(230,199,124,0.28)" },
  merchantHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  merchantTitle: { fontSize: 15, fontWeight: "900" },
  merchantRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: palette.line },
  merchantInfo: { flex: 1, alignItems: "flex-end", gap: 3 },
  itemName: { fontSize: 13, fontWeight: "900" },
  price: { fontSize: 11, color: palette.gold, fontWeight: "900" },
  historyCard: { flexDirection: "row", justifyContent: "space-around", padding: 14 },
  historyRow: { alignItems: "center", gap: 4 },
  historyValue: { fontSize: 18, fontWeight: "900", color: palette.gold },
});
