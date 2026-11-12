import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { after, before, test } from "node:test";
import { chromium } from "playwright";

const projectRoot = new URL("../", import.meta.url).pathname;
const appUrl = "http://127.0.0.1:8081";
const supabaseUrl = "https://incidgigfqyjbqfegukg.supabase.co";
const playerId = "e2e-player-0001";
let serverProcess;
let browser;
let serverOutput = "";

function saveFixture() {
  return {
    hero: {
      name: "بطل الاختبار",
      className: "Warrior",
      level: 2,
      exp: 0,
      statPoints: 2,
      stats: { str: 13, def: 12, vit: 12, agi: 8, luck: 5 },
      baseStats: { str: 13, def: 12, vit: 12, agi: 8, luck: 5 },
    },
    profileAvatarId: "Warrior",
    gold: 500,
    gems: 50,
    inventory: [],
    equipped: {},
    pets: [],
    activePet: null,
    tower: 0,
    story: 0,
    dungeonFloor: 1,
    battleWinsByMode: { cave: 0, dungeon: 0, tower: 0, hard: 0 },
    battles: 0,
    wins: 0,
    expeditionsCompleted: 0,
    quests: { first: false, battles: false, level: true },
    achievements: { first: false, level: false, wins: false },
    claimedQuestRewards: {},
    activeExpedition: null,
    expeditionQueue: [],
    offlineSummary: [],
    lastSeenAt: Date.now(),
    settings: { sfx: true, volume: 20, musicEnabled: false, musicVolume: 24 },
  };
}

function newPlayerFixture() {
  const state = saveFixture();
  state.hero = null;
  state.characterStyle = { gender: "male", appearance: 0, hairstyle: "short", hairColor: "obsidian", face: "classic", outfit: "adventurer", body: "balanced" };
  state.missionPeriods = {
    daily: { key: new Date().toISOString().slice(0, 10), baseline: { wins: 0, expeditions: 0, level: 1 }, claimed: {} },
    weekly: { key: "test-week", baseline: { wins: 0, expeditions: 0, level: 1 }, claimed: {} },
    season: { key: new Date().toISOString().slice(0, 7), baseline: { wins: 0, expeditions: 0, level: 1 }, claimed: {} },
  };
  state.quests = { first: false, battles: false, level: false };
  state.settings.musicEnabled = true;
  return state;
}

