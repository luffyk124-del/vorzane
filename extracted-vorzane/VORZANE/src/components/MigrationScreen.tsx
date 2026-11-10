import { useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { AppButton, AppScreen, Card, Icon, Pill, Txt } from "./ui";
import { useGame } from "../contexts/GameContext";
import { palette } from "../theme";

export default function MigrationScreen() {
  const router = useRouter();
  const { migration, resolveMigration, saveStatus, cloudError } = useGame();
  const [busy, setBusy] = useState(false);

  const choose = async (choice: "import" | "fresh" | "local" | "cloud") => {
    setBusy(true);
    try {
      const saved = await resolveMigration(choice);
      if (saved) router.replace("/(tabs)/home");
    } finally { setBusy(false); }
  };

  if (!migration) return <AppScreen scroll={false} contentStyle={styles.loadingPage}><ActivityIndicator color={palette.jade} size="large" /><Txt muted>جارٍ التحقق من نسخ الحفظ…</Txt></AppScreen>;

  if (migration.kind === "offline") return <AppScreen contentStyle={styles.page}>
    <View style={styles.brand}><Icon name="shield-half" color={palette.gold} size={23} /><Txt style={styles.wordmark}>VORZANE</Txt></View>
    <Card style={styles.card}>
      <View style={styles.icon}><Icon name="git-compare-outline" size={27} color={palette.jade} /></View>
      <Pill label="تعارض مزامنة" tone="gold" icon="cloud-offline-outline" />
      <Txt style={styles.title}>توجد نسختان لهذا اللاعب</Txt>
      <Txt muted style={styles.copy}>{migration.cloudMissing ? "لم نعثر على حفظ سحابي لهذا الحساب. ربما أُعيد ضبطه من جهاز آخر. يمكنك استعادة نسخة هذا الجهاز أو بدء حفظ سحابي جديد؛ لن نستبدل أي نسخة دون موافقتك." : "لعبت على هذا الجهاز أثناء انقطاع الاتصال، كما يوجد تقدم أحدث في السحابة. اختر النسخة التي تريد الاحتفاظ بها؛ لن نستبدل نسخة دون موافقتك."}</Txt>
      <View style={styles.compareRow}>
        <View style={styles.compareCard}><Pill label="على الجهاز" tone="jade" /><Txt style={styles.compareLevel}>مستوى {migration.localState.hero?.level ?? 1}</Txt><Txt muted style={styles.compareText}>{migration.localState.gold.toLocaleString("ar-EG")} ذهب • {migration.localState.wins} انتصار</Txt></View>
        <View style={styles.compareCard}><Pill label={migration.cloudMissing ? "حفظ جديد" : "السحابة"} tone="gold" /><Txt style={styles.compareLevel}>مستوى {migration.cloudState.hero?.level ?? 1}</Txt><Txt muted style={styles.compareText}>{migration.cloudState.gold.toLocaleString("ar-EG")} ذهب • {migration.cloudState.wins} انتصار</Txt></View>
      </View>
      {cloudError ? <Txt style={styles.error}>{cloudError}</Txt> : <Txt muted style={styles.status}>{saveStatus}</Txt>}
      <AppButton label="احتفظ بنسخة الجهاز وارفعها" icon="cloud-upload-outline" onPress={() => choose("local")} loading={busy} disabled={busy} />
      <AppButton label={migration.cloudMissing ? "ابدأ بحفظ سحابي جديد" : "احتفظ بالنسخة السحابية"} icon="cloud-done-outline" variant="secondary" onPress={() => choose("cloud")} disabled={busy} />
      {busy ? <View style={styles.busy}><ActivityIndicator color={palette.jade} /><Txt muted>ننتظر تأكيد حفظ اختيارك…</Txt></View> : null}
      <Txt muted style={styles.footnote}>{migration.cloudMissing ? "ستبقى نسخة الجهاز محفوظة حتى تختار صراحةً استعادتها أو بدء حفظ جديد." : "لن تُمحى نسخة الجهاز عند اعتماد السحابة، ولن تُمحى السحابة قبل تأكيد رفع نسخة الجهاز."}</Txt>
    </Card>
  </AppScreen>;

  const legacy = migration.state;
  return <AppScreen contentStyle={styles.page}>
    <View style={styles.brand}><Icon name="shield-half" color={palette.gold} size={23} /><Txt style={styles.wordmark}>VORZANE</Txt></View>
    <Card style={styles.card}>
      <View style={styles.icon}><Icon name="git-compare-outline" size={27} color={palette.jade} /></View>
      <Pill label="تأكيد ملكية الحفظ" tone="jade" icon="lock-closed" />
      <Txt style={styles.title}>وجدنا تقدمًا على هذا الجهاز</Txt>
      <Txt muted style={styles.copy}>قد يكون الحفظ من لاعب آخر استخدم هذا المتصفح. لن نرفعه إلى حسابك أو نستبدله تلقائيًا. اختر ما يناسبك؛ سيبقى الملف المحلي كما هو إن تعذر النقل.</Txt>
      <View style={styles.preview}>
        <View style={styles.previewRow}><Txt muted>الشخصية</Txt><Txt style={styles.value}>{legacy.hero?.name ?? "مغامر"}</Txt></View>
        <View style={styles.previewRow}><Txt muted>المستوى</Txt><Txt style={styles.value}>{legacy.hero?.level ?? 1}</Txt></View>
        <View style={styles.previewRow}><Txt muted>الذهب</Txt><Txt style={styles.value}>{legacy.gold.toLocaleString("ar-EG")}</Txt></View>
        <View style={styles.previewRow}><Txt muted>الانتصارات</Txt><Txt style={styles.value}>{legacy.wins}</Txt></View>
      </View>
      {cloudError ? <Txt style={styles.error}>{saveStatus} — {cloudError}</Txt> : <Txt muted style={styles.status}>{saveStatus}</Txt>}
      <AppButton label="نقل هذا الحفظ إلى حسابي" icon="cloud-upload-outline" onPress={() => choose("import")} loading={busy} disabled={busy} />
      <AppButton label="ابدأ بحفظ جديد" icon="refresh-outline" variant="secondary" onPress={() => choose("fresh")} disabled={busy} />
      {busy ? <View style={styles.busy}><ActivityIndicator color={palette.jade} /><Txt muted>ننتظر تأكيد الحفظ السحابي…</Txt></View> : null}
      <Txt muted style={styles.footnote}>لن نغلق هذه الشاشة قبل التأكد من حفظ تقدمك.</Txt>
    </Card>
  </AppScreen>;
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, justifyContent: "center", gap: 24, paddingVertical: 28 },
  loadingPage: { alignItems: "center", justifyContent: "center", gap: 14 },
  brand: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 9 },
  wordmark: { fontSize: 22, color: palette.gold, fontWeight: "900", letterSpacing: 2 },
  card: { gap: 15, padding: 20 },
  icon: { height: 58, width: 58, borderRadius: 19, backgroundColor: "rgba(98,216,195,0.12)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(98,216,195,0.25)" },
  title: { fontSize: 24, fontWeight: "900", marginTop: 2 },
  copy: { fontSize: 14, lineHeight: 23 },
  preview: { backgroundColor: palette.midnight, borderRadius: 15, borderWidth: 1, borderColor: palette.line, paddingHorizontal: 14, paddingVertical: 8 },
  previewRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: palette.line },
  value: { fontSize: 14, fontWeight: "800" },
  compareRow: { flexDirection: "row", gap: 9 },
  compareCard: { flex: 1, minHeight: 105, borderRadius: 15, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.midnight, padding: 10, gap: 9, alignItems: "flex-end" },
  compareLevel: { fontSize: 15, fontWeight: "900" },
  compareText: { fontSize: 10, lineHeight: 15 },
  error: { color: palette.red, fontSize: 12, lineHeight: 19 },
  status: { fontSize: 12, lineHeight: 18 },
  busy: { flexDirection: "row", gap: 9, alignItems: "center", justifyContent: "center" },
  footnote: { textAlign: "center", fontSize: 11, lineHeight: 17 },
});
