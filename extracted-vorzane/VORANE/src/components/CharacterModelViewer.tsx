import { StyleSheet, View } from "react-native";
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Polygon, Rect, Stop } from "react-native-svg";
import type { CharacterStyle, ClassId } from "../game/model";
import { CLASS_NAMES } from "../game/model";

type Props = CharacterStyle & { className?: ClassId };

const SKIN = ["#F4C9A5", "#DDA47C", "#B87955", "#80543F"];
const HAIR: Record<string, [string, string, string]> = {
  short: ["#20232D", "#737989", "#0B1019"],
  long: ["#20232D", "#737989", "#0B1019"],
  braids: ["#542D26", "#C17A4C", "#24151A"],
  fringe: ["#6B3440", "#D47B78", "#2C1724"],
};
const PALETTES: Record<ClassId, { main: string; light: string; dark: string; glow: string }> = {
  Warrior: { main: "#6C3540", light: "#D6B16C", dark: "#18222E", glow: "#E7A34F" },
  Mage: { main: "#433D82", light: "#A9A0F4", dark: "#171A38", glow: "#75D9F2" },
  Assassin: { main: "#263B3B", light: "#8BC5B2", dark: "#101B22", glow: "#61E5C3" },
  Archer: { main: "#456044", light: "#C5B47A", dark: "#1A2822", glow: "#B4E58A" },
};

