import { StyleSheet, View } from "react-native";
import { CLASS_ICON } from "../game/catalog";
import { CLASS_NAMES, type ClassId } from "../game/model";
import { palette } from "../theme";
import { Icon } from "./ui";

type ProfileAvatarId = ClassId | "brand";
type ProfileAvatarProps = { avatarId: ProfileAvatarId; size?: number };

export function ProfileAvatar({ avatarId, size = 40 }: ProfileAvatarProps) {
  const isBrand = avatarId === "brand";
  const label = isBrand ? "ختم VORZANE" : CLASS_NAMES[avatarId];
  const iconName = isBrand ? "sparkles" : CLASS_ICON[avatarId];

  return (
    <View accessible accessibilityLabel={`رمز الملف الشخصي: ${label}`} style={[styles.frame, { width: size, height: size, borderRadius: size / 2 }]}>
      <Icon name={iconName as never} color={isBrand ? palette.gold : palette.jade} size={size * 0.54} />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { alignItems: "center", justifyContent: "center", overflow: "hidden", backgroundColor: palette.panelRaised, borderWidth: 1, borderColor: "rgba(100,217,197,0.45)" },
});
