import { useEffect, useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import { BRAND_EMBLEM, CLASS_ART } from "../game/art";
import { CLASS_NAMES, type ClassId } from "../game/model";
import { palette } from "../theme";
import { Icon } from "./ui";

type ProfileAvatarId = ClassId | "brand";

type ProfileAvatarProps = {
  avatarId: ProfileAvatarId;
  size?: number;
};

export function ProfileAvatar({ avatarId, size = 40 }: ProfileAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const isBrand = avatarId === "brand";
  const source = isBrand ? BRAND_EMBLEM : CLASS_ART[avatarId as ClassId];
  const label = isBrand ? "ختم VORZANE" : CLASS_NAMES[avatarId as ClassId];

  useEffect(() => setImageFailed(false), [source]);

  return (
    <View
      accessible
      accessibilityLabel={`الصورة الشخصية: ${label}`}
      style={[styles.frame, { width: size, height: size, borderRadius: size / 2 }]}
    >
      {imageFailed ? (
        <Icon name="person-circle-outline" color={palette.jade} size={size * 0.62} />
      ) : (
        <Image
          source={{ uri: source }}
          style={isBrand ? { width: size * 0.72, height: size * 0.72 } : StyleSheet.absoluteFill}
          resizeMode={isBrand ? "contain" : "cover"}
          onError={() => setImageFailed(true)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: palette.panelRaised,
    borderWidth: 1,
    borderColor: "rgba(100,217,197,0.45)",
  },
});
