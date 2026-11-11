import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { AppButton, AppScreen, Card, Icon, Meter, PageTitle, Pill, SectionTitle, Txt } from "../../src/components/ui";
import { getRoamingEvent, resolveRoamingChoice, getTravellingMerchant, buyMerchantItem, ROAMING_EVENT_COUNT, type RoamingEvent } from "../../src/game/roaming";
import { useGame } from "../../src/contexts/GameContext";
import { palette } from "../../src/theme";

export default function RoamingScreen() {
  const { state, update } = useGame();
  const [event, setEvent] = useState<RoamingEvent | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [merchantBought, setMerchantBought] = useState<string[]>([]);
  const merchant = useMemo(() => getTravellingMerchant(state), [state.roaming.eventsCompleted, state.gold, state.roaming.fragments, state.hero?.level]);
  const explore = () => {
    if (!state.hero) { setNotice("أنشئ شخصيتك أولًا."); return; }
    if (state.roaming.health <= 0) { setNotice("تحتاج إلى استعادة صحتك قبل مواصلة التجوال."); return; }
    setMerchantBought([]);
    setEvent(getRoamingEvent(state, Date.now() + state.roaming.eventsCompleted * 97));
    setNotice("");
  };
  const choose = (choiceId: string) => {
    if (!event || busy) return;
    setBusy(true);
    const result = resolveRoamingChoice(state, event, choiceId);
    update(() => result.state);
    setNotice(result.message);
    setEvent(null);
    setBusy(false);
  };
  const buy = (itemId: string) => {
    const result = buyMerchantItem(state, itemId);
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
          <Txt muted style={styles.travelCopy}>مكتبة تضم {ROAMING_EVENT_COUNT}+ حدثًا متنوعًا، بينها حكايات مترابطة تتكشف على عدة مراحل.</Txt>
        </View>
      </View>
      <View style={styles.healthHeader}><Txt muted style={styles.small}>الصحة أثناء التجوال</Txt><Txt style={styles.healthValue}>{state.roaming.health} / {state.roaming.maxHealth}</Txt></View>
      <Meter value={state.roaming.health} max={state.roaming.maxHealth} color={state.roaming.health < 35 ? palette.red : palette.jade} height={9} />
      <View style={styles.resources}>
        <Pill label={`${state.roaming.fragments} قطعة`} icon="shapes" tone="gold" />
        <Pill label={`${state.gold.toLocaleString("en-US")} ذهب`} icon="logo-usd" tone="muted" />
        <Pill label={`${state.gems.toLocaleString("en-US")} جوهرة`} icon="diamond" tone="jade" />
      </View>
      <AppButton label={event ? "أكمل الحدث الحالي" : "ابدأ التجوال"} icon="compass" onPress={event ? () => {} : explore} disabled={!!event || busy || !state.hero} />
    </Card>

    {event ? <Card style={styles.eventCard}>
      <View style={styles.eventTop}>
        <Pill label={event.kind === "chain" ? "حلقة من حكاية طويلة" : event.kind === "encounter" ? "مواجهة" : event.kind === "traveler" ? "لقاء عابر" : event.kind === "cache" ? "اكتشاف" : "حدث غامض"} tone="gold" />
        <Icon name="sparkles" size={21} color={palette.gold} />
      </View>
      <Txt style={styles.region}>{event.region}</Txt>
      <Txt style={styles.eventTitle}>{event.title}</Txt>
      <Txt muted style={styles.eventStory}>{event.story}</Txt>
      {event.kind === "merchant" ? <Card style={styles.merchantCard}>
        <View style={styles.merchantHeader}><Icon name="storefront" color={palette.gold} size={22} /><View style={{ flex: 1, alignItems: "flex-end" }}><Txt style={styles.merchantTitle}>بضاعة ساهر لهذا اللقاء</Txt><Txt muted style={styles.small}>هذه القافلة لن تبقى هنا طويلًا</Txt></View></View>
        {merchant.map((item) => <View key={item.id} style={styles.merchantRow}>
          <View style={styles.merchantInfo}>
            <Txt style={styles.itemName}>{item.name}</Txt>
            <Txt muted style={styles.small}>{item.description}</Txt>
            <Txt style={styles.price}>{item.price.toLocaleString("en-US")} {item.currency === "gold" ? "ذهب" : "قطعة"}</Txt>
          </View>
          <AppButton label={merchantBought.includes(item.id) ? "تم الشراء" : "شراء"} icon="cart-outline" small variant="secondary" disabled={merchantBought.includes(item.id)} onPress={() => { if (buy(item.id)) setMerchantBought((items) => [...items, item.id]); }} />
        </View>)}
      </Card> : null}
      <SectionTitle title="ماذا ستفعل؟" icon="git-branch-outline" />
      {event.choices.map((choice) => <PressChoice key={choice.id} label={choice.label} hint={choice.hint} onPress={() => choose(choice.id)} disabled={busy} />)}
    </Card> : null}

    {notice ? <Card style={styles.notice}><Icon name="information-circle-outline" color={palette.jade} size={18} /><Txt style={styles.noticeText}>{notice}</Txt></Card> : null}

    <SectionTitle title="سجل رحلاتك" icon="book-outline" />
    <Card style={styles.historyCard}>
      <View style={styles.historyRow}><Txt style={styles.historyValue}>{state.roaming.eventsCompleted}</Txt><Txt muted style={styles.small}>أحداث مكتملة</Txt></View>
      <View style={styles.historyRow}><Txt style={styles.historyValue}>{state.roaming.fragments}</Txt><Txt muted style={styles.small}>قطع أثرية</Txt></View>
      <View style={styles.historyRow}><Txt style={styles.historyValue}>{state.roaming.activeChain ? "مستمرة" : "لا توجد"}</Txt><Txt muted style={styles.small}>حكاية متفرعة نشطة</Txt></View>
    </Card>
  </AppScreen>;
}

function PressChoice({ label, hint, onPress, disabled }: { label: string; hint: string; onPress: () => void; disabled: boolean }) {
  return <View style={styles.choiceWrap}><AppButton label={label} onPress={onPress} disabled={disabled} variant="secondary" style={styles.choiceButton} /><Txt muted style={styles.choiceHint}>{hint}</Txt></View>;
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
  eventStory: { fontSize: 13, lineHeight: 22, textAlign: "right" },
  choiceButton: { marginTop: 1 },
  choiceWrap: { gap: 4 },
  choiceHint: { fontSize: 10, lineHeight: 16, textAlign: "right" },
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
