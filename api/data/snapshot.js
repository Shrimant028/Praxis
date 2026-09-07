const { json, options, getOwnerKey } = require("../_lib/http");
const { getSupabaseAdmin } = require("../_lib/supabase");
const { isSafeOwnerKey } = require("../_lib/validation");
const {
  sourceFromRow,
  highlightFromRow,
  conversionFromRow,
} = require("../_lib/data-mapper");

module.exports = async (req, res) => {
  if (options(req, res)) return;
  if (req.method !== "GET") {
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
    const [sourcesRes, highlightsRes, conversionsRes] = await Promise.all([
      db.from("sources").select("*").eq("owner_key", ownerKey),
      db.from("highlights").select("*").eq("owner_key", ownerKey),
      db.from("conversions").select("*").eq("owner_key", ownerKey),
    ]);
    if (sourcesRes.error || highlightsRes.error || conversionsRes.error) {
      throw sourcesRes.error || highlightsRes.error || conversionsRes.error;
    }
    return json(res, 200, {
      sources: (sourcesRes.data || []).map(sourceFromRow),
      highlights: (highlightsRes.data || []).map(highlightFromRow),
      conversions: (conversionsRes.data || []).map(conversionFromRow),
      sourceOfTruth: "supabase",
    });
  } catch (err) {
    return json(res, 500, { error: err.message || "Failed to load snapshot" });
  }
};
