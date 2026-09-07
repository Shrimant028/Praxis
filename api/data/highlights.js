const { json, options, readBody, getOwnerKey } = require("../_lib/http");
const { getSupabaseAdmin } = require("../_lib/supabase");
const {
  isSafeOwnerKey,
  sanitizeHighlight,
  sanitizeText,
} = require("../_lib/validation");
const { highlightToRow, highlightFromRow } = require("../_lib/data-mapper");

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
        .from("highlights")
        .select("*")
        .eq("owner_key", ownerKey)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return json(res, 200, { items: (data || []).map(highlightFromRow) });
    }

    const body = await readBody(req);
    if (req.method === "POST") {
      const item = sanitizeHighlight(body);
      if (!item) return json(res, 400, { error: "Invalid highlight payload" });
      const { data, error } = await db
        .from("highlights")
        .upsert(highlightToRow(item, ownerKey), { onConflict: "id" })
        .select()
        .single();
      if (error) throw error;
      return json(res, 200, { item: highlightFromRow(data) });
    }

    if (req.method === "PATCH") {
      const id = sanitizeText(body.id, 128).trim();
      if (!id) return json(res, 400, { error: "Missing id" });
      const patch = {};
      if (body.text != null) patch.text = sanitizeText(body.text).trim();
      if (body.note != null) patch.note = sanitizeText(body.note, 10000).trim();
      if (body.tags != null && Array.isArray(body.tags)) patch.tags = body.tags;
      if (body.converted != null) patch.converted = Boolean(body.converted);
      const { data, error } = await db
        .from("highlights")
        .update(patch)
        .eq("owner_key", ownerKey)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return json(res, 200, { item: highlightFromRow(data) });
    }

    if (req.method === "DELETE") {
      const id = sanitizeText(body.id, 128).trim();
      if (!id) return json(res, 400, { error: "Missing id" });
      const { error } = await db
        .from("highlights")
        .delete()
        .eq("owner_key", ownerKey)
        .eq("id", id);
      if (error) throw error;
      return json(res, 200, { ok: true });
    }

    return json(res, 405, { error: "Method not allowed" });
  } catch (err) {
    return json(res, 500, { error: err.message || "Highlight API failure" });
  }
};
