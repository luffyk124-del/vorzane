import { useEffect, useState } from "react";
import { Linking, Pressable, StyleSheet, TextInput, View } from "react-native";
import { AppButton, AppScreen, Card, Icon, PageTitle, Pill, SectionTitle, Txt } from "../../src/components/ui";
import { ProfileAvatar } from "../../src/components/ProfileAvatar";
import { useAuth } from "../../src/contexts/AuthContext";
import { useGame } from "../../src/contexts/GameContext";
import { CLASS_NAMES, type ClassId } from "../../src/game/model";
import { getMyProfile, saveMyProfile, setMyProfileSearchable } from "../../src/lib/social";
import { palette } from "../../src/theme";

const AVATARS = [
  { id: "brand", label: "شعار VORZANE", icon: "sparkles" },
  { id: "Warrior", label: CLASS_NAMES.Warrior, icon: "shield-half" },
  { id: "Mage", label: CLASS_NAMES.Mage, icon: "sparkles" },
  { id: "Assassin", label: CLASS_NAMES.Assassin, icon: "eye-off" },
  { id: "Archer", label: CLASS_NAMES.Archer, icon: "navigate" },
] as const;

function isAvatarId(value: string): value is ClassId | "brand" {
  return value === "brand" || value === "Warrior" || value === "Mage" || value === "Assassin" || value === "Archer";
}

export default function ProfileScreen() {
  const { user } = useAuth();
  const { state, update } = useGame();
  const [displayName, setDisplayName] = useState("");
  const [avatarId, setAvatarId] = useState<ClassId | "brand">("brand");
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
      setNotice("تم حفظ ملفك الشخصي.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "تعذر حفظ الملف الشخصي.");
    } finally {
      setBusy(false);
    }
  };

  return <AppScreen>
    <PageTitle eyebrow="هويتك في العالم" title="الملف الشخصي" subtitle="اسمك وصورتك وظهورك في بحث اللاعبين." trailing={<ProfileAvatar avatarId={avatarId} size={58} />} />
    <Card style={styles.heroCard}>
      <View style={styles.heroIdentity}>
        <View style={{ flex: 1, alignItems: "flex-end", gap: 4 }}>
          <Txt style={styles.heroName}>{state.hero?.name ?? "لم تنشئ شخصيتك بعد"}</Txt>
          <Txt muted style={styles.heroMeta}>{state.hero ? CLASS_NAMES[state.hero.className] : "اختر شخصيتك من المخيم"}{state.hero ? ` • المستوى ${state.hero.level}` : ""}</Txt>
        </View>
        <Pill label={state.hero ? "شخصيتك" : "مغامر جديد"} tone={state.hero ? "jade" : "gold"} />
      </View>
      <View style={styles.heroStats}>
        <View><Txt style={styles.statValue}>{state.gold.toLocaleString("ar-EG")}</Txt><Txt muted style={styles.statLabel}>ذهب</Txt></View>
        <View><Txt style={styles.statValue}>{state.wins.toLocaleString("ar-EG")}</Txt><Txt muted style={styles.statLabel}>انتصارات</Txt></View>
        <View><Txt style={styles.statValue}>{state.expeditionsCompleted.toLocaleString("ar-EG")}</Txt><Txt muted style={styles.statLabel}>رحلات</Txt></View>
      </View>
    </Card>

    <SectionTitle title="مظهر الشخصية" icon="color-palette-outline" />
    <Card style={styles.panel}>
      <Txt muted style={styles.hint}>يمكنك تغيير المظهر في أي وقت دون التأثير على مستواك أو تقدمك. تُحفظ اختياراتك تلقائياً مع تقدم اللاعب.</Txt>
      <View style={styles.avatarGrid}>
        {([{ id: "male", label: "ذكر" }, { id: "female", label: "أنثى" }] as const).map((option) => {
          const selected = state.characterStyle.gender === option.id;
          return <Pressable key={option.id} onPress={() => update((current) => ({ ...current, characterStyle: { ...current.characterStyle, gender: option.id } }))} style={[styles.avatarOption, selected && styles.avatarSelected]}>
            <Icon name={option.id === "male" ? "male" : "female"} size={21} color={selected ? palette.gold : palette.jade} />
            <Txt style={[styles.avatarLabel, selected && styles.avatarLabelSelected]}>{option.label}</Txt>
          </Pressable>;
        })}
      </View>
      <Pressable accessibilityRole="link" onPress={() => { void Linking.openURL("https://higgsfield.ai/3d-jutsu/33b883b0-edbe-4adf-9ae9-ee5d9960c402"); }} style={styles.modelPreviewLink}>
        <Icon name="cube-outline" color={palette.gold} size={20} />
        <View style={{ flex: 1, alignItems: "flex-end", gap: 3 }}>
          <Txt style={styles.modelPreviewTitle}>معاينة المجسم ثلاثي الأبعاد</Txt>
          <Txt muted style={styles.modelPreviewHint}>افتح النموذجين الأوليين في عارض منفصل؛ لم يُدمجا داخل اللعبة بعد.</Txt>
        </View>
        <Icon name="open-outline" color={palette.muted} size={17} />
      </Pressable>
      <View style={styles.avatarGrid}>
        {["#62D8C3", "#E6C77C", "#A99AE8", "#E67970"].map((color, index) => {
          const selected = state.characterStyle.appearance === index;
          return <Pressable key={color} onPress={() => update((current) => ({ ...current, characterStyle: { ...current.characterStyle, appearance: index as 0 | 1 | 2 | 3 } }))} style={[styles.appearanceChoice, selected && styles.avatarSelected]}>
            <View style={[styles.appearanceSwatch, { backgroundColor: color }]} />
            <Txt style={[styles.avatarLabel, selected && styles.avatarLabelSelected]}>مظهر {index + 1}</Txt>
          </Pressable>;
        })}
      </View>
    </Card>

    <SectionTitle title="اسم اللاعب" icon="person-outline" />
    <Card style={styles.panel}>
      <TextInput value={displayName} onChangeText={setDisplayName} maxLength={24} placeholder="اكتب اسمك داخل VORZANE" placeholderTextColor={palette.muted} style={styles.input} />
      <Txt muted style={styles.hint}>من 3 إلى 24 حرفًا.</Txt>
    </Card>

    <SectionTitle title="الصورة الرمزية" icon="person-circle-outline" />
    <Card style={styles.panel}>
      <View style={styles.avatarGrid}>
        {AVATARS.map((avatar) => {
          const selected = avatarId === avatar.id;
          return <Pressable key={avatar.id} onPress={() => setAvatarId(avatar.id)} accessibilityRole="radio" accessibilityState={{ checked: selected }} style={[styles.avatarOption, selected && styles.avatarSelected]}>
            <ProfileAvatar avatarId={avatar.id} size={52} />
            <Txt style={[styles.avatarLabel, selected && styles.avatarLabelSelected]}>{avatar.label}</Txt>
            {selected ? <Icon name="checkmark-circle" size={17} color={palette.jade} /> : <View style={styles.checkPlaceholder} />}
          </Pressable>;
        })}
      </View>
      <Pressable style={styles.privacyRow} accessibilityRole="button" accessibilityLabel="تغيير ظهور الملف في البحث" onPress={() => setIsSearchable((value) => !value)}>
        <Pill label={isSearchable ? "ظاهر في البحث" : "مخفي من البحث"} tone={isSearchable ? "jade" : "muted"} />
        <Txt>السماح للاعبين بالعثور على ملفي</Txt>
      </Pressable>
      <AppButton label="حفظ الملف الشخصي" onPress={save} loading={busy} disabled={busy || !user || displayName.trim().length < 3} icon="save-outline" />
    </Card>
    {notice ? <Card style={styles.notice}><Icon name="information-circle-outline" color={palette.gold} size={18} /><Txt style={styles.noticeText}>{notice}</Txt></Card> : null}
  </AppScreen>;
}

