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
import CountryInput from "@/components/CountryInput";

const BRAND_ARCHETYPES = [
  "Innocent", "Explorer", "Sage", "Hero", "Outlaw", "Magician",
  "Regular Guy", "Lover", "Jester", "Caregiver", "Creator", "Ruler",
  "Not identifiable", "Other",
];

const TONE_OPTIONS = [
  "Authoritative", "Empathetic", "Aspirational", "Peer-level",
  "Institutional", "Playful", "Urgent", "Other",
];

const LANGUAGE_OPTIONS = [
  "English", "Spanish", "French", "German", "Italian", "Portuguese",
  "Dutch", "Arabic", "Mandarin", "Japanese", "Korean", "Hindi",
  "Turkish", "Polish", "Swedish", "Danish", "Norwegian", "Finnish",
  "Greek", "Czech", "Romanian", "Hungarian", "Hebrew", "Thai",
  "Vietnamese", "Indonesian", "Malay", "Tagalog", "Other",
];

/* ═══════════════════════════════════════════════════════════════
   BRAND PROFILE CARD — reusable display for crawled profiles
   ═══════════════════════════════════════════════════════════════ */
function BrandProfileCard({ profile, pagesCrawled }) {
  if (!profile) return null;

  if (profile.error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 mt-3">
        <p className="text-sm text-red-600">{profile.error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 mt-3">
      {pagesCrawled?.length > 0 && (
        <div className="bg-surface rounded-xl border border-main p-4">
          <p className="text-[10px] text-muted uppercase font-semibold mb-2">
            Pages crawled ({pagesCrawled.length})
          </p>
          <div className="flex gap-2 flex-wrap">
            {pagesCrawled.map((p, i) => (
              <a
                key={i}
                href={p.url}
                target="_blank"
                rel="noopener"
                className="text-[10px] px-2 py-1 bg-surface2 rounded text-accent hover:underline"
              >
                {p.label || p.title}
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="bg-surface rounded-xl border border-main overflow-hidden">
        <div className="px-5 py-4 border-b border-main" style={{ background: "#0a0f3c" }}>
          <h3 className="text-xl font-bold text-white">{profile.brand_name}</h3>
          {profile.tagline && (
            <p className="text-sm text-white/60 mt-1 italic">{profile.tagline}</p>
          )}
          <div className="flex gap-2 mt-2">
            {profile.category && (
              <span className="text-[10px] px-2 py-0.5 bg-white/10 text-white/80 rounded-full">{profile.category}</span>
            )}
            {profile.brand_archetype && (
              <span className="text-[10px] px-2 py-0.5 bg-white/10 text-white/80 rounded-full">{profile.brand_archetype}</span>
            )}
          </div>
        </div>

        <div className="p-5 grid grid-cols-2 gap-5">
          {[
            ["Description", profile.description],
            ["Target Audience", profile.target_audience],
            ["Value Proposition", profile.value_proposition],
            ["Positioning", profile.positioning],
            ["Emotional Benefit", profile.emotional_benefit],
            ["Rational Benefit", profile.rational_benefit],
            ["Tone of Voice", profile.tone_of_voice],
            ["Brand Personality", profile.brand_personality],
            ["Brand Territory", profile.brand_territory],
            ["Visual Identity", profile.visual_identity],
          ]
            .filter(([, v]) => v)
            .map(([label, value]) => (
              <div key={label}>
                <p className="text-[10px] text-muted uppercase font-semibold mb-1">{label}</p>
                <p className="text-xs text-main leading-relaxed">{value}</p>
              </div>
            ))}

          {[
            ["Key Products", profile.key_products],
            ["Key Messages", profile.key_messages],
            ["Differentiators", profile.differentiators],
            ["Content Themes", profile.content_themes],
            ["Strengths", profile.strengths],
            ["Weaknesses / Gaps", profile.weaknesses],
          ]
            .filter(([, v]) => v?.length)
            .map(([label, items]) => (
              <div key={label}>
                <p className="text-[10px] text-muted uppercase font-semibold mb-1">{label}</p>
                <ul className="space-y-0.5">
                  {items.map((item, i) => (
                    <li key={i} className="text-xs text-main flex gap-1.5">
                      <span className="text-accent">•</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
        </div>

        {profile.summary && (
          <div className="px-5 py-4 border-t border-main bg-surface2">
            <p className="text-[10px] text-muted uppercase font-semibold mb-1">Strategic Summary</p>
            <p className="text-sm text-main leading-relaxed">{profile.summary}</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TAXONOMY DROPDOWN — category/sub_category with "- Other"
   ═══════════════════════════════════════════════════════════════ */
function TaxonomyDropdown({ label, value, options, onChange, onAddOther, placeholder }) {
  const [showOther, setShowOther] = useState(false);
  const [otherVal, setOtherVal] = useState("");

  return (
    <div>
      {label && <label className="block text-[10px] text-muted uppercase font-semibold mb-1">{label}</label>}
      <select
        value={value || ""}
        onChange={(e) => {
          if (e.target.value === "__other__") {
            setShowOther(true);
          } else {
            setShowOther(false);
            onChange(e.target.value);
          }
        }}
        className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[var(--accent)]"
      >
        <option value="">{placeholder || "-- Select --"}</option>
        {options.map((o) => (
          <option key={typeof o === "string" ? o : o.name} value={typeof o === "string" ? o : o.name}>
            {typeof o === "string" ? o : o.name}
          </option>
        ))}
        <option value="__other__">- Other</option>
      </select>
      {showOther && (
        <div className="flex gap-2 mt-1">
          <input
            value={otherVal}
            onChange={(e) => setOtherVal(e.target.value)}
            placeholder="Type new value..."
            className="flex-1 px-2 py-1.5 border border-accent rounded-lg text-xs bg-accent-soft text-main focus:outline-none"
            autoFocus
          />
          <button
            onClick={() => {
              if (otherVal.trim()) {
                onAddOther(otherVal.trim());
                onChange(otherVal.trim());
                setOtherVal("");
                setShowOther(false);
              }
            }}
            className="px-3 py-1.5 bg-accent text-white rounded-lg text-xs font-semibold"
          >
            Add
          </button>
          <button
            onClick={() => { setShowOther(false); setOtherVal(""); }}
            className="px-2 py-1.5 border border-main rounded-lg text-xs text-muted"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

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
  const supabase = createClient();
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
    if (!brandId) return;
    setLoading(true);

    // Load brand
    const { data: brand } = await supabase.from("brands").select("*").eq("id", brandId).single();
    if (brand) {
      setName(brand.name || "");
      setWebsite(brand.website || "");
      setDescription(brand.description || "");
      setCategory(brand.category || "");
      setSubCategory(brand.sub_category || "");
      setMarket(brand.market || "");
      setMarketsToObserve(brand.markets_to_observe || []);
      setTargetAudience(brand.target_audience || "");
      setValueProposition(brand.value_proposition || "");
      setKeyDifferentiator(brand.key_differentiator || "");
      setR2b(brand.r2b || "");
      setBrandTone(brand.brand_tone || "");
      setBrandArchetype(brand.brand_archetype || "");
    }

    // Load brand_frameworks for communication_intents + language
    const { data: fw } = await supabase.from("brand_frameworks").select("communication_intents, language").eq("brand_id", brandId).single();
    if (fw) {
      setCommunicationIntents(fw.communication_intents || ["Brand Hero", "Brand Tactical", "Client Testimonials", "Product", "Innovation"]);
      setLanguage(fw.language || "English");
    }

    await loadTaxonomy();
    setLoading(false);
  }, [brandId]);

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
    if (!brandId) return;
    setSaving(true);

    // Save to brands table
    const { error } = await supabase.from("brands").update({
      name: name.trim(),
      website: website.trim(),
      description: description.trim(),
      category: category.trim(),
      sub_category: subCategory.trim(),
      market: market.trim(),
      markets_to_observe: marketsToObserve,
      target_audience: targetAudience.trim(),
      value_proposition: valueProposition.trim(),
      key_differentiator: keyDifferentiator.trim(),
      r2b: r2b.trim(),
      brand_tone: brandTone.trim(),
      brand_archetype: brandArchetype,
    }).eq("id", brandId);

    // Save to brand_frameworks (communication_intents + language)
    const { data: existingFw } = await supabase.from("brand_frameworks").select("id").eq("brand_id", brandId).single();
    if (existingFw) {
      await supabase.from("brand_frameworks").update({
        communication_intents: communicationIntents,
        language,
      }).eq("id", existingFw.id);
    }

    // Refresh framework context so entry form picks up new communication_intents
    refreshFramework?.();
    setSaving(false);
    if (error) {
      console.error("Profile save error:", error);
      showToast("Error saving: " + error.message);
    } else {
      showToast("Profile saved");
    }
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

      {/* ── Analysis settings ── */}
      <div className="bg-surface rounded-xl border border-main p-6 space-y-4">
        <h4 className="text-xs font-bold text-muted uppercase tracking-wider mb-1">Analysis settings</h4>

        <TagInput
          label="Communication intents"
          tags={communicationIntents}
          onChange={setCommunicationIntents}
          placeholder="e.g., Brand Hero, Product..."
        />

        <div>
          <label className="block text-[10px] text-muted uppercase font-semibold mb-1">Language</label>
          <select value={language} onChange={(e) => setLanguage(e.target.value)}
            className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[var(--accent)]">
            {LANGUAGE_OPTIONS.map((l) => <option key={l} value={l}>{l}</option>)}
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

  // Crawl state
  const [crawling, setCrawling] = useState(null);
  const [crawlResult, setCrawlResult] = useState(null);
  const [crawlPages, setCrawlPages] = useState([]);
  const [crawlHistory, setCrawlHistory] = useState({}); // { brandId: [{id, created_at, urls_used},...] }
  const [expandedHistory, setExpandedHistory] = useState(null); // profile id to show details

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
      setLocalComps([]);
      setGlobalRefs([]);
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
  }, [brandId]);

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

  const addCompetitor = async (scope) => {
    if (!newComp.name.trim()) return;
    setSaving(true);

    // 1. Insert into brands table
    const { data: newBrand, error: brandErr } = await supabase.from("brands").insert({
      name: newComp.name.trim(),
      organization_id: orgId || null,
      country: newComp.country.trim(),
      category: newComp.category.trim(),
      sub_category: newComp.sub_category.trim(),
      website: JSON.stringify((newComp.websites || []).filter(u => u.trim())),
      scope,
      proximity: scope === "local" ? (newComp.proximity || "Direct") : (newComp.proximity || "Direct"),
      is_active: true,
    }).select("id").single();

    if (brandErr || !newBrand) {
      showToast("Error creating brand");
      setSaving(false);
      return;
    }

    // 2. Insert into brand_competitors (only has own_brand_id + competitor_brand_id)
    await supabase.from("brand_competitors").insert({
      own_brand_id: brandId,
      competitor_brand_id: newBrand.id,
    });

    setNewComp({ name: "", country: "", category: "", sub_category: "", proximity: scope === "local" ? "Direct" : "Direct", websites: [""] });
    setShowAddLocal(false);
    setShowAddGlobal(false);
    setSaving(false);
    showToast("Competitor added");
    await loadCompetitors();
  };

  const removeCompetitor = async (compBrandId) => {
    // Delete from brand_competitors only (not brands)
    await supabase.from("brand_competitors").delete().eq("own_brand_id", brandId).eq("competitor_brand_id", compBrandId);
    setConfirmRemove(null);
    showToast("Competitor removed");
    await loadCompetitors();
  };

  const updateCompetitorBrand = async (compBrandId, updates) => {
    await supabase.from("brands").update(updates).eq("id", compBrandId);
    // Update local state instead of full reload to preserve scroll
    const updateList = (list) => list.map(c =>
      c.competitor_brand_id === compBrandId ? { ...c, brand: { ...c.brand, ...updates } } : c
    );
    setLocalComps(prev => updateList(prev));
    setGlobalRefs(prev => updateList(prev));
  };

  const loadCrawlHistory = async (compBrandId) => {
    const { data } = await supabase
      .from("brand_profiles")
      .select("id, created_at, urls_used, profile_data, pages_crawled")
      .eq("brand_id", compBrandId)
      .order("created_at", { ascending: false })
      .limit(10);
    setCrawlHistory(prev => ({ ...prev, [compBrandId]: data || [] }));
  };

  const runCrawl = async (comp) => {
    // Parse URLs — support both JSON array and plain string
    let urls = [];
    try { const p = JSON.parse(comp.brand.website || "[]"); urls = Array.isArray(p) ? p : [comp.brand.website]; } catch { urls = [comp.brand.website].filter(Boolean); }
    if (urls.length === 0) { showToast("No website URL set"); return; }

    setCrawling(comp.competitor_brand_id);
    setCrawlResult(null);
    setCrawlPages([]);

    try {
      const res = await fetch("/api/brand-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: urls[0],
          extraUrls: urls.slice(1),
          brandName: comp.brand.name,
          brand_id: comp.competitor_brand_id,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setCrawlResult(data.profile);
      setCrawlPages(data.pagesCrawled || []);

      // ===== CRAWL SAVE - DEBUG VERSION =====
      console.log("[Crawl] About to save. brand_id:", comp.competitor_brand_id);
      console.log("[Crawl] brand_name:", comp.brand?.name);
      console.log("[Crawl] profile keys:", Object.keys(data.profile || {}));
      console.log("[Crawl] pages crawled:", (data.pagesCrawled || []).length);
      console.log("[Crawl] urls:", urls);

      if (!comp.competitor_brand_id) {
        console.error("[Crawl] ABORT: competitor_brand_id is null/undefined");
        showToast("Error: cannot save — brand ID missing");
      } else {
        try {
          const { data: savedProfile, error: profileError } = await supabase
            .from("brand_profiles")
            .insert({
              brand_id: comp.competitor_brand_id,
              brand_name: comp.brand?.name || "Unknown",
              profile_data: data.profile || {},
              pages_crawled: data.pagesCrawled || [],
              urls_used: urls || [],
            })
            .select()
            .single();

          if (profileError) {
            console.error("[Crawl] INSERT FAILED:", profileError);
            showToast("Crawl save failed: " + profileError.message);
          } else {
            console.log("[Crawl] INSERT SUCCESS. id:", savedProfile.id, "created_at:", savedProfile.created_at);
            showToast("Profile saved to history");
            // Refresh history
            await loadCrawlHistory(comp.competitor_brand_id);
          }
        } catch (err) {
          console.error("[Crawl] UNEXPECTED ERROR:", err);
        }
      }

      // Also update brands.brand_profile
      try {
        await supabase.from("brands").update({
          brand_profile: data.profile || {},
        }).eq("id", comp.competitor_brand_id);
        console.log("[Crawl] brands.brand_profile updated");
      } catch (err) {
        console.error("[Crawl] brands update error:", err);
      }
      // ===== END CRAWL SAVE =====

      // Also update descriptive fields
      if (data.profile) {
        const updates = {};
        if (data.profile.description) updates.description = data.profile.description;
        if (data.profile.target_audience) updates.target_audience = data.profile.target_audience;
        if (data.profile.value_proposition) updates.value_proposition = data.profile.value_proposition;
        if (data.profile.brand_archetype) updates.brand_archetype = data.profile.brand_archetype;
        if (data.profile.category) updates.category = data.profile.category;
        if (Object.keys(updates).length > 0) {
          await updateCompetitorBrand(comp.competitor_brand_id, updates);
        }
      }
      showToast("Website crawled successfully");
    } catch (err) {
      setCrawlResult({ error: err.message });
    }
    setCrawling(null);
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
            if (newId) loadCrawlHistory(newId);
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

            {/* AI Profile section */}
            <div className="pt-2 border-t border-main">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => runCrawl(comp)}
                  disabled={crawling === comp.competitor_brand_id || !b.website}
                  className="px-4 py-1.5 bg-accent text-white rounded-lg text-xs font-semibold hover:opacity-90 disabled:opacity-50"
                >
                  {crawling === comp.competitor_brand_id ? "Crawling..." : "Crawl website"}
                </button>
                <button
                  onClick={() => { setConfirmRemove(comp); }}
                  className="px-3 py-1.5 border border-red-200 text-red-500 rounded-lg text-xs font-medium hover:bg-red-50"
                >
                  Remove
                </button>
              </div>

              {crawling === comp.competitor_brand_id && (
                <div className="flex items-center gap-3 py-2 mt-2">
                  <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs text-hint">Crawling and analyzing website...</p>
                </div>
              )}

              {crawlResult && expandedId === comp.competitor_brand_id && (
                <BrandProfileCard profile={crawlResult} pagesCrawled={crawlPages} />
              )}

              {/* Crawl History */}
              {(crawlHistory[comp.competitor_brand_id] || []).length > 0 && (
                <div className="mt-3 pt-2 border-t border-main/50">
                  <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-2">Crawl history</p>
                  <div className="space-y-1.5">
                    {(crawlHistory[comp.competitor_brand_id] || []).map(h => {
                      const date = new Date(h.created_at);
                      const label = date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) + ", " + date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
                      const isOpen = expandedHistory === h.id;
                      return (
                        <div key={h.id} className="border border-main rounded-lg overflow-hidden">
                          <button onClick={() => setExpandedHistory(isOpen ? null : h.id)}
                            className="w-full text-left px-3 py-2 flex justify-between items-center hover:bg-surface2 transition">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-main font-medium">{label}</span>
                              <span className="text-[10px] text-hint">{(h.urls_used || []).length} URLs · {Object.keys(h.profile_data || {}).length} fields</span>
                            </div>
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" className={`text-hint transition ${isOpen ? "rotate-180" : ""}`}><path d="M2 4l3 3 3-3"/></svg>
                          </button>
                          {isOpen && (
                            <div className="px-3 pb-3 border-t border-main">
                              {h.urls_used?.length > 0 && (
                                <div className="mt-2 mb-2">
                                  <p className="text-[9px] text-hint uppercase font-semibold mb-1">URLs crawled</p>
                                  <div className="flex flex-wrap gap-1">
                                    {h.urls_used.map((u, ui) => (
                                      <a key={ui} href={u} target="_blank" rel="noopener" className="text-[10px] text-accent hover:underline bg-accent-soft px-2 py-0.5 rounded">{u.replace(/https?:\/\//, "").split("/").slice(0, 2).join("/")}</a>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {h.profile_data && (
                                <div className="mt-2">
                                  <BrandProfileCard profile={h.profile_data} pagesCrawled={h.pages_crawled || []} />
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
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
      <div className="section-bar px-5 py-3 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-bold text-main">Settings</h2>
          <div className="flex bg-surface2 rounded-lg p-0.5">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition ${
                  activeTab === t.key
                    ? "bg-surface text-accent shadow-sm"
                    : "text-muted"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
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
  const [editingDim, setEditingDim] = useState(null); // index of custom dim being edited
  const [newDim, setNewDim] = useState(null); // new dimension being created
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

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

  // Save custom dimensions to brand_frameworks
  const saveCustomDims = async (updatedDims) => {
    setSaving(true);
    const fwId = framework?.id;
    if (fwId) {
      // Update existing brand_framework
      await supabase.from("brand_frameworks").update({ custom_dimensions: updatedDims }).eq("id", fwId);
    } else if (brandId) {
      // Try project_frameworks fallback
      await supabase.from("project_frameworks").update({ dimensions: updatedDims }).eq("project_id", projectId);
    }
    refreshFramework?.();
    setSaving(false);
    showToast("Framework saved");
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

      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-main text-white px-5 py-2.5 rounded-xl text-sm font-medium shadow-xl animate-fadeIn" style={{ zIndex: 99999 }}>{toast}</div>}
    </div>
  );
}

/* ── Dimension Builder (inline editor for custom dimensions) ── */
function DimensionBuilder({ initial, onSave, onCancel, saving }) {
  const [name, setName] = useState(initial?.name || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [rules, setRules] = useState(initial?.classification_rules || "");
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

      <div>
        <label className="block text-[9px] text-hint uppercase font-semibold mb-1">Classification rules (for AI)</label>
        <textarea value={rules} onChange={e => setRules(e.target.value)} rows={2}
          placeholder="Instructions for AI on how to classify these fields..."
          className="w-full px-2.5 py-1.5 bg-surface2 border border-main rounded-lg text-xs text-main focus:outline-none focus:border-accent resize-none" />
      </div>

      {/* Fields */}
      <div>
        <label className="block text-[9px] text-hint uppercase font-semibold mb-2">Fields</label>
        <div className="space-y-2">
          {fields.map((f, i) => (
            <div key={i} className="flex gap-2 items-start bg-surface2 rounded-lg p-2">
              <input value={f.name} onChange={e => updateField(i, { name: e.target.value })}
                placeholder="Field name" className="flex-1 px-2 py-1 bg-surface border border-main rounded text-xs text-main focus:outline-none" />
              <select value={f.type} onChange={e => updateField(i, { type: e.target.value })}
                className="px-2 py-1 bg-surface border border-main rounded text-xs text-main w-28">
                <option value="text">Text</option>
                <option value="single_choice">Single choice</option>
                <option value="multichoice">Multi-choice</option>
                <option value="textarea">Text area</option>
              </select>
              {(f.type === "single_choice" || f.type === "multichoice") && (
                <input defaultValue={(f.values || []).join(", ")}
                  onBlur={e => updateField(i, { values: e.target.value.split(",").map(v => v.trim()).filter(Boolean) })}
                  placeholder="Options (comma-separated)"
                  className="flex-1 px-2 py-1 bg-surface border border-main rounded text-xs text-main focus:outline-none" />
              )}
              <button onClick={() => removeField(i)} className="text-red-400 hover:text-red-600 text-sm px-1">x</button>
            </div>
          ))}
        </div>
        <button onClick={addField} className="text-xs text-accent hover:underline mt-2">+ Add field</button>
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
