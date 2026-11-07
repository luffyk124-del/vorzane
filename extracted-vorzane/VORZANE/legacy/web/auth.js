(() => {
  const SUPABASE_URL = "https://incidgigfqyjbqfegukg.supabase.co";
  const SUPABASE_PUBLIC_KEY = "sb_publishable_scnWGsc4XJwq_ChOVUEHzQ_-obp7wV4";
  const SAVE_TABLE = "player_saves";
  const LEGACY_SAVE_KEY = "vorzane_save_v2";
  const USER_SAVE_PREFIX = "vorzane_save_v2_user_";
  const LEGACY_CLAIM_KEY = "vorzane_legacy_save_claimed_by";
  const LEGACY_DECLINE_PREFIX = "vorzane_legacy_save_declined_";

  const client = window.supabase?.createClient
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY, {
        auth: {
          autoRefreshToken: true,
          detectSessionInUrl: true,
          persistSession: true
        }
      })
    : null;

  let currentSession = null;
  let currentUser = null;
  let activeUserId = null;
  let loadedUserId = null;
  let syncReady = false;
  let offlineMode = false;
  let pendingMigration = false;
  let legacyCandidate = null;
  let forceEmailUpgrade = false;
  let emailMode = "signin";
  let saveTimer = null;
  let saveQueue = Promise.resolve();
  let sessionLoadToken = 0;

  const byId = (id) => document.getElementById(id);
  const authModal = byId("authModal");
  const authForm = byId("authEmailForm");

  function redirectUrl() {
    return new URL("/", window.location.origin).toString();
  }

  function freshState() {
    return window.VorzaneGame?.freshData?.() || {
      hero: null,
      gold: 1000,
      gems: 50,
      inventory: [],
      equipped: {},
      pets: [],
      activePet: null,
      tower: 0,
      story: 0,
      battles: 0,
      wins: 0,
      quests: { first: false, battles: false, level: false },
      achievements: { first: false, level: false, wins: false },
      settings: { sfx: true, volume: 20 }
    };
  }

  function normalizeState(value) {
    if (!value || typeof value !== "object" || Array.isArray(value) || !("hero" in value)) return null;
    const base = freshState();
    const state = { ...base, ...value };
    if (state.hero !== null && (!state.hero || typeof state.hero !== "object" || !state.hero.stats || typeof state.hero.stats !== "object")) return null;
    state.inventory = Array.isArray(value.inventory) ? value.inventory : [];
    state.pets = Array.isArray(value.pets) ? value.pets : [];
    state.equipped = value.equipped && typeof value.equipped === "object" && !Array.isArray(value.equipped) ? value.equipped : {};
    state.quests = { ...base.quests, ...(value.quests && typeof value.quests === "object" ? value.quests : {}) };
    state.achievements = { ...base.achievements, ...(value.achievements && typeof value.achievements === "object" ? value.achievements : {}) };
    state.settings = { ...base.settings, ...(value.settings && typeof value.settings === "object" ? value.settings : {}) };
    return state;
  }

  function readLocal(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? normalizeState(JSON.parse(raw)) : null;
    } catch (_) {
      return null;
    }
  }

  function localKeyFor(userId = activeUserId) {
    return userId ? `${USER_SAVE_PREFIX}${userId}` : LEGACY_SAVE_KEY;
  }

  function storeLocal(state, userId = activeUserId) {
    try {
      localStorage.setItem(localKeyFor(userId), JSON.stringify(state));
      return true;
    } catch (_) {
      setSaveStatus("تعذر حفظ النسخة المحلية على هذا الجهاز");
      return false;
    }
  }

  function getGameState() {
    return window.VorzaneGame?.getState?.() || freshState();
  }

  function setGameState(state) {
    const normalized = normalizeState(state) || freshState();
    window.VorzaneGame?.setState?.(normalized);
  }

  function setSaveStatus(message) {
    const status = byId("saveStatus");
    const modalStatus = byId("authSaveStatus");
    if (status) status.textContent = message;
    if (modalStatus) modalStatus.textContent = message;
  }

  function setMessage(message, kind = "info") {
    const el = byId("authMessage");
    if (!el) return;
    el.textContent = message || "";
    el.dataset.kind = kind;
    el.hidden = !message;
  }

  function isGuest(user = currentUser) {
    return Boolean(user?.is_anonymous);
  }

  function updateAccountUI() {
    const button = byId("accountButton");
    const info = byId("authAccountInfo");
    const note = byId("authAccountNote");
    if (button) {
      button.textContent = !currentUser ? "دخول" : isGuest() ? "ضيف" : "حسابي";
      button.title = !currentUser ? "تسجيل الدخول أو إنشاء حساب" : isGuest() ? "حساب ضيف" : (currentUser.email || "حساب اللاعب");
    }
    if (info) info.textContent = !currentUser ? "لا يوجد حساب مسجل" : isGuest() ? "تلعب كضيف — تقدمك محفوظ لهذا الحساب المجهول" : `مسجل الدخول: ${currentUser.email || "حساب VORZANE"}`;
    if (note) note.textContent = isGuest() ? "احفظ معرّف الضيف على هذا الجهاز؛ لن يمكن استعادته من جهاز آخر قبل ربط بريد أو Google." : "يُحمّل حفظ هذا الحساب من السحابة ويظل منفصلًا عن حسابات اللاعبين الآخرين.";
    renderModal();
  }

  function openDialog() {
    if (!authModal) return;
    renderModal();
    authModal.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeDialog() {
    if (pendingMigration) {
      setMessage("اختر نقل الحفظ الموجود أو بدء حفظ جديد لهذا الحساب.", "warning");
      return;
    }
    if (!currentUser && !offlineMode) {
      continueOffline();
      return;
    }
    if (authModal) authModal.hidden = true;
    document.body.style.overflow = "";
  }

  function renderModal() {
    if (!authModal) return;
    const signedIn = Boolean(currentUser);
    const migration = pendingMigration;
    const showUpgrade = signedIn && isGuest() && forceEmailUpgrade && !migration;
    const showSession = signedIn && syncReady && !migration && !showUpgrade;
    const showForm = !migration && (!signedIn || showUpgrade);

    byId("authEmailForm").hidden = !showForm;
    byId("authModeSwitch").hidden = signedIn || migration;
    byId("authGoogleButton").hidden = signedIn || migration;
    byId("authGuestButton").hidden = signedIn || migration;
    byId("authSessionPanel").hidden = !showSession;
    byId("authMigrationPanel").hidden = !migration;
    byId("authEmailUpgradeButton").hidden = !showSession || !isGuest();
    byId("authLinkGoogleButton").hidden = !showSession;
    byId("authSignOutButton").hidden = !showSession;
    byId("authBackToSessionButton").hidden = !showUpgrade;
    byId("authOfflineButton").hidden = showSession || migration;

    const title = byId("authTitle");
    const subtitle = byId("authSubtitle");
    if (title) title.textContent = migration ? "اختيار الحفظ" : signedIn ? "حساب اللاعب" : "ادخل إلى عالم VORZANE";
    if (subtitle) subtitle.textContent = migration
      ? "اختر ما إذا كنت تريد نقل الحفظ القديم إلى هذا الحساب."
      : signedIn ? "إدارة تسجيل الدخول ومزامنة تقدمك." : "احفظ مغامرتك لكل لاعب عبر البريد أو Google أو حساب ضيف.";

    const submit = byId("authSubmitButton");
    if (submit) submit.textContent = showUpgrade ? "ربط البريد بهذا الحساب" : emailMode === "signup" ? "إنشاء حساب بالبريد" : "تسجيل الدخول بالبريد";
    const modeSwitch = byId("authModeSwitch");
    if (modeSwitch) modeSwitch.textContent = emailMode === "signup" ? "لديك حساب؟ سجّل الدخول" : "مستخدم جديد؟ أنشئ حسابًا";
    const password = byId("authPassword");
    if (password) password.autocomplete = emailMode === "signup" ? "new-password" : "current-password";

    if (signedIn && !migration) updateAccountUIFields();
  }

  function updateAccountUIFields() {
    const info = byId("authAccountInfo");
    const note = byId("authAccountNote");
    if (info) info.textContent = isGuest() ? "حساب ضيف — تقدمك محفوظ تحت هوية مستقلة" : `مسجل الدخول: ${currentUser?.email || "حساب VORZANE"}`;
    if (note) note.textContent = isGuest()
      ? "للاستمرار على جهاز آخر، اربط بريدك أو Google بهذا الحساب قبل تسجيل الخروج أو مسح بيانات المتصفح."
      : "حفظ السحابة مرتبط بهويتك فقط ولا يمكن للاعبين الآخرين قراءته.";
  }

  function safeError(error) {
    const text = String(error?.message || error || "حدث خطأ غير متوقع");
    if (/invalid login credentials/i.test(text)) return "البريد الإلكتروني أو كلمة المرور غير صحيحة.";
    if (/email not confirmed/i.test(text)) return "أكد بريدك الإلكتروني من رسالة التحقق، ثم حاول تسجيل الدخول.";
    if (/anonymous.*disabled|anonymous sign-ins.*disabled/i.test(text)) return "تسجيل الضيف غير مفعّل في إعدادات Supabase بعد.";
    if (/provider.*(not enabled|disabled|unsupported)|unsupported provider/i.test(text)) return "تسجيل Google غير مهيّأ في Supabase بعد؛ يلزم إضافة بيانات OAuth الخاصة بالمشروع.";
    if (/redirect.*(not allowed|allow list)/i.test(text)) return "عنوان الموقع غير موجود في قائمة إعادة التوجيه المسموح بها في Supabase.";
    return text;
  }

  function setBusy(busy) {
    ["authSubmitButton", "authGoogleButton", "authGuestButton", "authEmailUpgradeButton", "authLinkGoogleButton", "authSignOutButton"].forEach((id) => {
      const button = byId(id);
      if (button) button.disabled = busy;
    });
  }

  function migrationAvailable(userId) {
    const claimedBy = localStorage.getItem(LEGACY_CLAIM_KEY);
    if (claimedBy && claimedBy !== userId) return false;
    if (localStorage.getItem(`${LEGACY_DECLINE_PREFIX}${userId}`) === "1") return false;
    return Boolean(readLocal(LEGACY_SAVE_KEY));
  }

  async function loadPlayerSave(session, options = {}) {
    if (!client || !session?.user) return;
    const user = session.user;
    const userId = user.id;
    currentSession = session;
    currentUser = user;
    activeUserId = userId;
    offlineMode = false;
    updateAccountUI();

    if (loadedUserId === userId && syncReady) {
      if (options.userInitiated) closeDialog();
      return;
    }

    const loadToken = ++sessionLoadToken;
    syncReady = false;
    pendingMigration = false;
    legacyCandidate = null;
    forceEmailUpgrade = false;

    try {
      const { data, error } = await client
        .from(SAVE_TABLE)
        .select("game_state, updated_at")
        .eq("user_id", userId)
        .maybeSingle();
      if (loadToken !== sessionLoadToken) return;
      if (error) throw error;

      const remoteState = data ? normalizeState(data.game_state) : null;
      if (data && !remoteState) throw new Error("حفظ الحساب في السحابة غير صالح؛ لم يتم استبداله.");

      if (remoteState) {
        setGameState(remoteState);
        storeLocal(remoteState, userId);
        syncReady = true;
        loadedUserId = userId;
        setSaveStatus("تم تحميل حفظك من السحابة");
        if (options.userInitiated) closeDialog();
        updateAccountUI();
        return;
      }

      const cachedState = readLocal(localKeyFor(userId));
      if (cachedState) {
        setGameState(cachedState);
        syncReady = true;
        loadedUserId = userId;
        setSaveStatus("استُعيدت النسخة المحلية؛ جارٍ مزامنتها");
        await flushSave();
        if (options.userInitiated) closeDialog();
        updateAccountUI();
        return;
      }

      const claimedBy = localStorage.getItem(LEGACY_CLAIM_KEY);
      if (migrationAvailable(userId)) {
        legacyCandidate = readLocal(LEGACY_SAVE_KEY);
        pendingMigration = true;
        loadedUserId = userId;
        setMessage("وجدنا حفظًا محليًا قد يخص لاعبًا آخر. انقله فقط إذا كان تقدمك أنت.", "warning");
        openDialog();
        updateAccountUI();
        return;
      }

      if (claimedBy === userId) {
        const claimedSave = readLocal(LEGACY_SAVE_KEY);
        if (claimedSave) {
          setGameState(claimedSave);
          storeLocal(claimedSave, userId);
          syncReady = true;
          loadedUserId = userId;
          setSaveStatus("تم استرجاع نسخة الحفظ المرتبطة بهذا الحساب؛ جارٍ مزامنتها");
          await flushSave();
          if (options.userInitiated) closeDialog();
          updateAccountUI();
          return;
        }
      }

      const emptyState = freshState();
      setGameState(emptyState);
      storeLocal(emptyState, userId);
      syncReady = true;
      loadedUserId = userId;
      setSaveStatus("حساب جديد — سيُحفظ تقدمك في السحابة");
      if (options.userInitiated) closeDialog();
      updateAccountUI();
    } catch (error) {
      if (loadToken !== sessionLoadToken) return;
      syncReady = false;
      loadedUserId = null;
      const cachedState = readLocal(localKeyFor(userId));
      if (cachedState) setGameState(cachedState);
      else if (localStorage.getItem(LEGACY_CLAIM_KEY) === userId) {
        const claimedSave = readLocal(LEGACY_SAVE_KEY);
        if (claimedSave) setGameState(claimedSave);
      }
      setSaveStatus("تعذر الاتصال بالحفظ السحابي؛ تقدمك الحالي محلي فقط");
      setMessage(`تعذر تحميل الحفظ السحابي: ${safeError(error)} يمكنك المتابعة محليًا أو المحاولة لاحقًا.`, "warning");
      openDialog();
      updateAccountUI();
    }
  }

  function scheduleSave() {
    const state = getGameState();
    storeLocal(state, activeUserId);
    if (!client || !currentUser || !syncReady || offlineMode) {
      if (!currentUser || offlineMode) setSaveStatus("حفظ محلي فقط");
      return;
    }
    setSaveStatus("جارٍ مزامنة تقدمك...");
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => { void flushSave(); }, 700);
  }

  async function flushSave() {
    window.clearTimeout(saveTimer);
    saveTimer = null;
    if (!client || !currentUser || !activeUserId || !syncReady || offlineMode) return false;
    const userId = activeUserId;
    const snapshot = JSON.parse(JSON.stringify(getGameState()));
    storeLocal(snapshot, userId);
    saveQueue = saveQueue.catch(() => undefined).then(async () => {
      if (!currentUser || currentUser.id !== userId || offlineMode) return false;
      const { error } = await client.from(SAVE_TABLE).upsert({
        user_id: userId,
        game_state: snapshot,
        updated_at: new Date().toISOString()
      }, { onConflict: "user_id" });
      if (error) throw error;
      setSaveStatus("تم حفظ تقدمك في السحابة");
      return true;
    }).catch((error) => {
      setSaveStatus("تعذرت المزامنة؛ النسخة المحلية محفوظة");
      setMessage(`تعذر حفظ التقدم في السحابة: ${safeError(error)}`, "warning");
      return false;
    });
    return await saveQueue;
  }

  async function deleteCloudSave() {
    window.clearTimeout(saveTimer);
    saveTimer = null;
    if (!currentUser || !activeUserId) return;
    if (offlineMode || !syncReady) throw new Error("اتصل بالحفظ السحابي أولًا قبل حذف حفظ الحساب.");
    await saveQueue.catch(() => undefined);
    const { error } = await client.from(SAVE_TABLE).delete().eq("user_id", activeUserId);
    if (error) throw error;
    setSaveStatus("حُذف حفظ هذا الحساب من السحابة");
  }

  function clearLocalSave() {
    try { localStorage.removeItem(localKeyFor(activeUserId)); } catch (_) {}
  }

  function continueOffline() {
    offlineMode = true;
    pendingMigration = false;
    syncReady = false;
    if (authModal) authModal.hidden = true;
    document.body.style.overflow = "";
    setSaveStatus("وضع محلي فقط — لن تتم مزامنة التقدم");
    window.VorzaneGame?.notify?.("تعمل الآن محليًا؛ لن يُرفع التقدم إلى الحساب السحابي.");
    renderModal();
  }

  async function signInAnonymously() {
    if (!client) return setMessage("تعذر تحميل خدمة الحسابات. يمكنك اللعب محليًا مؤقتًا.", "warning");
    setBusy(true);
    setMessage("جارٍ إنشاء حساب ضيف...");
    try {
      const { data, error } = await client.auth.signInAnonymously();
      if (error) throw error;
      await loadPlayerSave(data.session, { userInitiated: true });
    } catch (error) {
      setMessage(safeError(error), "error");
    } finally {
      setBusy(false);
    }
  }

  async function signInWithGoogle() {
    if (!client) return setMessage("تعذر تحميل خدمة الحسابات. يمكنك اللعب محليًا مؤقتًا.", "warning");
    setBusy(true);
    setMessage(currentUser ? "جارٍ ربط Google بالحساب الحالي..." : "جارٍ التحويل إلى Google...");
    try {
      if (currentUser && !(await flushSave())) {
        setMessage("تعذر تأكيد حفظ تقدمك في السحابة؛ لم يبدأ ربط Google. حاول مجددًا بعد عودة الاتصال.", "error");
        return;
      }
      const options = { redirectTo: redirectUrl() };
      const result = currentUser
        ? await client.auth.linkIdentity({ provider: "google", options })
        : await client.auth.signInWithOAuth({ provider: "google", options });
      if (result.error) throw result.error;
    } catch (error) {
      setMessage(safeError(error), "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleEmailSubmit(event) {
    event.preventDefault();
    if (!client) return setMessage("تعذر تحميل خدمة الحسابات. يمكنك اللعب محليًا مؤقتًا.", "warning");
    const email = byId("authEmail").value.trim();
    const password = byId("authPassword").value;
    if (!email || password.length < 8) {
      setMessage("أدخل بريدًا صحيحًا وكلمة مرور من 8 أحرف على الأقل.", "warning");
      return;
    }

    setBusy(true);
    setMessage(emailMode === "signup" ? "جارٍ إنشاء الحساب..." : "جارٍ تسجيل الدخول...");
    try {
      if (currentUser && !isGuest()) throw new Error("سجّل الخروج أولًا لتبديل الحساب.");

      if (isGuest() && emailMode === "signup") {
        if (!(await flushSave())) {
          setMessage("تعذر تأكيد حفظ تقدمك في السحابة؛ لم نربط البريد بعد. حاول مجددًا بعد عودة الاتصال.", "error");
          return;
        }
        const { error } = await client.auth.updateUser(
          { email, password },
          { emailRedirectTo: redirectUrl() }
        );
        if (error) throw error;
        forceEmailUpgrade = false;
        renderModal();
        setMessage("أرسلنا رسالة تأكيد إلى بريدك. افتحها لإكمال ربط البريد مع حساب الضيف؛ سيبقى تقدمك مرتبطًا بالحساب نفسه.");
        return;
      }

      if (isGuest() && emailMode === "signin") {
        const confirmed = window.confirm("سيؤدي تسجيل الدخول بحساب بريد آخر إلى تبديل حساب الضيف. سيبقى حفظ الضيف منفصلًا ولن يُنقل تلقائيًا. هل تريد المتابعة؟");
        if (!confirmed) return;
        if (!(await flushSave())) {
          setMessage("تعذر تأكيد حفظ تقدم حساب الضيف؛ لم يتم تبديل الحساب. حاول مجددًا بعد عودة الاتصال.", "error");
          return;
        }
      }

      if (emailMode === "signup") {
        const { data, error } = await client.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: redirectUrl() }
        });
        if (error) throw error;
        if (data.session) await loadPlayerSave(data.session, { userInitiated: true });
        else setMessage("تم إرسال رسالة تأكيد إلى بريدك. افتحها لإكمال التسجيل ثم ارجع إلى اللعبة.");
      } else {
        const { data, error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await loadPlayerSave(data.session, { userInitiated: true });
      }
    } catch (error) {
      setMessage(safeError(error), "error");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    if (!client || !currentUser) return;
    setBusy(true);
    try {
      if (!(await flushSave())) {
        setMessage("تعذر تأكيد حفظ تقدمك في السحابة؛ لم يتم تسجيل الخروج.", "error");
        return;
      }
      const { error } = await client.auth.signOut();
      if (error) throw error;
    } catch (error) {
      setMessage(safeError(error), "error");
    } finally {
      setBusy(false);
    }
  }

  async function importLegacySave() {
    if (!activeUserId || !legacyCandidate) return;
    setGameState(legacyCandidate);
    storeLocal(legacyCandidate, activeUserId);
    syncReady = true;
    loadedUserId = activeUserId;
    setMessage("");
    if (!(await flushSave())) {
      setMessage("لم يكتمل نقل الحفظ إلى السحابة؛ بقيت النسخة المحلية محفوظة. أعد المحاولة عند استقرار الاتصال.", "error");
      openDialog();
      updateAccountUI();
      return;
    }
    localStorage.setItem(LEGACY_CLAIM_KEY, activeUserId);
    pendingMigration = false;
    closeDialog();
    window.VorzaneGame?.notify?.("تم نقل حفظ هذا الجهاز إلى حسابك.");
    updateAccountUI();
  }

  async function startFreshSave() {
    if (!activeUserId) return;
    localStorage.setItem(`${LEGACY_DECLINE_PREFIX}${activeUserId}`, "1");
    pendingMigration = false;
    legacyCandidate = null;
    setGameState(freshState());
    storeLocal(getGameState(), activeUserId);
    syncReady = true;
    loadedUserId = activeUserId;
    setMessage("");
    await flushSave();
    closeDialog();
    updateAccountUI();
  }

  async function init() {
    if (!client) {
      openDialog();
      setMessage("تعذر تحميل مكتبة الحسابات. يمكنك المتابعة محليًا، لكن لن تُزامن بياناتك.", "warning");
      setSaveStatus("خدمة الحسابات غير متاحة؛ الحفظ محلي فقط");
      return;
    }

    client.auth.onAuthStateChange((event, session) => {
      currentSession = session || null;
      currentUser = session?.user || null;
      updateAccountUI();
      if (event === "SIGNED_OUT") {
        sessionLoadToken += 1;
        activeUserId = null;
        loadedUserId = null;
        syncReady = false;
        offlineMode = false;
        pendingMigration = false;
        setGameState(freshState());
        setSaveStatus("اختر حسابًا للمتابعة");
        openDialog();
      } else if (session && ["SIGNED_IN", "USER_UPDATED", "INITIAL_SESSION"].includes(event)) {
        window.setTimeout(() => { void loadPlayerSave(session); }, 0);
      }
    });

    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    currentSession = data.session || null;
    currentUser = data.session?.user || null;
    if (data.session) {
      await loadPlayerSave(data.session, { startup: true });
    } else {
      activeUserId = null;
      loadedUserId = null;
      syncReady = false;
      updateAccountUI();
      openDialog();
      setMessage("اختر طريقة الدخول. يمكنك اللعب كضيف أو إنشاء حساب بالبريد.");
      setSaveStatus("بانتظار اختيار حساب اللاعب");
    }
  }

  function toggleEmailMode() {
    emailMode = emailMode === "signin" ? "signup" : "signin";
    setMessage("");
    renderModal();
  }

  function upgradeGuestWithEmail() {
    if (!isGuest()) return;
    emailMode = "signup";
    forceEmailUpgrade = true;
    setMessage("أضف بريدك وكلمة مرور لربطهما بحساب الضيف نفسه.");
    renderModal();
    openDialog();
  }

  function backToSession() {
    forceEmailUpgrade = false;
    setMessage("");
    renderModal();
  }

  async function removeSaveFromGame() {
    if (pendingMigration) throw new Error("اختر ما تريد فعله بالحفظ المحلي أولًا.");
    await deleteCloudSave();
    clearLocalSave();
  }

  authForm?.addEventListener("submit", handleEmailSubmit);
  byId("authModeSwitch")?.addEventListener("click", toggleEmailMode);
  byId("authGoogleButton")?.addEventListener("click", signInWithGoogle);
  byId("authGuestButton")?.addEventListener("click", signInAnonymously);
  byId("authLinkGoogleButton")?.addEventListener("click", signInWithGoogle);
  byId("authEmailUpgradeButton")?.addEventListener("click", upgradeGuestWithEmail);
  byId("authBackToSessionButton")?.addEventListener("click", backToSession);
  byId("authSignOutButton")?.addEventListener("click", signOut);
  byId("authOfflineButton")?.addEventListener("click", continueOffline);
  byId("authImportLegacyButton")?.addEventListener("click", importLegacySave);
  byId("authStartFreshButton")?.addEventListener("click", startFreshSave);

  window.addEventListener("pagehide", () => { void flushSave(); });

  window.VorzaneAuth = {
    init,
    openDialog,
    closeDialog,
    scheduleSave,
    localStorageKey: () => localKeyFor(activeUserId),
    storeCurrentLocal: () => storeLocal(getGameState(), activeUserId),
    deleteCloudSave: removeSaveFromGame,
    clearLocalSave,
    continueOffline
  };
})();
