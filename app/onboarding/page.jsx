"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { useProject } from "@/lib/project-context";
import { useRole } from "@/lib/role-context";
import AuthGuard from "@/components/AuthGuard";
import CountryInput from "@/components/CountryInput";

const OBJECTIVES = [
  "Competitive positioning & messaging", "Identify white spaces / opportunities",
  "Creative inspiration & benchmarking", "Innovation scan", "Brand consistency audit",
  "Category landscape map", "Tone & territory analysis",
];
const CATEGORIES = ["Banking & Financial Services", "Insurance", "Fintech", "Retail", "E-commerce", "Telecommunications", "Technology", "Software / SaaS", "Automotive", "Food & Beverage", "Consumer Goods (CPG)", "Healthcare", "Pharmaceuticals", "Travel & Hospitality", "Airlines", "Energy & Utilities", "Real Estate", "Education", "Media & Entertainment", "Fashion & Apparel", "Beauty & Cosmetics", "Sports", "Government / Public Sector", "Non-profit", "Other"];
const SUGGEST_MODEL = "claude-sonnet-4-6";
const DEFAULT_INTENTS = ["Brand Hero", "Brand Tactical", "Client Testimonials", "Product", "Innovation"];
const DEFAULT_DIMS = ["archetype", "tone", "execution", "funnel", "rating"];

