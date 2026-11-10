import { useEffect, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { AppButton, AppScreen, Card, Icon, PageTitle, Pill, SectionTitle, Txt } from "../../src/components/ui";
import { CharacterPortrait } from "../../src/components/CharacterPortrait";
import { useAuth } from "../../src/contexts/AuthContext";
import { useGame } from "../../src/contexts/GameContext";
import { getMyProfile, saveMyProfile, setMyProfileSearchable } from "../../src/lib/social";
import { palette } from "../../src/theme";

export default function ProfileScreen() {
  const { user } = useAuth();
  const { state } = useGame();
  const [displayName, setDisplayName] = useState("");
  const [isSearchable, setIsSearchable] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    if (!user?.id) return () => { active = false; };
    void getMyProfile(user.id).then((profile) => {
      if (!active || !profile) return;
      setDisplayName(profile.display_name);
      setIsSearchable(profile.is_searchable);
    }).catch((error) => {
      if (active) setNotice(error instanceof Error ? error.message : "تعذر تحميل الملف الشخصي.");
    });
    return () => { active = false; };
  }, [user?.id]);

  const save = async () => {
    setBusy(true);
    setNotice("");
    try {
      await saveMyProfile(displayName, state.profileAvatarId);
      await setMyProfileSearchable(isSearchable);
      setNotice("تم حفظ ملفك الشخصي.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "تعذر حفظ الملف الشخصي.");
    } finally {
      setBusy(false);
    }
  };

  return <AppScreen>
    <PageTitle eyebrow="هويتك في العالم" title="الملف الشخصي" subtitle="شخصيتك الثابتة واسم اللاعب وخصوصية ظهوره في البحث." trailing={<CharacterPortrait gender={state.characterStyle.gender} width={62} height={82} />} />
    <SectionTitle title="هوية اللاعب" icon="person-circle-outline" />
    <Card style={styles.panel}>
      <View style={styles.identityRow}>
        <CharacterPortrait gender={state.characterStyle.gender} width={76} height={98} />
        <View style={styles.identityCopy}>
          <Txt style={styles.identityTitle}>{displayName.trim() || "اسم اللاعب"}</Txt>
          <Txt muted style={styles.hint}>هذه هي الشخصية التي اخترتها عند إنشاء حسابك، ولا يمكن استبدالها لاحقًا.</Txt>
        </View>
      </View>
      <Txt style={styles.fieldLabel}>اسم اللاعب</Txt>
      <TextInput value={displayName} onChangeText={setDisplayName} maxLength={24} placeholder="اكتب اسمك داخل VORZANE" placeholderTextColor={palette.muted} style={styles.input} accessibilityLabel="اسم اللاعب" />
      <Txt muted style={styles.hint}>من 3 إلى 24 حرفًا.</Txt>
    </Card>

    <SectionTitle title="الخصوصية" icon="eye-outline" />
    <Card style={styles.panel}>
      <Pressable style={styles.privacyRow} accessibilityRole="switch" accessibilityLabel="السماح للاعبين بالعثور على ملفي" accessibilityState={{ checked: isSearchable }} onPress={() => setIsSearchable((value) => !value)}>
        <Pill label={isSearchable ? "ظاهر في البحث" : "مخفي من البحث"} tone={isSearchable ? "jade" : "muted"} />
        <Txt>السماح للاعبين بالعثور على ملفي</Txt>
      </Pressable>
      <Txt muted style={styles.hint}>يمكنك إخفاء ملفك عن نتائج البحث دون حذف تقدمك أو قائمة أصدقائك.</Txt>
      <AppButton label="حفظ الملف الشخصي" onPress={save} loading={busy} disabled={busy || !user || displayName.trim().length < 3} icon="save-outline" />
    </Card>
    {notice ? <Card style={styles.notice}><Icon name="information-circle-outline" color={palette.gold} size={18} /><Txt style={styles.noticeText}>{notice}</Txt></Card> : null}
  </AppScreen>;
}

const styles = StyleSheet.create({
  panel: { gap: 12, backgroundColor: "#13242C" },
  identityRow: { flexDirection: "row", alignItems: "center", gap: 13 },
  identityCopy: { flex: 1, alignItems: "flex-end", gap: 5 },
  identityTitle: { fontSize: 17, fontWeight: "900" },
  fieldLabel: { fontSize: 12, fontWeight: "900", textAlign: "right" },
  input: { minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: palette.line, paddingHorizontal: 12, color: palette.text, textAlign: "right", backgroundColor: "#0B171D" },
  hint: { fontSize: 11, lineHeight: 18, textAlign: "right" },
  privacyRow: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, paddingVertical: 5 },
  notice: { padding: 11, flexDirection: "row", alignItems: "center", gap: 8 },
  noticeText: { flex: 1, fontSize: 11 },
});
