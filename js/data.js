// js/data.js
// Praxis data layer — Supabase-backed APIs are source of truth.
// localStorage is used for migration source, cache, and UI preferences only.

const KEYS = {
  sources: "praxis_sources",
  highlights: "praxis_highlights",
  conversions: "praxis_conversions",
  ownerKey: "praxis_owner_key",
  migrationStatus: "praxis_migration_v1_status",
  migrationAt: "praxis_migration_v1_at",
  mode: "praxis_data_mode",
};

export const COLORS = [
  "#c8ff00",
  "#ff6b35",
  "#4ecdc4",
  "#ffe66d",
  "#c77dff",
  "#ff8b94",
  "#a8e6cf",
  "#ffd93d",
];

const state = {
  ownerKey: null,
  mode: "initializing",
  cache: {
    sources: [],
    highlights: [],
    conversions: [],
  },
};

function readLocal(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    console.warn(`[data] failed to parse ${key}:`, e);
    return fallback;
  }
}

function writeLocal(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.error(`[data] failed to write ${key}:`, e);
    return false;
  }
}

function writeRawLocal(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function genId() {
  return (
    Date.now().toString(36) +
    "-" +
    Math.random().toString(36).slice(2, 8) +
    Math.random().toString(36).slice(2, 4)
  );
}

function nowIso() {
  return new Date().toISOString();
}

function ensureOwnerKey() {
  if (state.ownerKey) return state.ownerKey;
  let existing = "";
  try {
    existing = String(localStorage.getItem(KEYS.ownerKey) || "").trim();
  } catch {}
  if (/^[a-zA-Z0-9_-]{8,128}$/.test(existing)) {
    state.ownerKey = existing;
    return existing;
  }
  const next = `px_${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2, 10)}`;
  writeRawLocal(KEYS.ownerKey, next);
  state.ownerKey = next;
  return next;
}

function setMode(nextMode) {
  state.mode = nextMode;
  writeRawLocal(KEYS.mode, nextMode);
}

async function api(path, { method = "GET", body = null } = {}) {
  const headers = {
    "X-Praxis-Owner-Key": ensureOwnerKey(),
  };
  if (body != null) headers["Content-Type"] = "application/json";
  const res = await fetch(path, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });
  let data = {};
  try {
    data = await res.json();
  } catch {}
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

function cacheToLocal() {
  writeLocal(KEYS.sources, state.cache.sources);
  writeLocal(KEYS.highlights, state.cache.highlights);
  writeLocal(KEYS.conversions, state.cache.conversions);
}

function loadLocalIntoCache() {
  state.cache.sources = readLocal(KEYS.sources, []);
  state.cache.highlights = readLocal(KEYS.highlights, []);
  state.cache.conversions = readLocal(KEYS.conversions, []);
}

function applySnapshot(snapshot) {
  state.cache.sources = Array.isArray(snapshot.sources) ? snapshot.sources : [];
  state.cache.highlights = Array.isArray(snapshot.highlights)
    ? snapshot.highlights
    : [];
  state.cache.conversions = Array.isArray(snapshot.conversions)
    ? snapshot.conversions
    : [];
  cacheToLocal();
}

async function fetchRemoteSnapshot() {
  const snapshot = await api("/api/data/snapshot");
  applySnapshot(snapshot);
  return snapshot;
}

function getMigrationStatus() {
  try {
    return String(localStorage.getItem(KEYS.migrationStatus) || "");
  } catch {
    return "";
  }
}

async function migrateLocalToRemoteIfNeeded() {
  const status = getMigrationStatus();
  if (status === "done") return;
  const localSources = readLocal(KEYS.sources, []);
  const localHighlights = readLocal(KEYS.highlights, []);
  const localConversions = readLocal(KEYS.conversions, []);
  if (
    localSources.length === 0 &&
    localHighlights.length === 0 &&
    localConversions.length === 0
  ) {
    writeRawLocal(KEYS.migrationStatus, "done");
    writeRawLocal(KEYS.migrationAt, nowIso());
    return;
  }
  await api("/api/data/migrate", {
    method: "POST",
    body: {
      schemaVersion: 1,
      sources: localSources,
      highlights: localHighlights,
      conversions: localConversions,
    },
  });
  writeRawLocal(KEYS.migrationStatus, "done");
  writeRawLocal(KEYS.migrationAt, nowIso());
}

export async function initDataLayer() {
  ensureOwnerKey();
  loadLocalIntoCache();
  try {
    await migrateLocalToRemoteIfNeeded();
    await fetchRemoteSnapshot();
    setMode("remote");
  } catch (err) {
    console.warn("[data] remote init failed, using local fallback:", err);
    setMode("local-fallback");
    loadLocalIntoCache();
  }
}

function pickColor() {
  const usedCounts = {};
  state.cache.sources.forEach((s) => {
    usedCounts[s.color] = (usedCounts[s.color] || 0) + 1;
  });
  let best = COLORS[0];
  let bestCount = Infinity;
  for (const c of COLORS) {
    const n = usedCounts[c] || 0;
    if (n < bestCount) {
      bestCount = n;
      best = c;
    }
  }
  return best;
}

function isRemoteMode() {
  return state.mode === "remote";
}

function mustPersistLocally() {
  return state.mode === "local-fallback";
}

// ---------- Sources ----------

export function getSources() {
  return state.cache.sources.slice();
}

export function getSource(id) {
  return state.cache.sources.find((s) => s.id === id) || null;
}

export async function addSource(data) {
  const source = {
    id: genId(),
    title: (data.title || "Untitled").trim(),
    type: data.type || "custom",
    author: (data.author || "").trim(),
    color: data.color || pickColor(),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  if (isRemoteMode()) {
    await api("/api/data/sources", { method: "POST", body: source });
    await fetchRemoteSnapshot();
    return getSource(source.id);
  }
  state.cache.sources.push(source);
  if (mustPersistLocally()) cacheToLocal();
  return source;
}

export async function updateSource(id, data) {
  const existing = getSource(id);
  if (!existing) return null;
  const patch = {
    ...data,
    updatedAt: nowIso(),
  };
  if (isRemoteMode()) {
    await api("/api/data/sources", {
      method: "PATCH",
      body: { id, ...patch },
    });
    await fetchRemoteSnapshot();
    return getSource(id);
  }
  const idx = state.cache.sources.findIndex((s) => s.id === id);
  state.cache.sources[idx] = { ...state.cache.sources[idx], ...patch };
  if (mustPersistLocally()) cacheToLocal();
  return state.cache.sources[idx];
}

export async function deleteSource(id) {
  if (isRemoteMode()) {
    await api("/api/data/sources", { method: "DELETE", body: { id } });
    await fetchRemoteSnapshot();
    return;
  }

  state.cache.sources = state.cache.sources.filter((s) => s.id !== id);
  const removedHighlightIds = state.cache.highlights
    .filter((h) => h.sourceId === id)
    .map((h) => h.id);
  state.cache.highlights = state.cache.highlights.filter((h) => h.sourceId !== id);
  state.cache.conversions = state.cache.conversions.filter(
    (c) => !removedHighlightIds.includes(c.highlightId)
  );
  if (mustPersistLocally()) cacheToLocal();
}

// ---------- Highlights ----------

export function getHighlights(sourceId) {
  if (!sourceId) return state.cache.highlights.slice();
  return state.cache.highlights.filter((h) => h.sourceId === sourceId);
}

export function getHighlight(id) {
  return state.cache.highlights.find((h) => h.id === id) || null;
}

export async function addHighlight(data) {
  const hl = {
    id: genId(),
    sourceId: data.sourceId,
    text: (data.text || "").trim(),
    tags: Array.isArray(data.tags) ? data.tags : [],
    note: (data.note || "").trim(),
    converted: false,
    createdAt: nowIso(),
  };
  if (isRemoteMode()) {
    await api("/api/data/highlights", { method: "POST", body: hl });
    await updateSource(hl.sourceId, {});
    await fetchRemoteSnapshot();
    return getHighlight(hl.id);
  }
  state.cache.highlights.push(hl);
  const src = getSource(hl.sourceId);
  if (src) {
    src.updatedAt = nowIso();
  }
  if (mustPersistLocally()) cacheToLocal();
  return hl;
}

export async function updateHighlight(id, data) {
  const existing = getHighlight(id);
  if (!existing) return null;
  if (isRemoteMode()) {
    await api("/api/data/highlights", {
      method: "PATCH",
      body: { id, ...data },
    });
    await fetchRemoteSnapshot();
    return getHighlight(id);
  }
  const idx = state.cache.highlights.findIndex((h) => h.id === id);
  state.cache.highlights[idx] = { ...state.cache.highlights[idx], ...data };
  if (mustPersistLocally()) cacheToLocal();
  return state.cache.highlights[idx];
}

export async function deleteHighlight(id) {
  if (isRemoteMode()) {
    await api("/api/data/highlights", { method: "DELETE", body: { id } });
    await fetchRemoteSnapshot();
    return;
  }
  state.cache.highlights = state.cache.highlights.filter((h) => h.id !== id);
  state.cache.conversions = state.cache.conversions.filter(
    (c) => c.highlightId !== id
  );
  if (mustPersistLocally()) cacheToLocal();
}

// ---------- Conversions ----------

export function getConversions(highlightId) {
  if (!highlightId) return state.cache.conversions.slice();
  return state.cache.conversions.filter((c) => c.highlightId === highlightId);
}

export async function addConversion(data) {
  const conv = {
    id: genId(),
    highlightId: data.highlightId || null,
    sourceId: data.sourceId || null,
    insight: data.insight || "",
    questions: Array.isArray(data.questions) ? data.questions : [],
    answers: Array.isArray(data.answers) ? data.answers : [],
    intentionFull: data.intentionFull || "",
    intentionWhy: data.intentionWhy || "",
    createdAt: nowIso(),
  };
  if (isRemoteMode()) {
    await api("/api/data/conversions", { method: "POST", body: conv });
    if (conv.highlightId) {
      await api("/api/data/highlights", {
        method: "PATCH",
        body: { id: conv.highlightId, converted: true },
      });
    }
    await fetchRemoteSnapshot();
    return state.cache.conversions.find((c) => c.id === conv.id) || conv;
  }
  state.cache.conversions.push(conv);
  if (conv.highlightId) {
    const idx = state.cache.highlights.findIndex((h) => h.id === conv.highlightId);
    if (idx !== -1) state.cache.highlights[idx].converted = true;
  }
  if (mustPersistLocally()) cacheToLocal();
  return conv;
}

// ---------- Files / R2 ----------

export async function uploadOriginalFile({ file, sourceId = null }) {
  if (!(file instanceof File)) {
    throw new Error("Invalid file");
  }
  const sign = await api("/api/files/sign-upload", {
    method: "POST",
    body: {
      fileName: file.name,
      mimeType: file.type || "text/plain",
      sizeBytes: file.size,
      sourceId,
    },
  });
  const putRes = await fetch(sign.uploadUrl, {
    method: "PUT",
    headers: sign.requiredHeaders || {
      "Content-Type": file.type || "application/octet-stream",
    },
    body: file,
  });
  if (!putRes.ok) {
    throw new Error(`R2 upload failed (${putRes.status})`);
  }
  const registered = await api("/api/files/register", {
    method: "POST",
    body: {
      objectKey: sign.objectKey,
      fileName: file.name,
      mimeType: file.type || "text/plain",
      sizeBytes: file.size,
      sourceId,
    },
  });
  return registered.file;
}

export async function getFileDownloadUrl(fileId) {
  const res = await api("/api/files/sign-download", {
    method: "POST",
    body: { fileId },
  });
  return res;
}

// ---------- Storage usage ----------

export function getStorageUsage() {
  let totalBytes = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      const val = localStorage.getItem(key) || "";
      totalBytes += (key.length + val.length) * 2;
    }
  } catch (e) {
    return { used: 0, percent: 0 };
  }
  const quota = 5 * 1024 * 1024;
  const percent = Math.min(100, (totalBytes / quota) * 100);
  return { used: totalBytes, percent };
}

