"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { useProject } from "@/lib/project-context";
import { useRole, canAccess } from "@/lib/role-context";
import Nav from "@/components/Nav";
import AuthGuard from "@/components/AuthGuard";
import ProjectGuard from "@/components/ProjectGuard";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

/* ─── SLIDE TYPES ─── */
const SLIDE_TYPES = {
  title: "Title",
  insight: "Key Insight",
  spotlight: "Creative Spotlight",
  trend: "Trend Analysis",
  comparison: "Brand Comparison",
  summary: "Summary",
};

/* ─── K&D BRAND PALETTE ─── */
const KD_THEMES = [
  { bg: "#0a0f3c", text: "#ffffff", accent: "#4060ff", label: "navy" },        // deep navy
  { bg: "#0019FF", text: "#ffffff", accent: "#ffffff", label: "electric" },     // electric blue
  { bg: "#D4E520", text: "#0a0a0a", accent: "#0a0a0a", label: "chartreuse" },  // acid yellow
  { bg: "#e8e0f0", text: "#1a1a2e", accent: "#0019FF", label: "lavender" },    // soft lavender
  { bg: "#1e1a22", text: "#e5e0eb", accent: "#D4E520", label: "charcoal" },    // dark charcoal
  { bg: "#0a0f3c", text: "#ffffff", accent: "#D4E520", label: "navy-accent" }, // navy + chartreuse
];

// Assign themes to slide types for visual rhythm
function getThemeForSlide(slide, index) {
  switch (slide.type) {
    case "title":      return KD_THEMES[0]; // deep navy
    case "insight":    return index % 2 === 0 ? KD_THEMES[1] : KD_THEMES[4]; // electric blue / charcoal
    case "spotlight":  return KD_THEMES[4]; // charcoal
    case "trend":      return KD_THEMES[2]; // chartreuse
    case "comparison": return KD_THEMES[2]; // chartreuse
    case "summary":    return KD_THEMES[5]; // navy + chartreuse accent
    default:           return KD_THEMES[index % KD_THEMES.length];
  }
}

/* ─── K&D VERTICAL LOGO ─── */
function KDLogo({ color = "#ffffff", opacity = 0.3 }) {
  const letters1 = ["K","N","O","T","S"];
  const letters2 = ["D","O","T","S","."];
  return (
    <div className="absolute left-6 top-6 bottom-6 flex flex-col justify-between select-none pointer-events-none z-10"
      style={{ color, opacity }}>
      <div className="flex flex-col items-start gap-0">
        {letters1.map((l, i) => (
          <span key={i} className="text-[13px] font-bold tracking-wide leading-[1.3]"
            style={{ marginLeft: i === 2 ? 8 : i === 3 ? 4 : 0 }}>{l}</span>
        ))}
        <span className="text-[15px] italic mt-2 mb-2" style={{ fontFamily: "Georgia, serif" }}>&amp;</span>
        {letters2.map((l, i) => (
          <span key={i} className="text-[13px] font-bold tracking-wide leading-[1.3]"
            style={{ marginLeft: i === 1 ? 4 : 0 }}>{l}</span>
        ))}
      </div>
    </div>
  );
}

/* ─── DECORATIVE DOTS (K&D brand element) ─── */
function BrandDots({ color = "#4060ff", opacity = 0.4 }) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0" style={{ opacity }}>
      {[
        { top: "12%", left: "3.5%"  },
        { top: "28%", left: "5%"    },
        { top: "44%", left: "2.5%"  },
        { top: "60%", left: "4.5%"  },
        { top: "76%", left: "2%"    },
        { top: "88%", left: "4%"    },
      ].map((pos, i) => (
        <div key={i} className="absolute w-1.5 h-1.5 rounded-full" style={{ ...pos, backgroundColor: color }} />
      ))}
    </div>
  );
}

/* ─── DOTTED LINE SEPARATOR ─── */
function DottedLine({ color = "#ffffff", opacity = 0.2, className = "" }) {
  return (
    <div className={`w-full ${className}`} style={{ opacity }}>
      <div className="border-t-2 border-dotted w-full" style={{ borderColor: color }} />
    </div>
  );
}

