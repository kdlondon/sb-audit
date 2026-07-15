"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { useProject } from "@/lib/project-context";
import { useRole } from "@/lib/role-context";
import AuthGuard from "@/components/AuthGuard";
import CountryInput from "@/components/CountryInput";
import BrandDnaRunner from "@/components/BrandDnaRunner";

const OBJECTIVES = [
  "Competitive positioning & messaging", "Identify white spaces / opportunities",
  "Creative inspiration & benchmarking", "Innovation scan", "Brand consistency audit",
  "Category landscape map", "Tone & territory analysis",
];
const CATEGORIES = ["Banking & Financial Services", "Insurance", "Fintech", "Retail", "E-commerce", "Telecommunications", "Technology", "Software / SaaS", "Automotive", "Food & Beverage", "Consumer Goods (CPG)", "Healthcare", "Pharmaceuticals", "Travel & Hospitality", "Airlines", "Energy & Utilities", "Real Estate", "Education", "Media & Entertainment", "Fashion & Apparel", "Beauty & Cosmetics", "Sports", "Government / Public Sector", "Non-profit", "Other"];
const SUGGEST_MODEL = "claude-sonnet-4-6";
const DEFAULT_INTENTS = ["Brand Hero", "Brand Tactical", "Client Testimonials", "Product", "Innovation"];
const DEFAULT_DIMS = ["archetype", "tone", "execution", "funnel", "rating"];
// Project language — EVERY AI call (profiles, analysis, reports) writes in it; foreign-language
// sources get translated into it. Asked at the very start of the assistant.
const LANGUAGES = ["Español", "English", "Português", "Français", "Deutsch", "Italiano"];

// Live Brand-DNA progress on the done screen: polls project_brands and shows a bar +
// per-brand status chips. Generation itself runs in BrandDnaRunner (mounted below),
// so navigating away is safe — the queue resumes anywhere.
function DnaProgress({ projectId }) {
  const supabase = createClient();
  const [rows, setRows] = useState([]);
  useEffect(() => {
    if (!projectId) return;
    let alive = true;
    const poll = async () => {
      try {
        const { data } = await supabase.from("project_brands").select("name,website,brand_dna_status").eq("project_id", projectId).eq("archived", false).not("website", "is", null).order("sort_order");
        if (alive) setRows((data || []).filter(r => r.website));
      } catch {}
    };
    poll();
    const t = setInterval(poll, 3000);
    return () => { alive = false; clearInterval(t); };
  }, [projectId]);
  if (!rows.length) return null;
  const done = rows.filter(r => r.brand_dna_status === "generated" || r.brand_dna_status === "failed").length;
  const pct = Math.round((done / rows.length) * 100);
  const finished = done === rows.length;
  return (
    <div className="text-left bg-surface border border-main rounded-xl p-4 mb-6">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-main">{finished ? "Brand profiles ready" : "Generating brand profiles…"}</span>
        <span className="text-[10px] text-hint font-mono">{done}/{rows.length}</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden mb-3" style={{ background: "var(--surface2)" }}>
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: "var(--accent)" }} />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {rows.map(r => (
          <span key={r.name} className={`text-[10px] px-2 py-0.5 rounded-full border ${r.brand_dna_status === "generated" ? "border-green-200 bg-green-50 text-green-700" : r.brand_dna_status === "failed" ? "border-red-200 bg-red-50 text-red-500" : r.brand_dna_status === "generating" ? "border-[var(--accent)] text-accent animate-pulse" : "border-main text-hint"}`}>
            {r.brand_dna_status === "generated" ? "✓ " : r.brand_dna_status === "failed" ? "✕ " : ""}{r.name}
          </span>
        ))}
      </div>
      {rows.some(r => r.brand_dna_status === "failed") && <p className="text-[10px] text-hint mt-2">✕ = the website couldn't be crawled — fix the URL in Settings → Landscape and it will retry automatically.</p>}
    </div>
  );
}

