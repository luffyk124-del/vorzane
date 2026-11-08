import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import { useState, type PropsWithChildren, type ReactNode } from "react";
import { usePathname, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { palette, layout, shared } from "../theme";

export type IconName = keyof typeof Ionicons.glyphMap;

export function Icon({ name, size = 20, color = palette.text }: { name: IconName; size?: number; color?: string }) {
  return <Ionicons name={name} size={size} color={color} />;
}

export function Txt({ children, style, muted = false, numberOfLines }: PropsWithChildren<{ style?: StyleProp<TextStyle>; muted?: boolean; numberOfLines?: number }>) {
  const flatStyle = StyleSheet.flatten(style);
  const weight = String(flatStyle?.fontWeight ?? "400");
  const numericWeight = Number.parseInt(weight, 10);
  const fontFamily = flatStyle?.fontFamily ? undefined : weight === "bold" || numericWeight >= 800 ? "Tajawal_800ExtraBold" : numericWeight >= 600 ? "Tajawal_700Bold" : numericWeight >= 500 ? "Tajawal_500Medium" : "Tajawal_400Regular";
  return <Text numberOfLines={numberOfLines} style={[styles.text, fontFamily ? { fontFamily } : undefined, muted && { color: palette.muted }, style]}>{children}</Text>;
}

const gameMenuItems = [
  { label: "المخيم", href: "/(tabs)/home" as const, icon: "home-outline" as const },
  { label: "الرحلات", href: "/(tabs)/expeditions" as const, icon: "compass-outline" as const },
  { label: "العتاد والسوق", href: "/(tabs)/gear" as const, icon: "shield-outline" as const },
  { label: "المهام والإنجازات", href: "/(tabs)/quests" as const, icon: "trophy-outline" as const },
  { label: "الملف الشخصي", href: "/(tabs)/profile" as const, icon: "person-circle-outline" as const },
  { label: "الأصدقاء", href: "/(tabs)/friends" as const, icon: "people-outline" as const },
  { label: "الإعدادات", href: "/(tabs)/settings" as const, icon: "settings-outline" as const },
];

export function AppScreen({ children, scroll = true, contentStyle, safe = true }: PropsWithChildren<{ scroll?: boolean; contentStyle?: StyleProp<ViewStyle>; safe?: boolean }>) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const showGameNavigation = pathname !== "/login" && pathname !== "/migration" && pathname !== "/";
  const currentTitle = gameMenuItems.find((item) => pathname.endsWith(item.href.split("/").at(-1) ?? ""))?.label ?? "عالم VORZANE";
  const body = scroll ? (
    <ScrollView contentContainerStyle={[shared.content, contentStyle]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  ) : <View style={[shared.content, { flex: 1 }, contentStyle]}>{children}</View>;
  const content = <>
    {showGameNavigation ? <View style={styles.gameHeader}>
      <Pressable accessibilityRole="button" accessibilityLabel="فتح القائمة" onPress={() => setMenuOpen(true)} style={styles.menuButton}>
        <Icon name="menu" size={23} color={palette.gold} />
        <Txt style={styles.menuButtonText}>القائمة</Txt>
      </Pressable>
      <View style={styles.headerBrand}>
        <Txt style={styles.headerWordmark}>VORZANE</Txt>
        <Txt muted style={styles.headerPage}>{currentTitle}</Txt>
      </View>
      {pathname.endsWith("/home") ? <View style={styles.headerBackPlaceholder} /> : <Pressable accessibilityRole="button" accessibilityLabel="رجوع" onPress={() => router.back()} style={styles.backButton}><Icon name="arrow-forward" size={21} color={palette.text} /></Pressable>}
    </View> : null}
    {body}
    <Modal transparent visible={menuOpen} animationType="fade" onRequestClose={() => setMenuOpen(false)}>
      <View style={styles.drawerRoot}>
        <Pressable style={styles.drawerScrim} accessibilityRole="button" accessibilityLabel="إغلاق القائمة" onPress={() => setMenuOpen(false)} />
        <View style={styles.drawerPanel}>
          <View style={styles.drawerHeading}>
            <View><Txt style={styles.drawerWordmark}>VORZANE</Txt><Txt muted style={styles.drawerSubtitle}>بوابتك إلى العالم</Txt></View>
            <Pressable accessibilityRole="button" accessibilityLabel="إغلاق" onPress={() => setMenuOpen(false)} style={styles.drawerClose}><Icon name="close" size={21} color={palette.text} /></Pressable>
          </View>
          {gameMenuItems.map((item) => {
            const active = pathname.endsWith(item.href.split("/").at(-1) ?? "");
            return <Pressable key={item.href} accessibilityRole="button" onPress={() => { setMenuOpen(false); if (!active) router.push(item.href); }} style={[styles.drawerItem, active && styles.drawerItemActive]}>
              <Icon name={item.icon} size={19} color={active ? palette.ink : palette.jade} />
              <Txt style={[styles.drawerItemText, active && styles.drawerItemTextActive]}>{item.label}</Txt>
            </Pressable>;
          })}
        </View>
      </View>
    </Modal>
  </>;
  return <View style={shared.screen}>{safe ? <SafeAreaView style={styles.safe}>{content}</SafeAreaView> : content}</View>;
}

export function Card({ children, style, padded = true }: PropsWithChildren<{ style?: StyleProp<ViewStyle>; padded?: boolean }>) {
  return <View style={[styles.card, padded && styles.cardPadded, style]}>{children}</View>;
}

export function GradientCard({ children, colors = ["#1D3842", "#121B27", "#171A28"], style }: PropsWithChildren<{ colors?: string[]; style?: StyleProp<ViewStyle> }>) {
  return <LinearGradient colors={colors as [string, string, ...string[]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.gradientCard, style]}>{children}</LinearGradient>;
}

export function PageTitle({ eyebrow, title, subtitle, trailing }: { eyebrow?: string; title: string; subtitle?: string; trailing?: ReactNode }) {
  return <View style={styles.titleRow}>
    <View style={{ flex: 1, alignItems: "flex-end" }}>
      {eyebrow ? <Txt style={styles.eyebrow}>{eyebrow}</Txt> : null}
      <Txt style={styles.pageTitle}>{title}</Txt>
      {subtitle ? <Txt muted style={styles.pageSubtitle}>{subtitle}</Txt> : null}
    </View>
    {trailing}
  </View>;
}

export function SectionTitle({ title, action, icon }: { title: string; action?: ReactNode; icon?: IconName }) {
  return <View style={styles.sectionTitle}>
    {action}
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      {icon ? <Icon name={icon} size={17} color={palette.gold} /> : null}
      <Txt style={styles.sectionText}>{title}</Txt>
    </View>
  </View>;
}

export function AppButton({ label, onPress, icon, variant = "primary", disabled = false, loading = false, style, small = false }: {
  label: string;
  onPress: () => void;
  icon?: IconName;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "jade";
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  small?: boolean;
}) {
  const background = variant === "primary" ? [palette.gold, "#D5AA58"] : variant === "jade" ? ["#64D9C4", "#379E9A"] : [palette.panelRaised, palette.panel];
  const content = <View style={styles.buttonContent}>
    {loading ? <ActivityIndicator size="small" color={variant === "primary" ? palette.ink : palette.text} /> : null}
    {icon && !loading ? <Icon name={icon} size={small ? 16 : 18} color={variant === "primary" || variant === "jade" ? palette.ink : variant === "danger" ? palette.red : palette.text} /> : null}
    <Txt style={[styles.buttonText, small && { fontSize: 13 }, (variant === "primary" || variant === "jade") && { color: palette.ink }, variant === "danger" && { color: palette.red }]}>{label}</Txt>
  </View>;
  if (variant === "primary" || variant === "jade") {
    return <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled || loading} style={({ pressed }) => [styles.button, disabled && styles.disabled, pressed && !disabled && styles.pressed, style]}>
      <LinearGradient colors={background as [string, string, ...string[]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.buttonGradient, small && styles.buttonSmall]}>{content}</LinearGradient>
    </Pressable>;
  }
  return <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled || loading} style={({ pressed }) => [styles.button, styles.buttonAlt, variant === "ghost" && styles.buttonGhost, variant === "danger" && styles.buttonDanger, small && styles.buttonSmall, disabled && styles.disabled, pressed && !disabled && styles.pressed, style]}>{content}</Pressable>;
}

