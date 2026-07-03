// js/data.js
// Praxis data layer — all persistence is via localStorage.
// Keys: praxis_sources, praxis_highlights, praxis_conversions

const KEYS = {
  sources: "praxis_sources",
  highlights: "praxis_highlights",
  conversions: "praxis_conversions",
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

// ---------- internal helpers ----------

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    console.warn(`[data] failed to parse ${key}:`, e);
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.error(`[data] failed to write ${key}:`, e);
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

function pickColor() {
  const existing = getSources();
  const usedCounts = {};
  existing.forEach((s) => {
    usedCounts[s.color] = (usedCounts[s.color] || 0) + 1;
  });
  // Prefer least-used color
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

// ---------- Sources ----------

export function getSources() {
  return read(KEYS.sources, []);
}

export function getSource(id) {
  return getSources().find((s) => s.id === id) || null;
}

export function addSource(data) {
  const sources = getSources();
  const source = {
    id: genId(),
    title: (data.title || "Untitled").trim(),
    type: data.type || "custom",
    author: (data.author || "").trim(),
    color: data.color || pickColor(),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  sources.push(source);
  write(KEYS.sources, sources);
  return source;
}

export function updateSource(id, data) {
  const sources = getSources();
  const idx = sources.findIndex((s) => s.id === id);
  if (idx === -1) return null;
  sources[idx] = {
    ...sources[idx],
    ...data,
    updatedAt: nowIso(),
  };
  write(KEYS.sources, sources);
  return sources[idx];
}

export function deleteSource(id) {
  const sources = getSources().filter((s) => s.id !== id);
  write(KEYS.sources, sources);
  // Cascade delete highlights + their conversions
  const allHighlights = getHighlights();
  const removedHighlightIds = allHighlights
    .filter((h) => h.sourceId === id)
    .map((h) => h.id);
  const remainingHighlights = allHighlights.filter(
    (h) => h.sourceId !== id
  );
  write(KEYS.highlights, remainingHighlights);
  if (removedHighlightIds.length) {
    const remainingConversions = getConversions().filter(
      (c) => !removedHighlightIds.includes(c.highlightId)
    );
    write(KEYS.conversions, remainingConversions);
  }
}

// ---------- Highlights ----------

export function getHighlights(sourceId) {
  const all = read(KEYS.highlights, []);
  if (sourceId) return all.filter((h) => h.sourceId === sourceId);
  return all;
}

export function getHighlight(id) {
  return getHighlights().find((h) => h.id === id) || null;
}

export function addHighlight(data) {
  const all = getHighlights();
  const hl = {
    id: genId(),
    sourceId: data.sourceId,
    text: (data.text || "").trim(),
    tags: Array.isArray(data.tags) ? data.tags : [],
    note: (data.note || "").trim(),
    converted: false,
    createdAt: nowIso(),
  };
  all.push(hl);
  write(KEYS.highlights, all);
  // Touch source updatedAt
  if (hl.sourceId) {
    updateSource(hl.sourceId, {});
  }
  return hl;
}

export function updateHighlight(id, data) {
  const all = getHighlights();
  const idx = all.findIndex((h) => h.id === id);
  if (idx === -1) return null;
  all[idx] = { ...all[idx], ...data };
  write(KEYS.highlights, all);
  return all[idx];
}

export function deleteHighlight(id) {
  const all = getHighlights().filter((h) => h.id !== id);
  write(KEYS.highlights, all);
  const conversions = getConversions().filter(
    (c) => c.highlightId !== id
  );
  write(KEYS.conversions, conversions);
}

// ---------- Conversions ----------

export function getConversions(highlightId) {
  const all = read(KEYS.conversions, []);
  if (highlightId) return all.filter((c) => c.highlightId === highlightId);
  return all;
}

export function addConversion(data) {
  const all = getConversions();
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
  all.push(conv);
  write(KEYS.conversions, all);
  // Mark highlight as converted
  if (conv.highlightId) {
    updateHighlight(conv.highlightId, { converted: true });
  }
  return conv;
}

// ---------- Storage usage ----------

export function getStorageUsage() {
  let totalBytes = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      const val = localStorage.getItem(key) || "";
      // Each char in localStorage is UTF-16, ~2 bytes
      totalBytes += (key.length + val.length) * 2;
    }
  } catch (e) {
    return { used: 0, percent: 0 };
  }
  // Most browsers cap localStorage at ~5MB
  const quota = 5 * 1024 * 1024;
  const percent = Math.min(100, (totalBytes / quota) * 100);
  return { used: totalBytes, percent };
}

// ---------- Danger zone ----------

export function clearAll() {
  write(KEYS.sources, []);
  write(KEYS.highlights, []);
  write(KEYS.conversions, []);
}

// ---------- Seed (only if first run) ----------

export function seedIfEmpty() {
  if (getSources().length > 0) return;
  const book = addSource({
    title: "Atomic Habits",
    type: "book",
    author: "James Clear",
  });
  addHighlight({
    sourceId: book.id,
    text: "You do not rise to the level of your goals. You fall to the level of your systems.",
    tags: ["systems", "habits"],
    note: "This reframes every failed goal as a systems-design problem.",
    converted: false,
  });
  addHighlight({
    sourceId: book.id,
    text: "Habits are the compound interest of self-improvement.",
    tags: ["compounding"],
    converted: false,
  });

  const article = addSource({
    title: "Deep Work",
    type: "article",
    author: "Cal Newport",
  });
  addHighlight({
    sourceId: article.id,
    text: "The ability to perform deep work is becoming increasingly rare at exactly the same time it is becoming increasingly valuable.",
    tags: ["focus", "deep-work"],
    converted: false,
  });
}
