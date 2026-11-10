import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { AppButton, AppScreen, Card, Icon, PageTitle, Pill, SectionTitle, Txt } from "../../src/components/ui";
import { CharacterPortrait } from "../../src/components/CharacterPortrait";
import { getPublicPlayerProfile, type PublicPlayerProfile } from "../../src/lib/social";
import { CLASS_NAMES, type ClassId } from "../../src/game/model";
import { palette } from "../../src/theme";

const STAT_LABELS: Record<string, string> = { str: "القوة", def: "الدفاع", vit: "الحيوية", agi: "الرشاقة", luck: "الحظ" };

export default function PublicPlayerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [profile, setProfile] = useState<PublicPlayerProfile | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    if (!id) { setError("معرّف اللاعب غير صالح."); setLoading(false); return; }
    void getPublicPlayerProfile(String(id)).then((result) => {
      if (!active) return;
      setProfile(result);
      if (!result) setError("لم يتم العثور على ملف هذا اللاعب.");
    }).catch((caught) => {
      if (active) setError(caught instanceof Error ? caught.message : "تعذر تحميل الملف العام.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  if (loading) return <AppScreen><Card style={styles.stateCard}><Icon name="hourglass-outline" size={28} color={palette.gold} /><Txt>جارٍ تحميل ملف اللاعب...</Txt></Card></AppScreen>;
  if (!profile) return <AppScreen><PageTitle title="ملف اللاعب" /><Card style={styles.stateCard}><Icon name="alert-circle-outline" size={28} color={palette.red} /><Txt style={styles.error}>{error}</Txt></Card></AppScreen>;

  const equipped = Object.entries(profile.equipped ?? {}).filter(([, item]) => !!item);
  const className = (Object.hasOwn(CLASS_NAMES, profile.class_name) ? CLASS_NAMES[profile.class_name as ClassId] : "مغامر");
  return <AppScreen>
    <ScrollView contentContainerStyle={styles.content}>
      <PageTitle eyebrow="ملف لاعب عام" title={profile.display_name} subtitle="هذه البيانات متاحة لجميع لاعبي VORZANE." trailing={<Pill label={`المستوى ${profile.level.toLocaleString("en-US")}`} tone="gold" />} />
      <Card style={styles.heroCard}>
        <View style={styles.heroRow}>
          <CharacterPortrait gender={profile.character_gender === "female" ? "female" : "male"} width={112} height={146} />
          <View style={styles.heroInfo}>
            <Txt style={styles.heroName}>{profile.hero_name}</Txt>
            <Txt style={styles.heroClass}>{className}</Txt>
            <Pill label={`المستوى ${profile.level.toLocaleString("en-US")}`} icon="star" tone="gold" />
          </View>
        </View>
        <View style={styles.statsRow}>
          <MiniStat label="انتصارات" value={profile.wins} />
          <MiniStat label="معارك" value={profile.battles} />
          <MiniStat label="طابق الديماس" value={profile.dimas_floor} />
          <MiniStat label="أحداث التجوال" value={profile.roaming_events} />
        </View>
      </Card>

      <SectionTitle title="السمات الأساسية" icon="analytics-outline" />
      <View style={styles.statsGrid}>
        {Object.entries(profile.stats ?? {}).map(([key, value]) => <Card key={key} style={styles.statCard}><Txt style={styles.statValue}>{Number(value).toLocaleString("en-US")}</Txt><Txt muted style={styles.statLabel}>{STAT_LABELS[key] ?? key}</Txt></Card>)}
      </View>

      <SectionTitle title="العتاد الذي يرتديه" icon="shield-checkmark-outline" action={<Pill label={`${equipped.length}/8`} tone="jade" />} />
      <Card style={styles.gearCard}>
        {equipped.length ? equipped.map(([slot, item]) => <View key={slot} style={styles.gearRow}>
          <View style={styles.gearInfo}><Txt style={styles.gearName}>{item?.name ?? "قطعة عتاد"}</Txt><Txt muted style={styles.gearMeta}>{slot} • {item?.rarity ?? "عادي"}</Txt></View>
          <Icon name="shield-checkmark" color={palette.jade} size={18} />
        </View>) : <Txt muted style={styles.empty}>لا يوجد عتاد مجهّز حاليًا.</Txt>}
      </Card>
      {profile.active_pet ? <Card style={styles.petCard}><Icon name="paw" color={palette.gold} size={20} /><Txt style={styles.petText}>الرفيق النشط: {profile.active_pet}</Txt></Card> : null}
      <AppButton label="العودة" icon="arrow-back" variant="secondary" onPress={() => {}} />
    </ScrollView>
  </AppScreen>;
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return <View style={styles.miniStat}><Txt style={styles.miniValue}>{Number(value).toLocaleString("en-US")}</Txt><Txt muted style={styles.miniLabel}>{label}</Txt></View>;
}

const styles = StyleSheet.create({
  content: { gap: 12, paddingBottom: 28 },
  stateCard: { padding: 22, alignItems: "center", gap: 10 },
  error: { color: palette.red, textAlign: "center" },
  heroCard: { padding: 16, gap: 13, backgroundColor: "#13242C", borderColor: "rgba(98,216,195,0.22)" },
  heroRow: { flexDirection: "row", alignItems: "center", gap: 13 },
  heroInfo: { flex: 1, alignItems: "flex-end", gap: 8 },
  heroName: { fontSize: 21, fontWeight: "900", textAlign: "right" },
  heroClass: { color: palette.jade, fontSize: 13, fontWeight: "900" },
  statsRow: { flexDirection: "row", justifyContent: "space-around", borderTopWidth: 1, borderTopColor: palette.line, paddingTop: 12 },
  miniStat: { alignItems: "center", gap: 3 },
  miniValue: { color: palette.gold, fontSize: 15, fontWeight: "900" },
  miniLabel: { fontSize: 9, textAlign: "center" },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  statCard: { width: "31.5%", padding: 10, alignItems: "center", gap: 3 },
  statValue: { color: palette.gold, fontSize: 17, fontWeight: "900" },
  statLabel: { fontSize: 10 },
  gearCard: { padding: 12, gap: 9 },
  gearRow: { flexDirection: "row", alignItems: "center", gap: 9, borderBottomWidth: 1, borderBottomColor: palette.line, paddingVertical: 7 },
  gearInfo: { flex: 1, alignItems: "flex-end", gap: 3 },
  gearName: { fontSize: 12, fontWeight: "900" },
  gearMeta: { fontSize: 10 },
  empty: { textAlign: "right", fontSize: 11 },
  petCard: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 8, padding: 12 },
  petText: { fontSize: 12, fontWeight: "800" },
});
