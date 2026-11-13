import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from "react";
import { advanceExpeditions, dismissOfflineReport } from "../game/engine";
import { createFreshState, LEGACY_CLAIM_KEY, LEGACY_SAVE_KEY, normalizeGameState, USER_SAVE_PREFIX, type GameState } from "../game/model";
import { supabase } from "../lib/supabase";
import { invokeEconomyCommand, type EconomyCommand } from "../lib/economyCommand";
import { clearOfflineSavePending, getOfflineSavePendingToken, hasOfflineSavePending, markOfflineSavePending, type StorageLike } from "../lib/offlineSaveMarker";
import { useAuth } from "./AuthContext";

const LEGACY_DECLINE_PREFIX = "vorzane_legacy_save_declined_";
type LoadStatus = "auth" | "loading" | "migration" | "conflict" | "ready" | "offline";
type MigrationChoice =
  | { kind: "legacy"; state: GameState }
  | { kind: "offline"; localState: GameState; cloudState: GameState }
  | null;
type Resolution = "import" | "fresh" | "local" | "cloud";

export type GameContextValue = {
  state: GameState;
  status: LoadStatus;
  saveStatus: string;
  cloudError: string;
  migration: MigrationChoice;
  update: (updater: (current: GameState) => GameState) => void;
  flushNow: () => Promise<boolean>;
  resolveMigration: (choice: Resolution) => Promise<boolean>;
  resetPlayerSave: () => Promise<boolean>;
  executeEconomyCommand: (command: EconomyCommand) => Promise<boolean>;
  clearReport: (id: string) => void;
  reloadCloud: () => Promise<void>;
};

const GameContext = createContext<GameContextValue | null>(null);
const cloneState = (value: GameState): GameState => JSON.parse(JSON.stringify(value)) as GameState;
const userKey = (userId: string) => `${USER_SAVE_PREFIX}${userId}`;

function offlineMarkerStorage(): StorageLike {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    try { return window.localStorage; } catch { /* Fall back to AsyncStorage. */ }
  }
  return AsyncStorage;
}

function localGet(key: string): string | null {
  try {
    if (Platform.OS === "web" && typeof window !== "undefined") return window.localStorage.getItem(key);
  } catch { /* Private browsing can disable storage. */ }
  return null;
}

function localSet(key: string, value: string) {
  try {
    if (Platform.OS === "web" && typeof window !== "undefined") window.localStorage.setItem(key, value);
  } catch { /* The authenticated cloud copy remains authoritative. */ }
}

function localRemove(key: string) {
  try { if (Platform.OS === "web" && typeof window !== "undefined") window.localStorage.removeItem(key); } catch { /* Best effort. */ }
}

async function readLegacyState(): Promise<GameState | null> {
  try {
    const raw = localGet(LEGACY_SAVE_KEY) ?? (Platform.OS !== "web" ? await AsyncStorage.getItem(LEGACY_SAVE_KEY) : null);
    return raw ? normalizeGameState(JSON.parse(raw)) : null;
  } catch { return null; }
}

async function readUserCache(userId: string): Promise<GameState | null> {
  try {
    const raw = await AsyncStorage.getItem(userKey(userId));
    return raw ? normalizeGameState(JSON.parse(raw)) : null;
  } catch { return null; }
}

async function storeUserCache(userId: string, state: GameState) {
  try { await AsyncStorage.setItem(userKey(userId), JSON.stringify(state)); } catch { /* Best effort device cache. */ }
}

async function readCloudSave(userId: string) {
  // Prefer the authenticated read-only Edge Function. Keep the existing RLS-scoped
  // query as a compatibility fallback until the function is deployed everywhere.
  const response = await supabase.functions.invoke<{ state: unknown; updatedAt: string | null }>("game-state", { method: "GET" });
  if (!response.error && response.data && Object.hasOwn(response.data, "state")) {
    return {
      data: response.data.state === null
        ? null
        : { game_state: response.data.state, updated_at: response.data.updatedAt },
      error: null,
    };
  }

  return await supabase
    .from("player_saves")
    .select("game_state, updated_at")
    .eq("user_id", userId)
    .maybeSingle();
}

