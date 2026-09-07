const { json, options, readBody, getOwnerKey } = require("../_lib/http");
const { getSupabaseAdmin } = require("../_lib/supabase");
const {
  isSafeOwnerKey,
  sanitizeConversion,
  sanitizeText,
} = require("../_lib/validation");
const { conversionToRow, conversionFromRow } = require("../_lib/data-mapper");

module.exports = async (req, res) => {
  if (options(req, res)) return;
  const ownerKey = getOwnerKey(req);
  if (!isSafeOwnerKey(ownerKey)) {
    return json(res, 400, { error: "Invalid owner key" });
  }
  const db = getSupabaseAdmin();
  if (!db) {
    return json(res, 503, { error: "Supabase is not configured" });
  }

  try {
    if (req.method === "GET") {
      const { data, error } = await db
        .from("conversions")
        .select("*")
        .eq("owner_key", ownerKey)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return json(res, 200, { items: (data || []).map(conversionFromRow) });
    }

    const body = await readBody(req);
    if (req.method === "POST") {
      const item = sanitizeConversion(body);
      if (!item) return json(res, 400, { error: "Invalid conversion payload" });
      const { data, error } = await db
        .from("conversions")
        .upsert(conversionToRow(item, ownerKey), { onConflict: "id" })
        .select()
        .single();
      if (error) throw error;
      return json(res, 200, { item: conversionFromRow(data) });
    }

    if (req.method === "DELETE") {
      const id = sanitizeText(body.id, 128).trim();
      if (!id) return json(res, 400, { error: "Missing id" });
      const { error } = await db
        .from("conversions")
        .delete()
        .eq("owner_key", ownerKey)
        .eq("id", id);
      if (error) throw error;
      return json(res, 200, { ok: true });
    }

    return json(res, 405, { error: "Method not allowed" });
  } catch (err) {
    return json(res, 500, { error: err.message || "Conversion API failure" });
  }
};
