import { createClient } from "npm:@supabase/supabase-js@2";
import { advanceExpeditions, allocateStatPoint, beginOrQueueExpedition, buyItem, buyPet, claimExplorationAchievement, claimExpeditionTask, claimQuest, claimRecurringMission, createHeroState, dismissOfflineReport, equipItem, sellItem, setPet, unequipItem } from "../../../src/game/engine.ts";
import { createItemInstance } from "../../../src/game/dungeonItems.ts";
import { STARTER_ITEMS } from "../../../src/game/catalog.ts";
import { normalizeGameState, type CharacterStyle, type ClassId, type GameState, type StatKey } from "../../../src/game/model.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type EconomyCommand =
  | { type: "buyItem"; itemId: string }
  | { type: "sellItem"; itemId: string }
  | { type: "equipItem"; itemId: string }
  | { type: "unequipItem"; slot: string }
  | { type: "buyPet"; petId: string }
  | { type: "setPet"; petId: string | null }
  | { type: "createHero"; name: string; className: ClassId; gender: "male" | "female"; appearance: 0 | 1 | 2 | 3 }
  | { type: "allocateStatPoint"; key: StatKey }
  | { type: "beginExpedition"; planId: string }
  | { type: "advanceExpeditions" }
  | { type: "claimQuest"; questId: string }
  | { type: "claimExpeditionTask"; taskId: string }
  | { type: "claimExplorationAchievement"; achievementId: string }
  | { type: "claimRecurringMission"; scope: "daily" | "weekly" | "season"; missionId: string }
  | { type: "dismissReport"; id: string }
  | { type: "updateSettings"; settings: Partial<GameState["settings"]> }
  | { type: "setProfileAvatar"; avatarId: ClassId | "brand" }
  | { type: "updateCharacterStyle"; style: CharacterStyle };

