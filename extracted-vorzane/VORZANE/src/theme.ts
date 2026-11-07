import { Platform, StyleSheet } from "react-native";

export const palette = {
  ink: "#080C12",
  midnight: "#0D131D",
  panel: "#121B27",
  panelRaised: "#182534",
  panelSoft: "#1E3040",
  line: "rgba(214, 232, 232, 0.10)",
  text: "#F4F1E8",
  muted: "#9AA9B4",
  dim: "#697C88",
  gold: "#E6C77C",
  goldDeep: "#9D783B",
  jade: "#62D8C3",
  jadeDark: "#235F5D",
  red: "#E67970",
  blue: "#80B7D4",
  violet: "#A99AE8",
  white: "#FFFFFF",
  black: "#000000",
};

export const rarityColor = {
  common: "#AAB7BE",
  uncommon: "#62D8C3",
  rare: "#73BCE2",
  epic: "#BB9AF2",
  legendary: palette.gold,
  mythic: "#F08A78",
} as const;

export const layout = {
  maxWidth: 520,
  screenPadding: 20,
  radius: 24,
  smallRadius: 16,
};

export const shared = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.ink },
  content: { width: "100%", maxWidth: layout.maxWidth, alignSelf: "center", paddingHorizontal: layout.screenPadding, paddingTop: 18, paddingBottom: 118, gap: 18 },
  card: { borderWidth: 1, borderColor: palette.line, borderRadius: layout.radius, backgroundColor: palette.panel, padding: 18 },
  title: { color: palette.text, fontSize: 25, fontWeight: "800", letterSpacing: 0.2 },
  subtitle: { color: palette.muted, fontSize: 14, lineHeight: 22 },
  label: { color: palette.muted, fontSize: 12, fontWeight: "700" },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rtlText: { writingDirection: "rtl", textAlign: "right" },
  webShadow: Platform.select({ web: { boxShadow: "0 18px 50px rgba(0,0,0,0.24)" } as never, default: { elevation: 8 } }),
});
