const { json, options, readBody, getOwnerKey } = require("../_lib/http");
const { getSupabaseAdmin } = require("../_lib/supabase");
const { isSafeOwnerKey, sanitizeText } = require("../_lib/validation");
const { createSignedDownloadUrl } = require("../_lib/r2");

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
  if (!db) return json(res, 503, { error: "Supabase is not configured" });

  const body = await readBody(req);
  const fileId = sanitizeText(body.fileId, 80).trim();
  if (!fileId) return json(res, 400, { error: "fileId is required" });

  try {
    const { data, error } = await db
      .from("files")
      .select("*")
      .eq("owner_key", ownerKey)
      .eq("id", fileId)
      .single();
    if (error || !data) {
      return json(res, 404, { error: "File not found" });
    }
    const downloadUrl = await createSignedDownloadUrl({
      bucket: data.bucket,
      objectKey: data.object_key,
      expiresIn: 900,
    });
    if (!downloadUrl) return json(res, 503, { error: "R2 is not configured" });
    return json(res, 200, {
      downloadUrl,
      fileName: data.file_name,
      mimeType: data.mime_type,
      sizeBytes: data.size_bytes,
      expiresInSeconds: 900,
    });
  } catch (err) {
    return json(res, 500, { error: err.message || "Failed to sign download URL" });
  }
};
