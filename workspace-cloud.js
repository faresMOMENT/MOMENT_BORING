(() => {
  const SUPABASE_URL = "https://fuivzblvhjuuzhygdeln.supabase.co";
  const SUPABASE_KEY = "sb_publishable_Kcy_SCyyVSeYWRJLLcV1IA_I1dHFSYe";
  const TABLE = "field_app_state";
  const TOKEN_KEY = "boringLogSupabaseAccessToken";
  const REFRESH_KEY = "boringLogSupabaseRefreshToken";
  const USER_KEY = "boringLogCurrentUser";
  const DEVICE_ACCOUNT_KEY = "momentWorkspaceAccountV2";
  const RELOAD_KEY = "momentWorkspaceReloadV2";
  const BOOT_KEY = "momentWorkspaceBootV2";
  const KEY_TIMES_KEY = "momentWorkspaceKeyTimesV3";
  const DATA_KEYS = [
    "boringLogAppState",
    "moment-lab-custody-v1",
    "moment-lab-custody-archive-v1",
    "moment-job-calendar-v1",
    "moment-scheduling-contacts-v1",
    "moment-scheduling-team-v1",
    "moment-proposals-v1",
    "moment-project-maps-v1",
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
    version: 3,
    accountId: activeAccountId || accountIdFor(localStorage.getItem(TOKEN_KEY) || ""),
    keyUpdatedAt: readKeyTimes(),
    storage: Object.fromEntries(DATA_KEYS.flatMap(key => {
      const value = localStorage.getItem(key);
      return value === null ? [] : [[key, value]];
    }))
  });
  const readKeyTimes = () => {
    try { return JSON.parse(localStorage.getItem(KEY_TIMES_KEY) || "{}"); } catch { return {}; }
  };
  const markKeyChanged = key => {
    const times = readKeyTimes();
    times[key] = new Date().toISOString();
    nativeSetItem.call(localStorage, KEY_TIMES_KEY, JSON.stringify(times));
  };
  const normalizeCloudState = state => {
    if (state?.version >= 2 && state.storage) return state;
    if (state && (Array.isArray(state.projects) || Array.isArray(state.borings))) {
      return { version: 2, storage: { boringLogAppState: JSON.stringify(state) } };
    }
    return { version: 2, storage: {} };
  };
  const mergeArrayById = (older = [], newer = []) => {
    if (!Array.isArray(older) || !Array.isArray(newer)) return newer;
    const result = older.map(item => item && typeof item === "object" ? { ...item } : item);
    newer.forEach((item, index) => {
      if (!item || typeof item !== "object") { if (!result.includes(item)) result.push(item); return; }
      const identity = item.id || item.sourceProjectId || item.projectNumber || item.sampleNumber;
      const match = identity
        ? result.findIndex(candidate => candidate && typeof candidate === "object" && (candidate.id || candidate.sourceProjectId || candidate.projectNumber || candidate.sampleNumber) === identity)
        : index < result.length ? index : -1;
      if (match >= 0) result[match] = mergeObjects(result[match], item);
      else result.push(item);
    });
    return result;
  };
  const mergeObjects = (older, newer) => {
    if (!older || typeof older !== "object") return newer;
    if (!newer || typeof newer !== "object") return newer === undefined ? older : newer;
    if (Array.isArray(older) || Array.isArray(newer)) return mergeArrayById(older, newer);
    const result = { ...older };
    Object.keys(newer).forEach(key => {
      const next = newer[key];
      result[key] = next && typeof next === "object" && result[key] && typeof result[key] === "object"
        ? mergeObjects(result[key], next)
        : next;
    });
    return result;
  };
  const mergeStoredJson = (localValue, cloudValue, preferLocal) => {
    if (localValue == null) return cloudValue;
    if (cloudValue == null) return localValue;
    try {
      const local = JSON.parse(localValue), cloud = JSON.parse(cloudValue);
      return JSON.stringify(preferLocal ? mergeObjects(cloud, local) : mergeObjects(local, cloud));
    } catch { return preferLocal ? localValue : cloudValue; }
  };
  const applySnapshot = state => {
    const normalized = normalizeCloudState(state);
    const localTimes = readKeyTimes();
    const cloudTimes = normalized.keyUpdatedAt || {};
    const mergedTimes = { ...cloudTimes, ...localTimes };
    applying = true;
    try {
      DATA_KEYS.forEach(key => {
        const hasCloudValue = Object.prototype.hasOwnProperty.call(normalized.storage, key);
        const localValue = localStorage.getItem(key);
        if (!hasCloudValue) return; // A partial/older cloud snapshot must never erase device work.
        const preferLocal = Boolean(localTimes[key] && (!cloudTimes[key] || localTimes[key] > cloudTimes[key]));
        // Each workspace key is an authoritative document. Deep-merging nested
        // arrays revives deleted records and repeatedly appends stale samples.
        const value = preferLocal && localValue !== null ? localValue : normalized.storage[key];
        nativeSetItem.call(localStorage, key, value);
        mergedTimes[key] = preferLocal ? localTimes[key] : (cloudTimes[key] || localTimes[key] || new Date().toISOString());
      });
      nativeSetItem.call(localStorage, KEY_TIMES_KEY, JSON.stringify(mergedTimes));
    } finally { applying = false; }
  };
  const request = async (path, options = {}, token = localStorage.getItem(TOKEN_KEY) || "") => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    let response;
    try {
      response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        ...options,
        signal: controller.signal,
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(options.headers || {}) }
      });
    } finally { clearTimeout(timeout); }
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
        keepalive: true,
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
    saveTimer = setTimeout(() => save().catch(error => console.error("Workspace auto-sync failed.", error)), 250);
  };
  Storage.prototype.setItem = function(key, value) {
    nativeSetItem.call(this, key, value);
    if (this === localStorage && DATA_KEYS.includes(String(key)) && !applying) {
      markKeyChanged(String(key));
      if (activeAccountId) scheduleSave();
    }
  };
  Storage.prototype.removeItem = function(key) {
    nativeRemoveItem.call(this, key);
    if (this === localStorage && DATA_KEYS.includes(String(key)) && !applying) {
      markKeyChanged(String(key));
      if (activeAccountId) scheduleSave();
    }
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
      const changed = before !== JSON.stringify(snapshot().storage);
      if (changed || Number(rows[0].state.version || 0) < 3) await save();
      return { loaded: true, changed };
    }
    nativeSetItem.call(localStorage, DEVICE_ACCOUNT_KEY, accountId);
    await save();
    return { loaded: false, created: true };
  }

  async function boot() {
    const token = localStorage.getItem(TOKEN_KEY) || "";
    if (!token) return;
    const accountId = accountIdFor(token);
    try {
      const result = await activate(token);
      sessionStorage.setItem(BOOT_KEY, JSON.stringify({ accountId, loadedAt: Date.now() }));
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
  window.addEventListener("pagehide", () => {
    if (activeAccountId) save().catch(() => {});
  });
})();
