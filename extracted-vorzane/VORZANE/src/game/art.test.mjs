import assert from "node:assert/strict";
import test from "node:test";
import { BRAND_EMBLEM, CLASS_ART, characterArtPath } from "./art.ts";

test("character and brand art include the configured GitHub Pages base path", () => {
  assert.equal(characterArtPath("brand-emblem.webp", "/vorzane"), "/vorzane/images/characters/brand-emblem.webp");
  assert.equal(characterArtPath("warrior.webp", "/vorzane/"), "/vorzane/images/characters/warrior.webp");
  assert.ok(BRAND_EMBLEM.endsWith("/images/characters/brand-emblem.webp"));
  assert.ok(CLASS_ART.Warrior.endsWith("/images/characters/warrior.webp"));
  assert.ok(CLASS_ART.Mage.endsWith("/images/characters/mage.webp"));
  assert.ok(CLASS_ART.Assassin.endsWith("/images/characters/assassin.webp"));
  assert.ok(CLASS_ART.Archer.endsWith("/images/characters/archer.webp"));
});