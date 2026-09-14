(() => {
  const SUPABASE_URL = "https://fuivzblvhjuuzhygdeln.supabase.co";
  const SUPABASE_KEY = "sb_publishable_Kcy_SCyyVSeYWRJLLcV1IA_I1dHFSYe";
  const TABLE = "field_app_state";
  const TOKEN_KEY = "boringLogSupabaseAccessToken";
  const REFRESH_KEY = "boringLogSupabaseRefreshToken";
  const USER_KEY = "boringLogCurrentUser";
  const DEVICE_ACCOUNT_KEY = "momentWorkspaceAccountV2";
  const RELOAD_KEY = "momentWorkspaceReloadV2";
  const DATA_KEYS = [
    "boringLogAppState",
    "moment-lab-custody-v1",
    "moment-lab-custody-archive-v1",
    "moment-job-calendar-v1",
    "moment-scheduling-contacts-v1",
    "moment-scheduling-team-v1",
    "momentAccessControlV1"
  ];
  let activeAccountId = "";
  let applying = false;
  let saveTimer = 0;
  let saveInFlight = false;
  let saveAgain = false;

  const nativeSetItem = Storage.prototype.setItem;
  const nativeRemoveItem = Storage.prototype.removeItem;
  const readTokenPayload = token => {
    try {
      const body = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      return JSON.parse(decodeURIComponent(atob(body).split("").map(char => `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`).join("")));
    } catch { return {}; }
  };
  const accountIdFor = token => readTokenPayload(token).sub || "";
  const stateIdFor = token => {
    const id = accountIdFor(token);
    return id ? `account-${id}` : "";
  };
  const snapshot = () => ({
    version: 2,
    accountId: activeAccountId || accountIdFor(localStorage.getItem(TOKEN_KEY) || ""),
    storage: Object.fromEntries(DATA_KEYS.flatMap(key => {
      const value = localStorage.getItem(key);
      return value === null ? [] : [[key, value]];
    }))
  });
  const normalizeCloudState = state => {
    if (state?.version === 2 && state.storage) return state;
    if (state && (Array.isArray(state.projects) || Array.isArray(state.borings))) {
      return { version: 2, storage: { boringLogAppState: JSON.stringify(state) } };
    }
    return { version: 2, storage: {} };
  };
  const applySnapshot = state => {
    const normalized = normalizeCloudState(state);
    applying = true;
    try {
      DATA_KEYS.forEach(key => {
        if (Object.prototype.hasOwnProperty.call(normalized.storage, key)) nativeSetItem.call(localStorage, key, normalized.storage[key]);
        else nativeRemoveItem.call(localStorage, key);
      });
    } finally { applying = false; }
  };
  const request = async (path, options = {}, token = localStorage.getItem(TOKEN_KEY) || "") => {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      ...options,
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(options.headers || {}) }
    });
    if (!response.ok) throw new Error((await response.text()) || `Workspace sync failed (${response.status})`);
    return response.status === 204 ? null : response.json();
  };
  const save = async () => {
    const token = localStorage.getItem(TOKEN_KEY) || "";
    const id = stateIdFor(token);
    if (!id || applying) return;
    if (saveInFlight) { saveAgain = true; return; }
    saveInFlight = true;
    try {
      await request(`${TABLE}?on_conflict=id`, {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({ id, state: snapshot(), updated_at: new Date().toISOString(), updated_by: localStorage.getItem(USER_KEY) || "unknown" })
      }, token);
    } finally {
      saveInFlight = false;
      if (saveAgain) { saveAgain = false; scheduleSave(); }
    }
  };
  const scheduleSave = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => save().catch(error => console.error("Workspace auto-sync failed.", error)), 700);
  };
  Storage.prototype.setItem = function(key, value) {
    nativeSetItem.call(this, key, value);
    if (this === localStorage && DATA_KEYS.includes(String(key)) && !applying && activeAccountId) scheduleSave();
  };
  Storage.prototype.removeItem = function(key) {
    nativeRemoveItem.call(this, key);
    if (this === localStorage && DATA_KEYS.includes(String(key)) && !applying && activeAccountId) scheduleSave();
  };

  async function activate(token = localStorage.getItem(TOKEN_KEY) || "") {
    const accountId = accountIdFor(token);
    const stateId = stateIdFor(token);
    if (!accountId || !stateId) return { loaded: false };
    const previousAccount = localStorage.getItem(DEVICE_ACCOUNT_KEY) || "";
    const switchingAccounts = Boolean(previousAccount && previousAccount !== accountId);
    if (switchingAccounts) applySnapshot({ version: 2, storage: {} });
    activeAccountId = accountId;
    const rows = await request(`${TABLE}?id=eq.${encodeURIComponent(stateId)}&select=state,updated_at&limit=1`, {}, token);
    if (rows?.[0]?.state) {
      const before = JSON.stringify(snapshot().storage);
      applySnapshot(rows[0].state);
      nativeSetItem.call(localStorage, DEVICE_ACCOUNT_KEY, accountId);
      return { loaded: true, changed: before !== JSON.stringify(snapshot().storage) };
    }
    nativeSetItem.call(localStorage, DEVICE_ACCOUNT_KEY, accountId);
    await save();
    return { loaded: false, created: true };
  }

  async function boot() {
    const token = localStorage.getItem(TOKEN_KEY) || "";
    if (!token) return;
    try {
      const result = await activate(token);
      const page = (location.pathname.split("/").pop() || "index.html").toLowerCase();
      if (result.changed && page !== "worker-login.html" && sessionStorage.getItem(RELOAD_KEY) !== activeAccountId) {
        sessionStorage.setItem(RELOAD_KEY, activeAccountId);
        location.reload();
      } else {
        sessionStorage.removeItem(RELOAD_KEY);
      }
    } catch (error) {
      console.error("Workspace cloud load failed.", error);
    }
  }

  window.MomentWorkspaceCloud = { activate, boot, save, scheduleSave, snapshot, stateIdFor, normalizeCloudState };
})();