export function GameProvider({ children }: PropsWithChildren) {
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<GameState>(() => createFreshState());
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [saveStatus, setSaveStatus] = useState("جارٍ التحقق من الحساب...");
  const [cloudError, setCloudError] = useState("");
  const [migration, setMigration] = useState<MigrationChoice>(null);
  const [clock, setClock] = useState(Date.now());
  const currentUserId = user?.id ?? null;
  const activeUserRef = useRef<string | null>(null);
  const syncReadyRef = useRef<string | null>(null);
  const generationRef = useRef(0);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveQueueRef = useRef<Promise<boolean>>(Promise.resolve(true));
  const skipNextEffectRef = useRef(false);
  const stateRef = useRef(state);
  const saveVersionRef = useRef<string | null>(null);

  const persistSnapshot = useCallback(async (snapshot: GameState, userId: string, allowPendingMigration = false): Promise<boolean> => {
    if (activeUserRef.current !== userId) return false;
    if (!allowPendingMigration && syncReadyRef.current !== userId) return false;
    const safeSnapshot = cloneState(snapshot);
    await storeUserCache(userId, safeSnapshot);
    saveQueueRef.current = saveQueueRef.current.catch(() => false).then(async () => {
      if (activeUserRef.current !== userId) return false;
      const markerToken = await getOfflineSavePendingToken(userId, offlineMarkerStorage());
      const { data: saved, error } = await supabase.from("player_saves").upsert({
        user_id: userId,
        game_state: safeSnapshot,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" }).select("updated_at").single();
      if (error) throw error;
      if (activeUserRef.current === userId) saveVersionRef.current = saved.updated_at;
      await clearOfflineSavePending(userId, offlineMarkerStorage(), markerToken);
      setCloudError("");
      setSaveStatus("تم حفظ تقدمك بأمان");
      return true;
    }).catch(async (caught: unknown) => {
      await markOfflineSavePending(userId, offlineMarkerStorage());
      const message = caught instanceof Error ? caught.message : "تعذر حفظ تقدمك الآن. سنحاول مجددًا عند عودة الاتصال.";
      setCloudError(message);
      setSaveStatus("تعذرت المزامنة؛ النسخة المحلية محفوظة");
      return false;
    });
    return await saveQueueRef.current;
  }, []);

  const loadForUser = useCallback(async (userId: string, generation: number) => {
    activeUserRef.current = userId;
    syncReadyRef.current = null;
    saveVersionRef.current = null;
    setStatus("loading");
    setCloudError("");
    setMigration(null);
    setSaveStatus("جارٍ تحميل تقدم اللاعب...");
    try {
      const cached = await readUserCache(userId);
      if (generation !== generationRef.current) return;
      const { data, error } = await readCloudSave(userId);
      if (generation !== generationRef.current) return;
      if (error) throw error;
      const remote = data ? normalizeGameState(data.game_state) : null;
      saveVersionRef.current = data?.updated_at ?? null;

      // A server-issued epoch means the cloud save was intentionally reset.
      // Never offer a pre-reset offline cache as a recovery option.
      const cloudResetEpoch = remote?.serverResetEpoch ?? null;
      const resetInvalidatedCache = !!cloudResetEpoch && cached?.serverResetEpoch !== cloudResetEpoch;
      if (resetInvalidatedCache) {
        try { await AsyncStorage.removeItem(userKey(userId)); } catch { /* Best effort; cloud reset remains authoritative. */ }
        await clearOfflineSavePending(userId, offlineMarkerStorage());
        // Retire the device-wide legacy save so no account can import it after a server reset.
        localSet(LEGACY_CLAIM_KEY, "__reset_invalidated__");
        localSet(`${LEGACY_DECLINE_PREFIX}${userId}`, "1");
      }
      const hasOfflineChanges = !resetInvalidatedCache && cached !== null
        && await hasOfflineSavePending(userId, offlineMarkerStorage());
      if (data && !remote) throw new Error("تعذر قراءة حفظ حسابك؛ لم نغيّر أي شيء.");

      if (remote) {
        const cloudProgress = advanceExpeditions(remote, Date.now());
        if (hasOfflineChanges && cached) {
          setMigration({ kind: "offline", localState: cached, cloudState: cloudProgress.state });
          stateRef.current = cached;
          setState(cached);
          setStatus("conflict");
          setSaveStatus("يوجد تقدم محلي غير متزامن؛ اختر النسخة التي تريد الاحتفاظ بها");
          return;
        }
        syncReadyRef.current = userId;
        skipNextEffectRef.current = true;
        setState(cloudProgress.state);
        stateRef.current = cloudProgress.state;
        await storeUserCache(userId, cloudProgress.state);
        setSaveStatus("تم استعادة تقدمك");
        setStatus("ready");
        if (cloudProgress.reports.length) await persistSnapshot(cloudProgress.state, userId);
        return;
      }

      if (cached) {
        const progressed = advanceExpeditions(cached, Date.now()).state;
        syncReadyRef.current = userId;
        skipNextEffectRef.current = true;
        setState(progressed);
        stateRef.current = progressed;
        setStatus("ready");
        setSaveStatus("استُعيدت النسخة المحلية؛ جارٍ مزامنتها");
        await persistSnapshot(progressed, userId);
        return;
      }

      const legacy = await readLegacyState();
      if (generation !== generationRef.current) return;
      const claimedBy = localGet(LEGACY_CLAIM_KEY);
      if (legacy && claimedBy === userId) {
        const progressed = advanceExpeditions(legacy, Date.now()).state;
        syncReadyRef.current = userId;
        skipNextEffectRef.current = true;
        setState(progressed);
        stateRef.current = progressed;
        setStatus("ready");
        setSaveStatus("تم استرجاع الحفظ المرتبط بهذا الحساب؛ جارٍ مزامنته");
        await persistSnapshot(progressed, userId);
        return;
      }

      const declined = localGet(`${LEGACY_DECLINE_PREFIX}${userId}`) === "1";
      if (legacy && !claimedBy && !declined) {
        setMigration({ kind: "legacy", state: legacy });
        setStatus("migration");
        setSaveStatus("وجدنا حفظًا محليًا؛ اختر إن كان يخصك قبل نقله");
        return;
      }

      // Prefer server-generated initialization for a genuinely new account.
      // If the function is not deployed yet, preserve the existing compatibility path.
      const initialized = await supabase.functions.invoke<{
        state: unknown;
        updatedAt: string | null;
        created: boolean;
      }>("initialize-save", { method: "POST", body: {} });
      if (!initialized.error && initialized.data && Object.hasOwn(initialized.data, "state")) {
        const serverState = normalizeGameState(initialized.data.state);
        if (!serverState) throw new Error("تعذر التحقق من الحفظ الجديد؛ لم نغيّر أي بيانات.");
        syncReadyRef.current = userId;
        skipNextEffectRef.current = true;
        stateRef.current = serverState;
        saveVersionRef.current = initialized.data.updatedAt;
        setState(serverState);
        await storeUserCache(userId, serverState);
        setStatus("ready");
        setSaveStatus(initialized.data.created ? "أُنشئ حفظك السحابي بأمان" : "تم استعادة تقدمك");
        return;
      }

      const fresh = createFreshState();
      syncReadyRef.current = userId;
      skipNextEffectRef.current = true;
      setState(fresh);
      stateRef.current = fresh;
      setStatus("ready");
      setSaveStatus("حساب جديد — ابدأ مغامرتك");
    } catch (caught) {
      if (generation !== generationRef.current) return;
      const message = caught instanceof Error ? caught.message : "تعذر الاتصال بالحفظ السحابي.";
      const cached = await readUserCache(userId);
      if (generation !== generationRef.current) return;
      const fallback = cached ?? createFreshState();
      setState(fallback);
      stateRef.current = fallback;
      syncReadyRef.current = null;
      saveVersionRef.current = null;
      setCloudError(message);
      setSaveStatus(cached ? "وضع محلي مؤقت — سيُعاد الاتصال لاحقًا" : "تعذر الاتصال — التقدم الجديد محلي فقط");
      setStatus("offline");
    }
  }, [persistSnapshot]);

  useEffect(() => {
    if (authLoading) return;
    const generation = ++generationRef.current;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (!currentUserId) {
      activeUserRef.current = null;
      syncReadyRef.current = null;
      saveVersionRef.current = null;
      setMigration(null);
      setCloudError("");
      const fresh = createFreshState();
      stateRef.current = fresh;
      setState(fresh);
      setStatus("auth");
      setSaveStatus("سجّل الدخول لحفظ تقدمك لكل لاعب");
      return;
    }
    void loadForUser(currentUserId, generation);
  }, [authLoading, currentUserId, loadForUser]);

  useEffect(() => {
    stateRef.current = state;
    if (!currentUserId) return;
    if (status === "offline" && activeUserRef.current === currentUserId) {
      void storeUserCache(currentUserId, state);
      void markOfflineSavePending(currentUserId, offlineMarkerStorage());
      setSaveStatus("تقدم غير متصل محفوظ على هذا الجهاز فقط");
      return;
    }
    if (status !== "ready" || syncReadyRef.current !== currentUserId) return;
    if (skipNextEffectRef.current) {
      skipNextEffectRef.current = false;
      return;
    }
    void markOfflineSavePending(currentUserId, offlineMarkerStorage());
    void storeUserCache(currentUserId, state);
    setSaveStatus("جارٍ مزامنة تقدمك...");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    const snapshot = cloneState(state);
    saveTimerRef.current = setTimeout(() => { void persistSnapshot(snapshot, currentUserId); }, 800);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [state, status, currentUserId, persistSnapshot]);

  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if ((status !== "ready" && status !== "offline") || !state.activeExpedition) return;
    const result = advanceExpeditions(state, clock);
    if (result.reports.length) setState(result.state);
  }, [clock, state.activeExpedition, status]);

  const update = useCallback((updater: (current: GameState) => GameState) => { setState((current) => updater(current)); }, []);

  const flushNow = useCallback(async () => {
    if (!currentUserId || syncReadyRef.current !== currentUserId) return false;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = null;
    return persistSnapshot(stateRef.current, currentUserId);
  }, [currentUserId, persistSnapshot]);

  const executeEconomyCommand = useCallback(async (command: EconomyCommand): Promise<boolean> => {
    const userId = currentUserId;
    if (!userId || status !== "ready" || syncReadyRef.current !== userId) return false;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = null;

    // Settings are a small server-owned change, but first flush unrelated
    // pending progress so the command starts from the latest save version.
    if (command.type === "updateSettings") {
      const flushed = await persistSnapshot(stateRef.current, userId);
      if (!flushed) return false;
    } else {
      await saveQueueRef.current.catch(() => false);
    }

    const expectedUpdatedAt = saveVersionRef.current;
    if (!expectedUpdatedAt) {
      setSaveStatus("تعذر تنفيذ الأمر قبل التحقق من إصدار الحفظ السحابي.");
      return false;
    }

    setSaveStatus("جارٍ تنفيذ الأمر بأمان...");
    const result = await invokeEconomyCommand(async (body) => {
      const response = await supabase.functions.invoke("economy-command", {
        method: "POST",
        body,
      });
      return {
        data: response.data,
        error: response.error ? { message: response.error.message } : null,
      };
    }, expectedUpdatedAt, command);

    if (activeUserRef.current !== userId || currentUserId !== userId) return false;

    if (result.error || !result.data) {
      const message = result.error?.message ?? "تعذر تنفيذ الأمر.";
      setCloudError(message);
      setSaveStatus("لم يكتمل الأمر؛ لم نغيّر تقدمك المحلي.");
      return false;
    }

    const serverState = normalizeGameState(result.data.state);
    if (!serverState) {
      setCloudError("أعاد الخادم حالة حفظ غير صالحة.");
      setSaveStatus("تعذر التحقق من نتيجة الأمر؛ لم نغيّر تقدمك المحلي.");
      return false;
    }

    // Settings do not replace unrelated in-memory progress. Reset intentionally
    // replaces the save with the server-generated fresh state.
    const nextState = command.type === "updateSettings"
      ? { ...stateRef.current, settings: serverState.settings }
      : serverState;

    saveVersionRef.current = result.data.updatedAt;
    skipNextEffectRef.current = true;
    stateRef.current = nextState;
    setState(nextState);
    await storeUserCache(userId, nextState);
    await clearOfflineSavePending(userId, offlineMarkerStorage());
    setCloudError("");
    setSaveStatus(result.data.replayed ? "تم تأكيد الأمر السابق دون تكراره." : "تم تنفيذ الأمر وحفظه سحابياً.");
    return true;
  }, [currentUserId, status, persistSnapshot]);

  const resolveMigration = useCallback(async (choice: Resolution) => {
    if (!currentUserId || !migration) return false;
    const userId = currentUserId;
    if (migration.kind === "offline") {
      if (status !== "conflict" || (choice !== "local" && choice !== "cloud")) return false;
      const candidate = choice === "local" ? migration.localState : migration.cloudState;
      setSaveStatus(choice === "local" ? "جارٍ حفظ تقدم هذا الجهاز..." : "جارٍ استعادة تقدم حسابك...");
      const saved = await persistSnapshot(candidate, userId, true);
      if (!saved) {
        setSaveStatus("لم تكتمل المزامنة؛ لم تُحذف أي نسخة. حاول مجددًا.");
        return false;
      }
      syncReadyRef.current = userId;
      skipNextEffectRef.current = true;
      stateRef.current = candidate;
      setState(candidate);
      setMigration(null);
      setStatus("ready");
      setSaveStatus(choice === "local" ? "حُفظ تقدم هذا الجهاز في حسابك" : "استُعيدت النسخة السحابية");
      return true;
    }

    if (status !== "migration" || (choice !== "import" && choice !== "fresh")) return false;
    const candidate = choice === "import" ? migration.state : createFreshState();
    setSaveStatus("جارٍ حفظ الاختيار في حسابك...");
    const saved = await persistSnapshot(candidate, userId, true);
    if (!saved) {
      setSaveStatus("لم يكتمل النقل؛ لم تُحذف النسخة المحلية. حاول مجددًا.");
      return false;
    }
    if (choice === "import") localSet(LEGACY_CLAIM_KEY, userId);
    else localSet(`${LEGACY_DECLINE_PREFIX}${userId}`, "1");
    syncReadyRef.current = userId;
    skipNextEffectRef.current = true;
    stateRef.current = candidate;
    setState(candidate);
    setMigration(null);
    setStatus("ready");
    setSaveStatus(choice === "import" ? "نُقل تقدمك إلى هذا الحساب" : "بدأ حفظ جديد لهذا الحساب");
    return true;
  }, [currentUserId, migration, persistSnapshot, status]);

  const resetPlayerSave = useCallback(async () => {
    const userId = currentUserId;
    if (!userId || status !== "ready" || syncReadyRef.current !== userId) return false;
    const success = await executeEconomyCommand({ type: "resetSave" });
    if (!success) return false;

    try { await AsyncStorage.removeItem(userKey(userId)); } catch { /* Canonical state is cached again below. */ }
    await storeUserCache(userId, stateRef.current);
    await clearOfflineSavePending(userId, offlineMarkerStorage());
    // Keep a tombstone rather than clearing the claim: another account on this device
    // must not be offered the previous account's legacy save after a reset.
    if (localGet(LEGACY_CLAIM_KEY) === userId) {
      localSet(LEGACY_CLAIM_KEY, "__reset_invalidated__");
      localSet(LEGACY_DECLINE_PREFIX + userId, "1");
    }
    setMigration(null);
    return true;
  }, [currentUserId, status, executeEconomyCommand]);

  const clearReport = useCallback((id: string) => { update((current) => dismissOfflineReport(current, id)); }, [update]);
  const reloadCloud = useCallback(async () => {
    if (!currentUserId) return;
    const generation = ++generationRef.current;
    await loadForUser(currentUserId, generation);
  }, [currentUserId, loadForUser]);

  const value = useMemo<GameContextValue>(() => ({ state, status, saveStatus, cloudError, migration, update, flushNow, resolveMigration, resetPlayerSave, executeEconomyCommand, clearReport, reloadCloud }), [state, status, saveStatus, cloudError, migration, update, flushNow, resolveMigration, resetPlayerSave, executeEconomyCommand, clearReport, reloadCloud]);
  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  const context = useContext(GameContext);
  if (!context) throw new Error("useGame must be used within GameProvider");
  return context;
}
