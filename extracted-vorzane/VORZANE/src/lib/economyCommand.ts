export type EconomyCommandPayload = {
  commandId: string;
  expectedUpdatedAt: string;
  command: { type: "resetSave" };
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function createCommandId(): string {
  const cryptoApi = globalThis.crypto;
  if (typeof cryptoApi?.randomUUID === "function") return cryptoApi.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (token) => {
    const random = Math.floor(Math.random() * 16);
    return (token === "x" ? random : (random & 0x3) | 0x8).toString(16);
  });
}

export async function invokeResetSave(
  invoke: InvokeEconomyCommand,
  expectedUpdatedAt: string,
  commandId = createCommandId(),
): Promise<{ data: EconomyCommandResponse | null; error: Error | null }> {
  if (!Number.isFinite(Date.parse(expectedUpdatedAt))) {
    return { data: null, error: new Error("A valid save version is required before reset.") };
  }

  const { data, error } = await invoke({
    commandId,
    expectedUpdatedAt,
    command: { type: "resetSave" },
  });

  if (error) return { data: null, error: new Error(error.message) };
  if (!isRecord(data) || !("state" in data) ||
      typeof data.updatedAt !== "string" || !Number.isFinite(Date.parse(data.updatedAt)) ||
      typeof data.replayed !== "boolean") {
    return { data: null, error: new Error("The server returned an invalid save-reset response.") };
  }

  return {
    data: {
      state: data.state,
      updatedAt: data.updatedAt,
      replayed: data.replayed,
    },
    error: null,
  };
}
