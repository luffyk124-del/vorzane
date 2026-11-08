const GLB_MAGIC = 0x46546c67;
const JSON_CHUNK = 0x4e4f534a;
const SUPPORTED_HAIRSTYLES = {
  male: ["short", "fringe"],
  female: ["short", "braids"],
};

export function parseGlb(input) {
  const bytes = Buffer.from(input);
  if (bytes.length < 20 || bytes.readUInt32LE(0) !== GLB_MAGIC) {
    throw new Error("Character model is not a valid GLB file.");
  }
  if (bytes.readUInt32LE(4) !== 2) throw new Error("Only GLB version 2 is supported.");
  if (bytes.readUInt32LE(8) !== bytes.length) throw new Error("GLB length header does not match the file.");

  const chunks = [];
  let json = null;
  let offset = 12;
  while (offset < bytes.length) {
    if (offset + 8 > bytes.length) throw new Error("GLB contains a truncated chunk header.");
    const length = bytes.readUInt32LE(offset);
    const type = bytes.readUInt32LE(offset + 4);
    const start = offset + 8;
    const end = start + length;
    if (end > bytes.length) throw new Error("GLB contains a truncated chunk.");
    const data = bytes.subarray(start, end);
    chunks.push({ type, data });
    if (type === JSON_CHUNK) {
      if (json) throw new Error("GLB contains multiple JSON chunks.");
      json = JSON.parse(data.toString("utf8"));
    }
    offset = end;
  }
  if (!json) throw new Error("GLB is missing its JSON chunk.");
  return { json, chunks };
}

export function collectReachableNodeNames(document) {
  const scene = document.scenes?.[document.scene ?? 0];
  if (!scene) throw new Error("Character model is missing its default scene.");
  const names = new Set();
  const visited = new Set();
  const visit = (index) => {
    if (visited.has(index)) throw new Error("Character model contains a cyclic node tree.");
    const node = document.nodes?.[index];
    if (!node) throw new Error(`Character model references missing node ${index}.`);
    visited.add(index);
    if (node.name) names.add(node.name);
    for (const child of node.children ?? []) visit(child);
    visited.delete(index);
  };
  for (const index of scene.nodes ?? []) visit(index);
  return names;
}

function encodeGlb(document, chunks) {
  const json = Buffer.from(JSON.stringify(document), "utf8");
  const jsonPadding = (4 - (json.length % 4)) % 4;
  const jsonData = jsonPadding ? Buffer.concat([json, Buffer.alloc(jsonPadding, 0x20)]) : json;
  const encodedChunks = chunks.map(({ type, data }) => {
    const payload = type === JSON_CHUNK ? jsonData : data;
    const header = Buffer.alloc(8);
    header.writeUInt32LE(payload.length, 0);
    header.writeUInt32LE(type, 4);
    return Buffer.concat([header, payload]);
  });
  const totalLength = 12 + encodedChunks.reduce((total, chunk) => total + chunk.length, 0);
  const header = Buffer.alloc(12);
  header.writeUInt32LE(GLB_MAGIC, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(totalLength, 8);
  return Buffer.concat([header, ...encodedChunks]);
}

function hiddenNodesFor(gender, hairstyle) {
  const otherGender = gender === "male" ? "FEMALE" : "MALE";
  const hidden = new Set([
    `HERO_${otherGender}_RIG`,
    `HERO_${otherGender}_ROOT`,
    `ENV_pedestal_${otherGender.toLowerCase()}`,
  ]);
  if (gender === "male" && hairstyle === "short") hidden.add("HERO_MALE_hair_fringe");
  if (gender === "female" && hairstyle === "short") {
    hidden.add("HERO_FEMALE_braid_left");
    hidden.add("HERO_FEMALE_braid_right");
  }
  return hidden;
}

export function createCharacterModelVariant(input, gender, hairstyle) {
  if (!SUPPORTED_HAIRSTYLES[gender]?.includes(hairstyle)) {
    throw new Error(`Unsupported character model variant: ${gender}/${hairstyle}.`);
  }
  const { json, chunks } = parseGlb(input);
  const document = structuredClone(json);
  const scene = document.scenes?.[document.scene ?? 0];
  if (!scene) throw new Error("Character model is missing its default scene.");

  const hiddenNodes = hiddenNodesFor(gender, hairstyle);
  for (const name of hiddenNodes) {
    if (!document.nodes.some((node) => node.name === name)) {
      throw new Error(`Character model is missing expected node "${name}".`);
    }
  }

  const visit = (index) => {
    const node = document.nodes[index];
    if (!node) throw new Error(`Character model references missing node ${index}.`);
    if (hiddenNodes.has(node.name)) return false;
    if (node.children) node.children = node.children.filter(visit);
    return true;
  };
  scene.nodes = (scene.nodes ?? []).filter(visit);

  const reachable = collectReachableNodeNames(document);
  const selectedPrefix = `HERO_${gender.toUpperCase()}`;
  const otherPrefix = `HERO_${gender === "male" ? "FEMALE" : "MALE"}`;
  if (!reachable.has(`${selectedPrefix}_RIG`) || !reachable.has(`${selectedPrefix}_ROOT`)) {
    throw new Error(`Generated ${gender}/${hairstyle} model lost its selected character rig.`);
  }
  if ([...reachable].some((name) => name.startsWith(`${otherPrefix}_`))) {
    throw new Error(`Generated ${gender}/${hairstyle} model still includes the other character.`);
  }
  if (gender === "male" && reachable.has("HERO_MALE_hair_fringe") !== (hairstyle === "fringe")) {
    throw new Error("Generated male hairstyle does not match the selected variant.");
  }
  if (gender === "female") {
    const hasBraids = reachable.has("HERO_FEMALE_braid_left") && reachable.has("HERO_FEMALE_braid_right");
    if (hasBraids !== (hairstyle === "braids")) {
      throw new Error("Generated female hairstyle does not match the selected variant.");
    }
  }
  return encodeGlb(document, chunks);
}
