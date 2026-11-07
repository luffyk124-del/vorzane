import type { ClassId } from "./model";

// Local copies of VORZANE's original dark-fantasy art, independent of Manus Storage.
const BASE_PATH = (process.env.EXPO_PUBLIC_BASE_PATH ?? "").replace(/\/$/, "");
export const characterArtPath = (file: string, basePath = BASE_PATH) => `${basePath.replace(/\/$/, "")}/images/characters/${file}`;

export const BRAND_EMBLEM = characterArtPath("brand-emblem.webp");

export const CLASS_ART: Record<ClassId, string> = {
  Warrior: characterArtPath("warrior.webp"),
  Mage: characterArtPath("mage.webp"),
  Assassin: characterArtPath("assassin.webp"),
  Archer: characterArtPath("archer.webp"),
};
