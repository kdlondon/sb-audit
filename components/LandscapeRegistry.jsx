"use client";
// Competitive Landscape CRUD over the normalized project_brands registry
// (docs/competitive-landscape.md, step 2). Groups: Principal (highlighted) ·
// Direct competitors · Global references. Adjacent rows render inside Direct
// with a small badge (dedicated UI deferred). Remove = ARCHIVE (soft-delete,
// content preserved) with a restorable "Archived" shelf. Every mutation
// reverse-syncs the legacy arrays in project_frameworks so onboarding and any
// remaining array readers stay consistent during the transition.
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { useFramework } from "@/lib/framework-context";
import CountryInput from "@/components/CountryInput";
import TaxonomyDropdown from "@/components/TaxonomyDropdown";

const norm = (s) => String(s || "").trim().toLowerCase();
const SOCIALS = [
  { key: "instagram", label: "Instagram", ph: "@handle or URL" },
  { key: "tiktok", label: "TikTok", ph: "@handle or URL" },
  { key: "youtube", label: "YouTube", ph: "channel URL or @handle" },
];
const EMPTY_FORM = { name: "", country: "", category: "", sub_category: "", website: "", social: { instagram: "", tiktok: "", youtube: "" } };

export default function LandscapeRegistry({ projectId, orgId }) {
  const supabase = createClient();
  const { framework, refreshFramework } = useFramework() || {};
  const [taxonomyTerms, setTaxonomyTerms] = useState({});
  const [rows, setRows] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [addRole, setAddRole] = useState(null);          // "direct" | "global" | null
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(null);
  const [toast, setToast] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const showToast = (m) => { setToast(m); setTimeout(() => setToast(""), 3000); };

  const load = useCallback(async () => {
    if (!projectId) return;
    const { data } = await supabase.from("project_brands").select("*").eq("project_id", projectId).order("sort_order").order("created_at");
    setRows(data || []);
    // Content counts by brand NAME (content links by string during the transition)
    const { data: entries } = await supabase.from("creative_source").select("competitor,brand,brand_name").eq("project_id", projectId);
    const c = {};
    (entries || []).forEach((e) => { const n = norm(e.competitor || e.brand || e.brand_name); if (n) c[n] = (c[n] || 0) + 1; });
    setCounts(c);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  // Taxonomy (category / sub-category, sub filtered by its parent) — same source as settings.
  const loadTaxonomy = useCallback(async () => {
    const { data: terms } = await supabase.from("taxonomy_terms").select("*").eq("is_active", true).order("sort_order");
    if (terms) {
      const grouped = {};
      terms.forEach((t) => { (grouped[t.taxonomy_type] ||= []).push({ ...t }); });
      setTaxonomyTerms(grouped);
    }
  }, []);
  useEffect(() => { loadTaxonomy(); }, [loadTaxonomy]);
  const categoryOptions = (taxonomyTerms.category || []).map((t) => t.name);
  const getSubCategoryOptions = (cat) => (taxonomyTerms.sub_category || [])
    .filter((t) => {
      if (!cat) return true;
      const parentTerm = (taxonomyTerms.category || []).find((c) => c.name === cat);
      return parentTerm ? t.parent_id === parentTerm.id : true;
    })
    .map((t) => t.name);
  const addTaxonomyTerm = async (type, termName, parentCategory) => {
    const insertData = { organization_id: orgId || null, taxonomy_type: type, name: termName, sort_order: 999, is_active: true };
    if (type === "sub_category" && parentCategory) {
      const parentTerm = (taxonomyTerms.category || []).find((c) => c.name === parentCategory);
      if (parentTerm) insertData.parent_id = parentTerm.id;
    }
    await supabase.from("taxonomy_terms").insert(insertData);
    await loadTaxonomy();
  };

  // Reverse-sync: derive the legacy arrays from active rows and write them back to
  // project_frameworks, then refresh the framework context so every consumer updates.
  const syncArrays = async (allRows) => {
    const active = (allRows || []).filter((b) => !b.archived);
    const locals = active.filter((b) => b.role === "direct" || b.role === "adjacent")
      .map((b) => ({ name: b.name, type: b.role, category: b.category || undefined, sub_category: b.sub_category || undefined, website: b.website ? [b.website] : undefined }));
    const globals = active.filter((b) => b.role === "global")
      .map((b) => ({ name: b.name, country: b.country || undefined, website: b.website ? [b.website] : undefined }));
    try { await supabase.from("project_frameworks").update({ local_competitors: locals, global_benchmarks: globals }).eq("project_id", projectId); } catch {}
    try { refreshFramework?.(); } catch {}
  };

  const reload = async () => {
    const { data } = await supabase.from("project_brands").select("*").eq("project_id", projectId).order("sort_order").order("created_at");
    setRows(data || []);
    await syncArrays(data || []);
  };

  const addBrand = async (role) => {
    const name = form.name.trim();
    if (!name) return;
    if (rows.some((r) => norm(r.name) === norm(name) && !r.archived)) { showToast("Already in the list"); return; }
    setSaving(true);
    const archived = rows.find((r) => norm(r.name) === norm(name) && r.archived);
    const social = Object.fromEntries(Object.entries(form.social).filter(([, v]) => v.trim()));
    if (archived) {
      await supabase.from("project_brands").update({ archived: false, role, updated_at: new Date().toISOString() }).eq("id", archived.id);
      showToast(`${name} restored from archive`);
    } else {
      const { error } = await supabase.from("project_brands").insert({
        project_id: projectId, name, role,
        country: form.country.trim() || null, category: form.category.trim() || null, sub_category: form.sub_category.trim() || null,
        website: form.website.trim() || null, social, sort_order: rows.filter((r) => r.role === role).length,
      });
      if (error) { showToast("Error: " + error.message); setSaving(false); return; }
      showToast(`${name} added`);
    }
    setForm(EMPTY_FORM); setAddRole(null); setSaving(false);
    await reload();
  };

  const updateBrand = async (id, patch) => {
    const upd = { ...patch, updated_at: new Date().toISOString() };
    // A new/changed website re-queues the Brand DNA crawl (the background runner picks it up).
    if ("website" in patch && patch.website) upd.brand_dna_status = "pending";
    const { error } = await supabase.from("project_brands").update(upd).eq("id", id);
    if (error) { showToast("Error: " + error.message); return; }
    await reload();
  };

  const archiveBrand = async (id) => {
    setConfirmArchive(null);
    await updateBrand(id, { archived: true });
    showToast("Archived — content preserved");
  };

  const aiSuggest = async () => {
    setSuggesting(true);
    try {
      const exclude = rows.filter((r) => !r.archived).map((r) => r.name).join(", ");
      const [l, g] = await Promise.all([
        fetch("/api/suggest-competitors", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ brand_name: framework?.brandName || "", industry: framework?.industry || "", market: framework?.primaryMarket || "", type: "local", exclude }) }).then((r) => r.json()),
        fetch("/api/suggest-competitors", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ brand_name: framework?.brandName || "", industry: framework?.industry || "", type: "global", exclude }) }).then((r) => r.json()),
      ]);
      const names = new Set(rows.filter((r) => !r.archived).map((r) => norm(r.name)));
      const sugg = [
        ...(l.suggestions || []).map((s) => ({ ...s, role: /adjacent/i.test(s.type || "") ? "adjacent" : "direct" })),
        ...(g.suggestions || []).map((s) => ({ ...s, role: "global" })),
      ].filter((s) => s.name && !names.has(norm(s.name)));
      setSuggestions(sugg);
      showToast(sugg.length ? `${sugg.length} suggestions` : "No new suggestions");
    } catch (e) { showToast("AI suggest failed: " + e.message); }
    setSuggesting(false);
  };

  const acceptSuggestion = async (s) => {
    const { error } = await supabase.from("project_brands").insert({
      project_id: projectId, name: s.name.trim(), role: s.role, country: s.country || null,
      sort_order: rows.filter((r) => r.role === s.role).length,
    });
    if (error) { showToast("Error: " + error.message); return; }
    setSuggestions((prev) => prev.filter((x) => x.name !== s.name));
    showToast(`${s.name} added`);
    await reload();
  };

  const active = rows.filter((r) => !r.archived);
  const principal = active.find((r) => r.role === "principal");
  const directs = active.filter((r) => r.role === "direct" || r.role === "adjacent");
  const globals = active.filter((r) => r.role === "global");
  const archived = rows.filter((r) => r.archived);

  // NOTE: BrandCard / AddForm / SocialInputs are plain render FUNCTIONS (called, not
  // mounted as <Components>) — defining components inside a component and using them
  // as JSX remounts the subtree every render and inputs lose focus per keystroke.
  const SocialInputs = ({ value = {}, onChange }) => (
    <div className="grid grid-cols-3 gap-2">
      {SOCIALS.map(({ key, label, ph }) => (
        <div key={key}>
          <label className="block text-[10px] text-muted uppercase font-semibold mb-1">{label}</label>
          <input defaultValue={value?.[key] || ""} placeholder={ph} onBlur={(e) => onChange(key, e.target.value.trim())}
            className="w-full px-2.5 py-1.5 bg-surface2 border border-main rounded-lg text-xs text-main focus:outline-none focus:border-accent" />
        </div>
      ))}
    </div>
  );

  const BrandCard = (b) => {
    const isExpanded = expandedId === b.id;
    const count = counts[norm(b.name)] || 0;
    const setSocial = (key, v) => {
      const social = { ...(b.social || {}) };
      if (v) social[key] = v; else delete social[key];
      updateBrand(b.id, { social });
    };
    return (
      <div key={b.id} className="bg-surface border border-main rounded-xl overflow-hidden">
        <button onClick={() => setExpandedId(isExpanded ? null : b.id)} className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-surface2 transition">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-main">{b.name}</span>
              {b.role === "adjacent" && <span className="text-[9px] px-1.5 py-0.5 rounded-full border border-amber-200 bg-amber-50 text-amber-600 font-medium">Adjacent</span>}
              {b.country && <span className="text-[10px] text-hint">{b.country}</span>}
              {b.sub_category && <span className="text-[10px] text-hint">/ {b.sub_category}</span>}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              {b.website && <span className="text-[10px] text-hint truncate max-w-[220px]">{b.website.replace(/^https?:\/\/(www\.)?/, "")}</span>}
              {SOCIALS.filter(({ key }) => b.social?.[key]).map(({ key, label }) => (
                <span key={key} className="text-[9px] px-1.5 py-0.5 bg-surface2 text-hint rounded-full">{label}</span>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {count > 0 && <span className="text-[10px] px-2 py-0.5 bg-surface2 text-hint rounded-full font-medium">{count} entries</span>}
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" className={`text-hint transition ${isExpanded ? "rotate-180" : ""}`}><path d="M2 4l3 3 3-3" /></svg>
          </div>
        </button>

        {isExpanded && (
          <div className="px-4 py-4 border-t border-main space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] text-muted uppercase font-semibold mb-1">Name</label>
                <input defaultValue={b.name} disabled={b.role === "principal"} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== b.name) updateBrand(b.id, { name: v }); }}
                  className="w-full px-2.5 py-1.5 bg-surface2 border border-main rounded-lg text-xs text-main focus:outline-none focus:border-accent disabled:opacity-60" />
                {b.role === "principal" && <p className="text-[9px] text-hint mt-1">The principal brand name comes from the project setup.</p>}
              </div>
              <div>
                <label className="block text-[10px] text-muted uppercase font-semibold mb-1">Country</label>
                <CountryInput value={b.country || ""} onChange={(v) => updateBrand(b.id, { country: v })} />
              </div>
            </div>
            {b.role !== "principal" && (
              <div className="grid grid-cols-2 gap-3">
                <TaxonomyDropdown
                  label="Category"
                  value={b.category || ""}
                  options={categoryOptions}
                  onChange={(v) => updateBrand(b.id, { category: v || null, sub_category: null })}
                  onAddOther={(v) => addTaxonomyTerm("category", v)}
                  placeholder="-- Category --"
                />
                <TaxonomyDropdown
                  label="Sub-category"
                  value={b.sub_category || ""}
                  options={getSubCategoryOptions(b.category)}
                  onChange={(v) => updateBrand(b.id, { sub_category: v || null })}
                  onAddOther={(v) => addTaxonomyTerm("sub_category", v, b.category)}
                  placeholder="-- Sub-category --"
                />
              </div>
            )}
            <div>
              <label className="block text-[10px] text-muted uppercase font-semibold mb-1">Website</label>
              <input defaultValue={b.website || ""} placeholder="https://…" onBlur={(e) => updateBrand(b.id, { website: e.target.value.trim() || null })}
                className="w-full px-2.5 py-1.5 bg-surface2 border border-main rounded-lg text-xs text-main focus:outline-none focus:border-accent" />
              <p className="text-[9px] text-hint mt-1">Used for the Brand DNA crawl (Intelligence → Brands).</p>
            </div>
            {SocialInputs({ value: b.social, onChange: setSocial })}
            {b.role !== "principal" && (
              <div className="pt-2 border-t border-main">
                <button onClick={() => setConfirmArchive(b)} className="px-3 py-1.5 border border-red-200 text-red-500 rounded-lg text-xs font-medium hover:bg-red-50">Remove</button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const AddForm = ({ role }) => (
    <div className="bg-surface border border-accent rounded-xl p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] text-muted uppercase font-semibold mb-1">Name</label>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Brand name…" autoFocus
            className="w-full px-2.5 py-1.5 bg-surface2 border border-main rounded-lg text-xs text-main focus:outline-none focus:border-accent" />
        </div>
        <div>
          <label className="block text-[10px] text-muted uppercase font-semibold mb-1">Country</label>
          <CountryInput value={form.country} onChange={(v) => setForm({ ...form, country: v })} placeholder="Type country…" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <TaxonomyDropdown
          label="Category"
          value={form.category}
          options={categoryOptions}
          onChange={(v) => setForm({ ...form, category: v, sub_category: "" })}
          onAddOther={(v) => addTaxonomyTerm("category", v)}
          placeholder="-- Category --"
        />
        <TaxonomyDropdown
          label="Sub-category"
          value={form.sub_category}
          options={getSubCategoryOptions(form.category)}
          onChange={(v) => setForm({ ...form, sub_category: v })}
          onAddOther={(v) => addTaxonomyTerm("sub_category", v, form.category)}
          placeholder="-- Sub-category --"
        />
      </div>
      <div>
        <label className="block text-[10px] text-muted uppercase font-semibold mb-1">Website</label>
        <input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://…"
          className="w-full px-2.5 py-1.5 bg-surface2 border border-main rounded-lg text-xs text-main focus:outline-none focus:border-accent" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        {SOCIALS.map(({ key, label, ph }) => (
          <div key={key}>
            <label className="block text-[10px] text-muted uppercase font-semibold mb-1">{label}</label>
            <input value={form.social[key]} placeholder={ph} onChange={(e) => setForm({ ...form, social: { ...form.social, [key]: e.target.value } })}
              className="w-full px-2.5 py-1.5 bg-surface2 border border-main rounded-lg text-xs text-main focus:outline-none focus:border-accent" />
          </div>
        ))}
      </div>
      <div className="flex gap-2 pt-1">
        <button onClick={() => addBrand(role)} disabled={saving || !form.name.trim()} className="px-4 py-1.5 bg-accent text-white rounded-lg text-xs font-semibold disabled:opacity-40">{saving ? "Adding…" : "Add"}</button>
        <button onClick={() => { setAddRole(null); setForm(EMPTY_FORM); }} className="px-4 py-1.5 border border-main rounded-lg text-xs text-muted hover:text-main">Cancel</button>
      </div>
    </div>
  );

  if (loading) return <div className="p-10 text-center text-hint">Loading landscape…</div>;

  return (
    <div className="p-5">
      <div className="flex items-center justify-between max-w-6xl mx-auto mb-4">
        <p className="text-xs text-muted">The brands in this study. Everything here feeds Creative Source, Scout, Intelligence, Reports and Showcase.</p>
        <button onClick={aiSuggest} disabled={suggesting} className="px-4 py-1.5 border border-accent text-accent rounded-lg text-xs font-semibold hover:bg-accent-soft disabled:opacity-50">
          {suggesting ? "Thinking…" : "AI suggest competitors"}
        </button>
      </div>

      {suggestions.length > 0 && (
        <div className="max-w-6xl mx-auto mb-4 bg-accent-soft border border-accent/20 rounded-xl p-4">
          <div className="flex justify-between items-center mb-3">
            <h4 className="text-xs font-bold text-accent">AI Suggestions</h4>
            <button onClick={() => setSuggestions([])} className="text-[10px] text-hint hover:text-main">Dismiss</button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {suggestions.map((s, i) => (
              <div key={i} className="px-3 py-2 rounded-lg border bg-surface border-main text-xs text-main flex justify-between items-start gap-2">
                <div className="min-w-0">
                  <span className="font-semibold">{s.name}</span>
                  <span className="text-[9px] px-1.5 py-0.5 ml-1.5 rounded-full bg-surface2 text-hint">{s.role}</span>
                  {s.reason && <span className="text-hint block mt-0.5 text-[10px]">{s.reason}</span>}
                </div>
                <button onClick={() => acceptSuggestion(s)} className="px-2 py-0.5 bg-accent text-white rounded text-[10px] font-semibold hover:opacity-90 flex-shrink-0">+ Add</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto space-y-6">
        {/* PRINCIPAL */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-sm font-bold text-main">Principal brand</h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium text-white" style={{ background: "var(--accent)" }}>Study subject</span>
          </div>
          {principal ? (
            <div className="rounded-xl" style={{ boxShadow: "0 0 0 1.5px var(--accent)" }}>{BrandCard(principal)}</div>
          ) : (
            <div className="bg-surface border border-dashed border-main rounded-xl p-6 text-center"><p className="text-xs text-hint">No principal brand on record — set the brand name in project settings.</p></div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* DIRECT */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-sm font-bold text-main">Direct competitors</h3>
              <span className="text-[10px] px-2 py-0.5 bg-accent-soft text-accent rounded-full font-medium">{directs.length}</span>
            </div>
            <div className="space-y-2 mb-3">
              {directs.length === 0 && addRole !== "direct" && <div className="bg-surface border border-dashed border-main rounded-xl p-6 text-center"><p className="text-xs text-hint">No direct competitors yet</p></div>}
              {directs.map(BrandCard)}
            </div>
            {addRole === "direct" ? AddForm({ role: "direct" }) : (
              <button onClick={() => { setAddRole("direct"); setForm(EMPTY_FORM); }} className="text-xs text-accent hover:underline font-medium">+ Add direct competitor</button>
            )}
          </div>

          {/* GLOBAL */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-sm font-bold text-main">Global references</h3>
              <span className="text-[10px] px-2 py-0.5 bg-accent-soft text-accent rounded-full font-medium">{globals.length}</span>
            </div>
            <div className="space-y-2 mb-3">
              {globals.length === 0 && addRole !== "global" && <div className="bg-surface border border-dashed border-main rounded-xl p-6 text-center"><p className="text-xs text-hint">No global references yet</p></div>}
              {globals.map(BrandCard)}
            </div>
            {addRole === "global" ? AddForm({ role: "global" }) : (
              <button onClick={() => { setAddRole("global"); setForm(EMPTY_FORM); }} className="text-xs text-accent hover:underline font-medium">+ Add global reference</button>
            )}
          </div>
        </div>

        {/* ARCHIVED */}
        {archived.length > 0 && (
          <div>
            <button onClick={() => setShowArchived((v) => !v)} className="text-xs text-hint hover:text-main font-medium">
              {showArchived ? "▾" : "▸"} Archived ({archived.length}) — removed from the study, content preserved
            </button>
            {showArchived && (
              <div className="space-y-2 mt-2">
                {archived.map((b) => (
                  <div key={b.id} className="bg-surface border border-dashed border-main rounded-xl px-4 py-2.5 flex items-center gap-3 opacity-70">
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-main">{b.name}</span>
                      <span className="text-[10px] text-hint ml-2">{b.role}</span>
                      {(counts[norm(b.name)] || 0) > 0 && <span className="text-[10px] px-2 py-0.5 ml-2 bg-surface2 text-hint rounded-full">{counts[norm(b.name)]} entries kept</span>}
                    </div>
                    <button onClick={() => updateBrand(b.id, { archived: false }).then(() => showToast(`${b.name} restored`))} className="px-3 py-1 border border-main rounded-lg text-xs text-muted hover:text-main">Restore</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Confirm archive modal */}
      {confirmArchive && (
        <>
          <div className="fixed inset-0 bg-black/30" style={{ zIndex: 99998 }} onClick={() => setConfirmArchive(null)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-surface border border-main rounded-xl p-6 w-[380px] shadow-2xl" style={{ zIndex: 99999 }}>
            <h4 className="text-sm font-bold text-main mb-2">Remove {confirmArchive.name}?</h4>
            <p className="text-xs text-muted mb-4">
              It will disappear from every form, filter and report across the platform.
              {(counts[norm(confirmArchive.name)] || 0) > 0 && <> Its <strong>{counts[norm(confirmArchive.name)]} captured entries are preserved</strong> and come back if you restore it.</>}
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmArchive(null)} className="px-3 py-1.5 border border-main rounded-lg text-xs text-muted hover:text-main">Cancel</button>
              <button onClick={() => archiveBrand(confirmArchive.id)} className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs font-semibold hover:opacity-90">Remove (archive)</button>
            </div>
          </div>
        </>
      )}

      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-black text-white text-xs px-4 py-2 rounded-full shadow-lg" style={{ zIndex: 99999 }}>{toast}</div>}
    </div>
  );
}