export function Pill({ label, icon, tone = "gold", style }: { label: string; icon?: IconName; tone?: "gold" | "jade" | "muted" | "red"; style?: StyleProp<ViewStyle> }) {
  const tint = tone === "jade" ? palette.jade : tone === "red" ? palette.red : tone === "muted" ? palette.muted : palette.gold;
  return <View style={[styles.pill, { borderColor: `${tint}55`, backgroundColor: `${tint}12` }, style]}>
    {icon ? <Icon name={icon} size={13} color={tint} /> : null}
    <Txt style={[styles.pillText, { color: tint }]}>{label}</Txt>
  </View>;
}

export function Meter({ value, max, color = palette.jade, height = 7 }: { value: number; max: number; color?: string; height?: number }) {
  const width = Math.max(0, Math.min(100, max > 0 ? (value / max) * 100 : 0));
  return <View style={[styles.meterTrack, { height }]}><View style={[styles.meterFill, { width: `${width}%`, backgroundColor: color, height }]} /></View>;
}

export function InputField({ label, value, onChangeText, placeholder, secureTextEntry, keyboardType, autoCapitalize = "none", multiline = false, icon, style }: {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: "default" | "email-address" | "numeric";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  multiline?: boolean;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[{ gap: 7 }, style]}>
    {label ? <Txt style={styles.inputLabel}>{label}</Txt> : null}
    <View style={[styles.inputWrap, multiline && { minHeight: 94, alignItems: "flex-start" }]}>
      {icon ? <Icon name={icon} size={18} color={palette.dim} /> : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={palette.dim}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        multiline={multiline}
        textAlign="right"
        style={[styles.input, multiline && { minHeight: 72, textAlignVertical: "top" }]}
        selectionColor={palette.jade}
      />
    </View>
  </View>;
}

export function StatCard({ label, value, icon, color = palette.gold }: { label: string; value: string | number; icon: IconName; color?: string }) {
  return <View style={styles.statCard}>
    <View style={[styles.statIcon, { backgroundColor: `${color}16`, borderColor: `${color}3A` }]}><Icon name={icon} size={17} color={color} /></View>
    <Txt style={styles.statValue}>{value}</Txt>
    <Txt muted style={styles.statLabel}>{label}</Txt>
  </View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, width: "100%", alignItems: "center" },
  gameHeader: { width: "100%", maxWidth: 560, minHeight: 62, paddingHorizontal: 17, flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: palette.line, backgroundColor: "#0D141E" },
  menuButton: { minWidth: 74, minHeight: 44, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 5 },
  menuButtonText: { color: palette.gold, fontSize: 12, fontWeight: "900" },
  headerBrand: { flex: 1, alignItems: "center", gap: 1 },
  headerWordmark: { color: palette.gold, fontSize: 15, fontWeight: "900", letterSpacing: 2 },
  headerPage: { fontSize: 10 },
  headerBackPlaceholder: { width: 74, height: 44 },
  backButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  drawerRoot: { flex: 1, flexDirection: "row-reverse" },
  drawerScrim: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.68)" },
  drawerPanel: { width: "82%", maxWidth: 340, height: "100%", paddingTop: 54, paddingHorizontal: 18, paddingBottom: 24, backgroundColor: "#101A24", borderLeftWidth: 1, borderLeftColor: palette.line, gap: 8, elevation: 24 },
  drawerHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18, paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: palette.line },
  drawerWordmark: { color: palette.gold, fontSize: 20, fontWeight: "900", letterSpacing: 2 },
  drawerSubtitle: { fontSize: 11, marginTop: 3 },
  drawerClose: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: palette.panelRaised },
  drawerItem: { minHeight: 52, borderRadius: 14, paddingHorizontal: 14, flexDirection: "row-reverse", alignItems: "center", gap: 12, backgroundColor: "rgba(255,255,255,0.025)" },
  drawerItemActive: { backgroundColor: palette.gold },
  drawerItemText: { fontSize: 14, fontWeight: "800", color: palette.text },
  drawerItemTextActive: { color: palette.ink },
  text: { color: palette.text, fontSize: 15, writingDirection: "rtl", textAlign: "right" },
  card: { borderColor: palette.line, borderWidth: 1, borderRadius: layout.radius, backgroundColor: palette.panel, overflow: "hidden" },
  cardPadded: { padding: 17 },
  gradientCard: { padding: 18, borderRadius: layout.radius, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.10)" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 4 },
  eyebrow: { color: palette.jade, fontSize: 11, fontWeight: "800", letterSpacing: 1.2, marginBottom: 4 },
  pageTitle: { color: palette.text, fontSize: 27, fontWeight: "900", letterSpacing: 0.1 },
  pageSubtitle: { fontSize: 13, lineHeight: 20, marginTop: 4 },
  sectionTitle: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 3, marginBottom: 4 },
  sectionText: { fontSize: 16, fontWeight: "800", color: palette.text },
  button: { borderRadius: 16, overflow: "hidden", minHeight: 50, justifyContent: "center" },
  buttonGradient: { minHeight: 50, paddingHorizontal: 17, paddingVertical: 13, alignItems: "center", justifyContent: "center", borderRadius: 16 },
  buttonAlt: { backgroundColor: palette.panelRaised, borderWidth: 1, borderColor: palette.line, paddingHorizontal: 16, paddingVertical: 12 },
  buttonGhost: { backgroundColor: "transparent", borderColor: "transparent" },
  buttonDanger: { backgroundColor: "rgba(230,121,112,0.08)", borderColor: "rgba(230,121,112,0.28)" },
  buttonSmall: { minHeight: 40, paddingHorizontal: 13, paddingVertical: 9, borderRadius: 13 },
  buttonContent: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  buttonText: { color: palette.text, fontSize: 14, fontWeight: "800", textAlign: "center", writingDirection: "rtl" },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
  pill: { alignSelf: "flex-start", flexDirection: "row", gap: 5, alignItems: "center", paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderRadius: 30 },
  pillText: { fontSize: 11, fontWeight: "800" },
  meterTrack: { width: "100%", backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 20, overflow: "hidden" },
  meterFill: { borderRadius: 20, alignSelf: "flex-end" },
  inputLabel: { color: palette.muted, fontSize: 12, fontWeight: "800" },
  inputWrap: { minHeight: 50, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 13, borderWidth: 1, borderColor: palette.line, borderRadius: 14, backgroundColor: palette.midnight },
  input: { flex: 1, minHeight: 44, color: palette.text, fontSize: 15, writingDirection: "rtl" },
  statCard: { flex: 1, minWidth: 0, padding: 9, borderRadius: 17, backgroundColor: palette.panel, borderWidth: 1, borderColor: palette.line, alignItems: "flex-end", gap: 5 },
  statIcon: { borderWidth: 1, width: 31, height: 31, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  statValue: { fontSize: 19, fontWeight: "900", color: palette.text },
  statLabel: { fontSize: 11, fontWeight: "700" },
});
