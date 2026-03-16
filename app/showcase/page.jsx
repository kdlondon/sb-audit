"use client";
import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { useProject } from "@/lib/project-context";
import { useRole } from "@/lib/role-context";
import Nav from "@/components/Nav";
import AuthGuard from "@/components/AuthGuard";
import ProjectGuard from "@/components/ProjectGuard";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

/* ─── SLIDE TYPES ─── */
const SLIDE_TYPES = {
  title: "Title",
  key_findings: "Key Findings",
  finding: "Finding",
  takeaways: "Takeaways",
  closing: "Closing",
};

/* ─── K&D BRAND PALETTE ─── */
const KD = {
  navy:       "#0a0f3c",
  electric:   "#0019FF",
  chartreuse: "#D4E520",
  lavender:   "#e8e0f0",
  charcoal:   "#1e1a22",
  dark:       "#111015",
};

function getThemeForSlide(slide, index) {
  switch (slide.type) {
    case "title":        return { bg: KD.navy, text: "#fff", accent: "#4060ff", isDark: true };
    case "key_findings": return { bg: KD.chartreuse, text: "#0a0a0a", accent: "#0a0a0a", isDark: false };
    case "finding":      return index % 2 === 0
      ? { bg: KD.charcoal, text: "#e5e0eb", accent: KD.chartreuse, isDark: true }
      : { bg: KD.electric, text: "#fff", accent: "#fff", isDark: true };
    case "takeaways":    return { bg: KD.chartreuse, text: "#0a0a0a", accent: "#0a0a0a", isDark: false };
    case "closing":      return { bg: KD.navy, text: "#fff", accent: KD.chartreuse, isDark: true };
    default:             return { bg: KD.charcoal, text: "#e5e0eb", accent: KD.chartreuse, isDark: true };
  }
}

/* ─── K&D VERTICAL LOGO ─── */
function KDLogo({ color = "#ffffff", opacity = 0.2 }) {
  return (
    <div className="absolute left-5 top-5 bottom-5 flex flex-col justify-between select-none pointer-events-none z-10"
      style={{ color, opacity }}>
      <div className="flex flex-col items-start gap-0">
        {["K","N","O","T","S"].map((l, i) => (
          <span key={i} className="text-[12px] font-bold tracking-wide leading-[1.3]"
            style={{ marginLeft: i === 2 ? 6 : i === 3 ? 3 : 0 }}>{l}</span>
        ))}
        <span className="text-[14px] italic mt-1.5 mb-1.5" style={{ fontFamily: "Georgia, serif" }}>&amp;</span>
        {["D","O","T","S","."].map((l, i) => (
          <span key={i} className="text-[12px] font-bold tracking-wide leading-[1.3]"
            style={{ marginLeft: i === 1 ? 3 : 0 }}>{l}</span>
        ))}
      </div>
    </div>
  );
}

/* ─── MEDIA MODAL (fullscreen image zoom / video player) ─── */
function MediaModal({ src, type, onClose }) {
  if (!src) return null;
  const isVideo = type === "Video" || /youtube|youtu\.be|vimeo/i.test(src);
  let embedUrl = src;
  if (isVideo) {
    // Handle various YouTube URL formats
    const ytMatch = src.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([\w-]+)/);
    if (ytMatch) embedUrl = `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1&rel=0`;
    // Handle Vimeo
    const vimeoMatch = src.match(/vimeo\.com\/(\d+)/);
    if (vimeoMatch) embedUrl = `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1`;
  }

  return (
    <div className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center" onClick={onClose}>
      <button className="absolute top-6 right-6 text-white/60 hover:text-white text-3xl z-10 w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 transition" onClick={onClose}>×</button>
      <div className="slide-enter" onClick={e => e.stopPropagation()}>
        {isVideo ? (
          <iframe src={embedUrl} className="w-[85vw] h-[80vh] rounded-xl" allowFullScreen
            allow="autoplay; encrypted-media; picture-in-picture" style={{ border: "none" }} />
        ) : (
          <img src={src} alt="" className="max-w-[92vw] max-h-[92vh] object-contain rounded-xl shadow-2xl" />
        )}
      </div>
    </div>
  );
}

/* ─── MAIN COMPONENT ─── */
export default function ShowcasePageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><p className="text-hint">Loading...</p></div>}>
      <ShowcasePage />
    </Suspense>
  );
}

