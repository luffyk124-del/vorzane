import { createHeroState, buyItem } from "../../../src/game/engine.ts";
import { createFreshState, type GameState } from "../../../src/game/model.ts";
import { createEconomyCommandHandler } from "./index.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  return await response.json() as Record<string, unknown>;
}

function fixture(options: {
  state?: GameState;
  user?: { id: string } | null;
  authError?: unknown;
  readError?: unknown;
  commit?: Record<string, unknown>;
  receipt?: { result: Record<string, unknown> } | null;
  commitError?: { code?: string } | null;
} = {}) {
  const state = options.state ?? createHeroState("Test", "Warrior");
  const calls: Record<string, unknown> = {};
  const builder = {
    select(columns: string) {
      const columnsByTable = (calls.columnsByTable ??= {}) as Record<string, string>;
      columnsByTable[String(calls.table)] = columns;
      return this;
    },
    eq(column: string, value: string) {
      const filters = (calls.filters ??= {}) as Record<string, unknown[]>;
      (filters[String(calls.table)] ??= []).push([column, value]);
      return this;
    },
    async maybeSingle() {
      if (calls.table === "player_command_receipts") {
        return { data: options.receipt ?? null, error: null };
      }
      return {
        data: options.readError ? null : { game_state: state, updated_at: "2026-11-08T20:00:00.000Z" },
        error: options.readError ?? null,
      };
    },
  };
  const fakeClient = {
    auth: { async getUser() {
      return { data: { user: options.user === undefined ? { id: "user-a" } : options.user }, error: options.authError ?? null };
    } },
    from(table: string) {
      calls.table = table;
      ((calls.tables ??= []) as string[]).push(table);
      return builder;
    },
    async rpc(name: string, args: Record<string, unknown>) {
      calls.rpc = name;
      calls.args = args;
      return {
        data: options.commit ?? { replayed: false, result: args.p_result, updatedAt: "2026-11-08T20:01:00.000Z" },
        error: options.commitError ?? null,
      };
    },
  };
  const factory = ((url: string, key: string, config: unknown) => {
    calls.url = url;
    ((calls.keys ??= []) as string[]).push(key);
    calls.config = config;
    return fakeClient;
  }) as unknown as Parameters<typeof createEconomyCommandHandler>[0];
  const handler = createEconomyCommandHandler(factory, (name) => ({
    SUPABASE_URL: "https://test.supabase.co",
    SUPABASE_ANON_KEY: "test-anon-key",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
  }[name]));
  return { handler, calls, state };
}

function commandRequest(command: unknown, overrides: Record<string, unknown> = {}) {
  return new Request("https://local.test/economy-command", {
    method: "POST",
    headers: { Authorization: "Bearer valid", "Content-Type": "application/json" },
    body: JSON.stringify({
      commandId: "10000000-0000-4000-8000-000000000001",
      expectedUpdatedAt: "2026-11-08T20:00:00.000Z",
      command,
      ...overrides,
    }),
  });
}

Deno.test("OPTIONS does not contact Supabase", async () => {
  const { handler, calls } = fixture();
  const response = await handler(new Request("https://local.test/economy-command", { method: "OPTIONS" }));
  assert(response.status === 200, "expected 200");
  assert(Object.keys(calls).length === 0, "preflight must not contact Supabase");
});

Deno.test("non-POST requests are rejected", async () => {
  const { handler, calls } = fixture();
  const response = await handler(new Request("https://local.test/economy-command", { method: "GET" }));
  assert(response.status === 405, "expected 405");
  assert(Object.keys(calls).length === 0, "unsupported method must not contact Supabase");
});

Deno.test("missing bearer token is rejected", async () => {
  const { handler, calls } = fixture();
  const response = await handler(new Request("https://local.test/economy-command", { method: "POST" }));
  assert(response.status === 401, "expected 401");
  assert(Object.keys(calls).length === 0, "unauthenticated request must not contact Supabase");
});

Deno.test("malformed command is rejected before reading or committing", async () => {
  const { handler, calls } = fixture();
  const response = await handler(commandRequest({ type: "buyItem", itemId: "" }));
  assert(response.status === 400, "expected 400");
  assert(calls.table === undefined && calls.rpc === undefined, "invalid command must not touch save or RPC");
});

Deno.test("buyItem uses canonical game rules and commits the caller's save", async () => {
  const state = createHeroState("Test", "Warrior");
  state.gold = 1_000;
  const { handler, calls } = fixture({ state });
  const response = await handler(commandRequest({ type: "buyItem", itemId: "sword1" }));
  const body = await readJson(response);
  assert(response.status === 200, "expected 200");
  assert((calls.tables as string[]).includes("player_saves"), "expected player save read");
  const filters = calls.filters as Record<string, unknown[]>;
  assert(JSON.stringify(filters.player_saves) === JSON.stringify([["user_id", "user-a"]]), "save read must be scoped to caller");
  assert(calls.rpc === "commit_player_command", "expected atomic command commit");
  assert((calls.keys as string[]).includes("test-service-role-key"), "privileged RPC must use the server-only service role");
  const args = calls.args as Record<string, unknown>;
  const saved = args.p_game_state as ReturnType<typeof createHeroState>;
  assert(saved.gold === 900, "canonical purchase price must be deducted");
  assert(saved.inventory.length === 1, "purchased item must be added");
  assert(body.replayed === false, "expected first execution");
});

