// Source resolver — the three Creative Source categorizations the Configure step offers
// collapse to ONE set of entries, so every report route shares the same path.
//
//   { mode: "brand",      value: ["Vela", "Norvent"] }   → entries of those brands
//   { mode: "audit",      value: "local" | "global" | "both" }
//   { mode: "collection", value: "<collection_id>" }     → members of a CS collection
//
// resolveSource returns { entries, count, label }. Pass a Supabase client (service-role on
// the server). Selection columns match what the report routes already read.

// Columns that actually exist on creative_source. NOTE: posted_at is NOT one of them —
// it lives inside custom_dimensions._meta. Selecting a column that doesn't exist makes
// PostgREST fail the whole query and return no rows, which reads as "0 cases".
const ENTRY_COLS =
  "id,competitor,brand,brand_name,scope,communication_intent,channel,year,rating,country,type," +
  "primary_territory,brand_archetype,tone_of_voice,execution_style,main_slogan,synopsis,description," +
  "analyst_comment,url,image_url,custom_dimensions";

const brandOf = (e) => e.competitor || e.brand || e.brand_name || "";

export async function resolveSource(supabase, projectId, { mode, value } = {}) {
  if (!projectId) return { entries: [], count: 0, label: "" };

  const base = () => supabase.from("creative_source").select(ENTRY_COLS).eq("project_id", projectId);

  if (mode === "audit") {
    const scope = value || "both";
    let q = base();
    if (scope === "local") q = q.eq("scope", "local");
    else if (scope === "global") q = q.eq("scope", "global");
    // "both" → no scope filter
    const { data, error } = await q;
    if (error) throw new Error(`resolveSource(audit): ${error.message}`);
    const entries = data || [];
    return { entries, count: entries.length, label: scope === "both" ? "Local + Global" : scope[0].toUpperCase() + scope.slice(1) };
  }

  if (mode === "collection") {
    if (!value) return { entries: [], count: 0, label: "Collection" };
    const { data: members } = await supabase.from("collection_entries").select("entry_id").eq("collection_id", value);
    const ids = (members || []).map((m) => m.entry_id).filter(Boolean);
    if (!ids.length) return { entries: [], count: 0, label: "Collection (empty)" };
    // Chunk the id filter — Postgres `in` lists shouldn't grow unbounded.
    const entries = [];
    for (let i = 0; i < ids.length; i += 200) {
      const { data, error } = await supabase.from("creative_source").select(ENTRY_COLS).in("id", ids.slice(i, i + 200));
      if (error) throw new Error(`resolveSource(collection): ${error.message}`);
      if (data) entries.push(...data);
    }
    return { entries, count: entries.length, label: "Collection" };
  }

  // default: mode === "brand"
  const brands = (Array.isArray(value) ? value : [value]).filter(Boolean);
  const { data, error } = await base();
  if (error) throw new Error(`resolveSource(brand): ${error.message}`);
  const all = data || [];
  const entries = brands.length ? all.filter((e) => brands.includes(brandOf(e))) : all;
  return { entries, count: entries.length, label: brands.length ? brands.join(", ") : "All brands" };
}

// Count only — for the live "N cases resolved" figure while configuring, without hauling
// full rows. Falls back to resolveSource().count for collection/brand (which need the rows).
export async function countSource(supabase, projectId, sel) {
  if (!projectId) return 0;
  if (sel?.mode === "audit") {
    let q = supabase.from("creative_source").select("id", { count: "exact", head: true }).eq("project_id", projectId);
    if (sel.value === "local") q = q.eq("scope", "local");
    else if (sel.value === "global") q = q.eq("scope", "global");
    const { count } = await q;
    return count || 0;
  }
  const { count } = await resolveSource(supabase, projectId, sel);
  return count;
}
