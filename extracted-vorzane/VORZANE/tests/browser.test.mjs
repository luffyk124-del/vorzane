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

async function installSupabaseMock(page, { failAuth = false, failSave = () => false, social = false, store = { state: saveFixture(), writes: [] } } = {}) {
  const writes = store.writes;
  const unexpectedRequests = [];
  const session = mockSession();
  let mockedPlayerProfile = null;
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
    if (request.method() === "GET" && url.pathname.endsWith("/rest/v1/player_saves")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([{ game_state: store.state, updated_at: new Date().toISOString() }]),
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
      await route.fulfill({ status: 204, body: "" });
      return;
    }
    if (request.method() === "GET" && url.pathname.endsWith("/rest/v1/player_profiles")) {
      const rows = mockedPlayerProfile ? [mockedPlayerProfile] : [];
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(rows) });
      return;
    }
    if (social && request.method() === "POST" && url.pathname.includes("/rest/v1/rpc/")) {
      const rpc = url.pathname.split("/").at(-1);
      const args = request.postDataJSON() ?? {};
      const responses = {
        upsert_my_profile: (mockedPlayerProfile = { user_id: playerId, display_name: args.p_display_name, avatar_id: args.p_avatar_id, is_searchable: true, created_at: new Date().toISOString() }),
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
      const response = responses[rpc];
      const value = typeof response === "function" ? response() : response;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(value) });
      return;
    }

    unexpectedRequests.push(`${request.method()} ${url.pathname}`);
    await route.fulfill({ status: 501, contentType: "application/json", body: JSON.stringify({ message: "Unexpected mocked Supabase request" }) });
  });
  return { store, writes, unexpectedRequests };
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
      const { writes, unexpectedRequests } = await installSupabaseMock(page);
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
      await page.getByRole("button", { name: "رجوع" }).click();
      await page.getByText("تطوير السمات", { exact: true }).waitFor({ timeout: 10_000 });

      const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      assert.equal(hasHorizontalOverflow, false, `${viewport.name} layout has horizontal overflow`);

      const increaseButtons = page.getByText("+1", { exact: true });
      assert.equal(await increaseButtons.count(), 5);
      await increaseButtons.first().click();
      await page.getByText("1 نقطة متاحة", { exact: true }).waitFor();

      const deadline = Date.now() + 5000;
      while (!writes.length && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 100));
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
  await page.getByPlaceholder("اسم اللاعب...").waitFor({ timeout: 15_000 });
  const createProfileButton = page.getByRole("button", { name: "إنشاء ملف اللاعب" });
  if (await createProfileButton.isVisible().catch(() => false)) {
    await createProfileButton.click();
    await page.getByText("تم حفظ ملف اللاعب.", { exact: true }).waitFor({ timeout: 10_000 });
  }
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


test("character appearance choices persist in the cloud save and restore after reload", async () => {
  const store = { state: saveFixture(), writes: [] };
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const { writes, unexpectedRequests } = await installSupabaseMock(page, { store });

  await signInWithMock(page);
  await page.getByRole("button", { name: "فتح القائمة" }).click();
  await page.getByRole("button", { name: "الملف الشخصي", exact: true }).click();
  await page.getByText("مظهر الشخصية", { exact: true }).waitFor({ timeout: 10_000 });

  await page.getByRole("radio", { name: "تفضيل الشخصية: أنثى" }).click();
  const characterPreview = page.getByTestId("fantasy-character-preview");
  await characterPreview.waitFor({ timeout: 10_000 });
  assert.equal(await characterPreview.isVisible(), true, "the fantasy character artwork must be visible");
  await page.getByRole("radio", { name: "درجة البشرة 3" }).click();
  await page.getByRole("radio", { name: "تسريحة الشعر: طويل" }).click();

  const deadline = Date.now() + 10_000;
  while ((!writes.length || store.state.characterStyle?.hairstyle !== "long") && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.equal(store.state.characterStyle.gender, "female");
  assert.equal(store.state.characterStyle.appearance, 2);
  assert.equal(store.state.characterStyle.hairstyle, "long");
  assert.deepEqual(unexpectedRequests, []);

  await page.reload();
  await page.getByRole("button", { name: "فتح القائمة" }).click();
  await page.getByRole("button", { name: "الملف الشخصي", exact: true }).click();
  await page.getByRole("radio", { name: "تفضيل الشخصية: أنثى" }).waitFor();
  await page.getByRole("radio", { name: "تفضيل الشخصية: أنثى" }).getAttribute("aria-checked").then((value) => assert.equal(value, "true"));
  await page.getByTestId("fantasy-character-preview").waitFor({ timeout: 10_000 });\n  assert.equal(await page.getByTestId("fantasy-character-preview").isVisible(), true, "the restored fantasy artwork must remain visible");
  await page.getByRole("radio", { name: "درجة البشرة 3" }).getAttribute("aria-checked").then((value) => assert.equal(value, "true"));
  await page.getByRole("radio", { name: "تسريحة الشعر: طويل" }).getAttribute("aria-checked").then((value) => assert.equal(value, "true"));

  await context.close();
});
