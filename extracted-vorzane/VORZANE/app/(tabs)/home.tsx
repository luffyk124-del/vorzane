import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { CharacterPortrait } from "../../src/components/CharacterPortrait";
import { useRouter } from "expo-router";
import { AppButton, AppScreen, Card, GradientCard, Icon, InputField, Meter, Pill, SectionTitle, Txt } from "../../src/components/ui";
import { CLASS_ICON, findExpedition, PETS, STARTER_ITEMS } from "../../src/game/catalog";
import { BrandMark } from "../../src/components/BrandMark";
import { combatStats, createBattleSequence, createHeroState, type BattleMode, type BattleResult, type BattleSequence } from "../../src/game/engine";
import { CLASS_DESCRIPTIONS, CLASS_NAMES, CLASS_PASSIVES, type ClassId } from "../../src/game/model";
import { useGame } from "../../src/contexts/GameContext";
import { palette } from "../../src/theme";

import { BattleArena } from "../../src/components/BattleArena";
import { createItemInstance } from "../../src/game/dungeonItems";

const CLASSES: ClassId[] = ["Warrior", "Mage", "Assassin", "Archer"];
const formatTime = (milliseconds: number) => {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}` : `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
};

export default function CampScreen() {
  const router = useRouter();
  const { state, update, saveStatus, status } = useGame();
  const [heroName, setHeroName] = useState("");
  const [selectedClass, setSelectedClass] = useState<ClassId>("Warrior");
  const [selectedGender, setSelectedGender] = useState<"male" | "female">("male");
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
    const next = createHeroState(heroName, selectedClass);
    next.characterStyle = { ...next.characterStyle, gender: selectedGender };
    const firstSword = createItemInstance(STARTER_ITEMS[0], "starter");
    const firstBoots = createItemInstance(STARTER_ITEMS[3], "starter");
    next.equipped[firstSword.slot] = firstSword;
    next.inventory.push(firstBoots);
    update(() => next);
  };

  const enterBattle = (mode: BattleMode) => {
    if (!hero) return;
    const sequence = createBattleSequence(state, mode);
    if (sequence) setBattleSequence(sequence);
  };

  const settleBattle = useCallback((result: BattleResult) => { update(() => result.state); }, [update]);

  if (!hero) return <AppScreen>
    <View style={styles.topline}><Txt style={styles.wordmark}>VORZANE</Txt><Pill label="الزنزانة الأولى • صحوة الرماد" icon="skull" tone="jade" /></View>
    <GradientCard style={styles.createHero}>
      <BrandMark size={58} />
      <Txt style={styles.createTitle}>اختر من يسير في الظل</Txt>
      <Txt muted style={styles.createCopy}>اصنع شخصيتك الأولى؛ يبدأ كل بطل برحلة مختلفة.</Txt>
      <SectionTitle title="اختر شخصيتك" icon="person-circle-outline" />
      <View style={styles.characterChoiceRow}>
        {([{ id: "male", label: "البطل" }, { id: "female", label: "البطلة" }] as const).map((option) => {
          const selected = selectedGender === option.id;
          return <Pressable key={option.id} onPress={() => setSelectedGender(option.id)} accessibilityRole="radio" accessibilityState={{ checked: selected }} style={[styles.characterChoice, selected && styles.characterChoiceActive]}>
            <CharacterPortrait gender={option.id} width={126} height={174} selected={selected} />
            <Txt style={[styles.characterChoiceLabel, selected && styles.characterChoiceLabelActive]}>{option.label}</Txt>
            {selected ? <Icon name="checkmark-circle" size={18} color={palette.gold} /> : <View style={styles.characterCheckSpace} />}
          </Pressable>;
        })}
      </View>
      <SectionTitle title="اختر فئتك" icon="shield-outline" />
      <View style={styles.classGrid}>
        {CLASSES.map((classId) => {
          const active = classId === selectedClass;
          return <Pressable key={classId} onPress={() => setSelectedClass(classId)} style={[styles.classCard, active && styles.classCardActive]}>
            <View style={styles.classCardArt}>
              <View style={styles.classCardContent}>
                <View style={[styles.classIcon, active && styles.classIconActive]}><Icon name={CLASS_ICON[classId] as never} size={22} color={active ? palette.ink : palette.jade} /></View>
                <Txt style={[styles.className, active && { color: palette.gold }]}>{CLASS_NAMES[classId]}</Txt>
                <Txt muted style={styles.classDesc}>{CLASS_DESCRIPTIONS[classId]}</Txt>
                <Txt style={styles.classPassive}>{CLASS_PASSIVES[classId].name} • {CLASS_PASSIVES[classId].description}</Txt>
              </View>
            </View>
          </Pressable>;
        })}
      </View>
      <InputField label="اسم البطل" value={heroName} onChangeText={setHeroName} placeholder="اسمٌ يليق بالأساطير" icon="person-outline" />
      <AppButton label="ابدأ الرحلة" icon="arrow-back" onPress={createHero} disabled={heroName.trim().length < 2} />
    </GradientCard>
    <Txt muted style={styles.smallCenter}>الفئة تحدد أسلوب اللعب والقدرات، ولا تغيّر شكل شخصيتك.</Txt>
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
        <Pressable onPress={() => router.push("/profile")} accessibilityRole="button" accessibilityLabel="فتح الملف الشخصي" style={styles.profileButton}>
          <CharacterPortrait gender={state.characterStyle.gender} width={36} height={42} compact />
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
          <Pill label={CLASS_PASSIVES[hero.className].name} icon="sparkles" tone="jade" />
          <Txt muted style={styles.heroCaption}>{activePet ? `رفيقك: ${activePet.name}` : "استعد لعبور حدود الرماد"}</Txt>
        </View>
        <CharacterPortrait gender={state.characterStyle.gender} width={104} height={132} />
      </View>
      <View style={styles.xpBlock}><View style={styles.xpMeta}><Txt muted style={styles.xpLabel}>الخبرة</Txt><Txt style={styles.xpValue}>{hero.exp} / {stats.xpNeeded}</Txt></View><Meter value={hero.exp} max={stats.xpNeeded} color={palette.gold} height={8} /></View>
      <View style={styles.powerRow}><Pill label={`قوة ${stats.power}`} icon="flash" tone="jade" /><Txt muted style={styles.saveLine}>{saveStatus}</Txt></View>
    </GradientCard>

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
  xpBlock: { gap: 7, marginTop: 16 },
  xpMeta: { flexDirection: "row", justifyContent: "space-between" },
  xpLabel: { fontSize: 11 },
  xpValue: { fontSize: 11, color: palette.gold, fontWeight: "700" },
  powerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12 },
  saveLine: { fontSize: 10, maxWidth: "62%" },
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
  characterChoiceRow: { flexDirection: "row", justifyContent: "center", gap: 14 },
  characterChoice: { width: "47%", alignItems: "center", gap: 8, padding: 9, borderRadius: 18, borderWidth: 1, borderColor: palette.line, backgroundColor: "#0E1A22" },
  characterChoiceActive: { borderColor: palette.gold, backgroundColor: "rgba(230,199,124,0.07)" },
  characterChoiceLabel: { color: palette.muted, fontSize: 13, fontWeight: "900" },
  characterChoiceLabelActive: { color: palette.gold },
  characterCheckSpace: { height: 18 },
  classGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  classCard: { width: "48%", minHeight: 116, borderRadius: 16, borderWidth: 1, borderColor: palette.line, overflow: "hidden" },
  classCardActive: { borderColor: palette.gold },
  classCardArt: { minHeight: 116, padding: 12, justifyContent: "flex-end", backgroundColor: "#15232D" },
  classCardContent: { alignItems: "flex-end", gap: 5 },
  classIcon: { width: 32, height: 32, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(98,216,195,0.10)" },
  classIconActive: { backgroundColor: palette.gold },
  className: { fontSize: 13, fontWeight: "900" },
  classDesc: { fontSize: 10, lineHeight: 15 },
  classPassive: { color: palette.gold, fontSize: 10, fontWeight: "900", marginTop: 3 },
  smallCenter: { textAlign: "center", fontSize: 11, lineHeight: 17 },
  modalBackdrop: { flex: 1, justifyContent: "center", alignItems: "center", padding: 22, backgroundColor: "rgba(0,0,0,0.70)" },
  battleReport: { width: "100%", maxWidth: 420, padding: 20, gap: 13, alignItems: "stretch" },
  reportIcon: { width: 54, height: 54, borderRadius: 19, backgroundColor: "rgba(230,199,124,0.10)", alignItems: "center", justifyContent: "center", alignSelf: "flex-end" },
  reportTitle: { fontSize: 22, fontWeight: "900" },
  reportCaption: { fontSize: 13, lineHeight: 20 },
  logBox: { backgroundColor: palette.midnight, borderRadius: 14, borderWidth: 1, borderColor: palette.line, padding: 12, gap: 7 },
  logLine: { fontSize: 12, lineHeight: 18 },
});
