const ALLOWED_UPLOAD_MIME_TYPES = new Set([
  "text/plain",
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

function isIsoDate(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function isSafeId(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 128;
}

function isSafeOwnerKey(value) {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{8,128}$/.test(value);
}

function sanitizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function sanitizeText(value, max = 100000) {
  if (typeof value !== "string") return "";
  return value.slice(0, max);
}

function sanitizeSource(input) {
  const data = input || {};
  if (!isSafeId(data.id)) return null;
  if (!isIsoDate(data.createdAt) || !isIsoDate(data.updatedAt)) return null;
  const title = sanitizeText(data.title, 500).trim();
  const type = sanitizeText(data.type, 64).trim() || "custom";
  const author = sanitizeText(data.author, 500).trim();
  const color = sanitizeText(data.color, 32).trim() || "#c8ff00";
  if (!title) return null;
  return {
    id: data.id,
    title,
    type,
    author,
    color,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

function sanitizeHighlight(input) {
  const data = input || {};
  if (!isSafeId(data.id) || !isSafeId(data.sourceId)) return null;
  if (!isIsoDate(data.createdAt)) return null;
  const text = sanitizeText(data.text).trim();
  if (!text) return null;
  const tags = sanitizeArray(data.tags).map((t) => sanitizeText(String(t), 80));
  return {
    id: data.id,
    sourceId: data.sourceId,
    text,
    tags,
    note: sanitizeText(data.note, 10000).trim(),
    converted: Boolean(data.converted),
    createdAt: data.createdAt,
  };
}

function sanitizeConversion(input) {
  const data = input || {};
  if (!isSafeId(data.id) || !isIsoDate(data.createdAt)) return null;
  const questions = sanitizeArray(data.questions).map((q) =>
    sanitizeText(String(q), 3000)
  );
  const answers = sanitizeArray(data.answers).map((a) =>
    sanitizeText(String(a), 10000)
  );
  return {
    id: data.id,
    highlightId: data.highlightId && isSafeId(data.highlightId) ? data.highlightId : null,
    sourceId: data.sourceId && isSafeId(data.sourceId) ? data.sourceId : null,
    insight: sanitizeText(data.insight),
    questions,
    answers,
    intentionFull: sanitizeText(data.intentionFull, 10000),
    intentionWhy: sanitizeText(data.intentionWhy, 10000),
    createdAt: data.createdAt,
  };
}

function sanitizeObjectKeySegment(value, fallback = "file") {
  const raw = sanitizeText(value || fallback, 120);
  const safe = raw.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^_+|_+$/g, "");
  return safe || fallback;
}

function validateUploadRequest(body) {
  const fileName = sanitizeText(body.fileName || "", 240).trim();
  const mimeType = sanitizeText(body.mimeType || "", 120).trim().toLowerCase();
  const sizeBytes = Number(body.sizeBytes);
  if (!fileName) return { ok: false, error: "fileName is required" };
  if (!ALLOWED_UPLOAD_MIME_TYPES.has(mimeType)) {
    return { ok: false, error: "Unsupported file type" };
  }
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_UPLOAD_BYTES) {
    return { ok: false, error: "Invalid file size" };
  }
  return {
    ok: true,
    value: {
      fileName,
      mimeType,
      sizeBytes,
      sourceId: body.sourceId && isSafeId(body.sourceId) ? body.sourceId : null,
      highlightId: body.highlightId && isSafeId(body.highlightId) ? body.highlightId : null,
      conversionId: body.conversionId && isSafeId(body.conversionId) ? body.conversionId : null,
    },
  };
}

module.exports = {
  ALLOWED_UPLOAD_MIME_TYPES,
  MAX_UPLOAD_BYTES,
  isSafeOwnerKey,
  sanitizeSource,
  sanitizeHighlight,
  sanitizeConversion,
  validateUploadRequest,
  sanitizeObjectKeySegment,
  sanitizeText,
};
