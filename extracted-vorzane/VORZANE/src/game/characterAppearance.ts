import type { CharacterStyle } from "./model";

export const SKIN_TONE_COLORS = ["#F2C7A5", "#D59A70", "#A66D4C", "#684331"] as const;

export const OUTFIT_COLOR_PRESETS: Record<CharacterStyle["outfit"], Record<string, string>> = {
  adventurer: {
    "Armor | dark forged steel": "#4E6B74",
    "Armor | antique brass": "#CDA65F",
    "Leather | deep oxblood": "#663331",
    "Cloth | charcoal": "#34434C",
  },
  royal: {
    "Armor | dark forged steel": "#716044",
    "Armor | antique brass": "#EFD183",
    "Leather | deep oxblood": "#702448",
    "Cloth | charcoal": "#493452",
  },
  shadow: {
    "Armor | dark forged steel": "#363D49",
    "Armor | antique brass": "#738096",
    "Leather | deep oxblood": "#29212D",
    "Cloth | charcoal": "#151A22",
  },
};

export const MODEL_HAIRSTYLES = {
  male: ["short", "fringe"],
  female: ["short", "braids"],
} as const;

export type ModelHairstyle = "short" | "fringe" | "braids";

type ModelViewerMaterial = {
  pbrMetallicRoughness?: {
    setBaseColorFactor?: (color: string) => void;
  };
};

type ModelViewerModel = {
  getMaterialByName?: (name: string) => ModelViewerMaterial | null;
};

export function getModelHairstyles(gender: CharacterStyle["gender"]): readonly ModelHairstyle[] {
  return MODEL_HAIRSTYLES[gender];
}

export function resolveModelHairstyle(
  gender: CharacterStyle["gender"],
  hairstyle: CharacterStyle["hairstyle"],
): ModelHairstyle {
  const supported = getModelHairstyles(gender);
  if ((supported as readonly string[]).includes(hairstyle)) return hairstyle as ModelHairstyle;
  return gender === "female" ? "braids" : "short";
}

export function getCharacterModelPath(
  gender: CharacterStyle["gender"],
  hairstyle: ModelHairstyle,
  basePath = "",
): string {
  const normalizedBasePath = basePath.replace(/\/+$/, "");
  return `${normalizedBasePath}/models/characters/vorzane-${gender}-${hairstyle}.glb`;
}

export function getCharacterMaterialColors(
  appearance: CharacterStyle["appearance"],
  outfit: CharacterStyle["outfit"],
): Record<string, string> {
  const skinColor = SKIN_TONE_COLORS[appearance] ?? SKIN_TONE_COLORS[0];
  return {
    "Skin | warm olive": skinColor,
    "Skin | warm medium": skinColor,
    ...(OUTFIT_COLOR_PRESETS[outfit] ?? OUTFIT_COLOR_PRESETS.adventurer),
  };
}

export function applyCharacterMaterials(
  model: ModelViewerModel | null | undefined,
  appearance: CharacterStyle["appearance"],
  outfit: CharacterStyle["outfit"],
): number {
  if (typeof model?.getMaterialByName !== "function") return 0;

  let updated = 0;
  for (const [materialName, color] of Object.entries(getCharacterMaterialColors(appearance, outfit))) {
    const pbr = model.getMaterialByName(materialName)?.pbrMetallicRoughness;
    if (typeof pbr?.setBaseColorFactor !== "function") continue;
    pbr.setBaseColorFactor(color);
    updated += 1;
  }
  return updated;
}