// ---------- Danger zone ----------

export async function clearAll() {
  if (isRemoteMode()) {
    await api("/api/data/clear", { method: "POST", body: {} });
    await fetchRemoteSnapshot();
  } else {
    state.cache.sources = [];
    state.cache.highlights = [];
    state.cache.conversions = [];
    cacheToLocal();
  }
}

// ---------- Seed (only if first run) ----------

export async function seedIfEmpty() {
  if (getSources().length > 0) return;
  const book = await addSource({
    title: "Atomic Habits",
    type: "book",
    author: "James Clear",
  });
  if (book) {
    await addHighlight({
      sourceId: book.id,
      text: "You do not rise to the level of your goals. You fall to the level of your systems.",
      tags: ["systems", "habits"],
      note: "This reframes every failed goal as a systems-design problem.",
      converted: false,
    });
    await addHighlight({
      sourceId: book.id,
      text: "Habits are the compound interest of self-improvement.",
      tags: ["compounding"],
      converted: false,
    });
  }

  const article = await addSource({
    title: "Deep Work",
    type: "article",
    author: "Cal Newport",
  });
  if (article) {
    await addHighlight({
      sourceId: article.id,
      text: "The ability to perform deep work is becoming increasingly rare at exactly the same time it is becoming increasingly valuable.",
      tags: ["focus", "deep-work"],
      converted: false,
    });
  }
}

export function getDataMode() {
  return state.mode;
}
