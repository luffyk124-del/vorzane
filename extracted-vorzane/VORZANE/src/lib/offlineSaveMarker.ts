export type StorageLike = {
  getItem: (key: string) => string | null | Promise<string | null>;
  setItem: (key: string, value: string) => void | Promise<void>;
  removeItem: (key: string) => void | Promise<void>;
};

const OFFLINE_DIRTY_PREFIX = "vorzane_offline_dirty_";
const markerQueues = new Map<string, Promise<unknown>>();

function browserStorage(): StorageLike | null {
  if (typeof window === "undefined") return null;
  try { return window.localStorage; } catch { return null; }
}

function enqueueMarkerOperation<Result>(userId: string, operation: () => Promise<Result>): Promise<Result> {
  const previous = markerQueues.get(userId) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(operation);
  markerQueues.set(userId, current);
  return current.finally(() => {
    if (markerQueues.get(userId) === current) markerQueues.delete(userId);
  });
}

export function markOfflineSavePending(userId: string, storage: StorageLike): Promise<string | null> {
  return enqueueMarkerOperation(userId, async () => {
    const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    try {
      await storage.setItem(`${OFFLINE_DIRTY_PREFIX}${userId}`, token);
      return token;
    } catch { return null; }
  });
}

export function getOfflineSavePendingToken(userId: string, storage: StorageLike): Promise<string | null> {
  return enqueueMarkerOperation(userId, async () => {
    try { return await storage.getItem(`${OFFLINE_DIRTY_PREFIX}${userId}`); } catch { return null; }
  });
}

export async function hasOfflineSavePending(userId: string, storage: StorageLike): Promise<boolean> {
  return (await getOfflineSavePendingToken(userId, storage)) !== null;
}

export function clearOfflineSavePending(userId: string, storage: StorageLike, expectedToken?: string | null): Promise<void> {
  return enqueueMarkerOperation(userId, async () => {
    const key = `${OFFLINE_DIRTY_PREFIX}${userId}`;
    try {
      if (expectedToken !== undefined && await storage.getItem(key) !== expectedToken) return;
      await storage.removeItem(key);
    } catch { /* Local storage is best effort. */ }
  });
}