import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { AppButton, AppScreen, Card, Icon, PageTitle, Pill, SectionTitle, Txt } from "../../src/components/ui";
import { clearDimasFloor, getDimasFloor, getDimasFloors } from "../../src/game/dimas";
import { combatStats } from "../../src/game/stats";
import { createBattleSequence, type BattleSequence, type BattleResult } from "../../src/game/engine";
import { BattleArena } from "../../src/components/BattleArena";
import { useGame } from "../../src/contexts/GameContext";
import { palette } from "../../src/theme";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export default function DimasScreen() {
  const { state, update } = useGame();
  const [selected, setSelected] = useState(Math.min(300, state.dimas.highestFloor + 1));
  const [notice, setNotice] = useState("");
  const [battleSequence, setBattleSequence] = useState<BattleSequence | null>(null);
  const heroLevel = state.hero?.level ?? 1;
  const floors = useMemo(() => getDimasFloors(heroLevel), [heroLevel]);
  const current = getDimasFloor(selected, heroLevel);
  const power = state.hero ? combatStats(state).power : 0;

  const challenge = () => {
    if (!state.hero) { setNotice("أنشئ شخصيتك أولًا."); return; }
    if (selected !== state.dimas.highestFloor + 1) { setNotice(`الطابق التالي المتاح هو ${state.dimas.highestFloor + 1}.`); return; }
    if (power < current.requiredPower) { setNotice(`تحتاج إلى قوة ${current.requiredPower} على الأقل. قوتك الحالية ${power}.`); return; }
    const enemyScale = clamp(current.requiredPower / Math.max(1, power), 0.55, 1);
    const sequence = createBattleSequence(state, "tower", Math.random, {
      floor: selected,
      enemyScale,
      modeLabel: `الديماس • الطابق ${selected}`,
    });
    if (!sequence) { setNotice("تعذر بدء المواجهة."); return; }
    sequence.enemy.title = selected % 10 === 0 ? "حارس الطابق" : "حارس الديماس";
    const originalSettler = sequence.result;
    if (originalSettler.won) {
      const baseState = { ...originalSettler.state, tower: state.tower, battleWinsByMode: { ...originalSettler.state.battleWinsByMode, tower: state.battleWinsByMode.tower } };
      const cleared = clearDimasFloor(baseState, selected);
      if (cleared.error || !cleared.reward) { setNotice(cleared.error ?? "تعذر تسجيل نتيجة الطابق."); return; }
      sequence.result = {
        ...originalSettler,
        state: cleared.state,
        gold: cleared.reward.gold,
        xp: cleared.reward.xp,
        dropped: cleared.loot?.name ?? null,
        log: [...originalSettler.log, `مكافأة الطابق: +${cleared.reward.gold.toLocaleString("en-US")} ذهب و+${cleared.reward.xp.toLocaleString("en-US")} خبرة.`, ...(cleared.loot ? [`غنيمة: ${cleared.loot.name}`] : [])],
      };
    } else {
      sequence.result = {
        ...originalSettler,
        state: { ...originalSettler.state, tower: state.tower, battleWinsByMode: { ...originalSettler.state.battleWinsByMode, tower: state.battleWinsByMode.tower } },
        gold: 0,
        xp: 0,
        dropped: null,
      };
    }
    setBattleSequence(sequence);
    setNotice("");
  };

  const settleBattle = (result: BattleResult) => {
    update(() => result.state);
    if (result.won) {
      setNotice(`انتصار! اجتزت الطابق ${selected} وحصلت على ${result.gold.toLocaleString("en-US")} ذهب و${result.xp.toLocaleString("en-US")} خبرة.${result.dropped ? ` الغنيمة: ${result.dropped}.` : ""}`);
      setSelected(Math.min(300, selected + 1));
    } else {
      setNotice("لم تتمكن من اجتياز الطابق. طوّر عتادك وسماتك ثم حاول مجددًا.");
    }
  };

  return <AppScreen>
    <PageTitle eyebrow="الميدان الأسطوري" title="الديماس" subtitle="300 طابق من المواجهات المباشرة. لا أحداث جانبية ولا لقاءات؛ كل طابق خصم واضح وقوة مطلوبة ومكافأة محددة." trailing={<Pill label={`${state.dimas.highestFloor}/300`} icon="layers" tone="gold" />} />
    <Card style={styles.hero}>
      <View style={styles.heroTop}><Icon name="trophy" color={palette.gold} size={27} /><View style={{ flex: 1, alignItems: "flex-end" }}><Txt style={styles.heroTitle}>درج المجد</Txt><Txt muted style={styles.small}>أعلى طابق اجتزته: {state.dimas.highestFloor}</Txt></View></View>
      <View style={styles.stats}>
        <View style={styles.stat}><Txt style={styles.value}>{power.toLocaleString("en-US")}</Txt><Txt muted style={styles.small}>قوتك</Txt></View>
        <View style={styles.stat}><Txt style={styles.value}>{state.gold.toLocaleString("en-US")}</Txt><Txt muted style={styles.small}>ذهب</Txt></View>
        <View style={styles.stat}><Txt style={styles.value}>{heroLevel}</Txt><Txt muted style={styles.small}>المستوى</Txt></View>
      </View>
      <Txt style={styles.selectedTitle}>{current.title} — {current.name}</Txt>
      <Txt muted style={styles.small}>القوة المطلوبة: {current.requiredPower.toLocaleString("en-US")}</Txt>
      <View style={styles.rewardRow}>
        <Pill label={`+${current.gold.toLocaleString("en-US")} ذهب`} tone="gold" />
        <Pill label={`+${current.xp.toLocaleString("en-US")} خبرة`} tone="jade" />
      </View>
      {current.reward ? <Card style={styles.milestone}><Pill label="مكافأة محطة مميزة" tone="gold" /><Txt style={styles.milestoneText}>{current.reward.name}{current.reward.amount ? ` • ${current.reward.amount}` : ""}</Txt></Card> : null}
      <AppButton label={selected <= state.dimas.highestFloor ? "تم اجتيازه" : selected === state.dimas.highestFloor + 1 ? "ابدأ قتال الطابق" : "افتح الطوابق بالتتابع"} icon="sword" onPress={challenge} disabled={!state.hero || !!battleSequence || selected !== state.dimas.highestFloor + 1 || power < current.requiredPower} />
      {power < current.requiredPower && selected === state.dimas.highestFloor + 1 ? <Txt muted style={styles.warning}>تحتاج إلى {(current.requiredPower - power).toLocaleString("en-US")} قوة إضافية لتجاوز هذا الطابق.</Txt> : null}
    </Card>
    {notice ? <Card style={styles.notice}><Icon name="information-circle-outline" color={palette.gold} size={18} /><Txt style={styles.noticeText}>{notice}</Txt></Card> : null}
    <SectionTitle title="خريطة الطوابق" icon="grid-outline" action={<Pill label="1 — 300" tone="muted" />} />
    <ScrollView style={styles.floorScroll} nestedScrollEnabled contentContainerStyle={styles.floorGrid}>
      {floors.map((floor) => {
        const cleared = floor.floor <= state.dimas.highestFloor;
        const available = floor.floor === state.dimas.highestFloor + 1;
        const active = selected === floor.floor;
        return <Pressable key={floor.floor} onPress={() => setSelected(floor.floor)} style={[styles.floorTile, cleared && styles.floorCleared, active && styles.floorActive, floor.milestone && styles.floorMilestone]}>
          <Txt style={[styles.floorNumber, cleared && styles.clearedText]}>{floor.floor.toString().padStart(3, "0")}</Txt>
          <Txt muted style={styles.floorReward}>قوة {floor.requiredPower.toLocaleString("en-US")}</Txt>
          <Txt muted style={styles.floorReward}>+{floor.gold.toLocaleString("en-US")} G</Txt>
          {available ? <Pill label="التالي" tone="jade" /> : cleared ? <Icon name="checkmark-circle" color={palette.jade} size={14} /> : null}
        </Pressable>;
      })}
    </ScrollView>
    <BattleArena sequence={battleSequence} onBattleSettled={settleBattle} onClose={() => setBattleSequence(null)} />
  </AppScreen>;
}

