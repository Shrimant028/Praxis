const { json, options, readBody, getOwnerKey } = require("../_lib/http");
const { getSupabaseAdmin } = require("../_lib/supabase");
const { isSafeOwnerKey, sanitizeSource, sanitizeText } = require("../_lib/validation");
const { sourceToRow, sourceFromRow } = require("../_lib/data-mapper");

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
        .from("sources")
        .select("*")
        .eq("owner_key", ownerKey)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return json(res, 200, { items: (data || []).map(sourceFromRow) });
    }

    const body = await readBody(req);
    if (req.method === "POST") {
      const source = sanitizeSource(body);
      if (!source) return json(res, 400, { error: "Invalid source payload" });
      const { data, error } = await db
        .from("sources")
        .upsert(sourceToRow(source, ownerKey), { onConflict: "id" })
        .select()
        .single();
      if (error) throw error;
      return json(res, 200, { item: sourceFromRow(data) });
    }

    if (req.method === "PATCH") {
      const id = sanitizeText(body.id, 128).trim();
      if (!id) return json(res, 400, { error: "Missing id" });
      const patch = {};
      if (body.title != null) patch.title = sanitizeText(body.title, 500).trim();
      if (body.author != null) patch.author = sanitizeText(body.author, 500).trim();
      if (body.type != null) patch.type = sanitizeText(body.type, 64).trim();
      if (body.color != null) patch.color = sanitizeText(body.color, 32).trim();
      if (body.updatedAt != null) patch.updated_at = body.updatedAt;
      if (!Object.keys(patch).length) return json(res, 400, { error: "No fields to update" });
      const { data, error } = await db
        .from("sources")
        .update(patch)
        .eq("owner_key", ownerKey)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return json(res, 200, { item: sourceFromRow(data) });
    }

    if (req.method === "DELETE") {
      const id = sanitizeText(body.id, 128).trim();
      if (!id) return json(res, 400, { error: "Missing id" });
      const { error } = await db
        .from("sources")
        .delete()
        .eq("owner_key", ownerKey)
        .eq("id", id);
      if (error) throw error;
      return json(res, 200, { ok: true });
    }

    return json(res, 405, { error: "Method not allowed" });
  } catch (err) {
    return json(res, 500, { error: err.message || "Source API failure" });
  }
};
