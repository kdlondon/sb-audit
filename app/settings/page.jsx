"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import AuthGuard from "@/components/AuthGuard";
import Nav from "@/components/Nav";
import ProjectGuard from "@/components/ProjectGuard";
import { useProject } from "@/lib/project-context";
import { useFramework } from "@/lib/framework-context";

const DEFAULT_BRAND_CATEGORIES = [
  "Traditional Banking",
  "Fintech",
  "Neobank",
  "Credit Union",
  "Supplementary Services",
  "Non-financial",
  "Other",
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
      {/* Pages crawled */}
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

      {/* Profile Card */}
      <div className="bg-surface rounded-xl border border-main overflow-hidden">
        <div
          className="px-5 py-4 border-b border-main"
          style={{ background: "#0a0f3c" }}
        >
          <h3 className="text-xl font-bold text-white">
            {profile.brand_name}
          </h3>
          {profile.tagline && (
            <p className="text-sm text-white/60 mt-1 italic">
              {profile.tagline}
            </p>
          )}
          <div className="flex gap-2 mt-2">
            {profile.category && (
              <span className="text-[10px] px-2 py-0.5 bg-white/10 text-white/80 rounded-full">
                {profile.category}
              </span>
            )}
            {profile.brand_archetype && (
              <span className="text-[10px] px-2 py-0.5 bg-white/10 text-white/80 rounded-full">
                {profile.brand_archetype}
              </span>
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
                <p className="text-[10px] text-muted uppercase font-semibold mb-1">
                  {label}
                </p>
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
                <p className="text-[10px] text-muted uppercase font-semibold mb-1">
                  {label}
                </p>
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
            <p className="text-[10px] text-muted uppercase font-semibold mb-1">
              Strategic Summary
            </p>
            <p className="text-sm text-main leading-relaxed">
              {profile.summary}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN SETTINGS CONTENT
   ═══════════════════════════════════════════════════════════════ */
function SettingsContent() {
  const { projectId, projectName, brandId } = useProject() || {};
  const filterField = "project_id"; // Use project_id for data queries during transition
  const filterValue = projectId || brandId;
  const { framework, frameworkLoaded, refreshFramework } = useFramework() || {};
  const BRAND_CATEGORIES = (frameworkLoaded && framework?.brandCategories?.length > 0) ? framework.brandCategories : DEFAULT_BRAND_CATEGORIES;
  const supabase = createClient();

  const [activeTab, setActiveTab] = useState("project"); // project | brands | profiles | framework
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  // ── Tab 1: Project Info ──
  const [projName, setProjName] = useState("");
  const [projClient, setProjClient] = useState("");
  const [projDesc, setProjDesc] = useState("");
  const [projObjectives, setProjObjectives] = useState("");
  const [projStart, setProjStart] = useState("");
  const [projEnd, setProjEnd] = useState("");

  // ── Tab 2: Brands ──
  const [localBrands, setLocalBrands] = useState([]);
  const [globalBrands, setGlobalBrands] = useState([]);
  const [newLocalName, setNewLocalName] = useState("");
  const [newGlobalName, setNewGlobalName] = useState("");
  const [newGlobalCountry, setNewGlobalCountry] = useState("");

  // ── Tab 3: Profiles ──
  const [allBrands, setAllBrands] = useState([]);
  const [profiles, setProfiles] = useState([]); // brand_profiles rows
  const [expandedBrand, setExpandedBrand] = useState(null);
  const [profileUrls, setProfileUrls] = useState(["", "", ""]);
  const [profileInstructions, setProfileInstructions] = useState("");
  const [crawling, setCrawling] = useState(false);
  const [crawlResult, setCrawlResult] = useState(null);
  const [crawlPages, setCrawlPages] = useState([]);

  /* ─── Load project info ─── */
  const loadProject = useCallback(async () => {
    const { data } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .single();
    if (data) {
      setProjName(data.name || "");
      setProjClient(data.client_name || "");
      setProjDesc(data.description || "");
      setProjObjectives(data.objectives || "");
      setProjStart(data.start_date || "");
      setProjEnd(data.end_date || "");
    }
  }, [projectId]);

  /* ─── Load brands ─── */
  const loadBrands = useCallback(async () => {
    // 1. Load from project_brands
    const { data: pb } = await supabase
      .from("project_brands")
      .select("*")
      .eq(filterField, filterValue)
      .eq("status", "active")
      .order("brand_name");

    const existingLocal = (pb || []).filter((b) => b.scope === "local");
    const existingGlobal = (pb || []).filter((b) => b.scope === "global");
    const existingNames = new Set((pb || []).map((b) => b.brand_name.toLowerCase()));

    // 2. Auto-import from creative_source + brand_metadata
    const [{ data: csEntries }, { data: meta }] =
      await Promise.all([
        supabase
          .from("creative_source")
          .select("brand_name, competitor, brand, scope")
          .eq(filterField, filterValue),
        supabase
          .from("brand_metadata")
          .select("*")
          .eq(filterField, filterValue),
      ]);

    const metaMap = {};
    (meta || []).forEach((m) => {
      metaMap[m.brand_name.toLowerCase()] = m.brand_category || "";
    });

    // Collect brand names that need importing
    const toImportLocal = new Set();
    const toImportGlobal = new Set();

    (csEntries || []).forEach((e) => {
      const name = e.brand_name || (e.scope === "local" ? e.competitor : e.brand);
      if (!name || existingNames.has(name.toLowerCase())) return;
      if (e.scope === "global") toImportGlobal.add(name);
      else toImportLocal.add(name);
    });

    // Insert imports
    const imports = [];
    toImportLocal.forEach((name) => {
      imports.push({
        project_id: projectId,
        brand_id: brandId,
        brand_name: name,
        scope: "local",
        category: metaMap[name.toLowerCase()] || "",
        country: "",
        status: "active",
        urls: [],
      });
    });
    toImportGlobal.forEach((name) => {
      imports.push({
        project_id: projectId,
        brand_id: brandId,
        brand_name: name,
        scope: "global",
        category: metaMap[name.toLowerCase()] || "",
        country: "",
        status: "active",
        urls: [],
      });
    });

    if (imports.length > 0) {
      await supabase.from("project_brands").insert(imports);
      // Reload after import
      const { data: pb2 } = await supabase
        .from("project_brands")
        .select("*")
        .eq(filterField, filterValue)
        .eq("status", "active")
        .order("brand_name");
      setLocalBrands((pb2 || []).filter((b) => b.scope === "local"));
      setGlobalBrands((pb2 || []).filter((b) => b.scope === "global"));
      setAllBrands(pb2 || []);
    } else {
      setLocalBrands(existingLocal);
      setGlobalBrands(existingGlobal);
      setAllBrands(pb || []);
    }
  }, [projectId]);

  /* ─── Load profiles ─── */
  const loadProfiles = useCallback(async () => {
    const { data } = await supabase
      .from("brand_profiles")
      .select("*")
      .eq(filterField, filterValue)
      .order("created_at", { ascending: false });
    setProfiles(data || []);
  }, [projectId]);

  /* ─── Initial load ─── */
  useEffect(() => {
    if (!projectId) return;
    (async () => {
      setLoading(true);
      await Promise.all([loadProject(), loadBrands(), loadProfiles()]);
      setLoading(false);
    })();
  }, [projectId, loadProject, loadBrands, loadProfiles]);

  /* ─── Save project info ─── */
  const saveProject = async () => {
    setSaving(true);
    setSaveMsg("");
    const { error } = await supabase
      .from("projects")
      .update({
        name: projName.trim(),
        client_name: projClient.trim(),
        description: projDesc.trim(),
        objectives: projObjectives.trim(),
        start_date: projStart || null,
        end_date: projEnd || null,
      })
      .eq("id", projectId);
    setSaving(false);
    setSaveMsg(error ? "Error saving" : "Saved");
    setTimeout(() => setSaveMsg(""), 2500);
  };

  /* ─── Brand CRUD ─── */
  const addBrand = async (scope) => {
    const name = scope === "local" ? newLocalName.trim() : newGlobalName.trim();
    if (!name) return;
    const country = scope === "global" ? newGlobalCountry.trim() : "";
    await supabase.from("project_brands").insert({
      project_id: projectId,
      brand_id: brandId,
      brand_name: name,
      scope,
      category: "",
      country,
      status: "active",
      urls: [],
    });
    // Also add to dropdown_options so it appears in audit form competitor dropdown
    if (scope === "local") {
      const { data: existing } = await supabase.from("dropdown_options")
        .select("id").eq(filterField, filterValue).eq("category", "competitor").eq("value", name);
      if (!existing || existing.length === 0) {
        await supabase.from("dropdown_options").insert({
          project_id: projectId, brand_id: brandId, category: "competitor", value: name, sort_order: 999,
        });
      }
      setNewLocalName("");
    } else {
      setNewGlobalName("");
      setNewGlobalCountry("");
    }
    await loadBrands();
  };

  const removeBrand = async (id) => {
    if (!confirm("Remove this brand?")) return;
    await supabase
      .from("project_brands")
      .update({ status: "removed" })
      .eq("id", id);
    await loadBrands();
  };

  const updateBrandCategory = async (id, category) => {
    await supabase
      .from("project_brands")
      .update({ category })
      .eq("id", id);
    // Also sync to brand_metadata
    const brand = [...localBrands, ...globalBrands].find((b) => b.id === id);
    if (brand) {
      const { data: existing } = await supabase
        .from("brand_metadata")
        .select("id")
        .eq(filterField, filterValue)
        .eq("brand_name", brand.brand_name)
        .maybeSingle();
      if (existing) {
        await supabase
          .from("brand_metadata")
          .update({ brand_category: category })
          .eq("id", existing.id);
      } else {
        await supabase.from("brand_metadata").insert({
          project_id: projectId,
          brand_id: brandId,
          brand_name: brand.brand_name,
          brand_category: category,
        });
      }
    }
    await loadBrands();
  };

  const updateBrandCountry = async (id, country) => {
    await supabase
      .from("project_brands")
      .update({ country })
      .eq("id", id);
    await loadBrands();
  };

  const moveBrandScope = async (id, newScope) => {
    await supabase
      .from("project_brands")
      .update({ scope: newScope })
      .eq("id", id);
    await loadBrands();
  };

  /* ─── Profiles ─── */
  const getLatestProfile = (brandName) => {
    return profiles.find(
      (p) => p.brand_name?.toLowerCase() === brandName.toLowerCase()
    );
  };

  const expandBrand = (brand) => {
    if (expandedBrand?.id === brand.id) {
      setExpandedBrand(null);
      return;
    }
    setExpandedBrand(brand);
    setProfileUrls(
      brand.urls && brand.urls.length > 0
        ? [
            brand.urls[0] || "",
            brand.urls[1] || "",
            brand.urls[2] || "",
          ]
        : ["", "", ""]
    );
    setProfileInstructions("");
    // Auto-show existing profile
    const existing = getLatestProfile(brand.brand_name);
    if (existing) {
      setCrawlResult(existing.profile_data);
      setCrawlPages(existing.pages_crawled || []);
    } else {
      setCrawlResult(null);
      setCrawlPages([]);
    }
  };

  const saveUrls = async (brandId) => {
    const filtered = profileUrls.filter((u) => u.trim());
    await supabase
      .from("project_brands")
      .update({ urls: filtered })
      .eq("id", brandId);
    await loadBrands();
  };

  const runCrawler = async (brand) => {
    const urls = profileUrls.filter((u) => u.trim());
    if (urls.length === 0) return;
    setCrawling(true);
    setCrawlResult(null);
    setCrawlPages([]);

    try {
      // Save URLs first
      await supabase
        .from("project_brands")
        .update({ urls })
        .eq("id", brand.id);

      const res = await fetch("/api/brand-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: urls[0],
          extraUrls: urls.slice(1),
          instructions: profileInstructions,
          brandName: brand.brand_name,
          projectId,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setCrawlResult(data.profile);
      setCrawlPages(data.pagesCrawled || []);

      // Save profile to brand_profiles
      await supabase.from("brand_profiles").insert({
        project_id: projectId,
        brand_id: brandId,
        brand_name: brand.brand_name,
        profile_data: data.profile,
        pages_crawled: data.pagesCrawled || [],
        urls_used: urls,
        instructions: profileInstructions,
      });

      // Update category in project_brands if profile has one
      if (data.profile?.category) {
        await updateBrandCategory(brand.id, data.profile.category);
      }

      await loadProfiles();
    } catch (err) {
      setCrawlResult({ error: err.message });
    }
    setCrawling(false);
  };

  /* ─── Render ─── */
  if (loading) {
    return (
      <div className="p-10 text-center text-hint">Loading settings...</div>
    );
  }

  const tabs = [
    { key: "project", label: "Project Info" },
    { key: "brands", label: "Brands" },
    { key: "profiles", label: "Competitor Profiles" },
    { key: "framework", label: "Framework" },
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

      {/* ═══════════════════════════════════════════
          TAB 1: PROJECT INFO
          ═══════════════════════════════════════════ */}
      {activeTab === "project" && (
        <div className="p-5 max-w-2xl mx-auto">
          <div className="bg-surface rounded-xl border border-main p-6 space-y-5">
            <div>
              <label className="block text-[10px] text-muted uppercase font-semibold mb-1">
                Project name
              </label>
              <input
                value={projName}
                onChange={(e) => setProjName(e.target.value)}
                className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[var(--accent)]"
              />
            </div>

            <div>
              <label className="block text-[10px] text-muted uppercase font-semibold mb-1">
                Client name
              </label>
              <input
                value={projClient}
                onChange={(e) => setProjClient(e.target.value)}
                className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[var(--accent)]"
              />
            </div>

            <div>
              <label className="block text-[10px] text-muted uppercase font-semibold mb-1">
                Description
              </label>
              <textarea
                value={projDesc}
                onChange={(e) => setProjDesc(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main resize-y focus:outline-none focus:border-[var(--accent)]"
              />
            </div>

            <div>
              <label className="block text-[10px] text-muted uppercase font-semibold mb-1">
                Objectives
              </label>
              <p className="text-[10px] text-hint mb-1">
                What is this project trying to achieve?
              </p>
              <textarea
                value={projObjectives}
                onChange={(e) => setProjObjectives(e.target.value)}
                rows={3}
                placeholder="e.g., Map the competitive landscape for business banking in the UK, identify positioning gaps..."
                className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main resize-y focus:outline-none focus:border-[var(--accent)]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] text-muted uppercase font-semibold mb-1">
                  Start date
                </label>
                <input
                  type="date"
                  value={projStart}
                  onChange={(e) => setProjStart(e.target.value)}
                  className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
              <div>
                <label className="block text-[10px] text-muted uppercase font-semibold mb-1">
                  End date
                </label>
                <input
                  type="date"
                  value={projEnd}
                  onChange={(e) => setProjEnd(e.target.value)}
                  className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={saveProject}
                disabled={saving}
                className="px-5 py-2 bg-accent text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save changes"}
              </button>
              {saveMsg && (
                <span
                  className={`text-xs font-medium ${
                    saveMsg === "Saved" ? "text-green-600" : "text-red-500"
                  }`}
                >
                  {saveMsg}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════
          TAB 2: BRANDS
          ═══════════════════════════════════════════ */}
      {activeTab === "brands" && (
        <div className="p-5">
          <p className="text-xs text-muted mb-4 text-center">
            Manage brands for this project. Local brands feed into audit entry
            competitor dropdowns. Global brands feed into global audit brand
            dropdowns.
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 max-w-6xl mx-auto">
            {/* ── LOCAL BRANDS ── */}
            <div className="bg-surface rounded-xl border border-main overflow-hidden">
              <div className="px-4 py-3 border-b border-main bg-surface2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-main">Local Brands</h3>
                  <span className="text-[10px] px-2 py-0.5 bg-accent-soft text-accent rounded-full font-medium">
                    {localBrands.length}
                  </span>
                </div>
                <p className="text-[10px] text-hint mt-0.5">
                  scope = local — competitors in audit entries
                </p>
              </div>

              <div className="p-3 max-h-[50vh] overflow-auto">
                {localBrands.length === 0 && (
                  <p className="text-xs text-hint text-center py-6">
                    No local brands yet
                  </p>
                )}
                <div className="space-y-1.5">
                  {localBrands.map((b) => (
                    <div
                      key={b.id}
                      className="flex items-center gap-2 px-3 py-2 bg-surface border border-main rounded-lg group"
                    >
                      <span className="flex-1 text-sm text-main font-medium truncate">
                        {b.brand_name}
                      </span>
                      <select
                        value={b.category || ""}
                        onChange={(e) =>
                          updateBrandCategory(b.id, e.target.value)
                        }
                        className={`px-2 py-1 border rounded-lg text-xs min-w-[140px] ${
                          b.category
                            ? "border-main text-main bg-surface"
                            : "border-amber-300 text-amber-600 bg-amber-50"
                        }`}
                      >
                        <option value="">-- Category --</option>
                        {BRAND_CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => moveBrandScope(b.id, "global")}
                        className="text-[10px] text-accent hover:text-white hover:bg-accent px-1.5 py-0.5 rounded border border-accent opacity-0 group-hover:opacity-100 transition"
                        title="Move to Global"
                      >
                        Global →
                      </button>
                      <button
                        onClick={() => removeBrand(b.id)}
                        className="text-red-400 hover:text-red-600 text-sm px-1 opacity-0 group-hover:opacity-100 transition"
                      >
                        x
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Add local brand */}
              <div className="px-3 py-3 border-t border-main">
                <div className="flex gap-2">
                  <input
                    value={newLocalName}
                    onChange={(e) => setNewLocalName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addBrand("local")}
                    placeholder="Brand name..."
                    className="flex-1 px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[var(--accent)]"
                  />
                  <button
                    onClick={() => addBrand("local")}
                    disabled={!newLocalName.trim()}
                    className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>

            {/* ── GLOBAL BRANDS ── */}
            <div className="bg-surface rounded-xl border border-main overflow-hidden">
              <div className="px-4 py-3 border-b border-main bg-surface2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-main">
                    Global Brands
                  </h3>
                  <span className="text-[10px] px-2 py-0.5 bg-accent-soft text-accent rounded-full font-medium">
                    {globalBrands.length}
                  </span>
                </div>
                <p className="text-[10px] text-hint mt-0.5">
                  scope = global — brands in global audit entries
                </p>
              </div>

              <div className="p-3 max-h-[50vh] overflow-auto">
                {globalBrands.length === 0 && (
                  <p className="text-xs text-hint text-center py-6">
                    No global brands yet
                  </p>
                )}
                <div className="space-y-1.5">
                  {globalBrands.map((b) => (
                    <div
                      key={b.id}
                      className="flex items-center gap-2 px-3 py-2 bg-surface border border-main rounded-lg group"
                    >
                      <span className="flex-1 text-sm text-main font-medium truncate">
                        {b.brand_name}
                      </span>
                      <input
                        defaultValue={b.country || ""}
                        onBlur={(e) =>
                          updateBrandCountry(b.id, e.target.value)
                        }
                        onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
                        placeholder="Country"
                        className="w-[90px] px-2 py-1 border border-main rounded-lg text-xs text-main bg-surface focus:outline-none focus:border-[var(--accent)]"
                      />
                      <select
                        value={b.category || ""}
                        onChange={(e) =>
                          updateBrandCategory(b.id, e.target.value)
                        }
                        className={`px-2 py-1 border rounded-lg text-xs min-w-[140px] ${
                          b.category
                            ? "border-main text-main bg-surface"
                            : "border-amber-300 text-amber-600 bg-amber-50"
                        }`}
                      >
                        <option value="">-- Category --</option>
                        {BRAND_CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => moveBrandScope(b.id, "local")}
                        className="text-[10px] text-accent hover:text-white hover:bg-accent px-1.5 py-0.5 rounded border border-accent opacity-0 group-hover:opacity-100 transition"
                        title="Move to Local"
                      >
                        ← Local
                      </button>
                      <button
                        onClick={() => removeBrand(b.id)}
                        className="text-red-400 hover:text-red-600 text-sm px-1 opacity-0 group-hover:opacity-100 transition"
                      >
                        x
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Add global brand */}
              <div className="px-3 py-3 border-t border-main">
                <div className="flex gap-2">
                  <input
                    value={newGlobalName}
                    onChange={(e) => setNewGlobalName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addBrand("global")}
                    placeholder="Brand name..."
                    className="flex-1 px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[var(--accent)]"
                  />
                  <input
                    value={newGlobalCountry}
                    onChange={(e) => setNewGlobalCountry(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addBrand("global")}
                    placeholder="Country"
                    className="w-[100px] px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[var(--accent)]"
                  />
                  <button
                    onClick={() => addBrand("global")}
                    disabled={!newGlobalName.trim()}
                    className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════
          TAB 3: COMPETITOR PROFILES
          ═══════════════════════════════════════════ */}
      {activeTab === "profiles" && (
        <div className="p-5 max-w-4xl mx-auto">
          <p className="text-xs text-muted mb-4">
            Create and manage brand profiles. Click a brand to configure URLs
            and run the crawler.
          </p>

          {allBrands.length === 0 && (
            <div className="text-center py-16">
              <p className="text-sm text-hint">
                No brands found. Add brands in the Brands tab first.
              </p>
            </div>
          )}

          <div className="space-y-2">
            {allBrands.map((brand) => {
              const latestProfile = getLatestProfile(brand.brand_name);
              const brandProfiles = profiles.filter(
                (p) =>
                  p.brand_name?.toLowerCase() ===
                  brand.brand_name.toLowerCase()
              );
              const isExpanded = expandedBrand?.id === brand.id;

              return (
                <div
                  key={brand.id}
                  className="bg-surface rounded-xl border border-main overflow-hidden"
                >
                  {/* Card header */}
                  <button
                    onClick={() => expandBrand(brand)}
                    className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-surface2 transition"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-main">
                          {brand.brand_name}
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            brand.scope === "local"
                              ? "bg-blue-50 text-blue-600"
                              : "bg-purple-50 text-purple-600"
                          }`}
                        >
                          {brand.scope}
                        </span>
                        {brand.category && (
                          <span className="text-[10px] text-hint">
                            {brand.category}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {latestProfile ? (
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-50 text-green-600 font-medium">
                            Profile exists
                          </span>
                          <span className="text-[10px] text-hint">
                            {new Date(
                              latestProfile.created_at
                            ).toLocaleDateString()}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface2 text-hint font-medium">
                          No profile
                        </span>
                      )}
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        className={`text-hint transition ${
                          isExpanded ? "rotate-180" : ""
                        }`}
                      >
                        <path d="M3 5l3 3 3-3" />
                      </svg>
                    </div>
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="px-4 py-4 border-t border-main space-y-4">
                      {/* URLs */}
                      <div>
                        <p className="text-[10px] text-muted uppercase font-semibold mb-2">
                          URLs to crawl
                        </p>
                        <div className="space-y-1.5">
                          {profileUrls.map((url, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <span className="text-[9px] text-hint w-5 text-right flex-shrink-0">{i+1}</span>
                              <input
                                value={url}
                                onChange={(e) => {
                                  const next = [...profileUrls];
                                  next[i] = e.target.value;
                                  setProfileUrls(next);
                                }}
                                placeholder="https://..."
                                className="flex-1 px-3 py-1.5 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[var(--accent)]"
                              />
                              {profileUrls.length > 1 && (
                                <button onClick={() => setProfileUrls(profileUrls.filter((_, j) => j !== i))}
                                  className="text-red-400 hover:text-red-600 text-sm px-1">×</button>
                              )}
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center gap-3 mt-2">
                          {profileUrls.length < 10 && (
                            <button onClick={() => setProfileUrls([...profileUrls, ""])}
                              className="text-[10px] text-accent hover:underline font-medium">+ Add URL</button>
                          )}
                          <span className="text-[9px] text-hint">{profileUrls.filter(u=>u.trim()).length} of 10 max</span>
                        </div>
                      </div>

                      {/* Instructions */}
                      <div>
                        <label className="block text-[10px] text-muted uppercase font-semibold mb-1">
                          Instructions (optional)
                        </label>
                        <textarea
                          value={profileInstructions}
                          onChange={(e) =>
                            setProfileInstructions(e.target.value)
                          }
                          placeholder="e.g., Focus on business banking, identify products for SMEs..."
                          rows={2}
                          className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main resize-y focus:outline-none focus:border-[var(--accent)]"
                        />
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => runCrawler(brand)}
                          disabled={
                            crawling ||
                            !profileUrls.some((u) => u.trim())
                          }
                          className="px-5 py-2 bg-accent text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50"
                        >
                          {crawling
                            ? "Agent is crawling..."
                            : latestProfile
                            ? "Re-crawl"
                            : "Run Crawler"}
                        </button>
                        {latestProfile && (
                          <button
                            onClick={() => {
                              setCrawlResult(
                                latestProfile.profile_data
                              );
                              setCrawlPages(
                                latestProfile.pages_crawled || []
                              );
                            }}
                            className="px-4 py-2 border border-main rounded-lg text-sm font-medium text-main hover:bg-surface2 transition"
                          >
                            View latest profile
                          </button>
                        )}
                      </div>

                      {/* Crawling spinner */}
                      {crawling && (
                        <div className="flex items-center gap-3 py-2">
                          <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                          <div>
                            <p className="text-sm font-medium text-main">
                              Crawling website...
                            </p>
                            <p className="text-xs text-hint">
                              The agent is visiting pages, extracting
                              content, and analyzing with AI
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Profile result */}
                      {crawlResult && (
                        <BrandProfileCard
                          profile={crawlResult}
                          pagesCrawled={crawlPages}
                        />
                      )}

                      {/* Profile history */}
                      {brandProfiles.length > 0 && (
                        <div>
                          <p className="text-[10px] text-muted uppercase font-semibold mb-2">
                            Profile history ({brandProfiles.length})
                          </p>
                          <div className="space-y-1">
                            {brandProfiles.map((p) => (
                              <div
                                key={p.id}
                                className="flex items-center justify-between px-3 py-2 bg-surface2 rounded-lg"
                              >
                                <div className="flex items-center gap-3">
                                  <span className="text-xs text-main">
                                    {new Date(
                                      p.created_at
                                    ).toLocaleDateString()}{" "}
                                    {new Date(
                                      p.created_at
                                    ).toLocaleTimeString([], {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </span>
                                  {p.urls_used?.length > 0 && (
                                    <span className="text-[10px] text-hint">
                                      {p.urls_used.length} URL
                                      {p.urls_used.length !== 1
                                        ? "s"
                                        : ""}
                                    </span>
                                  )}
                                </div>
                                <button
                                  onClick={() => {
                                    setCrawlResult(p.profile_data);
                                    setCrawlPages(
                                      p.pages_crawled || []
                                    );
                                  }}
                                  className="text-[10px] text-accent hover:underline font-medium"
                                >
                                  View
                                </button>
                              </div>
                            ))}
                          </div>
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

      {/* ═══ TAB 4: FRAMEWORK ═══ */}
      {activeTab === "framework" && (
        <div className="max-w-3xl mx-auto p-6">
          <h3 className="text-lg font-bold text-main mb-4">Analysis Framework</h3>

          {!frameworkLoaded ? (
            <div className="bg-surface border border-main rounded-xl p-6 text-center">
              <p className="text-muted text-sm mb-2">No framework configured for this project.</p>
              <p className="text-hint text-xs">Create one through the onboarding flow or contact the K&D team.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Tier Badge */}
              <div className="bg-surface border border-main rounded-xl p-5">
                <div className="flex items-center gap-3 mb-3">
                  <span className={`text-xs font-bold uppercase px-2.5 py-1 rounded-full ${
                    framework.tier === "specialist" ? "bg-purple-100 text-purple-800" :
                    framework.tier === "enhanced" ? "bg-blue-100 text-blue-800" :
                    "bg-gray-100 text-gray-800"
                  }`}>
                    {framework.tier}
                  </span>
                  <span className="text-sm font-semibold text-main">{framework.name || "Framework"}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div><span className="text-muted">Industry:</span> <span className="text-main">{framework.industry || "—"}</span></div>
                  <div><span className="text-muted">Market:</span> <span className="text-main">{framework.primaryMarket || "—"}</span></div>
                  <div><span className="text-muted">Language:</span> <span className="text-main">{framework.language || "English"}</span></div>
                  <div><span className="text-muted">Brand:</span> <span className="text-main">{framework.brandName || "—"}</span></div>
                </div>
              </div>

              {/* Brand Profile */}
              <div className="bg-surface border border-main rounded-xl p-5">
                <h4 className="text-sm font-semibold text-main mb-3">Brand Profile</h4>
                <div className="space-y-2 text-xs">
                  {[
                    ["Description", framework.brandDescription],
                    ["Positioning", framework.brandPositioning],
                    ["Differentiator", framework.brandDifferentiator],
                    ["Audience", framework.brandAudience],
                    ["Tone", framework.brandTone],
                  ].filter(([,v]) => v).map(([label, value]) => (
                    <div key={label}>
                      <span className="text-muted font-medium">{label}:</span>
                      <span className="text-main ml-1">{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Objectives */}
              {framework.objectives?.length > 0 && (
                <div className="bg-surface border border-main rounded-xl p-5">
                  <h4 className="text-sm font-semibold text-main mb-3">Objectives</h4>
                  <div className="flex flex-wrap gap-2">
                    {framework.objectives.map((obj, i) => (
                      <span key={i} className="text-xs bg-surface2 px-2.5 py-1 rounded-full text-main">{obj}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Active Dimensions */}
              <div className="bg-surface border border-main rounded-xl p-5">
                <h4 className="text-sm font-semibold text-main mb-3">Standard Dimensions</h4>
                <div className="flex flex-wrap gap-2">
                  {(framework.standardDimensions || []).map(dim => (
                    <span key={dim} className="text-xs bg-green-50 text-green-700 border border-green-200 px-2.5 py-1 rounded-full font-medium">{dim}</span>
                  ))}
                </div>
              </div>

              {/* Communication Intents */}
              <div className="bg-surface border border-main rounded-xl p-5">
                <h4 className="text-sm font-semibold text-main mb-3">Communication Intents</h4>
                <div className="flex flex-wrap gap-2">
                  {(framework.communicationIntents || []).map(intent => (
                    <span key={intent} className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-full">{intent}</span>
                  ))}
                </div>
              </div>

              {/* Brand Categories */}
              <div className="bg-surface border border-main rounded-xl p-5">
                <h4 className="text-sm font-semibold text-main mb-3">Brand Categories</h4>
                <div className="flex flex-wrap gap-2">
                  {(framework.brandCategories || []).map(cat => (
                    <span key={cat} className="text-xs bg-surface2 px-2.5 py-1 rounded-full text-main">{cat}</span>
                  ))}
                </div>
              </div>

              {/* Custom Dimensions (Tier 2+) */}
              {framework.dimensions?.length > 0 && (
                <div className="bg-surface border border-main rounded-xl p-5">
                  <h4 className="text-sm font-semibold text-main mb-3">
                    {framework.tier === "specialist" ? "Specialist Dimensions" : "Custom Dimensions"}
                    <span className="text-hint ml-2 font-normal">({framework.dimensions.length})</span>
                  </h4>
                  <div className="space-y-3">
                    {framework.dimensions.map((dim, i) => (
                      <div key={i} className="border border-main rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold text-main">{dim.name}</span>
                          <span className="text-[10px] text-hint font-mono">{dim.key}</span>
                        </div>
                        {dim.description && <p className="text-[11px] text-muted mb-2">{dim.description}</p>}
                        <div className="flex flex-wrap gap-1">
                          {(dim.values || []).map((v, j) => (
                            <span key={j} className="text-[10px] bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded">{v}</span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Global Markets */}
              {framework.globalMarkets?.length > 0 && (
                <div className="bg-surface border border-main rounded-xl p-5">
                  <h4 className="text-sm font-semibold text-main mb-3">Global Markets</h4>
                  <div className="flex flex-wrap gap-2">
                    {framework.globalMarkets.map(m => (
                      <span key={m} className="text-xs bg-surface2 px-2.5 py-1 rounded-full text-main">{m}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
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
