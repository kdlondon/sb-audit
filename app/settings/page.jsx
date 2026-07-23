"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase";
import AuthGuard from "@/components/AuthGuard";
import Nav from "@/components/Nav";
import ProjectGuard from "@/components/ProjectGuard";
import { useProject } from "@/lib/project-context";
import { useBrand } from "@/lib/brand-context";
import { useRole } from "@/lib/role-context";
import { useFramework } from "@/lib/framework-context";
import { SYSTEM_DIMENSIONS } from "@/lib/system-dimensions";
import { syncProjectBrands } from "@/lib/project-brands";
import LandscapeRegistry from "@/components/LandscapeRegistry";
import TaxonomyDropdown from "@/components/TaxonomyDropdown";
import CountryInput from "@/components/CountryInput";

// Study objectives — MUST stay in sync with the onboarding list. Each objective drives
// which report Groundwork suggests in Report > Generate (see lib/report-cards).
const OBJECTIVES = [
  "Competitive positioning & messaging", "Identify white spaces / opportunities",
  "Creative inspiration & benchmarking", "Innovation scan", "Brand consistency audit",
  "Category landscape map", "Tone & territory analysis", "Social content & engagement",
];

const BRAND_ARCHETYPES = [
  "Innocent", "Explorer", "Sage", "Hero", "Outlaw", "Magician",
  "Regular Guy", "Lover", "Jester", "Caregiver", "Creator", "Ruler",
  "Not identifiable", "Other",
];

const TONE_OPTIONS = [
  "Authoritative", "Empathetic", "Aspirational", "Peer-level",
  "Institutional", "Playful", "Urgent", "Other",
];

// Same canonical values as onboarding (project_frameworks.language) — the AI prompts
// consume the raw string, so onboarding and settings must speak the same names.
const LANGUAGE_OPTIONS = ["Español", "English", "Português", "Français", "Deutsch", "Italiano"];

/* ═══════════════════════════════════════════════════════════════
   TAXONOMY DROPDOWN — category/sub_category with "- Other"
   ═══════════════════════════════════════════════════════════════ */
// TaxonomyDropdown extracted to components/TaxonomyDropdown.jsx (shared with LandscapeRegistry).

/* ═══════════════════════════════════════════════════════════════
   TAG INPUT — editable tags (comma-separated or chips)
   ═══════════════════════════════════════════════════════════════ */
