import { Image, StyleSheet, View } from "react-native";

export type CharacterGender = "male" | "female";

const CHARACTER_ART: Record<CharacterGender, string> = {
  male: "https://raw.githubusercontent.com/luffyk124-del/vorzane/main/extracted-vorzane/VORZANE/public/images/characters/hero_male.webp",
  female: "https://raw.githubusercontent.com/luffyk124-del/vorzane/main/extracted-vorzane/VORZANE/public/images/characters/hero_female.webp",
};

type CharacterPortraitProps = {
  gender: CharacterGender;
  width?: number;
  height?: number;
  selected?: boolean;
  compact?: boolean;
};

export function CharacterPortrait({ gender, width = 112, height = 148, selected = false, compact = false }: CharacterPortraitProps) {
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={gender === "male" ? "صورة البطل" : "صورة البطلة"}
      style={[
        styles.frame,
        { width, height, borderRadius: compact ? 12 : 18 },
        selected && styles.selected,
      ]}
    >
      <Image
        source={{ uri: CHARACTER_ART[gender] }}
        resizeMode="contain"
        style={styles.image}
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111B24",
    borderWidth: 1,
    borderColor: "rgba(230,199,124,0.18)",
  },
  selected: { borderColor: "#E6C77C", borderWidth: 2 },
  image: { width: "100%", height: "100%" },
});