export function CharacterModelViewer({
  gender = "male",
  className = "Warrior",
  appearance,
  hairstyle,
  face,
  outfit,
  body,
}: Props) {
  const palette = PALETTES[className] ?? PALETTES.Warrior;
  const skin = SKIN[appearance] ?? SKIN[0];
  const hair = HAIR[hairstyle] ?? HAIR.short;
  const female = gender === "female";
  const wide = body === "sturdy" ? 1.12 : body === "agile" ? 0.9 : 1;
  const royal = outfit === "royal";
  const shadow = outfit === "shadow";
  const eye = palette.glow;
  const facePath = female
    ? "M151 154 Q153 91 210 88 Q267 91 269 154 L258 225 Q245 260 210 270 Q175 260 162 225 Z"
    : "M145 153 Q147 88 210 86 Q273 88 275 153 L262 229 Q244 269 210 274 Q176 269 158 229 Z";
  const hairBack = hairstyle === "long" || hairstyle === "braids"
    ? "M143 147 Q122 191 137 279 L151 340 L178 310 L177 205 L243 205 L242 310 L269 340 L283 279 Q298 191 277 147 Z"
    : "M142 148 Q130 80 210 70 Q290 80 278 148 L265 201 L155 201 Z";
  const hairFront = hairstyle === "fringe"
    ? "M143 150 Q132 78 210 70 Q289 75 277 151 Q246 127 225 105 Q203 146 170 143 Z"
    : hairstyle === "braids"
      ? "M143 150 Q132 78 210 70 Q289 75 277 151 Q250 115 225 111 Q196 145 166 128 Z"
      : "M143 150 Q132 78 210 70 Q289 75 277 151 Q249 121 226 115 Q190 134 165 117 Z";

  return (
    <View testID="fantasy-character-preview" accessible accessibilityLabel={`معاينة شخصية ${CLASS_NAMES[className]} الفنتازية`} style={styles.frame}>
      <Svg width="100%" height="100%" viewBox="0 0 420 500" accessibilityLabel={`بطل فنتازي من فئة ${CLASS_NAMES[className]}`}>
        <Defs>
          <LinearGradient id="scene" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#263847" />
            <Stop offset="0.5" stopColor="#111C2A" />
            <Stop offset="1" stopColor="#080D17" />
          </LinearGradient>
          <LinearGradient id="metal" x1="0" y1="0" x2="0.9" y2="1">
            <Stop offset="0" stopColor={palette.light} />
            <Stop offset="0.24" stopColor={palette.main} />
            <Stop offset="0.7" stopColor={palette.dark} />
            <Stop offset="1" stopColor="#080D14" />
          </LinearGradient>
          <LinearGradient id="skin" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#FFE0BD" />
            <Stop offset="0.45" stopColor={skin} />
            <Stop offset="1" stopColor="#754532" />
          </LinearGradient>
          <LinearGradient id="hair" x1="0" y1="0" x2="0.9" y2="1">
            <Stop offset="0" stopColor={hair[1]} />
            <Stop offset="0.45" stopColor={hair[0]} />
            <Stop offset="1" stopColor={hair[2]} />
          </LinearGradient>
          <LinearGradient id="cloak" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={palette.main} />
            <Stop offset="1" stopColor={palette.dark} />
          </LinearGradient>
        </Defs>
        <Rect width="420" height="500" fill="url(#scene)" />
        <Circle cx="210" cy="204" r="168" fill="none" stroke={palette.glow} strokeOpacity="0.14" strokeWidth="2" />
        <Circle cx="210" cy="204" r="148" fill="none" stroke={palette.light} strokeOpacity="0.12" strokeDasharray="3 11" />
        <Path d="M210 16 L222 52 L260 57 L232 83 L239 121 L210 102 L181 121 L188 83 L160 57 L198 52 Z" fill={palette.glow} opacity="0.12" />
        <G opacity="0.72" stroke={palette.glow} strokeWidth="2" fill="none">
          <Path d="M40 132 L55 102 L70 132 L55 162 Z" />
          <Path d="M350 132 L365 102 L380 132 L365 162 Z" />
          <Circle cx="55" cy="132" r="4" fill={palette.glow} />
          <Circle cx="365" cy="132" r="4" fill={palette.glow} />
        </G>
        <Path d="M52 500 Q54 386 105 326 L155 293 L265 293 L315 326 Q366 386 368 500 Z" fill="url(#cloak)" stroke={palette.light} strokeOpacity="0.55" strokeWidth="3" />
        <Path d="M95 500 L131 352 L177 326 L210 366 L243 326 L289 352 L325 500 Z" fill={palette.dark} stroke={palette.light} strokeWidth="2.5" />
        <Path d="M153 314 L210 353 L267 314 L295 410 L210 474 L125 410 Z" fill="url(#metal)" stroke={palette.light} strokeWidth="3" />
        <Path d="M210 353 L210 462 M161 371 L210 408 L259 371" fill="none" stroke={palette.light} strokeWidth="3" />
        <Path d="M179 389 L210 414 L241 389 L232 454 L210 470 L188 454 Z" fill={palette.main} stroke={palette.light} strokeWidth="2" />
        <Circle cx="210" cy="426" r="12" fill={palette.dark} stroke={palette.glow} strokeWidth="3" />
        <Circle cx="210" cy="426" r="5" fill={palette.glow} />
        <Path d="M150 300 Q108 280 91 321 L70 373 L118 399 L160 354 Z" fill="url(#metal)" stroke={palette.light} strokeWidth="3" transform={`translate(${-((1-wide)*210)},0) scale(${wide},1)`} />
        <Path d="M270 300 Q312 280 329 321 L350 373 L302 399 L260 354 Z" fill="url(#metal)" stroke={palette.light} strokeWidth="3" transform={`translate(${210-(210*wide)},0) scale(${wide},1)`} />
        <Path d="M93 334 L117 319 L143 345 L127 379 L84 365 Z M327 334 L303 319 L277 345 L293 379 L336 365 Z" fill={palette.main} stroke={palette.light} strokeWidth="2" />
        <Path d="M176 270 L176 318 Q210 343 244 318 L244 270 Z" fill="url(#skin)" />
        <Path d={hairBack} fill="url(#hair)" stroke={hair[2]} strokeWidth="4" />
        {className === "Warrior" ? <G>
          <Path d="M88 310 L64 114 L80 93 L102 307 Z" fill="#B6C4D0" stroke={palette.light} strokeWidth="3" />
          <Path d="M72 139 L92 130 L100 153 L77 162 Z" fill={palette.main} />
          <Path d="M56 106 L78 66 L99 105 L82 96 Z" fill={palette.light} />
        </G> : null}
        {className === "Mage" ? <G>
          <Path d="M89 360 L73 102" stroke="#8B6945" strokeWidth="9" strokeLinecap="round" />
          <Path d="M73 96 Q39 65 73 36 Q107 65 73 96 Z" fill={palette.glow} opacity="0.9" />
          <Circle cx="73" cy="66" r="25" fill="none" stroke="#D7F7FF" strokeWidth="3" />
          <Circle cx="73" cy="66" r="9" fill="#E8FCFF" />
        </G> : null}
        {className === "Assassin" ? <G>
          <Path d="M87 322 L44 177 L56 161 L111 300 Z M333 322 L376 177 L364 161 L309 300 Z" fill="#C4D7DA" stroke={palette.glow} strokeWidth="2" />
          <Path d="M48 177 L63 145 L72 174 Z M372 177 L357 145 L348 174 Z" fill={palette.light} />
        </G> : null}
        {className === "Archer" ? <G>
          <Path d="M327 96 Q420 205 327 314" fill="none" stroke="#B89A62" strokeWidth="8" />
          <Path d="M327 96 L327 314" stroke="#E9D6A6" strokeWidth="2" />
          <Path d="M327 96 L314 112 L340 112 Z M327 314 L314 298 L340 298 Z" fill={palette.light} />
        </G> : null}
        <Path d={facePath} fill="url(#skin)" stroke="#4B2B2A" strokeOpacity="0.7" strokeWidth="3" />
        <Path d="M151 173 Q132 163 137 192 Q143 211 160 209 M269 173 Q288 163 283 192 Q277 211 260 209" fill="url(#skin)" stroke="#8A5944" strokeWidth="2" />
        <Path d="M166 179 L193 173 M227 173 L254 179" stroke="#30242A" strokeWidth="8" strokeLinecap="round" />
        <Path d="M166 192 Q180 182 194 193 M226 193 Q240 182 254 192" fill="none" stroke="#171C25" strokeWidth="5" strokeLinecap="round" />
        <Ellipse cx="181" cy="194" rx="5" ry="6" fill={eye} />
        <Ellipse cx="239" cy="194" rx="5" ry="6" fill={eye} />
        <Path d="M210 193 L202 224 L211 229" fill="none" stroke="#89543F" strokeWidth="3" strokeLinecap="round" />
        <Path d={face === "noble" ? "M188 246 Q210 258 232 246" : "M189 248 Q210 242 231 248"} fill="none" stroke="#5C2C30" strokeWidth="4" strokeLinecap="round" />
        {face === "weathered" ? <Path d="M246 209 L230 225 L242 236" fill="none" stroke="#9B604A" strokeWidth="3" strokeLinecap="round" /> : null}
        {female ? <Path d="M173 258 Q210 277 247 258" fill="none" stroke="#F3B79E" strokeOpacity="0.45" strokeWidth="3" /> : null}
        <Path d={hairFront} fill="url(#hair)" stroke={hair[2]} strokeWidth="3" />
        {hairstyle === "braids" ? <G fill="none" stroke="url(#hair)" strokeWidth="17" strokeLinecap="round">
          <Path d="M153 165 Q127 230 145 275 Q129 313 153 346" />
          <Path d="M267 165 Q293 230 275 275 Q291 313 267 346" />
        </G> : null}
        {royal ? <G>
          <Path d="M151 116 L160 62 L188 91 L210 34 L232 91 L260 62 L269 116 Z" fill={palette.light} stroke="#FFF0C4" strokeWidth="3" />
          <Path d="M160 110 L260 110" stroke="#6B4A2D" strokeWidth="5" />
          <Circle cx="210" cy="78" r="9" fill={palette.glow} stroke="#FFF1C7" strokeWidth="3" />
          <Circle cx="177" cy="96" r="5" fill="#A9DDF4" /><Circle cx="243" cy="96" r="5" fill="#A9DDF4" />
        </G> : null}
        {shadow ? <Path d="M128 174 Q105 68 210 42 Q315 68 292 174 L267 155 Q264 90 210 76 Q156 90 153 155 Z" fill="#0A101A" stroke={palette.light} strokeWidth="3" /> : null}
        {!royal && !shadow ? <Path d="M145 135 Q210 98 275 135" fill="none" stroke={palette.light} strokeWidth="6" /> : null}
        <Path d="M165 299 L210 330 L255 299" fill="none" stroke={palette.light} strokeWidth="4" />
        <Polygon points="210,316 225,339 210,362 195,339" fill={palette.glow} stroke="#F5E8C4" strokeWidth="2" />
        <Circle cx="210" cy="339" r="5" fill="#F9F3DB" />
        <Path d="M40 448 L74 425 L94 450 M380 448 L346 425 L326 450" fill="none" stroke={palette.light} strokeOpacity="0.6" strokeWidth="3" />
        <Path d="M24 477 Q210 450 396 477" fill="none" stroke={palette.glow} strokeOpacity="0.25" strokeWidth="2" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: "100%",
    height: 430,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(222,185,111,0.68)",
    backgroundColor: "#101722",
    shadowColor: "#000",
    shadowOpacity: 0.38,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 9 },
  },
});
