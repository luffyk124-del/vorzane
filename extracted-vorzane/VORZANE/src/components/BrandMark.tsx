import { Image, StyleSheet, View } from "react-native";
import { BRAND_EMBLEM } from "../game/art";

export function BrandMark({ size = 34 }: { size?: number }) {
  return (
    <View style={[styles.frame, { width: size, height: size, borderRadius: size * 0.34 }]}>
      <Image
        source={{ uri: BRAND_EMBLEM }}
        style={{ width: size * 0.82, height: size * 0.82 }}
        resizeMode="contain"
        accessibilityLabel="ختم VORZANE"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: "#101820",
    borderWidth: 1,
    borderColor: "rgba(230,199,124,0.40)",
  },
});