function ShowcasePage() {
  const { projectId, projectName } = useProject();
  const { role } = useRole();
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const pdfRef = useRef(null);

  // State
  const [view, setView] = useState("list");
  const [showcases, setShowcases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentShowcase, setCurrentShowcase] = useState(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [toast, setToast] = useState("");
  const [mediaModal, setMediaModal] = useState(null); // { src, type }

  // Create form
  const [allBrands, setAllBrands] = useState([]);
  const [allCountries, setAllCountries] = useState([]);
  const [yearFrom, setYearFrom] = useState("");
  const [yearTo, setYearTo] = useState("");
  const [selectedBrands, setSelectedBrands] = useState([]);
  const [selectedCountries, setSelectedCountries] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [showcaseTitle, setShowcaseTitle] = useState("");
  const [clientName, setClientName] = useState("");
  const [objective, setObjective] = useState("");
  const [analystHighlights, setAnalystHighlights] = useState("");

  // Edit state
  const [editSlides, setEditSlides] = useState([]);
  const [editTitle, setEditTitle] = useState("");
  const [saving, setSaving] = useState(false);

  const canEdit = role === "full_admin" || role === "analyst";
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  /* ─── LOAD ─── */
  const loadShowcases = async () => {
    const { data } = await supabase
      .from("saved_showcases")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    setShowcases(data || []);
    setLoading(false);
  };

  const loadFilterOptions = async () => {
    const [localRes, globalRes] = await Promise.all([
      supabase.from("audit_entries").select("competitor, year").eq("project_id", projectId),
      supabase.from("audit_global").select("brand, country, year").eq("project_id", projectId),
    ]);
    const brandSet = new Set();
    (localRes.data || []).forEach(e => e.competitor && brandSet.add(e.competitor));
    (globalRes.data || []).forEach(e => e.brand && brandSet.add(e.brand));
    setAllBrands([...brandSet].sort());
    const countrySet = new Set();
    (globalRes.data || []).forEach(e => e.country && countrySet.add(e.country));
    setAllCountries([...countrySet].sort());
  };

  useEffect(() => { if (projectId) { loadShowcases(); loadFilterOptions(); } }, [projectId]);

  // Handle shared showcase link
  useEffect(() => {
    const viewId = searchParams.get("view");
    if (viewId && typeof window !== "undefined") {
      const stored = sessionStorage.getItem("shared-showcase");
      if (stored) {
        try {
          const sc = JSON.parse(stored);
          setCurrentShowcase(sc);
          setCurrentSlide(0);
          setView("present");
          sessionStorage.removeItem("shared-showcase");
        } catch {}
      }
    }
  }, [searchParams]);

  /* ─── GENERATE ─── */
  const generateShowcase = async () => {
    setGenerating(true);

    let localQuery = supabase.from("audit_entries").select("*").eq("project_id", projectId);
    let globalQuery = supabase.from("audit_global").select("*").eq("project_id", projectId);

    if (selectedBrands.length > 0) {
      localQuery = localQuery.in("competitor", selectedBrands);
      globalQuery = globalQuery.in("brand", selectedBrands);
    }
    if (yearFrom) { localQuery = localQuery.gte("year", yearFrom); globalQuery = globalQuery.gte("year", yearFrom); }
    if (yearTo) { localQuery = localQuery.lte("year", yearTo); globalQuery = globalQuery.lte("year", yearTo); }
    if (selectedCountries.length > 0) { globalQuery = globalQuery.in("country", selectedCountries); }

    const skipLocal = selectedCountries.length > 0;
    const [localRes, globalRes] = await Promise.all([
      skipLocal ? Promise.resolve({ data: [] }) : localQuery, globalQuery,
    ]);
    const entries = [...(localRes.data || []), ...(globalRes.data || [])];

    if (entries.length === 0) { showToast("No entries match your filters"); setGenerating(false); return; }

    const entryData = entries.map(e => ({
      id: e.id, brand: e.competitor || e.brand || "Unknown", country: e.country || "Local market",
      year: e.year, type: e.type, description: e.description, insight: e.insight, idea: e.idea,
      synopsis: e.synopsis, main_slogan: e.main_slogan, primary_territory: e.primary_territory,
      tone_of_voice: e.tone_of_voice, brand_archetype: e.brand_archetype, portrait: e.portrait,
      journey_phase: e.journey_phase, funnel: e.funnel, rating: e.rating, image_url: e.image_url,
      image_urls: e.image_urls, url: e.url, analyst_comment: e.analyst_comment,
      execution_style: e.execution_style, main_vp: e.main_vp, emotional_benefit: e.emotional_benefit,
      pain_point: e.pain_point,
    }));

    const systemPrompt = `You are a senior creative strategist at Knots & Dots building a cinematic presentation.

CLIENT: ${clientName || projectName || "N/A"}
OBJECTIVE: ${objective || "Analyze and present creative intelligence findings"}
${analystHighlights ? `\nANALYST HIGHLIGHTS (incorporate these into your narrative):\n${analystHighlights}` : ""}

STRUCTURE — tell the story as many slides as needed:

1. FIRST slide must be type:"title" — Opening. Fields: title, subtitle, client, objective
2. SECOND slide must be type:"key_findings" — Summarize ALL key findings. Fields: title, findings (array of {number, heading, summary})
3. THEN as many type:"finding" slides as needed (one per insight/case). Each explores ONE finding in depth. Fields: title, body (markdown, 3-5 sentences max), brand, year, country, territory (primary creative territory), image_url, media_url (YouTube/video URL from entry's url field), media_type ("Video" or "Image"), entry_id
4. THEN type:"takeaways" — Strategic takeaways & considerations. Fields: title, takeaways (array of 4-6 strings)
5. LAST slide must be type:"closing" — Fields: title, subtitle

RULES:
1. ALL output in English regardless of input language
2. Return ONLY valid JSON — no markdown, no code blocks
3. Every finding must reference real data from the entries
4. CRITICAL: For each finding slide, include ALL metadata: brand, year, country, territory
5. CRITICAL: For image_url, ALWAYS copy the exact image_url from the entry
6. CRITICAL: For media_url, copy the entry's url field if it contains youtube.com or youtu.be
7. Write in a strategic, editorial tone — bold, provocative headlines
8. Keep body text concise — this is a presentation, not a report
9. Use as many finding slides as needed to tell the story well (typically 6-10)

Return: {"title":"...","slides":[...slides...]}`;

    const userMsg = `Create a 10-slide showcase from these ${entries.length} entries:\n\n${JSON.stringify(entryData, null, 1)}`;

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ use_opus: true, max_tokens: 8000, system: systemPrompt,
          messages: [{ role: "user", content: userMsg }] }),
      });
      const data = await res.json();
      const text = data.content?.[0]?.text || "";
      let parsed;
      try { parsed = JSON.parse(text); } catch {
        const m = text.match(/\{[\s\S]*\}/);
        if (m) parsed = JSON.parse(m[0]); else throw new Error("Could not parse AI response");
      }

      const title = showcaseTitle.trim() || parsed.title || "Creative Showcase";
      const slides = parsed.slides || [];

      const { data: { session } } = await supabase.auth.getSession();
      const { data: saved, error } = await supabase.from("saved_showcases").insert({
        title, project_id: projectId,
        filters: { brands: selectedBrands, countries: selectedCountries, yearFrom, yearTo,
          client: clientName, objective, analystHighlights },
        slides, created_by: session?.user?.email || "",
      }).select().single();
      if (error) throw error;

      setCurrentShowcase(saved);
      setCurrentSlide(0);
      setView("present");
      showToast("Showcase generated!");
      loadShowcases();
    } catch (err) { showToast("Error: " + err.message); }
    setGenerating(false);
  };

  /* ─── SAVE EDITS ─── */
  const saveEdits = async () => {
    setSaving(true);
    await supabase.from("saved_showcases").update({ title: editTitle, slides: editSlides, updated_at: new Date().toISOString() }).eq("id", currentShowcase.id);
    setCurrentShowcase({ ...currentShowcase, title: editTitle, slides: editSlides });
    setSaving(false); showToast("Changes saved"); setView("present"); loadShowcases();
  };

  const deleteShowcase = async (id, e) => {
    e.stopPropagation();
    if (!confirm("Delete this showcase?")) return;
    await supabase.from("saved_showcases").delete().eq("id", id);
    showToast("Deleted"); loadShowcases();
  };

  /* ─── SHARE ─── */
  const copyShareLink = () => {
    const url = `${window.location.origin}/showcase/${currentShowcase.id}`;
    navigator.clipboard.writeText(url);
    showToast("Link copied! (login required to view)");
  };

  /* ─── PDF DOWNLOAD ─── */
  const [pdfMode, setPdfMode] = useState(false);
  const downloadPDF = async () => {
    setPdfMode(true); // hide UI elements, disable animations
    setToast(""); // clear any toast
    await new Promise(r => setTimeout(r, 100));

    try {
      const html2canvas = (await import("html2canvas")).default;
      const jsPDF = (await import("jspdf")).default;
      const slides = currentShowcase.slides || [];
      const pdf = new jsPDF({ orientation: "landscape", unit: "px", format: [1280, 720] });
      const startSlide = currentSlide;

      for (let i = 0; i < slides.length; i++) {
        setCurrentSlide(i);
        await new Promise(r => setTimeout(r, 500)); // wait for render to fully settle

        const slideEl = document.querySelector("[data-slide-content]");
        if (!slideEl) continue;

        // Force 16:9 aspect ratio for capture
        const captureW = 1280;
        const captureH = 720;

        const canvas = await html2canvas(slideEl, {
          scale: 2, useCORS: true, allowTaint: true,
          width: captureW, height: captureH,
          windowWidth: captureW, windowHeight: captureH,
          backgroundColor: getThemeForSlide(slides[i], i).bg,
          ignoreElements: (el) => {
            return el.hasAttribute?.("data-pdf-hide");
          },
        });

        const imgData = canvas.toDataURL("image/jpeg", 0.95);
        if (i > 0) pdf.addPage([captureW, captureH], "landscape");
        pdf.addImage(imgData, "JPEG", 0, 0, captureW, captureH);
      }

      pdf.save(`${currentShowcase.title || "Showcase"}.pdf`);
      setCurrentSlide(startSlide);
    } catch (err) {
      console.error("PDF error:", err);
    }
    setPdfMode(false);
  };

  /* ─── KEYBOARD NAV ─── */
  useEffect(() => {
    if (view !== "present") return;
    const slides = currentShowcase?.slides || [];
    const handler = (e) => {
      if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); setCurrentSlide(s => Math.min(s + 1, slides.length - 1)); }
      if (e.key === "ArrowLeft") { e.preventDefault(); setCurrentSlide(s => Math.max(s - 1, 0)); }
      if (e.key === "Escape") { if (mediaModal) setMediaModal(null); else setView("list"); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [view, currentShowcase, mediaModal]);

  const openShowcase = (sc) => { setCurrentShowcase(sc); setCurrentSlide(0); setView("present"); };
  const enterEdit = () => { setEditSlides(JSON.parse(JSON.stringify(currentShowcase.slides))); setEditTitle(currentShowcase.title); setView("edit"); };

  const ToastEl = toast ? (
    <div className="fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium z-[100] shadow-lg">{toast}</div>
  ) : null;

  /* ═══════════════════════════════════════════
     PRESENTATION VIEW
     ═══════════════════════════════════════════ */
  if (view === "present" && currentShowcase) {
    const slides = currentShowcase.slides || [];
    const slide = slides[currentSlide];
    if (!slide) return null;
    const theme = getThemeForSlide(slide, currentSlide);

    return (
      <div className="fixed inset-0 z-50" style={{ backgroundColor: theme.bg }} data-slide-content {...(pdfMode ? {"data-pdf-mode": true} : {})}>
        {!pdfMode && ToastEl}
        {mediaModal && <MediaModal src={mediaModal.src} type={mediaModal.type} onClose={() => setMediaModal(null)} />}
        <KDLogo color={theme.text} opacity={theme.isDark ? 0.15 : 0.1} />

        {/* Header */}
        <div className="absolute top-0 left-14 right-0 z-50 flex justify-between items-start px-6 py-4">
          <div className="flex items-start gap-3">
            <div>
              <p className="text-[9px] uppercase tracking-[0.2em] font-semibold" style={{ color: theme.text, opacity: 0.4 }}>
                {currentShowcase.filters?.client || projectName}
              </p>
              <p className="text-[8px] italic mt-0.5" style={{ color: theme.text, opacity: 0.25 }}>
                {currentShowcase.title}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2" data-pdf-hide>
            <span className="text-[9px] font-mono" style={{ color: theme.text, opacity: 0.25 }}>
              {String(currentSlide + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}
            </span>
            <button onClick={copyShareLink} className="text-[9px] px-2 py-1 rounded border transition"
              style={{ color: theme.text, opacity: 0.4, borderColor: theme.isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)" }}>
              Share
            </button>
            <button onClick={downloadPDF} className="text-[9px] px-2 py-1 rounded border transition"
              style={{ color: theme.text, opacity: 0.4, borderColor: theme.isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)" }}>
              PDF
            </button>
            {canEdit && (
              <button onClick={enterEdit} className="text-[9px] px-2 py-1 rounded border transition"
                style={{ color: theme.text, opacity: 0.4, borderColor: theme.isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)" }}>
                Edit
              </button>
            )}
            <button onClick={() => setView("list")} className="text-[9px] px-2 py-1 rounded border transition"
              style={{ color: theme.text, opacity: 0.4, borderColor: theme.isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)" }}>
              Close
            </button>
          </div>
        </div>

        {/* Progress */}
        <div className="absolute top-0 left-0 right-0 h-[2px] z-50" style={{ backgroundColor: theme.isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)" }}>
          <div className="h-full transition-all duration-500" style={{ width: `${((currentSlide+1)/slides.length)*100}%`, backgroundColor: theme.accent, opacity: 0.5 }} />
        </div>

        {/* Content */}
        <div className="h-full flex items-center justify-center transition-colors duration-700">
          <div className="max-w-5xl w-full mx-auto pl-20 pr-12" key={currentSlide}>
            <div className={pdfMode ? "" : "slide-enter"}>
              <SlideRenderer slide={slide} theme={theme} projectName={projectName} onMediaClick={setMediaModal} pdfMode={pdfMode} />
            </div>
          </div>
        </div>

        {/* Arrows */}
        {currentSlide > 0 && !pdfMode && (
          <button onClick={() => setCurrentSlide(s => s - 1)} className="absolute left-14 bottom-7 text-2xl transition" data-pdf-hide
            style={{ color: theme.text, opacity: 0.2 }}>←</button>
        )}
        {currentSlide < slides.length - 1 && !pdfMode && (
          <button onClick={() => setCurrentSlide(s => s + 1)} className="absolute right-7 bottom-7 text-2xl transition" data-pdf-hide
            style={{ color: theme.text, opacity: 0.2 }}>→</button>
        )}

        {/* Dots */}
        {!pdfMode && (
          <div className="absolute bottom-7 left-1/2 -translate-x-1/2 flex gap-1.5" data-pdf-hide>
            {slides.map((_, i) => (
              <button key={i} onClick={() => setCurrentSlide(i)} className="rounded-full transition-all"
                style={{ width: i === currentSlide ? 18 : 5, height: 5, backgroundColor: i === currentSlide ? theme.accent : (theme.isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.12)") }} />
            ))}
          </div>
        )}
      </div>
    );
  }

  /* ═══════════════════════════════════════════
     EDIT VIEW
     ═══════════════════════════════════════════ */
  if (view === "edit" && currentShowcase) {
    return (
      <AuthGuard><ProjectGuard><Nav />
        <div className="min-h-screen" style={{ background: "var(--bg)" }}>
          {ToastEl}
          <div className="max-w-4xl mx-auto p-6">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <button onClick={() => setView("present")} className="text-muted hover:text-main text-lg">←</button>
                <h1 className="text-xl font-bold text-main">Edit Showcase</h1>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setView("present")} className="px-4 py-2 border border-main rounded-lg text-sm text-muted hover:text-main">Cancel</button>
                <button onClick={saveEdits} disabled={saving} className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50">
                  {saving ? "Saving..." : "Save changes"}
                </button>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-[10px] text-muted uppercase font-semibold mb-1">Showcase Title</label>
              <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
                className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[var(--accent)]" />
            </div>

            <div className="space-y-4">
              {editSlides.map((slide, idx) => (
                <div key={idx} className="bg-surface border border-main rounded-xl p-5">
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-hint font-mono">#{idx + 1}</span>
                      <span className="text-[10px] text-accent uppercase font-semibold">{SLIDE_TYPES[slide.type] || slide.type}</span>
                    </div>
                    <div className="flex gap-1">
                      {idx > 0 && <button onClick={() => { const s = [...editSlides]; [s[idx-1],s[idx]]=[s[idx],s[idx-1]]; setEditSlides(s); }} className="text-xs text-muted hover:text-main px-2 py-1 rounded hover:bg-surface2">↑</button>}
                      {idx < editSlides.length-1 && <button onClick={() => { const s = [...editSlides]; [s[idx],s[idx+1]]=[s[idx+1],s[idx]]; setEditSlides(s); }} className="text-xs text-muted hover:text-main px-2 py-1 rounded hover:bg-surface2">↓</button>}
                      <button onClick={() => { if(confirm("Remove this slide?")) setEditSlides(editSlides.filter((_,i)=>i!==idx)); }} className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50">×</button>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {/* Slide type selector */}
                    <div>
                      <label className="block text-[10px] text-muted uppercase font-semibold mb-1">Slide Type</label>
                      <select value={slide.type} onChange={e => { const s=[...editSlides]; s[idx]={...s[idx],type:e.target.value}; setEditSlides(s); }}
                        className="px-2 py-1 bg-surface border border-main rounded text-xs text-main">
                        {Object.entries(SLIDE_TYPES).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </div>
                    {["title","subtitle","section","client","objective","brand","year","country","territory","image_url","media_url"].map(field => (
                      slide[field] !== undefined && (
                        <div key={field}>
                          <label className="block text-[10px] text-muted uppercase font-semibold mb-1">{field.replace(/_/g," ")}</label>
                          <input value={slide[field] || ""} onChange={e => { const s=[...editSlides]; s[idx]={...s[idx],[field]:e.target.value}; setEditSlides(s); }}
                            className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[var(--accent)]" />
                        </div>
                      )
                    ))}
                    {slide.body !== undefined && (
                      <div>
                        <label className="block text-[10px] text-muted uppercase font-semibold mb-1">Body (Markdown)</label>
                        <textarea value={slide.body||""} rows={4} onChange={e => { const s=[...editSlides]; s[idx]={...s[idx],body:e.target.value}; setEditSlides(s); }}
                          className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[var(--accent)] font-mono" />
                      </div>
                    )}
                    {slide.findings && (
                      <div>
                        <label className="block text-[10px] text-muted uppercase font-semibold mb-2">Findings</label>
                        {slide.findings.map((f, fi) => (
                          <div key={fi} className="flex gap-2 mb-2 items-start">
                            <span className="text-xs text-hint font-mono mt-2 w-6">{f.number || String(fi+1).padStart(2,"0")}</span>
                            <div className="flex-1 space-y-1">
                              <input value={f.heading||""} placeholder="Heading" onChange={e => { const s=[...editSlides]; const fs=[...s[idx].findings]; fs[fi]={...fs[fi],heading:e.target.value}; s[idx]={...s[idx],findings:fs}; setEditSlides(s); }}
                                className="w-full px-2 py-1 bg-surface border border-main rounded text-xs text-main font-semibold" />
                              <input value={f.summary||""} placeholder="Summary" onChange={e => { const s=[...editSlides]; const fs=[...s[idx].findings]; fs[fi]={...fs[fi],summary:e.target.value}; s[idx]={...s[idx],findings:fs}; setEditSlides(s); }}
                                className="w-full px-2 py-1 bg-surface border border-main rounded text-xs text-main" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {slide.takeaways && (
                      <div>
                        <label className="block text-[10px] text-muted uppercase font-semibold mb-1">Takeaways (one per line)</label>
                        <textarea value={(slide.takeaways||[]).join("\n")} rows={4} onChange={e => { const s=[...editSlides]; s[idx]={...s[idx],takeaways:e.target.value.split("\n")}; setEditSlides(s); }}
                          className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[var(--accent)]" />
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Add new slide */}
              <button onClick={() => {
                setEditSlides([...editSlides, { type: "finding", title: "", body: "", brand: "", year: "", country: "", territory: "", image_url: "", media_url: "", media_type: "Image" }]);
              }} className="w-full py-3 border-2 border-dashed border-main rounded-xl text-sm text-muted hover:text-main hover:border-[var(--accent)] transition">
                + Add new slide
              </button>
            </div>
          </div>
        </div>
      </ProjectGuard></AuthGuard>
    );
  }

  /* ═══════════════════════════════════════════
     CREATE VIEW
     ═══════════════════════════════════════════ */
  if (view === "create") {
    return (
      <AuthGuard><ProjectGuard><Nav />
        <div className="min-h-screen" style={{ background: "var(--bg)" }}>
          {ToastEl}
          <div className="max-w-2xl mx-auto p-6">
            <div className="flex items-center gap-3 mb-6">
              <button onClick={() => setView("list")} className="text-muted hover:text-main text-lg">←</button>
              <h1 className="text-xl font-bold text-main">New Creative Showcase</h1>
            </div>

            <div className="bg-surface border border-main rounded-xl p-6 space-y-5">
              {/* Client & Objective */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-muted uppercase font-semibold mb-1">Client *</label>
                  <input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="E.g., Scotiabank"
                    className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[var(--accent)]" />
                </div>
                <div>
                  <label className="block text-[10px] text-muted uppercase font-semibold mb-1">Showcase Title</label>
                  <input value={showcaseTitle} onChange={e => setShowcaseTitle(e.target.value)} placeholder="AI generates if empty"
                    className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[var(--accent)]" />
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-muted uppercase font-semibold mb-1">Objective *</label>
                <textarea value={objective} onChange={e => setObjective(e.target.value)} rows={2}
                  placeholder="What should this showcase communicate? E.g., 'Show how UK fintechs are challenging traditional banks through emotional storytelling'"
                  className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[var(--accent)]" />
              </div>

              <div>
                <label className="block text-[10px] text-muted uppercase font-semibold mb-1">
                  Analyst Highlights <span className="text-hint font-normal">(optional — your team's observations for AI to weave in)</span>
                </label>
                <textarea value={analystHighlights} onChange={e => setAnalystHighlights(e.target.value)} rows={3}
                  placeholder="E.g., 'Tide's manifesto approach is the strongest in market. Notice how RBC avoids SME language entirely. The freedom narrative is dominant but only Venn connects it to product.'"
                  className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[var(--accent)]" />
              </div>

              <div className="border-t border-main pt-5">
                <p className="text-[10px] text-muted uppercase font-semibold mb-3">Filters</p>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <label className="block text-[10px] text-muted uppercase font-semibold mb-1">Year From</label>
                    <select value={yearFrom} onChange={e => setYearFrom(e.target.value)}
                      className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main">
                      <option value="">All years</option>
                      {["2020","2021","2022","2023","2024","2025","2026"].map(y => <option key={y}>{y}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-muted uppercase font-semibold mb-1">Year To</label>
                    <select value={yearTo} onChange={e => setYearTo(e.target.value)}
                      className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main">
                      <option value="">All years</option>
                      {["2020","2021","2022","2023","2024","2025","2026"].map(y => <option key={y}>{y}</option>)}
                    </select>
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-[10px] text-muted uppercase font-semibold mb-1">Brands {selectedBrands.length > 0 && `(${selectedBrands.length})`}</label>
                  <div className="flex flex-wrap gap-1.5 p-2 bg-surface border border-main rounded-lg min-h-[36px]">
                    {allBrands.length === 0 && <span className="text-xs text-hint">No brands found</span>}
                    {allBrands.map(b => (
                      <button key={b} onClick={() => setSelectedBrands(selectedBrands.includes(b) ? selectedBrands.filter(x=>x!==b) : [...selectedBrands,b])}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium transition ${selectedBrands.includes(b) ? "text-white" : "bg-surface2 text-muted hover:text-main"}`}
                        style={selectedBrands.includes(b) ? {backgroundColor:KD.electric} : {}}>{b}</button>
                    ))}
                  </div>
                </div>

                {allCountries.length > 0 && (
                  <div className="mb-4">
                    <label className="block text-[10px] text-muted uppercase font-semibold mb-1">Markets {selectedCountries.length > 0 && `(${selectedCountries.length})`}</label>
                    <div className="flex flex-wrap gap-1.5 p-2 bg-surface border border-main rounded-lg min-h-[36px]">
                      {allCountries.map(c => (
                        <button key={c} onClick={() => setSelectedCountries(selectedCountries.includes(c) ? selectedCountries.filter(x=>x!==c) : [...selectedCountries,c])}
                          className={`px-2.5 py-1 rounded-full text-xs font-medium transition ${selectedCountries.includes(c) ? "text-white" : "bg-surface2 text-muted hover:text-main"}`}
                          style={selectedCountries.includes(c) ? {backgroundColor:KD.electric} : {}}>{c}</button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-surface2 rounded-lg p-3">
                <p className="text-[10px] text-muted mb-1 font-semibold">OUTPUT STRUCTURE</p>
                <p className="text-[10px] text-hint">Title → Key Findings → Individual Findings (as many as needed) → Takeaways → Closing</p>
              </div>

              <button onClick={generateShowcase} disabled={generating}
                className="w-full py-3 text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition"
                style={{ backgroundColor: KD.electric }}>
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
      </ProjectGuard></AuthGuard>
    );
  }

  /* ═══════════════════════════════════════════
     LIST VIEW
     ═══════════════════════════════════════════ */
  return (
    <AuthGuard><ProjectGuard><Nav />
      <div className="min-h-screen" style={{ background: "var(--bg)" }}>
        {ToastEl}
        <div className="max-w-4xl mx-auto p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-xl font-bold text-main">Creative Showcase</h1>
              <p className="text-xs text-muted mt-1">Cinematic presentations powered by AI</p>
            </div>
            {canEdit && (
              <button onClick={() => setView("create")} className="px-4 py-2 text-white rounded-lg text-sm font-semibold hover:opacity-90"
                style={{ backgroundColor: KD.electric }}>+ New Showcase</button>
            )}
          </div>

          {loading ? (
            <p className="text-hint text-center py-20">Loading...</p>
          ) : showcases.length === 0 ? (
            <div className="text-center py-20 text-hint">
              <div className="w-16 h-16 mx-auto mb-6 rounded-full flex items-center justify-center" style={{ backgroundColor: KD.navy }}>
                <span className="text-white text-xl font-bold">K</span>
              </div>
              <p className="text-lg mb-2">No showcases yet</p>
              <p className="text-sm">{canEdit ? "Create your first creative showcase" : "No showcases available"}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {showcases.map(sc => (
                <div key={sc.id} onClick={() => openShowcase(sc)}
                  className="bg-surface border border-main rounded-xl overflow-hidden hover:border-[var(--accent)] transition cursor-pointer group">
                  <div className="p-6 relative overflow-hidden" style={{ backgroundColor: KD.navy }}>
                    <div className="absolute top-3 left-3 flex flex-col gap-0 opacity-15">
                      {["K","N","O","T","S"].map((l,i) => <span key={i} className="text-white text-[7px] font-bold leading-[1.3]">{l}</span>)}
                    </div>
                    <div className="ml-5">
                      <h3 className="text-white font-bold text-lg group-hover:text-blue-200 transition">{sc.title}</h3>
                      <p className="text-white/40 text-xs mt-1">{(sc.slides||[]).length} slides</p>
                      {sc.filters?.client && <p className="text-white/25 text-[10px] mt-2 uppercase tracking-wider">{sc.filters.client}</p>}
                    </div>
                  </div>
                  <div className="px-5 py-3 flex justify-between items-center">
                    <div>
                      <p className="text-[10px] text-hint">{sc.created_by} · {new Date(sc.created_at).toLocaleDateString()}</p>
                      {sc.filters && (
                        <p className="text-[10px] text-muted mt-0.5">
                          {[sc.filters.brands?.length ? `${sc.filters.brands.length} brands` : null,
                            sc.filters.yearFrom || sc.filters.yearTo ? `${sc.filters.yearFrom||"?"} – ${sc.filters.yearTo||"?"}` : null,
                          ].filter(Boolean).join(" · ") || "All entries"}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(`${window.location.origin}/showcase/${sc.id}`); showToast("Link copied!"); }}
                        className="text-xs text-muted hover:text-main px-2 py-1 rounded hover:bg-surface2">Share</button>
                      {canEdit && (
                        <button onClick={(e) => deleteShowcase(sc.id, e)}
                          className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50">Delete</button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ProjectGuard></AuthGuard>
  );
}

/* ═══════════════════════════════════════════
   SLIDE RENDERER
   ═══════════════════════════════════════════ */
function SlideRenderer({ slide, theme, projectName, onMediaClick, pdfMode = false }) {
  const t = theme.text;
  // Boost contrast for PDF export — html2canvas renders transparency poorly
  const m = pdfMode
    ? (theme.isDark ? "rgba(255,255,255,0.95)" : "rgba(0,0,0,0.85)")
    : (theme.isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.55)");
  const f = pdfMode
    ? (theme.isDark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.5)")
    : (theme.isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.2)");

  const mdC = {
    p: ({ children }) => <p className="text-base leading-relaxed mb-3" style={{ color: m }}>{children}</p>,
    strong: ({ children }) => <strong className="font-semibold" style={{ color: t }}>{children}</strong>,
    em: ({ children }) => <em className="italic" style={{ color: m, fontFamily: "Georgia, serif" }}>{children}</em>,
    ul: ({ children }) => <ul className="space-y-1.5 mb-3">{children}</ul>,
    li: ({ children }) => <li className="text-sm flex gap-2" style={{ color: m }}><span style={{ color: theme.accent }}>•</span><span>{children}</span></li>,
  };

  // Clickable media thumbnail
  const MediaThumb = ({ imageUrl, mediaUrl, mediaType, className = "" }) => {
    const src = imageUrl || mediaUrl;
    if (!src) return null;
    const isVideo = mediaType === "Video" || /youtube|youtu\.be/i.test(mediaUrl || "");
    return (
      <div className={`relative cursor-pointer group/media rounded-lg overflow-hidden ${className}`}
        onClick={() => onMediaClick({ src: mediaUrl || imageUrl, type: isVideo ? "Video" : "Image" })}
        style={{ border: `1px solid ${theme.isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}` }}>
        <img src={isVideo && !imageUrl ? `https://img.youtube.com/vi/${(mediaUrl||"").match(/(?:v=|youtu\.be\/|embed\/)([\w-]+)/)?.[1]}/hqdefault.jpg` : imageUrl}
          alt="" className="w-full h-auto" style={{ objectFit: "contain", maxHeight: "50vh" }} onError={e => e.target.style.display = "none"} />
        {/* Play button overlay for videos */}
        {isVideo && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover/media:bg-black/20 transition">
            <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="#0a0a0a"><polygon points="6,3 17,10 6,17" /></svg>
            </div>
          </div>
        )}
        {/* Zoom hint for images */}
        {!isVideo && (
          <div className="absolute bottom-2 right-2 opacity-0 group-hover/media:opacity-100 transition bg-black/60 text-white text-[9px] px-2 py-1 rounded">
            Click to expand
          </div>
        )}
      </div>
    );
  };

  switch (slide.type) {
    case "title":
      return (
        <div className="py-8 animate-fadeIn">
          <p className="text-[10px] uppercase tracking-[0.3em] mb-3 font-medium" style={{ color: f }}>
            {slide.client || projectName}
          </p>
          <div className="flex items-center gap-4 mb-8">
            <p className="text-sm italic" style={{ color: f, fontFamily: "Georgia, serif" }}>presents</p>
          </div>
          <h1 className="text-5xl md:text-7xl font-bold uppercase tracking-tight leading-[0.95] mb-6" style={{ color: t }}>
            {slide.title}
          </h1>
          {slide.subtitle && <p className="text-lg max-w-2xl leading-relaxed" style={{ color: m }}>{slide.subtitle}</p>}
          {slide.objective && (
            <p className="text-sm italic mt-8 max-w-xl" style={{ color: f, fontFamily: "Georgia, serif" }}>{slide.objective}</p>
          )}
        </div>
      );

    case "key_findings":
      const findings = slide.findings || [];
      return (
        <div className="animate-fadeIn">
          <p className="text-sm mb-3" style={{ color: m }}>{slide.body || ""}</p>
          <h2 className="text-2xl font-bold uppercase mb-8" style={{ color: t }}>{slide.title || "Key Findings"}</h2>
          <div className={`grid gap-6 ${findings.length <= 3 ? "grid-cols-1 md:grid-cols-3" : findings.length <= 4 ? "grid-cols-1 md:grid-cols-4" : "grid-cols-1 md:grid-cols-3"}`}>
            {findings.map((fi, i) => (
              <div key={i}>
                <span className="text-3xl font-bold block mb-2" style={{ color: t }}>{fi.number || String(i+1).padStart(2,"0")}</span>
                <h4 className="text-base font-bold leading-snug mb-2" style={{ color: t }}>{fi.heading}</h4>
                <div className="w-full h-0.5 mb-2" style={{ backgroundColor: t, opacity: 0.7 }} />
                <p className="text-xs leading-relaxed" style={{ color: m }}>{fi.summary}</p>
              </div>
            ))}
          </div>
        </div>
      );

    case "finding":
      const legend = [slide.year, slide.country, slide.territory ? `Territory: ${slide.territory}` : null].filter(Boolean).join(" | ");
      const hasMedia = slide.image_url || slide.media_url;
      return (
        <div className="flex gap-10 items-start">
          <div className="flex-1 pt-4">
            {slide.brand && <p className="text-[10px] uppercase tracking-[0.3em] font-semibold mb-4" style={{ color: f }}>{slide.brand}</p>}
            <h2 className="text-3xl md:text-4xl font-bold uppercase leading-[1.05] mb-5" style={{ color: t }}>{slide.title}</h2>
            <div className="w-14 h-0.5 mb-5" style={{ backgroundColor: theme.accent, opacity: 0.5 }} />
            <div className="prose max-w-none">
              <Markdown remarkPlugins={[remarkGfm]} components={mdC}>{slide.body || ""}</Markdown>
            </div>
          </div>
          {hasMedia && (
            <div className="w-[340px] flex-shrink-0 pt-4">
              <MediaThumb imageUrl={slide.image_url} mediaUrl={slide.media_url} mediaType={slide.media_type} className="" />
              {/* Legend / caption */}
              <div className="mt-3 px-1" style={{ color: m }}>
                <p className="text-xs font-semibold" style={{ color: t, opacity: 0.8 }}>
                  {slide.brand}{slide.title ? ` | ${slide.title}` : ""}
                </p>
                {legend && <p className="text-[10px] mt-1" style={{ opacity: 0.6 }}>{legend}</p>}
                {slide.media_url && (
                  <a href={slide.media_url} target="_blank" rel="noopener noreferrer"
                    className="text-[10px] mt-1 block hover:opacity-100 transition truncate"
                    style={{ color: theme.accent, opacity: 0.7 }}
                    onClick={e => e.stopPropagation()}>
                    {slide.media_url}
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      );

    case "takeaways":
      return (
        <div className="animate-fadeIn">
          <h2 className="text-2xl md:text-3xl font-bold uppercase mb-8" style={{ color: t }}>{slide.title || "Takeaways & Considerations"}</h2>
          <div className="max-w-3xl space-y-4">
            {(slide.takeaways || []).map((tk, i) => (
              <div key={i} className="flex items-start gap-4">
                <span className="text-xl font-bold flex-shrink-0 w-8" style={{ color: t, opacity: 0.3 }}>{String(i+1).padStart(2,"0")}</span>
                <div>
                  <p className="text-base leading-relaxed" style={{ color: t }}>{tk}</p>
                  {i < (slide.takeaways||[]).length-1 && <div className="mt-4 border-t border-dotted" style={{ borderColor: t, opacity: 0.15 }} />}
                </div>
              </div>
            ))}
          </div>
        </div>
      );

    case "closing":
      return (
        <div className="py-8 flex flex-col items-center justify-center text-center">
          {/* K&D logo large */}
          <div className="mb-10 flex flex-col items-center gap-0" style={{ color: t, opacity: 0.25 }}>
            {["K","N","O","T","S"].map((l,i) => (
              <span key={i} className="text-2xl font-bold leading-[1.2]" style={{ marginLeft: i===2?10:i===3?5:0 }}>{l}</span>
            ))}
            <span className="text-2xl italic my-1" style={{ fontFamily: "Georgia, serif" }}>&amp;</span>
            {["D","O","T","S","."].map((l,i) => (
              <span key={i} className="text-2xl font-bold leading-[1.2]" style={{ marginLeft: i===1?5:0 }}>{l}</span>
            ))}
          </div>
          <h2 className="text-3xl md:text-4xl font-bold uppercase leading-[1] mb-4" style={{ color: t }}>{slide.title || "Thank You"}</h2>
          {slide.subtitle && <p className="text-base max-w-md" style={{ color: m }}>{slide.subtitle}</p>}
          <div className="mt-10 flex items-center gap-3">
            <div className="w-10 h-px" style={{ backgroundColor: t, opacity: 0.12 }} />
            <p className="text-[9px] uppercase tracking-[0.3em]" style={{ color: f }}>A Knots &amp; Dots product</p>
            <div className="w-10 h-px" style={{ backgroundColor: t, opacity: 0.12 }} />
          </div>
          <p className="text-[9px] mt-3" style={{ color: f }}>groundwork by knots &amp; dots · {new Date().getFullYear()}</p>
        </div>
      );

    default:
      return (
        <div className="animate-fadeIn">
          <h2 className="text-3xl font-bold uppercase mb-4" style={{ color: t }}>{slide.title || ""}</h2>
          <div className="prose max-w-none">
            <Markdown remarkPlugins={[remarkGfm]} components={mdC}>{slide.body || ""}</Markdown>
          </div>
        </div>
      );
  }
}