const fmtDur = (iso) => { if (!iso) return ""; const m = String(iso).match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/); if (!m) return ""; const h = +(m[1] || 0), mi = +(m[2] || 0), s = +(m[3] || 0); return h > 0 ? `${h}:${String(mi).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${mi}:${String(s).padStart(2, "0")}`; };

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
  const [objectives, setObjectives] = useState([]);
  const [profile, setProfile] = useState({ positioning: "", differentiator: "", audience: "" });
  const [localComps, setLocalComps] = useState([]);
  const [globalRefs, setGlobalRefs] = useState([]);
  const [scoutResults, setScoutResults] = useState([]); // [{brandName, scope, video}]
  const [acceptedVids, setAcceptedVids] = useState([]);
  const [lightbox, setLightbox] = useState(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
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

  /* ── Scout (search + AI rank, like the Scout module) ── */
  const runScout = async () => {
    const all = [...localComps.filter(c => c.selected).slice(0, 7).map(c => ({ name: c.name, scope: "local" })), ...globalRefs.filter(g => g.selected).slice(0, 3).map(g => ({ name: g.name, scope: "global" }))];
    if (!all.length) { addAI("No brands selected — you can add content later in Audit. Ready to create?"); setPhase("create"); return; }
    setBusy(true);
    addAI(`Scouting one hero ad per brand (official, last year, 30–90s) for ${all.length} brands…`);
    const cutoff = new Date(Date.now() - 365 * 86400000).toISOString();
    const results = [];
    await Promise.all(all.map(async (brand) => {
      try {
        const sr = await fetch("/api/youtube-scout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "search", query: `${brand.name} ad commercial`, maxResults: 30, finalLimit: 8, publishedAfter: cutoff, contentType: "official", minSeconds: 30, maxSeconds: 90 }) });
        const sd = await sr.json();
        // Backstop the duration filter (30–90s) in case the API returns longer pieces
        let vids = (sd.videos || []).filter(v => !v.durationSeconds || (v.durationSeconds >= 30 && v.durationSeconds <= 90));
        if (vids.length) {
          try {
            const rr = await fetch("/api/youtube-scout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "rank", brand: brand.name, keywords: brand.name, market: bp.market, videos: vids, model: "claude-opus-4-8" }) });
            const rd = await rr.json();
            if (Array.isArray(rd.videos) && rd.videos.length) vids = rd.videos.filter(v => !v.durationSeconds || (v.durationSeconds >= 30 && v.durationSeconds <= 90));
          } catch {}
        }
        const best = vids[0];
        if (best) results.push({ brandName: brand.name, scope: brand.scope, video: best });
      } catch {}
    }));
    setScoutResults(results);
    setBusy(false);
    addAI(results.length ? "Done. Accept or skip each piece, then create the study." : "No good content found — you can add entries later in Audit. Ready to create?");
    setPhase("create");
  };

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

      const { error: fErr } = await supabase.from("project_frameworks").insert({
        project_id: projectId, name: `${bp.name} Framework`, tier: "essential",
        brand_name: bp.name, brand_positioning: profile.positioning || "", brand_differentiator: profile.differentiator || "", brand_audience: profile.audience || "", brand_description: "",
        industry: bp.category || "", primary_market: bp.market || "", language: "English", objectives,
        communication_intents: DEFAULT_INTENTS, standard_dimensions: DEFAULT_DIMS, brand_categories: ["Leader", "Challenger", "Niche", "Emerging", "Other"],
        local_competitors: selLocal.map(c => ({ name: c.name, type: c.proximity || "direct" })), global_benchmarks: selGlobal.map(g => ({ name: g.name, country: g.country || "" })),
      });
      if (fErr) throw new Error(`Project created but its framework couldn't be saved: ${fErr.message}`);

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

      let imported = 0;
      for (let i = 0; i < acceptedVids.length; i++) {
        const v = acceptedVids[i];
        const entry = { id: String(Date.now()) + "_" + i, project_id: projectId, created_by: email, updated_at: new Date().toISOString(), url: `https://www.youtube.com/watch?v=${v.videoId}`, image_url: v.thumbnail || "", description: v.title || "", year: v.year || (v.publishedAt ? String(v.publishedAt).slice(0, 4) : ""), type: "Video", synopsis: v.description || "", scope: v.scope || "local", brand_name: v.brandName || "" };
        if (v.scope === "global") entry.brand = v.brandName; else entry.competitor = v.brandName;
        const { error: eErr } = await supabase.from("creative_source").insert(entry);
        if (eErr) warn.push(`video "${(v.title || "").slice(0, 30)}" (${eErr.message})`); else imported++;
      }

      selectProject?.(projectId, projectName);
      try { localStorage.setItem("sb-project-id", projectId); localStorage.setItem("sb-project-name", projectName); localStorage.setItem("sb-client-name", finalClientName); } catch {}
      setWarnings(warn); setDone(true); setSaving(false);
    } catch (err) { addAI(`⚠️ ${err.message}`); setSaving(false); }
  };

  /* ── Phase handlers ── */
  const submitClient = () => {
    if (clientMode === "existing") { const c = clients.find(x => x.id === clientId); if (!c) return; setClientName(c.name); addUser(c.name); }
    else { if (!clientName.trim()) return; addUser(`${clientName.trim()} (new client)`); }
    setPhase("brand"); askAI("Got it. What's the focus brand we'll be auditing?");
  };
  const submitText = (val, next, q) => { if (!val.trim()) return; addUser(val.trim()); setInput(""); setPhase(next); if (q) askAI(q); };

  const toggleObj = (o) => setObjectives(p => p.includes(o) ? p.filter(x => x !== o) : [...p, o]);
  const toggleLocal = (i) => setLocalComps(p => p.map((c, j) => j === i ? { ...c, selected: !c.selected } : c));
  const toggleGlobal = (i) => setGlobalRefs(p => p.map((g, j) => j === i ? { ...g, selected: !g.selected } : g));
  const accept = (r) => setAcceptedVids(a => [...a.filter(x => x.videoId !== r.video.videoId), { ...r.video, brandName: r.brandName, scope: r.scope }]);
  const skip = (r) => setAcceptedVids(a => a.filter(x => x.videoId !== r.video.videoId));
  const statusOf = (r) => acceptedVids.some(x => x.videoId === r.video.videoId) ? "accepted" : "skipped";

  if (done) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
        <div className="max-w-md text-center px-6">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-accent flex items-center justify-center text-white text-xl">✓</div>
          <h1 className="text-xl font-bold text-main mb-2">Project created</h1>
          {warnings.length > 0 && <p className="text-xs text-amber-600 mb-3">Some extras didn't save: {warnings.join("; ")}.</p>}
          <p className="text-sm text-muted mb-6">{acceptedVids.length} pieces imported. Personalize dimensions and the profile in Settings.</p>
          <button onClick={() => router.push("/audit")} className="px-5 py-2.5 bg-accent text-white rounded-lg text-sm font-semibold hover:opacity-90">Go to the project</button>
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
        {phase === "create" && scoutResults.length > 0 && (
          <div className="pl-10 space-y-2">
            {scoutResults.map((r, i) => {
              const st = statusOf(r), v = r.video;
              return (
                <div key={i} className={`flex items-center gap-3 p-2 border border-main rounded-lg ${st === "skipped" ? "opacity-50" : ""}`}>
                  <div className="relative w-20 h-12 flex-shrink-0 cursor-pointer" onClick={() => setLightbox(v.videoId)}>
                    {v.thumbnail && <img src={v.thumbnail} alt="" className="w-full h-full object-cover rounded" />}
                    {v.duration && <span className="absolute bottom-0.5 right-0.5 bg-black/80 text-white text-[8px] px-1 rounded font-mono">{fmtDur(v.duration)}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-main truncate">{v.title}</p>
                    <p className="text-[10px] text-hint">{r.brandName} · {r.scope}{v.year || v.publishedAt ? ` · ${v.year || String(v.publishedAt).slice(0, 4)}` : ""}{v.channel ? ` · ${v.channel}` : ""}</p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => accept(r)} className={`px-2 py-1 rounded text-[10px] font-semibold ${st === "accepted" ? "bg-accent text-white" : "border border-main text-muted"}`}>{st === "accepted" ? "✓ Added" : "Add"}</button>
                    <button onClick={() => skip(r)} className="px-2 py-1 border border-main rounded text-[10px] text-muted">Skip</button>
                  </div>
                </div>
              );
            })}
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
              <button onClick={() => { addUser(`${globalRefs.filter(g => g.selected).length} global references`); runScout(); }} className="px-4 py-2.5 bg-accent text-white rounded-xl text-xs font-bold whitespace-nowrap">Continue</button>
            </>
          )}
          {phase === "create" && <button onClick={finalize} disabled={saving || busy} className="ml-auto px-5 py-2.5 bg-accent text-white rounded-xl text-xs font-bold disabled:opacity-40">{saving ? "Creating…" : "Create study"}</button>}
        </div>
      </div>

      {/* lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6" onClick={() => setLightbox(null)}>
          <div className="w-full max-w-3xl aspect-video" onClick={e => e.stopPropagation()}>
            <iframe width="100%" height="100%" src={`https://www.youtube.com/embed/${lightbox}?autoplay=1`} frameBorder="0" allow="autoplay; encrypted-media" allowFullScreen className="rounded-lg" />
          </div>
        </div>
      )}
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