function AIBubble({ children }) {
  return (
    <div className="flex gap-3 items-start">
      <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-white" style={{ background: "var(--accent)" }}>G</div>
      <div className="bg-surface border border-main rounded-2xl rounded-tl-md px-4 py-3 max-w-[560px] text-sm text-main leading-relaxed whitespace-pre-line">{children}</div>
    </div>
  );
}
function UserBubble({ children }) {
  return <div className="flex justify-end"><div className="rounded-2xl rounded-tr-md px-4 py-3 max-w-[420px] text-sm text-main" style={{ background: "var(--accent-soft)" }}>{children}</div></div>;
}
const inputCls = "w-full px-3.5 py-2.5 bg-surface border border-main rounded-xl text-sm text-main focus:outline-none focus:border-[var(--accent)]";

function OnboardingContent() {
  const router = useRouter();
  const supabase = createClient();
  const { selectProject } = useProject() || {};
  const { activeOrg } = useRole() || {};

  const scrollRef = useRef(null);
  const [msgs, setMsgs] = useState([]);
  const [phase, setPhase] = useState("client");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  // data
  const [clients, setClients] = useState([]);
  const [clientMode, setClientMode] = useState("existing");
  const [clientId, setClientId] = useState("");
  const [clientName, setClientName] = useState("");
  const [bp, setBp] = useState({ name: "", market: "", category: "" });
  const [language, setLanguage] = useState("");
  const [createdProjectId, setCreatedProjectId] = useState(null);
  const [objectives, setObjectives] = useState([]);
  const [profile, setProfile] = useState({ positioning: "", differentiator: "", audience: "" });
  const [localComps, setLocalComps] = useState([]);
  const [globalRefs, setGlobalRefs] = useState([]);
  // Digital presence per participating brand: [{name, role, website, instagram, tiktok, youtube}]
  const [brandLinks, setBrandLinks] = useState([]);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [dnaCount, setDnaCount] = useState(0);
  const [warnings, setWarnings] = useState([]);

  const addAI = (text) => setMsgs(m => [...m, { role: "ai", text }]);
  const addUser = (text) => setMsgs(m => [...m, { role: "user", text }]);
  // Show a brief "typing" indicator before the assistant's next message.
  const askAI = async (text) => { setBusy(true); await new Promise(r => setTimeout(r, 650)); setBusy(false); addAI(text); };

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [msgs, phase, busy]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("clients").select("id, name, organization_id").order("name");
      setClients(data || []);
      if (activeOrg?.type === "client") {
        const own = (data || []).find(c => c.organization_id === activeOrg.id);
        if (own) { setClientMode("existing"); setClientId(own.id); setClientName(own.name); }
      }
    })();
    addAI("Hi! I'm your study setup assistant. Let's create a competitive intelligence project.\n\nFirst — which client is this study for?");
  }, []);

  /* ── AI suggestions ── */
  const fetchLocal = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/suggest-competitors", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ brand_name: bp.name, industry: bp.category, market: bp.market, type: "local", model: SUGGEST_MODEL }) });
      const d = await res.json();
      const s = Array.isArray(d.suggestions) ? d.suggestions : [];
      setLocalComps(s.map(x => ({ name: x.name, proximity: x.type || "direct", selected: true })));
      addAI(s.length ? `Here are ${s.length} local competitors I found. Toggle any off, or add your own, then continue.` : "I couldn't find competitors automatically — add them manually below.");
    } catch { addAI("Couldn't reach the AI — add competitors manually below."); }
    setBusy(false);
  };
  const fetchGlobal = async () => {
    setBusy(true);
    try {
      const exclude = [bp.name, ...localComps.map(c => c.name)].filter(Boolean).join(", ");
      const res = await fetch("/api/suggest-competitors", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ brand_name: bp.name, industry: bp.category, type: "global", exclude, model: SUGGEST_MODEL }) });
      const d = await res.json();
      const s = Array.isArray(d.suggestions) ? d.suggestions : [];
      setGlobalRefs(s.map(x => ({ name: x.name, country: x.country || "", selected: true })));
      addAI(s.length ? `And ${s.length} global references worth benchmarking. Adjust and continue.` : "No global references found — add them manually below.");
    } catch { addAI("Couldn't reach the AI — add references manually below."); }
    setBusy(false);
  };

  /* ── Digital presence: identify each brand's website + socials (replaces the old
        YouTube seed-content scout). These links feed the Brand DNA auto-crawl. ── */
  const runLinks = async () => {
    const all = [
      ...(bp.name ? [{ name: bp.name, role: "principal" }] : []),
      ...localComps.filter(c => c.selected).map(c => ({ name: c.name, role: /adjacent/i.test(c.proximity || "") ? "adjacent" : "direct" })),
      ...globalRefs.filter(g => g.selected).map(g => ({ name: g.name, role: "global", country: g.country || "" })),
    ];
    if (!all.length) { addAI("No brands selected — ready to create?"); setPhase("create"); return; }
    setBusy(true);
    addAI(`Looking up each brand's website and social channels (Instagram, TikTok, YouTube) for ${all.length} brands…`);
    let links = [];
    try {
      const res = await fetch("/api/brand-links", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ brands: all.map(b => ({ name: b.name })), market: bp.market, industry: bp.category }) });
      const d = await res.json();
      links = Array.isArray(d.links) ? d.links : [];
    } catch {}
    const byName = {}; links.forEach(l => { byName[l.name.toLowerCase()] = l; });
    setBrandLinks(all.map(b => { const l = byName[b.name.toLowerCase()] || {}; return { ...b, website: l.website || "", instagram: l.instagram || "", tiktok: l.tiktok || "", youtube: l.youtube || "" }; }));
    setBusy(false);
    addAI("Here's what I could VERIFY — each link was checked against the live site, so empty fields mean I couldn't confirm an official one (better empty than wrong). Fill in what you know, then create the study; brand profiles will generate in the background from each website.");
    setPhase("create");
  };
  const setLink = (i, key, v) => setBrandLinks(p => p.map((b, j) => j === i ? { ...b, [key]: v } : b));

  /* ── Save ── */
  const finalize = async () => {
    setSaving(true);
    const warn = [];
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Session expired — please log in again.");
      const email = session.user.email;
      const orgId = activeOrg?.id || null;

      let finalClientId = clientId;
      let finalClientName = clientName;
      if (clientMode === "new") {
        const slug = clientName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") + "-" + String(Date.now()).slice(-5);
        const { data: org, error: oe } = await supabase.from("organizations").insert({ name: clientName.trim(), slug, type: "client", plan: "standard", status: "active" }).select().single();
        if (oe || !org) throw new Error(`Couldn't create the client: ${oe?.message || "unknown"}`);
        const { data: cl, error: ce } = await supabase.from("clients").insert({ name: clientName.trim(), slug, organization_id: org.id, status: "active" }).select().single();
        if (ce || !cl) throw new Error(`Couldn't create the client record: ${ce?.message || "unknown"}`);
        finalClientId = cl.id; finalClientName = clientName.trim();
      }

      const projectId = "proj_" + Date.now();
      const projectName = bp.name ? `${bp.name} Competitive Audit` : "New Audit";
      const selLocal = localComps.filter(c => c.selected), selGlobal = globalRefs.filter(g => g.selected);

      const { error: pErr } = await supabase.from("projects").insert({ id: projectId, name: projectName, client_id: finalClientId, organization_id: orgId, created_by: email, description: [bp.category, bp.market && `Market: ${bp.market}`, profile.positioning].filter(Boolean).join(" · ") });
      if (pErr) throw new Error(`Couldn't create the project: ${pErr.message}`);

      const linkOf = (name) => brandLinks.find(b => b.name.toLowerCase() === name.toLowerCase()) || {};
      const { error: fErr } = await supabase.from("project_frameworks").insert({
        project_id: projectId, name: `${bp.name} Framework`, tier: "essential",
        brand_name: bp.name, brand_positioning: profile.positioning || "", brand_differentiator: profile.differentiator || "", brand_audience: profile.audience || "", brand_description: "",
        industry: bp.category || "", primary_market: bp.market || "", language: language || "English", objectives,
        communication_intents: DEFAULT_INTENTS, standard_dimensions: DEFAULT_DIMS, brand_categories: ["Leader", "Challenger", "Niche", "Emerging", "Other"],
        local_competitors: selLocal.map(c => ({ name: c.name, type: c.proximity || "direct", website: linkOf(c.name).website ? [linkOf(c.name).website] : undefined })),
        global_benchmarks: selGlobal.map(g => ({ name: g.name, country: g.country || "", website: linkOf(g.name).website ? [linkOf(g.name).website] : undefined })),
      });
      if (fErr) throw new Error(`Project created but its framework couldn't be saved: ${fErr.message}`);

      // Normalized registry (project_brands) — the Competitive Landscape source of truth.
      const socialOf = (l) => Object.fromEntries(Object.entries({ instagram: l.instagram, tiktok: l.tiktok, youtube: l.youtube }).filter(([, v]) => v && v.trim()));
      const pbRows = [
        ...(bp.name ? [{ name: bp.name, role: "principal" }] : []),
        ...selLocal.map((c, i) => ({ name: c.name, role: /adjacent/i.test(c.proximity || "") ? "adjacent" : "direct", sort_order: i })),
        ...selGlobal.map((g, i) => ({ name: g.name, role: "global", country: g.country || null, sort_order: i })),
      ].map(r => { const l = linkOf(r.name); return { ...r, project_id: projectId, website: (l.website || "").trim() || null, social: socialOf(l) }; });
      const { data: pbInserted, error: pbErr } = await supabase.from("project_brands").insert(pbRows).select("id,name,website");
      if (pbErr) warn.push(`brand registry (${pbErr.message})`);

      // Brand DNA generation is handled by the global background queue (BrandDnaRunner —
      // mounted on the done screen AND in Nav): rows stay "pending" and the runner picks
      // them up immediately; resumable after interruptions.
      setDnaCount((pbInserted || []).filter(r => r.website).length);
      setCreatedProjectId(projectId);

      const { error: aErr } = await supabase.from("project_access").insert({ user_id: session.user.id, email, project_id: projectId });
      if (aErr) warn.push(`access (${aErr.message})`);

      const defaults = [
        ...DEFAULT_INTENTS.map((v, i) => ({ category: "communicationIntent", value: v, sort_order: i })),
        ...["Innocent", "Explorer", "Sage", "Hero", "Outlaw", "Magician", "Regular Guy", "Lover", "Jester", "Caregiver", "Creator", "Ruler"].map((v, i) => ({ category: "brandArchetype", value: v, sort_order: i })),
        ...["Awareness", "Consideration", "Conversion", "Retention", "Advocacy"].map((v, i) => ({ category: "funnel", value: v, sort_order: i })),
        ...["Video", "Print", "Digital", "Social", "OOH", "Website", "Blog", "Event"].map((v, i) => ({ category: "type", value: v, sort_order: i })),
        ...selLocal.map((c, i) => ({ category: "competitor", value: c.name, sort_order: i })),
      ];
      const { error: dErr } = await supabase.from("dropdown_options").insert(defaults.map(d => ({ ...d, project_id: projectId })));
      if (dErr) warn.push(`dropdowns (${dErr.message})`);

      selectProject?.(projectId, projectName);
      try { localStorage.setItem("sb-project-id", projectId); localStorage.setItem("sb-project-name", projectName); localStorage.setItem("sb-client-name", finalClientName); } catch {}
      setWarnings(warn); setDone(true); setSaving(false);
    } catch (err) { addAI(`⚠️ ${err.message}`); setSaving(false); }
  };

  /* ── Phase handlers ── */
  const submitClient = () => {
    if (clientMode === "existing") { const c = clients.find(x => x.id === clientId); if (!c) return; setClientName(c.name); addUser(c.name); }
    else { if (!clientName.trim()) return; addUser(`${clientName.trim()} (new client)`); }
    setPhase("language"); askAI("Which language should this project work in? Every AI analysis, brand profile and report will be written in it — content in other languages gets translated.");
  };
  const submitLanguage = (lang) => {
    setLanguage(lang); addUser(lang);
    setPhase("brand"); askAI("Got it. What's the focus brand we'll be auditing?");
  };
  const submitText = (val, next, q) => { if (!val.trim()) return; addUser(val.trim()); setInput(""); setPhase(next); if (q) askAI(q); };

  const toggleObj = (o) => setObjectives(p => p.includes(o) ? p.filter(x => x !== o) : [...p, o]);
  const toggleLocal = (i) => setLocalComps(p => p.map((c, j) => j === i ? { ...c, selected: !c.selected } : c));
  const toggleGlobal = (i) => setGlobalRefs(p => p.map((g, j) => j === i ? { ...g, selected: !g.selected } : g));

  if (done) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
        <div className="max-w-md text-center px-6">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-accent flex items-center justify-center text-white text-xl">✓</div>
          <h1 className="text-xl font-bold text-main mb-2">Project created</h1>
          {warnings.length > 0 && <p className="text-xs text-amber-600 mb-3">Some extras didn't save: {warnings.join("; ")}.</p>}
          <p className="text-sm text-muted mb-4">{dnaCount > 0 ? "Brand profiles are generating in the background — you can keep working anywhere; the queue continues and resumes on its own." : "Add each brand's website in Settings → Landscape to generate its Brand DNA profile."}</p>
          <DnaProgress projectId={createdProjectId} />
          <div className="flex gap-2 justify-center">
            <button onClick={() => router.push("/intelligence?tab=brands")} className="px-5 py-2.5 bg-accent text-white rounded-lg text-sm font-semibold hover:opacity-90">View brand profiles</button>
            <button onClick={() => router.push("/audit")} className="px-5 py-2.5 border border-main rounded-lg text-sm text-main hover:bg-surface2">Go to the project</button>
          </div>
          {/* The queue runner itself — starts generating right here on the done screen */}
          <BrandDnaRunner />
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col" style={{ background: "var(--bg)" }}>
      <div className="px-5 py-3 flex justify-between items-center flex-shrink-0" style={{ background: "#0a0f3c" }}>
        <div className="flex items-center gap-3"><img src="/knots-dots-logo.png" alt="K&D" style={{ height: 22 }} /><p className="text-sm font-semibold text-white">New project</p></div>
        <button onClick={() => router.push("/dashboard")} className="text-[11px] text-white/25 hover:text-white/50">Cancel</button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-auto px-5 py-6 space-y-4 max-w-3xl w-full mx-auto">
        {msgs.map((m, i) => m.role === "ai" ? <AIBubble key={i}>{m.text}</AIBubble> : <UserBubble key={i}>{m.text}</UserBubble>)}
        {busy && <AIBubble>…</AIBubble>}

        {/* interactive panels per phase */}
        {phase === "objectives" && !busy && (
          <div className="pl-10 flex flex-wrap gap-2">
            {OBJECTIVES.map(o => <button key={o} onClick={() => toggleObj(o)} className={`px-3 py-1.5 rounded-full text-xs border ${objectives.includes(o) ? "border-[var(--accent)] text-main bg-[var(--accent-soft)]" : "border-main text-muted"}`}>{objectives.includes(o) && "✓ "}{o}</button>)}
          </div>
        )}
        {phase === "local" && localComps.length > 0 && !busy && (
          <div className="pl-10 flex flex-wrap gap-2">
            {localComps.map((c, i) => <button key={i} onClick={() => toggleLocal(i)} className={`px-3 py-1.5 rounded-full text-xs border ${c.selected ? "border-[var(--accent)] text-main bg-[var(--accent-soft)]" : "border-main text-muted"}`}>{c.selected && "✓ "}{c.name}</button>)}
          </div>
        )}
        {phase === "global" && globalRefs.length > 0 && !busy && (
          <div className="pl-10 flex flex-wrap gap-2">
            {globalRefs.map((g, i) => <button key={i} onClick={() => toggleGlobal(i)} className={`px-3 py-1.5 rounded-full text-xs border ${g.selected ? "border-[var(--accent)] text-main bg-[var(--accent-soft)]" : "border-main text-muted"}`}>{g.selected && "✓ "}{g.name}{g.country ? ` (${g.country})` : ""}</button>)}
          </div>
        )}
        {phase === "create" && brandLinks.length > 0 && (
          <div className="pl-10 space-y-2">
            {brandLinks.map((b, i) => (
              <div key={i} className="p-3 border border-main rounded-lg bg-surface">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold text-main">{b.name}</span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${b.role === "principal" ? "text-white bg-[var(--accent)]" : b.role === "global" ? "bg-teal-50 text-teal-600 border border-teal-200" : "bg-surface2 text-hint"}`}>{b.role}</span>
                  {!b.website && <span className="text-[9px] text-amber-600">no website — Brand DNA will be skipped</span>}
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <input value={b.website} onChange={e => setLink(i, "website", e.target.value)} placeholder="Website (drives the brand profile)" className="px-2.5 py-1.5 bg-surface2 border border-main rounded-lg text-[11px] text-main focus:outline-none focus:border-[var(--accent)]" />
                  <input value={b.instagram} onChange={e => setLink(i, "instagram", e.target.value)} placeholder="Instagram" className="px-2.5 py-1.5 bg-surface2 border border-main rounded-lg text-[11px] text-main focus:outline-none focus:border-[var(--accent)]" />
                  <input value={b.tiktok} onChange={e => setLink(i, "tiktok", e.target.value)} placeholder="TikTok" className="px-2.5 py-1.5 bg-surface2 border border-main rounded-lg text-[11px] text-main focus:outline-none focus:border-[var(--accent)]" />
                  <input value={b.youtube} onChange={e => setLink(i, "youtube", e.target.value)} placeholder="YouTube" className="px-2.5 py-1.5 bg-surface2 border border-main rounded-lg text-[11px] text-main focus:outline-none focus:border-[var(--accent)]" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* input area */}
      <div className="border-t border-main bg-surface px-5 py-3 flex-shrink-0">
        <div className="max-w-3xl mx-auto flex gap-2 items-center">
          {phase === "client" && (
            <>
              {!clientId || clientMode === "new" ? null : null}
              <div className="flex gap-2 flex-1">
                <select value={clientMode === "new" ? "__new__" : clientId} onChange={e => { if (e.target.value === "__new__") { setClientMode("new"); setClientId(""); } else { setClientMode("existing"); setClientId(e.target.value); } }} className={inputCls}>
                  <option value="">Select a client…</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  <option value="__new__">+ New client…</option>
                </select>
                {clientMode === "new" && <input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="New client name" className={inputCls} />}
              </div>
              <button onClick={submitClient} disabled={clientMode === "existing" ? !clientId : !clientName.trim()} className="px-4 py-2.5 bg-accent text-white rounded-xl text-xs font-bold disabled:opacity-40">Send</button>
            </>
          )}
          {phase === "language" && (
            <div className="flex-1 flex gap-2 items-center flex-wrap">
              {LANGUAGES.map(l => <button key={l} onClick={() => submitLanguage(l)} className="px-4 py-2 rounded-full text-xs font-medium border border-main text-main hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] transition">{l}</button>)}
              <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && input.trim()) { submitLanguage(input.trim()); setInput(""); } }} placeholder="Other language…" className="px-3.5 py-2 bg-surface border border-main rounded-full text-xs text-main focus:outline-none focus:border-[var(--accent)] w-[160px]" />
            </div>
          )}
          {phase === "brand" && <TextSend value={input} setValue={setInput} placeholder="Focus brand (e.g. Scotiabank)" onSend={() => { setBp(b => ({ ...b, name: input.trim() })); submitText(input, "market", "Which is the primary market?"); }} />}
          {phase === "market" && (
            <>
              <div className="flex-1"><CountryInput value={bp.market} onChange={v => setBp(b => ({ ...b, market: v }))} placeholder="Primary market" dropUp className={inputCls} /></div>
              <button onClick={() => { if (!bp.market.trim()) return; addUser(bp.market); setPhase("category"); askAI("What category or industry are they in?"); }} className="px-4 py-2.5 bg-accent text-white rounded-xl text-xs font-bold">Send</button>
            </>
          )}
          {phase === "category" && (
            <>
              <div className="flex-1"><CountryInput value={bp.category} onChange={v => setBp(b => ({ ...b, category: v }))} options={CATEGORIES} dropUp className={inputCls} placeholder="Category / industry" /></div>
              <button onClick={() => { if (!bp.category.trim()) return; addUser(bp.category); setPhase("objectives"); askAI("What are the objectives of this study? (pick any)"); }} className="px-4 py-2.5 bg-accent text-white rounded-xl text-xs font-bold">Send</button>
            </>
          )}
          {phase === "objectives" && <button onClick={() => { addUser(objectives.length ? objectives.join(", ") : "Skip"); setPhase("vp"); askAI("Now the part only you know — what's the value proposition / positioning?"); }} className="ml-auto px-5 py-2.5 bg-accent text-white rounded-xl text-xs font-bold">Continue</button>}
          {phase === "vp" && <TextSend value={input} setValue={setInput} placeholder="Value proposition / positioning" onSend={() => { setProfile(p => ({ ...p, positioning: input.trim() })); submitText(input, "diff", "And the key differentiator?"); }} />}
          {phase === "diff" && <TextSend value={input} setValue={setInput} placeholder="Key differentiator" onSend={() => { setProfile(p => ({ ...p, differentiator: input.trim() })); submitText(input, "audience", "Briefly, who's the target audience?"); }} />}
          {phase === "audience" && <TextSend value={input} setValue={setInput} placeholder="Audience summary" onSend={() => { setProfile(p => ({ ...p, audience: input.trim() })); addUser(input.trim()); setInput(""); setPhase("local"); fetchLocal(); }} />}
          {phase === "local" && (
            <>
              <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && input.trim()) { setLocalComps(p => [...p, { name: input.trim(), proximity: "direct", selected: true }]); setInput(""); } }} placeholder="Add a competitor" className={inputCls} />
              <button onClick={() => { if (input.trim()) { setLocalComps(p => [...p, { name: input.trim(), proximity: "direct", selected: true }]); setInput(""); } }} className="px-3 py-2.5 border border-main rounded-xl text-xs text-muted">Add</button>
              <button onClick={() => { addUser(`${localComps.filter(c => c.selected).length} local competitors`); setPhase("global"); fetchGlobal(); }} className="px-4 py-2.5 bg-accent text-white rounded-xl text-xs font-bold whitespace-nowrap">Continue</button>
            </>
          )}
          {phase === "global" && (
            <>
              <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && input.trim()) { setGlobalRefs(p => [...p, { name: input.trim(), country: "", selected: true }]); setInput(""); } }} placeholder="Add a reference" className={inputCls} />
              <button onClick={() => { if (input.trim()) { setGlobalRefs(p => [...p, { name: input.trim(), country: "", selected: true }]); setInput(""); } }} className="px-3 py-2.5 border border-main rounded-xl text-xs text-muted">Add</button>
              <button onClick={() => { addUser(`${globalRefs.filter(g => g.selected).length} global references`); runLinks(); }} className="px-4 py-2.5 bg-accent text-white rounded-xl text-xs font-bold whitespace-nowrap">Continue</button>
            </>
          )}
          {phase === "create" && <button onClick={finalize} disabled={saving || busy} className="ml-auto px-5 py-2.5 bg-accent text-white rounded-xl text-xs font-bold disabled:opacity-40">{saving ? "Creating…" : "Create study"}</button>}
        </div>
      </div>

    </div>
  );
}

function TextSend({ value, setValue, placeholder, onSend }) {
  return (
    <>
      <input value={value} onChange={e => setValue(e.target.value)} onKeyDown={e => { if (e.key === "Enter") onSend(); }} placeholder={placeholder} autoFocus className={inputCls} />
      <button onClick={onSend} disabled={!value.trim()} className="px-4 py-2.5 bg-accent text-white rounded-xl text-xs font-bold disabled:opacity-40">Send</button>
    </>
  );
}

export default function OnboardingPage() {
  return <AuthGuard><OnboardingContent /></AuthGuard>;
}