/* ─── MAIN COMPONENT ─── */
export default function ShowcasePage() {
  const { projectId, projectName } = useProject();
  const { role } = useRole();
  const router = useRouter();
  const supabase = createClient();

  // State
  const [view, setView] = useState("list"); // list | create | present | edit
  const [showcases, setShowcases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentShowcase, setCurrentShowcase] = useState(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [toast, setToast] = useState("");

  // Create form
  const [brands, setBrands] = useState([]);
  const [countries, setCountries] = useState([]);
  const [allBrands, setAllBrands] = useState([]);
  const [allCountries, setAllCountries] = useState([]);
  const [yearFrom, setYearFrom] = useState("");
  const [yearTo, setYearTo] = useState("");
  const [selectedBrands, setSelectedBrands] = useState([]);
  const [selectedCountries, setSelectedCountries] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [showcaseTitle, setShowcaseTitle] = useState("");

  // Edit state
  const [editSlides, setEditSlides] = useState([]);
  const [editTitle, setEditTitle] = useState("");
  const [saving, setSaving] = useState(false);

  const canEdit = role === "full_admin" || role === "analyst";
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  /* ─── LOAD SHOWCASES ─── */
  const loadShowcases = async () => {
    const { data } = await supabase
      .from("saved_showcases")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    setShowcases(data || []);
    setLoading(false);
  };

  /* ─── LOAD FILTER OPTIONS ─── */
  const loadFilterOptions = async () => {
    const [localRes, globalRes] = await Promise.all([
      supabase.from("audit_entries").select("competitor, year").eq("project_id", projectId),
      supabase.from("audit_global").select("brand, country, year").eq("project_id", projectId),
    ]);
    const localData = localRes.data || [];
    const globalData = globalRes.data || [];

    const brandSet = new Set();
    localData.forEach(e => e.competitor && brandSet.add(e.competitor));
    globalData.forEach(e => e.brand && brandSet.add(e.brand));
    setAllBrands([...brandSet].sort());

    const countrySet = new Set();
    globalData.forEach(e => e.country && countrySet.add(e.country));
    setAllCountries([...countrySet].sort());
  };

  useEffect(() => { if (projectId) { loadShowcases(); loadFilterOptions(); } }, [projectId]);

  /* ─── GENERATE SHOWCASE ─── */
  const generateShowcase = async () => {
    setGenerating(true);

    // Fetch matching entries
    let localQuery = supabase.from("audit_entries").select("*").eq("project_id", projectId);
    let globalQuery = supabase.from("audit_global").select("*").eq("project_id", projectId);

    if (selectedBrands.length > 0) {
      localQuery = localQuery.in("competitor", selectedBrands);
      globalQuery = globalQuery.in("brand", selectedBrands);
    }
    if (yearFrom) {
      localQuery = localQuery.gte("year", yearFrom);
      globalQuery = globalQuery.gte("year", yearFrom);
    }
    if (yearTo) {
      localQuery = localQuery.lte("year", yearTo);
      globalQuery = globalQuery.lte("year", yearTo);
    }
    if (selectedCountries.length > 0) {
      globalQuery = globalQuery.in("country", selectedCountries);
    }

    // If country filter is set, skip local entries (they have no country field)
    const skipLocal = selectedCountries.length > 0;
    const [localRes, globalRes] = await Promise.all([
      skipLocal ? Promise.resolve({ data: [] }) : localQuery,
      globalQuery,
    ]);
    const entries = [...(localRes.data || []), ...(globalRes.data || [])];

    if (entries.length === 0) {
      showToast("No entries match your filters");
      setGenerating(false);
      return;
    }

    // Build the AI prompt
    const entryData = entries.map(e => ({
      id: e.id,
      brand: e.competitor || e.brand || "Unknown",
      country: e.country || "Local market",
      year: e.year,
      type: e.type,
      description: e.description,
      insight: e.insight,
      idea: e.idea,
      synopsis: e.synopsis,
      main_slogan: e.main_slogan,
      primary_territory: e.primary_territory,
      tone_of_voice: e.tone_of_voice,
      brand_archetype: e.brand_archetype,
      portrait: e.portrait,
      journey_phase: e.journey_phase,
      funnel: e.funnel,
      rating: e.rating,
      image_url: e.image_url,
      image_urls: e.image_urls,
      url: e.url,
      analyst_comment: e.analyst_comment,
      execution_style: e.execution_style,
      main_vp: e.main_vp,
      emotional_benefit: e.emotional_benefit,
      pain_point: e.pain_point,
    }));

    const systemPrompt = `You are a creative strategist at Knots & Dots, building a cinematic presentation showcase.
You analyze advertising and brand communication entries and create a compelling, storytelling-driven presentation.

IMPORTANT RULES:
1. ALL output must be in English regardless of input language
2. Return ONLY valid JSON — no markdown, no code blocks, no explanation
3. Create 6-12 slides that tell a compelling story
4. Every insight must be grounded in the actual data provided
5. Be specific — reference actual brands, campaigns, slogans, and creative approaches
6. For image_url fields, use actual image URLs from the entries when available
7. Write in a strategic, editorial tone — confident and insightful, like a top-tier consultancy
8. Use bold, provocative headlines that could work on a presentation slide
9. Keep body text concise and impactful — this is a visual presentation, not a report

SLIDE TYPES available:
- "title": Opening slide. Fields: title, subtitle, section (optional label like "Creative Intelligence")
- "insight": A key finding. Fields: title, body (markdown), brand, image_url, entry_id
- "spotlight": Deep dive on one creative piece. Fields: title, body (markdown), brand, image_url, entry_id, quote (a standout slogan or line)
- "trend": Pattern across entries. Fields: title, body (short markdown intro), points (array of 3-5 objects with {heading, description})
- "comparison": Compare 2-3 brands. Fields: title, body (markdown), items (array of {brand, description, image_url})
- "summary": Closing slide. Fields: title, takeaways (array of 3-5 strings)

Return JSON in this exact format:
{"title":"Showcase title","slides":[{slide objects}]}`;

    const userMsg = `Create a creative showcase presentation from these ${entries.length} entries:\n\n${JSON.stringify(entryData, null, 1)}`;

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          use_opus: true,
          max_tokens: 8000,
          system: systemPrompt,
          messages: [{ role: "user", content: userMsg }],
        }),
      });

      const data = await res.json();
      const text = data.content?.[0]?.text || "";

      // Parse JSON from response
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
        else throw new Error("Could not parse AI response");
      }

      const title = showcaseTitle.trim() || parsed.title || "Creative Showcase";
      const slides = parsed.slides || [];

      // Save to database
      const { data: { session } } = await supabase.auth.getSession();
      const { data: saved, error } = await supabase.from("saved_showcases").insert({
        title,
        project_id: projectId,
        filters: { brands: selectedBrands, countries: selectedCountries, yearFrom, yearTo },
        slides,
        created_by: session?.user?.email || "",
      }).select().single();

      if (error) throw error;

      setCurrentShowcase(saved);
      setCurrentSlide(0);
      setView("present");
      showToast("Showcase generated!");
      loadShowcases();

    } catch (err) {
      showToast("Error generating showcase: " + err.message);
    }
    setGenerating(false);
  };

  /* ─── SAVE EDITS ─── */
  const saveEdits = async () => {
    setSaving(true);
    await supabase.from("saved_showcases").update({
      title: editTitle,
      slides: editSlides,
      updated_at: new Date().toISOString(),
    }).eq("id", currentShowcase.id);
    setCurrentShowcase({ ...currentShowcase, title: editTitle, slides: editSlides });
    setSaving(false);
    showToast("Changes saved");
    setView("present");
    loadShowcases();
  };

  /* ─── DELETE SHOWCASE ─── */
  const deleteShowcase = async (id, e) => {
    e.stopPropagation();
    if (!confirm("Delete this showcase? This cannot be undone.")) return;
    await supabase.from("saved_showcases").delete().eq("id", id);
    showToast("Showcase deleted");
    loadShowcases();
  };

  /* ─── KEYBOARD NAV ─── */
  useEffect(() => {
    if (view !== "present") return;
    const slides = currentShowcase?.slides || [];
    const handler = (e) => {
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        setCurrentSlide(s => Math.min(s + 1, slides.length - 1));
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setCurrentSlide(s => Math.max(s - 1, 0));
      }
      if (e.key === "Escape") setView("list");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [view, currentShowcase]);

  /* ─── OPEN SHOWCASE ─── */
  const openShowcase = (sc) => {
    setCurrentShowcase(sc);
    setCurrentSlide(0);
    setView("present");
  };

  const enterEdit = () => {
    setEditSlides(JSON.parse(JSON.stringify(currentShowcase.slides)));
    setEditTitle(currentShowcase.title);
    setView("edit");
  };

  /* ─── TOAST ─── */
  const ToastEl = toast ? (
    <div className="fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium z-[100] shadow-lg">
      {toast}
    </div>
  ) : null;

  /* ═══════════════════════════════════════════
     PRESENTATION VIEW (K&D BRANDED)
     ═══════════════════════════════════════════ */
  if (view === "present" && currentShowcase) {
    const slides = currentShowcase.slides || [];
    const slide = slides[currentSlide];
    if (!slide) return null;
    const theme = getThemeForSlide(slide, currentSlide);
    const isDark = theme.label !== "chartreuse" && theme.label !== "lavender";

    return (
      <div className="fixed inset-0 z-50" style={{ backgroundColor: theme.bg }}>
        {ToastEl}

        {/* K&D vertical logo */}
        <KDLogo color={isDark ? "#ffffff" : "#0a0a0a"} opacity={isDark ? 0.2 : 0.15} />
        <BrandDots color={theme.accent} opacity={0.25} />

        {/* Top header bar */}
        <div className="absolute top-0 left-16 right-0 z-50 flex justify-between items-start px-6 py-5">
          <div className="flex items-start gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] font-semibold" style={{ color: isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.4)" }}>
                {projectName || "Groundwork"}
              </p>
              <p className="text-[9px] italic mt-0.5" style={{ color: isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.3)" }}>
                {currentShowcase.title}
              </p>
            </div>
            {slide.section && (
              <>
                <div className="w-px h-8 ml-2" style={{ backgroundColor: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.1)" }} />
                <p className="text-[10px] mt-0.5 ml-2" style={{ color: isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)" }}>
                  {slide.section}
                </p>
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-mono" style={{ color: isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.3)" }}>
              {String(currentSlide + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}
            </span>
            {canEdit && (
              <button onClick={enterEdit}
                className="text-[10px] px-3 py-1 rounded border transition"
                style={{
                  color: isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)",
                  borderColor: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)",
                }}>
                Edit
              </button>
            )}
            <button onClick={() => setView("list")}
              className="text-[10px] px-3 py-1 rounded border transition"
              style={{
                color: isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)",
                borderColor: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)",
              }}>
              Close
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="absolute top-0 left-0 right-0 h-[2px] z-50" style={{ backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }}>
          <div className="h-full transition-all duration-500" style={{
            width: `${((currentSlide + 1) / slides.length) * 100}%`,
            backgroundColor: theme.accent,
            opacity: 0.6,
          }} />
        </div>

        {/* Slide content */}
        <div className="h-full flex items-center justify-center transition-colors duration-700">
          <div className="max-w-5xl w-full mx-auto pl-20 pr-12">
            <SlideRenderer slide={slide} theme={theme} isDark={isDark} projectName={projectName} />
          </div>
        </div>

        {/* Nav arrows */}
        {currentSlide > 0 && (
          <button onClick={() => setCurrentSlide(s => s - 1)}
            className="absolute left-16 bottom-8 text-3xl transition hover:opacity-100"
            style={{ color: isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.2)" }}>
            ←
          </button>
        )}
        {currentSlide < slides.length - 1 && (
          <button onClick={() => setCurrentSlide(s => s + 1)}
            className="absolute right-8 bottom-8 text-3xl transition hover:opacity-100"
            style={{ color: isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.2)" }}>
            →
          </button>
        )}

        {/* Minimal dot indicators */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-1.5">
          {slides.map((_, i) => (
            <button key={i} onClick={() => setCurrentSlide(i)}
              className="rounded-full transition-all"
              style={{
                width: i === currentSlide ? 20 : 6,
                height: 6,
                backgroundColor: i === currentSlide ? theme.accent : (isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.15)"),
              }} />
          ))}
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════
     EDIT VIEW
     ═══════════════════════════════════════════ */
  if (view === "edit" && currentShowcase) {
    return (
      <AuthGuard>
        <ProjectGuard>
          <Nav />
          <div className="min-h-screen" style={{ background: "var(--bg)" }}>
            {ToastEl}
            <div className="max-w-4xl mx-auto p-6">
              {/* Header */}
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <button onClick={() => setView("present")} className="text-muted hover:text-main text-lg">←</button>
                  <h1 className="text-xl font-bold text-main">Edit Showcase</h1>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setView("present")}
                    className="px-4 py-2 border border-main rounded-lg text-sm text-muted hover:text-main transition">
                    Cancel
                  </button>
                  <button onClick={saveEdits} disabled={saving}
                    className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50">
                    {saving ? "Saving..." : "Save changes"}
                  </button>
                </div>
              </div>

              {/* Title */}
              <div className="mb-6">
                <label className="block text-[10px] text-muted uppercase font-semibold mb-1">Showcase Title</label>
                <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[var(--accent)]" />
              </div>

              {/* Slides */}
              <div className="space-y-4">
                {editSlides.map((slide, idx) => (
                  <div key={idx} className="bg-surface border border-main rounded-xl p-5">
                    <div className="flex justify-between items-center mb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] text-hint font-mono">#{idx + 1}</span>
                        <span className="text-[10px] text-accent uppercase font-semibold">
                          {SLIDE_TYPES[slide.type] || slide.type}
                        </span>
                      </div>
                      <div className="flex gap-1">
                        {idx > 0 && (
                          <button onClick={() => {
                            const s = [...editSlides]; [s[idx-1], s[idx]] = [s[idx], s[idx-1]]; setEditSlides(s);
                          }} className="text-xs text-muted hover:text-main px-2 py-1 rounded hover:bg-surface2">↑</button>
                        )}
                        {idx < editSlides.length - 1 && (
                          <button onClick={() => {
                            const s = [...editSlides]; [s[idx], s[idx+1]] = [s[idx+1], s[idx]]; setEditSlides(s);
                          }} className="text-xs text-muted hover:text-main px-2 py-1 rounded hover:bg-surface2">↓</button>
                        )}
                        <button onClick={() => {
                          if (confirm("Remove this slide?")) setEditSlides(editSlides.filter((_, i) => i !== idx));
                        }} className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50">×</button>
                      </div>
                    </div>

                    {/* Editable fields */}
                    <div className="space-y-3">
                      {slide.title !== undefined && (
                        <div>
                          <label className="block text-[10px] text-muted uppercase font-semibold mb-1">Title</label>
                          <input value={slide.title || ""} onChange={e => {
                            const s = [...editSlides]; s[idx] = { ...s[idx], title: e.target.value }; setEditSlides(s);
                          }} className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[var(--accent)]" />
                        </div>
                      )}
                      {slide.subtitle !== undefined && (
                        <div>
                          <label className="block text-[10px] text-muted uppercase font-semibold mb-1">Subtitle</label>
                          <input value={slide.subtitle || ""} onChange={e => {
                            const s = [...editSlides]; s[idx] = { ...s[idx], subtitle: e.target.value }; setEditSlides(s);
                          }} className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[var(--accent)]" />
                        </div>
                      )}
                      {slide.section !== undefined && (
                        <div>
                          <label className="block text-[10px] text-muted uppercase font-semibold mb-1">Section Label</label>
                          <input value={slide.section || ""} onChange={e => {
                            const s = [...editSlides]; s[idx] = { ...s[idx], section: e.target.value }; setEditSlides(s);
                          }} className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[var(--accent)]" />
                        </div>
                      )}
                      {slide.body !== undefined && (
                        <div>
                          <label className="block text-[10px] text-muted uppercase font-semibold mb-1">Body (Markdown)</label>
                          <textarea value={slide.body || ""} rows={5} onChange={e => {
                            const s = [...editSlides]; s[idx] = { ...s[idx], body: e.target.value }; setEditSlides(s);
                          }} className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[var(--accent)] font-mono" />
                        </div>
                      )}
                      {slide.quote !== undefined && (
                        <div>
                          <label className="block text-[10px] text-muted uppercase font-semibold mb-1">Quote</label>
                          <input value={slide.quote || ""} onChange={e => {
                            const s = [...editSlides]; s[idx] = { ...s[idx], quote: e.target.value }; setEditSlides(s);
                          }} className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[var(--accent)] italic" />
                        </div>
                      )}
                      {slide.brand !== undefined && (
                        <div>
                          <label className="block text-[10px] text-muted uppercase font-semibold mb-1">Brand</label>
                          <input value={slide.brand || ""} onChange={e => {
                            const s = [...editSlides]; s[idx] = { ...s[idx], brand: e.target.value }; setEditSlides(s);
                          }} className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[var(--accent)]" />
                        </div>
                      )}
                      {slide.image_url !== undefined && (
                        <div>
                          <label className="block text-[10px] text-muted uppercase font-semibold mb-1">Image URL</label>
                          <input value={slide.image_url || ""} onChange={e => {
                            const s = [...editSlides]; s[idx] = { ...s[idx], image_url: e.target.value }; setEditSlides(s);
                          }} className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[var(--accent)]" />
                        </div>
                      )}
                      {slide.points && (
                        <div>
                          <label className="block text-[10px] text-muted uppercase font-semibold mb-1">Points</label>
                          {slide.points.map((point, pi) => {
                            const isObj = typeof point === "object";
                            return (
                              <div key={pi} className="flex gap-2 mb-2">
                                <span className="text-xs text-hint font-mono mt-2 w-6">{String(pi+1).padStart(2,"0")}</span>
                                {isObj ? (
                                  <div className="flex-1 space-y-1">
                                    <input value={point.heading || ""} placeholder="Heading" onChange={e => {
                                      const s = [...editSlides]; const pts = [...s[idx].points]; pts[pi] = { ...pts[pi], heading: e.target.value }; s[idx] = { ...s[idx], points: pts }; setEditSlides(s);
                                    }} className="w-full px-2 py-1 bg-surface border border-main rounded text-xs text-main font-semibold" />
                                    <input value={point.description || ""} placeholder="Description" onChange={e => {
                                      const s = [...editSlides]; const pts = [...s[idx].points]; pts[pi] = { ...pts[pi], description: e.target.value }; s[idx] = { ...s[idx], points: pts }; setEditSlides(s);
                                    }} className="w-full px-2 py-1 bg-surface border border-main rounded text-xs text-main" />
                                  </div>
                                ) : (
                                  <input value={point} placeholder="Point" onChange={e => {
                                    const s = [...editSlides]; const pts = [...s[idx].points]; pts[pi] = e.target.value; s[idx] = { ...s[idx], points: pts }; setEditSlides(s);
                                  }} className="flex-1 px-2 py-1 bg-surface border border-main rounded text-xs text-main" />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {slide.takeaways && (
                        <div>
                          <label className="block text-[10px] text-muted uppercase font-semibold mb-1">Takeaways (one per line)</label>
                          <textarea value={(slide.takeaways || []).join("\n")} rows={4} onChange={e => {
                            const s = [...editSlides]; s[idx] = { ...s[idx], takeaways: e.target.value.split("\n") }; setEditSlides(s);
                          }} className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[var(--accent)]" />
                        </div>
                      )}
                      {slide.items && (
                        <div>
                          <label className="block text-[10px] text-muted uppercase font-semibold mb-2">Comparison Items</label>
                          {slide.items.map((item, ii) => (
                            <div key={ii} className="flex gap-2 mb-2">
                              <input value={item.brand || ""} placeholder="Brand" onChange={e => {
                                const s = [...editSlides]; const items = [...s[idx].items]; items[ii] = { ...items[ii], brand: e.target.value }; s[idx] = { ...s[idx], items }; setEditSlides(s);
                              }} className="w-32 px-2 py-1 bg-surface border border-main rounded text-xs text-main" />
                              <input value={item.description || ""} placeholder="Description" onChange={e => {
                                const s = [...editSlides]; const items = [...s[idx].items]; items[ii] = { ...items[ii], description: e.target.value }; s[idx] = { ...s[idx], items }; setEditSlides(s);
                              }} className="flex-1 px-2 py-1 bg-surface border border-main rounded text-xs text-main" />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ProjectGuard>
      </AuthGuard>
    );
  }

  /* ═══════════════════════════════════════════
     CREATE VIEW
     ═══════════════════════════════════════════ */
  if (view === "create") {
    return (
      <AuthGuard>
        <ProjectGuard>
          <Nav />
          <div className="min-h-screen" style={{ background: "var(--bg)" }}>
            {ToastEl}
            <div className="max-w-2xl mx-auto p-6">
              <div className="flex items-center gap-3 mb-6">
                <button onClick={() => setView("list")} className="text-muted hover:text-main text-lg">←</button>
                <h1 className="text-xl font-bold text-main">New Creative Showcase</h1>
              </div>

              <div className="bg-surface border border-main rounded-xl p-6 space-y-5">
                {/* Title */}
                <div>
                  <label className="block text-[10px] text-muted uppercase font-semibold mb-1">Showcase Title (optional)</label>
                  <input value={showcaseTitle} onChange={e => setShowcaseTitle(e.target.value)}
                    placeholder="AI will generate a title if left empty"
                    className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[var(--accent)]" />
                </div>

                {/* Year range */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-muted uppercase font-semibold mb-1">Year From</label>
                    <select value={yearFrom} onChange={e => setYearFrom(e.target.value)}
                      className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[var(--accent)]">
                      <option value="">All years</option>
                      {["2020","2021","2022","2023","2024","2025","2026"].map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-muted uppercase font-semibold mb-1">Year To</label>
                    <select value={yearTo} onChange={e => setYearTo(e.target.value)}
                      className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[var(--accent)]">
                      <option value="">All years</option>
                      {["2020","2021","2022","2023","2024","2025","2026"].map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                </div>

                {/* Brands */}
                <div>
                  <label className="block text-[10px] text-muted uppercase font-semibold mb-1">
                    Brands {selectedBrands.length > 0 && `(${selectedBrands.length} selected)`}
                  </label>
                  <div className="flex flex-wrap gap-1.5 p-2 bg-surface border border-main rounded-lg min-h-[40px]">
                    {allBrands.length === 0 && <span className="text-xs text-hint">No brands found in entries</span>}
                    {allBrands.map(b => {
                      const sel = selectedBrands.includes(b);
                      return (
                        <button key={b} onClick={() => {
                          setSelectedBrands(sel ? selectedBrands.filter(x => x !== b) : [...selectedBrands, b]);
                        }} className={`px-2.5 py-1 rounded-full text-xs font-medium transition ${
                          sel ? "bg-accent text-white" : "bg-surface2 text-muted hover:text-main"
                        }`}>{b}</button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-hint mt-1">Leave empty to include all brands</p>
                </div>

                {/* Countries */}
                {allCountries.length > 0 && (
                  <div>
                    <label className="block text-[10px] text-muted uppercase font-semibold mb-1">
                      Markets {selectedCountries.length > 0 && `(${selectedCountries.length} selected)`}
                    </label>
                    <div className="flex flex-wrap gap-1.5 p-2 bg-surface border border-main rounded-lg min-h-[40px]">
                      {allCountries.map(c => {
                        const sel = selectedCountries.includes(c);
                        return (
                          <button key={c} onClick={() => {
                            setSelectedCountries(sel ? selectedCountries.filter(x => x !== c) : [...selectedCountries, c]);
                          }} className={`px-2.5 py-1 rounded-full text-xs font-medium transition ${
                            sel ? "bg-accent text-white" : "bg-surface2 text-muted hover:text-main"
                          }`}>{c}</button>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-hint mt-1">Leave empty to include all markets</p>
                  </div>
                )}

                {/* Generate button */}
                <button onClick={generateShowcase} disabled={generating}
                  className="w-full py-3 text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition"
                  style={{ backgroundColor: "#0019FF" }}>
                  {generating ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                      Generating showcase...
                    </span>
                  ) : "Generate Showcase"}
                </button>
              </div>
            </div>
          </div>
        </ProjectGuard>
      </AuthGuard>
    );
  }

  /* ═══════════════════════════════════════════
     LIST VIEW (DEFAULT)
     ═══════════════════════════════════════════ */
  return (
    <AuthGuard>
      <ProjectGuard>
        <Nav />
        <div className="min-h-screen" style={{ background: "var(--bg)" }}>
          {ToastEl}
          <div className="max-w-4xl mx-auto p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h1 className="text-xl font-bold text-main">Creative Showcase</h1>
                <p className="text-xs text-muted mt-1">Cinematic presentations powered by AI</p>
              </div>
              {canEdit && (
                <button onClick={() => setView("create")}
                  className="px-4 py-2 text-white rounded-lg text-sm font-semibold hover:opacity-90"
                  style={{ backgroundColor: "#0019FF" }}>
                  + New Showcase
                </button>
              )}
            </div>

            {loading ? (
              <p className="text-hint text-center py-20">Loading showcases...</p>
            ) : showcases.length === 0 ? (
              <div className="text-center py-20 text-hint">
                <div className="w-16 h-16 mx-auto mb-6 rounded-full flex items-center justify-center" style={{ backgroundColor: "#0a0f3c" }}>
                  <span className="text-white text-xl font-bold">K</span>
                </div>
                <p className="text-lg mb-2">No showcases yet</p>
                <p className="text-sm">{canEdit ? "Create your first creative showcase" : "No showcases have been created for this project yet"}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {showcases.map(sc => (
                  <div key={sc.id} onClick={() => openShowcase(sc)}
                    className="bg-surface border border-main rounded-xl overflow-hidden hover:border-[var(--accent)] transition cursor-pointer group">
                    {/* Preview header — K&D navy */}
                    <div className="p-6 relative overflow-hidden" style={{ backgroundColor: "#0a0f3c" }}>
                      <div className="absolute top-3 left-3 flex flex-col gap-0 opacity-20">
                        {["K","N","O","T","S"].map((l,i) => <span key={i} className="text-white text-[8px] font-bold leading-[1.3]">{l}</span>)}
                      </div>
                      <div className="ml-6">
                        <h3 className="text-white font-bold text-lg group-hover:text-blue-200 transition">{sc.title}</h3>
                        <p className="text-white/40 text-xs mt-1">{(sc.slides || []).length} slides</p>
                      </div>
                    </div>
                    <div className="px-5 py-3 flex justify-between items-center">
                      <div>
                        <p className="text-[10px] text-hint">
                          {sc.created_by} · {new Date(sc.created_at).toLocaleDateString()}
                        </p>
                        {sc.filters && (
                          <p className="text-[10px] text-muted mt-0.5">
                            {[
                              sc.filters.brands?.length ? `${sc.filters.brands.length} brands` : null,
                              sc.filters.yearFrom || sc.filters.yearTo ? `${sc.filters.yearFrom || "?"} – ${sc.filters.yearTo || "?"}` : null,
                            ].filter(Boolean).join(" · ") || "All entries"}
                          </p>
                        )}
                      </div>
                      {canEdit && (
                        <button onClick={(e) => deleteShowcase(sc.id, e)}
                          className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50 transition">
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </ProjectGuard>
    </AuthGuard>
  );
}

/* ═══════════════════════════════════════════
   SLIDE RENDERER (K&D BRANDED)
   ═══════════════════════════════════════════ */
function SlideRenderer({ slide, theme, isDark, projectName }) {
  const textColor = isDark ? "#ffffff" : "#0a0a0a";
  const mutedColor = isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.55)";
  const faintColor = isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.25)";

  const mdComponents = {
    p: ({ children }) => <p className="text-lg leading-relaxed mb-3" style={{ color: mutedColor }}>{children}</p>,
    strong: ({ children }) => <strong className="font-semibold" style={{ color: textColor }}>{children}</strong>,
    em: ({ children }) => <em className="italic" style={{ color: mutedColor, fontFamily: "Georgia, serif" }}>{children}</em>,
    ul: ({ children }) => <ul className="space-y-2 mb-4">{children}</ul>,
    li: ({ children }) => <li className="text-base flex gap-3" style={{ color: mutedColor }}>
      <span style={{ color: theme.accent }}>•</span><span>{children}</span>
    </li>,
    h3: ({ children }) => <h3 className="text-xl font-semibold mb-2 mt-4" style={{ color: textColor }}>{children}</h3>,
  };

  switch (slide.type) {
    case "title":
      return (
        <div className="py-12 animate-fadeIn">
          {slide.section && (
            <p className="text-xs uppercase tracking-[0.3em] mb-6 font-medium" style={{ color: faintColor }}>
              {slide.section}
            </p>
          )}
          <div className="flex items-center gap-6 mb-8">
            <p className="text-sm italic" style={{ color: faintColor, fontFamily: "Georgia, serif" }}>presents</p>
            <p className="text-sm uppercase tracking-widest font-semibold" style={{ color: mutedColor }}>
              {projectName}
            </p>
          </div>
          <h1 className="text-5xl md:text-7xl font-bold uppercase tracking-tight leading-[0.95] mb-8"
            style={{ color: textColor }}>
            {slide.title}
          </h1>
          {slide.subtitle && (
            <p className="text-xl max-w-2xl leading-relaxed" style={{ color: mutedColor }}>{slide.subtitle}</p>
          )}
        </div>
      );

    case "insight":
      return (
        <div className="flex gap-12 items-center animate-fadeIn">
          <div className="flex-1">
            {slide.brand && (
              <p className="text-[10px] uppercase tracking-[0.3em] font-semibold mb-6" style={{ color: faintColor }}>
                {slide.brand}
              </p>
            )}
            <h2 className="text-3xl md:text-5xl font-bold uppercase leading-[1.05] mb-8"
              style={{ color: textColor }}>
              {slide.title}
            </h2>
            <div className="w-16 h-0.5 mb-6" style={{ backgroundColor: theme.accent, opacity: 0.5 }} />
            <div className="prose max-w-none">
              <Markdown remarkPlugins={[remarkGfm]} components={mdComponents}>{slide.body || ""}</Markdown>
            </div>
          </div>
          {slide.image_url && (
            <div className="w-80 flex-shrink-0 rounded-lg overflow-hidden shadow-2xl" style={{ border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}` }}>
              <img src={slide.image_url} alt="" className="w-full h-auto object-contain max-h-[65vh]" onError={e => e.target.style.display = "none"} />
            </div>
          )}
        </div>
      );

    case "spotlight":
      return (
        <div className="flex gap-0 items-stretch animate-fadeIn" style={{ margin: "0 -48px" }}>
          {/* Left half */}
          <div className="flex-1 pr-12 pl-12 flex flex-col justify-center">
            {slide.brand && (
              <p className="text-[10px] uppercase tracking-[0.3em] font-semibold mb-4" style={{ color: faintColor }}>
                {slide.brand}
              </p>
            )}
            <h2 className="text-2xl md:text-3xl font-bold leading-tight mb-6" style={{ color: textColor }}>
              {slide.title}
            </h2>
            {slide.quote && (
              <>
                <p className="text-xl italic leading-relaxed mb-2" style={{ color: theme.accent, fontFamily: "Georgia, serif" }}>
                  {slide.quote}
                </p>
                <DottedLine color={textColor} opacity={0.15} className="my-6" />
              </>
            )}
            <div className="prose max-w-none">
              <Markdown remarkPlugins={[remarkGfm]} components={mdComponents}>{slide.body || ""}</Markdown>
            </div>
          </div>
          {/* Right half — image */}
          {slide.image_url && (
            <div className="w-[45%] flex-shrink-0 relative">
              <img src={slide.image_url} alt="" className="w-full h-full object-cover" style={{ minHeight: "50vh" }} onError={e => e.target.style.display = "none"} />
              <div className="absolute inset-0" style={{ background: `linear-gradient(to right, ${theme.bg} 0%, transparent 20%)` }} />
            </div>
          )}
        </div>
      );

    case "trend":
      return (
        <div className="animate-fadeIn">
          <p className="text-sm mb-4" style={{ color: mutedColor }}>{slide.body || ""}</p>
          <h2 className="text-2xl md:text-3xl font-bold uppercase mb-10" style={{ color: textColor }}>
            {slide.title}
          </h2>
          {slide.points && (
            <div className={`grid gap-6 ${slide.points.length <= 3 ? "grid-cols-1 md:grid-cols-3" : "grid-cols-1 md:grid-cols-4"}`}>
              {slide.points.map((point, i) => {
                const isObj = typeof point === "object";
                const heading = isObj ? point.heading : point;
                const desc = isObj ? point.description : null;
                return (
                  <div key={i}>
                    <span className="text-3xl font-bold mb-3 block" style={{ color: textColor }}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <h4 className="text-lg font-bold leading-snug mb-3" style={{ color: textColor }}>
                      {heading}
                    </h4>
                    <div className="w-full h-0.5 mb-3" style={{ backgroundColor: textColor, opacity: 0.8 }} />
                    {desc && <p className="text-sm leading-relaxed" style={{ color: mutedColor }}>{desc}</p>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );

    case "comparison":
      return (
        <div className="animate-fadeIn">
          <h2 className="text-3xl md:text-4xl font-bold uppercase mb-4" style={{ color: textColor }}>
            {slide.title}
          </h2>
          {slide.body && (
            <div className="prose max-w-none mb-8">
              <Markdown remarkPlugins={[remarkGfm]} components={mdComponents}>{slide.body}</Markdown>
            </div>
          )}
          {slide.items && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {slide.items.map((item, i) => (
                <div key={i} className="rounded-lg p-5" style={{
                  backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)",
                  border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
                }}>
                  {item.image_url && (
                    <div className="w-full rounded-lg overflow-hidden mb-3">
                      <img src={item.image_url} alt="" className="w-full h-auto object-contain max-h-40" onError={e => e.target.style.display = "none"} />
                    </div>
                  )}
                  <h4 className="font-bold text-lg mb-2" style={{ color: textColor }}>{item.brand}</h4>
                  <div className="w-8 h-0.5 mb-2" style={{ backgroundColor: theme.accent }} />
                  <p className="text-sm" style={{ color: mutedColor }}>{item.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      );

    case "summary":
      return (
        <div className="py-8 animate-fadeIn">
          <h2 className="text-3xl md:text-5xl font-bold uppercase mb-12" style={{ color: textColor }}>
            {slide.title}
          </h2>
          <div className="max-w-3xl space-y-5">
            {(slide.takeaways || []).map((t, i) => (
              <div key={i} className="flex items-start gap-5">
                <span className="text-2xl font-bold flex-shrink-0 w-10" style={{ color: theme.accent }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <p className="text-lg" style={{ color: textColor }}>{t}</p>
                  {i < (slide.takeaways || []).length - 1 && (
                    <div className="mt-5 border-t border-dotted" style={{ borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)" }} />
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-16 flex items-center gap-4">
            <div className="w-12 h-px" style={{ backgroundColor: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)" }} />
            <p className="text-[10px] uppercase tracking-[0.3em]" style={{ color: faintColor }}>
              A Knots &amp; Dots product
            </p>
          </div>
        </div>
      );

    default:
      return (
        <div className="animate-fadeIn">
          <h2 className="text-3xl font-bold uppercase mb-6" style={{ color: textColor }}>{slide.title || "Slide"}</h2>
          <div className="prose max-w-none">
            <Markdown remarkPlugins={[remarkGfm]} components={mdComponents}>{slide.body || ""}</Markdown>
          </div>
        </div>
      );
  }
}