function TagInput({ label, tags, onChange, placeholder, options }) {
  const [inputVal, setInputVal] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const ref = useRef(null);

  const addTag = (val) => {
    const trimmed = val.trim();
    if (trimmed && !tags.includes(trimmed)) {
      if (options && !options.some(o => o.toLowerCase() === trimmed.toLowerCase())) return; // Only allow from options
      onChange([...tags, trimmed]);
    }
    setInputVal("");
    setShowSuggestions(false);
  };

  const removeTag = (idx) => {
    onChange(tags.filter((_, i) => i !== idx));
  };

  const filtered = options && inputVal.length > 0
    ? options.filter(o => o.toLowerCase().includes(inputVal.toLowerCase()) && !tags.includes(o)).slice(0, 6)
    : [];

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setShowSuggestions(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      {label && <label className="block text-[10px] text-muted uppercase font-semibold mb-1">{label}</label>}
      <div className="flex flex-wrap gap-1.5 p-2 bg-surface border border-main rounded-lg min-h-[38px]">
        {tags.map((tag, i) => (
          <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-accent-soft text-accent rounded-full text-xs font-medium">
            {tag}
            <button type="button" onClick={() => removeTag(i)} className="text-accent/60 hover:text-accent ml-0.5">x</button>
          </span>
        ))}
        <input
          value={inputVal}
          onChange={(e) => { setInputVal(e.target.value); setShowSuggestions(true); }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              if (filtered.length > 0) addTag(filtered[0]); // Select first match
              else if (!options) addTag(inputVal); // Free-text if no options list
            }
          }}
          onFocus={() => { if (inputVal.length > 0) setShowSuggestions(true); }}
          placeholder={tags.length === 0 ? (placeholder || "Type and press Enter...") : ""}
          className="flex-1 min-w-[100px] bg-transparent text-sm text-main focus:outline-none"
        />
      </div>
      {showSuggestions && filtered.length > 0 && (
        <div className="absolute left-0 right-0 bg-surface border border-main rounded-lg shadow-lg overflow-hidden" style={{ top: "100%", marginTop: 2, zIndex: 9999 }}>
          {filtered.map(c => (
            <button key={c} type="button" onMouseDown={() => addTag(c)}
              className="w-full text-left px-3 py-1.5 text-xs text-main hover:bg-accent-soft transition">{c}</button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Multi-URL Input Component ── */
function MultiUrlInput({ label, urls, onChange, max = 10 }) {
  const list = urls.length > 0 ? urls : [""];
  const update = (idx, val) => { const u = [...list]; u[idx] = val; onChange(u.filter(Boolean)); };
  const add = () => { if (list.length < max) onChange([...list, ""]); };
  const remove = (idx) => { const u = list.filter((_, i) => i !== idx); onChange(u.length > 0 ? u : [""]); };
  return (
    <div>
      {label && <label className="block text-[10px] text-muted uppercase font-semibold mb-1">{label}</label>}
      <div className="space-y-1.5">
        {list.map((url, i) => (
          <div key={i} className="flex gap-1">
            <input value={url} onChange={e => { const u = [...list]; u[i] = e.target.value; onChange(u); }}
              onBlur={() => onChange(list.filter(Boolean))}
              placeholder="https://..."
              className="flex-1 px-2.5 py-1.5 bg-surface2 border border-main rounded-lg text-xs text-main focus:outline-none focus:border-accent" />
            {list.length > 1 && <button type="button" onClick={() => remove(i)} className="text-red-400 hover:text-red-600 text-sm px-1">×</button>}
          </div>
        ))}
      </div>
      {list.filter(Boolean).length < max && (
        <button type="button" onClick={add} className="text-[10px] text-accent hover:underline mt-1">+ Add URL</button>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PROFILE TAB — Brand identity, market, audience, analysis
   ═══════════════════════════════════════════════════════════════ */
function ProfileTab({ brandId, orgId, refreshFramework }) {
  const [objectives, setObjectives] = useState([]);
  const supabase = createClient();
  const { projectId } = useProject() || {};
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  // Brand fields
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [subCategory, setSubCategory] = useState("");
  const [market, setMarket] = useState("");
  const [marketsToObserve, setMarketsToObserve] = useState([]);
  const [targetAudience, setTargetAudience] = useState("");
  const [valueProposition, setValueProposition] = useState("");
  const [keyDifferentiator, setKeyDifferentiator] = useState("");
  const [r2b, setR2b] = useState("");
  const [brandTone, setBrandTone] = useState("");
  const [brandArchetype, setBrandArchetype] = useState("");

  // Framework fields (from brand_frameworks)
  const [communicationIntents, setCommunicationIntents] = useState([]);
  const [language, setLanguage] = useState("English");

  // Taxonomy
  const [taxonomyTerms, setTaxonomyTerms] = useState({});

  const loadTaxonomy = useCallback(async () => {
    const { data: terms } = await supabase.from("taxonomy_terms").select("*").eq("is_active", true).order("sort_order");
    if (terms) {
      const grouped = {};
      terms.forEach((t) => {
        if (!grouped[t.taxonomy_type]) grouped[t.taxonomy_type] = [];
        grouped[t.taxonomy_type].push({ ...t });
      });
      setTaxonomyTerms(grouped);
    }
  }, []);

  const loadData = useCallback(async () => {
    if (!projectId && !brandId) { setLoading(false); return; }
    setLoading(true);

    // Primary: project_frameworks by project_id (what the onboarding + Audit use)
    let loaded = false;
    if (projectId) {
      const { data: fw } = await supabase.from("project_frameworks").select("*").eq("project_id", projectId).single();
      if (fw) {
        loaded = true;
        setName(fw.brand_name || "");
        setWebsite("");
        setDescription(fw.brand_description || "");
        setCategory(fw.industry || "");
        setSubCategory(fw.sub_category || "");
        setMarket(fw.primary_market || "");
        setMarketsToObserve(fw.global_markets || []);
        setObjectives(Array.isArray(fw.objectives) ? fw.objectives : []);
        setTargetAudience(fw.brand_audience || "");
        setValueProposition(fw.brand_positioning || "");
        setKeyDifferentiator(fw.brand_differentiator || "");
        setR2b("");
        setBrandTone(fw.brand_tone || "");
        setBrandArchetype("");
        setCommunicationIntents(fw.communication_intents || ["Brand Hero", "Brand Tactical", "Client Testimonials", "Product", "Innovation"]);
        setLanguage(fw.language || "English");
      }
    }

    // Fallback: legacy brand-based projects (brands + brand_frameworks)
    if (!loaded && brandId) {
      const { data: brand } = await supabase.from("brands").select("*").eq("id", brandId).single();
      if (brand) {
        setName(brand.name || ""); setWebsite(brand.website || ""); setDescription(brand.description || "");
        setCategory(brand.category || ""); setSubCategory(brand.sub_category || ""); setMarket(brand.market || "");
        setMarketsToObserve(brand.markets_to_observe || []); setTargetAudience(brand.target_audience || "");
        setValueProposition(brand.value_proposition || ""); setKeyDifferentiator(brand.key_differentiator || "");
        setR2b(brand.r2b || ""); setBrandTone(brand.brand_tone || ""); setBrandArchetype(brand.brand_archetype || "");
      }
      const { data: bfw } = await supabase.from("brand_frameworks").select("communication_intents, language").eq("brand_id", brandId).single();
      if (bfw) {
        setCommunicationIntents(bfw.communication_intents || ["Brand Hero", "Brand Tactical", "Client Testimonials", "Product", "Innovation"]);
        setLanguage(bfw.language || "English");
      }
    }

    await loadTaxonomy();
    setLoading(false);
  }, [projectId, brandId]);

  useEffect(() => { loadData(); }, [loadData]);

  const categoryOptions = (taxonomyTerms.category || []).map((t) => t.name);
  const subCategoryOptions = (taxonomyTerms.sub_category || [])
    .filter((t) => {
      if (!category) return true;
      // Filter by parent
      const parentTerm = (taxonomyTerms.category || []).find((c) => c.name === category);
      return parentTerm ? t.parent_id === parentTerm.id : true;
    })
    .map((t) => t.name);

  const addTaxonomyTerm = async (type, termName, parentCategory) => {
    const insertData = {
      organization_id: orgId || null,
      taxonomy_type: type,
      name: termName,
      sort_order: 999,
      is_active: true,
    };
    if (type === "sub_category" && parentCategory) {
      const parentTerm = (taxonomyTerms.category || []).find((c) => c.name === parentCategory);
      if (parentTerm) insertData.parent_id = parentTerm.id;
    }
    await supabase.from("taxonomy_terms").insert(insertData);
    await loadTaxonomy();
  };

  const save = async () => {
    if (!projectId && !brandId) return;
    setSaving(true);
    let error = null;

    if (projectId) {
      // Save to project_frameworks (what Audit + onboarding use)
      const { error: e } = await supabase.from("project_frameworks").update({
        brand_name: name.trim(),
        brand_description: description.trim(),
        industry: category.trim(),
        sub_category: subCategory.trim(),
        primary_market: market.trim(),
        global_markets: marketsToObserve,
        brand_audience: targetAudience.trim(),
        brand_positioning: valueProposition.trim(),
        brand_differentiator: keyDifferentiator.trim(),
        brand_tone: brandTone.trim(),
        communication_intents: communicationIntents,
        objectives,
        language,
      }).eq("project_id", projectId);
      error = e;
    } else if (brandId) {
      const { error: e } = await supabase.from("brands").update({
        name: name.trim(), website: website.trim(), description: description.trim(),
        category: category.trim(), sub_category: subCategory.trim(), market: market.trim(),
        markets_to_observe: marketsToObserve, target_audience: targetAudience.trim(),
        value_proposition: valueProposition.trim(), key_differentiator: keyDifferentiator.trim(),
        r2b: r2b.trim(), brand_tone: brandTone.trim(), brand_archetype: brandArchetype,
      }).eq("id", brandId);
      error = e;
      const { data: existingFw } = await supabase.from("brand_frameworks").select("id").eq("brand_id", brandId).single();
      if (existingFw) await supabase.from("brand_frameworks").update({ communication_intents: communicationIntents, language }).eq("id", existingFw.id);
    }

    refreshFramework?.();
    setSaving(false);
    if (error) { console.error("Profile save error:", error); showToast("Error saving: " + error.message); }
    else { showToast("Profile saved"); }
  };

  if (loading) {
    return <div className="p-10 text-center text-hint">Loading profile...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-8">
      {/* ── Brand identity ── */}
      <div className="bg-surface rounded-xl border border-main p-6 space-y-4">
        <h4 className="text-xs font-bold text-muted uppercase tracking-wider mb-1">Brand identity</h4>

        <div>
          <label className="block text-[10px] text-muted uppercase font-semibold mb-1">Brand name</label>
          <input value={name} onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[var(--accent)]" />
        </div>

        <div>
          <label className="block text-[10px] text-muted uppercase font-semibold mb-1">Website</label>
          <input type="url" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://..."
            className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[var(--accent)]" />
        </div>

        <div>
          <label className="block text-[10px] text-muted uppercase font-semibold mb-1">Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
            className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main resize-y focus:outline-none focus:border-[var(--accent)]" />
        </div>
      </div>

      {/* ── Market & category ── */}
      <div className="bg-surface rounded-xl border border-main p-6 space-y-4">
        <h4 className="text-xs font-bold text-muted uppercase tracking-wider mb-1">Market & category</h4>

        <div className="grid grid-cols-2 gap-4">
          <TaxonomyDropdown
            label="Category"
            value={category}
            options={categoryOptions}
            onChange={(v) => { setCategory(v); setSubCategory(""); }}
            onAddOther={(v) => addTaxonomyTerm("category", v)}
            placeholder="-- Category --"
          />
          <TaxonomyDropdown
            label="Sub-category"
            value={subCategory}
            options={subCategoryOptions}
            onChange={setSubCategory}
            onAddOther={(v) => addTaxonomyTerm("sub_category", v, category)}
            placeholder="-- Sub-category --"
          />
        </div>

        <div>
          <label className="block text-[10px] text-muted uppercase font-semibold mb-1">Primary market</label>
          <CountryInput value={market} onChange={setMarket} placeholder="Type country name..." />
        </div>

        <TagInput
          label="Markets to observe"
          tags={marketsToObserve}
          onChange={setMarketsToObserve}
          placeholder="Type country name..."
          options={require("@/components/CountryInput").COUNTRIES}
        />
      </div>

      {/* ── Audience & positioning ── */}
      <div className="bg-surface rounded-xl border border-main p-6 space-y-4">
        <h4 className="text-xs font-bold text-muted uppercase tracking-wider mb-1">Audience & positioning</h4>

        <div>
          <label className="block text-[10px] text-muted uppercase font-semibold mb-1">Target audience</label>
          <textarea value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)} rows={2}
            placeholder="Describe your primary target audience..."
            className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main resize-y focus:outline-none focus:border-[var(--accent)]" />
        </div>

        <div>
          <label className="block text-[10px] text-muted uppercase font-semibold mb-1">Value proposition</label>
          <textarea value={valueProposition} onChange={(e) => setValueProposition(e.target.value)} rows={2}
            placeholder="What value does the brand deliver?"
            className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main resize-y focus:outline-none focus:border-[var(--accent)]" />
        </div>

        <div>
          <label className="block text-[10px] text-muted uppercase font-semibold mb-1">Key differentiator</label>
          <textarea value={keyDifferentiator} onChange={(e) => setKeyDifferentiator(e.target.value)} rows={2}
            placeholder="What sets this brand apart?"
            className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main resize-y focus:outline-none focus:border-[var(--accent)]" />
        </div>

        <div>
          <label className="block text-[10px] text-muted uppercase font-semibold mb-1">R2B (Reason to believe)</label>
          <textarea value={r2b} onChange={(e) => setR2b(e.target.value)} rows={2}
            placeholder="Why should the audience believe the brand promise?"
            className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main resize-y focus:outline-none focus:border-[var(--accent)]" />
        </div>

        <div>
          <label className="block text-[10px] text-muted uppercase font-semibold mb-1">Brand tone</label>
          <p className="text-[9px] text-hint mb-1">Comma-separated values: {TONE_OPTIONS.join(", ")}</p>
          <input value={brandTone} onChange={(e) => setBrandTone(e.target.value)}
            placeholder="e.g., Authoritative, Empathetic"
            className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[var(--accent)]" />
        </div>

        <div>
          <label className="block text-[10px] text-muted uppercase font-semibold mb-1">Brand archetype</label>
          <select value={brandArchetype} onChange={(e) => setBrandArchetype(e.target.value)}
            className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[var(--accent)]">
            <option value="">-- Select archetype --</option>
            {BRAND_ARCHETYPES.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>

      {/* ── Study objectives ── */}
      {/* These drive which reports Groundwork suggests in Report > Generate. Same list as
          onboarding, so a project set up either way behaves identically. */}
      <div className="bg-surface rounded-xl border border-main p-6 space-y-4">
        <h4 className="text-xs font-bold text-muted uppercase tracking-wider mb-1">Study objectives</h4>
        <p className="text-xs text-muted -mt-1">What this study is for. Each objective suggests a report in <b>Report › Generate</b>.</p>
        <div className="flex flex-wrap gap-2">
          {OBJECTIVES.map(o => {
            const on = objectives.includes(o);
            return (
              <button key={o} type="button"
                onClick={() => setObjectives(prev => on ? prev.filter(x => x !== o) : [...prev, o])}
                className="px-3 py-1.5 rounded-full text-xs border transition"
                style={on
                  ? { background: "var(--accent-ember)", borderColor: "var(--accent-ember)", color: "#fff", fontWeight: 600 }
                  : { background: "var(--surface)", borderColor: "var(--border)", color: "var(--text2)" }}>
                {on && "✓ "}{o}
              </button>
            );
          })}
        </div>
        {objectives.length === 0 && (
          <p className="text-xs" style={{ color: "var(--accent-ember-deep)" }}>
            No objectives selected — Report will not suggest anything until you pick at least one.
          </p>
        )}
      </div>

      {/* ── Analysis settings ── */}
      {/* Communication intents were removed from this tab — they are part of the FRAMEWORK
          and are managed in the Framework tab (still saved untouched on profile save). */}
      <div className="bg-surface rounded-xl border border-main p-6 space-y-4">
        <h4 className="text-xs font-bold text-muted uppercase tracking-wider mb-1">Analysis settings</h4>

        <div>
          <label className="block text-[10px] text-muted uppercase font-semibold mb-1">Language</label>
          <p className="text-[10px] text-hint mb-1.5">Every AI analysis, brand profile and report is written in this language.</p>
          <select value={language} onChange={(e) => setLanguage(e.target.value)}
            className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[var(--accent)]">
            {[...LANGUAGE_OPTIONS, ...(LANGUAGE_OPTIONS.includes(language) ? [] : [language])].map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
      </div>

      {/* Save */}
      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving}
          className="px-6 py-2.5 bg-accent text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50">
          {saving ? "Saving..." : "Save profile"}
        </button>
      </div>

      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-main text-white px-5 py-2.5 rounded-xl text-sm font-medium shadow-xl animate-fadeIn" style={{ zIndex: 99999 }}>{toast}</div>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   LANDSCAPE TAB — Local competitors + Global references
   ═══════════════════════════════════════════════════════════════ */
function LandscapeTab({ brandId, orgId }) {
  const supabase = createClient();
  const { projectId } = useProject() || {};
  // Registry-first: when the project has competitor rows in project_brands, the tab
  // runs on the normalized registry (LandscapeRegistry). Legacy paths (brand_competitors
  // or the framework arrays) remain the fallback — e.g. Scotiabank.
  const [useRegistry, setUseRegistry] = useState(null); // null = checking
  useEffect(() => {
    if (!projectId) { setUseRegistry(false); return; }
    (async () => {
      try {
        const { data } = await supabase.from("project_brands").select("id,role").eq("project_id", projectId).neq("role", "principal").limit(1);
        setUseRegistry(!!(data && data.length));
      } catch { setUseRegistry(false); }
    })();
  }, [projectId]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const [localComps, setLocalComps] = useState([]);
  const [globalRefs, setGlobalRefs] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [saving, setSaving] = useState(false);

  // Add forms
  const [showAddLocal, setShowAddLocal] = useState(false);
  const [showAddGlobal, setShowAddGlobal] = useState(false);
  const [newComp, setNewComp] = useState({ name: "", country: "", category: "", sub_category: "", proximity: "Direct", websites: [""] });

  // Taxonomy
  const [taxonomyTerms, setTaxonomyTerms] = useState({});

  // Confirm removal
  const [confirmRemove, setConfirmRemove] = useState(null);

  // AI suggest
  const [suggesting, setSuggesting] = useState(false);

  const loadTaxonomy = useCallback(async () => {
    const { data: terms } = await supabase.from("taxonomy_terms").select("*").eq("is_active", true).order("sort_order");
    if (terms) {
      const grouped = {};
      terms.forEach((t) => {
        if (!grouped[t.taxonomy_type]) grouped[t.taxonomy_type] = [];
        grouped[t.taxonomy_type].push({ ...t });
      });
      setTaxonomyTerms(grouped);
    }
  }, []);

  const loadCompetitors = useCallback(async () => {
    if (!brandId) return;
    setLoading(true);

    // Load competitor links
    const { data: comps } = await supabase
      .from("brand_competitors")
      .select("own_brand_id, competitor_brand_id")
      .eq("own_brand_id", brandId);

    if (!comps || comps.length === 0) {
      // Project-centric projects store competitors in project_frameworks (not brand_competitors).
      if (projectId) {
        const { data: pf } = await supabase.from("project_frameworks").select("local_competitors, global_benchmarks").eq("project_id", projectId).single();
        setLocalComps((pf?.local_competitors || []).map((c, i) => ({ competitor_brand_id: `pf_l_${i}`, fromFramework: true, brand: { id: `pf_l_${i}`, name: c.name, scope: "local", proximity: c.type || "direct" }, entryCount: 0 })));
        setGlobalRefs((pf?.global_benchmarks || []).map((g, i) => ({ competitor_brand_id: `pf_g_${i}`, fromFramework: true, brand: { id: `pf_g_${i}`, name: g.name, scope: "global", country: g.country || "" }, entryCount: 0 })));
      } else {
        setLocalComps([]);
        setGlobalRefs([]);
      }
      setLoading(false);
      return;
    }

    const compIds = comps.map((c) => c.competitor_brand_id);
    // Load full brand data (scope, proximity live on brands table)
    const { data: brands } = await supabase
      .from("brands")
      .select("*")
      .in("id", compIds)
      .order("name");

    // Count entries per competitor
    const entryCounts = {};
    const { data: entries } = await supabase.from("creative_source").select("brand_id").in("brand_id", compIds);
    (entries || []).forEach(e => { entryCounts[e.brand_id] = (entryCounts[e.brand_id] || 0) + 1; });

    const merged = (brands || []).map((b) => ({
      competitor_brand_id: b.id,
      brand: b,
      entryCount: entryCounts[b.id] || 0,
    }));

    setLocalComps(merged.filter((c) => c.brand.scope === "local"));
    setGlobalRefs(merged.filter((c) => c.brand.scope === "global"));
    setLoading(false);
  }, [brandId, projectId]);

  useEffect(() => {
    loadCompetitors();
    loadTaxonomy();
  }, [loadCompetitors, loadTaxonomy]);

  const categoryOptions = (taxonomyTerms.category || []).map((t) => t.name);
  const getSubCategoryOptions = (cat) => {
    return (taxonomyTerms.sub_category || [])
      .filter((t) => {
        if (!cat) return true;
        const parentTerm = (taxonomyTerms.category || []).find((c) => c.name === cat);
        return parentTerm ? t.parent_id === parentTerm.id : true;
      })
      .map((t) => t.name);
  };

  const addTaxonomyTerm = async (type, termName, parentCategory) => {
    const insertData = {
      organization_id: orgId || null,
      taxonomy_type: type,
      name: termName,
      sort_order: 999,
      is_active: true,
    };
    if (type === "sub_category" && parentCategory) {
      const parentTerm = (taxonomyTerms.category || []).find((c) => c.name === parentCategory);
      if (parentTerm) insertData.parent_id = parentTerm.id;
    }
    await supabase.from("taxonomy_terms").insert(insertData);
    await loadTaxonomy();
  };

  // The competitor list IS the project framework — single source of truth that every brand
  // form (Creative Source, Intelligence, Report, Scout) reads via useFramework(). So add/remove/
  // update read-modify-write project_frameworks.local_competitors / global_benchmarks and
  // refresh the framework context so the change is live everywhere immediately.
  const persistFw = async (col, arr) => {
    const { error } = await supabase.from("project_frameworks").update({ [col]: arr }).eq("project_id", projectId);
    if (!error) {
      // Dual-write: mirror the arrays into the normalized project_brands registry
      // (upsert + archive-on-delete) so the framework loaders stay in sync.
      try {
        const { data: pf } = await supabase.from("project_frameworks").select("brand_name, local_competitors, global_benchmarks").eq("project_id", projectId).single();
        await syncProjectBrands(supabase, projectId, { brandName: pf?.brand_name, locals: pf?.local_competitors || [], globals: pf?.global_benchmarks || [] });
      } catch {}
      try { refreshFramework?.(); } catch {}
    }
    return error;
  };

  const addCompetitor = async (scope) => {
    if (!newComp.name.trim() || !projectId) { if (!projectId) showToast("No active project"); return; }
    setSaving(true);
    const col = scope === "local" ? "local_competitors" : "global_benchmarks";
    const { data: pf } = await supabase.from("project_frameworks").select(col).eq("project_id", projectId).single();
    const arr = Array.isArray(pf?.[col]) ? [...pf[col]] : [];
    const name = newComp.name.trim();
    if (arr.some((x) => (x?.name || "").toLowerCase() === name.toLowerCase())) {
      setSaving(false); showToast("Already in the list"); return;
    }
    const websites = (newComp.websites || []).filter((u) => u.trim());
    arr.push(scope === "local"
      ? { name, type: newComp.proximity || "Direct", category: newComp.category.trim() || undefined, sub_category: newComp.sub_category.trim() || undefined, website: websites.length ? websites : undefined }
      : { name, country: newComp.country.trim() || undefined, website: websites.length ? websites : undefined });
    const error = await persistFw(col, arr);
    setNewComp({ name: "", country: "", category: "", sub_category: "", proximity: "Direct", websites: [""] });
    setShowAddLocal(false); setShowAddGlobal(false); setSaving(false);
    showToast(error ? "Error: " + error.message : "Competitor added");
    await loadCompetitors();
  };

  const removeCompetitor = async (compBrandId) => {
    const m = String(compBrandId).match(/^pf_(l|g)_(\d+)$/);
    setConfirmRemove(null);
    if (!m || !projectId) return;
    const col = m[1] === "l" ? "local_competitors" : "global_benchmarks";
    const { data: pf } = await supabase.from("project_frameworks").select(col).eq("project_id", projectId).single();
    const arr = Array.isArray(pf?.[col]) ? [...pf[col]] : [];
    arr.splice(Number(m[2]), 1);
    await persistFw(col, arr);
    showToast("Competitor removed");
    await loadCompetitors();
  };

  const updateCompetitorBrand = async (compBrandId, updates) => {
    const m = String(compBrandId).match(/^pf_(l|g)_(\d+)$/);
    if (!m || !projectId) return;
    const col = m[1] === "l" ? "local_competitors" : "global_benchmarks";
    const idx = Number(m[2]);
    const { data: pf } = await supabase.from("project_frameworks").select(col).eq("project_id", projectId).single();
    const arr = Array.isArray(pf?.[col]) ? [...pf[col]] : [];
    if (!arr[idx]) return;
    const mapped = { ...updates };
    if (mapped.proximity != null) { mapped.type = mapped.proximity; delete mapped.proximity; }
    arr[idx] = { ...arr[idx], ...mapped };
    await persistFw(col, arr);
    const updateList = (list) => list.map((c) => c.competitor_brand_id === compBrandId ? { ...c, brand: { ...c.brand, ...updates } } : c);
    setLocalComps((prev) => updateList(prev));
    setGlobalRefs((prev) => updateList(prev));
  };


  const [suggestions, setSuggestions] = useState([]);

  const aiSuggest = async () => {
    if (!brandId) {
      console.error("[AI Suggest] brandId is null — cannot filter existing competitors");
      showToast("Error: brand context not loaded");
      return;
    }
    setSuggesting(true);
    try {
      console.log("[AI Suggest] brandId:", brandId);
      const { data: ownBrand } = await supabase.from("brands").select("name, category, market").eq("id", brandId).single();

      // Get existing competitor names from DB (not local state — must be fresh)
      const { data: existing } = await supabase
        .from("brand_competitors")
        .select("competitor_brand_id")
        .eq("own_brand_id", brandId);
      const existingIds = (existing || []).map(e => e.competitor_brand_id);
      const { data: existingBrands } = existingIds.length > 0
        ? await supabase.from("brands").select("name").in("id", existingIds)
        : { data: [] };
      const existingNames = new Set((existingBrands || []).map(b => b.name.toLowerCase()));
      console.log("[AI Suggest] Existing competitors:", [...existingNames]);

      // Send existing names to AI so it avoids them
      const existingList = [...existingNames].join(", ");
      const [localRes, globalRes] = await Promise.all([
        fetch("/api/suggest-competitors", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ brand_name: ownBrand?.name || "", industry: ownBrand?.category || "", market: ownBrand?.market || "", type: "local", exclude: existingList }),
        }).then(r => r.json()),
        fetch("/api/suggest-competitors", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ brand_name: ownBrand?.name || "", industry: ownBrand?.category || "", market: null, type: "global", exclude: existingList }),
        }).then(r => r.json()),
      ]);

      // Fuzzy filter — check if suggestion name contains or is contained by any existing name
      const fuzzyMatch = (suggName) => {
        const s = suggName.toLowerCase();
        for (const existing of existingNames) {
          if (s.includes(existing) || existing.includes(s)) return true;
          // Check first word match (e.g. "RBC" matches "RBC Royal Bank")
          const sFirst = s.split(" ")[0];
          const eFirst = existing.split(" ")[0];
          if (sFirst === eFirst && sFirst.length > 2) return true;
        }
        return false;
      };

      let localSuggs = (localRes.suggestions || []).filter(s => !fuzzyMatch(s.name || ""));
      let globalSuggs = (globalRes.suggestions || []).filter(s => !fuzzyMatch(s.name || ""));

      // Enforce max 5 each
      localSuggs = localSuggs.slice(0, 5).map(s => ({ ...s, suggestScope: "local" }));
      globalSuggs = globalSuggs.slice(0, 5).map(s => ({ ...s, suggestScope: "global" }));

      const allSuggestions = [...localSuggs, ...globalSuggs];
      console.log("[AI Suggest] Filtered suggestions:", allSuggestions.length);

      if (allSuggestions.length) {
        setSuggestions(allSuggestions);
        showToast(`${allSuggestions.length} suggestions found`);
      } else {
        showToast("No new suggestions found");
      }
    } catch (err) {
      console.error("[AI Suggest] Error:", err);
      showToast("AI suggest failed: " + err.message);
    }
    setSuggesting(false);
  };

  const proximityColor = (p) => {
    if (p === "Direct") return "bg-red-50 text-red-600 border-red-200";
    if (p === "Direct") return "bg-red-50 text-red-600 border-red-200";
    if (p === "Adjacent") return "bg-amber-50 text-amber-600 border-amber-200";
    if (p === "Target proximity") return "bg-green-50 text-green-600 border-green-200";
    return "bg-gray-100 text-gray-500 border-gray-200";
  };

  const renderCompetitorCard = (comp) => {
    const b = comp.brand;
    const isExpanded = expandedId === comp.competitor_brand_id;

    return (
      <div key={comp.id} className="bg-surface border border-main rounded-xl overflow-hidden">
        <button
          onClick={() => {
            const newId = isExpanded ? null : comp.competitor_brand_id;
            setExpandedId(newId);
          }}
          className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-surface2 transition"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-main">{b.name || "Unknown"}</span>
              {b.country && <span className="text-[10px] text-hint">{b.country}</span>}
              {b.sub_category && <span className="text-[10px] text-hint">/ {b.sub_category}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[9px] px-2 py-0.5 rounded-full border font-medium ${proximityColor(comp.proximity)}`}>
              {comp.proximity || "—"}
            </span>
            {comp.entryCount > 0 && (
              <span className="text-[10px] px-2 py-0.5 bg-surface2 text-hint rounded-full font-medium">
                {comp.entryCount} entries
              </span>
            )}
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5"
              className={`text-hint transition ${isExpanded ? "rotate-180" : ""}`}><path d="M2 4l3 3 3-3" /></svg>
          </div>
        </button>

        {isExpanded && (
          <div className="px-4 py-4 border-t border-main space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] text-muted uppercase font-semibold mb-1">Name</label>
                <input defaultValue={b.name || ""} onBlur={(e) => updateCompetitorBrand(comp.competitor_brand_id, { name: e.target.value })}
                  className="w-full px-2.5 py-1.5 bg-surface2 border border-main rounded-lg text-xs text-main focus:outline-none focus:border-accent" />
              </div>
              <div>
                <label className="block text-[10px] text-muted uppercase font-semibold mb-1">Country</label>
                <CountryInput value={b.country || ""} onChange={v => updateCompetitorBrand(comp.competitor_brand_id, { country: v })} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <TaxonomyDropdown
                label="Category"
                value={b.category || ""}
                options={categoryOptions}
                onChange={(v) => updateCompetitorBrand(comp.competitor_brand_id, { category: v, sub_category: "" })}
                onAddOther={(v) => addTaxonomyTerm("category", v)}
                placeholder="-- Category --"
              />
              <TaxonomyDropdown
                label="Sub-category"
                value={b.sub_category || ""}
                options={getSubCategoryOptions(b.category)}
                onChange={(v) => updateCompetitorBrand(comp.competitor_brand_id, { sub_category: v })}
                onAddOther={(v) => addTaxonomyTerm("sub_category", v, b.category)}
                placeholder="-- Sub-category --"
              />
            </div>

            <MultiUrlInput
              label="Website URLs"
              urls={(() => { try { const p = JSON.parse(b.website || "[]"); return Array.isArray(p) ? p : [b.website].filter(Boolean); } catch { return [b.website].filter(Boolean); } })()}
              onChange={(urls) => updateCompetitorBrand(comp.competitor_brand_id, { website: JSON.stringify(urls) })}
            />

            <div>
              <label className="block text-[10px] text-muted uppercase font-semibold mb-1">Description</label>
              <textarea defaultValue={b.description || ""} rows={2}
                onBlur={(e) => updateCompetitorBrand(comp.competitor_brand_id, { description: e.target.value })}
                className="w-full px-2.5 py-1.5 bg-surface2 border border-main rounded-lg text-xs text-main resize-none focus:outline-none focus:border-accent" />
            </div>

            {/* Brand DNA profiles now live in Intelligence → Marcas (new brand_dna engine). */}
            <div className="pt-2 border-t border-main">
              <button
                onClick={() => { setConfirmRemove(comp); }}
                className="px-3 py-1.5 border border-red-200 text-red-500 rounded-lg text-xs font-medium hover:bg-red-50"
              >
                Remove
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderAddForm = (scope) => {
    const proximityOptions = ["Direct", "Adjacent", "Target proximity"];
    return (
      <div className="bg-surface border border-accent rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] text-muted uppercase font-semibold mb-1">Name</label>
            <input value={newComp.name} onChange={(e) => setNewComp({ ...newComp, name: e.target.value })}
              placeholder="Brand name..."
              className="w-full px-2.5 py-1.5 bg-surface2 border border-main rounded-lg text-xs text-main focus:outline-none focus:border-accent" />
          </div>
          <div>
            <label className="block text-[10px] text-muted uppercase font-semibold mb-1">Country</label>
            <CountryInput value={newComp.country} onChange={v => setNewComp({ ...newComp, country: v })} placeholder="Type country..." />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <TaxonomyDropdown
            label="Category"
            value={newComp.category}
            options={categoryOptions}
            onChange={(v) => setNewComp({ ...newComp, category: v, sub_category: "" })}
            onAddOther={(v) => addTaxonomyTerm("category", v)}
            placeholder="-- Category --"
          />
          <TaxonomyDropdown
            label="Sub-category"
            value={newComp.sub_category}
            options={getSubCategoryOptions(newComp.category)}
            onChange={(v) => setNewComp({ ...newComp, sub_category: v })}
            onAddOther={(v) => addTaxonomyTerm("sub_category", v, newComp.category)}
            placeholder="-- Sub-category --"
          />
        </div>

        <MultiUrlInput label="Website URLs" urls={newComp.websites || [""]}
          onChange={urls => setNewComp({ ...newComp, websites: urls })} />

        <div>
          <label className="block text-[10px] text-muted uppercase font-semibold mb-1">Proximity</label>
          <div className="flex gap-2">
            {proximityOptions.map((p) => (
              <button key={p}
                onClick={() => setNewComp({ ...newComp, proximity: p })}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                  newComp.proximity === p
                    ? proximityColor(p) + " ring-1 ring-current"
                    : "border-main text-hint hover:text-main"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={() => addCompetitor(scope)} disabled={saving || !newComp.name.trim()}
            className="px-4 py-1.5 bg-accent text-white rounded-lg text-xs font-semibold disabled:opacity-40">
            {saving ? "Adding..." : "Add"}
          </button>
          <button onClick={() => { scope === "local" ? setShowAddLocal(false) : setShowAddGlobal(false); setNewComp({ name: "", country: "", category: "", sub_category: "", proximity: scope === "local" ? "Direct" : "Direct", websites: [""] }); }}
            className="px-4 py-1.5 border border-main rounded-lg text-xs text-muted hover:text-main">Cancel</button>
        </div>
      </div>
    );
  };

  // Registry-first rendering (all hooks above run unconditionally)
  if (useRegistry === null) {
    return <div className="p-10 text-center text-hint">Loading landscape...</div>;
  }
  if (useRegistry) {
    return <LandscapeRegistry projectId={projectId} orgId={orgId} />;
  }

  if (loading) {
    return <div className="p-10 text-center text-hint">Loading landscape...</div>;
  }

  return (
    <div className="p-5">
      <div className="flex items-center justify-between max-w-6xl mx-auto mb-4">
        <p className="text-xs text-muted">Manage your competitive landscape. Local competitors are in your market; global references are cross-market benchmarks.</p>
        <button onClick={() => aiSuggest("local")} disabled={suggesting}
          className="px-4 py-1.5 border border-accent text-accent rounded-lg text-xs font-semibold hover:bg-accent-soft disabled:opacity-50">
          {suggesting ? "Thinking..." : "AI suggest competitors"}
        </button>
      </div>

      {/* AI Suggestions — two columns */}
      {suggestions.length > 0 && (
        <div className="max-w-6xl mx-auto mb-4 bg-accent-soft border border-accent/20 rounded-xl p-4">
          <div className="flex justify-between items-center mb-3">
            <h4 className="text-xs font-bold text-accent">AI Suggestions</h4>
            <button onClick={() => setSuggestions([])} className="text-[10px] text-hint hover:text-main">Dismiss</button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {/* Local suggestions */}
            <div>
              <p className="text-[10px] font-bold text-muted uppercase mb-2">Local ({suggestions.filter(s=>s.suggestScope==="local").length})</p>
              <div className="space-y-1.5">
                {suggestions.filter(s=>s.suggestScope==="local").map((s, i) => {
                  const name = s.name || s;
                  const already = [...localComps, ...globalRefs].some(c => c.brand?.name?.toLowerCase() === name.toLowerCase());
                  const addSugg = async () => {
                    console.log("[Accept] Adding local:", name);
                    // Find or create brand
                    let { data: existingBrand } = await supabase.from("brands").select("id, name").eq("name", name).eq("organization_id", orgId).maybeSingle();
                    let brandToLink;
                    if (existingBrand) {
                      console.log("[Accept] Brand already exists:", existingBrand.id);
                      brandToLink = existingBrand;
                    } else {
                      const { data: nb, error: e1 } = await supabase.from("brands").insert({
                        name, organization_id: orgId, scope: "local", proximity: s.type === "adjacent" ? "Adjacent" : "Direct",
                        is_active: true, source: "ai_recommended",
                      }).select().single();
                      if (e1) { console.error("[Accept] brand insert error:", e1); showToast("Error: " + e1.message); return; }
                      brandToLink = nb;
                    }
                    // Check if link exists
                    const { data: existingLink } = await supabase.from("brand_competitors").select("own_brand_id").eq("own_brand_id", brandId).eq("competitor_brand_id", brandToLink.id).maybeSingle();
                    if (!existingLink) {
                      const { error: e2 } = await supabase.from("brand_competitors").insert({ own_brand_id: brandId, competitor_brand_id: brandToLink.id });
                      if (e2) console.error("[Accept] link error:", e2);
                    }
                    console.log("[Accept] result:", brandToLink.id, "link created:", !existingLink);
                    setLocalComps(prev => [...prev, { competitor_brand_id: brandToLink.id, brand: brandToLink, entryCount: 0 }]);
                    setSuggestions(prev => prev.filter(x => x.name !== name));
                    showToast(`${name} added`);
                  };
                  return (
                    <div key={`l${i}`} className={`w-full px-3 py-2 rounded-lg border text-xs transition ${already?"bg-green-50 border-green-200 text-green-700":"bg-surface border-main text-main"}`}>
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="font-semibold">{name}</span>
                          {s.reason && <span className="text-hint block mt-0.5 text-[10px]">{s.reason}</span>}
                        </div>
                        {already ? <span className="text-green-600 text-[10px] font-semibold flex-shrink-0">Added</span>
                          : <button onClick={addSugg} className="px-2 py-0.5 bg-accent text-white rounded text-[10px] font-semibold hover:opacity-90 flex-shrink-0">+ Add</button>}
                      </div>
                    </div>);
                })}
              </div>
            </div>
            {/* Global suggestions */}
            <div>
              <p className="text-[10px] font-bold text-muted uppercase mb-2">Global ({suggestions.filter(s=>s.suggestScope==="global").length})</p>
              <div className="space-y-1.5">
                {suggestions.filter(s=>s.suggestScope==="global").map((s, i) => {
                  const name = s.name || s;
                  const already = [...localComps, ...globalRefs].some(c => c.brand?.name?.toLowerCase() === name.toLowerCase());
                  const addSugg = async () => {
                    console.log("[Accept] Adding global:", name);
                    let { data: existingBrand } = await supabase.from("brands").select("id, name").eq("name", name).eq("organization_id", orgId).maybeSingle();
                    let brandToLink;
                    if (existingBrand) {
                      console.log("[Accept] Brand already exists:", existingBrand.id);
                      brandToLink = existingBrand;
                    } else {
                      const { data: nb, error: e1 } = await supabase.from("brands").insert({
                        name, organization_id: orgId, scope: "global", proximity: "Target proximity",
                        country: s.country || "", is_active: true, source: "ai_recommended",
                      }).select().single();
                      if (e1) { console.error("[Accept] brand insert error:", e1); showToast("Error: " + e1.message); return; }
                      brandToLink = nb;
                    }
                    const { data: existingLink } = await supabase.from("brand_competitors").select("own_brand_id").eq("own_brand_id", brandId).eq("competitor_brand_id", brandToLink.id).maybeSingle();
                    if (!existingLink) {
                      const { error: e2 } = await supabase.from("brand_competitors").insert({ own_brand_id: brandId, competitor_brand_id: brandToLink.id });
                      if (e2) console.error("[Accept] link error:", e2);
                    }
                    console.log("[Accept] result:", brandToLink.id, "link created:", !existingLink);
                    setGlobalRefs(prev => [...prev, { competitor_brand_id: brandToLink.id, brand: brandToLink, entryCount: 0 }]);
                    setSuggestions(prev => prev.filter(x => x.name !== name));
                    showToast(`${name} added`);
                  };
                  return (
                    <div key={`g${i}`} className={`w-full px-3 py-2 rounded-lg border text-xs transition ${already?"bg-green-50 border-green-200 text-green-700":"bg-surface border-main text-main"}`}>
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="font-semibold">{name}</span>
                          {s.country && <span className="text-hint ml-1">({s.country})</span>}
                          {s.reason && <span className="text-hint block mt-0.5 text-[10px]">{s.reason}</span>}
                        </div>
                        {already ? <span className="text-green-600 text-[10px] font-semibold flex-shrink-0">Added</span>
                          : <button onClick={addSugg} className="px-2 py-0.5 bg-accent text-white rounded text-[10px] font-semibold hover:opacity-90 flex-shrink-0">+ Add</button>}
                      </div>
                    </div>);
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 max-w-6xl mx-auto">
        {/* ── LOCAL COMPETITORS ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-main">Local competitors</h3>
              <span className="text-[10px] px-2 py-0.5 bg-accent-soft text-accent rounded-full font-medium">{localComps.length}</span>
            </div>
          </div>

          <div className="space-y-2 mb-3">
            {localComps.length === 0 && !showAddLocal && (
              <div className="bg-surface border border-dashed border-main rounded-xl p-6 text-center">
                <p className="text-xs text-hint">No local competitors yet</p>
              </div>
            )}
            {localComps.map(renderCompetitorCard)}
          </div>

          {showAddLocal ? renderAddForm("local") : (
            <button onClick={() => { setShowAddLocal(true); setNewComp({ ...newComp, proximity: "Direct" }); }}
              className="text-xs text-accent hover:underline font-medium">
              + Add local competitor
            </button>
          )}
        </div>

        {/* ── GLOBAL REFERENCES ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-main">Global references</h3>
              <span className="text-[10px] px-2 py-0.5 bg-accent-soft text-accent rounded-full font-medium">{globalRefs.length}</span>
            </div>
          </div>

          <div className="space-y-2 mb-3">
            {globalRefs.length === 0 && !showAddGlobal && (
              <div className="bg-surface border border-dashed border-main rounded-xl p-6 text-center">
                <p className="text-xs text-hint">No global references yet</p>
              </div>
            )}
            {globalRefs.map(renderCompetitorCard)}
          </div>

          {showAddGlobal ? renderAddForm("global") : (
            <button onClick={() => { setShowAddGlobal(true); setNewComp({ ...newComp, proximity: "Direct" }); }}
              className="text-xs text-accent hover:underline font-medium">
              + Add global reference
            </button>
          )}
        </div>
      </div>

      {/* Confirm removal modal */}
      {confirmRemove && (
        <>
          <div className="fixed inset-0 bg-black/30" style={{ zIndex: 99998 }} onClick={() => setConfirmRemove(null)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-surface border border-main rounded-xl p-6 w-[360px] shadow-2xl" style={{ zIndex: 99999 }}>
            <h4 className="text-sm font-bold text-main mb-2">Remove competitor?</h4>
            <p className="text-xs text-muted mb-4">
              This will remove <strong>{confirmRemove.brand?.name}</strong> from your competitive landscape. The brand record will be preserved, only the competitor link will be deleted.
            </p>
            <div className="flex gap-2">
              <button onClick={() => removeCompetitor(confirmRemove.competitor_brand_id)}
                className="px-4 py-1.5 bg-red-500 text-white rounded-lg text-xs font-semibold hover:bg-red-600">Remove</button>
              <button onClick={() => setConfirmRemove(null)}
                className="px-4 py-1.5 border border-main rounded-lg text-xs text-muted hover:text-main">Cancel</button>
            </div>
          </div>
        </>
      )}

      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-main text-white px-5 py-2.5 rounded-xl text-sm font-medium shadow-xl animate-fadeIn" style={{ zIndex: 99999 }}>{toast}</div>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN SETTINGS CONTENT
   ═══════════════════════════════════════════════════════════════ */
function SettingsContent() {
  const { brandId } = useBrand() || {};
  const { activeOrg } = useRole() || {};
  const orgId = activeOrg?.id;
  const { projectId } = useProject() || {};
  const { framework, frameworkLoaded, refreshFramework } = useFramework() || {};

  const [activeTab, setActiveTab] = useState("profile");

  const tabs = [
    { key: "profile", label: "Profile" },
    { key: "landscape", label: "Competitive landscape" },
    { key: "framework", label: "Analysis framework" },
  ];

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      {/* Header bar */}
      <div className="section-bar px-5 py-3 flex justify-center items-center" style={{background:"transparent",boxShadow:"none"}}>
        <div className="flex items-center gap-0.5 bg-surface border border-main rounded-full p-1 shadow-sm">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`px-4 py-1.5 rounded-full text-[13px] font-medium transition ${
                  activeTab === t.key
                    ? "kd-seg-active"
                    : "text-muted hover:text-main"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
      </div>

      {/* TAB 1: PROFILE */}
      {activeTab === "profile" && (
        <ProfileTab brandId={brandId} orgId={orgId} refreshFramework={refreshFramework} />
      )}

      {/* TAB 2: COMPETITIVE LANDSCAPE */}
      {activeTab === "landscape" && (
        <LandscapeTab brandId={brandId} orgId={orgId} />
      )}

      {/* TAB 3: ANALYSIS FRAMEWORK */}
      {activeTab === "framework" && (
        <FrameworkTab brandId={brandId} projectId={projectId} framework={framework} frameworkLoaded={frameworkLoaded} refreshFramework={refreshFramework} />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   FRAMEWORK TAB — System dims (read-only) + Custom dims (editable)
   ═══════════════════════════════════════════════════════════════ */
function FrameworkTab({ brandId, projectId, framework, frameworkLoaded, refreshFramework }) {
  const supabase = createClient();
  const [expandedDims, setExpandedDims] = useState(new Set());
  const [editingDim, setEditingDim] = useState(null);
  const [newDim, setNewDim] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [frameworkText, setFrameworkText] = useState(framework?.frameworkText || "");

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 3000); };
  const toggleExpand = (key) => setExpandedDims(prev => {
    const next = new Set(prev);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });

  // Custom dimensions from framework (supports both flat and nested)
  const customDims = framework?.dimensions || [];

  // Get fields for a dimension (supports both formats)
  const getDimFields = (dim) => {
    if (dim.fields?.length) return dim.fields; // nested format
    if (dim.values?.length) return [{ key: dim.key, name: dim.name, type: "single_choice", values: dim.values }]; // flat format
    return [];
  };

  const fieldTypeLabel = (type) => {
    if (type === "single_choice") return "Single choice";
    if (type === "multichoice") return "Multi-choice";
    if (type === "textarea") return "Text area";
    if (type === "toggle") return "Toggle";
    if (type === "rating") return "Rating";
    if (type === "brand_selector") return "Brand selector";
    if (type === "country_search") return "Country search";
    if (type === "taxonomy") return "Taxonomy dropdown";
    if (type === "url") return "URL";
    return "Text";
  };

  // Save custom dimensions. Project-centric projects store them in
  // project_frameworks.dimensions (what framework-context loads); legacy brand-based
  // projects use brand_frameworks.custom_dimensions.
  const saveCustomDims = async (updatedDims) => {
    setSaving(true);
    let error = null;
    if (projectId) {
      const { error: e } = await supabase.from("project_frameworks").update({ dimensions: updatedDims }).eq("project_id", projectId);
      error = e;
    } else if (framework?.id) {
      const { error: e } = await supabase.from("brand_frameworks").update({ custom_dimensions: updatedDims }).eq("id", framework.id);
      error = e;
    }
    refreshFramework?.();
    setSaving(false);
    showToast(error ? ("Error: " + error.message) : "Framework saved");
    setEditingDim(null);
    setNewDim(null);
  };

  // Delete a custom dimension
  const deleteDim = async (idx) => {
    const dim = customDims[idx];
    const dimKeys = (dim.fields || []).map(f => f.key);
    // Check if entries have data for this dimension
    let entryCount = 0;
    if (dimKeys.length > 0) {
      // Count entries where custom_dimensions has any of these keys
      const { count } = await supabase.from("creative_source").select("*", { count: "exact", head: true })
        .not("custom_dimensions", "eq", "{}").not("custom_dimensions", "is", null);
      entryCount = count || 0;
    }
    const msg = entryCount > 0
      ? `This dimension has data in ${entryCount} entries. Deleting it will remove the dimension from the form and AI analysis, but existing data will be preserved in the database. Are you sure?`
      : "Delete this dimension and all its fields?";
    if (!confirm(msg)) return;
    const updated = [...customDims];
    updated.splice(idx, 1);
    await saveCustomDims(updated);
  };

  // Save edited dimension
  const saveDimEdit = async (idx, dimData) => {
    const updated = [...customDims];
    updated[idx] = dimData;
    await saveCustomDims(updated);
  };

  // Add new dimension
  const saveNewDim = async (dimData) => {
    const updated = [...customDims, { ...dimData, sort_order: customDims.length + 100 }];
    await saveCustomDims(updated);
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h3 className="text-lg font-bold text-main mb-2">Analysis Framework</h3>
      <p className="text-xs text-muted mb-6">Dimensions define the structure of your audit form and AI analysis. System dimensions are always present. Custom dimensions are specific to this brand.</p>

      {/* ── SECTION 1: System dimensions (read-only) ── */}
      <div className="mb-8">
        <h4 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">Groundwork dimensions</h4>
        <div className="space-y-2">
          {SYSTEM_DIMENSIONS.map(dim => {
            const isOpen = expandedDims.has(dim.key);
            const fieldCount = dim.fields?.length || 0;
            return (
              <div key={dim.key} className="bg-surface border border-main rounded-xl overflow-hidden">
                <button onClick={() => toggleExpand(dim.key)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-surface2 transition">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-main">{dim.name}</span>
                    <span className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full font-medium">{fieldCount} fields</span>
                    <span className="text-[9px] bg-blue-50 text-blue-500 px-1.5 py-0.5 rounded-full font-medium">System</span>
                  </div>
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" className={`text-hint transition ${isOpen ? "rotate-180" : ""}`}><path d="M2 4l3 3 3-3"/></svg>
                </button>
                {isOpen && (
                  <div className="px-4 pb-3 border-t border-main">
                    {dim.description && <p className="text-[11px] text-muted mt-2 mb-3">{dim.description}</p>}
                    <div className="space-y-1.5">
                      {(dim.fields || []).map(f => (
                        <div key={f.key} className="flex items-center gap-3 py-1 text-xs">
                          <span className="text-main font-medium w-40">{f.name}</span>
                          <span className="text-hint">{fieldTypeLabel(f.type)}</span>
                          {f.values && <span className="text-hint ml-auto truncate max-w-[200px]">{f.values.length} options</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── SECTION 2: Custom dimensions (editable) ── */}
      <div>
        <h4 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">Your personalised dimensions</h4>

        {customDims.length === 0 && !newDim && (
          <div className="bg-surface border border-dashed border-main rounded-xl p-6 text-center mb-4">
            <p className="text-sm text-muted mb-2">No custom dimensions configured</p>
            <p className="text-xs text-hint">Add dimensions to create additional analysis fields specific to your brand.</p>
          </div>
        )}

        <div className="space-y-2 mb-4">
          {customDims.map((dim, idx) => {
            const isOpen = expandedDims.has(`custom_${idx}`);
            const fields = getDimFields(dim);
            const isEditing = editingDim === idx;

            return (
              <div key={idx} className="bg-surface border border-main rounded-xl overflow-hidden">
                <div className="px-4 py-3 flex items-center justify-between">
                  <button onClick={() => toggleExpand(`custom_${idx}`)} className="flex items-center gap-2 flex-1 text-left">
                    <span className="text-sm font-semibold text-main">{dim.name}</span>
                    <span className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full font-medium">{fields.length} fields</span>
                    <span className="text-[9px] bg-purple-50 text-purple-500 px-1.5 py-0.5 rounded-full font-medium">Custom</span>
                  </button>
                  <div className="flex items-center gap-1">
                    <button onClick={() => { setEditingDim(isEditing ? null : idx); toggleExpand(`custom_${idx}`); }}
                      className="text-[10px] text-accent hover:underline px-1">Edit</button>
                    <button onClick={() => deleteDim(idx)}
                      className="text-[10px] text-red-400 hover:text-red-600 px-1">Delete</button>
                    <svg onClick={() => toggleExpand(`custom_${idx}`)} width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" className={`text-hint transition cursor-pointer ${isOpen ? "rotate-180" : ""}`}><path d="M2 4l3 3 3-3"/></svg>
                  </div>
                </div>

                {isOpen && !isEditing && (
                  <div className="px-4 pb-3 border-t border-main">
                    {dim.description && <p className="text-[11px] text-muted mt-2 mb-2">{dim.description}</p>}
                    {dim.classification_rules && <p className="text-[10px] text-hint italic mb-2">Rules: {dim.classification_rules}</p>}
                    <div className="space-y-1.5">
                      {fields.map(f => (
                        <div key={f.key} className="flex items-start gap-3 py-1 text-xs">
                          <span className="text-main font-medium w-36 flex-shrink-0">{f.name}</span>
                          <span className="text-hint">{fieldTypeLabel(f.type)}</span>
                          {f.values && (
                            <div className="flex flex-wrap gap-1 ml-auto">
                              {f.values.map((v, vi) => (
                                <span key={vi} className="text-[10px] bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded">{v}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {isEditing && (
                  <DimensionBuilder
                    initial={dim}
                    onSave={(data) => saveDimEdit(idx, data)}
                    onCancel={() => setEditingDim(null)}
                    saving={saving}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* New dimension builder */}
        {newDim ? (
          <div className="bg-surface border border-accent rounded-xl overflow-hidden">
            <DimensionBuilder
              initial={newDim}
              onSave={(data) => saveNewDim(data)}
              onCancel={() => setNewDim(null)}
              saving={saving}
            />
          </div>
        ) : (
          <button onClick={() => setNewDim({ key: "", name: "", description: "", fields: [], classification_rules: "" })}
            className="text-xs text-accent hover:underline font-medium">
            + New dimension
          </button>
        )}
      </div>

      {/* ── SECTION 3: AI Analysis Context (framework_text) ── */}
      <div className="mt-8 pt-6 border-t border-main">
        <h4 className="text-xs font-bold text-muted uppercase tracking-wider mb-2">AI analysis context</h4>
        <p className="text-[11px] text-hint mb-3">
          This text is included in every AI analysis prompt. It provides detailed definitions, classification rules,
          and context that improve how the AI classifies entries. For specialist frameworks, this contains the full
          research methodology. For other tiers, it's optional but improves accuracy.
        </p>
        <textarea
          value={frameworkText}
          onChange={e => setFrameworkText(e.target.value)}
          rows={12}
          placeholder="Add detailed analysis context for the AI. Include:&#10;- Definitions of your custom dimensions and what each value means&#10;- Classification rules with examples&#10;- Edge cases and special instructions&#10;- Any research methodology or framework the AI should reference&#10;&#10;This is optional but significantly improves classification accuracy."
          className="w-full px-3 py-2.5 bg-surface border border-main rounded-xl text-xs text-main font-mono leading-relaxed focus:outline-none focus:border-accent resize-y"
        />
        <div className="flex justify-between items-center mt-2">
          <span className="text-[10px] text-hint">{frameworkText ? `${frameworkText.length} characters` : "Empty — AI will use dimension rules only"}</span>
          <button onClick={async () => {
            setSaving(true);
            const fwId = framework?.id;
            if (fwId) {
              await supabase.from("brand_frameworks").update({ framework_text: frameworkText }).eq("id", fwId);
            } else if (brandId) {
              await supabase.from("project_frameworks").update({ framework_text: frameworkText }).eq("project_id", projectId);
            }
            refreshFramework?.();
            setSaving(false);
            showToast("AI context saved");
          }} disabled={saving}
            className="px-4 py-1.5 bg-accent text-white rounded-lg text-xs font-semibold disabled:opacity-40">
            {saving ? "Saving..." : "Save context"}
          </button>
        </div>
      </div>

      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-main text-white px-5 py-2.5 rounded-xl text-sm font-medium shadow-xl animate-fadeIn" style={{ zIndex: 99999 }}>{toast}</div>}
    </div>
  );
}

/* ── Dimension Builder (inline editor for custom dimensions) ── */
function DimensionBuilder({ initial, onSave, onCancel, saving }) {
  const [name, setName] = useState(initial?.name || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [rules, setRules] = useState(initial?.classification_rules || "");
  const [generatingRules, setGeneratingRules] = useState(false);
  const [fields, setFields] = useState(initial?.fields || []);

  const addField = () => {
    setFields([...fields, { key: "", name: "", type: "text", values: [] }]);
  };

  const updateField = (idx, updates) => {
    const updated = [...fields];
    updated[idx] = { ...updated[idx], ...updates };
    // Auto-generate key from name
    if (updates.name && !updated[idx].key) {
      updated[idx].key = updates.name.toLowerCase().replace(/[^a-z0-9]+/g, "_");
    }
    setFields(updated);
  };

  const removeField = (idx) => setFields(fields.filter((_, i) => i !== idx));

  const handleSave = () => {
    if (!name.trim()) return;
    const key = initial?.key || name.toLowerCase().replace(/[^a-z0-9]+/g, "_");
    onSave({
      key,
      name: name.trim(),
      description: description.trim(),
      classification_rules: rules.trim(),
      fields: fields.map(f => ({
        ...f,
        key: f.key || f.name.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
        name: f.name.trim(),
      })).filter(f => f.name),
      sort_order: initial?.sort_order || 100,
    });
  };

  return (
    <div className="px-4 py-4 border-t border-main space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[9px] text-hint uppercase font-semibold mb-1">Dimension name</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Target"
            className="w-full px-2.5 py-1.5 bg-surface2 border border-main rounded-lg text-xs text-main focus:outline-none focus:border-accent" />
        </div>
        <div>
          <label className="block text-[9px] text-hint uppercase font-semibold mb-1">Description</label>
          <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Short description"
            className="w-full px-2.5 py-1.5 bg-surface2 border border-main rounded-lg text-xs text-main focus:outline-none focus:border-accent" />
        </div>
      </div>

      {/* Fields — BEFORE classification rules */}
      <div>
        <label className="block text-[9px] text-hint uppercase font-semibold mb-2">Fields</label>
        <div className="space-y-2">
          {fields.map((f, i) => (
            <div key={i} className="bg-surface2 rounded-lg p-2 space-y-1.5">
              <div className="flex gap-2 items-start">
                <input value={f.name} onChange={e => updateField(i, { name: e.target.value })}
                  placeholder="Field name" className="flex-1 px-2 py-1 bg-surface border border-main rounded text-xs text-main focus:outline-none" />
                <select value={f.type} onChange={e => updateField(i, { type: e.target.value })}
                  className="px-2 py-1 bg-surface border border-main rounded text-xs text-main w-28">
                  <option value="text">Text</option>
                  <option value="single_choice">Single choice</option>
                  <option value="multichoice">Multi-choice</option>
                  <option value="textarea">Text area</option>
                </select>
                <button onClick={() => removeField(i)} className="text-red-400 hover:text-red-600 text-sm px-1">×</button>
              </div>
              {(f.type === "single_choice" || f.type === "multichoice") && (
                <input defaultValue={(f.values || []).join(", ")}
                  onBlur={e => updateField(i, { values: e.target.value.split(",").map(v => v.trim()).filter(Boolean) })}
                  placeholder="Options (comma-separated)"
                  className="w-full px-2 py-1 bg-surface border border-main rounded text-xs text-main focus:outline-none" />
              )}
              <input value={f.description || ""} onChange={e => updateField(i, { description: e.target.value })}
                placeholder="Description — what does this field measure? (optional, helps AI classify better)"
                className="w-full px-2 py-1 bg-surface border border-main rounded text-[10px] text-muted focus:outline-none italic" />
            </div>
          ))}
        </div>
        <button onClick={addField} className="text-xs text-accent hover:underline mt-2">+ Add field</button>
      </div>

      {/* Classification rules — AFTER fields, uses field descriptions for AI context */}
      <div className="pt-2 border-t border-main/30">
        <div className="flex justify-between items-center mb-1">
          <label className="block text-[9px] text-hint uppercase font-semibold">Classification instructions (for AI)</label>
          <button type="button" disabled={generatingRules || fields.filter(f=>f.name).length === 0} onClick={async () => {
            setGeneratingRules(true);
            try {
              const fieldDescs = fields.filter(f => f.name).map(f => {
                let desc = `${f.name} (${f.type})`;
                if (f.values?.length) desc += `: options are ${f.values.join(", ")}`;
                else desc += ": free text";
                if (f.description) desc += ` — ${f.description}`;
                return desc;
              }).join("\n");
              const res = await fetch("/api/ai", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  skip_framework: true, max_tokens: 500,
                  messages: [{ role: "user", content: `You are configuring an AI classification system for competitive communication analysis (ads, campaigns, brand content).

A custom analysis dimension called "${name}" (${description || "no description"}) has these fields:
${fieldDescs}

Write concise classification rules (3-5 sentences) that tell the AI how to classify a communication piece into these fields. For each field, explain what signals in the piece determine its value. Focus on whether to classify based on explicit content or implied meaning, and what to do for edge cases. Return ONLY the rules text.` }]
                })
              });
              const data = await res.json();
              const text = data.content?.[0]?.text || "";
              if (text) setRules(text);
            } catch (err) { console.error("[AI Rules]", err); }
            setGeneratingRules(false);
          }} className="text-[9px] text-accent hover:underline font-medium disabled:opacity-50">
            {generatingRules ? "Generating..." : "Generate with AI"}
          </button>
        </div>
        <textarea value={rules} onChange={e => setRules(e.target.value)} rows={3}
          placeholder="Instructions for AI on how to classify entries using these fields. Tip: add descriptions to fields above for better AI-generated rules."
          className="w-full px-2.5 py-1.5 bg-surface2 border border-main rounded-lg text-xs text-main focus:outline-none focus:border-accent resize-y" />
      </div>

      <div className="flex gap-2 pt-2">
        <button onClick={handleSave} disabled={saving || !name.trim()}
          className="px-4 py-1.5 bg-accent text-white rounded-lg text-xs font-semibold disabled:opacity-40">
          {saving ? "Saving..." : "Save"}
        </button>
        <button onClick={onCancel} className="px-4 py-1.5 border border-main rounded-lg text-xs text-muted hover:text-main">Cancel</button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PAGE EXPORT
   ═══════════════════════════════════════════════════════════════ */
export default function SettingsPage() {
  return (
    <AuthGuard>
      <ProjectGuard>
        <Nav />
        <SettingsContent />
      </ProjectGuard>
    </AuthGuard>
  );
}