const styles = StyleSheet.create({
  hero: { padding: 16, gap: 12, backgroundColor: "#1B1C2B", borderColor: "rgba(190,155,255,0.25)" },
  heroTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  heroTitle: { fontSize: 17, fontWeight: "900", color: palette.gold },
  small: { fontSize: 10, lineHeight: 16 },
  stats: { flexDirection: "row", justifyContent: "space-around", paddingVertical: 9, borderTopWidth: 1, borderBottomWidth: 1, borderColor: palette.line },
  stat: { alignItems: "center", gap: 3 },
  value: { color: palette.gold, fontSize: 18, fontWeight: "900" },
  selectedTitle: { fontSize: 17, fontWeight: "900", textAlign: "right" },
  rewardRow: { flexDirection: "row", justifyContent: "flex-end", gap: 7 },
  milestone: { padding: 11, gap: 6, backgroundColor: "rgba(230,199,124,0.07)" },
  milestoneText: { fontSize: 12, fontWeight: "900", textAlign: "right", color: palette.gold },
  warning: { color: palette.red, fontSize: 11, textAlign: "right" },
  notice: { padding: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  noticeText: { flex: 1, fontSize: 12, textAlign: "right", lineHeight: 18 },
  floorScroll: { maxHeight: 350 },
  floorGrid: { flexDirection: "row", flexWrap: "wrap", gap: 7, paddingBottom: 8 },
  floorTile: { width: "23%", minHeight: 76, borderRadius: 12, padding: 7, alignItems: "center", justifyContent: "center", gap: 3, borderWidth: 1, borderColor: palette.line, backgroundColor: "#151D29" },
  floorCleared: { backgroundColor: "rgba(98,216,195,0.07)", borderColor: "rgba(98,216,195,0.25)" },
  floorActive: { borderColor: palette.gold, backgroundColor: "rgba(230,199,124,0.12)" },
  floorMilestone: { borderColor: "rgba(190,155,255,0.42)" },
  floorNumber: { fontSize: 15, fontWeight: "900", color: palette.text },
  clearedText: { color: palette.jade },
});
