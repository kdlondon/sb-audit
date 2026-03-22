"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { CATEGORY_LABELS, STATIC_OPTIONS } from "@/lib/options";
import AuthGuard from "@/components/AuthGuard";
import Nav from "@/components/Nav";
import ProjectGuard from "@/components/ProjectGuard";
import { useProject } from "@/lib/project-context";

const BRAND_CATEGORIES = ["Traditional Banking", "Fintech", "Neobank", "Credit Union", "Supplementary Services", "Non-financial", "Other"];

function SettingsContent() {
  const { projectId } = useProject();
  const [options, setOptions] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState(null);
  const [activeTab, setActiveTab] = useState("dropdowns"); // dropdowns | brands | profiler
  // Brand profiler state
  const [profilerUrl, setProfilerUrl] = useState("");
  const [profilerBrand, setProfilerBrand] = useState("");
  const [profilerInstructions, setProfilerInstructions] = useState("");
  const [profiling, setProfiling] = useState(false);
  const [profileResult, setProfileResult] = useState(null);
  const [profilePages, setProfilePages] = useState([]);
  const [newValue, setNewValue] = useState("");
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  // Brand metadata
  const [brandMeta, setBrandMeta] = useState([]); // [{brand_name, brand_category}]
  const [allBrandNames, setAllBrandNames] = useState([]);

  const load = useCallback(async () => {
    const { data } = await supabase.from("dropdown_options").select("*").eq("project_id", projectId).order("sort_order", { ascending: true });
    if (data) {
      const grouped = {};
      data.forEach(row => {
        if (!grouped[row.category]) grouped[row.category] = [];
        grouped[row.category].push({ id: row.id, value: row.value, sort_order: row.sort_order });
      });
      setOptions(grouped);
      if (!activeCategory && Object.keys(grouped).length > 0) {
        setActiveCategory(Object.keys(grouped)[0]);
      }
    }

    // Load brand metadata
    const { data: meta } = await supabase.from("brand_metadata").select("*").eq("project_id", projectId);
    setBrandMeta(meta || []);

    // Get all unique brand names from data + settings
    const [{ data: local }, { data: global }] = await Promise.all([
      supabase.from("audit_entries").select("competitor").eq("project_id", projectId),
      supabase.from("audit_global").select("brand").eq("project_id", projectId),
    ]);
    const settingsBrands = (data || []).filter(d => d.category === "competitor").map(d => d.value);
    const dataBrands = [
      ...(local || []).map(e => e.competitor),
      ...(global || []).map(e => e.brand),
      ...settingsBrands,
    ].filter(Boolean);
    const unique = [...new Set(dataBrands)].filter(b => b !== "Other").sort();
    setAllBrandNames(unique);

    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const addValue = async () => {
    if (!newValue.trim() || !activeCategory) return;
    setSaving(true);
    const currentItems = options[activeCategory] || [];
    const maxOrder = currentItems.length > 0 ? Math.max(...currentItems.map(i => i.sort_order)) : -1;
    await supabase.from("dropdown_options").insert({ project_id: projectId, category: activeCategory, value: newValue.trim(), sort_order: maxOrder + 1 });
    setNewValue("");
    await load();
    setSaving(false);
  };

  const removeValue = async (id) => {
    if (!confirm("Remove this option?")) return;
    await supabase.from("dropdown_options").delete().eq("id", id);
    await load();
  };

  const moveUp = async (item, index) => {
    const items = options[activeCategory];
    if (index === 0) return;
    const prev = items[index - 1];
    await supabase.from("dropdown_options").update({ sort_order: prev.sort_order }).eq("id", item.id);
    await supabase.from("dropdown_options").update({ sort_order: item.sort_order }).eq("id", prev.id);
    await load();
  };

  const moveDown = async (item, index) => {
    const items = options[activeCategory];
    if (index === items.length - 1) return;
    const next = items[index + 1];
    await supabase.from("dropdown_options").update({ sort_order: next.sort_order }).eq("id", item.id);
    await supabase.from("dropdown_options").update({ sort_order: item.sort_order }).eq("id", next.id);
    await load();
  };

  // Brand category management
  const getBrandCategory = (name) => {
    const found = brandMeta.find(m => m.brand_name === name);
    return found?.brand_category || "";
  };

  const setBrandCategory = async (name, cat) => {
    const existing = brandMeta.find(m => m.brand_name === name);
    if (existing) {
      await supabase.from("brand_metadata").update({ brand_category: cat }).eq("id", existing.id);
    } else {
      await supabase.from("brand_metadata").insert({ project_id: projectId, brand_name: name, brand_category: cat });
    }
    // Refresh
    const { data } = await supabase.from("brand_metadata").select("*").eq("project_id", projectId);
    setBrandMeta(data || []);
  };

  const categories = Object.keys(CATEGORY_LABELS);

  if (loading) return <div className="p-10 text-center text-hint">Loading settings...</div>;

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <div className="section-bar px-5 py-3 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-bold text-main">Settings</h2>
          <div className="flex bg-surface2 rounded-lg p-0.5">
            <button onClick={() => setActiveTab("dropdowns")} className={`px-3 py-1 rounded-md text-xs font-medium transition ${activeTab === "dropdowns" ? "bg-surface text-accent shadow-sm" : "text-muted"}`}>Dropdowns</button>
            <button onClick={() => setActiveTab("brands")} className={`px-3 py-1 rounded-md text-xs font-medium transition ${activeTab === "brands" ? "bg-surface text-accent shadow-sm" : "text-muted"}`}>Brand Classification</button>
            <button onClick={() => setActiveTab("profiler")} className={`px-3 py-1 rounded-md text-xs font-medium transition ${activeTab === "profiler" ? "bg-surface text-accent shadow-sm" : "text-muted"}`}>Brand Profiler</button>
          </div>
        </div>
      </div>

      {activeTab === "dropdowns" ? (
        <div className="flex" style={{ height: "calc(100vh - 90px)" }}>
          {/* Left: Category list */}
          <div className="w-[240px] border-r border-main bg-surface overflow-auto">
            <div className="p-2">
              {categories.map(cat => {
                const count = (options[cat] || []).length;
                return (
                  <button key={cat} onClick={() => { setActiveCategory(cat); setNewValue(""); }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm mb-0.5 transition flex justify-between items-center ${
                      activeCategory === cat ? "bg-accent-soft text-accent font-medium" : "text-main hover:bg-surface2"
                    }`}>
                    <span>{CATEGORY_LABELS[cat]}</span>
                    <span className="text-[10px] text-hint">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Values editor */}
          <div className="flex-1 overflow-auto">
            {activeCategory ? (
              <div className="p-5 max-w-xl">
                <h3 className="text-base font-bold text-main mb-1">{CATEGORY_LABELS[activeCategory]}</h3>
                <p className="text-xs text-muted mb-4">
                  {(options[activeCategory] || []).length} values. These appear as dropdown options in the audit form.
                </p>

                <div className="flex gap-2 mb-4">
                  <input value={newValue} onChange={e => setNewValue(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && addValue()}
                    placeholder="Add new value..."
                    className="flex-1 px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[var(--accent)]" />
                  <button onClick={addValue} disabled={!newValue.trim() || saving}
                    className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50">
                    Add
                  </button>
                </div>

                <div className="space-y-1">
                  {(options[activeCategory] || []).map((item, i) => (
                    <div key={item.id}
                      className="flex items-center gap-2 px-3 py-2 bg-surface border border-main rounded-lg group">
                      <span className="flex-1 text-sm text-main">{item.value}</span>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                        <button onClick={() => moveUp(item, i)} disabled={i === 0}
                          className="text-xs text-muted hover:text-main disabled:opacity-30 px-1">↑</button>
                        <button onClick={() => moveDown(item, i)} disabled={i === (options[activeCategory] || []).length - 1}
                          className="text-xs text-muted hover:text-main disabled:opacity-30 px-1">↓</button>
                        <button onClick={() => removeValue(item.id)}
                          className="text-xs text-red-400 hover:text-red-600 px-1">×</button>
                      </div>
                    </div>
                  ))}
                </div>

                {(options[activeCategory] || []).length === 0 && (
                  <p className="text-sm text-hint text-center py-8">No values yet. Add one above.</p>
                )}
              </div>
            ) : (
              <div className="p-10 text-center text-hint">Select a category from the left</div>
            )}
          </div>
        </div>
      ) : (
        /* BRAND CLASSIFICATION TAB */
        <div className="p-5 max-w-3xl mx-auto">
          <p className="text-xs text-muted mb-4">
            Classify each brand by type. This determines how they're grouped in Reports and Dashboard.
          </p>

          <div className="bg-surface border border-main rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-main">
                  <th className="text-left px-4 py-3 text-[10px] text-muted uppercase font-semibold">Brand</th>
                  <th className="text-left px-4 py-3 text-[10px] text-muted uppercase font-semibold">Category</th>
                </tr>
              </thead>
              <tbody>
                {allBrandNames.map(name => (
                  <tr key={name} className="border-b border-main hover:bg-surface2 transition">
                    <td className="px-4 py-2.5 text-sm font-medium text-main">{name}</td>
                    <td className="px-4 py-2.5">
                      <select value={getBrandCategory(name)} onChange={e => setBrandCategory(name, e.target.value)}
                        className={`px-2 py-1 border rounded-lg text-xs ${getBrandCategory(name) ? "border-main text-main bg-surface" : "border-amber-300 text-amber-600 bg-amber-50"}`}>
                        <option value="">— Not classified —</option>
                        {BRAND_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {allBrandNames.length === 0 && (
            <p className="text-sm text-hint text-center py-10">No brands found. Add entries or competitors in Settings first.</p>
          )}
        </div>
      )}

      {/* BRAND PROFILER TAB */}
      {activeTab === "profiler" && (
        <div className="p-5 max-w-4xl mx-auto">
          <div className="bg-surface rounded-xl border border-main p-5 mb-4">
            <h3 className="text-sm font-bold text-main mb-1">Brand Profiler Agent</h3>
            <p className="text-xs text-hint mb-4">Enter a competitor's website URL. The agent will crawl key pages and build a brand profile.</p>

            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-[10px] text-muted uppercase font-semibold mb-1">Website URL</label>
                  <input value={profilerUrl} onChange={e => setProfilerUrl(e.target.value)}
                    placeholder="https://www.competitor.com"
                    className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[var(--accent)]" />
                </div>
                <div className="w-[200px]">
                  <label className="block text-[10px] text-muted uppercase font-semibold mb-1">Brand name</label>
                  <input value={profilerBrand} onChange={e => setProfilerBrand(e.target.value)}
                    placeholder="e.g. Float"
                    className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[var(--accent)]" />
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-muted uppercase font-semibold mb-1">Instructions (optional)</label>
                <textarea value={profilerInstructions} onChange={e => setProfilerInstructions(e.target.value)}
                  placeholder="e.g., Focus on the Business Banking section. Identify products for SMEs, pricing, and value proposition."
                  rows={2}
                  className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main resize-y focus:outline-none focus:border-[var(--accent)]" />
              </div>

              <button onClick={async () => {
                if (!profilerUrl) return;
                setProfiling(true); setProfileResult(null); setProfilePages([]);
                try {
                  const res = await fetch("/api/brand-profile", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ url: profilerUrl, instructions: profilerInstructions, brandName: profilerBrand, projectId }),
                  });
                  const data = await res.json();
                  if (data.error) throw new Error(data.error);
                  setProfileResult(data.profile);
                  setProfilePages(data.pagesCrawled || []);

                  // Auto-save brand metadata
                  if (data.profile?.brand_name && data.profile?.category) {
                    await setBrandCategory(data.profile.brand_name, data.profile.category);
                  }
                } catch (err) {
                  setProfileResult({ error: err.message });
                }
                setProfiling(false);
              }} disabled={profiling || !profilerUrl}
                className="px-5 py-2 bg-accent text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50">
                {profiling ? "Agent is crawling..." : "Run Brand Profiler"}
              </button>
            </div>
          </div>

          {/* Crawl progress */}
          {profiling && (
            <div className="bg-surface rounded-xl border border-main p-5 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                <div>
                  <p className="text-sm font-medium text-main">Crawling website...</p>
                  <p className="text-xs text-hint">The agent is visiting pages, extracting content, and analyzing with AI</p>
                </div>
              </div>
            </div>
          )}

          {/* Results */}
          {profileResult && !profileResult.error && (
            <div className="space-y-4">
              {/* Pages crawled */}
              {profilePages.length > 0 && (
                <div className="bg-surface rounded-xl border border-main p-4">
                  <p className="text-[10px] text-muted uppercase font-semibold mb-2">Pages crawled ({profilePages.length})</p>
                  <div className="flex gap-2 flex-wrap">
                    {profilePages.map((p, i) => (
                      <a key={i} href={p.url} target="_blank" rel="noopener"
                        className="text-[10px] px-2 py-1 bg-surface2 rounded text-accent hover:underline">{p.label || p.title}</a>
                    ))}
                  </div>
                </div>
              )}

              {/* Brand Profile Card */}
              <div className="bg-surface rounded-xl border border-main overflow-hidden">
                <div className="px-5 py-4 border-b border-main" style={{ background: "#0a0f3c" }}>
                  <h3 className="text-xl font-bold text-white">{profileResult.brand_name}</h3>
                  {profileResult.tagline && <p className="text-sm text-white/60 mt-1 italic">{profileResult.tagline}</p>}
                  <div className="flex gap-2 mt-2">
                    {profileResult.category && <span className="text-[10px] px-2 py-0.5 bg-white/10 text-white/80 rounded-full">{profileResult.category}</span>}
                    {profileResult.brand_archetype && <span className="text-[10px] px-2 py-0.5 bg-white/10 text-white/80 rounded-full">{profileResult.brand_archetype}</span>}
                  </div>
                </div>

                <div className="p-5 grid grid-cols-2 gap-5">
                  {[
                    ["Description", profileResult.description],
                    ["Target Audience", profileResult.target_audience],
                    ["Value Proposition", profileResult.value_proposition],
                    ["Positioning", profileResult.positioning],
                    ["Emotional Benefit", profileResult.emotional_benefit],
                    ["Rational Benefit", profileResult.rational_benefit],
                    ["Tone of Voice", profileResult.tone_of_voice],
                    ["Brand Personality", profileResult.brand_personality],
                    ["Brand Territory", profileResult.brand_territory],
                    ["Visual Identity", profileResult.visual_identity],
                  ].filter(([, v]) => v).map(([label, value]) => (
                    <div key={label}>
                      <p className="text-[10px] text-muted uppercase font-semibold mb-1">{label}</p>
                      <p className="text-xs text-main leading-relaxed">{value}</p>
                    </div>
                  ))}

                  {/* Lists */}
                  {[
                    ["Key Products", profileResult.key_products],
                    ["Key Messages", profileResult.key_messages],
                    ["Differentiators", profileResult.differentiators],
                    ["Content Themes", profileResult.content_themes],
                    ["Strengths", profileResult.strengths],
                    ["Weaknesses / Gaps", profileResult.weaknesses],
                  ].filter(([, v]) => v?.length).map(([label, items]) => (
                    <div key={label}>
                      <p className="text-[10px] text-muted uppercase font-semibold mb-1">{label}</p>
                      <ul className="space-y-0.5">
                        {items.map((item, i) => (
                          <li key={i} className="text-xs text-main flex gap-1.5"><span className="text-accent">•</span>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>

                {/* Summary */}
                {profileResult.summary && (
                  <div className="px-5 py-4 border-t border-main bg-surface2">
                    <p className="text-[10px] text-muted uppercase font-semibold mb-1">Strategic Summary</p>
                    <p className="text-sm text-main leading-relaxed">{profileResult.summary}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {profileResult?.error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-sm text-red-600">{profileResult.error}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  return <AuthGuard><ProjectGuard><Nav /><SettingsContent /></ProjectGuard></AuthGuard>;
}
