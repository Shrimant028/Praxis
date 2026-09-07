const { json, options, getOwnerKey } = require("../_lib/http");
const { getSupabaseAdmin } = require("../_lib/supabase");
const { isSafeOwnerKey } = require("../_lib/validation");

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
  if (!db) {
    return json(res, 503, { error: "Supabase is not configured" });
  }

  try {
    const conversionsRes = await db
      .from("conversions")
      .delete()
      .eq("owner_key", ownerKey);
    if (conversionsRes.error) throw conversionsRes.error;

    const highlightsRes = await db
      .from("highlights")
      .delete()
      .eq("owner_key", ownerKey);
    if (highlightsRes.error) throw highlightsRes.error;

    const filesRes = await db.from("files").delete().eq("owner_key", ownerKey);
    if (filesRes.error) throw filesRes.error;

    const sourcesRes = await db.from("sources").delete().eq("owner_key", ownerKey);
    if (sourcesRes.error) throw sourcesRes.error;

    return json(res, 200, { ok: true });
  } catch (err) {
    return json(res, 500, { error: err.message || "Clear failed" });
  }
};
