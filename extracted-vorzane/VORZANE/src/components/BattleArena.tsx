import { useEffect, useRef, useState } from "react";
import { Animated, Image, Modal, StyleSheet, View } from "react-native";
import { AppButton, Card, Icon, Meter, Pill, Txt } from "./ui";
import { CLASS_NAMES } from "../game/model";
import { createBattleSequence, type BattleResult, type BattleSequence } from "../game/engine";
import { CLASS_ART } from "../game/art";
import { palette } from "../theme";

type RunSummary = { wins: number; gold: number; xp: number; drops: string[] };
type EndReason = "stopped" | "defeat" | "single" | null;

type Props = {
  sequence: BattleSequence | null;
  onBattleSettled: (result: BattleResult) => void;
  onClose: () => void;
};

const EMPTY_SUMMARY: RunSummary = { wins: 0, gold: 0, xp: 0, drops: [] };

export function BattleArena({ sequence, onBattleSettled, onClose }: Props) {
  const [activeSequence, setActiveSequence] = useState<BattleSequence | null>(sequence);
  const [turnIndex, setTurnIndex] = useState(0);
  const [finalized, setFinalized] = useState(false);
  const [betweenFights, setBetweenFights] = useState(false);
  const [stopRequested, setStopRequested] = useState(false);
  const [endReason, setEndReason] = useState<EndReason>(null);
  const [summary, setSummary] = useState<RunSummary>(EMPTY_SUMMARY);
  const stopAfterCurrentRef = useRef(false);
  const settledIdRef = useRef<string | null>(null);
  const nextTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resultCallback = useRef(onBattleSettled);
  const closeCallback = useRef(onClose);
  const heroMotion = useRef(new Animated.Value(0)).current;
  const enemyMotion = useRef(new Animated.Value(0)).current;

  useEffect(() => { resultCallback.current = onBattleSettled; }, [onBattleSettled]);
  useEffect(() => { closeCallback.current = onClose; }, [onClose]);

  useEffect(() => {
    setActiveSequence(sequence);
    setTurnIndex(0);
    setFinalized(false);
    setBetweenFights(false);
    setStopRequested(false);
    setEndReason(null);
    setSummary({ ...EMPTY_SUMMARY, drops: [] });
    stopAfterCurrentRef.current = false;
    settledIdRef.current = null;
  }, [sequence?.id]);

  useEffect(() => {
    if (!sequence || !activeSequence || finalized || betweenFights || turnIndex >= activeSequence.turns.length) return;
    const timer = setTimeout(() => setTurnIndex((index) => index + 1), 720);
    return () => clearTimeout(timer);
  }, [sequence, activeSequence, finalized, betweenFights, turnIndex]);

  useEffect(() => {
    if (!sequence || !activeSequence || turnIndex < activeSequence.turns.length || !activeSequence.turns.length) return;
    if (settledIdRef.current === activeSequence.id) return;
    settledIdRef.current = activeSequence.id;
    const result = activeSequence.result;
    resultCallback.current(result);
    setSummary((current) => ({
      wins: current.wins + (result.won ? 1 : 0),
      gold: current.gold + result.gold,
      xp: current.xp + result.xp,
      drops: result.dropped ? [...current.drops, result.dropped].slice(-4) : current.drops,
    }));

    if (activeSequence.mode === "dungeon" && result.won) {
      setBetweenFights(true);
      const nextTimer = setTimeout(() => {
        nextTimerRef.current = null;
        if (stopAfterCurrentRef.current) {
          setEndReason("stopped");
          setFinalized(true);
          setBetweenFights(false);
          return;
        }
        const next = createBattleSequence(result.state, "dungeon");
        if (!next) {
          setEndReason("stopped");
          setFinalized(true);
          setBetweenFights(false);
          return;
        }
        setActiveSequence(next);
        setTurnIndex(0);
        setBetweenFights(false);
        settledIdRef.current = null;
      }, 1400);
      nextTimerRef.current = nextTimer;
      return () => {
        clearTimeout(nextTimer);
        if (nextTimerRef.current === nextTimer) nextTimerRef.current = null;
      };
    }

    setEndReason(activeSequence.mode === "dungeon" ? "defeat" : "single");
    setFinalized(true);
  }, [sequence, activeSequence, turnIndex]);

  const lastTurn = turnIndex > 0 ? activeSequence?.turns[turnIndex - 1] ?? null : null;
  const heroHP = betweenFights && activeSequence ? activeSequence.heroMaxHP : lastTurn?.heroHP ?? activeSequence?.heroMaxHP ?? 0;
  const enemyHP = lastTurn?.enemyHP ?? activeSequence?.enemyMaxHP ?? 0;
  const hpColor = heroHP / Math.max(1, activeSequence?.heroMaxHP ?? 1) < 0.3 ? palette.red : palette.jade;

  useEffect(() => {
    if (!lastTurn) return;
    const motion = lastTurn.actor === "hero" ? heroMotion : enemyMotion;
    motion.stopAnimation();
    motion.setValue(0);
    Animated.sequence([
      Animated.timing(motion, { toValue: 1, duration: 140, useNativeDriver: true }),
      Animated.timing(motion, { toValue: 0, duration: 210, useNativeDriver: true }),
    ]).start();
  }, [lastTurn?.index, heroMotion, enemyMotion]);

  if (!sequence || !activeSequence) return null;

  const currentTurn = turnIndex > 0 ? activeSequence.turns[turnIndex - 1] ?? null : null;
  const recentTurns = activeSequence.turns.slice(Math.max(0, turnIndex - 3), turnIndex).reverse();
  const lunge = (motion: Animated.Value, direction: number) => motion.interpolate({ inputRange: [0, 1], outputRange: [0, direction] });
  const requestStop = () => {
    stopAfterCurrentRef.current = true;
    setStopRequested(true);
    if (betweenFights) {
      if (nextTimerRef.current) clearTimeout(nextTimerRef.current);
      nextTimerRef.current = null;
      setEndReason("stopped");
      setFinalized(true);
      setBetweenFights(false);
    }
  };
  const finishLabel = activeSequence.mode === "dungeon" ? "إنهاء الجولة" : "متابعة";
  return <Modal transparent visible animationType="fade" onRequestClose={() => { if (finalized) closeCallback.current(); }}>
    <View style={styles.backdrop}>
      <Card style={styles.arenaCard}>
        <View style={styles.header}>
          <View style={{ alignItems: "flex-end", flex: 1 }}>
            <Pill label={activeSequence.modeLabel} icon={activeSequence.mode === "dungeon" ? "skull" : "flash"} tone="gold" />
            <Txt style={styles.heading}>{finalized ? (endReason === "defeat" ? "انتهت الغارة" : endReason === "stopped" ? "أنهيت الجولة" : activeSequence.result.won ? "انتصار" : "انتهت المواجهة") : betweenFights ? "تعافٍ كامل" : "المواجهة الآلية"}</Txt>
          </View>
          <Icon name={finalized && endReason === "defeat" ? "skull" : "flash"} color={finalized && endReason === "defeat" ? palette.red : palette.gold} size={23} />
        </View>

        <View style={styles.statusRow}>
          <Pill label={betweenFights ? "الخصم التالي يقترب" : finalized ? "انتهت الضربات" : `الدور ${currentTurn?.round ?? 1}`} icon={betweenFights ? "time-outline" : "sync-outline"} tone={betweenFights ? "jade" : "muted"} />
          {activeSequence.mode === "dungeon" && !finalized ? <AppButton label={stopRequested ? "سيتوقف بعد هذه المواجهة" : "إيقاف الجولة"} icon="pause" variant="ghost" small onPress={requestStop} disabled={stopRequested} /> : null}
        </View>

        <View style={styles.duelStage}>
          <Animated.View style={[styles.combatant, { transform: [{ translateX: lunge(heroMotion, -18) }] }]}>
            <View style={styles.heroPortrait}>
              <Image source={{ uri: CLASS_ART[activeSequence.hero.className] }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityLabel={CLASS_NAMES[activeSequence.hero.className]} />
              <View pointerEvents="none" style={styles.heroShade} />
            </View>
            <Txt style={styles.combatantName}>{activeSequence.hero.name}</Txt>
            <Txt muted style={styles.combatantRole}>{CLASS_NAMES[activeSequence.hero.className]} • م {activeSequence.hero.level}</Txt>
            <View style={styles.healthBlock}>
              <View style={styles.healthMeta}><Txt style={styles.healthValue}>{Math.ceil(heroHP)} / {activeSequence.heroMaxHP}</Txt><Txt muted style={styles.healthLabel}>الصحة</Txt></View>
              <Meter value={heroHP} max={activeSequence.heroMaxHP} color={hpColor} height={8} />
            </View>
            <Pill label={`هجوم ${activeSequence.hero.attack}`} icon="flash" tone="gold" />
          </Animated.View>

          <View style={styles.versusColumn}>
            <View style={styles.vsMark}><Txt style={styles.vsText}>ضد</Txt></View>
            {currentTurn ? <Txt style={[styles.damageNumber, currentTurn.actor === "hero" ? { color: palette.gold } : { color: palette.red }]}>{currentTurn.actor === "hero" ? "−" : "−"}{currentTurn.damage}</Txt> : <Icon name="sparkles" color={palette.gold} size={18} />}
          </View>

          <Animated.View style={[styles.combatant, { transform: [{ translateX: lunge(enemyMotion, 18) }] }]}>
            <View style={[styles.enemyPortrait, { borderColor: `${activeSequence.enemy.tint}88`, backgroundColor: `${activeSequence.enemy.tint}22` }]}>
              <View style={[styles.enemyGlow, { backgroundColor: activeSequence.enemy.tint }]} />
              <Icon name={activeSequence.enemy.icon as never} color={activeSequence.enemy.tint} size={48} />
              <Txt style={styles.enemyMark}>V</Txt>
            </View>
            <Txt style={styles.combatantName}>{activeSequence.enemy.name}</Txt>
            <Txt muted style={styles.combatantRole}>{activeSequence.enemy.title}</Txt>
            <View style={styles.healthBlock}>
              <View style={styles.healthMeta}><Txt style={styles.healthValue}>{Math.ceil(enemyHP)} / {activeSequence.enemyMaxHP}</Txt><Txt muted style={styles.healthLabel}>الصحة</Txt></View>
              <Meter value={enemyHP} max={activeSequence.enemyMaxHP} color={palette.red} height={8} />
            </View>
            <Pill label={`دفاع ${activeSequence.enemy.defenseScale > 1 ? "عالٍ" : "متوازن"}`} icon="shield" tone="red" />
          </Animated.View>
        </View>

        {betweenFights ? <View style={styles.healNotice}><Icon name="heart" color={palette.jade} size={17} /><Txt style={styles.healText}>استعدت صحتك بالكامل. الطابق التالي أصعب قليلًا، والغنيمة السابقة محفوظة.</Txt></View> : null}

        <Card style={styles.logCard}>
          <View style={styles.logHeading}><Txt style={styles.logTitle}>{finalized ? "حصيلة الجولة" : "سجل الضربات"}</Txt><Icon name="list-outline" color={palette.muted} size={17} /></View>
          {recentTurns.map((turn) => <Txt key={turn.index} muted style={styles.logLine}>{turn.message}</Txt>)}
          {!recentTurns.length && !finalized ? <Txt muted style={styles.logLine}>يحدد الرشاقة من يبدأ، ثم يتناوب الطرفان تلقائيًا.</Txt> : null}
          {finalized ? <View style={styles.summaryStats}><Pill label={`${summary.wins} انتصار`} icon="trophy" tone="gold" /><Pill label={`+${summary.gold} ذهب`} icon="logo-usd" tone="gold" /><Pill label={`+${summary.xp} خبرة`} icon="sparkles" tone="jade" /></View> : null}
          {finalized && summary.drops.length ? <Txt style={styles.dropText}>الغنائم: {summary.drops.join("، ")}</Txt> : null}
          {finalized && endReason === "defeat" ? <Txt muted style={styles.logLine}>كل غنائم الانتصارات السابقة بقيت في حقيبتك.</Txt> : null}
        </Card>

        {finalized ? <AppButton label={finishLabel} icon="arrow-back" onPress={() => closeCallback.current()} /> : <View style={styles.autoHint}><Icon name="infinite" color={palette.jade} size={16} /><Txt muted style={styles.autoHintText}>{activeSequence.mode === "dungeon" ? "تستمر الزنزانة تلقائيًا؛ أوقف الجولة لتخرج بعد هذه المواجهة." : "هجمة تلقائية بالتناوب؛ تُسجل المكافأة عند انتهاء القتال."}</Txt></View>}
      </Card>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(4,7,12,0.88)", justifyContent: "center", alignItems: "center", padding: 12 },
  arenaCard: { width: "100%", maxWidth: 760, maxHeight: "96%", padding: 17, gap: 12, borderColor: "rgba(230,199,124,0.28)", backgroundColor: "#111720" },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  heading: { fontSize: 20, fontWeight: "900", marginTop: 5 },
  statusRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  duelStage: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6, paddingVertical: 4 },
  combatant: { flex: 1, minWidth: 0, alignItems: "center", gap: 5 },
  heroPortrait: { width: 92, height: 104, borderRadius: 22, overflow: "hidden", borderWidth: 1, borderColor: "rgba(98,216,195,0.38)", backgroundColor: "#18343A" },
  heroShade: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(7,11,18,0.14)" },
  enemyPortrait: { width: 92, height: 104, borderRadius: 22, borderWidth: 1, overflow: "hidden", alignItems: "center", justifyContent: "center", position: "relative" },
  enemyGlow: { position: "absolute", width: 75, height: 75, borderRadius: 38, opacity: 0.12 },
  enemyMark: { position: "absolute", bottom: 3, right: 7, fontFamily: "Cinzel_700Bold", fontSize: 12, color: "rgba(255,255,255,0.4)" },
  combatantName: { textAlign: "center", fontSize: 13, fontWeight: "900", minHeight: 20 },
  combatantRole: { textAlign: "center", fontSize: 10, minHeight: 16 },
  healthBlock: { width: "100%", gap: 4, marginTop: 3 },
  healthMeta: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  healthValue: { fontSize: 10, fontWeight: "800", color: palette.text },
  healthLabel: { fontSize: 9 },
  versusColumn: { width: 43, alignItems: "center", justifyContent: "center", gap: 8 },
  vsMark: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(230,199,124,0.12)", borderWidth: 1, borderColor: "rgba(230,199,124,0.25)" },
  vsText: { fontSize: 10, fontWeight: "900", color: palette.gold },
  damageNumber: { fontSize: 13, fontWeight: "900" },
  healNotice: { flexDirection: "row", alignItems: "center", gap: 7, borderRadius: 12, padding: 9, backgroundColor: "rgba(98,216,195,0.08)" },
  healText: { flex: 1, fontSize: 11, lineHeight: 17, color: palette.jade, textAlign: "right" },
  logCard: { padding: 11, gap: 6, backgroundColor: "rgba(255,255,255,0.025)" },
  logHeading: { flexDirection: "row", alignItems: "center", justifyContent: "flex-start", gap: 7 },
  logTitle: { fontSize: 12, fontWeight: "900" },
  logLine: { fontSize: 10, lineHeight: 16, textAlign: "right" },
  summaryStats: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 3 },
  dropText: { fontSize: 11, fontWeight: "800", color: palette.gold, lineHeight: 17 },
  autoHint: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 7 },
  autoHintText: { fontSize: 10, textAlign: "center", lineHeight: 16 },
});
