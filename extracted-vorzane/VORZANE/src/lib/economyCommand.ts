import type { ClassId, GameState } from "../game/model";

export type EconomyCommand =
  | { type: "resetSave" }
  | { type: "updateSettings"; settings: Partial<GameState["settings"]> }
  | { type: "setProfileAvatar"; avatarId: ClassId | "brand" };

export type EconomyCommandPayload = {
  commandId: string;
  expectedUpdatedAt: string;
  command: EconomyCommand;
};

export type EconomyCommandResponse = {
  state: unknown;
  updatedAt: string;
  replayed: boolean;
};

type InvokeResult = {
  data: unknown;
  error: { message: string } | null;
};

type InvokeEconomyCommand = (body: EconomyCommandPayload) => Promise<InvokeResult>;

const SETTING_KEYS = ["sfx", "musicEnabled", "volume", "musicVolume"] as const;
const AVATAR_IDS = ["brand", "Warrior", "Mage", "Assassin", "Archer"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function hasValidSaveVersion(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

function validateSettings(settings: Partial<GameState["settings"]>): boolean {
  if (!isRecord(settings)) return false;
  const keys = Object.keys(settings);
  if (keys.length === 0 || keys.some((key) => !SETTING_KEYS.includes(key as typeof SETTING_KEYS[number]))) return false;

  return keys.every((key) => {
    const value = settings[key as keyof typeof settings];
    if (key === "sfx" || key === "musicEnabled") return typeof value === "boolean";
    return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;
  });
}

function validateResponse(data: unknown): EconomyCommandResponse | null {
  if (!isRecord(data) || !("state" in data) ||
      typeof data.updatedAt !== "string" || !hasValidSaveVersion(data.updatedAt) ||
      typeof data.replayed !== "boolean") return null;

  return { state: data.state, updatedAt: data.updatedAt, replayed: data.replayed };
}

export function createCommandId(): string {
  const cryptoApi = globalThis.crypto;
  if (typeof cryptoApi?.randomUUID === "function") return cryptoApi.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (token) => {
    const random = Math.floor(Math.random() * 16);
    return (token === "x" ? random : (random & 0x3) | 0x8).toString(16);
  });
}

async function invokeValidatedCommand(
  invoke: InvokeEconomyCommand,
  expectedUpdatedAt: string,
  command: EconomyCommand,
  invalidResponseMessage: string,
  commandId = createCommandId(),
): Promise<{ data: EconomyCommandResponse | null; error: Error | null }> {
  if (!hasValidSaveVersion(expectedUpdatedAt)) {
    return { data: null, error: new Error("A valid save version is required before updating the save.") };
  }

  const { data, error } = await invoke({ commandId, expectedUpdatedAt, command });
  if (error) return { data: null, error: new Error(error.message) };

  const response = validateResponse(data);
  if (!response) return { data: null, error: new Error(invalidResponseMessage) };
  return { data: response, error: null };
}

export function invokeResetSave(
  invoke: InvokeEconomyCommand,
  expectedUpdatedAt: string,
  commandId = createCommandId(),
): Promise<{ data: EconomyCommandResponse | null; error: Error | null }> {
  return invokeValidatedCommand(
    invoke,
    expectedUpdatedAt,
    { type: "resetSave" },
    "The server returned an invalid save-reset response.",
    commandId,
  );
}

export function invokeSettingsUpdate(
  invoke: InvokeEconomyCommand,
  expectedUpdatedAt: string,
  settings: Partial<GameState["settings"]>,
  commandId = createCommandId(),
): Promise<{ data: EconomyCommandResponse | null; error: Error | null }> {
  if (!validateSettings(settings)) {
    return Promise.resolve({ data: null, error: new Error("Settings contain invalid or unsupported values.") });
  }

  return invokeValidatedCommand(
    invoke,
    expectedUpdatedAt,
    { type: "updateSettings", settings },
    "The server returned an invalid settings-update response.",
    commandId,
  );
}

export function invokeProfileAvatarUpdate(
  invoke: InvokeEconomyCommand,
  expectedUpdatedAt: string,
  avatarId: ClassId | "brand",
  commandId = createCommandId(),
): Promise<{ data: EconomyCommandResponse | null; error: Error | null }> {
  if (!AVATAR_IDS.includes(avatarId as typeof AVATAR_IDS[number])) {
    return Promise.resolve({ data: null, error: new Error("Unsupported profile avatar.") });
  }

  return invokeValidatedCommand(
    invoke,
    expectedUpdatedAt,
    { type: "setProfileAvatar", avatarId },
    "The server returned an invalid profile-avatar response.",
    commandId,
  );
}
