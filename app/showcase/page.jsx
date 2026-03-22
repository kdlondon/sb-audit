"use client";
import React, { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
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

/* ─── COMPETITOR SNAPSHOT SLIDE TYPES ─── */
const CS_SLIDE_TYPES = {
  cs_title: "Title",
  cs_audience: "Understanding the Audience",
  cs_brand_response: "The Brand Response",
  cs_hero_gallery: "Brand Hero Content",
  cs_proof_points: "Proof Points & Communication Strategy",
  cs_product: "Product Communication",
  cs_beyond_banking: "Beyond Banking & Innovation",
  cs_brand_assessment: "Brand Assessment",
  cs_comm_assessment: "Communication Assessment",
  cs_closing: "Closing",
};

/* ─── SHOWCASE TYPES ─── */
const SHOWCASE_TYPES = {
  creative: { label: "Creative Showcase", desc: "Cinematic presentation of creative intelligence findings" },
  competitor_snapshot: { label: "Competitor Snapshot", desc: "Framework-agnostic competitive communication audit for a single brand" },
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

const SLIDE_COLORS = [
  { id: "default", label: "Default", color: null },
  { id: "navy", label: "Navy", color: KD.navy },
  { id: "electric", label: "Electric", color: KD.electric },
  { id: "charcoal", label: "Charcoal", color: KD.charcoal },
  { id: "dark", label: "Dark", color: KD.dark },
  { id: "chartreuse", label: "Chartreuse", color: KD.chartreuse },
  { id: "lavender", label: "Lavender", color: KD.lavender },
  { id: "cream", label: "Cream", color: "#faf5ee" },
  { id: "white", label: "White", color: "#ffffff" },
  { id: "black", label: "Black", color: "#000000" },
];

function getThemeForSlide(slide, index) {
  // Custom bg override
  if (slide._bg) {
    const isDark = ["#0a0f3c","#1e1a22","#111015","#0019FF"].includes(slide._bg);
    return { bg: slide._bg, text: isDark ? "#fff" : "#1a1a2e", accent: isDark ? "#D4E520" : "#1D9A42", isDark };
  }
  switch (slide.type) {
    // Original creative showcase themes
    case "title":        return { bg: KD.navy, text: "#fff", accent: "#4060ff", isDark: true };
    case "key_findings": return { bg: KD.chartreuse, text: "#0a0a0a", accent: "#0a0a0a", isDark: false };
    case "finding":      return index % 2 === 0
      ? { bg: KD.charcoal, text: "#e5e0eb", accent: KD.chartreuse, isDark: true }
      : { bg: KD.electric, text: "#fff", accent: "#fff", isDark: true };
    case "takeaways":    return { bg: KD.chartreuse, text: "#0a0a0a", accent: "#0a0a0a", isDark: false };
    case "closing":      return { bg: KD.navy, text: "#fff", accent: KD.chartreuse, isDark: true };
    // Competitor Snapshot themes — cream base, consistent green accent
    case "cs_title":           return { bg: KD.navy, text: "#fff", accent: KD.chartreuse, isDark: true };
    case "cs_audience":        return { bg: "#faf5ee", text: "#1a1a2e", accent: "#1D9A42", isDark: false };
    case "cs_brand_response":  return { bg: "#faf5ee", text: "#1a1a2e", accent: "#1D9A42", isDark: false };
    case "cs_hero_gallery":    return { bg: "#faf5ee", text: "#1a1a2e", accent: "#1D9A42", isDark: false };
    case "cs_proof_points":    return { bg: "#faf5ee", text: "#1a1a2e", accent: "#1D9A42", isDark: false };
    case "cs_product":         return { bg: "#faf5ee", text: "#1a1a2e", accent: "#1D9A42", isDark: false };
    case "cs_beyond_banking":  return { bg: "#faf5ee", text: "#1a1a2e", accent: "#1D9A42", isDark: false };
    case "cs_brand_assessment":return { bg: "#faf5ee", text: "#1a1a2e", accent: "#1D9A42", isDark: false };
    case "cs_comm_assessment": return { bg: "#faf5ee", text: "#1a1a2e", accent: "#1D9A42", isDark: false };
    case "cs_closing":         return { bg: KD.navy, text: "#fff", accent: KD.chartreuse, isDark: true };
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
class ErrorBoundarySlide extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      const t = this.props.theme?.text || "#fff";
      const m = this.props.theme?.isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)";
      return (
        <div className="py-8 text-center">
          <p className="text-lg font-bold mb-2" style={{ color: t }}>{this.props.slide?.title || this.props.slide?.type || "Slide"}</p>
          <p className="text-sm" style={{ color: m }}>This slide could not be rendered. Try editing it or skipping to the next one.</p>
          <p className="text-[10px] mt-2" style={{ color: m }}>Error: {this.state.error?.message}</p>
        </div>
      );
    }
    return <SlideRenderer {...this.props} />;
  }
}

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
  const { projectId, projectName } = useProject() || {};
  const { role } = useRole() || {};
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const supabase = createClient();
  const pdfRef = useRef(null);

  // Derive view from URL params
  const idParam = searchParams.get("id");
  const viewParam = searchParams.get("view"); // backward compat
  const newParam = searchParams.get("new");
  const editParam = searchParams.get("edit");
  const showcaseId = idParam || viewParam;
  const view = newParam ? "create" : (showcaseId && editParam) ? "edit" : showcaseId ? "present" : "list";

  const nav = (params) => {
    const sp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v != null) sp.set(k, String(v)); });
    const qs = sp.toString();
    router.push(qs ? `/showcase?${qs}` : "/showcase", { scroll: false });
  };

  // State
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
  const [showcaseType, setShowcaseType] = useState("creative"); // "creative" | "competitor_snapshot"
  const [selectedScope, setSelectedScope] = useState("local"); // for competitor_snapshot

  // Edit state
  const [editSlides, setEditSlides] = useState([]);
  const [editTitle, setEditTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [allEntries, setAllEntries] = useState([]); // for entry search in editor
  const [entrySearchIdx, setEntrySearchIdx] = useState(null); // which slide idx has search open
  const [entrySearchQ, setEntrySearchQ] = useState("");
  const [collapsedSlides, setCollapsedSlides] = useState(new Set());
  const [previewSlide, setPreviewSlide] = useState(null); // idx of slide to preview

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

  // Sync currentShowcase from URL-driven showcaseId
  useEffect(() => {
    if (!showcaseId) { setCurrentShowcase(null); return; }
    // Check sessionStorage first (from /showcase/[id] redirect)
    if (typeof window !== "undefined") {
      const stored = sessionStorage.getItem("shared-showcase");
      if (stored) {
        try {
          const sc = JSON.parse(stored);
          if (sc.id === showcaseId) {
            setCurrentShowcase(sc);
            setCurrentSlide(0);
            sessionStorage.removeItem("shared-showcase");
            return;
          }
        } catch {}
      }
    }
    // Already loaded
    if (currentShowcase?.id === showcaseId) return;
    // Find in loaded list
    const found = showcases.find(s => s.id === showcaseId);
    if (found) { setCurrentShowcase(found); setCurrentSlide(0); return; }
    // Load from DB
    (async () => {
      const { data } = await supabase.from("saved_showcases").select("*").eq("id", showcaseId).single();
      if (data) { setCurrentShowcase(data); setCurrentSlide(0); }
    })();
  }, [showcaseId, showcases]);

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
      nav({ id: saved.id });
      showToast("Showcase generated!");
      loadShowcases();
    } catch (err) { showToast("Error: " + err.message); }
    setGenerating(false);
  };

  /* ─── GENERATE COMPETITOR SNAPSHOT SHOWCASE ─── */
  const generateCompetitorSnapshot = async () => {
    setGenerating(true);
    const brand = selectedBrands[0];
    if (!brand) { showToast("Select exactly one brand"); setGenerating(false); return; }

    let localQuery = supabase.from("audit_entries").select("*").eq("project_id", projectId).eq("competitor", brand);
    let globalQuery = supabase.from("audit_global").select("*").eq("project_id", projectId).eq("brand", brand);
    if (yearFrom) { localQuery = localQuery.gte("year", yearFrom); globalQuery = globalQuery.gte("year", yearFrom); }
    if (yearTo) { localQuery = localQuery.lte("year", yearTo); globalQuery = globalQuery.lte("year", yearTo); }
    if (selectedCountries.length > 0) globalQuery = globalQuery.in("country", selectedCountries);

    const useLocal = selectedScope === "local" || selectedScope === "both";
    const useGlobal = selectedScope === "global" || selectedScope === "both";
    const [localRes, globalRes] = await Promise.all([
      useLocal ? localQuery : Promise.resolve({ data: [] }),
      useGlobal ? globalQuery : Promise.resolve({ data: [] }),
    ]);
    const entries = [...(localRes.data || []), ...(globalRes.data || [])];
    if (entries.length === 0) { showToast("No entries found for this brand"); setGenerating(false); return; }

    const entryData = entries.map(e => ({
      id: e.id, brand: e.competitor || e.brand, country: e.country || "Local market",
      year: e.year, type: e.type, description: e.description, insight: e.insight, idea: e.idea,
      synopsis: e.synopsis, main_slogan: e.main_slogan, primary_territory: e.primary_territory,
      secondary_territory: e.secondary_territory, tone_of_voice: e.tone_of_voice,
      brand_archetype: e.brand_archetype, communication_intent: e.communication_intent,
      funnel: e.funnel, rating: e.rating, url: e.url,
      analyst_comment: e.analyst_comment, execution_style: e.execution_style,
      main_vp: e.main_vp, emotional_benefit: e.emotional_benefit,
      rational_benefit: e.rational_benefit, pain_point: e.pain_point,
    }));

    const scopeLabel = selectedScope === "local" ? "Local Audit" : selectedScope === "global" ? "Global Benchmark" : "Local + Global";

    const systemPrompt = `You are a senior brand strategist preparing a Competitive Communication Snapshot for ${brand}.

OUTPUT: A structured slide deck in JSON. Write for visual impact: short phrases, scannable bullets, punchy labels. Every word must earn its place on a slide.

CRITICAL RULES:
- Framework-agnostic. NO portraits, entry doors, journey phases, richness definitions, moments that matter, or client lifecycle.
- Be specific — reference actual slogans, campaign names, and patterns from the data.
- No filler, no hedging, no generic statements.
- ALL output in English regardless of input language.
- Return ONLY valid JSON — no markdown, no code blocks.

Return: {"title":"${brand} — Competitor Snapshot","slides":[exactly 9 slide objects]}

THE 9 SLIDES — follow this structure EXACTLY:

SLIDE 1 — type:"cs_title"
Fields: brand ("${brand}"), scope ("${scopeLabel}"), date ("${new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" })}"), entry_count (${entries.length}), subtitle ("Competitive Communication Snapshot")

SLIDE 2 — type:"cs_audience"
Analyze entries with Brand Hero communication intent to infer the target audience this brand is speaking to in its core positioning.
Fields:
- demographic: string — age range, financial profile, experience level. Short scannable text.
- psychographic: string — mindset, motivations, self-image. 2-3 short lines.
- tension: string — the core unresolved need the brand addresses. 1-2 sentences.
- human_insight: string — a first-person quote (20-35 words) capturing the human truth the brand responds to.
- entries: array of 1-2 entries: {description, image_url, url, year} — pick the most representative pieces

SLIDE 3 — type:"cs_brand_response"
Extract ONLY from entries with Brand Hero communication intent.
Fields:
- creative_proposition: string — 3-6 words. Use actual main_slogan if prominent.
- proposition_description: string — one line.
- brand_archetype: string — dominant archetype + one sentence.
- brand_role: string — one sentence.
- emotional_positioning: string — 5-10 words.
- rational_positioning: string — 15-25 words.
- brand_territory: string — primary + secondary.
- key_differentiators: array of 3 strings.
- entries: array of 2-3 Brand Hero entries: {description, image_url, url, year} — the key positioning pieces. COPY exact image_url and url from the data.

SLIDE 4 — type:"cs_proof_points"
Fields:
- creative_proposition: string — same as slide 3.
- primary_proof: string — 1-2 sentences.
- secondary_proofs: array of 3 strings.
- communication_focus: string — 1-2 sentences.
- tone_voice: array of 3 strings.
- entries: array of 2-3 entries: {description, image_url, url, year} — pieces that prove the positioning. COPY exact image_url and url.

SLIDE 5 — type:"cs_product"
Extract from entries with Product communication intent.
Fields:
- approach: string — one sentence.
- key_messages: array of 3 strings.
- channels_formats: string.
- gap: string — one sentence insight.
- entries: array of 2-3 Product entries: {description, image_url, url, year}. COPY exact image_url and url.

SLIDE 6 — type:"cs_beyond_banking"
Extract from entries with Innovation or Beyond Banking communication intent.
Fields:
- beyond_banking: string — one paragraph on lifestyle/community/aspiration/identity territories.
- innovation: string — one paragraph with evidence from communications.
- white_space: string — one sentence on the most credible unclaimed territory. This is a strategic insight.
- entries: array of 1-2 entries: {description, image_url, url, year}. COPY exact image_url and url.

SLIDE 7 — type:"cs_brand_assessment"
Assess the BRAND itself — its positioning, identity, archetype, proposition, territory.
Fields:
- strengths: array of 3 objects {label: string, explanation: string}. Each label is a bold 2-3 word heading, explanation is one sentence.
- weaknesses: array of 2 objects {label: string, explanation: string}. Same format.

SLIDE 8 — type:"cs_comm_assessment"
Assess COMMUNICATION quality across proof points (slide 4), product communication (slide 5), and beyond banking/innovation (slide 6). Strengths and weaknesses are about HOW WELL the brand communicates, not what the brand IS.
Fields:
- strengths: array of 3 objects {label: string, explanation: string}.
- weaknesses: array of 2 objects {label: string, explanation: string}.

SLIDE 9 — type:"cs_closing"
Fields: title ("Thank You"), subtitle ("Generated by Knots & Dots — Category Landscape Platform"), date ("${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}")`;

    const userMsg = `Analyze these ${entries.length} communications for ${brand} and create a 9-slide Competitor Snapshot:\n\n${JSON.stringify(entryData, null, 1)}`;

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

      const title = showcaseTitle.trim() || parsed.title || `${brand} — Competitor Snapshot`;
      const slides = parsed.slides || [];

      const { data: { session } } = await supabase.auth.getSession();
      const { data: saved, error } = await supabase.from("saved_showcases").insert({
        title, project_id: projectId,
        filters: { brands: [brand], countries: selectedCountries, yearFrom, yearTo,
          client: clientName, scope: selectedScope, showcaseType: "competitor_snapshot" },
        slides, created_by: session?.user?.email || "",
      }).select().single();
      if (error) throw error;

      setCurrentShowcase(saved);
      setCurrentSlide(0);
      nav({ id: saved.id });
      showToast("Competitor Snapshot generated!");
      loadShowcases();
    } catch (err) { showToast("Error: " + err.message); }
    setGenerating(false);
  };

  /* ─── SAVE EDITS ─── */
  const saveEdits = async () => {
    setSaving(true);
    await supabase.from("saved_showcases").update({ title: editTitle, slides: editSlides, updated_at: new Date().toISOString() }).eq("id", currentShowcase.id);
    setCurrentShowcase({ ...currentShowcase, title: editTitle, slides: editSlides });
    setSaving(false); showToast("Changes saved"); nav({ id: currentShowcase.id }); loadShowcases();
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
      if (e.key === "Escape") { if (mediaModal) setMediaModal(null); else nav({}); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [view, currentShowcase, mediaModal]);

  // Load entries for search when in edit mode
  useEffect(() => {
    if (view !== "edit" || !projectId || allEntries.length > 0) return;
    (async () => {
      const [localRes, globalRes] = await Promise.all([
        supabase.from("audit_entries").select("id,competitor,description,year,type,rating,image_url,image_urls,url,main_slogan,synopsis").eq("project_id", projectId),
        supabase.from("audit_global").select("id,brand,description,year,type,rating,image_url,image_urls,url,main_slogan,synopsis,country").eq("project_id", projectId),
      ]);
      setAllEntries([
        ...(localRes.data || []).map(e => ({ ...e, brand: e.competitor })),
        ...(globalRes.data || []),
      ]);
    })();
  }, [view, projectId]);

  const openShowcase = (sc) => { setCurrentShowcase(sc); setCurrentSlide(0); nav({ id: sc.id }); };
  const enterEdit = async () => {
    setEditSlides(JSON.parse(JSON.stringify(currentShowcase.slides)));
    setEditTitle(currentShowcase.title);
    nav({ id: currentShowcase.id, edit: 1 });
    // Load all entries for the search
    if (allEntries.length === 0) {
      const [localRes, globalRes] = await Promise.all([
        supabase.from("audit_entries").select("id,competitor,description,year,type,rating,image_url,image_urls,url,main_slogan,synopsis").eq("project_id", projectId),
        supabase.from("audit_global").select("id,brand,description,year,type,rating,image_url,image_urls,url,main_slogan,synopsis,country").eq("project_id", projectId),
      ]);
      const entries = [
        ...(localRes.data || []).map(e => ({ ...e, brand: e.competitor })),
        ...(globalRes.data || []),
      ];
      setAllEntries(entries);
    }
  };

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
            <button onClick={() => nav({})} className="text-[9px] px-2 py-1 rounded border transition"
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
              <ErrorBoundarySlide slide={slide} theme={theme} projectName={projectName} onMediaClick={setMediaModal} pdfMode={pdfMode} />
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
          {mediaModal && <MediaModal src={mediaModal.src} type={mediaModal.type} onClose={() => setMediaModal(null)} />}
          <div className="max-w-[1400px] mx-auto p-6">
            <div className="flex justify-between items-center mb-6 sticky top-[52px] z-30 py-3 -mx-6 px-6" style={{ background: "var(--bg)" }}>
              <div className="flex items-center gap-3">
                <button onClick={() => nav({ id: currentShowcase.id })} className="text-muted hover:text-main text-lg">←</button>
                <h1 className="text-xl font-bold text-main">Edit Showcase</h1>
              </div>
              <div className="flex gap-2">
                <button onClick={() => nav({ id: currentShowcase.id })} className="px-4 py-2 border border-main rounded-lg text-sm text-muted hover:text-main">Cancel</button>
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

            <div className="space-y-1">
              {editSlides.map((slide, idx) => (<React.Fragment key={idx}>
                {/* Insert slide button between slides */}
                {idx > 0 && (
                  <button key={`add-${idx}`} onClick={() => {
                    const isCS = editSlides.some(s => s.type?.startsWith("cs_"));
                    const newSlide = isCS
                      ? { type: "cs_hero_gallery", title: "", subtitle: "", entries: [] }
                      : { type: "finding", title: "", body: "", brand: "", year: "", country: "", territory: "", image_url: "", media_url: "", media_type: "Image" };
                    const s = [...editSlides];
                    s.splice(idx, 0, newSlide);
                    setEditSlides(s);
                  }} className="w-full py-2 text-hint hover:text-accent transition flex items-center justify-center gap-2">
                    <div className="h-px flex-1 bg-main"/>
                    <span className="text-xs border border-main hover:border-[var(--accent)] rounded-full w-6 h-6 flex items-center justify-center hover:bg-accent-soft transition">+</span>
                    <div className="h-px flex-1 bg-main"/>
                  </button>
                )}
                <div key={idx} className="bg-surface border border-main rounded-xl">
                  {/* Header */}
                  <div className="flex justify-between items-center px-4 py-2 cursor-pointer hover:bg-surface2 transition"
                    onClick={()=>{const s=new Set(collapsedSlides);s.has(idx)?s.delete(idx):s.add(idx);setCollapsedSlides(s);}}>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] text-hint transition ${collapsedSlides.has(idx)?"":"rotate-90"}`}>▶</span>
                      <span className="text-[10px] text-accent uppercase font-semibold">{SLIDE_TYPES[slide.type] || CS_SLIDE_TYPES[slide.type] || slide.type}</span>
                      <span className="text-[10px] text-hint font-mono">#{idx + 1}</span>
                      {collapsedSlides.has(idx) && slide.title && <span className="text-[10px] text-muted truncate max-w-[250px]">— {slide.title}</span>}
                    </div>
                    <div className="flex items-center gap-1" onClick={e=>e.stopPropagation()}>
                      {/* Color picker */}
                      <div className="flex items-center gap-0.5 mr-2">
                        {SLIDE_COLORS.map(sc=>(
                          <button key={sc.id} onClick={()=>{const s=[...editSlides];s[idx]={...s[idx],_bg:sc.color};setEditSlides(s);}}
                            className={`w-4 h-4 rounded-full border transition ${(slide._bg||null)===sc.color?"ring-2 ring-[var(--accent)] ring-offset-1":"border-main hover:scale-110"}`}
                            style={{background:sc.color||"var(--surface)",backgroundImage:!sc.color?"linear-gradient(135deg,#ddd 50%,#fff 50%)":undefined}}
                            title={sc.label}/>
                        ))}
                      </div>
                      {idx > 0 && <button onClick={() => { const s = [...editSlides]; [s[idx-1],s[idx]]=[s[idx],s[idx-1]]; setEditSlides(s); }} className="text-xs text-muted hover:text-main px-1.5 py-1 rounded hover:bg-surface2">↑</button>}
                      {idx < editSlides.length-1 && <button onClick={() => { const s = [...editSlides]; [s[idx],s[idx+1]]=[s[idx+1],s[idx]]; setEditSlides(s); }} className="text-xs text-muted hover:text-main px-1.5 py-1 rounded hover:bg-surface2">↓</button>}
                      <button onClick={() => { if(confirm("Remove this slide?")) setEditSlides(editSlides.filter((_,i)=>i!==idx)); }} className="text-xs text-red-400 hover:text-red-600 px-1.5 py-1 rounded hover:bg-red-50">×</button>
                    </div>
                  </div>
                  {/* Body: fields left + preview right */}
                  {!collapsedSlides.has(idx)&&<div className="flex border-t border-main">
                    <div className="flex-1 min-w-0 px-5 pb-5 pt-3 space-y-3">
                    {/* Slide type selector */}
                    <div>
                      <label className="block text-[10px] text-muted uppercase font-semibold mb-1">Slide Type</label>
                      <select value={slide.type} onChange={e => { const s=[...editSlides]; s[idx]={...s[idx],type:e.target.value}; setEditSlides(s); }}
                        className="px-2 py-1 bg-surface border border-main rounded text-xs text-main">
                        {Object.entries(slide.type?.startsWith("cs_") ? CS_SLIDE_TYPES : SLIDE_TYPES).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
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
                    {/* CS text fields */}
                    {["demographic","psychographic","tension","human_insight","creative_proposition","proposition_description",
                      "brand_archetype","brand_role","emotional_positioning","rational_positioning","brand_territory",
                      "primary_proof","communication_focus","approach","channels_formats","gap",
                      "beyond_banking","innovation","white_space","scope","date","entry_count"].map(field => (
                      slide[field] !== undefined && (
                        <div key={field}>
                          <label className="block text-[10px] text-muted uppercase font-semibold mb-1">{field.replace(/_/g," ")}</label>
                          <textarea value={slide[field] || ""} rows={2} onChange={e => { const s=[...editSlides]; s[idx]={...s[idx],[field]:e.target.value}; setEditSlides(s); }}
                            className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[var(--accent)]" />
                        </div>
                      )
                    ))}
                    {/* CS array fields: key_differentiators, secondary_proofs, key_messages, tone_voice */}
                    {["key_differentiators","secondary_proofs","key_messages","tone_voice"].map(field => (
                      slide[field] && (
                        <div key={field}>
                          <label className="block text-[10px] text-muted uppercase font-semibold mb-1">{field.replace(/_/g," ")} (one per line)</label>
                          <textarea value={(slide[field]||[]).join("\n")} rows={3} onChange={e => { const s=[...editSlides]; s[idx]={...s[idx],[field]:e.target.value.split("\n")}; setEditSlides(s); }}
                            className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[var(--accent)]" />
                        </div>
                      )
                    ))}
                    {/* CS assessment arrays: strengths / weaknesses */}
                    {slide.strengths && (
                      <div>
                        <label className="block text-[10px] text-muted uppercase font-semibold mb-2">Strengths</label>
                        {slide.strengths.map((s, si) => (
                          <div key={si} className="flex gap-2 mb-2 items-start">
                            <div className="flex-1 space-y-1">
                              <input value={s.label||""} placeholder="Label" onChange={e => { const sl=[...editSlides]; const arr=[...sl[idx].strengths]; arr[si]={...arr[si],label:e.target.value}; sl[idx]={...sl[idx],strengths:arr}; setEditSlides(sl); }}
                                className="w-full px-2 py-1 bg-surface border border-main rounded text-xs text-main font-semibold" />
                              <input value={s.explanation||""} placeholder="Explanation" onChange={e => { const sl=[...editSlides]; const arr=[...sl[idx].strengths]; arr[si]={...arr[si],explanation:e.target.value}; sl[idx]={...sl[idx],strengths:arr}; setEditSlides(sl); }}
                                className="w-full px-2 py-1 bg-surface border border-main rounded text-xs text-main" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {slide.weaknesses && (
                      <div>
                        <label className="block text-[10px] text-muted uppercase font-semibold mb-2">Weaknesses</label>
                        {slide.weaknesses.map((w, wi) => (
                          <div key={wi} className="flex gap-2 mb-2 items-start">
                            <div className="flex-1 space-y-1">
                              <input value={w.label||""} placeholder="Label" onChange={e => { const sl=[...editSlides]; const arr=[...sl[idx].weaknesses]; arr[wi]={...arr[wi],label:e.target.value}; sl[idx]={...sl[idx],weaknesses:arr}; setEditSlides(sl); }}
                                className="w-full px-2 py-1 bg-surface border border-main rounded text-xs text-main font-semibold" />
                              <input value={w.explanation||""} placeholder="Explanation" onChange={e => { const sl=[...editSlides]; const arr=[...sl[idx].weaknesses]; arr[wi]={...arr[wi],explanation:e.target.value}; sl[idx]={...sl[idx],weaknesses:arr}; setEditSlides(sl); }}
                                className="w-full px-2 py-1 bg-surface border border-main rounded text-xs text-main" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Entries editor — for slides with entries arrays */}
                    {(Array.isArray(slide.entries) || slide.type?.startsWith("cs_")) && (
                      <div>
                        <label className="block text-[10px] text-muted uppercase font-semibold mb-2">
                          Entries ({(slide.entries||[]).length})
                        </label>
                        {/* Existing entries */}
                        {(slide.entries||[]).length > 0 && (
                          <div className="space-y-1.5 mb-3">
                            {(slide.entries||[]).map((entry, ei) => {
                              const ytMatch = (entry.url||"").match(/(?:youtube\.com\/watch\?.*v=|youtu\.be\/)([^&\s]+)/);
                              const thumb = ytMatch ? `https://img.youtube.com/vi/${ytMatch[1]}/mqdefault.jpg` : entry.image_url;
                              const moveEntry = (from, to) => {
                                const s = [...editSlides];
                                const arr = [...(s[idx].entries||[])];
                                const [item] = arr.splice(from, 1);
                                arr.splice(to, 0, item);
                                s[idx] = { ...s[idx], entries: arr };
                                setEditSlides(s);
                              };
                              return (
                                <div key={ei} className="flex items-center gap-2 bg-surface2 rounded-lg p-2 group">
                                  {thumb && <img src={thumb} className="w-14 h-10 object-cover rounded flex-shrink-0 cursor-pointer hover:opacity-80 transition"
                                    onClick={() => setMediaModal({ src: entry.image_url || entry.url, type: entry.url?.includes("youtube") ? "Video" : "Image" })}
                                    alt="" title="Click to preview" />}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-main truncate">{entry.description || "—"}</p>
                                    <div className="flex gap-2 mt-0.5">
                                      {entry.year && <span className="text-[10px] text-hint">{entry.year}</span>}
                                      {entry.type && <span className="text-[10px] text-hint">{entry.type}</span>}
                                      {entry.rating && <span className="text-[10px] text-amber-500">{"★".repeat(Number(entry.rating))}</span>}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
                                    {ei > 0 && <button onClick={() => moveEntry(ei, ei-1)} className="text-[10px] text-muted hover:text-main px-1 py-0.5 rounded hover:bg-surface" title="Move up">↑</button>}
                                    {ei < (slide.entries||[]).length-1 && <button onClick={() => moveEntry(ei, ei+1)} className="text-[10px] text-muted hover:text-main px-1 py-0.5 rounded hover:bg-surface" title="Move down">↓</button>}
                                    <button onClick={() => {
                                      const s = [...editSlides];
                                      const entries = [...(s[idx].entries||[])];
                                      entries.splice(ei, 1);
                                      s[idx] = { ...s[idx], entries };
                                      setEditSlides(s);
                                    }} className="text-red-400 hover:text-red-600 text-sm px-1 py-0.5 rounded hover:bg-red-50" title="Remove">×</button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {/* Add entry search */}
                        <div className="relative">
                          <input
                            value={entrySearchIdx === idx ? entrySearchQ : ""}
                            onFocus={() => { setEntrySearchIdx(idx); setEntrySearchQ(""); }}
                            onChange={e => { setEntrySearchIdx(idx); setEntrySearchQ(e.target.value); }}
                            placeholder="Search entries to add..."
                            className="w-full px-3 py-1.5 bg-surface border border-dashed border-main rounded-lg text-xs text-main focus:outline-none focus:border-[var(--accent)]"
                          />
                          {entrySearchIdx === idx && entrySearchQ.length > 1 && (() => {
                            const q = entrySearchQ.toLowerCase();
                            const currentIds = new Set((slide.entries||[]).map(e => e.id || e.description));
                            const results = allEntries
                              .filter(e => !currentIds.has(e.id) && (
                                (e.description||"").toLowerCase().includes(q) ||
                                (e.brand||"").toLowerCase().includes(q) ||
                                (e.competitor||"").toLowerCase().includes(q) ||
                                (e.type||"").toLowerCase().includes(q) ||
                                (e.main_slogan||"").toLowerCase().includes(q)
                              ))
                              .slice(0, 6);
                            if (results.length === 0) return null;
                            return (
                              <div className="absolute left-0 right-0 top-full mt-1 bg-surface border border-main rounded-lg shadow-xl z-50 max-h-[240px] overflow-y-auto">
                                {results.map((e, ri) => {
                                  const yt = (e.url||"").match(/(?:youtube\.com\/watch\?.*v=|youtu\.be\/)([^&\s]+)/);
                                  const th = yt ? `https://img.youtube.com/vi/${yt[1]}/mqdefault.jpg` : e.image_url;
                                  return (
                                    <button key={ri} className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-accent-soft transition"
                                      onClick={() => {
                                        const newEntry = { id: e.id, description: e.description, image_url: e.image_url, url: e.url, year: e.year, type: e.type, rating: e.rating, main_slogan: e.main_slogan, synopsis: e.synopsis };
                                        const s = [...editSlides];
                                        s[idx] = { ...s[idx], entries: [...(s[idx].entries||[]), newEntry] };
                                        setEditSlides(s);
                                        setEntrySearchQ("");
                                        setEntrySearchIdx(null);
                                      }}>
                                      {th && <img src={th} className="w-12 h-9 object-cover rounded flex-shrink-0" alt="" />}
                                      <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium text-main truncate">{e.description || "—"}</p>
                                        <div className="flex gap-2">
                                          {e.brand && <span className="text-[10px] text-accent">{e.brand}</span>}
                                          {e.year && <span className="text-[10px] text-hint">{e.year}</span>}
                                          {e.type && <span className="text-[10px] text-hint">{e.type}</span>}
                                        </div>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                  {/* Live preview — 16:9 */}
                  <div className="w-[55%] flex-shrink-0 border-l border-main relative" style={{backgroundColor:getThemeForSlide(slide,idx).bg}}>
                    <div style={{paddingTop:"56.25%"}}/>
                    <div className="absolute inset-0 flex items-center justify-center overflow-hidden" style={{transform:"scale(0.48)",transformOrigin:"center center"}}>
                      <div className="w-[1100px]">
                        <SlideRenderer slide={slide} theme={getThemeForSlide(slide,idx)} projectName={projectName} onMediaClick={()=>{}} />
                      </div>
                    </div>
                  </div>
                  </div>}
                </div>
              </React.Fragment>))}

              {/* Add new slide at end */}
              <button onClick={() => {
                const isCS = editSlides.some(s => s.type?.startsWith("cs_"));
                const newSlide = isCS
                  ? { type: "cs_hero_gallery", title: "", subtitle: "", entries: [] }
                  : { type: "finding", title: "", body: "", brand: "", year: "", country: "", territory: "", image_url: "", media_url: "", media_type: "Image" };
                setEditSlides([...editSlides, newSlide]);
              }} className="w-full py-3 border-2 border-dashed border-main rounded-xl text-sm text-muted hover:text-main hover:border-[var(--accent)] transition">
                + Add slide
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
    const isCS = showcaseType === "competitor_snapshot";
    return (
      <AuthGuard><ProjectGuard><Nav />
        <div className="min-h-screen" style={{ background: "var(--bg)" }}>
          {ToastEl}
          <div className="max-w-2xl mx-auto p-6">
            <div className="flex items-center gap-3 mb-6">
              <button onClick={() => nav({})} className="text-muted hover:text-main text-lg">←</button>
              <h1 className="text-xl font-bold text-main">New Showcase</h1>
            </div>

            {/* Showcase Type Selector */}
            <div className="flex gap-3 mb-6">
              {Object.entries(SHOWCASE_TYPES).map(([key, { label, desc }]) => (
                <button key={key} onClick={() => { setShowcaseType(key); setSelectedBrands([]); }}
                  className={`flex-1 p-4 rounded-xl border-2 text-left transition ${showcaseType === key ? "border-[var(--accent)] bg-accent-soft" : "border-main bg-surface hover:border-[var(--accent)]"}`}>
                  <p className="text-sm font-semibold text-main">{label}</p>
                  <p className="text-[10px] text-muted mt-1">{desc}</p>
                </button>
              ))}
            </div>

            <div className="bg-surface border border-main rounded-xl p-6 space-y-5">
              {/* Client & Title */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-muted uppercase font-semibold mb-1">Client {!isCS && "*"}</label>
                  <input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="E.g., Scotiabank"
                    className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[var(--accent)]" />
                </div>
                <div>
                  <label className="block text-[10px] text-muted uppercase font-semibold mb-1">Showcase Title</label>
                  <input value={showcaseTitle} onChange={e => setShowcaseTitle(e.target.value)} placeholder="AI generates if empty"
                    className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[var(--accent)]" />
                </div>
              </div>

              {!isCS && (
                <div>
                  <label className="block text-[10px] text-muted uppercase font-semibold mb-1">Objective *</label>
                  <textarea value={objective} onChange={e => setObjective(e.target.value)} rows={2}
                    placeholder="What should this showcase communicate?"
                    className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[var(--accent)]" />
                </div>
              )}

              {!isCS && (
                <div>
                  <label className="block text-[10px] text-muted uppercase font-semibold mb-1">
                    Analyst Highlights <span className="text-hint font-normal">(optional)</span>
                  </label>
                  <textarea value={analystHighlights} onChange={e => setAnalystHighlights(e.target.value)} rows={3}
                    placeholder="Your team's observations for AI to weave in"
                    className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[var(--accent)]" />
                </div>
              )}

              {/* Scope selector — CS only */}
              {isCS && (
                <div>
                  <label className="block text-[10px] text-muted uppercase font-semibold mb-1">Scope *</label>
                  <div className="flex gap-2">
                    {[["local","Local Audit"],["global","Global Benchmark"],["both","Both"]].map(([val, lbl]) => (
                      <button key={val} onClick={() => setSelectedScope(val)}
                        className={`px-4 py-2 rounded-lg text-xs font-medium transition ${selectedScope === val ? "text-white" : "bg-surface2 text-muted hover:text-main"}`}
                        style={selectedScope === val ? { backgroundColor: KD.electric } : {}}>{lbl}</button>
                    ))}
                  </div>
                </div>
              )}

              <div className="border-t border-main pt-5">
                <p className="text-[10px] text-muted uppercase font-semibold mb-3">Filters</p>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <label className="block text-[10px] text-muted uppercase font-semibold mb-1">Year From</label>
                    <select value={yearFrom} onChange={e => setYearFrom(e.target.value)}
                      className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main">
                      <option value="">All years</option>
                      {Array.from({length:27},(_,i)=>String(2000+i)).map(y => <option key={y}>{y}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-muted uppercase font-semibold mb-1">Year To</label>
                    <select value={yearTo} onChange={e => setYearTo(e.target.value)}
                      className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main">
                      <option value="">All years</option>
                      {Array.from({length:27},(_,i)=>String(2000+i)).map(y => <option key={y}>{y}</option>)}
                    </select>
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-[10px] text-muted uppercase font-semibold mb-1">
                    {isCS ? "Brand *" : "Brands"} {selectedBrands.length > 0 && `(${selectedBrands.length})`}
                  </label>
                  {isCS && <p className="text-[10px] text-hint mb-2">Select exactly one brand for the snapshot</p>}
                  <div className="flex flex-wrap gap-1.5 p-2 bg-surface border border-main rounded-lg min-h-[36px]">
                    {allBrands.length === 0 && <span className="text-xs text-hint">No brands found</span>}
                    {allBrands.map(b => (
                      <button key={b} onClick={() => {
                        if (isCS) { setSelectedBrands(selectedBrands.includes(b) ? [] : [b]); }
                        else { setSelectedBrands(selectedBrands.includes(b) ? selectedBrands.filter(x=>x!==b) : [...selectedBrands,b]); }
                      }}
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
                <p className="text-[10px] text-hint">
                  {isCS
                    ? "Title → Audience → Brand Response → Proof Points → Product → Beyond Banking → Brand Assessment → Communication Assessment → Closing"
                    : "Title → Key Findings → Individual Findings (as many as needed) → Takeaways → Closing"}
                </p>
              </div>

              <button onClick={isCS ? generateCompetitorSnapshot : generateShowcase} disabled={generating || (isCS && selectedBrands.length !== 1)}
                className="w-full py-3 text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition"
                style={{ backgroundColor: KD.electric }}>
                {generating ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                    Generating...
                  </span>
                ) : isCS ? "Generate Competitor Snapshot" : "Generate Showcase"}
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
        {/* Section bar */}
        <div className="section-bar px-5 py-3 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-bold text-main">Showcase</h2>
            <p className="text-xs text-muted">Cinematic presentations powered by AI</p>
          </div>
          {canEdit && (
            <button onClick={() => nav({ new: 1 })} className="px-3 py-1.5 text-sm text-white rounded-lg font-semibold hover:opacity-90"
              style={{ backgroundColor: KD.electric }}>+ New Showcase</button>
          )}
        </div>
        <div className="max-w-4xl mx-auto p-6">

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
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-white font-bold text-lg group-hover:text-blue-200 transition">{sc.title}</h3>
                        {sc.filters?.showcaseType === "competitor_snapshot" && (
                          <span className="text-[8px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(212,229,32,0.2)", color: KD.chartreuse }}>Snapshot</span>
                        )}
                      </div>
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

  // Safe helpers for CS slides — prevent crashes from unexpected AI data
  const safeArr = (v) => Array.isArray(v) ? v : [];
  const safeStr = (v) => {
    if (typeof v === "string") return v;
    if (typeof v === "number") return String(v);
    if (v && typeof v === "object") {
      // Handle {primary, secondary} or similar objects
      return Object.values(v).filter(Boolean).join(" | ");
    }
    return "";
  };

  // Entry thumbnails strip for CS slides
  const EntryStrip = ({ entries }) => {
    const items = safeArr(entries);
    if (items.length === 0) return null;
    const ytId = (u) => { if (!u) return null; const mx = u.match(/(?:youtube\.com\/watch\?.*v=|youtu\.be\/)([^&\s]+)/); return mx ? mx[1] : null; };
    return (
      <div className="flex gap-3 mt-4 pt-4 overflow-x-auto" style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
        {items.map((e, i) => {
          const yt = ytId(e.url);
          const thumb = yt ? `https://img.youtube.com/vi/${yt}/mqdefault.jpg` : e.image_url;
          const isVideo = yt || (e.url && /vimeo/i.test(e.url));
          return (
            <div key={i} className="flex-shrink-0 w-[140px] cursor-pointer group/entry"
              onClick={() => { if (e.url) onMediaClick({ src: e.url, type: isVideo ? "Video" : "Image" }); else if (e.image_url) onMediaClick({ src: e.image_url, type: "Image" }); }}>
              <div className="relative rounded-lg overflow-hidden bg-surface2" style={{ height: 80 }}>
                {thumb ? <img src={thumb} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full flex items-center justify-center text-hint text-xs">No preview</div>}
                {isVideo && (
                  <div className="absolute inset-0 bg-black/20 group-hover/entry:bg-black/10 transition flex items-center justify-center">
                    <div className="w-7 h-7 rounded-full bg-white/90 flex items-center justify-center"><svg width="10" height="10" viewBox="0 0 20 20" fill="#0a0a0a"><polygon points="6,3 17,10 6,17"/></svg></div>
                  </div>
                )}
              </div>
              <p className="text-[9px] text-muted mt-1 truncate">{e.description || "—"}</p>
              <p className="text-[8px] text-hint">{e.year || ""}</p>
            </div>
          );
        })}
      </div>
    );
  };

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

  try { switch (slide.type) {
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

    /* ═══════════════════════════════════════════
       COMPETITOR SNAPSHOT SLIDES
       Design: cream bg → white card container → green accent bars
       ═══════════════════════════════════════════ */

    case "cs_title":
      return (
        <div className="py-8 animate-fadeIn">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-[10px] uppercase tracking-[0.2em] font-semibold px-3 py-1 rounded-full"
              style={{ backgroundColor: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.6)" }}>
              {slide.scope || "Competitive Audit"}
            </span>
            <span className="text-[10px] font-mono" style={{ color: f }}>{slide.date}</span>
          </div>
          <h1 className="text-6xl md:text-8xl font-bold tracking-tight leading-[0.9] mb-6" style={{ color: t }}>
            {slide.brand || slide.title}
          </h1>
          <p className="text-lg font-light tracking-wide" style={{ color: m }}>
            {slide.subtitle || "Competitive Communication Snapshot"}
          </p>
          <div className="mt-8 flex items-center gap-4">
            <div className="w-12 h-0.5" style={{ backgroundColor: theme.accent }} />
            <p className="text-[10px] uppercase tracking-[0.15em]" style={{ color: f }}>
              {slide.entry_count ? `${slide.entry_count} communications analyzed` : ""}
            </p>
          </div>
        </div>
      );

    case "cs_audience":
      return (
        <div className="animate-fadeIn -mx-4">
          {/* Section title */}
          <h2 className="text-xl font-bold mb-5 px-4" style={{ color: theme.accent }}>Understanding the Audience</h2>
          {/* White card container */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: "1px solid rgba(0,0,0,0.04)" }}>
            <div className="grid grid-cols-12 min-h-[380px]">
              {/* Left column — Demographic + Psychographic */}
              <div className="col-span-4 p-6 space-y-6" style={{ borderRight: "1px solid rgba(0,0,0,0.06)" }}>
                {/* Demographic */}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t} strokeWidth="1.5"><circle cx="12" cy="8" r="4"/><path d="M5 20c0-4 3-7 7-7s7 3 7 7"/></svg>
                    <span className="text-xs font-bold" style={{ color: t }}>Demographic</span>
                  </div>
                  <div className="h-[3px] w-2/3 rounded-full mb-3" style={{ backgroundColor: theme.accent }} />
                  <p className="text-sm font-semibold leading-snug mb-1" style={{ color: t }}>{(slide.demographic || "").split(".")[0]}</p>
                  <p className="text-xs leading-relaxed" style={{ color: m }}>{(slide.demographic || "").split(".").slice(1).join(".").trim()}</p>
                </div>
                {/* Psychographic */}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t} strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                    <span className="text-xs font-bold" style={{ color: t }}>Psychographic</span>
                  </div>
                  <div className="h-[3px] w-2/3 rounded-full mb-3" style={{ backgroundColor: theme.accent }} />
                  <p className="text-sm font-semibold leading-snug mb-1" style={{ color: t }}>{(slide.psychographic || "").split(".")[0]}</p>
                  <p className="text-xs leading-relaxed" style={{ color: m }}>{(slide.psychographic || "").split(".").slice(1).join(".").trim()}</p>
                </div>
              </div>
              {/* Center — Tension */}
              <div className="col-span-3 p-6 flex flex-col justify-center" style={{ borderRight: "1px solid rgba(0,0,0,0.06)" }}>
                <div className="flex items-center gap-2 mb-1">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t} strokeWidth="1.5"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="M8 15s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
                  <span className="text-xs font-bold" style={{ color: t }}>Tension</span>
                </div>
                <div className="h-[3px] w-2/3 rounded-full mb-3" style={{ backgroundColor: "#E11D48" }} />
                <p className="text-base font-semibold leading-snug mb-2" style={{ color: t }}>{slide.tension}</p>
              </div>
              {/* Right — Human Insight (green card) */}
              <div className="col-span-5 p-6 flex flex-col justify-center" style={{ backgroundColor: theme.accent }}>
                <div className="flex items-center gap-2 mb-1">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                  <span className="text-xs font-bold text-white/80">Human Insight</span>
                </div>
                <div className="h-[3px] w-2/3 rounded-full mb-4" style={{ backgroundColor: "rgba(255,255,255,0.3)" }} />
                <p className="text-xl italic leading-relaxed font-medium text-white" style={{ fontFamily: "Georgia, serif" }}>
                  &ldquo;{slide.human_insight}&rdquo;
                </p>
              </div>
            </div>
          </div>
          <EntryStrip entries={slide.entries} />
        </div>
      );

    case "cs_brand_response":
      return (
        <div className="animate-fadeIn -mx-4">
          <h2 className="text-xl font-bold mb-5 px-4" style={{ color: t }}>The Brand Response</h2>
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: "1px solid rgba(0,0,0,0.04)" }}>
            <div className="grid grid-cols-12 min-h-[380px]">
              {/* Left — Key Content + Creative Proposition */}
              <div className="col-span-5 p-6 flex flex-col justify-center" style={{ borderRight: "1px solid rgba(0,0,0,0.06)" }}>
                <div className="flex items-center gap-2 mb-1">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t} strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 12l2 2 4-4"/></svg>
                  <span className="text-xs font-bold" style={{ color: t }}>Creative Proposition</span>
                </div>
                <div className="h-[3px] w-2/3 rounded-full mb-4" style={{ backgroundColor: theme.accent }} />
                <h3 className="text-3xl md:text-4xl font-bold leading-[1.05] mb-4" style={{ color: t }}>
                  &ldquo;{safeStr(slide.creative_proposition)}&rdquo;
                </h3>
                {slide.proposition_description && (
                  <p className="text-sm leading-relaxed" style={{ color: m }}>{safeStr(slide.proposition_description)}</p>
                )}
              </div>
              {/* Right — Strategic Positioning (green card) */}
              <div className="col-span-7 p-6" style={{ backgroundColor: theme.accent }}>
                <h3 className="text-lg font-bold text-white mb-5">Strategic Positioning</h3>
                <div className="space-y-4">
                  {[
                    ["Brand Archetype", safeStr(slide.brand_archetype)],
                    ["Brand Role", safeStr(slide.brand_role)],
                  ].map(([label, val]) => val && (
                    <div key={label}>
                      <div className="flex items-center gap-2 mb-0.5">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-white/60">{label}</span>
                      </div>
                      <div className="h-[2px] w-full rounded-full mb-1" style={{ backgroundColor: "rgba(255,255,255,0.2)" }} />
                      <p className="text-sm font-medium text-white">{val}</p>
                    </div>
                  ))}
                  {/* Emotional + Rational side by side */}
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      ["Emotional Positioning", safeStr(slide.emotional_positioning)],
                      ["Rational Positioning", safeStr(slide.rational_positioning)],
                    ].map(([label, val]) => val && (
                      <div key={label}>
                        <div className="flex items-center gap-2 mb-0.5">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/></svg>
                          <span className="text-[9px] font-bold uppercase tracking-wider text-white/60">{label}</span>
                        </div>
                        <div className="h-[2px] w-full rounded-full mb-1" style={{ backgroundColor: "rgba(255,255,255,0.2)" }} />
                        <p className="text-sm text-white">{val}</p>
                      </div>
                    ))}
                  </div>
                  {slide.brand_territory && (
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-white/60">Brand Territory</span>
                      </div>
                      <div className="h-[2px] w-full rounded-full mb-1" style={{ backgroundColor: "rgba(255,255,255,0.2)" }} />
                      <p className="text-base font-semibold text-white">{safeStr(slide.brand_territory)}</p>
                    </div>
                  )}
                  {safeArr(slide.key_differentiators).length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 12l2 2 4-4"/></svg>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-white/60">Key Differentiators</span>
                      </div>
                      <div className="h-[2px] w-full rounded-full mb-1" style={{ backgroundColor: "rgba(255,255,255,0.2)" }} />
                      {safeArr(slide.key_differentiators).map((d, i) => (
                        <p key={i} className="text-sm flex gap-2 items-start text-white/90">
                          <span className="text-white/40">•</span> {d}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          <EntryStrip entries={slide.entries} />
        </div>
      );

    case "cs_hero_gallery": {
      const heroEntries = safeArr(slide.entries);
      const ytId = (u) => { if (!u) return null; const mx = u.match(/(?:youtube\.com\/watch\?.*v=|youtu\.be\/)([^&\s]+)/); return mx ? mx[1] : null; };
      return (
        <div className="animate-fadeIn -mx-4">
          <div className="flex items-center gap-4 mb-2 px-4">
            <h2 className="text-xl font-bold" style={{ color: theme.accent }}>{slide.title || "Brand Hero Content"}</h2>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: theme.accent, color: "#fff" }}>{heroEntries.length} pieces</span>
          </div>
          {slide.subtitle && <p className="text-sm mb-5 px-4" style={{ color: m }}>{slide.subtitle}</p>}
          {heroEntries.length <= 2 ? (
            /* 1-2 entries: side by side, large */
            <div className={`grid gap-4 ${heroEntries.length === 1 ? "grid-cols-1 max-w-2xl mx-auto" : "grid-cols-2"}`}>
              {heroEntries.map((e, i) => {
                const yt = ytId(e.url);
                const thumb = yt ? `https://img.youtube.com/vi/${yt}/hqdefault.jpg` : e.image_url;
                const isVideo = yt || (e.url && /vimeo/i.test(e.url));
                return (
                  <div key={i} className="bg-white rounded-2xl shadow-sm overflow-hidden cursor-pointer group/hero"
                    style={{ border: "1px solid rgba(0,0,0,0.04)" }}
                    onClick={() => { if (e.url) onMediaClick({ src: e.url, type: isVideo ? "Video" : "Image" }); else if (e.image_url) onMediaClick({ src: e.image_url, type: "Image" }); }}>
                    {thumb && (
                      <div className="relative overflow-hidden" style={{ maxHeight: "45vh" }}>
                        <img src={thumb} className="w-full h-full object-contain" alt="" />
                        {isVideo && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover/hero:bg-black/10 transition">
                            <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg"><svg width="16" height="16" viewBox="0 0 20 20" fill="#0a0a0a"><polygon points="6,3 17,10 6,17"/></svg></div>
                          </div>
                        )}
                      </div>
                    )}
                    <div className="p-4">
                      <p className="text-sm font-semibold leading-snug mb-1" style={{ color: t }}>{e.description || "—"}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {e.year && <span className="text-[10px]" style={{ color: f }}>{e.year}</span>}
                        {e.type && <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "rgba(0,0,0,0.05)", color: m }}>{e.type}</span>}
                        {e.rating && <span className="text-[10px]" style={{ color: "#D97706" }}>{"★".repeat(Number(e.rating))}</span>}
                      </div>
                      {e.main_slogan && <p className="text-xs italic mt-2" style={{ color: m, fontFamily: "Georgia, serif" }}>&ldquo;{e.main_slogan}&rdquo;</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* 3+ entries: grid of cards */
            <div className="grid grid-cols-3 gap-3">
              {heroEntries.map((e, i) => {
                const yt = ytId(e.url);
                const thumb = yt ? `https://img.youtube.com/vi/${yt}/mqdefault.jpg` : e.image_url;
                const isVideo = yt || (e.url && /vimeo/i.test(e.url));
                return (
                  <div key={i} className="bg-white rounded-xl shadow-sm overflow-hidden cursor-pointer group/hero"
                    style={{ border: "1px solid rgba(0,0,0,0.04)" }}
                    onClick={() => { if (e.url) onMediaClick({ src: e.url, type: isVideo ? "Video" : "Image" }); else if (e.image_url) onMediaClick({ src: e.image_url, type: "Image" }); }}>
                    {thumb && (
                      <div className="relative overflow-hidden" style={{ height: 160 }}>
                        <img src={thumb} className="w-full h-full object-cover" alt="" />
                        {isVideo && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover/hero:bg-black/10 transition">
                            <div className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center"><svg width="10" height="10" viewBox="0 0 20 20" fill="#0a0a0a"><polygon points="6,3 17,10 6,17"/></svg></div>
                          </div>
                        )}
                      </div>
                    )}
                    <div className="p-3">
                      <p className="text-xs font-semibold leading-snug truncate" style={{ color: t }}>{e.description || "—"}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        {e.year && <span className="text-[9px]" style={{ color: f }}>{e.year}</span>}
                        {e.rating && <span className="text-[9px]" style={{ color: "#D97706" }}>{"★".repeat(Number(e.rating))}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    case "cs_proof_points": {
      const secProofs = safeArr(slide.secondary_proofs);
      const toneVoice = safeArr(slide.tone_voice);
      return (
        <div className="animate-fadeIn -mx-4">
          <h2 className="text-xl font-bold mb-5 px-4" style={{ color: theme.accent }}>Proof Points and Communication Strategy</h2>
          <div className="bg-white rounded-2xl shadow-sm p-6" style={{ border: "1px solid rgba(0,0,0,0.04)" }}>
            {slide.creative_proposition && (
              <p className="text-4xl font-bold mb-6" style={{ color: t }}>
                &ldquo;{slide.creative_proposition}&rdquo;
              </p>
            )}
            <div className="grid grid-cols-4 gap-5">
              <div>
                <p className="text-xs font-bold mb-1" style={{ color: t }}>Primary Proof Points</p>
                <div className="h-[3px] w-full rounded-full mb-3" style={{ backgroundColor: theme.accent }} />
                <p className="text-sm leading-relaxed" style={{ color: t }}>{slide.primary_proof || ""}</p>
              </div>
              <div>
                <p className="text-xs font-bold mb-1" style={{ color: t }}>Secondary Proof Points</p>
                <div className="h-[3px] w-full rounded-full mb-3" style={{ backgroundColor: theme.accent }} />
                <div className="space-y-1">
                  {secProofs.map((sp, i) => (
                    <p key={i} className="text-sm" style={{ color: t }}><span className="font-bold">{i+1}.</span> {sp}</p>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-bold mb-1" style={{ color: t }}>Communication Focus</p>
                <div className="h-[3px] w-full rounded-full mb-3" style={{ backgroundColor: theme.accent }} />
                <p className="text-sm leading-relaxed" style={{ color: t }}>{slide.communication_focus || ""}</p>
              </div>
              <div>
                <p className="text-xs font-bold mb-1" style={{ color: t }}>Tone & Voice</p>
                <div className="h-[3px] w-full rounded-full mb-3" style={{ backgroundColor: theme.accent }} />
                <div className="space-y-1">
                  {toneVoice.map((tv, i) => (
                    <p key={i} className="text-xl font-bold" style={{ color: t }}>{tv}</p>
                  ))}
                </div>
              </div>
            </div>
            <EntryStrip entries={slide.entries} />
          </div>
        </div>
      );
    }

    case "cs_product": {
      const keyMsgs = safeArr(slide.key_messages);
      return (
        <div className="animate-fadeIn -mx-4">
          <h2 className="text-xl font-bold mb-5 px-4" style={{ color: theme.accent }}>Product Communication</h2>
          <div className="bg-white rounded-2xl shadow-sm p-6" style={{ border: "1px solid rgba(0,0,0,0.04)" }}>
            <div className="grid grid-cols-3 gap-5 mb-5">
              {[
                ["Approach", <p key="a" className="text-sm leading-relaxed" style={{ color: t }}>{slide.approach || ""}</p>],
                ["Key Product Messages", (
                  <div key="k" className="space-y-1">
                    {keyMsgs.map((km, i) => (
                      <p key={i} className="text-sm" style={{ color: t }}><span className="font-bold">{i+1}.</span> {km}</p>
                    ))}
                  </div>
                )],
                ["Channels & Formats", <p key="c" className="text-sm leading-relaxed" style={{ color: t }}>{slide.channels_formats || ""}</p>],
              ].map(([label, content], i) => (
                <div key={i}>
                  <p className="text-xs font-bold mb-1" style={{ color: t }}>{label}</p>
                  <div className="h-[3px] w-full rounded-full mb-3" style={{ backgroundColor: theme.accent }} />
                  {content}
                </div>
              ))}
            </div>
            {/* Gap — visually distinct */}
            <div className="p-4 rounded-xl border-l-4 flex items-start gap-3" style={{ borderColor: "#D97706", backgroundColor: "#FEF3C7" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" className="flex-shrink-0 mt-0.5">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <div>
                <p className="text-[10px] uppercase tracking-wider font-bold mb-1" style={{ color: "#92400E" }}>Gap — Untold Product Story</p>
                <p className="text-sm font-medium" style={{ color: "#78350F" }}>{slide.gap || ""}</p>
              </div>
            </div>
            <EntryStrip entries={slide.entries} />
          </div>
        </div>
      );
    }

    case "cs_beyond_banking":
      return (
        <div className="animate-fadeIn -mx-4">
          <h2 className="text-xl font-bold mb-5 px-4" style={{ color: theme.accent }}>Beyond Banking & Innovation</h2>
          <div className="bg-white rounded-2xl shadow-sm p-6" style={{ border: "1px solid rgba(0,0,0,0.04)" }}>
            <div className="grid grid-cols-2 gap-5 mb-5">
              {[
                ["Beyond Banking", slide.beyond_banking],
                ["Innovation", slide.innovation],
              ].map(([label, val], i) => (
                <div key={i}>
                  <p className="text-xs font-bold mb-1" style={{ color: t }}>{label}</p>
                  <div className="h-[3px] w-full rounded-full mb-3" style={{ backgroundColor: theme.accent }} />
                  <p className="text-sm leading-relaxed" style={{ color: t }}>{val}</p>
                </div>
              ))}
            </div>
            {/* White Space — visually distinct */}
            <div className="p-4 rounded-xl border-l-4 flex items-start gap-3" style={{ borderColor: KD.electric, backgroundColor: "#EEF2FF" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={KD.electric} strokeWidth="2" className="flex-shrink-0 mt-0.5">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
              <div>
                <p className="text-[10px] uppercase tracking-wider font-bold mb-1" style={{ color: KD.electric }}>White Space — Unclaimed Territory</p>
                <p className="text-sm font-medium" style={{ color: "#1e3a5f" }}>{slide.white_space}</p>
              </div>
            </div>
            <EntryStrip entries={slide.entries} />
          </div>
        </div>
      );

    case "cs_brand_assessment":
      return (
        <div className="animate-fadeIn -mx-4">
          <h2 className="text-xl font-bold mb-5 px-4" style={{ color: t }}>Brand Assessment</h2>
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: "1px solid rgba(0,0,0,0.04)" }}>
            <div className="grid grid-cols-2 min-h-[340px]">
              {/* Strengths */}
              <div className="p-6" style={{ borderRight: "1px solid rgba(0,0,0,0.06)" }}>
                <div className="flex items-center gap-2 mb-1">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1a1a2e" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
                  <span className="text-xs font-bold" style={{ color: t }}>Strengths</span>
                </div>
                <div className="h-[3px] w-2/3 rounded-full mb-5" style={{ backgroundColor: "#16A34A" }} />
                <div className="space-y-4">
                  {safeArr(slide.strengths).map((s, i) => (
                    <div key={i}>
                      <p className="text-sm flex gap-2 items-start" style={{ color: t }}>
                        <span className="mt-1">•</span>
                        <span><strong className="font-bold">{typeof s === "object" ? s.label : s}:</strong> {typeof s === "object" ? s.explanation : ""}</span>
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              {/* Weaknesses */}
              <div className="p-6">
                <div className="flex items-center gap-2 mb-1">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1a1a2e" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
                  <span className="text-xs font-bold" style={{ color: t }}>Weaknesses</span>
                </div>
                <div className="h-[3px] w-2/3 rounded-full mb-5" style={{ backgroundColor: "#EA580C" }} />
                <div className="space-y-4">
                  {safeArr(slide.weaknesses).map((w, i) => (
                    <div key={i}>
                      <p className="text-sm flex gap-2 items-start" style={{ color: t }}>
                        <span className="mt-1">•</span>
                        <span><strong className="font-bold">{typeof w === "object" ? w.label : w}:</strong> {typeof w === "object" ? w.explanation : ""}</span>
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      );

    case "cs_comm_assessment":
      return (
        <div className="animate-fadeIn -mx-4">
          <h2 className="text-xl font-bold mb-5 px-4" style={{ color: t }}>Communication Assessment</h2>
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: "1px solid rgba(0,0,0,0.04)" }}>
            <div className="grid grid-cols-2 min-h-[340px]">
              {/* Strengths */}
              <div className="p-6" style={{ borderRight: "1px solid rgba(0,0,0,0.06)" }}>
                <div className="flex items-center gap-2 mb-1">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1a1a2e" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
                  <span className="text-xs font-bold" style={{ color: t }}>Strengths</span>
                </div>
                <div className="h-[3px] w-2/3 rounded-full mb-5" style={{ backgroundColor: "#16A34A" }} />
                <div className="space-y-4">
                  {safeArr(slide.strengths).map((s, i) => (
                    <div key={i}>
                      <p className="text-sm flex gap-2 items-start" style={{ color: t }}>
                        <span className="mt-1">•</span>
                        <span><strong className="font-bold">{typeof s === "object" ? s.label : s}:</strong> {typeof s === "object" ? s.explanation : ""}</span>
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              {/* Weaknesses */}
              <div className="p-6">
                <div className="flex items-center gap-2 mb-1">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1a1a2e" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
                  <span className="text-xs font-bold" style={{ color: t }}>Weaknesses</span>
                </div>
                <div className="h-[3px] w-2/3 rounded-full mb-5" style={{ backgroundColor: "#EA580C" }} />
                <div className="space-y-4">
                  {safeArr(slide.weaknesses).map((w, i) => (
                    <div key={i}>
                      <p className="text-sm flex gap-2 items-start" style={{ color: t }}>
                        <span className="mt-1">•</span>
                        <span><strong className="font-bold">{typeof w === "object" ? w.label : w}:</strong> {typeof w === "object" ? w.explanation : ""}</span>
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      );

    case "cs_closing":
      return (
        <div className="py-8 flex flex-col items-center justify-center text-center animate-fadeIn">
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
          {slide.subtitle && <p className="text-sm max-w-md" style={{ color: m }}>{slide.subtitle}</p>}
          {slide.date && <p className="text-[10px] mt-4" style={{ color: f }}>{slide.date}</p>}
          <div className="mt-10 flex items-center gap-3">
            <div className="w-10 h-px" style={{ backgroundColor: t, opacity: 0.12 }} />
            <p className="text-[9px] uppercase tracking-[0.3em]" style={{ color: f }}>A Knots &amp; Dots product</p>
            <div className="w-10 h-px" style={{ backgroundColor: t, opacity: 0.12 }} />
          </div>
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
  } } catch (err) {
    console.error("Slide render error:", err, slide);
    return (
      <div className="animate-fadeIn text-center py-8">
        <p className="text-lg font-bold mb-2" style={{ color: t }}>{slide.title || slide.type || "Slide"}</p>
        <p className="text-sm" style={{ color: m }}>This slide could not be rendered. Try editing it or regenerating the showcase.</p>
        <p className="text-[10px] mt-2" style={{ color: f }}>Error: {err.message}</p>
      </div>
    );
  }
}
