const { json, options, readBody, getOwnerKey } = require("../_lib/http");
const {
  isSafeOwnerKey,
  validateUploadRequest,
  sanitizeObjectKeySegment,
} = require("../_lib/validation");
const { getR2Config, createSignedUploadUrl } = require("../_lib/r2");

module.exports = async (req, res) => {
  if (options(req, res)) return;
  if (req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed" });
  }
  const ownerKey = getOwnerKey(req);
  if (!isSafeOwnerKey(ownerKey)) {
    return json(res, 400, { error: "Invalid owner key" });
  }
  const cfg = getR2Config();
  if (!cfg) {
    return json(res, 503, { error: "R2 is not configured" });
  }

  const body = await readBody(req);
  const validated = validateUploadRequest(body);
  if (!validated.ok) {
    return json(res, 400, { error: validated.error });
  }

  const payload = validated.value;
  const kind = payload.conversionId ? "exports" : "raw";
  const sourcePart = sanitizeObjectKeySegment(payload.sourceId || "unlinked");
  const filenamePart = sanitizeObjectKeySegment(payload.fileName, "upload.bin");
  const ts = Date.now();
  const nonce = Math.random().toString(36).slice(2, 8);
  const objectKey = `${kind}/${sanitizeObjectKeySegment(ownerKey)}/${sourcePart}/${ts}-${nonce}-${filenamePart}`;

  try {
    const uploadUrl = await createSignedUploadUrl({
      bucket: cfg.bucket,
      objectKey,
      mimeType: payload.mimeType,
      expiresIn: 900,
    });
    if (!uploadUrl) {
      return json(res, 503, { error: "R2 is not configured" });
    }
    return json(res, 200, {
      uploadUrl,
      objectKey,
      bucket: cfg.bucket,
      expiresInSeconds: 900,
      requiredHeaders: {
        "Content-Type": payload.mimeType,
      },
    });
  } catch (err) {
    return json(res, 500, { error: err.message || "Failed to sign upload URL" });
  }
};