type RequestBody = {
  commandId: string;
  expectedUpdatedAt: string;
  command: EconomyCommand;
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function parseCommand(value: unknown): EconomyCommand | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const command = value as Record<string, unknown>;
  if (command.type === "buyItem" || command.type === "sellItem" || command.type === "equipItem") {
    if (typeof command.itemId !== "string" || !command.itemId.trim() || command.itemId.length > 160) return null;
    return { type: command.type, itemId: command.itemId };
  }
  if (command.type === "unequipItem") {
    if (typeof command.slot !== "string" || !command.slot.trim() || command.slot.length > 40) return null;
    return { type: "unequipItem", slot: command.slot };
  }
  if (command.type === "buyPet") {
    if (typeof command.petId !== "string" || !command.petId.trim() || command.petId.length > 120) return null;
    return { type: "buyPet", petId: command.petId };
  }
  if (command.type === "setPet") {
    if (command.petId !== null && (typeof command.petId !== "string" || !command.petId.trim() || command.petId.length > 120)) return null;
    return { type: "setPet", petId: command.petId as string | null };
  }
  if (command.type === "createHero") {
    const classes = ["Warrior", "Mage", "Assassin", "Archer"];
    if (typeof command.name !== "string" || command.name.trim().length < 2 || command.name.length > 48 ||
        typeof command.className !== "string" || !classes.includes(command.className) ||
        !["male", "female"].includes(String(command.gender)) ||
        ![0, 1, 2, 3].includes(Number(command.appearance))) return null;
    return { type: "createHero", name: command.name.trim(), className: command.className as ClassId, gender: command.gender as "male" | "female", appearance: Number(command.appearance) as 0 | 1 | 2 | 3 };
  }
  if (command.type === "allocateStatPoint") {
    if (!["str", "def", "vit", "agi", "luck"].includes(String(command.key))) return null;
    return { type: "allocateStatPoint", key: command.key as StatKey };
  }
  if (command.type === "beginExpedition") {
    if (typeof command.planId !== "string" || !command.planId.trim() || command.planId.length > 120) return null;
    return { type: "beginExpedition", planId: command.planId };
  }
  if (command.type === "advanceExpeditions") return { type: "advanceExpeditions" };
  if (command.type === "claimQuest") {
    if (typeof command.questId !== "string" || !command.questId.trim() || command.questId.length > 120) return null;
    return { type: "claimQuest", questId: command.questId };
  }
  if (command.type === "claimExpeditionTask") {
    if (typeof command.taskId !== "string" || !command.taskId.trim() || command.taskId.length > 120) return null;
    return { type: "claimExpeditionTask", taskId: command.taskId };
  }
  if (command.type === "claimExplorationAchievement") {
    if (typeof command.achievementId !== "string" || !command.achievementId.trim() || command.achievementId.length > 120) return null;
    return { type: "claimExplorationAchievement", achievementId: command.achievementId };
  }
  if (command.type === "claimRecurringMission") {
    if (!["daily", "weekly", "season"].includes(String(command.scope)) || typeof command.missionId !== "string" || !command.missionId.trim() || command.missionId.length > 120) return null;
    return { type: "claimRecurringMission", scope: command.scope as "daily" | "weekly" | "season", missionId: command.missionId };
  }
  if (command.type === "dismissReport") {
    if (typeof command.id !== "string" || !command.id.trim() || command.id.length > 160) return null;
    return { type: "dismissReport", id: command.id };
  }
  if (command.type === "setProfileAvatar") {
    if (!["brand", "Warrior", "Mage", "Assassin", "Archer"].includes(String(command.avatarId))) return null;
    return { type: "setProfileAvatar", avatarId: command.avatarId as ClassId | "brand" };
  }
  if (command.type === "updateSettings") {
    if (!isRecord(command.settings)) return null;
    const settings: Partial<GameState["settings"]> = {};
    if ("sfx" in command.settings) { if (typeof command.settings.sfx !== "boolean") return null; settings.sfx = command.settings.sfx; }
    if ("musicEnabled" in command.settings) { if (typeof command.settings.musicEnabled !== "boolean") return null; settings.musicEnabled = command.settings.musicEnabled; }
    if ("volume" in command.settings) { if (typeof command.settings.volume !== "number" || !Number.isFinite(command.settings.volume) || command.settings.volume < 0 || command.settings.volume > 100) return null; settings.volume = command.settings.volume; }
    if ("musicVolume" in command.settings) { if (typeof command.settings.musicVolume !== "number" || !Number.isFinite(command.settings.musicVolume) || command.settings.musicVolume < 0 || command.settings.musicVolume > 100) return null; settings.musicVolume = command.settings.musicVolume; }
    if (!Object.keys(settings).length) return null;
    return { type: "updateSettings", settings };
  }
  if (command.type === "updateCharacterStyle") {
    if (!isRecord(command.style)) return null;
    const style = command.style;
    const values = {
      gender: ["male", "female"], appearance: [0, 1, 2, 3], hairstyle: ["short", "long", "braids", "fringe"],
      hairColor: ["obsidian", "silver", "crimson", "gold", "violet", "chestnut"],
      face: ["classic", "noble", "weathered"], outfit: ["adventurer", "royal", "shadow"], body: ["balanced", "sturdy", "agile"],
    } as const;
    if (!values.gender.includes(style.gender as never) || !values.appearance.includes(style.appearance as never) ||
        !values.hairstyle.includes(style.hairstyle as never) || !values.hairColor.includes(style.hairColor as never) ||
        !values.face.includes(style.face as never) || !values.outfit.includes(style.outfit as never) ||
        !values.body.includes(style.body as never)) return null;
    return { type: "updateCharacterStyle", style: style as unknown as CharacterStyle };
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function createEconomyCommandHandler(
  makeClient: typeof createClient = createClient,
  getEnv: (name: string) => string | undefined = (name) => Deno.env.get(name),
) {
  return async (request: Request): Promise<Response> => {
    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

    const authHeader = request.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const url = getEnv("SUPABASE_URL");
    const anonKey = getEnv("SUPABASE_ANON_KEY");
    const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !anonKey || !serviceRoleKey) return json({ error: "Server configuration is incomplete" }, 500);

    let body: RequestBody;
    try {
      const parsed = await request.json();
      if (!isRecord(parsed)) return json({ error: "Invalid command payload" }, 400);
      const command = parseCommand(parsed.command);
      if (
        typeof parsed.commandId !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(parsed.commandId) ||
        typeof parsed.expectedUpdatedAt !== "string" ||
        !Number.isFinite(Date.parse(parsed.expectedUpdatedAt)) ||
        !command
      ) return json({ error: "Invalid command payload" }, 400);
      body = { commandId: parsed.commandId, expectedUpdatedAt: parsed.expectedUpdatedAt, command };
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    // Forward the caller JWT so auth.uid() inside the transaction RPC is the caller.
    const client = makeClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError || !userData.user) return json({ error: "Unauthorized" }, 401);

    const { data: save, error: readError } = await client
      .from("player_saves")
      .select("game_state, updated_at")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (readError) return json({ error: "Could not load save" }, 500);
    if (!save) return json({ error: "Player save not found" }, 404);
    const state = normalizeGameState(save.game_state);
    if (!state) return json({ error: "Player state is invalid" }, 409);

    // Resolve a previously committed command before checking the caller's
    // version or re-running game rules. This makes retries safe even when the
    // original command already changed or removed the referenced item.
    const adminClient = makeClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: receipt, error: receiptError } = await adminClient
      .from("player_command_receipts")
      .select("result")
      .eq("user_id", userData.user.id)
      .eq("command_id", body.commandId)
      .maybeSingle();

    if (receiptError) return json({ error: "Could not check command receipt" }, 500);
    if (receipt && isRecord(receipt.result)) {
      return json({
        state,
        soldPrice: typeof receipt.result.soldPrice === "number" ? receipt.result.soldPrice : null,
        updatedAt: save.updated_at,
        replayed: true,
      });
    }

    if (!state.hero && body.command.type !== "createHero") return json({ error: "Create a hero first" }, 409);
    if (state.hero && body.command.type === "createHero") return json({ error: "Hero already exists" }, 409);

    if (body.expectedUpdatedAt !== save.updated_at) {
      return json({ error: "Save changed; reload and retry", updatedAt: save.updated_at }, 409);
    }

    let next = state;
    let soldPrice: number | null = null;
    if (body.command.type === "buyItem") {
      const result = buyItem(state, body.command.itemId);
      if (result.error) return json({ error: result.error }, 400);
      next = result.state;
    } else if (body.command.type === "sellItem") {
      const result = sellItem(state, body.command.itemId);
      if (result.error) return json({ error: result.error }, 400);
      next = result.state;
      soldPrice = result.soldPrice ?? null;
    } else if (body.command.type === "equipItem") {
      next = equipItem(state, body.command.itemId);
      if (next === state) return json({ error: "Item cannot be equipped" }, 400);
    } else if (body.command.type === "unequipItem") {
      next = unequipItem(state, body.command.slot);
      if (next === state) return json({ error: "Item cannot be unequipped" }, 400);
    } else if (body.command.type === "buyPet") {
      const result = buyPet(state, body.command.petId);
      if (result.error) return json({ error: result.error }, 400);
      next = result.state;
    } else if (body.command.type === "setPet") {
      next = setPet(state, body.command.petId);
      if (next === state && body.command.petId !== null) return json({ error: "Pet cannot be activated" }, 400);
    } else if (body.command.type === "createHero") {
      next = createHeroState(body.command.name, body.command.className);
      next.characterStyle = { ...next.characterStyle, gender: body.command.gender, appearance: body.command.appearance };
      const firstSword = createItemInstance(STARTER_ITEMS[0], "starter");
      const starterBoots = STARTER_ITEMS.find((item) => item.id === "boots1");
      if (!starterBoots) return json({ error: "Starter equipment configuration is incomplete" }, 500);
      const firstBoots = createItemInstance(starterBoots, "starter");
      next.equipped[firstSword.slot] = firstSword;
      next.inventory.push(firstBoots);
    } else if (body.command.type === "allocateStatPoint") {
      const result = allocateStatPoint(state, body.command.key);
      if (result.error) return json({ error: result.error }, 400);
      next = result.state;
    } else if (body.command.type === "beginExpedition") {
      const result = beginOrQueueExpedition(state, body.command.planId, Date.now());
      if (result.error) return json({ error: result.error }, 400);
      next = result.state;
    } else if (body.command.type === "advanceExpeditions") {
      const result = advanceExpeditions(state, Date.now());
      if (result.state === state) return json({ state, updatedAt: save.updated_at, replayed: false, reports: [] });
      next = result.state;
    } else if (body.command.type === "claimQuest") {
      next = claimQuest(state, body.command.questId);
      if (next === state) return json({ error: "Quest reward is not available" }, 400);
    } else if (body.command.type === "claimExpeditionTask") {
      next = claimExpeditionTask(state, body.command.taskId);
      if (next === state) return json({ error: "Expedition task is not available" }, 400);
    } else if (body.command.type === "claimExplorationAchievement") {
      next = claimExplorationAchievement(state, body.command.achievementId);
      if (next === state) return json({ error: "Achievement reward is not available" }, 400);
    } else if (body.command.type === "claimRecurringMission") {
      next = claimRecurringMission(state, body.command.scope, body.command.missionId, Date.now());
      if (next === state) return json({ error: "Recurring mission reward is not available" }, 400);
    } else if (body.command.type === "dismissReport") {
      next = dismissOfflineReport(state, body.command.id);
      if (next === state) return json({ error: "Report not found" }, 404);
    } else if (body.command.type === "updateSettings") {
      next = { ...state, settings: { ...state.settings, ...body.command.settings } };
    } else if (body.command.type === "setProfileAvatar") {
      next = { ...state, profileAvatarId: body.command.avatarId };
    } else {
      next = { ...state, characterStyle: body.command.style };
    }

    // The privileged RPC is called only with the service-role key after the
    // caller has been authenticated and their save has been scoped above.
    const result = {
      commandId: body.commandId,
      commandType: body.command.type,
      state: next,
      soldPrice,
    };
    const { data: commit, error: commitError } = await adminClient.rpc("commit_player_command", {
      p_user_id: userData.user.id,
      p_command_id: body.commandId,
      p_expected_updated_at: save.updated_at,
      p_game_state: next,
      p_result: result,
    });

    if (commitError) {
      if (commitError.code === "P0002") return json({ error: "Player save not found" }, 404);
      if (commitError.code === "42501") return json({ error: "Unauthorized" }, 401);
      if (commitError.code === "22023") return json({ error: "Invalid command payload" }, 400);
      return json({ error: "Could not commit command" }, 500);
    }
    if (!isRecord(commit)) return json({ error: "Invalid command response" }, 500);
    if (commit.conflict === true) return json({ error: "Save changed; reload and retry", updatedAt: commit.updatedAt }, 409);
    if (!isRecord(commit.result) || !("state" in commit.result)) return json({ error: "Invalid command receipt" }, 500);

    return json({
      state: commit.result.state,
      soldPrice: typeof commit.result.soldPrice === "number" ? commit.result.soldPrice : null,
      updatedAt: commit.updatedAt,
      replayed: commit.replayed === true,
    });
  };
}

if (import.meta.main) {
  Deno.serve(createEconomyCommandHandler());
}
