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
  if (store.state && !store.updatedAt) store.updatedAt = new Date().toISOString();
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
      if (!store.updatedAt) store.updatedAt = new Date().toISOString();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ state: store.state, updatedAt: store.updatedAt, created: true }),
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
        body: JSON.stringify({ state: store.state, updatedAt: store.state ? store.updatedAt : null }),
      });
      return;
    }
    if (request.method() === "GET" && url.pathname.endsWith("/rest/v1/player_saves")) {
      tableReads.push(url.pathname);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(store.state ? [{ game_state: store.state, updated_at: store.updatedAt }] : []),
      });
      return;
    }
    if (request.method() === "POST" && url.pathname.endsWith("/rest/v1/player_saves")) {
      if (failSave()) {
        await route.abort("failed");
        return;
      }
      const saved = request.postDataJSON();
      if (store.state) {
        await route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({ code: "23505", message: "duplicate key value violates unique constraint" }),
        });
        return;
      }
      writes.push(saved);
      store.state = saved.game_state;
      store.updatedAt = saved.updated_at;
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ updated_at: store.updatedAt }),
      });
      return;
    }
    if (request.method() === "PATCH" && url.pathname.endsWith("/rest/v1/player_saves")) {
      if (failSave()) {
        await route.abort("failed");
        return;
      }
      const expectedVersion = url.searchParams.get("updated_at")?.replace(/^eq\./, "");
      const saved = request.postDataJSON();
      if (!store.state || expectedVersion !== store.updatedAt) {
        await route.fulfill({ status: 200, contentType: "application/json", body: "null" });
        return;
      }
      writes.push(saved);
      store.state = saved.game_state;
      store.updatedAt = saved.updated_at;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ updated_at: store.updatedAt }),
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
  await page.goto(`${appUrl}/login`);
  await page.getByPlaceholder("name@example.com").fill("player@example.test");
  await page.getByPlaceholder("8 أحرف على الأقل").fill("local-test-password");
  await page.getByRole("button", { name: "متابعة بالبريد" }).click();
  await page.getByText("تطوير السمات", { exact: true }).waitFor({ timeout: 15_000 });
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
    try { process.kill(-serverProcess.pid, "SIGTERM"); } catch { serverProcess.kill("SIGTERM"); }
    await new Promise((resolve) => serverProcess.once("exit", resolve));
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
      await page.getByText("2 نقطة متاحة", { exact: true }).waitFor();
      await page.getByRole("button", { name: "فتح القائمة" }).click();
      await page.getByRole("button", { name: "الملف الشخصي", exact: true }).waitFor();
      await page.getByRole("button", { name: "الملف الشخصي", exact: true }).click();
      await page.getByText("هويتك في العالم", { exact: true }).waitFor({ timeout: 10_000 });
      const profileOverlay = await page.locator("#error-overlay").innerText().catch(() => "");
      assert.deepEqual({ overlay: profileOverlay.trim(), pageErrors, consoleErrors }, { overlay: "", pageErrors: [], consoleErrors: [] }, `${viewport.name} profile runtime diagnostics`);
      await page.getByRole("button", { name: "رجوع" }).click();
      await page.getByText("تطوير السمات", { exact: true }).waitFor({ timeout: 10_000 });

      const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      assert.equal(hasHorizontalOverflow, false, `${viewport.name} layout has horizontal overflow`);

      const campOverlay = await page.locator("#error-overlay").innerText().catch(() => "");
      assert.deepEqual({ overlay: campOverlay.trim(), pageErrors, consoleErrors }, { overlay: "", pageErrors: [], consoleErrors: [] }, `${viewport.name} camp runtime diagnostics`);
      const increaseButtons = page.getByText("+1", { exact: true });
      assert.equal(await increaseButtons.count(), 5);
      await increaseButtons.first().click();
      await page.getByText("1 نقطة متاحة", { exact: true }).waitFor();

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

  assert.equal(await page.getByText("اختيار الشخصية", { exact: true }).count(), 1);
  assert.equal(await page.getByText("معاينة شخصيتك", { exact: true }).count(), 1);
  assert.equal(await page.getByText("المظهر", { exact: true }).count(), 1);
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
  await firstPage.getByText("+1", { exact: true }).first().click();
  await firstPage.getByText("تعذرت المزامنة؛ النسخة المحلية محفوظة", { exact: true }).waitFor({ timeout: 10_000 });
  assert.equal(store.state.hero.stats.str, 13, "failed save must leave cloud progress unchanged");

  failSaves = false;
  await firstPage.reload();
  await firstPage.getByText("توجد نسختان لهذا اللاعب", { exact: true }).waitFor({ timeout: 15_000 });
  await firstPage.getByRole("button", { name: "احتفظ بنسخة الجهاز وارفعها" }).click();
  await firstPage.getByText("تطوير السمات", { exact: true }).waitFor({ timeout: 10_000 });
  assert.equal(store.state.hero.stats.str, 14);
  assert.equal(store.state.hero.statPoints, 1);
  await firstContext.close();

  const secondContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const secondPage = await secondContext.newPage();
  await installSupabaseMock(secondPage, { store });
  await signInWithMock(secondPage);
  await secondPage.getByText("1 نقطة متاحة", { exact: true }).waitFor();
  assert.equal(await secondPage.getByText("14", { exact: true }).count(), 1);
  await secondContext.close();
});

