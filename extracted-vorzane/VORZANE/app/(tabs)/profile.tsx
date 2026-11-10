import { useEffect, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { AppButton, AppScreen, Card, Icon, PageTitle, Pill, SectionTitle, Txt } from "../../src/components/ui";
import { ProfileAvatar } from "../../src/components/ProfileAvatar";
import { useAuth } from "../../src/contexts/AuthContext";
import { useGame } from "../../src/contexts/GameContext";
import { CLASS_NAMES, type ClassId } from "../../src/game/model";
import { getMyProfile, saveMyProfile, setMyProfileSearchable } from "../../src/lib/social";
import { palette } from "../../src/theme";

const AVATARS = [
  { id: "brand", label: "شعار VORZANE" },
  { id: "Warrior", label: CLASS_NAMES.Warrior },
  { id: "Mage", label: CLASS_NAMES.Mage },
  { id: "Assassin", label: CLASS_NAMES.Assassin },
  { id: "Archer", label: CLASS_NAMES.Archer },
] as const;

function isAvatarId(value: string): value is ClassId | "brand" {
  return value === "brand" || value === "Warrior" || value === "Mage" || value === "Assassin" || value === "Archer";
}

export default function ProfileScreen() {
  const { user } = useAuth();
  const { state, update } = useGame();
  const [displayName, setDisplayName] = useState("");
  const [avatarId, setAvatarId] = useState<ClassId | "brand">(state.profileAvatarId);
  const [isSearchable, setIsSearchable] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    if (!user?.id) return () => { active = false; };
    void getMyProfile(user.id).then((profile) => {
      if (!active || !profile) return;
      setDisplayName(profile.display_name);
      if (isAvatarId(profile.avatar_id)) setAvatarId(profile.avatar_id);
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
      await saveMyProfile(displayName, avatarId);
      await setMyProfileSearchable(isSearchable);
      update((current) => ({ ...current, profileAvatarId: avatarId }));
      setNotice("تم حفظ ملفك الشخصي.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "تعذر حفظ الملف الشخصي.");
    } finally {
      setBusy(false);
    }
  };

  return <AppScreen>
    <PageTitle eyebrow="هويتك في العالم" title="الملف الشخصي" subtitle="اسم اللاعب، رمزه، وخصوصية ظهوره في البحث." trailing={<ProfileAvatar avatarId={avatarId} size={58} />} />
    <SectionTitle title="هوية اللاعب" icon="person-circle-outline" />
    <Card style={styles.panel}>
      <View style={styles.identityRow}>
        <ProfileAvatar avatarId={avatarId} size={68} />
        <View style={styles.identityCopy}>
          <Txt style={styles.identityTitle}>{displayName.trim() || "اسم اللاعب"}</Txt>
          <Txt muted style={styles.hint}>هذا الملف يخص حسابك الاجتماعي، وليس شكل شخصيتك داخل اللعبة.</Txt>
        </View>
      </View>
      <Txt style={styles.fieldLabel}>اسم اللاعب</Txt>
      <TextInput value={displayName} onChangeText={setDisplayName} maxLength={24} placeholder="اكتب اسمك داخل VORZANE" placeholderTextColor={palette.muted} style={styles.input} accessibilityLabel="اسم اللاعب" />
      <Txt muted style={styles.hint}>من 3 إلى 24 حرفًا.</Txt>
    </Card>

    <SectionTitle title="رمز الملف الشخصي" icon="shapes-outline" />
    <Card style={styles.panel}>
      <Txt muted style={styles.hint}>اختر رمزًا ثابتًا من الأيقونات؛ لا توجد صور أو شخصيات قابلة للتخصيص هنا.</Txt>
      <View style={styles.avatarGrid}>
        {AVATARS.map((avatar) => {
          const selected = avatarId === avatar.id;
          return <Pressable key={avatar.id} onPress={() => setAvatarId(avatar.id)} accessibilityRole="radio" accessibilityLabel={`رمز الملف الشخصي: ${avatar.label}`} accessibilityState={{ checked: selected }} aria-checked={selected} style={[styles.avatarOption, selected && styles.avatarSelected]}>
            <ProfileAvatar avatarId={avatar.id} size={42} />
            <Txt style={[styles.avatarLabel, selected && styles.avatarLabelSelected]}>{avatar.label}</Txt>
            {selected ? <Icon name="checkmark-circle" size={16} color={palette.jade} /> : <View style={styles.checkPlaceholder} />}
          </Pressable>;
        })}
      </View>
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
  avatarGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" },
  avatarOption: { width: "30%", minWidth: 88, minHeight: 92, alignItems: "center", justifyContent: "center", gap: 7, padding: 9, borderRadius: 14, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.midnight },
  avatarSelected: { borderColor: palette.jade, backgroundColor: "rgba(100,217,197,0.09)" },
  avatarLabel: { color: palette.muted, fontSize: 10, fontWeight: "800", textAlign: "center" },
  avatarLabelSelected: { color: palette.text },
  checkPlaceholder: { height: 16 },
  privacyRow: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, paddingVertical: 5 },
  notice: { padding: 11, flexDirection: "row", alignItems: "center", gap: 8 },
  noticeText: { flex: 1, fontSize: 11 },
});
