const { json, options, readBody, getOwnerKey } = require("../_lib/http");
const { getSupabaseAdmin } = require("../_lib/supabase");
const {
  isSafeOwnerKey,
  sanitizeSource,
  sanitizeHighlight,
  sanitizeConversion,
} = require("../_lib/validation");
const {
  sourceToRow,
  highlightToRow,
  conversionToRow,
} = require("../_lib/data-mapper");

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
  const body = await readBody(req);
  const rawSources = Array.isArray(body.sources) ? body.sources : [];
  const rawHighlights = Array.isArray(body.highlights) ? body.highlights : [];
  const rawConversions = Array.isArray(body.conversions) ? body.conversions : [];

  const sources = rawSources.map(sanitizeSource).filter(Boolean);
  const highlights = rawHighlights.map(sanitizeHighlight).filter(Boolean);
  const conversions = rawConversions.map(sanitizeConversion).filter(Boolean);

  try {
    if (sources.length) {
      const { error } = await db
        .from("sources")
        .upsert(sources.map((x) => sourceToRow(x, ownerKey)), { onConflict: "id" });
      if (error) throw error;
    }
    if (highlights.length) {
      const { error } = await db
        .from("highlights")
        .upsert(highlights.map((x) => highlightToRow(x, ownerKey)), { onConflict: "id" });
      if (error) throw error;
    }
    if (conversions.length) {
      const { error } = await db
        .from("conversions")
        .upsert(conversions.map((x) => conversionToRow(x, ownerKey)), { onConflict: "id" });
      if (error) throw error;
    }
    return json(res, 200, {
      ok: true,
      migrated: {
        sources: sources.length,
        highlights: highlights.length,
        conversions: conversions.length,
      },
    });
  } catch (err) {
    return json(res, 500, { error: err.message || "Migration failed" });
  }
};
