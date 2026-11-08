import { StyleSheet, View } from "react-native";
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import type { CharacterStyle } from "../game/model";

type HairColor = "obsidian" | "silver" | "crimson" | "gold" | "violet" | "chestnut";
type Props = Pick<CharacterStyle, "gender" | "appearance" | "hairstyle" | "face" | "outfit" | "body"> & {
  hairColor?: HairColor;
};

const SKIN = ["#F2C7A5", "#D59A70", "#A66D4C", "#684331"];
const HAIR: Record<HairColor, { base: string; light: string; shade: string }> = {
  obsidian: { base: "#171B24", light: "#59616C", shade: "#090D14" },
  silver: { base: "#AEB8C8", light: "#F0E8D8", shade: "#657184" },
  crimson: { base: "#782B35", light: "#D56B62", shade: "#351923" },
  gold: { base: "#B8893F", light: "#F1D18A", shade: "#65421F" },
  violet: { base: "#503A78", light: "#A98AD6", shade: "#241B3E" },
  chestnut: { base: "#70432F", light: "#B77A4B", shade: "#352018" },
};

const OUTFITS = {
  adventurer: { cloth: "#263F49", leather: "#653A32", metal: "#71838A", gold: "#C7A45F", cape: "#172C35" },
  royal: { cloth: "#48283F", leather: "#702D43", metal: "#9B8155", gold: "#F0D18A", cape: "#321B35" },
  shadow: { cloth: "#202733", leather: "#332B39", metal: "#65707E", gold: "#8994A6", cape: "#111721" },
};

