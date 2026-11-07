import { useCallback, useEffect, useState } from "react";
import { Image, ImageBackground, Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { AppButton, AppScreen, Card, GradientCard, Icon, InputField, Meter, Pill, SectionTitle, StatCard, Txt } from "../../src/components/ui";
import { CLASS_ICON, findExpedition, PETS, STARTER_ITEMS } from "../../src/game/catalog";
import { BrandMark } from "../../src/components/BrandMark";
import { allocateStatPoint, combatStats, createBattleSequence, createHeroState, type BattleMode, type BattleResult, type BattleSequence } from "../../src/game/engine";
import { CLASS_DESCRIPTIONS, CLASS_NAMES, type ClassId, type StatKey } from "../../src/game/model";
import { useGame } from "../../src/contexts/GameContext";
import { palette } from "../../src/theme";
import { CLASS_ART } from "../../src/game/art";
import { ProfileAvatar } from "../../src/components/ProfileAvatar";
import { BattleArena } from "../../src/components/BattleArena";
import { createItemInstance } from "../../src/game/dungeonItems";

const CLASSES: ClassId[] = ["Warrior", "Mage", "Assassin", "Archer"];
const STAT_LABELS: Record<StatKey, string> = { str: "القوة", def: "الدفاع", vit: "الحيوية", agi: "الرشاقة", luck: "الحظ" };
const STAT_KEYS: StatKey[] = ["str", "def", "vit", "agi", "luck"];
const formatTime = (milliseconds: number) => {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}` : `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
};

