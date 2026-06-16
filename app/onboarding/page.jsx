"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { useProject } from "@/lib/project-context";
import { useRole } from "@/lib/role-context";
import AuthGuard from "@/components/AuthGuard";
import CountryInput from "@/components/CountryInput";

const OBJECTIVES = [
  "Competitive positioning & messaging",
  "Identify white spaces / opportunities",
  "Creative inspiration & benchmarking",
  "Innovation scan",
  "Brand consistency audit",
  "Category landscape map",
  "Tone & territory analysis",
];
const SHOW_CHANNELS_TIMEWINDOW = false; // built later; not saved yet
const STEPS = ["Brief", "Profile", "Local", "Global", "Create"];
const SUGGEST_MODEL = "claude-opus-4-8";

const DEFAULT_INTENTS = ["Brand Hero", "Brand Tactical", "Client Testimonials", "Product", "Innovation"];
const DEFAULT_DIMS = ["archetype", "tone", "execution", "funnel", "rating"];
const INPUT_CLS = "w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[var(--accent)]";

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-[10px] text-muted uppercase font-semibold mb-1">{label}</label>
      {children}
    </div>
  );
}

function OnboardingContent() {
  const router = useRouter();
  const supabase = createClient();
  const { selectProject } = useProject() || {};
  const { activeOrg, userId, userEmail } = useRole() || {};

  const [step, setStep] = useState(1);
  const [clients, setClients] = useState([]);

  // P1 — Brief
  const [clientMode, setClientMode] = useState("existing"); // existing | new
  const [clientId, setClientId] = useState("");
  const [newClientName, setNewClientName] = useState("");
  const [ownBrand, setOwnBrand] = useState(false);
  const [bp, setBp] = useState({ name: "", market: "", category: "" });
  const [objectives, setObjectives] = useState([]);
  const [otherOn, setOtherOn] = useState(false);
  const [otherText, setOtherText] = useState("");

  // P2 — Profile
  const [profile, setProfile] = useState({ positioning: "", differentiator: "", audience: "" });

  // P3 — Local
  const [targetCount, setTargetCount] = useState(5);
  const [localComps, setLocalComps] = useState([]);
  const [loadingLocal, setLoadingLocal] = useState(false);
  const [customLocal, setCustomLocal] = useState("");

  // P4 — Global
  const [globalRefs, setGlobalRefs] = useState([]);
  const [loadingGlobal, setLoadingGlobal] = useState(false);
  const [customGlobal, setCustomGlobal] = useState("");

  // Create / scout
  const [scoutResults, setScoutResults] = useState({});
  const [scoutStatus, setScoutStatus] = useState({});
  const [scouting, setScouting] = useState(false);
  const [scoutDone, setScoutDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [warnings, setWarnings] = useState([]);
  const [error, setError] = useState("");

  // Load clients; auto-pick own client for client users
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("clients").select("id, name, organization_id").order("name");
      setClients(data || []);
      if (activeOrg?.type === "client") {
        const own = (data || []).find(c => c.organization_id === activeOrg.id);
        if (own) { setClientMode("existing"); setClientId(own.id); }
      }
    })();
  }, [activeOrg?.id, activeOrg?.type]);

  const isClientUser = activeOrg?.type === "client";
  const subject = ownBrand ? "your brand" : "the brand";

  /* ── AI suggestions ── */
  const fetchLocal = async () => {
    setLoadingLocal(true);
    try {
      const res = await fetch("/api/suggest-competitors", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand_name: bp.name, industry: bp.category, market: bp.market, type: "local", model: SUGGEST_MODEL }),
      });
      const data = await res.json();
      const sugg = Array.isArray(data.suggestions) ? data.suggestions : [];
      setLocalComps(sugg.slice(0, targetCount).map(s => ({ name: s.name, proximity: s.type || "direct", selected: true })));
    } catch {}
    setLoadingLocal(false);
  };

  const fetchGlobal = async () => {
    setLoadingGlobal(true);
    try {
      const res = await fetch("/api/suggest-competitors", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand_name: bp.name, industry: bp.category, type: "global", model: SUGGEST_MODEL }),
      });
      const data = await res.json();
      const sugg = Array.isArray(data.suggestions) ? data.suggestions : [];
      setGlobalRefs(sugg.map(s => ({ name: s.name, country: s.country || "", selected: true })));
    } catch {}
    setLoadingGlobal(false);
  };

  /* ── Scout (parallel) ── */
  const runScout = async () => {
    const local = localComps.filter(c => c.selected).slice(0, 7).map(c => ({ name: c.name, scope: "local" }));
    const global = globalRefs.filter(g => g.selected).slice(0, 3).map(g => ({ name: g.name, scope: "global" }));
    const all = [...local, ...global];
    if (all.length === 0) { setScoutDone(true); return; }
    setScouting(true);
    const cutoff = new Date(Date.now() - 730 * 86400000).toISOString();
    await Promise.all(all.map(async (brand) => {
      try {
        const res = await fetch("/api/youtube-scout", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "search", query: `"${brand.name}" official commercial advert`, maxResults: 3, publishedAfter: cutoff, contentType: "official", minDuration: 15, maxDuration: 180 }),
        });
        const data = await res.json();
        const vids = (data.videos || [])
          .filter(v => { const t = (v.title || "").toLowerCase(); return !t.includes("reaction") && !t.includes("review") && !t.includes("tutorial"); })
          .sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0))
          .slice(0, 1);
        setScoutResults(prev => ({ ...prev, [brand.name]: vids.map(v => ({ ...v, scope: brand.scope })) }));
        vids.forEach(v => setScoutStatus(prev => ({ ...prev, [`${brand.name}:${v.videoId}`]: "pending" })));
      } catch {}
    }));
    setScouting(false);
    setScoutDone(true);
  };

  /* ── Navigation ── */
  const canNext = () => {
    if (step === 1) return bp.name.trim() && (clientMode === "existing" ? clientId : newClientName.trim());
    return true;
  };
  const goNext = () => {
    const n = step + 1;
    setStep(n);
    if (n === 3 && localComps.length === 0) fetchLocal();
    if (n === 4 && globalRefs.length === 0) fetchGlobal();
    if (n === 5 && !scoutDone) runScout();
  };
  const goBack = () => setStep(s => Math.max(1, s - 1));

  /* ── Save ── */
  const finalize = async () => {
    setSaving(true); setError("");
    const warn = [];
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Your session expired — please log in again.");
      const email = session.user.email;
      const orgId = activeOrg?.id || null;

      // 1. Resolve client (create on the fly if new)
      let finalClientId = clientId;
      if (clientMode === "new") {
        const slug = newClientName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") + "-" + String(Date.now()).slice(-5);
        const { data: org, error: oe } = await supabase.from("organizations").insert({ name: newClientName.trim(), slug, type: "client", plan: "standard", status: "active" }).select().single();
        if (oe || !org) throw new Error(`Couldn't create the client: ${oe?.message || "unknown"}`);
        const { data: cl, error: ce } = await supabase.from("clients").insert({ name: newClientName.trim(), slug, organization_id: org.id, status: "active" }).select().single();
        if (ce || !cl) throw new Error(`Couldn't create the client record: ${ce?.message || "unknown"}`);
        finalClientId = cl.id;
      }

      // 2. Project (CRITICAL)
      const projectId = "proj_" + Date.now();
      const projectName = bp.name ? `${bp.name} Competitive Audit` : "New Audit";
      const selectedLocal = localComps.filter(c => c.selected);
      const selectedGlobal = globalRefs.filter(g => g.selected);
      const finalObjectives = [...objectives, ...(otherOn && otherText.trim() ? [otherText.trim()] : [])];

      const { error: pErr } = await supabase.from("projects").insert({
        id: projectId, name: projectName, client_id: finalClientId, organization_id: orgId, created_by: email,
        description: [bp.category, bp.market && `Market: ${bp.market}`, profile.positioning].filter(Boolean).join(" · "),
      });
      if (pErr) throw new Error(`Couldn't create the project: ${pErr.message}`);

      // 3. Framework (CRITICAL) — loaded by framework-context via project_id
      const { error: fErr } = await supabase.from("project_frameworks").insert({
        project_id: projectId, name: `${bp.name} Framework`, tier: "essential",
        brand_name: bp.name, brand_positioning: profile.positioning || "", brand_differentiator: profile.differentiator || "",
        brand_audience: profile.audience || "", brand_description: profile.positioning || "",
        industry: bp.category || "", primary_market: bp.market || "", language: "English",
        objectives: finalObjectives, years_in_market: "",
        communication_intents: DEFAULT_INTENTS, standard_dimensions: DEFAULT_DIMS,
        brand_categories: ["Leader", "Challenger", "Niche", "Emerging", "Other"],
        local_competitors: selectedLocal.map(c => ({ name: c.name, type: c.proximity || "direct" })),
        global_benchmarks: selectedGlobal.map(g => ({ name: g.name, country: g.country || "" })),
      });
      if (fErr) throw new Error(`Project created but its framework couldn't be saved: ${fErr.message}`);

      // 4. Grant access to creator (CRITICAL for visibility)
      const { error: aErr } = await supabase.from("project_access").insert({ user_id: session.user.id, email, project_id: projectId });
      if (aErr) warn.push(`access (${aErr.message})`);

      // --- non-critical below ---

      // 5. Competitor + reference brands
      const brandRows = [
        ...selectedLocal.map(c => ({ name: c.name, project_id: projectId, organization_id: orgId, scope: "local", proximity: c.proximity || "direct", is_active: true })),
        ...selectedGlobal.map(g => ({ name: g.name, project_id: projectId, organization_id: orgId, scope: "global", proximity: "Direct", country: g.country || "", is_active: true })),
      ];
      if (brandRows.length) {
        const { error: bErr } = await supabase.from("brands").insert(brandRows);
        if (bErr) warn.push(`brands (${bErr.message})`);
      }

      // 6. Dropdown options — competitors + defaults
      const compNames = selectedLocal.map(c => c.name);
      const defaults = [
        ...DEFAULT_INTENTS.map((v, i) => ({ category: "communicationIntent", value: v, sort_order: i })),
        ...["Innocent", "Explorer", "Sage", "Hero", "Outlaw", "Magician", "Regular Guy", "Lover", "Jester", "Caregiver", "Creator", "Ruler"].map((v, i) => ({ category: "brandArchetype", value: v, sort_order: i })),
        ...["Awareness", "Consideration", "Conversion", "Retention", "Advocacy"].map((v, i) => ({ category: "funnel", value: v, sort_order: i })),
        ...["Video", "Print", "Digital", "Social", "OOH", "Website", "Blog", "Event"].map((v, i) => ({ category: "type", value: v, sort_order: i })),
        ...compNames.map((name, i) => ({ category: "competitor", value: name, sort_order: i })),
      ];
      const { error: dErr } = await supabase.from("dropdown_options").insert(defaults.map(d => ({ ...d, project_id: projectId })));
      if (dErr) warn.push(`dropdowns (${dErr.message})`);

      // 7. Seed accepted videos
      let imported = 0;
      const accepted = [];
      Object.entries(scoutResults).forEach(([brandName, vids]) => {
        (vids || []).forEach(v => { if (scoutStatus[`${brandName}:${v.videoId}`] === "accepted") accepted.push({ ...v, brandName }); });
      });
      for (let i = 0; i < accepted.length; i++) {
        const v = accepted[i];
        const entry = {
          id: String(Date.now()) + "_" + i, project_id: projectId, created_by: email, updated_at: new Date().toISOString(),
          url: `https://www.youtube.com/watch?v=${v.videoId}`, image_url: v.thumbnail || "", description: v.title || "",
          year: v.year || "", type: "Video", synopsis: v.description || "", scope: v.scope || "local", brand_name: v.brandName || "",
        };
        if (v.scope === "global") entry.brand = v.brandName; else entry.competitor = v.brandName;
        const { error: eErr } = await supabase.from("creative_source").insert(entry);
        if (eErr) warn.push(`video "${v.title}"`); else imported++;
      }

      // 8. Select + go
      const clientName = clientMode === "new" ? newClientName.trim() : (clients.find(c => c.id === finalClientId)?.name || "");
      selectProject?.(projectId, projectName);
      try {
        localStorage.setItem("sb-project-id", projectId);
        localStorage.setItem("sb-project-name", projectName);
        localStorage.setItem("sb-client-name", clientName);
      } catch {}
      setWarnings(warn); setDone(true); setSaving(false);
    } catch (err) {
      setError(err.message); setSaving(false);
    }
  };

  /* ── UI helpers ── */
  const toggleObjective = (o) => setObjectives(p => p.includes(o) ? p.filter(x => x !== o) : [...p, o]);
  const toggleLocal = (i) => setLocalComps(p => p.map((c, j) => j === i ? { ...c, selected: !c.selected } : c));
  const setLocalProx = (i, prox) => setLocalComps(p => p.map((c, j) => j === i ? { ...c, proximity: prox } : c));
  const toggleGlobal = (i) => setGlobalRefs(p => p.map((g, j) => j === i ? { ...g, selected: !g.selected } : g));
  const addCustomLocal = () => { if (customLocal.trim()) { setLocalComps(p => [...p, { name: customLocal.trim(), proximity: "direct", selected: true }]); setCustomLocal(""); } };
  const addCustomGlobal = () => { if (customGlobal.trim()) { setGlobalRefs(p => [...p, { name: customGlobal.trim(), country: "", selected: true }]); setCustomGlobal(""); } };

  const inputCls = INPUT_CLS;

  /* ── Render ── */
  if (done) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
        <div className="max-w-md text-center px-6">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-accent flex items-center justify-center text-white text-xl">✓</div>
          <h1 className="text-xl font-bold text-main mb-2">Project created</h1>
          {warnings.length > 0 && <p className="text-xs text-amber-600 mb-3">Some extras didn't save: {warnings.join("; ")}. The project itself is ready.</p>}
          <p className="text-sm text-muted mb-6">Personalize dimensions and complete the profile in Settings. Tip: go to Audit and "Analyze with AI" on each entry.</p>
          <button onClick={() => router.push("/audit")} className="px-5 py-2.5 bg-accent text-white rounded-lg text-sm font-semibold hover:opacity-90">Go to the project</button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col" style={{ background: "var(--bg)" }}>
      {/* Header */}
      <div className="px-5 py-3 flex justify-between items-center flex-shrink-0" style={{ background: "#0a0f3c" }}>
        <div className="flex items-center gap-3">
          <img src="/knots-dots-logo.png" alt="K&D" style={{ height: 22 }} />
          <div>
            <p className="text-sm font-semibold text-white">New project</p>
            <p className="text-[10px] text-white/40">Step {step} of {STEPS.length} — {STEPS[step - 1]}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            {STEPS.map((s, i) => <div key={i} className={`w-1.5 h-1.5 rounded-full ${i + 1 === step ? "bg-white" : i + 1 < step ? "bg-white/40" : "bg-white/15"}`} />)}
          </div>
          <button onClick={() => router.push("/dashboard")} className="text-[11px] text-white/25 hover:text-white/50">Cancel</button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-2xl mx-auto p-8">

          {step === 1 && (
            <div className="space-y-4">
              <div><h1 className="text-xl font-bold text-main">Brief</h1><p className="text-sm text-muted">Who is this study for and what are we auditing?</p></div>
              {!isClientUser && (
                <Field label="Client">
                  <div className="flex gap-2 mb-2">
                    <button onClick={() => setClientMode("existing")} className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${clientMode === "existing" ? "border-[var(--accent)] text-main" : "border-main text-muted"}`}>Existing client</button>
                    <button onClick={() => setClientMode("new")} className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${clientMode === "new" ? "border-[var(--accent)] text-main" : "border-main text-muted"}`}>New client</button>
                  </div>
                  {clientMode === "existing" ? (
                    <select value={clientId} onChange={e => setClientId(e.target.value)} className={inputCls}>
                      <option value="">Select a client…</option>
                      {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  ) : (
                    <input value={newClientName} onChange={e => setNewClientName(e.target.value)} placeholder="New client name" className={inputCls} />
                  )}
                </Field>
              )}
              <Field label="Perspective">
                <div className="flex gap-2">
                  <button onClick={() => setOwnBrand(false)} className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${!ownBrand ? "border-[var(--accent)] text-main" : "border-main text-muted"}`}>A client I'm researching</button>
                  <button onClick={() => setOwnBrand(true)} className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${ownBrand ? "border-[var(--accent)] text-main" : "border-main text-muted"}`}>My own brand</button>
                </div>
              </Field>
              <Field label="Focus brand"><input value={bp.name} onChange={e => setBp({ ...bp, name: e.target.value })} placeholder="e.g. Scotiabank" className={inputCls} /></Field>
              <Field label="Primary market"><CountryInput value={bp.market} onChange={v => setBp({ ...bp, market: v })} placeholder="e.g. Canada" /></Field>
              <Field label="Category / industry"><input value={bp.category} onChange={e => setBp({ ...bp, category: e.target.value })} placeholder="e.g. Banking & Financial Services" className={inputCls} /></Field>
              <Field label="Objectives">
                <div className="grid grid-cols-1 gap-1.5">
                  {OBJECTIVES.map(o => (
                    <label key={o} className="flex items-center gap-2 text-sm text-main cursor-pointer">
                      <input type="checkbox" checked={objectives.includes(o)} onChange={() => toggleObjective(o)} /> {o}
                    </label>
                  ))}
                  <label className="flex items-center gap-2 text-sm text-main cursor-pointer">
                    <input type="checkbox" checked={otherOn} onChange={() => setOtherOn(!otherOn)} /> Other
                  </label>
                  {otherOn && <input value={otherText} onChange={e => setOtherText(e.target.value)} placeholder="Describe the objective" className={inputCls} />}
                </div>
              </Field>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div><h1 className="text-xl font-bold text-main">Profile</h1><p className="text-sm text-muted">What only you know about {subject}. (More in Settings later.)</p></div>
              <Field label="Value proposition / positioning"><textarea rows={2} value={profile.positioning} onChange={e => setProfile({ ...profile, positioning: e.target.value })} className={inputCls} /></Field>
              <Field label="Key differentiator"><textarea rows={2} value={profile.differentiator} onChange={e => setProfile({ ...profile, differentiator: e.target.value })} className={inputCls} /></Field>
              <Field label="Audience summary"><textarea rows={2} value={profile.audience} onChange={e => setProfile({ ...profile, audience: e.target.value })} className={inputCls} /></Field>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <div><h1 className="text-xl font-bold text-main">Local competitors</h1><p className="text-sm text-muted">AI suggestions for {bp.name || "the brand"} in {bp.market || "the market"}.</p></div>
                <Field label="Target #"><input type="number" min={1} max={12} value={targetCount} onChange={e => setTargetCount(Number(e.target.value))} className="w-16 px-2 py-1 bg-surface border border-main rounded-lg text-sm text-main" /></Field>
              </div>
              {loadingLocal ? <p className="text-hint text-sm py-8 text-center">Finding competitors…</p> : (
                <div className="space-y-1.5">
                  {localComps.map((c, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-2 border border-main rounded-lg">
                      <input type="checkbox" checked={c.selected} onChange={() => toggleLocal(i)} />
                      <span className="flex-1 text-sm text-main">{c.name}</span>
                      <select value={c.proximity} onChange={e => setLocalProx(i, e.target.value)} className="text-[11px] px-2 py-1 bg-surface border border-main rounded-md text-main">
                        <option value="direct">Direct</option>
                        <option value="adjacent">Adjacent</option>
                        <option value="target proximity">Target proximity</option>
                      </select>
                    </div>
                  ))}
                  {localComps.length === 0 && <p className="text-hint text-sm">No suggestions — add competitors manually below.</p>}
                </div>
              )}
              <div className="flex gap-2">
                <input value={customLocal} onChange={e => setCustomLocal(e.target.value)} onKeyDown={e => e.key === "Enter" && addCustomLocal()} placeholder="Add a competitor…" className={inputCls} />
                <button onClick={addCustomLocal} className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-semibold">Add</button>
                <button onClick={fetchLocal} className="px-3 py-2 border border-main rounded-lg text-sm text-muted">↻</button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div><h1 className="text-xl font-bold text-main">Global references</h1><p className="text-sm text-muted">International brands worth benchmarking.</p></div>
              {loadingGlobal ? <p className="text-hint text-sm py-8 text-center">Finding global references…</p> : (
                <div className="space-y-1.5">
                  {globalRefs.map((g, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-2 border border-main rounded-lg">
                      <input type="checkbox" checked={g.selected} onChange={() => toggleGlobal(i)} />
                      <span className="flex-1 text-sm text-main">{g.name}</span>
                      {g.country && <span className="text-[11px] text-hint">{g.country}</span>}
                    </div>
                  ))}
                  {globalRefs.length === 0 && <p className="text-hint text-sm">No suggestions — add references manually below.</p>}
                </div>
              )}
              <div className="flex gap-2">
                <input value={customGlobal} onChange={e => setCustomGlobal(e.target.value)} onKeyDown={e => e.key === "Enter" && addCustomGlobal()} placeholder="Add a brand…" className={inputCls} />
                <button onClick={addCustomGlobal} className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-semibold">Add</button>
                <button onClick={fetchGlobal} className="px-3 py-2 border border-main rounded-lg text-sm text-muted">↻</button>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <div><h1 className="text-xl font-bold text-main">Seed content & create</h1><p className="text-sm text-muted">Scouting one piece per brand. Accept or skip, then create the study.</p></div>
              {scouting && <p className="text-hint text-sm py-4 text-center">Scouting YouTube…</p>}
              <div className="space-y-2">
                {Object.entries(scoutResults).map(([brandName, vids]) => (vids || []).map(v => {
                  const key = `${brandName}:${v.videoId}`;
                  const st = scoutStatus[key];
                  return (
                    <div key={key} className={`flex items-center gap-3 p-2 border border-main rounded-lg ${st === "skipped" ? "opacity-40" : ""}`}>
                      {v.thumbnail && <img src={v.thumbnail} alt="" className="w-16 h-10 object-cover rounded" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-main truncate">{v.title}</p>
                        <p className="text-[10px] text-hint">{brandName} · {v.scope}</p>
                      </div>
                      {st === "accepted" ? <span className="text-[10px] text-green-600 font-semibold">Added</span> : st === "skipped" ? <span className="text-[10px] text-hint">Skipped</span> : (
                        <div className="flex gap-1">
                          <button onClick={() => setScoutStatus(p => ({ ...p, [key]: "accepted" }))} className="px-2 py-1 bg-accent text-white rounded text-[10px] font-semibold">✓</button>
                          <button onClick={() => setScoutStatus(p => ({ ...p, [key]: "skipped" }))} className="px-2 py-1 border border-main rounded text-[10px] text-muted">✕</button>
                        </div>
                      )}
                    </div>
                  );
                }))}
                {scoutDone && Object.keys(scoutResults).length === 0 && <p className="text-hint text-sm">No content found — you can add entries later in Audit.</p>}
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
            </div>
          )}

        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-main bg-surface px-5 py-3 flex-shrink-0">
        <div className="max-w-2xl mx-auto flex justify-between items-center">
          <button onClick={goBack} disabled={step === 1 || saving} className="px-4 py-2 text-sm text-muted hover:text-main disabled:opacity-30">Back</button>
          {step < 5 ? (
            <button onClick={goNext} disabled={!canNext()} className="px-5 py-2 bg-accent text-white rounded-lg text-sm font-semibold disabled:opacity-40">Next</button>
          ) : (
            <button onClick={finalize} disabled={saving || scouting} className="px-5 py-2 bg-accent text-white rounded-lg text-sm font-semibold disabled:opacity-40">{saving ? "Creating…" : "Create study"}</button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return <AuthGuard><OnboardingContent /></AuthGuard>;
}