Deno.test("insufficient gold is rejected without a database commit", async () => {
  const state = createHeroState("Test", "Warrior");
  state.gold = 0;
  const { handler, calls } = fixture({ state });
  const response = await handler(commandRequest({ type: "buyItem", itemId: "sword1" }));
  assert(response.status === 400, "expected 400");
  assert(calls.rpc === undefined, "invalid purchase must not be committed");
});

Deno.test("stale save version is returned as a conflict", async () => {
  const { handler } = fixture({ commit: { conflict: true, updatedAt: "2026-11-08T20:02:00.000Z" } });
  const response = await handler(commandRequest({ type: "buyItem", itemId: "sword1" }));
  const body = await readJson(response);
  assert(response.status === 409, "expected 409");
  assert(body.updatedAt === "2026-11-08T20:02:00.000Z", "expected current version in conflict response");
});


Deno.test("replayed commands return current save without reapplying game rules", async () => {
  const current = createHeroState("Test", "Warrior");
  current.gold = 950;
  const { handler, calls } = fixture({
    state: current,
    receipt: { result: { state: { gold: 900 }, soldPrice: 50 } },
  });
  const response = await handler(commandRequest(
    { type: "sellItem", itemId: "already-sold-item" },
    { expectedUpdatedAt: "2026-11-08T19:59:00.000Z" },
  ));
  const body = await readJson(response);
  assert(response.status === 200, "replayed command must succeed");
  assert(body.replayed === true, "expected replay response");
  assert(body.soldPrice === 50, "expected original sale result");
  assert((body.state as ReturnType<typeof createHeroState>).gold === 950, "replay must return current save, not overwrite it with old state");
  assert(calls.rpc === undefined, "replay must not execute the command again");
});

Deno.test("stale client version is rejected before invoking the privileged RPC", async () => {
  const { handler, calls } = fixture();
  const response = await handler(commandRequest(
    { type: "buyItem", itemId: "sword1" },
    { expectedUpdatedAt: "2026-11-08T19:59:00.000Z" },
  ));
  assert(response.status === 409, "expected 409");
  assert(calls.rpc === undefined, "stale client must not invoke the RPC");
});

Deno.test("sellItem credits the canonical catalog sell price", async () => {
  const initial = createHeroState("Test", "Warrior");
  initial.gold = 1_000;
  const bought = buyItem(initial, "sword1");
  const state = bought.state;
  const itemId = state.inventory[0]!.id;
  const { handler, calls } = fixture({ state });
  const response = await handler(commandRequest({ type: "sellItem", itemId }));
  const body = await readJson(response);
  assert(response.status === 200, "expected 200");
  assert(body.soldPrice === 50, "expected half of the canonical 100 gold price");
  const args = calls.args as Record<string, unknown>;
  const saved = args.p_game_state as ReturnType<typeof createHeroState>;
  assert(saved.gold === 950, "expected sale proceeds to be credited");
  assert(saved.inventory.length === 0, "sold item must be removed");
});

Deno.test("equipItem and unequipItem use canonical equipment ownership", async () => {
  const initial = createHeroState("Test", "Warrior");
  const bought = buyItem(initial, "sword1");
  const itemId = bought.state.inventory[0]!.id;
  const equipped = fixture({ state: bought.state });
  const equipResponse = await equipped.handler(commandRequest({ type: "equipItem", itemId }));
  assert(equipResponse.status === 200, "expected equipment command to succeed");
  const equippedState = (equipped.calls.args as Record<string, unknown>).p_game_state as ReturnType<typeof createHeroState>;
  assert(equippedState.equipped["سلاح"]?.id === itemId, "item must be equipped in its canonical slot");

  const unequipFixture = fixture({ state: equippedState });
  const unequipResponse = await unequipFixture.handler(commandRequest({ type: "unequipItem", slot: "سلاح" }));
  assert(unequipResponse.status === 200, "expected unequip command to succeed");
  const unequippedState = (unequipFixture.calls.args as Record<string, unknown>).p_game_state as ReturnType<typeof createHeroState>;
  assert(unequippedState.inventory.some(item => item.id === itemId), "unequipped item must return to inventory");
  assert(!unequippedState.equipped["سلاح"], "equipment slot must be empty");
});


