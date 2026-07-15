// project_brands — normalized, project-scoped brand registry (Competitive Landscape
// source of truth; see docs/competitive-landscape.md). During the transition the
// legacy arrays in project_frameworks (local_competitors/global_benchmarks) are kept
// in sync via syncProjectBrands (dual-write from settings), and the framework loaders
// PREFER project_brands when it has rows, falling back to the arrays otherwise.

const norm = (s) => String(s || "").trim().toLowerCase();
const firstUrl = (w) => (Array.isArray(w) ? (w[0] || null) : (w || null));

export async function listProjectBrands(supabase, projectId, { includeArchived = false } = {}) {
  if (!projectId) return [];
  let q = supabase.from("project_brands").select("*").eq("project_id", projectId).order("sort_order").order("created_at");
  if (!includeArchived) q = q.eq("archived", false);
  const { data } = await q;
  return data || [];
}

// Derive the legacy framework shapes from project_brands rows (active only), so
// consumers of useFramework()/loadFramework() keep working unchanged.
export function deriveFrameworkLists(rows = []) {
  const active = rows.filter((b) => b && !b.archived);
  const locals = active.filter((b) => b.role === "direct" || b.role === "adjacent");
  const globals = active.filter((b) => b.role === "global");
  return {
    principalBrand: active.find((b) => b.role === "principal") || null,
    projectBrands: active,
    localCompetitors: locals.map((b) => ({
      name: b.name, type: b.role,
      category: b.category || undefined, sub_category: b.sub_category || undefined,
      website: b.website ? [b.website] : undefined, social: b.social || undefined,
    })),
    globalBenchmarks: globals.map((b) => ({
      name: b.name, country: b.country || undefined,
      website: b.website ? [b.website] : undefined, social: b.social || undefined,
    })),
  };
}

// Mirror the legacy arrays into project_brands. Upserts by (project, normalized name),
// un-archives re-added brands, and ARCHIVES (soft-delete) brands that disappeared from
// the arrays — content in creative_source is preserved (docs §8, archive-on-delete).
export async function syncProjectBrands(supabase, projectId, { brandName = "", locals = [], globals = [] } = {}) {
  if (!projectId) return;
  const { data: existing } = await supabase.from("project_brands").select("id,name,role,archived").eq("project_id", projectId);
  const rows = existing || [];

  const desired = [];
  if (String(brandName || "").trim()) desired.push({ name: String(brandName).trim(), role: "principal" });
  (locals || []).forEach((c, i) => {
    if (!c?.name) return;
    desired.push({
      name: String(c.name).trim(),
      role: /adjacent/i.test(c.type || "") ? "adjacent" : "direct",
      category: c.category || null, sub_category: c.sub_category || null,
      website: firstUrl(c.website), sort_order: i,
    });
  });
  (globals || []).forEach((g, i) => {
    if (!g?.name) return;
    desired.push({ name: String(g.name).trim(), role: "global", country: g.country || null, website: firstUrl(g.website), sort_order: i });
  });

  const now = new Date().toISOString();
  for (const d of desired) {
    const ex = rows.find((r) => norm(r.name) === norm(d.name));
    if (ex) {
      // Never downgrade website to null on sync (arrays may lack what the registry has).
      const upd = { ...d, archived: false, updated_at: now };
      if (upd.website == null) delete upd.website;
      await supabase.from("project_brands").update(upd).eq("id", ex.id);
    } else {
      await supabase.from("project_brands").insert({ ...d, project_id: projectId });
    }
  }

  // Archive brands no longer present in the arrays (soft-delete; content preserved).
  const desiredNames = new Set(desired.map((d) => norm(d.name)));
  for (const r of rows) {
    if (!r.archived && !desiredNames.has(norm(r.name))) {
      await supabase.from("project_brands").update({ archived: true, updated_at: now }).eq("id", r.id);
    }
  }
}
