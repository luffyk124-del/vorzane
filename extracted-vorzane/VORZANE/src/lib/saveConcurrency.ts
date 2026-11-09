export type SaveSnapshotRecord = {
  user_id: string;
  game_state: unknown;
  updated_at: string;
};

export type SaveWriteDbResult = {
  data: { updated_at?: unknown } | null;
  error: { code?: string; message?: string } | null;
};

export type SaveWriteAdapter = {
  insert: (record: SaveSnapshotRecord) => Promise<SaveWriteDbResult>;
  update: (record: SaveSnapshotRecord, expectedUpdatedAt: string) => Promise<SaveWriteDbResult>;
};

export type SaveWriteOutcome =
  | { kind: "saved"; updatedAt: string }
  | { kind: "conflict" }
  | { kind: "failed"; error: Error };

export function isValidSaveVersion(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && Number.isFinite(Date.parse(value));
}

/**
 * Persist a whole snapshot only if the cloud row is still at the version that
 * was read by this client. A missing expected version means INSERT-only; it
 * never falls back to an upsert.
 */
export async function writeSaveConditionally(
  adapter: SaveWriteAdapter,
  record: SaveSnapshotRecord,
  expectedUpdatedAt: string | null,
): Promise<SaveWriteOutcome> {
  if (!isValidSaveVersion(record.updated_at)) {
    return { kind: "failed", error: new Error("A valid new save version is required.") };
  }
  if (expectedUpdatedAt !== null && !isValidSaveVersion(expectedUpdatedAt)) {
    return { kind: "failed", error: new Error("The current cloud save version is invalid; reload before saving.") };
  }

  let result: SaveWriteDbResult;
  try {
    result = expectedUpdatedAt === null
      ? await adapter.insert(record)
      : await adapter.update(record, expectedUpdatedAt);
  } catch (caught) {
    return {
      kind: "failed",
      error: caught instanceof Error ? caught : new Error("Cloud save request failed."),
    };
  }

  if (result.error) {
    if (expectedUpdatedAt === null && result.error.code === "23505") {
      return { kind: "conflict" };
    }
    return { kind: "failed", error: new Error(result.error.message || "Cloud save request failed.") };
  }

  if (!result.data) return { kind: "conflict" };

  const updatedAt = result.data.updated_at;
  if (!isValidSaveVersion(updatedAt)) {
    return { kind: "failed", error: new Error("The cloud save returned an invalid version.") };
  }

  return { kind: "saved", updatedAt };
}
