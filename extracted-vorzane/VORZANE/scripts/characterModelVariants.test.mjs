import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  collectReachableNodeNames,
  createCharacterModelVariant,
  parseGlb,
} from "./characterModelVariants.mjs";

const sourcePath = new URL("../../../assets/models/characters/vorzane-characters.glb", import.meta.url);
const source = await readFile(fileURLToPath(sourcePath));

for (const [gender, hairstyle] of [
  ["male", "short"],
  ["male", "fringe"],
  ["female", "short"],
  ["female", "braids"],
]) {
  test(`GLB generator produces only the ${gender} ${hairstyle} model`, () => {
    const output = createCharacterModelVariant(source, gender, hairstyle);
    const { json } = parseGlb(output);
    const names = collectReachableNodeNames(json);
    const otherGender = gender === "male" ? "FEMALE" : "MALE";
    assert.equal(names.has(`HERO_${gender.toUpperCase()}_RIG`), true);
    assert.equal(names.has(`HERO_${otherGender}_RIG`), false);
    assert.equal(names.has(`ENV_pedestal_${gender}`), true);
    assert.equal(names.has(`ENV_pedestal_${gender === "male" ? "female" : "male"}`), false);
    assert.equal(json.asset.version, "2.0");
    assert.equal(output.readUInt32LE(8), output.length);
  });
}

test("each generated hair variant exposes the matching named meshes", () => {
  const maleShort = collectReachableNodeNames(parseGlb(createCharacterModelVariant(source, "male", "short")).json);
  const maleFringe = collectReachableNodeNames(parseGlb(createCharacterModelVariant(source, "male", "fringe")).json);
  const femaleShort = collectReachableNodeNames(parseGlb(createCharacterModelVariant(source, "female", "short")).json);
  const femaleBraids = collectReachableNodeNames(parseGlb(createCharacterModelVariant(source, "female", "braids")).json);

  assert.equal(maleShort.has("HERO_MALE_hair_fringe"), false);
  assert.equal(maleFringe.has("HERO_MALE_hair_fringe"), true);
  assert.equal(femaleShort.has("HERO_FEMALE_braid_left"), false);
  assert.equal(femaleShort.has("HERO_FEMALE_braid_right"), false);
  assert.equal(femaleBraids.has("HERO_FEMALE_braid_left"), true);
  assert.equal(femaleBraids.has("HERO_FEMALE_braid_right"), true);
});

test("GLB generator rejects hairstyles the asset does not contain", () => {
  assert.throws(() => createCharacterModelVariant(source, "male", "braids"), /Unsupported character model variant/);
});

test("GLB parser rejects invalid data", () => {
  assert.throws(() => parseGlb(Buffer.from("not a GLB")), /not a valid GLB/);
});
