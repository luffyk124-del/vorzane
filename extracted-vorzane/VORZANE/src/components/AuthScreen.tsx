import { useEffect, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { AppButton, AppScreen, Card, Icon, InputField, Pill, Txt } from "./ui";
import { BrandMark } from "./BrandMark";
import { useAuth } from "../contexts/AuthContext";
import { useGame } from "../contexts/GameContext";
import { palette } from "../theme";

export default function AuthScreen() {
  const router = useRouter();
  const auth = useAuth();
  const game = useGame();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (auth.user && game.status === "ready") router.replace("/(tabs)/home");
    else if (auth.user && game.status === "migration") router.replace("/migration");
  }, [auth.user, game.status, router]);

  if (auth.loading || game.status === "loading") {
    return <AppScreen scroll={false} contentStyle={styles.loadingScreen}><ActivityIndicator color={palette.jade} size="large" /><Txt style={styles.loadingText}>تُفتح بوابة VORZANE…</Txt></AppScreen>;
  }
  if (auth.user && game.status === "ready") return <Redirect href="/(tabs)/home" />;
  if (auth.user && game.status === "migration") return <Redirect href="/migration" />;

  const submit = async () => {
    setNotice("");
    auth.clearError();
    if (!email.trim() || password.length < 8) {
      setNotice("أدخل بريدًا صحيحًا وكلمة مرور من 8 أحرف على الأقل.");
      return;
    }
    setBusy(true);
    try {
      if (auth.user?.is_anonymous && mode === "signup") {
        const flushed = await game.flushNow();
        if (!flushed) {
          setNotice("لم أستطع تأكيد حفظ حساب الضيف؛ لم يتم ربط البريد حتى لا يضيع التقدم.");
          return;
        }
        const result = await auth.upgradeGuestWithEmail(email, password);
        if (result.error) setNotice(result.error);
        else if (result.confirmation) setNotice("أرسلنا رسالة تأكيد. أكّد بريدك لإكمال ربط الحساب مع بقاء تقدم الضيف.");
        else setNotice("تم ربط البريد بالحساب؛ تقدمك بقي كما هو.");
        return;
      }
      const result = mode === "signin" ? await auth.signIn(email, password) : (await auth.signUp(email, password)).error;
      if (result) setNotice(result);
      else if (mode === "signup") setNotice("تحقق من بريدك لتأكيد الحساب، ثم سجّل الدخول.");
    } finally {
      setBusy(false);
    }
  };

  const continueGuest = async () => {
    setNotice("");
    auth.clearError();
    setBusy(true);
    try {
      const error = await auth.continueAsGuest();
      if (error) setNotice(error);
    } finally { setBusy(false); }
  };

  return <AppScreen contentStyle={styles.page}>
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.keyboard}>
      <LinearGradient colors={["#143039", "#0A1017", "#080C12"]} style={styles.backdrop} />
      <View style={styles.brandRow}>
        <BrandMark size={44} />
        <View style={{ alignItems: "flex-end" }}><Txt style={styles.brandName}>VORZANE</Txt><Txt style={styles.brandTag}>حكاية تبدأ من ظلك</Txt></View>
      </View>
      <Card style={styles.card}>
        <Pill label="حساب آمن • تقدم مستقل لكل لاعب" icon="lock-closed" tone="jade" />
        <Txt style={styles.title}>{auth.user?.is_anonymous ? "اربط رحلتك بحساب" : mode === "signin" ? "عد إلى عالمك" : "أنشئ حسابًا"}</Txt>
        <Txt muted style={styles.intro}>{auth.user?.is_anonymous ? "اربط البريد الآن كي تتمكن من استعادة تقدمك على أجهزة أخرى." : "احفظ تقدمك في السحابة، واستكمل مغامرتك من المكان الذي توقفت عنده."}</Txt>

        <View style={styles.modeRow}>
          <AppButton label="تسجيل الدخول" onPress={() => { setMode("signin"); setNotice(""); }} variant={mode === "signin" ? "jade" : "secondary"} small style={{ flex: 1 }} />
          <AppButton label="حساب جديد" onPress={() => { setMode("signup"); setNotice(""); }} variant={mode === "signup" ? "jade" : "secondary"} small style={{ flex: 1 }} />
        </View>

        <InputField label="البريد الإلكتروني" value={email} onChangeText={setEmail} placeholder="name@example.com" keyboardType="email-address" icon="mail-outline" />
        <InputField label="كلمة المرور" value={password} onChangeText={setPassword} placeholder="8 أحرف على الأقل" secureTextEntry icon="key-outline" />
        <AppButton label={auth.user?.is_anonymous && mode === "signup" ? "ربط البريد بحساب الضيف" : mode === "signin" ? "متابعة بالبريد" : "إنشاء الحساب"} onPress={submit} icon="arrow-back" loading={busy} disabled={busy} />

        {notice || auth.error ? <View style={styles.notice}><Icon name="information-circle" color={palette.gold} size={18} /><Txt style={styles.noticeText}>{notice || auth.error}</Txt></View> : null}

        <AppButton label="ابدأ كضيف" onPress={continueGuest} variant="ghost" icon="person-outline" disabled={busy} />
        <Txt muted style={styles.guestHint}>حساب الضيف يحفظ تقدمك على هذا الجهاز. اربطه ببريد إلكتروني لتتمكن من استعادته على جهاز آخر.</Txt>
      </Card>
      <View style={styles.footer}><Icon name="sparkles" size={15} color={palette.gold} /><Txt muted style={styles.footerText}>صُمّم ليبقى تقدمك لك وحدك.</Txt></View>
    </KeyboardAvoidingView>
  </AppScreen>;
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, justifyContent: "center", paddingTop: 30, paddingBottom: 38 },
  keyboard: { width: "100%", maxWidth: 440, alignSelf: "center", gap: 22 },
  backdrop: { position: "absolute", top: -240, left: -70, right: -70, height: 520, borderRadius: 300, opacity: 0.82 },
  brandRow: { alignSelf: "flex-end", flexDirection: "row", alignItems: "center", gap: 11, marginBottom: 2 },
  brandName: { color: palette.gold, fontSize: 25, fontWeight: "900", fontFamily: "Cinzel_700Bold", letterSpacing: 3 },
  brandTag: { color: palette.muted, fontSize: 11, marginTop: 2 },
  card: { padding: 20, gap: 15 },
  title: { color: palette.text, fontSize: 27, fontWeight: "900", marginTop: 2 },
  intro: { fontSize: 14, lineHeight: 22, marginTop: -8 },
  modeRow: { flexDirection: "row", gap: 8, marginTop: 2 },
  notice: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 11, borderRadius: 13, backgroundColor: "rgba(230,199,124,0.09)", borderWidth: 1, borderColor: "rgba(230,199,124,0.20)" },
  noticeText: { flex: 1, fontSize: 13, lineHeight: 21 },
  guestHint: { fontSize: 11, lineHeight: 18, textAlign: "center", marginTop: -9 },
  footer: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 7 },
  footerText: { fontSize: 12 },
  loadingScreen: { alignItems: "center", justifyContent: "center", gap: 15 },
  loadingText: { color: palette.muted, fontSize: 14 },
});
