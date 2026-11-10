import { StyleSheet, View } from "react-native";
import { CharacterPortrait } from "../../src/components/CharacterPortrait";
import { useRouter } from "expo-router";
import { AppButton, AppScreen, Card, Icon, PageTitle, Pill, SectionTitle, StatCard, Txt } from "../../src/components/ui";
import ProgressRing from "../../src/components/ProgressRing";
import { CLASS_ICON } from "../../src/game/catalog";
import { allocateStatPoint, combatStats } from "../../src/game/engine";
import { CLASS_DESCRIPTIONS, CLASS_NAMES, CLASS_PASSIVES, type StatKey } from "../../src/game/model";
import { useGame } from "../../src/contexts/GameContext";
import { palette } from "../../src/theme";

const STAT_LABELS: Record<StatKey, string> = { str: "القوة", def: "الدفاع", vit: "الحيوية", agi: "الرشاقة", luck: "الحظ" };
const STAT_KEYS: StatKey[] = ["str", "def", "vit", "agi", "luck"];

export default function CharacterScreen() {
  const router = useRouter();
  const { state, update } = useGame();
  const hero = state.hero;

  if (!hero) return <AppScreen>
    <PageTitle eyebrow="ملف البطل" title="الشخصية" subtitle="تظهر بيانات شخصيتك بعد إنشائها في المخيم." />
    <Card style={styles.emptyCard}>
      <Icon name="person-circle-outline" size={42} color={palette.jade} />
      <Txt style={styles.emptyTitle}>لم تنشئ شخصية بعد</Txt>
      <Txt muted style={styles.emptyCopy}>ابدأ من المخيم، واختر الفئة والجنس مرة واحدة عند الإنشاء.</Txt>
      <AppButton label="الذهاب إلى المخيم" icon="home-outline" onPress={() => router.push("/(tabs)/home")} />
    </Card>
  </AppScreen>;

  const stats = combatStats(state);

  return <AppScreen>
    <PageTitle eyebrow="ملف البطل" title="الشخصية" subtitle="بيانات البطل وتقدمه وتطوير سماته." trailing={
      <View style={styles.classEmblem}><Icon name={CLASS_ICON[hero.className] as never} size={28} color={palette.gold} /></View>
    } />
    <Card style={styles.heroCard}>
      <View style={styles.heroTop}>
        <View style={styles.identityCopy}>
          <Txt style={styles.heroName}>{hero.name}</Txt>
          <Txt style={styles.heroClass}>{CLASS_NAMES[hero.className]}</Txt>
          <Txt muted style={styles.heroDescription}>{CLASS_DESCRIPTIONS[hero.className]}</Txt>
          <Pill label={CLASS_PASSIVES[hero.className].name} icon="sparkles" tone="jade" />
        </View>
        <CharacterPortrait gender={state.characterStyle.gender} width={112} height={148} />
      </View>
      <View style={styles.progressRow}>
        <ProgressRing progress={stats.xpNeeded > 0 ? hero.exp / stats.xpNeeded : 0} size={112} strokeWidth={8} color={palette.gold} trackColor={palette.line} label="تقدم الخبرة إلى المستوى التالي">
          <Txt style={styles.levelNumber}>{hero.level}</Txt>
          <Txt muted style={styles.levelCaption}>المستوى</Txt>
        </ProgressRing>
        <View style={styles.progressCopy}>
          <Txt style={styles.progressTitle}>التقدم التالي</Txt>
          <Txt muted style={styles.progressText}>{hero.exp.toLocaleString("en-US")} / {stats.xpNeeded.toLocaleString("en-US")} خبرة</Txt>
          <Pill label={`${hero.statPoints} نقطة تطوير متاحة`} tone={hero.statPoints > 0 ? "gold" : "muted"} />
        </View>
      </View>
    </Card>

    <SectionTitle title="القدرات الأساسية" icon="analytics-outline" />
    <View style={styles.statsGrid}>
      <StatCard label="الصحة" value={stats.maxHP} icon="heart" color={palette.red} />
      <StatCard label="الهجوم" value={stats.attack} icon="sword" color={palette.gold} />
      <StatCard label="الدفاع" value={stats.defense} icon="shield-checkmark" color={palette.blue} />
      <StatCard label="القوة" value={stats.power} icon="fist" color={palette.jade} />
    </View>

    <SectionTitle title="تطوير السمات" icon="bar-chart-outline" action={<Pill label={`${hero.statPoints} نقطة متاحة`} tone="gold" />} />
    <Card style={styles.statCard}>
      {STAT_KEYS.map((key) => <View key={key} style={styles.statRow}>
        <AppButton label="+1" icon="add-circle-outline" variant="jade" small disabled={hero.statPoints < 1 || hero.stats[key] >= 999_999} onPress={() => update((current) => allocateStatPoint(current, key).state)} style={styles.allocateButton} />
        <View style={styles.statValue}>
          <Txt style={styles.statNumber}>{hero.stats[key].toLocaleString("en-US")}</Txt>
          <Txt muted style={styles.statLabel}>{STAT_LABELS[key]}</Txt>
        </View>
      </View>)}
      {hero.statPoints > 0 ? <Txt muted style={styles.statHint}>كل نقطة تُحفظ تلقائيًا مع تقدمك.</Txt> : <Txt muted style={styles.statHint}>ستحصل على نقاط جديدة عند الترقّي بالمستوى.</Txt>}
    </Card>

  </AppScreen>;
}

const styles = StyleSheet.create({
  emptyCard: { alignItems: "center", gap: 12, padding: 22 },
  emptyTitle: { fontSize: 18, fontWeight: "900" },
  emptyCopy: { fontSize: 12, lineHeight: 19, textAlign: "center" },
  classEmblem: { width: 54, height: 54, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(230,199,124,0.10)", borderWidth: 1, borderColor: "rgba(230,199,124,0.25)" },
  heroCard: { gap: 16, backgroundColor: "#13242C" },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  identityCopy: { flex: 1, alignItems: "flex-end", gap: 6 },
  heroName: { fontSize: 22, fontWeight: "900" },
  heroClass: { color: palette.jade, fontSize: 14, fontWeight: "900" },
  heroDescription: { fontSize: 11, lineHeight: 18, textAlign: "right" },
  progressRow: { flexDirection: "row", alignItems: "center", gap: 15, paddingTop: 13, borderTopWidth: 1, borderTopColor: palette.line },
  progressCopy: { flex: 1, alignItems: "flex-end", gap: 7 },
  progressTitle: { fontSize: 14, fontWeight: "900" },
  progressText: { fontSize: 11, textAlign: "right" },
  levelNumber: { color: palette.gold, fontSize: 24, fontWeight: "900" },
  levelCaption: { fontSize: 9, fontWeight: "800" },
  statsGrid: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  statCard: { gap: 7, backgroundColor: "#13242C" },
  statRow: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: palette.line, paddingVertical: 4 },
  allocateButton: { width: 82 },
  statValue: { flexDirection: "row", alignItems: "center", gap: 9 },
  statNumber: { minWidth: 34, color: palette.gold, fontSize: 15, fontWeight: "900", textAlign: "center" },
  statLabel: { fontSize: 13, fontWeight: "800" },
  statHint: { fontSize: 11, lineHeight: 18, textAlign: "right" },
});