export default function CampScreen() {
  const router = useRouter();
  const { state, update, saveStatus, status, fpsMode, command } = useGame();
  const [heroName, setHeroName] = useState("");
  const [selectedClass, setSelectedClass] = useState<ClassId>("Warrior");
  const [battleSequence, setBattleSequence] = useState<BattleSequence | null>(null);
  const [now, setNow] = useState(Date.now());
  const hero = state.hero;
  const stats = combatStats(state);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const createHero = () => {
    if (heroName.trim().length < 2) return;
    if (fpsMode) { void command({ type: "createHero", name: heroName.trim(), className: selectedClass }); return; }
    const next = createHeroState(heroName, selectedClass);
    const firstSword = createItemInstance(STARTER_ITEMS[0], "starter");
    const firstBoots = createItemInstance(STARTER_ITEMS[3], "starter");
    next.equipped[firstSword.slot] = firstSword;
    next.inventory.push(firstBoots);
    update(() => next);
  };

  const enterBattle = (mode: BattleMode) => {
    if (!hero) return;
    if (fpsMode) { void command({ type: "startBattle", mode }); return; }
    const sequence = createBattleSequence(state, mode);
    if (sequence) setBattleSequence(sequence);
  };

  const settleBattle = useCallback((result: BattleResult) => { if (!fpsMode) update(() => result.state); }, [update, fpsMode]);

  if (!hero) return <AppScreen>
    <View style={styles.topline}><Txt style={styles.wordmark}>VORZANE</Txt><Pill label="الزنزانة الأولى • صحوة الرماد" icon="skull" tone="jade" /></View>
    <GradientCard style={styles.createHero}>
      <BrandMark size={58} />
      <Txt style={styles.createTitle}>اختر من يسير في الظل</Txt>
      <Txt muted style={styles.createCopy}>اصنع شخصيتك الأولى؛ يبدأ كل بطل برحلة مختلفة.</Txt>
      <View style={styles.classGrid}>
        {CLASSES.map((classId) => {
          const active = classId === selectedClass;
          return <Pressable key={classId} onPress={() => setSelectedClass(classId)} style={[styles.classCard, active && styles.classCardActive]}>
            <ImageBackground source={{ uri: CLASS_ART[classId] }} resizeMode="cover" style={styles.classCardArt} imageStyle={styles.classCardImage}>
              <View pointerEvents="none" style={styles.classCardShade} />
              <View style={styles.classCardContent}>
                <View style={[styles.classIcon, active && styles.classIconActive]}><Icon name={CLASS_ICON[classId] as never} size={22} color={active ? palette.ink : palette.jade} /></View>
                <Txt style={[styles.className, active && { color: palette.gold }]}>{CLASS_NAMES[classId]}</Txt>
                <Txt muted style={styles.classDesc}>{CLASS_DESCRIPTIONS[classId]}</Txt>
              </View>
            </ImageBackground>
          </Pressable>;
        })}
      </View>
      <InputField label="اسم البطل" value={heroName} onChangeText={setHeroName} placeholder="اسمٌ يليق بالأساطير" icon="person-outline" />
      <AppButton label="ابدأ الرحلة" icon="arrow-back" onPress={createHero} disabled={heroName.trim().length < 2} />
    </GradientCard>
    <Txt muted style={styles.smallCenter}>اختيار الفئة تجميلي في البداية؛ يمكنك تطوير سماتك من نقاط المستوى.</Txt>
  </AppScreen>;

  const xpProgress = Math.min(100, (hero.exp / stats.xpNeeded) * 100);
  const active = state.activeExpedition;
  const expeditionProgress = active ? Math.min(100, ((now - active.startedAt) / Math.max(1, active.endsAt - active.startedAt)) * 100) : 0;
  const activePlan = active ? findExpedition(active.planId) : null;
  const activePet = PETS.find((item) => item.id === state.activePet && state.pets.includes(item.id) && hero.level >= item.requiredLevel);

  return <AppScreen>
    <View style={styles.topline}>
      <View style={styles.currencyRow}>
        <Pill label={state.gold.toLocaleString("ar-EG")} icon="logo-usd" tone="gold" />
        <Pill label={state.gems.toLocaleString("ar-EG")} icon="diamond" tone="jade" />
      </View>
      <View style={styles.brandInline}>
        <Pressable onPress={() => router.push("/settings")} accessibilityRole="button" accessibilityLabel="فتح إعدادات الصورة الشخصية" style={styles.profileButton}>
          <ProfileAvatar avatarId={state.profileAvatarId} size={36} />
        </Pressable>
        <BrandMark size={32} />
        <Txt style={styles.wordmark}>VORZANE</Txt>
      </View>
    </View>

    {status === "offline" ? <Card style={styles.offlineBanner}><Icon name="cloud-offline-outline" color={palette.red} size={18} /><Txt style={styles.offlineText}>أنت في وضع محلي مؤقت — {saveStatus}</Txt></Card> : null}

    <GradientCard colors={["#14363B", "#14212A", "#111725"]} style={styles.heroCard}>
      <View style={styles.heroGlow} />
      <View style={styles.heroHeader}>
        <View style={{ alignItems: "flex-end", flex: 1 }}>
          <Pill label={`المستوى ${hero.level}`} icon="star" tone="gold" />
          <Txt style={styles.heroName}>{hero.name}</Txt>
          <Txt style={styles.heroClass}>{CLASS_NAMES[hero.className]}</Txt>
          <Txt muted style={styles.heroCaption}>{activePet ? `رفيقك: ${activePet.name}` : "استعد لعبور حدود الرماد"}</Txt>
        </View>
        <View style={styles.heroPortrait}>
          <Image source={{ uri: CLASS_ART[hero.className] }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityLabel={CLASS_NAMES[hero.className]} />
          <View pointerEvents="none" style={styles.heroPortraitShade} />
          <View style={styles.portraitAura} />
        </View>
      </View>
      <View style={styles.xpBlock}><View style={styles.xpMeta}><Txt muted style={styles.xpLabel}>الخبرة</Txt><Txt style={styles.xpValue}>{hero.exp} / {stats.xpNeeded}</Txt></View><Meter value={hero.exp} max={stats.xpNeeded} color={palette.gold} height={8} /></View>
      <View style={styles.powerRow}><Pill label={`قوة ${stats.power}`} icon="flash" tone="jade" /><Txt muted style={styles.saveLine}>{saveStatus}</Txt></View>
    </GradientCard>

    <View style={styles.statsRow}>
      <StatCard label="الصحة" value={stats.maxHP} icon="heart" color={palette.red} />
      <StatCard label="الهجوم" value={stats.attack} icon="flash" color={palette.gold} />
      <StatCard label="الدفاع" value={stats.defense} icon="shield-checkmark" color={palette.blue} />
      <StatCard label="الانتصارات" value={state.wins} icon="trophy" color={palette.jade} />
    </View>

    {hero.statPoints > 0 ? <>
      <SectionTitle title="تطوير السمات" icon="bar-chart-outline" action={<Pill label={`${hero.statPoints} نقطة متاحة`} tone="gold" />} />
      <Card style={styles.statAllocation}>
        {STAT_KEYS.map((key) => <View key={key} style={styles.statAllocationRow}>
          <AppButton
            label="+1"
            icon="add-circle-outline"
            variant="jade"
            small
            disabled={fpsMode || hero.stats[key] >= 999_999}
            onPress={() => update((current) => allocateStatPoint(current, key).state)}
            style={styles.allocateButton}
          />
          <View style={styles.statAllocationValue}>
            <Txt style={styles.statAllocationNumber}>{hero.stats[key]}</Txt>
            <Txt muted style={styles.statAllocationLabel}>{STAT_LABELS[key]}</Txt>
          </View>
        </View>)}
        {fpsMode ? <Txt muted style={styles.statAllocationNote}>تخصيص السمات غير متاح عبر خادم اللعبة الحالي.</Txt> : null}
      </Card>
    </> : null}

    <SectionTitle title="زنزانتك ومعاركك" icon="flash-outline" action={<Pressable onPress={() => router.push("/quests")}><Txt style={styles.actionLink}>مهامك ←</Txt></Pressable>} />
    <Card style={styles.battleCard}>
      <Txt muted style={styles.battleIntro}>كل ضربة تظهر أمامك. واصل الزنزانة تلقائيًا؛ يتجدد دمك بين الأعداء وتزداد قوتهم تدريجيًا.</Txt>
      <AppButton label={`انزل إلى الزنزانة • الطابق ${state.dungeonFloor}`} icon="skull" onPress={() => enterBattle("dungeon")} variant="jade" />
      <View style={styles.battleButtons}>
        <AppButton label="كهف الرماد" icon="bonfire" onPress={() => enterBattle("cave")} small style={{ flex: 1 }} />
        <AppButton label="برج الحراس" icon="business" variant="secondary" onPress={() => enterBattle("tower")} small style={{ flex: 1 }} />
      </View>
      <AppButton label="تحدي الكسوف" icon="moon" variant="ghost" onPress={() => enterBattle("hard")} small />
    </Card>

    <SectionTitle title="رحلتك النشطة" icon="compass" action={<Pressable onPress={() => router.push("/expeditions")}><Txt style={styles.actionLink}>كل الرحلات ←</Txt></Pressable>} />
    {active && activePlan ? <Card style={styles.expeditionCard}>
      <View style={styles.expeditionTop}><Pill label={formatTime(active.endsAt - now)} icon="time-outline" tone="jade" /><View style={styles.expeditionName}><Txt style={styles.expeditionTitle}>{activePlan.name}</Txt><Txt muted style={styles.expeditionRegion}>{activePlan.region}</Txt></View><Icon name={activePlan.icon as never} size={22} color={palette.gold} /></View>
      <Meter value={expeditionProgress} max={100} color={palette.jade} height={7} />
      <View style={styles.rewardRow}><Txt muted style={styles.rewardCaption}>الغنائم المتوقعة</Txt><Txt style={styles.rewardText}>+{activePlan.rewardGold} ذهب • +{activePlan.rewardXP} XP</Txt></View>
    </Card> : <Card style={styles.noExpedition}><View style={styles.noExpIcon}><Icon name="compass-outline" color={palette.jade} size={21} /></View><View style={{ flex: 1, alignItems: "flex-end" }}><Txt style={styles.noExpTitle}>لا توجد رحلة نشطة</Txt><Txt muted style={styles.noExpCopy}>أرسل بطلك لمهمة؛ سيعود بغنائم حتى أثناء غيابك.</Txt></View><AppButton label="اختر" icon="arrow-back" small variant="jade" onPress={() => router.push("/expeditions")} /></Card>}

    <SectionTitle title="ملخص المغامرة" icon="analytics" />
    <Card style={styles.summaryCard}>
      <View style={styles.summaryItem}><Txt style={styles.summaryValue}>{state.battles}</Txt><Txt muted style={styles.summaryLabel}>معركة</Txt></View>
      <View style={styles.summaryDivider} />
      <View style={styles.summaryItem}><Txt style={styles.summaryValue}>{Math.max(0, state.dungeonFloor - 1)}</Txt><Txt muted style={styles.summaryLabel}>انتصار زنزانة</Txt></View>
      <View style={styles.summaryDivider} />
      <View style={styles.summaryItem}><Txt style={styles.summaryValue}>{state.tower}</Txt><Txt muted style={styles.summaryLabel}>طابق برج</Txt></View>
      <View style={styles.summaryDivider} />
      <View style={styles.summaryItem}><Txt style={styles.summaryValue}>{state.inventory.length}</Txt><Txt muted style={styles.summaryLabel}>قطعة عتاد</Txt></View>
    </Card>

    <BattleArena sequence={battleSequence} onBattleSettled={settleBattle} onClose={() => setBattleSequence(null)} />
  </AppScreen>;
}

const styles = StyleSheet.create({
  topline: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 2 },
  currencyRow: { flexDirection: "row", gap: 7 },
  brandInline: { flexDirection: "row", alignItems: "center", gap: 8 },
  profileButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  wordmark: { color: palette.gold, fontSize: 20, fontWeight: "900", fontFamily: "Cinzel_700Bold", letterSpacing: 2.1 },
  offlineBanner: { padding: 11, flexDirection: "row", alignItems: "center", gap: 8, borderColor: "rgba(230,121,112,0.28)", backgroundColor: "rgba(230,121,112,0.06)" },
  offlineText: { flex: 1, color: palette.red, fontSize: 12, lineHeight: 18 },
  heroCard: { minHeight: 215, padding: 18, justifyContent: "space-between" },
  heroGlow: { position: "absolute", top: -52, left: 28, width: 190, height: 190, borderRadius: 100, borderWidth: 1, borderColor: "rgba(98,216,195,0.12)", backgroundColor: "rgba(98,216,195,0.04)" },
  heroHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  heroName: { fontSize: 25, fontWeight: "900", marginTop: 9 },
  heroClass: { fontSize: 14, color: palette.jade, fontWeight: "800", marginTop: 1 },
  heroCaption: { fontSize: 12, marginTop: 5 },
  heroPortrait: { width: 105, height: 124, borderRadius: 36, backgroundColor: "rgba(230,199,124,0.08)", borderWidth: 1, borderColor: "rgba(230,199,124,0.29)", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  heroPortraitShade: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(8,12,18,0.14)" },
  portraitAura: { position: "absolute", bottom: -24, width: 116, height: 47, borderRadius: 60, backgroundColor: "rgba(98,216,195,0.12)" },
  xpBlock: { gap: 7, marginTop: 16 },
  xpMeta: { flexDirection: "row", justifyContent: "space-between" },
  xpLabel: { fontSize: 11 },
  xpValue: { fontSize: 11, color: palette.gold, fontWeight: "700" },
  powerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12 },
  saveLine: { fontSize: 10, maxWidth: "62%" },
  statsRow: { flexDirection: "row", gap: 8 },
  statAllocation: { gap: 7 },
  statAllocationRow: { minHeight: 45, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: palette.line, paddingVertical: 4 },
  allocateButton: { width: 82 },
  statAllocationValue: { flexDirection: "row", alignItems: "center", gap: 9 },
  statAllocationNumber: { minWidth: 34, color: palette.gold, fontSize: 15, fontWeight: "900", textAlign: "center" },
  statAllocationLabel: { fontSize: 13, fontWeight: "800" },
  statAllocationNote: { fontSize: 11, lineHeight: 17, textAlign: "right" },
  battleCard: { gap: 11 },
  battleIntro: { fontSize: 13 },
  battleButtons: { flexDirection: "row", gap: 8 },
  actionLink: { fontSize: 12, color: palette.jade, fontWeight: "800" },
  expeditionCard: { gap: 12, padding: 15 },
  expeditionTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  expeditionName: { flex: 1, alignItems: "flex-end" },
  expeditionTitle: { fontWeight: "900", fontSize: 15 },
  expeditionRegion: { fontSize: 11, marginTop: 3 },
  rewardRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rewardCaption: { fontSize: 11 },
  rewardText: { color: palette.gold, fontSize: 11, fontWeight: "800" },
  noExpedition: { flexDirection: "row", alignItems: "center", gap: 11, padding: 14 },
  noExpIcon: { width: 41, height: 41, borderRadius: 15, backgroundColor: "rgba(98,216,195,0.1)", alignItems: "center", justifyContent: "center" },
  noExpTitle: { fontWeight: "800", fontSize: 13 },
  noExpCopy: { fontSize: 11, lineHeight: 16, marginTop: 3 },
  summaryCard: { flexDirection: "row", justifyContent: "space-around", alignItems: "center", paddingVertical: 15 },
  summaryItem: { flex: 1, alignItems: "center", gap: 2 },
  summaryValue: { fontSize: 18, color: palette.text, fontWeight: "900" },
  summaryLabel: { fontSize: 10 },
  summaryDivider: { width: 1, height: 28, backgroundColor: palette.line },
  createHero: { gap: 15, marginTop: 8 },
  createTitle: { fontSize: 25, fontWeight: "900", marginTop: 2 },
  createCopy: { fontSize: 14, lineHeight: 22, marginTop: -8 },
  classGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  classCard: { width: "48%", minHeight: 116, borderRadius: 16, borderWidth: 1, borderColor: palette.line, overflow: "hidden" },
  classCardActive: { borderColor: palette.gold },
  classCardArt: { minHeight: 116, padding: 12, justifyContent: "flex-end" },
  classCardImage: { borderRadius: 15 },
  classCardShade: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(8,12,18,0.58)" },
  classCardContent: { alignItems: "flex-end", gap: 5 },
  classIcon: { width: 32, height: 32, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(98,216,195,0.10)" },
  classIconActive: { backgroundColor: palette.gold },
  className: { fontSize: 13, fontWeight: "900" },
  classDesc: { fontSize: 10, lineHeight: 15 },
  smallCenter: { textAlign: "center", fontSize: 11, lineHeight: 17 },
  modalBackdrop: { flex: 1, justifyContent: "center", alignItems: "center", padding: 22, backgroundColor: "rgba(0,0,0,0.70)" },
  battleReport: { width: "100%", maxWidth: 420, padding: 20, gap: 13, alignItems: "stretch" },
  reportIcon: { width: 54, height: 54, borderRadius: 19, backgroundColor: "rgba(230,199,124,0.10)", alignItems: "center", justifyContent: "center", alignSelf: "flex-end" },
  reportTitle: { fontSize: 22, fontWeight: "900" },
  reportCaption: { fontSize: 13, lineHeight: 20 },
  logBox: { backgroundColor: palette.midnight, borderRadius: 14, borderWidth: 1, borderColor: palette.line, padding: 12, gap: 7 },
  logLine: { fontSize: 12, lineHeight: 18 },
});