test("a remotely deleted save requires an explicit choice before local data can be restored", async () => {
  const store = { state: saveFixture(), writes: [] };
  const browserContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await browserContext.newPage();
  const { writes } = await installSupabaseMock(page, { store });

  await signInWithMock(page);
  // Simulate another session resetting/deleting the cloud row after this client read it.
  store.state = null;
  store.updatedAt = null;

  await page.getByText("+1", { exact: true }).first().click();
  await page.getByText("توجد نسختان لهذا اللاعب", { exact: true }).waitFor({ timeout: 15_000 });
  await page.getByText("لم نعثر على حفظ سحابي لهذا الحساب.", { exact: false }).waitFor({ timeout: 5_000 });

  assert.equal(store.state, null, "a missing cloud row must not be recreated automatically from stale local data");
  assert.equal(writes.length, 0, "no cloud write is allowed before the player chooses");

  await page.getByRole("button", { name: "ابدأ بحفظ سحابي جديد" }).click();
  await page.getByText("اختر من يسير في الظل", { exact: true }).waitFor({ timeout: 10_000 });
  assert.ok(store.state, "the explicit new-save choice should create a fresh cloud row");
  assert.equal(store.state.hero, null, "a fresh save should use the canonical uncreated-hero state");
  assert.equal(writes.length, 1);
  await browserContext.close();
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


test("2D character appearance choices persist in the cloud save and restore after reload", async () => {
  const store = { state: saveFixture(), writes: [] };
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const { writes, unexpectedRequests } = await installSupabaseMock(page, { store });

  await signInWithMock(page);
  await page.getByRole("button", { name: "فتح القائمة" }).click();
  await page.getByRole("button", { name: "الملف الشخصي", exact: true }).click();
  await page.getByText("مظهر الشخصية", { exact: true }).waitFor({ state: "visible", timeout: 10_000 });
  await page.getByLabel("إغلاق القائمة").waitFor({ state: "hidden", timeout: 5_000 });
  const portrait = page.getByLabel("معاينة الشخصية ثنائية الأبعاد");
  await portrait.scrollIntoViewIfNeeded();
  await portrait.waitFor({ state: "visible", timeout: 5_000 });
  const appearanceOverlay = await page.locator("#error-overlay").innerText().catch(() => "");
  assert.equal(appearanceOverlay.trim(), "", `2D character page runtime overlay: ${appearanceOverlay}`);

  await page.getByRole("radio", { name: "تفضيل الشخصية: أنثى" }).click();
  assert.ok(await page.locator("svg").count() > 0, "the 2D SVG portrait must render");
  await page.getByRole("radio", { name: "درجة اللون 3" }).click();
  await page.getByRole("radio", { name: "تسريحة الشعر: ضفائر" }).click();
  await page.getByRole("radio", { name: "لون الشعر: فضي" }).click();
  await page.getByRole("radio", { name: "ملامح الوجه: نبيل" }).click();
  assert.equal(await page.locator('[data-testid="adventurer-circlet"]').count(), 1, "adventurer outfit must show its circlet");
  await page.getByRole("radio", { name: "الملابس: ملكي" }).click();
  assert.equal(await page.locator('[data-testid="royal-crown"]').count(), 1, "royal outfit must show its crown");
  assert.equal(await page.locator('[data-testid="adventurer-circlet"]').count(), 0, "royal outfit must replace the adventurer circlet");
  await page.getByRole("radio", { name: "الملابس: داكن" }).click();
  assert.equal(await page.locator('[data-testid="shadow-hood"]').count(), 1, "shadow outfit must show its hood");
  await page.getByRole("radio", { name: "الملابس: ملكي" }).click();
  assert.equal(await page.locator('[data-testid="royal-crown"]').count(), 1, "switching back must restore the royal crown");
  await page.getByRole("radio", { name: "بنية الجسم: متين" }).click();

  const deadline = Date.now() + 10_000;
  while ((!writes.length
    || store.state.characterStyle?.gender !== "female"
    || store.state.characterStyle?.hairstyle !== "braids"
    || store.state.characterStyle?.hairColor !== "silver"
    || store.state.characterStyle?.outfit !== "royal"
    || store.state.characterStyle?.body !== "sturdy") && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.equal(store.state.characterStyle.gender, "female");
  assert.equal(store.state.characterStyle.appearance, 2);
  assert.equal(store.state.characterStyle.hairstyle, "braids");
  assert.equal(store.state.characterStyle.hairColor, "silver");
  assert.equal(store.state.characterStyle.face, "noble");
  assert.equal(store.state.characterStyle.outfit, "royal");
  assert.equal(store.state.characterStyle.body, "sturdy");
  assert.deepEqual(unexpectedRequests, []);

  await page.reload();
  await page.getByRole("button", { name: "فتح القائمة" }).click();
  await page.getByRole("button", { name: "الملف الشخصي", exact: true }).click();
  await page.getByText("مظهر الشخصية", { exact: true }).waitFor({ state: "visible", timeout: 10_000 });
  await page.getByLabel("إغلاق القائمة").waitFor({ state: "hidden", timeout: 5_000 });
  const restoredPortrait = page.getByLabel("معاينة الشخصية ثنائية الأبعاد");
  await restoredPortrait.scrollIntoViewIfNeeded();
  await restoredPortrait.waitFor({ state: "visible", timeout: 5_000 });
  await page.getByRole("radio", { name: "تفضيل الشخصية: أنثى" }).getAttribute("aria-checked").then((value) => assert.equal(value, "true"));
  await page.getByRole("radio", { name: "درجة اللون 3" }).getAttribute("aria-checked").then((value) => assert.equal(value, "true"));
  await page.getByRole("radio", { name: "تسريحة الشعر: ضفائر" }).getAttribute("aria-checked").then((value) => assert.equal(value, "true"));
  await page.getByRole("radio", { name: "لون الشعر: فضي" }).getAttribute("aria-checked").then((value) => assert.equal(value, "true"));
  await page.getByRole("radio", { name: "ملامح الوجه: نبيل" }).getAttribute("aria-checked").then((value) => assert.equal(value, "true"));
  await page.getByRole("radio", { name: "الملابس: ملكي" }).getAttribute("aria-checked").then((value) => assert.equal(value, "true"));
  await page.getByRole("radio", { name: "بنية الجسم: متين" }).getAttribute("aria-checked").then((value) => assert.equal(value, "true"));
  assert.ok(await page.locator("svg").count() > 0, "the restored 2D portrait must render");
  await restoredPortrait.screenshot({ path: "/tmp/vorzane-profile-2d-mobile.png" });

  await context.close();
});
