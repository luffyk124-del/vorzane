import { useEffect, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { AppButton, AppScreen, Card, Icon, PageTitle, Pill, SectionTitle, Txt } from "../../src/components/ui";
import { ProfileAvatar } from "../../src/components/ProfileAvatar";
import { Character2DViewer } from "../../src/components/Character2DViewer";
import { useAuth } from "../../src/contexts/AuthContext";
import { useGame } from "../../src/contexts/GameContext";
import { CLASS_NAMES, type CharacterHairColor, type CharacterStyle, type ClassId } from "../../src/game/model";
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

type StyleOption = { id: string; label: string; color?: string };
function StyleChoiceGroup({ title, value, options, onChange, helperText }: { title: string; value: string; options: StyleOption[]; onChange: (value: string) => void; helperText?: string }) {
  return <View style={styles.styleGroup}>
    <Txt style={styles.styleGroupTitle}>{title}</Txt>
    {helperText ? <Txt muted style={styles.styleGroupHint}>{helperText}</Txt> : null}
    <View style={styles.avatarGrid}>
      {options.map((option) => {
        const selected = value === option.id;
        return <Pressable key={option.id} accessibilityRole="radio" accessibilityLabel={`${title}: ${option.label}`} accessibilityState={{ checked: selected }} aria-checked={selected} onPress={() => onChange(option.id)} style={[styles.styleOption, selected && styles.avatarSelected]}>
          <>{option.color ? <View style={[styles.appearanceSwatch, { backgroundColor: option.color }]} /> : null}<Txt style={[styles.avatarLabel, selected && styles.avatarLabelSelected]}>{option.label}</Txt></>
          {selected ? <Icon name="checkmark-circle" size={15} color={palette.jade} /> : <View style={styles.checkPlaceholder} />}
        </Pressable>;
      })}
    </View>
  </View>;
}

export default function ProfileScreen() {
  const { user } = useAuth();
  const { state, update } = useGame();
  const hairstyleOptions = (state.characterStyle.gender === "female"
    ? ["short", "long", "braids"]
    : ["short", "long", "fringe"]).map((id) => ({
    id,
    label: id === "short" ? "قصير" : id === "long" ? "طويل" : id === "fringe" ? "غُرّة" : "ضفائر",
  }));
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
      <Txt muted style={styles.hint}>صمّم مظهرك بأسلوب فانتازي ثنائي الأبعاد. كل اختيار ينعكس مباشرة على الرسم: لون البشرة والشعر، التسريحة، الملامح، الملابس وبنية الجسم.</Txt>
      <View style={styles.avatarGrid}>
        {([{ id: "male", label: "ذكر" }, { id: "female", label: "أنثى" }] as const).map((option) => {
          const selected = state.characterStyle.gender === option.id;
          return <Pressable key={option.id} accessibilityRole="radio" accessibilityLabel={`تفضيل الشخصية: ${option.label}`} accessibilityState={{ checked: selected }} aria-checked={selected} onPress={() => update((current) => ({ ...current, characterStyle: { ...current.characterStyle, gender: option.id, hairstyle: option.id === "female" ? (current.characterStyle.hairstyle === "fringe" ? "braids" : current.characterStyle.hairstyle) : (current.characterStyle.hairstyle === "braids" ? "short" : current.characterStyle.hairstyle) } }))} style={[styles.avatarOption, selected && styles.avatarSelected]}>
            <Icon name={option.id === "male" ? "male" : "female"} size={21} color={selected ? palette.gold : palette.jade} />
            <Txt style={[styles.avatarLabel, selected && styles.avatarLabelSelected]}>{option.label}</Txt>
          </Pressable>;
        })}
      </View>
      <Character2DViewer
        gender={state.characterStyle.gender}
        appearance={state.characterStyle.appearance}
        outfit={state.characterStyle.outfit}
        hairstyle={state.characterStyle.hairstyle}
        hairColor={state.characterStyle.hairColor}
        face={state.characterStyle.face}
        body={state.characterStyle.body}
      />
      <View style={styles.avatarGrid}>
        {["#F2C7A5", "#D59A70", "#A66D4C", "#684331"].map((color, index) => {
          const selected = state.characterStyle.appearance === index;
          return <Pressable key={color} accessibilityRole="radio" accessibilityLabel={`درجة اللون ${index + 1}`} accessibilityState={{ checked: selected }} aria-checked={selected} onPress={() => update((current) => ({ ...current, characterStyle: { ...current.characterStyle, appearance: index as 0 | 1 | 2 | 3 } }))} style={[styles.appearanceChoice, selected && styles.avatarSelected]}>
            <View style={[styles.appearanceSwatch, { backgroundColor: color }]} />
            <Txt style={[styles.avatarLabel, selected && styles.avatarLabelSelected]}>درجة اللون {index + 1}</Txt>
          </Pressable>;
        })}
      </View>
      <StyleChoiceGroup title="تسريحة الشعر" value={state.characterStyle.hairstyle} options={hairstyleOptions} onChange={(value) => update((current) => ({ ...current, characterStyle: { ...current.characterStyle, hairstyle: value as CharacterStyle["hairstyle"] } }))} />
      <StyleChoiceGroup title="لون الشعر" value={state.characterStyle.hairColor ?? "obsidian"} options={[
        { id: "obsidian", label: "أسود فحمي", color: "#171B24" },
        { id: "silver", label: "فضي", color: "#AEB8C8" },
        { id: "crimson", label: "قرمزي", color: "#782B35" },
        { id: "gold", label: "ذهبي", color: "#B8893F" },
        { id: "violet", label: "بنفسجي", color: "#503A78" },
        { id: "chestnut", label: "كستنائي", color: "#70432F" },
      ]} onChange={(value) => update((current) => ({ ...current, characterStyle: { ...current.characterStyle, hairColor: value as CharacterHairColor } }))} />
      <StyleChoiceGroup title="ملامح الوجه" value={state.characterStyle.face} options={[{ id: "classic", label: "كلاسيكي" }, { id: "noble", label: "نبيل" }, { id: "weathered", label: "مغامر" }]} onChange={(value) => update((current) => ({ ...current, characterStyle: { ...current.characterStyle, face: value as CharacterStyle["face"] } }))} />
      <StyleChoiceGroup title="الملابس" value={state.characterStyle.outfit} options={[{ id: "adventurer", label: "مغامر" }, { id: "royal", label: "ملكي" }, { id: "shadow", label: "داكن" }]} onChange={(value) => update((current) => ({ ...current, characterStyle: { ...current.characterStyle, outfit: value as CharacterStyle["outfit"] } }))} />
      <StyleChoiceGroup title="بنية الجسم" value={state.characterStyle.body} options={[{ id: "balanced", label: "متوازن" }, { id: "sturdy", label: "متين" }, { id: "agile", label: "رشيق" }]} onChange={(value) => update((current) => ({ ...current, characterStyle: { ...current.characterStyle, body: value as CharacterStyle["body"] } }))} />
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
          return <Pressable key={avatar.id} onPress={() => setAvatarId(avatar.id)} accessibilityRole="radio" accessibilityState={{ checked: selected }} aria-checked={selected} style={[styles.avatarOption, selected && styles.avatarSelected]}>
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
  styleGroup: { gap: 7, paddingTop: 7 },
  styleGroupTitle: { fontSize: 11, fontWeight: "900", textAlign: "right" },
  styleGroupHint: { fontSize: 9, textAlign: "right" },
  styleOption: { minWidth: 74, flexGrow: 1, flexBasis: "28%", minHeight: 48, alignItems: "center", justifyContent: "center", gap: 3, padding: 7, borderRadius: 12, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.midnight },
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
