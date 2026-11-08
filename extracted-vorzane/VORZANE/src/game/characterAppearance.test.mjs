import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyCharacterMaterials,
  getCharacterMaterialColors,
  getCharacterModelPath,
  getModelHairstyles,
  resolveModelHairstyle,
  SKIN_TONE_COLORS,
} from "./characterAppearance.ts";

test("model hair options match the geometry available for each gender", () => {
  assert.deepEqual(getModelHairstyles("male"), ["short", "fringe"]);
  assert.deepEqual(getModelHairstyles("female"), ["short", "braids"]);
  assert.equal(resolveModelHairstyle("male", "braids"), "short");
  assert.equal(resolveModelHairstyle("female", "long"), "braids");
});

test("model paths retain the Expo base path and remove trailing slashes", () => {
  assert.equal(
    getCharacterModelPath("female", "braids", "/vorzane/"),
    "/vorzane/models/characters/vorzane-female-braids.glb",
  );
  assert.equal(
    getCharacterModelPath("male", "short"),
    "/models/characters/vorzane-male-short.glb",
  );
});

test("skin and outfit selections resolve to named GLB materials", () => {
  const colors = getCharacterMaterialColors(2, "royal");
  assert.equal(colors["Skin | warm olive"], SKIN_TONE_COLORS[2]);
  assert.equal(colors["Skin | warm medium"], SKIN_TONE_COLORS[2]);
  assert.equal(colors["Armor | antique brass"], "#EFD183");
  assert.equal(getCharacterMaterialColors(0, "shadow")["Cloth | charcoal"], "#151A22");
});

test("appearance changes update every available named model material", () => {
  const changes = [];
  const materialNames = Object.keys(getCharacterMaterialColors(1, "adventurer"));
  const model = {
    getMaterialByName(name) {
      if (!materialNames.includes(name)) return null;
      return {
        pbrMetallicRoughness: {
          setBaseColorFactor(color) {
            changes.push([name, color]);
          },
        },
      };
    },
  };

  assert.equal(applyCharacterMaterials(model, 1, "adventurer"), materialNames.length);
  assert.equal(changes.length, materialNames.length);
  assert.equal(changes.find(([name]) => name === "Skin | warm medium")[1], SKIN_TONE_COLORS[1]);
});

test("appearance application safely handles an unloaded viewer", () => {
  assert.equal(applyCharacterMaterials(undefined, 0, "adventurer"), 0);
  assert.equal(applyCharacterMaterials({}, 0, "adventurer"), 0);
});
