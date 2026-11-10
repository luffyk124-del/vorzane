import { useState } from "react";
import { Modal, Platform, Share, StyleSheet, Switch, View } from "react-native";
import Slider from "@react-native-community/slider";
import * as DocumentPicker from "expo-document-picker";
import { AppButton, AppScreen, Card, Icon, InputField, PageTitle, Pill, SectionTitle, Txt } from "../../src/components/ui";
import { useAuth } from "../../src/contexts/AuthContext";
import { useGame } from "../../src/contexts/GameContext";
import { normalizeGameState } from "../../src/game/model";
import { palette } from "../../src/theme";

export default function SettingsScreen() {
  const auth = useAuth();
  const game = useGame();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [pendingImport, setPendingImport] = useState<ReturnType<typeof normalizeGameState>>(null);
  const [confirmImport, setConfirmImport] = useState(false);
  const isGuest = !!auth.user?.is_anonymous;
  const identity = auth.user?.email ?? (isGuest ? "حساب ضيف" : "غير مسجّل");

  const setMusic = (patch: Partial<typeof game.state.settings>) => game.update((current) => ({ ...current, settings: { ...current.settings, ...patch } }));
  const linkEmail = async () => {
    setMessage("");
    if (!email.trim() || password.length < 8) { setMessage("أدخل بريدًا صالحًا وكلمة مرور من 8 أحرف على الأقل."); return; }
    setBusy(true);
    try {
      if (isGuest && !(await game.flushNow())) { setMessage("تعذر تأكيد حفظ الضيف؛ لم يتم ربط البريد."); return; }
      const result = await auth.upgradeGuestWithEmail(email, password);
      setMessage(result.error ?? (result.confirmation ? "أرسلنا رسالة تأكيد إلى بريدك؛ سيبقى حفظ الضيف مرتبطًا بهذا الحساب." : "تم ربط البريد وحفظ هويتك."));
    } finally { setBusy(false); }
  };

  const signOut = async () => {
    setMessage("");
    setBusy(true);
    try {
      if (auth.user && !(await game.flushNow())) { setMessage("لم يتم تسجيل الخروج لأن الحفظ السحابي لم يتأكد. أعد المحاولة بعد عودة الاتصال."); return; }
      const error = await auth.signOut();
      if (error) setMessage(error);
    } finally { setBusy(false); }
  };

  const exportSave = async () => {
    setMessage("");
    const contents = JSON.stringify(game.state, null, 2);
    try {
      if (Platform.OS === "web" && typeof document !== "undefined") {
        const blob = new Blob([contents], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `vorzane-save-${new Date().toISOString().slice(0, 10)}.json`;
        anchor.click();
        URL.revokeObjectURL(url);
      } else {
        await Share.share({ title: "حفظ VORZANE", message: contents });
      }
      setMessage("تم تجهيز نسخة الحفظ.");
    } catch { setMessage("تعذر تصدير نسخة الحفظ."); }
  };

  const chooseImport = async () => {
    setMessage("");
    try {
      const picked = await DocumentPicker.getDocumentAsync({ type: "application/json", copyToCacheDirectory: true });
      if (picked.canceled || !picked.assets?.[0]) return;
      const response = await fetch(picked.assets[0].uri);
      const raw = await response.text();
      const parsed = normalizeGameState(JSON.parse(raw));
      if (!parsed) { setMessage("الملف لا يحتوي على حفظ VORZANE صالح."); return; }
      setPendingImport(parsed);
      setConfirmImport(true);
    } catch { setMessage("تعذر قراءة الملف. اختر ملف JSON صادرًا من VORZANE."); }
  };

  const applyImport = async () => {
    if (!pendingImport) return;
    setBusy(true);
    try {
      game.update(() => pendingImport);
      setConfirmImport(false);
      setPendingImport(null);
      setMessage("استُورد الحفظ؛ جارٍ مزامنته مع حسابك.");
    } finally { setBusy(false); }
  };

  const resetSave = async () => {
    setBusy(true);
    try {
      const success = await game.resetPlayerSave();
      setConfirmReset(false);
      setMessage(success ? "حُذف حفظ هذا الحساب فقط؛ لم يُمسّ حفظ أي لاعب آخر." : "تعذر حذف الحفظ السحابي؛ لم تُجرَ إزالة جزئية.");
    } finally { setBusy(false); }
  };

  return <AppScreen>
    <PageTitle eyebrow="تحكم بتجربتك" title="الإعدادات" subtitle="الصوت، الحساب، والنسخ الاحتياطي لتقدمك." trailing={<Pill label={identity} icon={isGuest ? "person-outline" : "person-circle-outline"} tone={isGuest ? "gold" : "jade"} />} />

    <SectionTitle title="الموسيقى" icon="musical-notes" />
    <Card style={styles.musicCard}>
      <View style={styles.settingRow}>
        <View style={styles.settingCopy}><Txt style={styles.settingTitle}>موسيقى الرحلة</Txt><Txt muted style={styles.settingSub}>موسيقى أصلية مستمرة أثناء اللعب</Txt></View>
        <Switch value={game.state.settings.musicEnabled} onValueChange={(value) => setMusic({ musicEnabled: value })} trackColor={{ false: "#293744", true: palette.jadeDark }} thumbColor={game.state.settings.musicEnabled ? palette.jade : "#A9B7BE"} />
      </View>
      <View style={[styles.volumeHeader, !game.state.settings.musicEnabled && { opacity: 0.45 }]}><Txt style={styles.volumeValue}>{game.state.settings.musicVolume}%</Txt><Txt muted style={styles.settingSub}>مستوى الصوت</Txt></View>
      <Slider
        style={[styles.slider, !game.state.settings.musicEnabled && { opacity: 0.4 }]}
        minimumValue={0}
        maximumValue={100}
        step={1}
        value={game.state.settings.musicVolume}
        onValueChange={(value) => setMusic({ musicVolume: Math.round(value) })}
        minimumTrackTintColor={palette.jade}
        maximumTrackTintColor="#344550"
        thumbTintColor={palette.gold}
        disabled={!game.state.settings.musicEnabled}
      />
      <View style={styles.volumeMarkers}><Txt muted style={styles.marker}>صامت</Txt><Txt muted style={styles.marker}>هادئ</Txt><Txt muted style={styles.marker}>مرتفع</Txt></View>
      <View style={styles.divider} />
      <View style={styles.settingRow}>
        <View style={styles.settingCopy}><Txt style={styles.settingTitle}>المؤثرات</Txt><Txt muted style={styles.settingSub}>نقرات ومكافآت اللعب</Txt></View>
        <Switch value={game.state.settings.sfx} onValueChange={(value) => setMusic({ sfx: value })} trackColor={{ false: "#293744", true: palette.jadeDark }} thumbColor={game.state.settings.sfx ? palette.jade : "#A9B7BE"} />
      </View>
    </Card>

    <SectionTitle title="حساب اللاعب" icon="person-circle-outline" />
    <Card style={styles.accountCard}>
      <View style={styles.accountIdentity}><View style={styles.accountIcon}><Icon name={isGuest ? "person-outline" : "mail-outline"} color={palette.jade} size={21} /></View><View style={{ flex: 1, alignItems: "flex-end" }}><Txt style={styles.settingTitle}>{identity}</Txt><Txt muted style={styles.settingSub}>{game.status === "ready" ? game.saveStatus : game.status === "offline" ? "وضع محلي مؤقت" : "جارٍ الاتصال"}</Txt></View></View>
      {isGuest ? <>
        <Txt muted style={styles.accountNote}>اربط الضيف ببريدك لتستعيد رحلتك على جهاز آخر. لن نبدّل هوية الحفظ قبل تأكيد المزامنة.</Txt>
        <InputField label="البريد الإلكتروني" value={email} onChangeText={setEmail} placeholder="name@example.com" keyboardType="email-address" icon="mail-outline" />
        <InputField label="كلمة مرور للحساب" value={password} onChangeText={setPassword} placeholder="8 أحرف على الأقل" secureTextEntry icon="key-outline" />
        <AppButton label="ربط البريد بالضيف" icon="link-outline" onPress={linkEmail} loading={busy} disabled={busy} />
      </> : null}
      {game.status === "offline" ? <AppButton label="إعادة محاولة المزامنة" icon="cloud-upload-outline" variant="jade" onPress={() => game.reloadCloud()} disabled={busy} /> : null}
      <AppButton label="تصدير نسخة JSON" icon="download-outline" variant="secondary" onPress={exportSave} disabled={busy} />
      <AppButton label="استيراد نسخة JSON" icon="cloud-upload-outline" variant="secondary" onPress={chooseImport} disabled={busy} />
      <AppButton label="تسجيل الخروج" icon="log-out-outline" variant="ghost" onPress={signOut} disabled={busy || game.status === "offline"} />
    </Card>

    {message || auth.error ? <Card style={styles.message}><Icon name="information-circle" color={palette.gold} size={18} /><Txt style={styles.messageText}>{message || auth.error}</Txt></Card> : null}

    <SectionTitle title="إدارة الحفظ" icon="cloud-done-outline" />
    <Card style={styles.cloudCard}>
      <View style={styles.cloudTop}><Pill label={game.status === "ready" ? "مرتبط بالسحابة" : game.status === "offline" ? "محلي مؤقت" : "جارٍ الفحص"} tone={game.status === "ready" ? "jade" : game.status === "offline" ? "red" : "muted"} icon={game.status === "ready" ? "cloud-done-outline" : "cloud-outline"} /><Txt style={styles.settingTitle}>حفظ خاص بهذا اللاعب</Txt></View>
      <Txt muted style={styles.accountNote}>تقدمك مرتبط بحسابك وحدك، ولا يستطيع لاعب آخر الوصول إليه. الحذف أدناه يطال تقدمك فقط.</Txt>
      <AppButton label="حذف حفظ حسابي والبدء من جديد" icon="trash-outline" variant="danger" onPress={() => setConfirmReset(true)} disabled={busy || game.status !== "ready"} />
    </Card>

    {game.status === "offline" && game.cloudError ? <Card style={styles.errorCard}><Txt style={styles.errorText}>{game.cloudError}</Txt></Card> : null}

    <Modal transparent visible={confirmReset} animationType="fade" onRequestClose={() => setConfirmReset(false)}>
      <View style={styles.modalBackdrop}><Card style={styles.confirmCard}><View style={styles.modalIcon}><Icon name="trash-outline" color={palette.red} size={24} /></View><Txt style={styles.modalTitle}>حذف حفظ هذا الحساب؟</Txt><Txt muted style={styles.modalCopy}>سيُحذف صف تقدمك السحابي فقط. لا يمكن التراجع عن الحذف، ولن يُمسّ تقدم أي لاعب آخر أو ملف الحفظ القديم على الجهاز.</Txt><AppButton label="نعم، احذف حفظي" icon="trash-outline" variant="danger" onPress={resetSave} loading={busy} /><AppButton label="إلغاء" variant="secondary" onPress={() => setConfirmReset(false)} disabled={busy} /></Card></View>
    </Modal>

    <Modal transparent visible={confirmImport} animationType="fade" onRequestClose={() => setConfirmImport(false)}>
      <View style={styles.modalBackdrop}><Card style={styles.confirmCard}><View style={styles.modalIcon}><Icon name="cloud-upload-outline" color={palette.jade} size={24} /></View><Txt style={styles.modalTitle}>استبدال تقدم هذا الحساب؟</Txt><Txt muted style={styles.modalCopy}>سيُرفع ملف الحفظ المختار لحساب اللاعب الحالي، مع بقاء الحفظ المحلي القديم محفوظًا كنسخة منفصلة.</Txt><AppButton label="استيراد ومزامنة" icon="checkmark" variant="jade" onPress={applyImport} disabled={busy} /><AppButton label="إلغاء" variant="secondary" onPress={() => { setConfirmImport(false); setPendingImport(null); }} disabled={busy} /></Card></View>
    </Modal>
  </AppScreen>;
}

const styles = StyleSheet.create({
  musicCard: { gap: 12 },
  settingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  settingCopy: { flex: 1, alignItems: "flex-end", gap: 4 },
  settingTitle: { fontSize: 14, fontWeight: "900" },
  settingSub: { fontSize: 11, lineHeight: 17 },
  volumeHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 5 },
  volumeValue: { color: palette.gold, fontSize: 13, fontWeight: "900" },
  slider: { width: "100%", height: 30, transform: [{ scaleX: -1 }] },
  volumeMarkers: { flexDirection: "row", justifyContent: "space-between", marginTop: -5 },
  marker: { fontSize: 10 },
  divider: { height: 1, backgroundColor: palette.line, marginVertical: 4 },
  accountCard: { gap: 12 },
  accountIdentity: { flexDirection: "row", alignItems: "center", gap: 10 },
  accountIcon: { width: 43, height: 43, borderRadius: 15, backgroundColor: "rgba(98,216,195,0.10)", alignItems: "center", justifyContent: "center" },
  accountNote: { fontSize: 12, lineHeight: 20 },
  message: { flexDirection: "row", alignItems: "center", gap: 8, padding: 11, borderColor: "rgba(230,199,124,0.24)" },
  messageText: { flex: 1, fontSize: 12, lineHeight: 19 },
  cloudCard: { gap: 11 },
  cloudTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  errorCard: { borderColor: "rgba(230,121,112,0.25)" },
  errorText: { color: palette.red, fontSize: 12, lineHeight: 19 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.76)", justifyContent: "center", alignItems: "center", padding: 20 },
  confirmCard: { width: "100%", maxWidth: 430, padding: 20, gap: 13 },
  modalIcon: { width: 51, height: 51, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(230,121,112,0.09)" },
  modalTitle: { fontSize: 21, fontWeight: "900" },
  modalCopy: { fontSize: 13, lineHeight: 21 },
});
