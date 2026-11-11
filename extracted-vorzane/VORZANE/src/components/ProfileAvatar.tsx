import { Image, StyleSheet, View } from "react-native";
import { CLASS_ICON } from "../game/catalog";
import { CLASS_NAMES, type ProfileAvatarId } from "../game/model";
import { palette } from "../theme";
import { Icon } from "./ui";

type ProfileAvatarProps = { avatarId: ProfileAvatarId; size?: number };

const GOLEM_AVATAR = require("../../public/images/characters/One_standalone_premium_2D_fantasy_RPG_profile_avatar_portrai (3).jpg");

export function ProfileAvatar({ avatarId, size = 40 }: ProfileAvatarProps) {
  const isGolem = avatarId === "golem";
  const isBrand = avatarId === "brand";
  const label = isGolem ? "حارس الصخور" : isBrand ? "ختم VORZANE" : CLASS_NAMES[avatarId as keyof typeof CLASS_NAMES];
  const iconName = isBrand ? "sparkles" : isGolem ? null : CLASS_ICON[avatarId as keyof typeof CLASS_ICON];

  return (
    <View accessible accessibilityLabel={`رمز الملف الشخصي: ${label}`} style={[styles.frame, { width: size, height: size, borderRadius: size / 2 }]}>
      {isGolem ? <Image source={GOLEM_AVATAR} resizeMode="cover" style={StyleSheet.absoluteFillObject} accessibilityLabel={label} /> : <Icon name={iconName as never} color={isBrand ? palette.gold : palette.jade} size={size * 0.54} />}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { alignItems: "center", justifyContent: "center", overflow: "hidden", backgroundColor: palette.panelRaised, borderWidth: 1, borderColor: "rgba(100,217,197,0.45)" },
});