function mockSession() {
  const user = {
    id: playerId,
    aud: "authenticated",
    role: "authenticated",
    email: "player@example.test",
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: {},
    identities: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    is_anonymous: false,
  };
  const payload = Buffer.from(JSON.stringify({ sub: playerId, aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
  return {
    access_token: `eyJhbGciOiJub25lIn0.${payload}.mock-signature`,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: "mock-refresh-token",
    user,
  };
}

async function installSupabaseMock(page, { failAuth = false, failSave = () => false, failGameState = false, social = false, store = { state: saveFixture(), writes: [] } } = {}) {
  const writes = store.writes;
  const reads = store.reads ?? (store.reads = []);
  const tableReads = store.tableReads ?? (store.tableReads = []);
  const unexpectedRequests = [];
  const session = mockSession();
  // The friends/search browser scenario starts with an existing searchable profile.
  let mockedPlayerProfile = social ? {
    user_id: playerId,
    display_name: "لاعب تجريبي",
    avatar_id: "brand",
    is_searchable: true,
    created_at: new Date().toISOString(),
  } : null;
  await page.route(`${supabaseUrl}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (request.method() === "POST" && url.pathname.endsWith("/auth/v1/token")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(session) });
      return;
    }
    if (request.method() === "POST" && url.pathname.endsWith("/auth/v1/signup")) {
      if (failAuth) {
        await route.abort("failed");
        return;
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(session) });
      return;
    }
    if (request.method() === "GET" && url.pathname.endsWith("/auth/v1/user")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(session.user) });
      return;
    }
    if (request.method() === "OPTIONS" && url.pathname.endsWith("/functions/v1/initialize-save")) {
      await route.fulfill({
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
        },
        body: "",
      });
      return;
    }
    if (request.method() === "POST" && url.pathname.endsWith("/functions/v1/initialize-save")) {
      const payload = request.postDataJSON();
      if (!payload || Object.keys(payload).length !== 0) {
        await route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ error: "Initialization accepts an empty payload only" }) });
        return;
      }
      if (!store.state) store.state = newPlayerFixture();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ state: store.state, updatedAt: new Date().toISOString(), created: true }),
      });
      return;
    }
    if (request.method() === "OPTIONS" && url.pathname.endsWith("/functions/v1/game-state")) {
      await route.fulfill({
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
        },
        body: "",
      });
      return;
    }
    if (request.method() === "GET" && url.pathname.endsWith("/functions/v1/game-state")) {
      reads.push(url.pathname);
      if (failGameState) {
        await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ message: "Function not deployed" }) });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ state: store.state, updatedAt: store.state ? new Date().toISOString() : null }),
      });
      return;
    }
    if (request.method() === "GET" && url.pathname.endsWith("/rest/v1/player_saves")) {
      tableReads.push(url.pathname);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(store.state ? [{ game_state: store.state, updated_at: new Date().toISOString() }] : []),
      });
      return;
    }
    if (request.method() === "POST" && url.pathname.endsWith("/rest/v1/player_saves")) {
      if (failSave()) {
        await route.abort("failed");
        return;
      }
      const saved = request.postDataJSON();
      writes.push(saved);
      store.state = saved.game_state;
      // persistSnapshot requests the committed updated_at version after upsert.
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ updated_at: new Date().toISOString() }),
      });
      return;
    }
    if (request.method() === "GET" && url.pathname.endsWith("/rest/v1/player_profiles")) {
      // getMyProfile uses maybeSingle(); return the profile persisted by the mocked upsert RPC.
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(mockedPlayerProfile) });
      return;
    }
    if (social && request.method() === "POST" && url.pathname.includes("/rest/v1/rpc/")) {
      const rpc = url.pathname.split("/").at(-1);
      const args = request.postDataJSON() ?? {};
      if (rpc === "upsert_my_profile") {
        mockedPlayerProfile = {
          user_id: playerId,
          display_name: args.p_display_name,
          avatar_id: args.p_avatar_id,
          is_searchable: true,
          created_at: new Date().toISOString(),
        };
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(mockedPlayerProfile) });
        return;
      }
      const responses = {
        set_my_profile_searchable: null,
        list_my_friends: [],
        list_incoming_friend_requests: [],
        search_players: [{ user_id: "e2e-player-0002", display_name: "صديق تجريبي", avatar_id: "brand", friend_state: "none" }],
        get_public_player_profile: {
          user_id: "e2e-player-0002",
          display_name: "صديق تجريبي",
          avatar_id: "brand",
          character_gender: "male",
          hero_name: "بطل الاختبار",
          class_name: "Warrior",
          level: 5,
          stats: { str: 15, def: 12, vit: 12, agi: 8, luck: 5 },
          equipped: { weapon: { name: "سيف الاختبار", rarity: "rare" } },
          active_pet: null,
          wins: 12,
          battles: 20,
          dimas_floor: 4,
          roaming_events: 9,
        },
        send_friend_request: "e2e-request-0001",
      };
      if (!(rpc in responses)) {
        await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ message: "Unknown social RPC" }) });
        return;
      }
      const value = responses[rpc];
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(value) });
      return;
    }

    unexpectedRequests.push(`${request.method()} ${url.pathname}`);
    await route.fulfill({ status: 501, contentType: "application/json", body: JSON.stringify({ message: "Unexpected mocked Supabase request" }) });
  });
  return { store, writes, reads, tableReads, unexpectedRequests };
}

async function signInWithMock(page) {
  const pageErrors = [];
  const consoleErrors = [];
  const failedResponses = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("response", (response) => { if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`); });
  await page.goto(`${appUrl}/login`);
  const emailField = page.getByPlaceholder("name@example.com");
  try {
    await emailField.waitFor({ state: "visible", timeout: 12_000 });
  } catch (error) {
    const diagnostic = await page.locator("body").innerText().catch(() => "<body unavailable>");
    const title = await page.title().catch(() => "<title unavailable>");
    throw new Error(`Login screen did not become interactive. URL=${page.url()} title=${title} body=${diagnostic.slice(0, 3000)} pageErrors=${JSON.stringify(pageErrors)} consoleErrors=${JSON.stringify(consoleErrors)} failedResponses=${JSON.stringify(failedResponses)} serverOutput=${serverOutput.slice(-5000)}; cause=${error instanceof Error ? error.message : String(error)}`);
  }
  await emailField.fill("player@example.test");
  await page.getByPlaceholder("8 أحرف على الأقل").fill("local-test-password");
  await page.getByRole("button", { name: "متابعة بالبريد" }).click();
  await page.getByText("ساحة الحراس", { exact: true }).waitFor({ timeout: 15_000 });
}

async function waitForServer() {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 120_000) {
    if (serverProcess.exitCode !== null) throw new Error(`Expo exited early. ${serverOutput}`);
    try {
      const response = await fetch(`${appUrl}/login`);
      if (response.ok) return;
    } catch { /* Wait for Metro to finish starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out starting Expo Web. ${serverOutput}`);
}

before(async () => {
  serverProcess = spawn("pnpm", ["run", "web", "--", "--port", "8081", "--host", "localhost"], {
    cwd: projectRoot,
    env: { ...process.env, EXPO_PUBLIC_BASE_PATH: "", EXPO_PUBLIC_GAME_API_URL: "" },
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  serverProcess.stdout.on("data", (chunk) => { serverOutput += chunk.toString(); });
  serverProcess.stderr.on("data", (chunk) => { serverOutput += chunk.toString(); });
  await waitForServer();
  browser = await chromium.launch({ headless: true });
});

after(async () => {
  await browser?.close();
  if (serverProcess && serverProcess.exitCode === null) {
    const exited = new Promise((resolve) => {
      let settled = false;
      const timeout = setTimeout(() => {
        if (!settled) {
          settled = true;
          resolve(false);
        }
      }, 5_000);
      serverProcess.once("exit", () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        resolve(true);
      });
    });
    try { process.kill(-serverProcess.pid, "SIGTERM"); } catch { serverProcess.kill("SIGTERM"); }
    const stopped = await exited;
    if (!stopped && serverProcess.exitCode === null) {
      serverProcess.kill("SIGKILL");
      await new Promise((resolve) => {
        if (serverProcess.exitCode !== null) return resolve();
        const timeout = setTimeout(resolve, 2_000);
        serverProcess.once("exit", () => {
          clearTimeout(timeout);
          resolve();
        });
      });
    }
  }
});

test("mocked account save and stat allocation work on desktop and mobile", async (context) => {
  for (const viewport of [
    { name: "desktop", width: 1440, height: 900, isMobile: false, hasTouch: false },
    { name: "mobile", width: 390, height: 844, isMobile: true, hasTouch: true },
  ]) {
    await context.test(viewport.name, async () => {
      const browserContext = await browser.newContext({ viewport, isMobile: viewport.isMobile, hasTouch: viewport.hasTouch });
      const page = await browserContext.newPage();
      const pageErrors = [];
      const consoleErrors = [];
      const { writes, reads, unexpectedRequests } = await installSupabaseMock(page);
      page.on("pageerror", (error) => pageErrors.push(error.message));
      page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });

      await page.goto(`${appUrl}/login`);
      assert.equal(await page.getByRole("button", { name: /Google/i }).count(), 0, "Google sign-in must not be shown");
      await signInWithMock(page);
      await page.getByRole("button", { name: "الشخصية", exact: true }).click();
      await page.getByText("2 نقطة تطوير متاحة", { exact: true }).waitFor();
      await page.getByRole("button", { name: "المخيم", exact: true }).click();
      await page.goto(`${appUrl}/profile`);
      await page.getByText("هويتك في العالم", { exact: true }).waitFor({ timeout: 10_000 });
      const profileOverlay = await page.locator("#error-overlay").innerText().catch(() => "");
      assert.deepEqual({ overlay: profileOverlay.trim(), pageErrors, consoleErrors }, { overlay: "", pageErrors: [], consoleErrors: [] }, `${viewport.name} profile runtime diagnostics`);
      await page.goto(`${appUrl}/character`);
      await page.getByText("تطوير السمات", { exact: true }).filter({ visible: true }).first().waitFor({ timeout: 10_000 });

      const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      assert.equal(hasHorizontalOverflow, false, `${viewport.name} layout has horizontal overflow`);

      const campOverlay = await page.locator("#error-overlay").innerText().catch(() => "");
      assert.deepEqual({ overlay: campOverlay.trim(), pageErrors, consoleErrors }, { overlay: "", pageErrors: [], consoleErrors: [] }, `${viewport.name} character runtime diagnostics`);
      const increaseButtons = page.getByText("+1", { exact: true });
      assert.equal(await increaseButtons.count(), 5);
      await increaseButtons.first().click();
      await page.getByText("1 نقطة تطوير متاحة", { exact: true }).waitFor();

      const deadline = Date.now() + 5000;
      while (!writes.length && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 100));
      assert.ok(reads.length, "the authenticated read-only game-state endpoint was not attempted");
      assert.ok(writes.length, "stat allocation was not persisted through the mocked save API");
      assert.equal(writes.at(-1).game_state.hero.stats.str, 14);
      assert.equal(writes.at(-1).game_state.hero.statPoints, 1);
      assert.deepEqual(unexpectedRequests, []);
      assert.deepEqual(pageErrors, []);
      assert.deepEqual(consoleErrors, []);

      await page.screenshot({ path: `/tmp/vorzane-${viewport.name}.png`, fullPage: true });
      await browserContext.close();
    });
  }
});

test("primary game navigation stays visible and switches between core screens", async () => {
  const browserContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await browserContext.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  const { unexpectedRequests } = await installSupabaseMock(page);
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });

  await signInWithMock(page);
  const navigation = page.getByRole("navigation", { name: "التنقل الرئيسي" });
  assert.equal(await navigation.getByRole("button").count(), 6, "the primary navigation should expose six core destinations, including the separate Dimas arena");
  await navigation.getByRole("button", { name: "الديماس" }).click();
  await page.waitForURL((url) => url.pathname.endsWith("/dimas"), { timeout: 10_000 });
  await page.getByText("درج المجد", { exact: true }).waitFor({ timeout: 10_000 });
  const journeys = navigation.getByRole("button", { name: "التجوال" });
  await journeys.click();
  await page.waitForURL((url) => url.pathname.endsWith("/expeditions"), { timeout: 10_000 });
  await navigation.locator('[aria-label="التجوال"][aria-current="page"]').waitFor({ state: "visible", timeout: 10_000 });
  assert.match(page.url(), /expeditions/);
  await navigation.getByRole("button", { name: "المخيم" }).click();
  await page.waitForURL((url) => url.pathname.endsWith("/home"), { timeout: 10_000 });
  await navigation.locator('[aria-label="المخيم"][aria-current="page"]').waitFor({ state: "visible", timeout: 10_000 });
  assert.match(page.url(), /home/);

  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  assert.equal(hasHorizontalOverflow, false, "the mobile navigation must not introduce horizontal overflow");
  assert.deepEqual(unexpectedRequests, []);
  assert.deepEqual(pageErrors, []);
  assert.deepEqual(consoleErrors, []);
  await browserContext.close();
});

test("roaming lore archive unlocks a story page with relic shards", async () => {
  const store = { state: saveFixture(), writes: [] };
  store.state.roaming = { fragments: 31 };
  const browserContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await browserContext.newPage();
  const pageErrors = [];
  const { unexpectedRequests } = await installSupabaseMock(page, { store });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await signInWithMock(page);
  await page.goto(`${appUrl}/expeditions`);
  await page.getByText("أرشيف الآثار", { exact: true }).waitFor({ timeout: 10_000 });
  await page.getByRole("button", { name: "افتح الوثيقة • 3 شظايا" }).click();
  await page.getByText("فُتحت وثيقة «سجل الملاح الأول» وأضيفت إلى أرشيفك.", { exact: true }).waitFor({ timeout: 10_000 });
  await page.getByText(/لم تكن خريطة الملاح الأول ترسم الطرق/).waitFor({ timeout: 10_000 });
  await page.getByRole("button", { name: "افتح الوثيقة • 12 شظايا" }).click();
  await page.getByRole("button", { name: "افتح الوثيقة • 16 شظايا" }).click();
  await page.getByText(/اكتملت مجموعة «ذاكرة المسافرين»/).waitFor({ timeout: 10_000 });
  await page.getByText(/لا يضيع الطريق ما دام هناك من يتذكره/).waitFor({ timeout: 10_000 });
  await page.getByText("0 شظية أثر", { exact: true }).first().waitFor({ timeout: 10_000 });

  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  assert.equal(hasHorizontalOverflow, false, "the lore archive must fit a narrow mobile viewport");
  assert.deepEqual(unexpectedRequests, []);
  assert.deepEqual(pageErrors, []);
  await browserContext.close();
});

test("auto-equip fills all eight gear slots and chooses the item with the highest displayed power", async () => {
  const browserContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await browserContext.newPage();
  const store = { state: saveFixture(), writes: [] };
  store.state.hero.level = 100;
  store.state.inventory = [
    { id: "sword1-e2e", catalogId: "sword1", name: "سيف المبتدئ", slot: "سلاح", rarity: "common", bonus: { str: 3 }, price: 100, requiredLevel: 1 },
    { id: "dun-2-mythic-5-e2e", catalogId: "dun-2-mythic-5", name: "درع الأزلي المدّ", slot: "درع", rarity: "mythic", bonus: { vit: 645, agi: 206 }, price: 1_000, requiredLevel: 73 },
    { id: "dun-2-mythic-3-e2e", catalogId: "dun-2-mythic-3", name: "درع الأزلي الشق", slot: "درع", rarity: "mythic", bonus: { vit: 574, def: 184 }, price: 1_000, requiredLevel: 73 },
    { id: "helm1-e2e", catalogId: "helm1", name: "خوذة الحديد", slot: "خوذة", rarity: "common", bonus: { def: 3 }, price: 150, requiredLevel: 1 },
    { id: "gloves1-e2e", catalogId: "gloves1", name: "قفازات الحارس", slot: "قفازات", rarity: "common", bonus: { str: 2, def: 1 }, price: 210, requiredLevel: 1 },
    { id: "boots1-e2e", catalogId: "boots1", name: "حذاء المسافر", slot: "حذاء", rarity: "common", bonus: { agi: 2 }, price: 90, requiredLevel: 1 },
    { id: "amulet1-e2e", catalogId: "amulet1", name: "قلادة الفجر", slot: "قلادة", rarity: "common", bonus: { vit: 3, luck: 1 }, price: 330, requiredLevel: 1 },
    { id: "ring1-e2e", catalogId: "ring1", name: "خاتم الحظ", slot: "خاتم أول", rarity: "common", bonus: { luck: 4 }, price: 250, requiredLevel: 1 },
    { id: "ring2-25-e2e", catalogId: "ring2-25", name: "خاتم العهد", slot: "خاتم ثانٍ", rarity: "epic", bonus: { def: 24, vit: 28 }, price: 68_000, requiredLevel: 25 },
  ];
  const { unexpectedRequests } = await installSupabaseMock(page, { store });
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await signInWithMock(page);
  await page.goto(`${appUrl}/gear`);
  await page.getByRole("button", { name: "تجهيز أقوى العتاد" }).click();
  for (const name of ["سيف المبتدئ", "درع الأزلي المدّ", "خوذة الحديد", "قفازات الحارس", "حذاء المسافر", "قلادة الفجر", "خاتم الحظ", "خاتم العهد"]) {
    await page.getByText(name, { exact: true }).waitFor({ timeout: 10_000 });
  }
  await page.getByText(/زادت قوة قتالك/).waitFor({ timeout: 10_000 });
  assert.deepEqual(unexpectedRequests, []);
  assert.deepEqual(pageErrors, []);
  await browserContext.close();
});

test("game-state read falls back to the RLS-scoped table query when the Edge Function is unavailable", async () => {
  const browserContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await browserContext.newPage();
  const { reads, tableReads, unexpectedRequests } = await installSupabaseMock(page, { failGameState: true });
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await signInWithMock(page);
  assert.ok(reads.length, "the Edge Function should be attempted first");
  assert.ok(tableReads.length, "the RLS-scoped compatibility query should be used after function failure");
  assert.deepEqual(unexpectedRequests, []);
  assert.deepEqual(pageErrors, []);
  await browserContext.close();
});

test("new hero creator renders character controls only once", async () => {
  const browserContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await browserContext.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  const { unexpectedRequests } = await installSupabaseMock(page, { store: { state: null, writes: [] } });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });

  await page.goto(`${appUrl}/login`);
  await page.getByPlaceholder("name@example.com").fill("new-player@example.test");
  await page.getByPlaceholder("8 أحرف على الأقل").fill("local-test-password");
  await page.getByRole("button", { name: "متابعة بالبريد" }).click();
  await page.getByText("اختر من يسير في الظل", { exact: true }).waitFor({ timeout: 15_000 });

  assert.equal(await page.getByText("اختر شخصيتك", { exact: true }).count(), 1);
  assert.equal(await page.getByText("اختر فئتك", { exact: true }).count(), 1);
  assert.equal(await page.getByText("البطل", { exact: true }).count(), 1);
  assert.equal(await page.getByText("البطلة", { exact: true }).count(), 1);
  assert.equal(await page.getByText("معاينة شخصيتك", { exact: true }).count(), 0, "the old appearance preview must not return");
  assert.equal(await page.getByText("المظهر", { exact: true }).count(), 0, "appearance customization must not be offered during creation");
  await page.getByText("البطلة", { exact: true }).click();
  await page.getByText("الساحر", { exact: true }).click();
  await page.getByPlaceholder("اسمٌ يليق بالأساطير").fill("بطلة الاختبار");
  await page.getByRole("button", { name: "ابدأ الرحلة" }).click();
  await page.getByText("ساحة الحراس", { exact: true }).waitFor({ timeout: 10_000 });
  assert.equal(await page.getByText("اختر شخصيتك", { exact: true }).count(), 0, "character selection must disappear after creation");
  assert.equal(await page.getByText("اختر فئتك", { exact: true }).count(), 0, "class selection must disappear after creation");
  assert.ok(await page.getByLabel("صورة البطلة").count() >= 1, "the selected heroine portrait remains available in the hero UI");
  assert.deepEqual(unexpectedRequests, []);
  assert.deepEqual(pageErrors, []);
  assert.deepEqual(consoleErrors, []);
  await browserContext.close();
});

test("offline progress conflict resolves and restores in a clean second context", async () => {
  const store = { state: saveFixture(), writes: [] };
  let failSaves = true;
  const firstContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const firstPage = await firstContext.newPage();
  await installSupabaseMock(firstPage, { store, failSave: () => failSaves });

  await signInWithMock(firstPage);
  await firstPage.getByRole("button", { name: "الشخصية", exact: true }).click();
  await firstPage.getByText("+1", { exact: true }).first().click();
  await firstPage.getByText("تعذرت المزامنة؛ النسخة المحلية محفوظة", { exact: true }).waitFor({ state: "attached", timeout: 10_000 });
  assert.equal(store.state.hero.stats.str, 13, "failed save must leave cloud progress unchanged");

  failSaves = false;
  await firstPage.reload();
  await firstPage.getByText("توجد نسختان لهذا اللاعب", { exact: true }).waitFor({ timeout: 15_000 });
  await firstPage.getByRole("button", { name: "احتفظ بنسخة الجهاز وارفعها" }).click();
  await firstPage.getByRole("button", { name: "الشخصية", exact: true }).click();
  await firstPage.getByText("تطوير السمات", { exact: true }).waitFor({ timeout: 10_000 });
  assert.equal(store.state.hero.stats.str, 14);
  assert.equal(store.state.hero.statPoints, 1);
  await firstContext.close();

  const secondContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const secondPage = await secondContext.newPage();
  await installSupabaseMock(secondPage, { store });
  await signInWithMock(secondPage);
  await secondPage.getByRole("button", { name: "الشخصية", exact: true }).click();
  await secondPage.getByText("1 نقطة تطوير متاحة", { exact: true }).waitFor();
  assert.equal(await secondPage.getByText(/^(١٤|14)$/).count(), 1, "the restored strength value should be visible using the Arabic or Latin numeral font");
  await secondContext.close();
});

test("guest sign-in displays an Arabic message when the network fails", async () => {
  const browserContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await browserContext.newPage();
  await installSupabaseMock(page, { failAuth: true });

  await page.goto(`${appUrl}/login`);
  await page.getByRole("button", { name: "ابدأ كضيف" }).click();
  await page.getByText("تعذر الاتصال بخدمة الحسابات. تحقق من الاتصال وحاول مجددًا.", { exact: true }).waitFor({ timeout: 10_000 });

  await browserContext.close();
});

test("friends and player search remain usable on a narrow mobile viewport", async () => {
  const browserContext = await browser.newContext({ viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true });
  const page = await browserContext.newPage();
  const pageErrors = [];
  const { unexpectedRequests } = await installSupabaseMock(page, { social: true });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await signInWithMock(page);
  await page.goto(`${appUrl}/friends`);
  await page.getByText("الأصدقاء", { exact: true }).first().waitFor({ timeout: 15_000 });
  await page.getByPlaceholder("اسم اللاعب...").fill("صديق");
  await page.getByText("بحث", { exact: true }).click();
  await page.getByText("صديق تجريبي", { exact: true }).waitFor({ timeout: 10_000 });
  await page.getByRole("button", { name: "إضافة" }).click();
  await page.getByText("تم إرسال طلب الصداقة.", { exact: true }).waitFor({ timeout: 10_000 });
  await page.getByText("تم الإرسال", { exact: true }).waitFor({ timeout: 10_000 });
  assert.equal(await page.getByRole("button", { name: "إضافة" }).count(), 0, "sent request must not remain actionable as a new request");

  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  assert.equal(hasHorizontalOverflow, false, "friends screen must not overflow horizontally on a 360px viewport");
  assert.deepEqual(unexpectedRequests, []);
  assert.deepEqual(pageErrors, []);
  await browserContext.close();
});


test("character, player profile, and settings have separate responsibilities", async () => {
  const store = { state: saveFixture(), writes: [] };
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const { unexpectedRequests } = await installSupabaseMock(page, { store });

  await signInWithMock(page);
  await page.getByRole("button", { name: "الشخصية", exact: true }).click();
  await page.getByText("بطل الاختبار", { exact: true }).waitFor({ state: "attached", timeout: 10_000 });
  assert.equal(await page.getByRole("radio").count(), 0, "gender and appearance must not be editable after creation");

  await page.goto(`${appUrl}/profile`);
  await page.getByText("هويتك في العالم", { exact: true }).waitFor({ state: "visible", timeout: 10_000 });
  assert.equal(await page.getByText("مظهر الشخصية", { exact: true }).count(), 0, "character customization must not live in player profile");

  await page.goto(`${appUrl}/settings`);
  await page.getByText("الموسيقى", { exact: true }).waitFor({ state: "visible", timeout: 10_000 });
  assert.equal(await page.getByText("الصورة الشخصية", { exact: true }).count(), 0, "profile identity controls must not live in settings");

  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  assert.equal(hasHorizontalOverflow, false, "separated screens must not overflow horizontally");
  assert.deepEqual(unexpectedRequests, []);
  await context.close();
});


test("public player profiles use a static web route with a query id", async () => {
  const browserContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await browserContext.newPage();
  const pageErrors = [];
  const { unexpectedRequests } = await installSupabaseMock(page, { social: true });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await signInWithMock(page);
  await page.goto(`${appUrl}/player?id=e2e-player-0002`);
  await page.getByText("ملف لاعب عام", { exact: true }).waitFor({ timeout: 10_000 });
  await page.getByText("صديق تجريبي", { exact: true }).waitFor({ timeout: 10_000 });
  await page.getByText("بطل الاختبار", { exact: true }).waitFor({ timeout: 10_000 });

  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  assert.equal(hasHorizontalOverflow, false, "public player profile must fit a narrow mobile viewport");
  assert.deepEqual(unexpectedRequests, []);
  assert.deepEqual(pageErrors, []);
  await browserContext.close();
});
