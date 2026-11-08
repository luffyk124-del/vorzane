import { useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { CharacterStyle, ClassId } from "../game/model";
import { CLASS_NAMES } from "../game/model";
import { CLASS_ART } from "../game/art";

const FALLBACK = "#18232D";

const STYLE_LABELS = {
  appearance: ["فاتح", "قمحي", "برونزي", "داكن"],
  hairstyle: { short: "قصير", long: "طويل", braids: "ضفائر", fringe: "غُرّة" },
  face: { classic: "كلاسيكي", noble: "نبيل", weathered: "مخضرم" },
  outfit: { adventurer: "مغامر", royal: "ملكي", shadow: "ظلال" },
  body: { balanced: "متوازن", sturdy: "قوي البنية", agile: "رشيق" },
} as const;

export function CharacterModelViewer({
  gender = "male",
  appearance = 0,
  hairstyle = "short",
  face = "classic",
  outfit = "adventurer",
  body = "balanced",
  className = "Warrior",
}: Partial<CharacterStyle> & { className?: ClassId }) {
  const [failed, setFailed] = useState(false);
  const selectedClass: ClassId = ["Warrior", "Mage", "Assassin", "Archer"].includes(className) ? className : "Warrior";
  const label = CLASS_NAMES[selectedClass];

  return (
    <View
      testID="fantasy-character-preview"
      accessible
      accessibilityLabel={`معاينة شخصية ${label} الفنتازية، ${STYLE_LABELS.appearance[appearance]}، شعر ${STYLE_LABELS.hairstyle[hairstyle]}، زي ${STYLE_LABELS.outfit[outfit]}`}
      style={styles.frame}
    >
      {!failed ? (
        <Image
          source={{ uri: CLASS_ART[selectedClass] }}
          accessibilityLabel={`رسم فنتازي لفئة ${label}`}
          resizeMode="cover"
          onError={() => setFailed(true)}
          style={styles.art}
        />
      ) : (
        <View style={styles.fallback}>
          <Text style={styles.fallbackGlyph}>{selectedClass === "Mage" ? "✦" : selectedClass === "Assassin" ? "⚔" : selectedClass === "Archer" ? "➶" : "♜"}</Text>
          <Text style={styles.fallbackTitle}>{label}</Text>
          <Text style={styles.fallbackSub}>بطل VORZANE</Text>
        </View>
      )}
      <LinearGradient
        colors={["rgba(5,10,17,0.04)", "rgba(5,10,17,0.02)", "rgba(5,10,17,0.88)"]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View pointerEvents="none" style={styles.topOrnament}>
        <View style={styles.rune} />
        <Text style={styles.worldLabel}>VORZANE • DARK FANTASY</Text>
        <View style={styles.rune} />
      </View>
      <View pointerEvents="none" style={styles.bottom}>
        <View style={styles.divider} />
        <Text style={styles.className}>{label}</Text>
        <Text style={styles.subtitle}>{gender === "female" ? "بطلة" : "بطل"} • {STYLE_LABELS.hairstyle[hairstyle]} • {STYLE_LABELS.outfit[outfit]}</Text>
        <Text style={styles.styleMeta}>{STYLE_LABELS.face[face]} · {STYLE_LABELS.body[body]} · بشرة {STYLE_LABELS.appearance[appearance]}</Text>
      </View>
      <View pointerEvents="none" style={styles.cornerTopLeft} />
      <View pointerEvents="none" style={styles.cornerTopRight} />
      <View pointerEvents="none" style={styles.cornerBottomLeft} />
      <View pointerEvents="none" style={styles.cornerBottomRight} />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: "100%",
    height: 430,
    minHeight: 390,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: FALLBACK,
    borderWidth: 1,
    borderColor: "rgba(222,185,111,0.68)",
    position: "relative",
    shadowColor: "#000",
    shadowOpacity: 0.38,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 9 },
  },
  art: { ...StyleSheet.absoluteFill, width: "100%", height: "100%" },
  fallback: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: FALLBACK, gap: 8 },
  fallbackGlyph: { color: "#E6C77C", fontSize: 78, lineHeight: 90 },
  fallbackTitle: { color: "#F5E6C5", fontSize: 24, fontWeight: "900" },
  fallbackSub: { color: "#B6A47D", fontSize: 11, letterSpacing: 3 },
  topOrnament: {
    position: "absolute",
    top: 15,
    left: 18,
    right: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  worldLabel: { color: "#E7D6AD", fontSize: 9, fontWeight: "900", letterSpacing: 2.4, textShadowColor: "#000", textShadowRadius: 7 },
  rune: { width: 24, height: 1, backgroundColor: "rgba(231,214,173,0.75)" },
  bottom: { position: "absolute", left: 16, right: 16, bottom: 22, alignItems: "center", gap: 5 },
  divider: { width: 88, height: 2, backgroundColor: "#D6B56F", marginBottom: 7 },
  className: { color: "#FFF1D2", fontSize: 27, fontWeight: "900", textShadowColor: "#000", textShadowRadius: 8 },
  subtitle: { color: "#D8C9A8", fontSize: 11, fontWeight: "700", textShadowColor: "#000", textShadowRadius: 7 },
  styleMeta: { color: "#E6C77C", fontSize: 9, fontWeight: "800", textShadowColor: "#000", textShadowRadius: 7 },
  cornerTopLeft: { position: "absolute", top: 7, left: 7, width: 25, height: 25, borderTopWidth: 2, borderLeftWidth: 2, borderColor: "#D8B66D" },
  cornerTopRight: { position: "absolute", top: 7, right: 7, width: 25, height: 25, borderTopWidth: 2, borderRightWidth: 2, borderColor: "#D8B66D" },
  cornerBottomLeft: { position: "absolute", bottom: 7, left: 7, width: 25, height: 25, borderBottomWidth: 2, borderLeftWidth: 2, borderColor: "#D8B66D" },
  cornerBottomRight: { position: "absolute", bottom: 7, right: 7, width: 25, height: 25, borderBottomWidth: 2, borderRightWidth: 2, borderColor: "#D8B66D" },
});
