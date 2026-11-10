import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { AppButton, AppScreen, Card, Icon, PageTitle, Pill, SectionTitle, Txt } from "../../src/components/ui";
import { CharacterPortrait } from "../../src/components/CharacterPortrait";
import { useAuth } from "../../src/contexts/AuthContext";
import { useGame } from "../../src/contexts/GameContext";
import { getMyProfile, saveMyProfile } from "../../src/lib/social";
import { CLASS_NAMES } from "../../src/game/model";
import { combatStats, totalStats } from "../../src/game/stats";
import { palette } from "../../src/theme";
import { TextInput } from "react-native";

const STAT_LABELS: Record<string, string> = { str: "القوة", def: "الدفاع", vit: "الحيوية", agi: "الرشاقة", luck: "الحظ" };

export default function ProfileScreen() {
  const { user } = useAuth();
  const { state } = useGame();
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const hero = state.hero;
  const totals = totalStats(state);
  const combat = combatStats(state);

  useEffect(() => {
    let active = true;
    if (!user?.id) return () => { active = false; };
    void getMyProfile(user.id).then((profile) => {
      if (!active) return;
      if (profile) setDisplayName(profile.display_name);
      else if (hero?.name) setDisplayName(hero.name);
    }).catch((error) => {
      if (active) setNotice(error instanceof Error ? error.message : "تعذر تحميل الملف الشخصي.");
    });
    return () => { active = false; };
  }, [user?.id, hero?.name]);

  const save = async () => {
    setBusy(true);
    setNotice("");
    try {
      await saveMyProfile(displayName.trim(), String(state.profileAvatarId));
      setNotice("تم حفظ اسمك. ملفك ظاهر لجميع اللاعبين وفي نتائج البحث.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "تعذر حفظ الملف الشخصي.");
    } finally {
      setBusy(false);
    }
  };

  return <AppScreen>
    <PageTitle eyebrow="هويتك في العالم" title="الملف الشخصي" subtitle="ملف عام يراه جميع اللاعبين، ويعرض شخصيتك وتقدمك وعتادك الحالي." trailing={<CharacterPortrait gender={state.characterStyle.gender} width={66} height={86} />} />
    <Card style={styles.heroCard}>
      <View style={styles.heroRow}>
        <CharacterPortrait gender={state.characterStyle.gender} width={104} height={136} />
        <View style={styles.heroInfo}>
          <Pill label={hero ? `المستوى ${hero.level.toLocaleString("en-US")}` : "لم تنشأ الشخصية"} tone="gold" />
          <Txt style={styles.heroName}>{displayName.trim() || hero?.name || "اسم اللاعب"}</Txt>
          <Txt style={styles.heroClass}>{hero ? CLASS_NAMES[hero.className] : "الفئة غير محددة"}</Txt>
          <Txt muted style={styles.hint}>الشخصية المختارة عند إنشاء البطل ثابتة ولا يمكن استبدالها.</Txt>
        </View>
      </View>
      {hero ? <View style={styles.publicStats}>
        <View style={styles.miniStat}><Txt style={styles.miniValue}>{state.wins.toLocaleString("en-US")}</Txt><Txt muted style={styles.miniLabel}>انتصار</Txt></View>
        <View style={styles.miniStat}><Txt style={styles.miniValue}>{state.battles.toLocaleString("en-US")}</Txt><Txt muted style={styles.miniLabel}>معركة</Txt></View>
        <View style={styles.miniStat}><Txt style={styles.miniValue}>{state.dimas.highestFloor.toLocaleString("en-US")}</Txt><Txt muted style={styles.miniLabel}>الديماس</Txt></View>
        <View style={styles.miniStat}><Txt style={styles.miniValue}>{state.roaming.eventsCompleted.toLocaleString("en-US")}</Txt><Txt muted style={styles.miniLabel}>حدث تجوال</Txt></View>
      </View> : null}
    </Card>

    <SectionTitle title="اسم اللاعب" icon="person-circle-outline" />
    <Card style={styles.panel}>
      <TextInput value={displayName} onChangeText={setDisplayName} maxLength={24} placeholder="اسمك الظاهر لجميع اللاعبين" placeholderTextColor={palette.muted} style={styles.input} accessibilityLabel="اسم اللاعب" />
      <Txt muted style={styles.hint}>من 3 إلى 24 حرفًا. هذا الاسم يظهر في البحث وصفحتك العامة.</Txt>
      <AppButton label="حفظ اسم اللاعب" onPress={save} loading={busy} disabled={busy || !user || displayName.trim().length < 3} icon="save-outline" />
      <View style={styles.publicNotice}><Icon name="globe-outline" color={palette.jade} size={18} /><Txt style={styles.publicNoticeText}>الملف ظاهر دائمًا، ولا يوجد خيار لإخفائه أو تعطيل ظهوره في البحث.</Txt></View>
    </Card>

    {hero ? <>
      <SectionTitle title="الإحصائيات القتالية" icon="analytics-outline" />
      <View style={styles.statsGrid}>
        {Object.entries(totals).map(([key, value]) => <Card key={key} style={styles.statCard}><Txt style={styles.statValue}>{value.toLocaleString("en-US")}</Txt><Txt muted style={styles.statLabel}>{STAT_LABELS[key] ?? key}</Txt></Card>)}
        <Card style={styles.statCard}><Txt style={styles.statValue}>{combat.attack.toLocaleString("en-US")}</Txt><Txt muted style={styles.statLabel}>الهجوم</Txt></Card>
        <Card style={styles.statCard}><Txt style={styles.statValue}>{combat.defense.toLocaleString("en-US")}</Txt><Txt muted style={styles.statLabel}>الصد</Txt></Card>
        <Card style={styles.statCard}><Txt style={styles.statValue}>{combat.maxHP.toLocaleString("en-US")}</Txt><Txt muted style={styles.statLabel}>الصحة القصوى</Txt></Card>
      </View>

      <SectionTitle title="العتاد المجهّز" icon="shield-checkmark-outline" action={<Pill label={`${Object.values(state.equipped).filter(Boolean).length}/8`} tone="gold" />} />
      <Card style={styles.gearCard}>
        {Object.entries(state.equipped).filter(([, item]) => !!item).map(([slot, item]) => <View key={slot} style={styles.gearRow}>
          <View style={styles.gearCopy}><Txt style={styles.gearName}>{item?.name}</Txt><Txt muted style={styles.hint}>{slot} • {item?.rarity}</Txt></View>
          <Icon name="shield-checkmark" color={palette.jade} size={19} />
        </View>)}
        {!Object.values(state.equipped).some(Boolean) ? <Txt muted style={styles.hint}>لا يوجد عتاد مجهّز حاليًا.</Txt> : null}
      </Card>
    </> : null}
  </AppScreen>;
}

const styles = StyleSheet.create({
  heroCard: { padding: 16, gap: 14, backgroundColor: "#13242C", borderColor: "rgba(98,216,195,0.25)" },
  heroRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  heroInfo: { flex: 1, alignItems: "flex-end", gap: 6 },
  heroName: { fontSize: 21, fontWeight: "900", textAlign: "right" },
  heroClass: { fontSize: 13, color: palette.jade, fontWeight: "800" },
  hint: { fontSize: 10, lineHeight: 17, textAlign: "right" },
  publicStats: { flexDirection: "row", justifyContent: "space-around", borderTopWidth: 1, borderTopColor: palette.line, paddingTop: 12 },
  miniStat: { alignItems: "center", gap: 3 },
  miniValue: { color: palette.gold, fontSize: 15, fontWeight: "900" },
  miniLabel: { fontSize: 9 },
  panel: { gap: 11, backgroundColor: "#13242C" },
  input: { minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: palette.line, paddingHorizontal: 12, color: palette.text, textAlign: "right", backgroundColor: "#0B171D" },
  publicNotice: { flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 5 },
  publicNoticeText: { flex: 1, fontSize: 11, color: palette.jade, textAlign: "right" },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  statCard: { width: "31.5%", padding: 11, alignItems: "center", gap: 4 },
  statValue: { fontSize: 18, fontWeight: "900", color: palette.gold },
  statLabel: { fontSize: 10 },
  gearCard: { padding: 12, gap: 10 },
  gearRow: { flexDirection: "row", alignItems: "center", gap: 9, borderBottomWidth: 1, borderBottomColor: palette.line, paddingVertical: 7 },
  gearCopy: { flex: 1, alignItems: "flex-end", gap: 3 },
  gearName: { fontSize: 12, fontWeight: "900" },
});