const styles = StyleSheet.create({
  heroCard: { gap: 15, backgroundColor: "#13242C" },
  heroIdentity: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  heroName: { fontSize: 19, fontWeight: "900" },
  heroMeta: { fontSize: 11 },
  heroStats: { flexDirection: "row", justifyContent: "space-around", paddingTop: 12, borderTopWidth: 1, borderTopColor: palette.line },
  statValue: { color: palette.gold, fontSize: 17, fontWeight: "900", textAlign: "center" },
  statLabel: { fontSize: 10, textAlign: "center", marginTop: 3 },
  panel: { gap: 11, backgroundColor: "#13242C" },
  input: { minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: palette.line, paddingHorizontal: 12, color: palette.text, textAlign: "right", backgroundColor: "#0B171D" },
  hint: { fontSize: 10 },
  avatarGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" },
  modelPreviewLink: { minHeight: 62, flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: "rgba(230,199,124,0.35)", backgroundColor: "rgba(230,199,124,0.06)" },
  modelPreviewTitle: { fontSize: 12, fontWeight: "900" },
  modelPreviewHint: { fontSize: 9, textAlign: "right" },
  appearanceChoice: { flex: 1, minWidth: 65, minHeight: 68, alignItems: "center", justifyContent: "center", gap: 6, padding: 8, borderRadius: 14, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.midnight },
  appearanceSwatch: { width: 22, height: 22, borderRadius: 11 },
  avatarOption: { width: "30%", minWidth: 88, alignItems: "center", justifyContent: "center", gap: 7, padding: 10, borderRadius: 14, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.midnight },
  avatarSelected: { borderColor: palette.jade, backgroundColor: "rgba(100,217,197,0.09)" },
  avatarLabel: { color: palette.muted, fontSize: 10, fontWeight: "800", textAlign: "center" },
  avatarLabelSelected: { color: palette.text },
  checkPlaceholder: { height: 17 },
  privacyRow: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, paddingVertical: 5 },
  notice: { padding: 11, flexDirection: "row", alignItems: "center", gap: 8 },
  noticeText: { flex: 1, fontSize: 11 },
});
