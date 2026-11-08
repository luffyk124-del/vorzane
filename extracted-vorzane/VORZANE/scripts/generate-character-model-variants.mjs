import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createCharacterModelVariant } from "./characterModelVariants.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.resolve(projectRoot, "../../assets/models/characters/vorzane-characters.glb");
const outputDirectory = path.join(projectRoot, "public/models/characters");
const source = await readFile(sourcePath);
await mkdir(outputDirectory, { recursive: true });

for (const [gender, hairstyles] of Object.entries({
  male: ["short", "fringe"],
  female: ["short", "braids"],
})) {
  for (const hairstyle of hairstyles) {
    const outputPath = path.join(outputDirectory, `vorzane-${gender}-${hairstyle}.glb`);
    await writeFile(outputPath, createCharacterModelVariant(source, gender, hairstyle));
    console.log(`Generated ${path.relative(projectRoot, outputPath)}`);
  }
}
