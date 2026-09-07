const { json, options, readBody, getOwnerKey } = require("../_lib/http");
const { getSupabaseAdmin } = require("../_lib/supabase");
const {
  isSafeOwnerKey,
  sanitizeText,
  sanitizeObjectKeySegment,
  ALLOWED_UPLOAD_MIME_TYPES,
  MAX_UPLOAD_BYTES,
} = require("../_lib/validation");
const { getR2Config } = require("../_lib/r2");

module.exports = async (req, res) => {
  if (options(req, res)) return;
  if (req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed" });
  }
  const ownerKey = getOwnerKey(req);
  if (!isSafeOwnerKey(ownerKey)) {
    return json(res, 400, { error: "Invalid owner key" });
  }
  const db = getSupabaseAdmin();
  const r2 = getR2Config();
  if (!db) return json(res, 503, { error: "Supabase is not configured" });
  if (!r2) return json(res, 503, { error: "R2 is not configured" });

  const body = await readBody(req);
  const objectKeyRaw = sanitizeText(body.objectKey, 512).trim();
  const objectKey = objectKeyRaw
    .split("/")
    .map((s) => sanitizeObjectKeySegment(s, "part"))
    .join("/");
  const fileName = sanitizeText(body.fileName, 240).trim();
  const mimeType = sanitizeText(body.mimeType, 120).trim().toLowerCase();
  const sizeBytes = Number(body.sizeBytes);
  if (!objectKeyRaw || objectKey !== objectKeyRaw) {
    return json(res, 400, { error: "Invalid objectKey" });
  }
  if (!fileName) return json(res, 400, { error: "fileName is required" });
  if (!ALLOWED_UPLOAD_MIME_TYPES.has(mimeType)) {
    return json(res, 400, { error: "Unsupported file type" });
  }
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_UPLOAD_BYTES) {
    return json(res, 400, { error: "Invalid file size" });
  }

  const row = {
    owner_key: ownerKey,
    source_id: body.sourceId || null,
    highlight_id: body.highlightId || null,
    conversion_id: body.conversionId || null,
    storage_provider: "r2",
    bucket: r2.bucket,
    object_key: objectKey,
    file_name: fileName,
    mime_type: mimeType,
    size_bytes: sizeBytes,
    sha256: body.sha256 || null,
  };

  try {
    const { data, error } = await db.from("files").insert(row).select().single();
    if (error) throw error;
    return json(res, 200, { file: data });
  } catch (err) {
    return json(res, 500, { error: err.message || "Failed to register file metadata" });
  }
};