Deno.test("buyPet uses canonical price, ownership, and activation rules", async () => {
  const state = createHeroState("Test", "Warrior");
  state.gold = 500;
  const { handler, calls } = fixture({ state });
  const response = await handler(commandRequest({ type: "buyPet", petId: "wolf" }));
  assert(response.status === 200, "expected 200");
  const saved = (calls.args as Record<string, unknown>).p_game_state as ReturnType<typeof createHeroState>;
  assert(saved.gold === 200, "wolf price must be deducted from canonical catalog");
  assert(saved.pets.includes("wolf"), "purchased pet must be owned");
  assert(saved.activePet === "wolf", "eligible first pet should become active");
});

Deno.test("setPet requires ownership and canonical level eligibility", async () => {
  const state = createHeroState("Test", "Warrior");
  state.pets = ["wolf", "golem"];
  const { handler, calls } = fixture({ state });
  const response = await handler(commandRequest({ type: "setPet", petId: "wolf" }));
  assert(response.status === 200, "owned eligible pet should activate");
  const saved = (calls.args as Record<string, unknown>).p_game_state as ReturnType<typeof createHeroState>;
  assert(saved.activePet === "wolf", "selected pet should become active");

  const lockedState = createHeroState("Test", "Warrior");
  lockedState.pets = ["golem"];
  const locked = await fixture({ state: lockedState }).handler(commandRequest({ type: "setPet", petId: "golem" }));
  assert(locked.status === 400, "pet above hero level must not activate");
});


Deno.test("createHero is server-generated from the canonical class and starter loadout", async () => {
  const { handler, calls } = fixture({ state: createFreshState() });
  const response = await handler(commandRequest({ type: "createHero", name: "Hero", className: "Warrior", gender: "female", appearance: 2 }));
  assert(response.status === 200, "expected 200");
  const saved = (calls.args as Record<string, unknown>).p_game_state as GameState;
  assert(saved.hero?.name === "Hero" && saved.hero.className === "Warrior", "hero identity must be canonical");
  assert(saved.characterStyle.gender === "female" && saved.characterStyle.appearance === 2, "approved appearance must be applied");
  assert(saved.equipped["سلاح"]?.catalogId === "sword1", "starter sword must be generated by server");
  assert(saved.inventory.some((item) => item.catalogId === "boots1"), "starter boots must be generated by server");
});

Deno.test("allocateStatPoint spends one server-validated point", async () => {
  const state = createHeroState("Test", "Warrior");
  state.hero!.statPoints = 1;
  const { handler, calls } = fixture({ state });
  const response = await handler(commandRequest({ type: "allocateStatPoint", key: "str" }));
  assert(response.status === 200, "expected 200");
  const saved = (calls.args as Record<string, unknown>).p_game_state as GameState;
  assert(saved.hero!.stats.str === state.hero!.stats.str + 1, "strength must increase by one");
  assert(saved.hero!.statPoints === 0, "stat point must be consumed");
});

Deno.test("beginExpedition enforces canonical level and queue rules", async () => {
  const { handler, calls } = fixture();
  const response = await handler(commandRequest({ type: "beginExpedition", planId: "ashen-pass" }));
  assert(response.status === 200, "level-one hero should start the first expedition");
  const saved = (calls.args as Record<string, unknown>).p_game_state as GameState;
  assert(saved.activeExpedition?.planId === "ashen-pass", "server should create the active expedition");
});

Deno.test("recurring mission reward is validated and claimed once", async () => {
  const state = createHeroState("Test", "Warrior");
  state.wins = 2;
  const { handler, calls } = fixture({ state });
  const response = await handler(commandRequest({ type: "claimRecurringMission", scope: "daily", missionId: "daily-wins" }));
  assert(response.status === 200, "completed daily mission should be claimable");
  const saved = (calls.args as Record<string, unknown>).p_game_state as GameState;
  assert(saved.gold === state.gold + 120, "server should grant canonical daily reward");
  assert(saved.missionPeriods.daily.claimed["daily-wins"] === true, "mission receipt must be marked claimed");
});

Deno.test("settings command rejects out-of-range volume before touching save", async () => {
  const { handler, calls } = fixture();
  const response = await handler(commandRequest({ type: "updateSettings", settings: { volume: 101 } }));
  assert(response.status === 400, "out-of-range volume must be rejected");
  assert(calls.table === undefined && calls.rpc === undefined, "invalid settings must not read or commit state");
});

Deno.test("profile appearance command rejects unsupported style values", async () => {
  const { handler, calls } = fixture();
  const response = await handler(commandRequest({ type: "updateCharacterStyle", style: { gender: "unknown" } }));
  assert(response.status === 400, "unsupported style must be rejected");
  assert(calls.table === undefined && calls.rpc === undefined, "invalid style must not touch save");
});

Deno.test("another unauthenticated identity cannot invoke commands", async () => {
  const { handler } = fixture({ user: null, authError: new Error("invalid token") });
  const response = await handler(commandRequest({ type: "buyItem", itemId: "sword1" }));
  assert(response.status === 401, "expected 401");
});