export function Character2DViewer({
  gender,
  appearance,
  hairstyle,
  hairColor = "obsidian",
  face,
  outfit,
  body,
}: Props) {
  const skin = SKIN[appearance] ?? SKIN[0];
  const hair = HAIR[hairColor] ?? HAIR.obsidian;
  const clothes = OUTFITS[outfit] ?? OUTFITS.adventurer;
  const female = gender === "female";
  const sturdy = body === "sturdy";
  const agile = body === "agile";
  const shoulder = sturdy ? 46 : agile ? 34 : 40;
  const jaw = female ? "M111 143 Q110 91 180 88 Q250 91 249 143 L238 207 Q220 239 180 242 Q140 239 122 207 Z" : "M105 139 Q105 82 180 82 Q255 82 255 139 L244 205 Q220 246 180 249 Q140 246 116 205 Z";
  const hairBack = hairstyle === "long"
    ? "M105 95 Q91 145 103 229 L117 292 L145 272 L151 190 L209 190 L215 272 L243 292 L257 229 Q269 145 255 95 Z"
    : hairstyle === "braids"
      ? "M103 104 Q92 163 112 215 L128 281 L145 268 L139 178 L221 178 L215 268 L232 281 L248 215 Q268 163 257 104 Z"
      : "M105 105 Q96 62 180 58 Q264 62 255 105 L247 166 L113 166 Z";
  const hairFront = hairstyle === "fringe"
    ? "M105 123 Q91 57 180 57 Q268 58 255 126 Q228 111 207 89 Q190 126 157 128 Q130 128 105 123 Z"
    : hairstyle === "braids"
      ? "M106 123 Q98 57 180 57 Q262 57 254 123 Q235 91 210 90 Q178 121 143 107 Q123 102 106 123 Z"
      : hairstyle === "long"
        ? "M105 124 Q96 57 180 57 Q264 57 255 124 Q236 92 218 89 Q180 106 143 89 Q123 91 105 124 Z"
        : "M105 124 Q96 57 180 57 Q264 57 255 124 Q228 99 204 98 Q173 113 145 98 Q123 100 105 124 Z";
  const faceLine = face === "weathered" ? "#754B3C" : face === "noble" ? "#79513D" : "#8C5B45";
  const shoulderPath = `M${180 - shoulder - 32} 330 Q${180 - shoulder - 25} 276 180 270 Q${180 + shoulder + 25} 276 ${180 + shoulder + 32} 330 L${180 + shoulder + 22} 400 L${180 - shoulder - 22} 400 Z`;

  return (
    <View accessible accessibilityLabel="معاينة الشخصية ثنائية الأبعاد" style={styles.frame}>
      <Svg viewBox="0 0 360 420" width="100%" height="360">
        <Defs>
          <LinearGradient id="portraitBg" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#263D48" />
            <Stop offset="0.55" stopColor="#14232D" />
            <Stop offset="1" stopColor="#0A121B" />
          </LinearGradient>
          <LinearGradient id="armor" x1="0" y1="0" x2="0.8" y2="1">
            <Stop offset="0" stopColor={clothes.metal} />
            <Stop offset="0.48" stopColor={clothes.cloth} />
            <Stop offset="1" stopColor="#101923" />
          </LinearGradient>
          <LinearGradient id="skin" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={skin} />
            <Stop offset="1" stopColor="#754A3B" />
          </LinearGradient>
          <LinearGradient id="hair" x1="0" y1="0" x2="0.9" y2="1">
            <Stop offset="0" stopColor={hair.light} />
            <Stop offset="0.42" stopColor={hair.base} />
            <Stop offset="1" stopColor={hair.shade} />
          </LinearGradient>
        </Defs>
        <Rect width="360" height="420" rx="22" fill="url(#portraitBg)" />
        <Circle cx="180" cy="170" r="130" fill="none" stroke={clothes.gold} strokeOpacity="0.18" strokeWidth="1.5" />
        <Circle cx="180" cy="170" r="116" fill="none" stroke="#D7C28E" strokeOpacity="0.1" strokeDasharray="3 8" />
        {outfit !== "royal" ? <Path d="M180 19 L190 42 L215 45 L197 63 L201 88 L180 76 L159 88 L163 63 L145 45 L170 42 Z" fill={clothes.gold} opacity="0.72" /> : null}
        {outfit === "shadow" ? <Path testID="shadow-hood" d="M91 158 Q77 72 180 39 Q283 72 269 158 L250 143 Q247 91 180 68 Q113 91 110 143 Z" fill="#101721" stroke={clothes.gold} strokeWidth="4" /> : null}
        <Path d="M66 420 Q64 340 102 296 L145 279 L215 279 L258 296 Q296 340 294 420 Z" fill={clothes.cape} stroke={clothes.gold} strokeOpacity="0.6" strokeWidth="2" />
        <Path d={hairBack} fill="url(#hair)" stroke={hair.shade} strokeWidth="3" />
        {hairstyle === "braids" ? <>
          <Path d="M112 150 Q92 191 111 226 Q93 258 126 291" fill="none" stroke={hair.base} strokeWidth="17" strokeLinecap="round" />
          <Path d="M248 150 Q268 191 249 226 Q267 258 234 291" fill="none" stroke={hair.base} strokeWidth="17" strokeLinecap="round" />
          <Path d="M112 150 Q92 191 111 226 Q93 258 126 291 M248 150 Q268 191 249 226 Q267 258 234 291" fill="none" stroke={hair.light} strokeOpacity="0.45" strokeWidth="3" strokeDasharray="7 8" />
        </> : null}
        <Path d={shoulderPath} fill="url(#armor)" stroke={clothes.gold} strokeWidth="2.2" />
        <Path d="M111 316 L147 294 L180 322 L213 294 L249 316 L236 356 L124 356 Z" fill={clothes.leather} stroke={clothes.gold} strokeWidth="2" />
        <Path d="M145 281 L180 311 L215 281 L228 337 L180 365 L132 337 Z" fill={clothes.cloth} stroke={clothes.gold} strokeWidth="2" />
        <Path d="M180 311 L180 399" stroke={clothes.gold} strokeWidth="2" opacity="0.8" />
        <Path d="M100 334 L132 309 L145 344 L120 374 Z M260 334 L228 309 L215 344 L240 374 Z" fill={clothes.metal} stroke={clothes.gold} strokeWidth="2" />
        <Path d="M155 267 L155 302 Q180 324 205 302 L205 267 Z" fill="url(#skin)" />
        <Ellipse cx="180" cy="158" rx={female ? 7 : 8} ry="8" fill={skin} />
        <Path d={jaw} fill="url(#skin)" stroke="#3B2B2A" strokeOpacity="0.5" strokeWidth="2" />
        <Path d="M112 151 Q99 142 104 164 Q108 181 122 178 M248 151 Q261 142 256 164 Q252 181 238 178" fill="url(#skin)" stroke="#754A3B" strokeWidth="2" />
        <Path d={hairFront} fill="url(#hair)" stroke={hair.shade} strokeWidth="3" />
        {outfit === "royal" ? <>
          <Path testID="royal-crown" d="M137 91 L143 57 L162 75 L180 42 L198 75 L217 57 L223 91 Z" fill={clothes.gold} stroke="#FFF0B5" strokeWidth="2.5" />
          <Path d="M143 88 L217 88" stroke="#704A2B" strokeWidth="3" />
          <Circle cx="180" cy="66" r="6" fill="#7FC7C2" stroke="#F8E7B5" strokeWidth="2" />
          <Circle cx="155" cy="79" r="4" fill="#B66B78" stroke="#F8E7B5" strokeWidth="1.5" />
          <Circle cx="205" cy="79" r="4" fill="#B66B78" stroke="#F8E7B5" strokeWidth="1.5" />
        </> : null}
        {outfit === "adventurer" ? <>
          <Path testID="adventurer-circlet" d="M111 111 Q180 78 249 111" fill="none" stroke={clothes.gold} strokeWidth="5" />
          <Circle cx="180" cy="94" r="6" fill={clothes.gold} stroke="#F8E7B5" strokeWidth="1.5" />
        </> : null}
        <Path d="M119 111 Q143 73 176 75" fill="none" stroke={hair.light} strokeOpacity="0.45" strokeWidth="4" strokeLinecap="round" />
        <Path d="M184 75 Q220 74 241 111" fill="none" stroke={hair.light} strokeOpacity="0.28" strokeWidth="3" strokeLinecap="round" />
        <Path d="M137 158 Q153 147 168 157 M192 157 Q207 147 223 158" fill="none" stroke={face === "noble" ? "#3D302D" : "#4A332E"} strokeWidth={face === "noble" ? 5 : 4} strokeLinecap="round" />
        <Path d="M143 174 Q154 167 165 174 M195 174 Q206 167 217 174" fill="none" stroke="#2B2528" strokeWidth="3" strokeLinecap="round" />
        <Ellipse cx="154" cy="174" rx="3.5" ry="4" fill="#E6D6B9" />
        <Ellipse cx="206" cy="174" rx="3.5" ry="4" fill="#E6D6B9" />
        <Path d="M180 176 L175 198 Q180 202 185 198" fill="none" stroke={faceLine} strokeWidth="2.5" strokeLinecap="round" />
        <Path d={face === "noble" ? "M161 218 Q180 225 199 218" : "M162 220 Q180 216 198 220"} fill="none" stroke="#6D3537" strokeWidth="3" strokeLinecap="round" />
        {face === "weathered" ? <Path d="M216 185 L205 197 L214 204" fill="none" stroke="#9C6550" strokeWidth="2" strokeLinecap="round" /> : null}
        {female ? <Path d="M137 232 Q180 251 223 232" fill="none" stroke="#E6B5A0" strokeOpacity="0.35" strokeWidth="3" /> : null}
        <Path d="M136 286 L180 314 L224 286" fill="none" stroke={clothes.gold} strokeWidth="3" />
        <Path d="M169 333 L180 343 L191 333 L188 358 L180 366 L172 358 Z" fill={clothes.gold} stroke="#F7E3AD" strokeWidth="1" />
        <Circle cx="180" cy="350" r="5" fill="#17242B" stroke="#F7D58A" strokeWidth="2" />
        <Path d="M74 394 L102 374 L116 399 M286 394 L258 374 L244 399" fill="none" stroke={clothes.gold} strokeOpacity="0.65" strokeWidth="3" />
        <Path d="M32 420 Q48 400 65 420 M328 420 Q312 400 295 420" fill="none" stroke="#D6C18B" strokeOpacity="0.4" strokeWidth="2" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: "100%",
    minHeight: 360,
    overflow: "hidden",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(213,183,117,0.42)",
    backgroundColor: "#101b24",
    alignItems: "center",
  },
});
