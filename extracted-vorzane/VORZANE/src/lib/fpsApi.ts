import type { GameState } from "../game/model";

export const FPS_API_URL = (process.env.EXPO_PUBLIC_GAME_API_URL ?? "").replace(/\/$/, "");
export const fpsEnabled = Boolean(FPS_API_URL);
export type FpsUser = { id: string; email: string | null; isAnonymous: boolean; role: string };
export type GameCommand =
  | { type: "createHero"; name: string; className: string }
  | { type: "startBattle"; mode: string }
  | { type: "claimQuest"; questId: string }
  | { type: "buyItem" | "sellItem" | "equipItem"; itemId: string }
  | { type: "unequipItem"; slot: string }
  | { type: "buyPet"; petId: string }
  | { type: "setPet"; petId: string | null }
  | { type: "beginExpedition"; planId: string }
  | { type: "updateSettings"; settings: GameState["settings"] }
  | { type: "setProfileAvatar"; avatarId: string }
  | { type: "dismissReport"; id: string }
  | { type: "importSave"; state: GameState }
  | { type: "resetSave" };
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!FPS_API_URL) throw new Error("واجهة الخادم غير مهيأة.");
  const response = await fetch(`${FPS_API_URL}${path}`, { ...init, credentials: "include", headers: { "Content-Type": "application/json", ...init.headers } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error ?? `تعذر الاتصال بالخادم (${response.status}).`);
  return payload as T;
}
export const fpsGet = <T,>(path: string) => request<T>(path, { method: "GET" });
export const fpsPost = <T,>(path: string, body?: unknown) => request<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
export const fpsCommand = (command: GameCommand) => request<{ state: GameState; battle?: unknown; message?: string }>("/api/v1/game/command", { method: "POST", headers: { "Idempotency-Key": `${Date.now()}-${Math.random().toString(36).slice(2)}` }, body: JSON.stringify(command) });
