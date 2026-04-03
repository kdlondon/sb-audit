"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { useProject } from "@/lib/project-context";
import { useRole } from "@/lib/role-context";
import { useRouter } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";

/* ─── Chat Bubbles ─── */
function AIBubble({ children, typing }) {
  return (
    <div className="flex gap-3 items-start animate-fadeIn">
      <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold"
        style={{ background: "#0019FF", color: "#fff" }}>G</div>
      <div className="bg-surface border border-main rounded-2xl rounded-tl-md px-4 py-3 max-w-[560px]">
        {typing ? (
          <span className="flex gap-1 items-center py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-hint animate-pulse" />
            <span className="w-1.5 h-1.5 rounded-full bg-hint animate-pulse" style={{ animationDelay: "0.15s" }} />
            <span className="w-1.5 h-1.5 rounded-full bg-hint animate-pulse" style={{ animationDelay: "0.3s" }} />
          </span>
        ) : (
          <div className="text-sm text-main leading-relaxed">
            {String(children).split("\n").map((line, li) => {
              const formatted = line
                .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
                .replace(/\*([^*]+)\*/g, "<em>$1</em>");
              const isBullet = /^\s*[-•–]\s/.test(line);
              return <p key={li} className={`${isBullet ? "pl-3" : ""} ${li > 0 && line ? "mt-1.5" : !line ? "mt-2" : ""}`}
                dangerouslySetInnerHTML={{ __html: formatted || "&nbsp;" }} />;
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function UserBubble({ text }) {
  return (
    <div className="flex justify-end animate-fadeIn">
      <div className="rounded-2xl rounded-tr-md px-4 py-3 max-w-[420px]" style={{ background: "rgba(0,25,255,0.08)" }}>
        <p className="text-sm text-main leading-relaxed whitespace-pre-wrap">{text}</p>
      </div>
    </div>
  );
}

function Chip({ label, selected, onClick }) {
  return (
    <button onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
        selected
          ? "border-[#0019FF] text-[#0019FF] bg-[rgba(0,25,255,0.08)]"
          : "border-main text-muted hover:border-[#0019FF]/40 hover:text-main"
      }`}>
      {selected && <span className="mr-1">&#10003;</span>}{label}
    </button>
  );
}

function VideoCard({ video, brandName, scope, onAccept, onSkip, accepted, skipped }) {
  const [expanded, setExpanded] = useState(false);
  const fmtDur = (iso) => { if(!iso)return""; const m=iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/); if(!m)return""; const h=parseInt(m[1]||0),min=parseInt(m[2]||0),s=parseInt(m[3]||0); return h>0?`${h}:${String(min).padStart(2,"0")}:${String(s).padStart(2,"0")}`:`${min}:${String(s).padStart(2,"0")}`; };
  const fmtViews = (n) => { if(!n)return"N/A"; if(n>=1e6)return(n/1e6).toFixed(1)+"M"; if(n>=1e3)return(n/1e3).toFixed(0)+"K"; return String(n); };
  const done = accepted || skipped;
  return (
    <div className={`border border-main rounded-xl overflow-hidden transition ${done?"opacity-40":""}`}>
      <div className={`flex gap-3 p-3 cursor-pointer hover:bg-surface2 transition ${expanded?"border-b border-main":""}`} onClick={()=>!done&&setExpanded(!expanded)}>
        <div className="w-20 h-14 flex-shrink-0 rounded-lg overflow-hidden bg-surface2 relative">
          {video.thumbnail&&<img src={video.thumbnail} alt="" className="w-full h-full object-cover"/>}
          {video.duration&&<span className="absolute bottom-0.5 right-0.5 bg-black/80 text-white text-[8px] px-1 py-0.5 rounded font-mono">{fmtDur(video.duration)}</span>}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-main line-clamp-1">{video.title}</p>
          <p className="text-[10px] text-muted">{brandName} &middot; {scope==="global"?"Global":"Local"}</p>
          <p className="text-[10px] text-hint">{video.channel} &middot; {fmtViews(video.viewCount)} views</p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {!done&&<>
            <button onClick={e=>{e.stopPropagation();onAccept();}} className="px-2 py-1 rounded text-[10px] font-semibold text-white hover:opacity-90" style={{background:"#0019FF"}}>&#10003;</button>
            <button onClick={e=>{e.stopPropagation();onSkip();}} className="px-2 py-1 rounded text-[10px] text-muted border border-main hover:text-main">&times;</button>
          </>}
          {accepted&&<span className="text-[10px] text-green-600 font-semibold">Added</span>}
          {skipped&&<span className="text-[10px] text-hint">Skipped</span>}
        </div>
      </div>
      {expanded&&!done&&(<div className="p-3"><iframe width="100%" height="240" src={`https://www.youtube.com/embed/${video.videoId}?rel=0`} frameBorder="0" allowFullScreen className="rounded-lg w-full"/></div>)}
    </div>
  );
}

/* ─── Brand Questions ─── */
const BRAND_QUESTIONS = [
  { key: "proposition", q: "What's your value proposition? What promise does your brand make?" },
  { key: "differentiator", q: "What makes you different from competitors? What's your unique edge?" },
  { key: "tone", q: "What tone does your brand use? (e.g., professional, playful, warm, bold)" },
  { key: "target", q: "Who is your target audience? Describe your ideal customer." },
  { key: "yearsInMarket", q: "How long has the company been in the market?" },
  { key: "market", q: "What country or market do you primarily operate in?" },
  { key: "category", q: "What industry or category are you in?" },
];

const STEPS = [
  { num: 1, title: "Brand Profile" },
  { num: 2, title: "Review" },
  { num: 3, title: "Local Competitors" },
  { num: 4, title: "Global References" },
  { num: 5, title: "Auto-Scout" },
  { num: 6, title: "Ready!" },
];

/* ─── Main ─── */
function OnboardingContent() {
  const router = useRouter();
  const { selectProject } = useProject();
  const { activeOrg } = useRole() || {};
  const supabase = createClient();
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  const [step, setStep] = useState(1);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  // Brand profile
  const [bp, setBp] = useState({ name:"", market:"", category:"", proposition:"", differentiator:"", tone:"", target:"", yearsInMarket:"" });
  const [qIdx, setQIdx] = useState(0);
  const [exchanges, setExchanges] = useState(0);

  // Competitors
  const [localComps, setLocalComps] = useState([]);
  const [globalRefs, setGlobalRefs] = useState([]);
  const [customInput, setCustomInput] = useState("");

  // Scout
  const [scoutBrands, setScoutBrands] = useState([]);
  const [scoutResults, setScoutResults] = useState({});
  const [scoutVideoStatus, setScoutVideoStatus] = useState({});
  const [scoutRunning, setScoutRunning] = useState(false);
  const [scoutDone, setScoutDone] = useState(false);
  const [saving, setSaving] = useState(false);

  // Scroll on new messages
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages, loading]);

  // Init
  useEffect(() => {
    addAI("Hey! I'm your competitive intelligence setup assistant. Let's get your project ready.\n\nTell me — **what's the name of the brand** we'll be auditing, and **what do they do?**");
  }, []);

  const addAI = (text) => setMessages(p => [...p, { role: "ai", text }]);
  const addUser = (text) => setMessages(p => [...p, { role: "user", text }]);

  const callAI = async (sys, msg) => {
    const res = await fetch("/api/ai", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ system: sys, messages: [{ role: "user", content: msg }], max_tokens: 1500, skip_framework: true }),
    });
    const data = await res.json();
    return data?.content?.[0]?.text || null;
  };

  /* ═══ STEP 1: Conversational Brand Profile ═══ */
  const handleStep1 = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput(""); addUser(text); setLoading(true);

    const newExchanges = exchanges + 1;
    setExchanges(newExchanges);

    if (text.toLowerCase() === "done" && bp.name) { setLoading(false); goToStep(2); return; }

    // Extract data from response
    const currentQ = qIdx > 0 ? BRAND_QUESTIONS[qIdx - 1] : null;
    const extractPrompt = `Extract brand profile data from the user's response.
Current profile: ${JSON.stringify(bp)}
${currentQ ? `Question they answered: "${currentQ.q}" (field: ${currentQ.key})` : "Initial brand introduction."}
Extract any of: name, market, category, proposition, differentiator, tone, target, yearsInMarket.
Return ONLY valid JSON: {"name":"..."}. If nothing extractable, return {}`;

    const extracted = await callAI(extractPrompt, text);
    if (extracted) {
      try {
        const match = extracted.match(/\{[\s\S]*?\}/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          setBp(prev => {
            const u = { ...prev };
            Object.keys(parsed).forEach(k => { if (parsed[k] && k in u) u[k] = parsed[k]; });
            return u;
          });
        }
      } catch {}
    }

    // Find next unanswered question
    let nextQ = null;
    for (let i = qIdx; i < BRAND_QUESTIONS.length; i++) {
      const q = BRAND_QUESTIONS[i];
      if (!bp[q.key]) { nextQ = q; setQIdx(i + 1); break; }
    }

    if (newExchanges >= 7 || !nextQ) {
      setLoading(false);
      addAI("Got it — I have a solid picture. Let me review what I've captured...");
      setTimeout(() => goToStep(2), 1500);
      return;
    }

    // Conversational response + next question
    const respPrompt = `You are a brand strategist doing a quick intake. The user answered about their brand.

Reply with MAX 1 short sentence acknowledging what they said (10 words max), then ask: "${nextQ.q}"

RULES:
- First sentence: casual, warm, max 10 words. Examples: "Got it.", "Nice — clear positioning.", "Solid.", "Makes sense for that market.", "Interesting mix."
- NEVER start with "That puts you in" — BANNED phrase
- NEVER write more than 2 sentences total
- No analysis, no strategic observations, no paragraphs
- Just acknowledge briefly and ask the next question`;

    const response = await callAI(respPrompt, text);
    setLoading(false);
    addAI(response ? response.replace(/###.*?###/g, "").trim() : nextQ.q);
  };

  /* ═══ STEP 2: Review ═══ */
  const initStep2 = () => {
    const lines = [
      bp.name && `**Name:** ${bp.name}`,
      bp.market && `**Market:** ${bp.market}`,
      bp.category && `**Category:** ${bp.category}`,
      bp.proposition && `**Value Prop:** ${bp.proposition}`,
      bp.differentiator && `**Differentiator:** ${bp.differentiator}`,
      bp.tone && `**Tone:** ${bp.tone}`,
      bp.target && `**Target:** ${bp.target}`,
      bp.yearsInMarket && `**Years:** ${bp.yearsInMarket}`,
    ].filter(Boolean).join("\n");
    addAI(`Here's what I've got:\n\n${lines || "(Nothing captured yet)"}\n\nLooks good? Click **Next** and I'll find your competitors.`);
  };

  /* ═══ STEP 3: Local Competitors (AI-suggested) ═══ */
  const initStep3 = async () => {
    addAI(`Let me find competitors for **${bp.name}** in **${bp.market || "your market"}**...`);
    setLoading(true);

    const prompt = `Suggest 8 competitors for this brand in their local market:
Brand: ${bp.name}, Market: ${bp.market}, Category: ${bp.category}, Proposition: ${bp.proposition}
Return ONLY a JSON array: ["Competitor A","Competitor B",...]. No other text.`;

    const aiText = await callAI("You are a competitive intelligence expert. Return only a JSON array.", prompt);
    setLoading(false);

    let suggestions = [];
    if (aiText) { try { const m = aiText.match(/\[[\s\S]*?\]/); if (m) suggestions = JSON.parse(m[0]); } catch {} }
    if (suggestions.length === 0) suggestions = ["Competitor 1", "Competitor 2", "Competitor 3"];

    setLocalComps(suggestions.map(name => ({ name, selected: true })));
    addAI(`Here are **${suggestions.length} competitors** I found. Toggle any on/off and add your own below.\n\nWhen you're happy, click **Next** for global benchmarks.`);
  };

  /* ═══ STEP 4: Global References (AI-suggested) ═══ */
  const initStep4 = async () => {
    addAI(`Now the fun part — let me find **global brands** worth studying for ${bp.name}...`);
    setLoading(true);

    const selectedLocal = localComps.filter(c => c.selected).map(c => c.name);
    const prompt = `Suggest 6 international brands worth benchmarking:
Brand: ${bp.name}, Market: ${bp.market}, Category: ${bp.category}
Local competitors: ${selectedLocal.join(", ")}
Mix of same-industry leaders + cross-industry innovators with great marketing.
Return JSON: [{"name":"Brand","market":"Country"}]. No other text.`;

    const aiText = await callAI("You are a global competitive intelligence expert. Return only JSON.", prompt);
    setLoading(false);

    let suggestions = [];
    if (aiText) { try { const m = aiText.match(/\[[\s\S]*?\]/); if (m) suggestions = JSON.parse(m[0]); } catch {} }
    if (suggestions.length === 0) suggestions = [{ name: "Global Brand 1", market: "US" }];

    setGlobalRefs(suggestions.map(s => ({ ...s, selected: true })));
    addAI(`Found **${suggestions.length} global references**. Toggle and add your own.\n\nClick **Next** to scout their best content on YouTube.`);
  };

  /* ═══ STEP 5: Auto-Scout ═══ */
  const initStep5 = async () => {
    const local = localComps.filter(c => c.selected).slice(0, 7).map(c => ({ name: c.name, scope: "local" }));
    const global = globalRefs.filter(g => g.selected).slice(0, 3).map(g => ({ name: g.name, scope: "global" }));
    const all = [...local, ...global];

    if (all.length === 0) { addAI("No brands selected — skip this step. Click **Finish** to create your project."); setScoutDone(true); return; }

    setScoutBrands(all);
    addAI(`Searching **${all.length} brands** for their best content (${local.length} local + ${global.length} global)...`);
    setScoutRunning(true);

    for (const brand of all) {
      try {
        // Use the full youtube-scout with AI ranking for better results
        const res = await fetch("/api/youtube-scout", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "search",
            query: `"${brand.name}" official commercial anuncio publicidad`,
            maxResults: 3,
            publishedAfter: new Date(Date.now() - 730 * 86400000).toISOString(),
            contentType: "official",
            minDuration: 15,
            maxDuration: 180,
          }),
        });
        const data = await res.json();
        // Pick best video — prefer higher views, filter out irrelevant titles
        const allVids = (data.videos || [])
          .filter(v => {
            const t = (v.title || "").toLowerCase();
            const bn = brand.name.toLowerCase();
            // Filter out clearly unrelated content
            return !t.includes("reaction") && !t.includes("review") && !t.includes("tutorial") && !t.includes("how to");
          })
          .sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
        const videos = allVids.slice(0, 1);
        setScoutResults(prev => ({ ...prev, [brand.name]: videos }));
        videos.forEach(v => setScoutVideoStatus(prev => ({ ...prev, [`${brand.name}:${v.videoId}`]: "pending" })));
        addAI(videos.length > 0 ? `**${brand.name}** — found a piece` : `**${brand.name}** — no relevant content found`);
      } catch {
        addAI(`**${brand.name}** — couldn't search (API limit)`);
      }
    }

    setScoutRunning(false);
    setScoutDone(true);
    addAI("Done scouting! Accept or skip each video, then click **Finish** to create your project.");
  };

  /* ═══ STEP 6: Save Everything ═══ */
  const finalize = async () => {
    setSaving(true);

    // Gather accepted videos
    const acceptedVideos = [];
    scoutBrands.forEach(brand => {
      (scoutResults[brand.name] || []).forEach(v => {
        if (scoutVideoStatus[`${brand.name}:${v.videoId}`] === "accepted")
          acceptedVideos.push({ ...v, brandName: brand.name, scope: brand.scope });
      });
    });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const email = session?.user?.email || "";
      const projectId = "proj_" + Date.now();
      const projectName = bp.name ? `${bp.name} Competitive Audit` : "New Audit";

      // Create project
      await supabase.from("projects").insert({
        id: projectId, name: projectName, client_name: bp.name || "",
        description: [bp.category, bp.market && `Market: ${bp.market}`, bp.proposition].filter(Boolean).join(" · "),
        created_by: email, organization_id: activeOrg?.id || null,
      });

      // Grant access
      await supabase.from("project_access").insert({ user_id: session.user.id, email, project_id: projectId });

      // Create framework (Tier 1 Essential)
      const selectedLocal = localComps.filter(c => c.selected);
      const selectedGlobal = globalRefs.filter(g => g.selected);

      await supabase.from("project_frameworks").insert({
        project_id: projectId,
        name: `${bp.name} Framework`,
        tier: "essential",
        brand_name: bp.name,
        brand_description: bp.proposition || "",
        brand_positioning: bp.proposition || "",
        brand_differentiator: bp.differentiator || "",
        brand_audience: bp.target || "",
        brand_tone: bp.tone || "",
        industry: bp.category || "",
        primary_market: bp.market || "",
        language: "English",
        objectives: ["Understand competitive positioning and messaging", "Identify white spaces and opportunities"],
        years_in_market: bp.yearsInMarket || "",
        communication_intents: ["Brand Hero", "Brand Tactical", "Client Testimonials", "Product", "Innovation"],
        standard_dimensions: ["archetype", "tone", "execution", "funnel", "rating"],
        brand_categories: ["Leader", "Challenger", "Niche", "Emerging", "Other"],
        local_competitors: selectedLocal.map(c => ({ name: c.name, type: "direct" })),
        global_benchmarks: selectedGlobal.map(g => ({ name: g.name, country: g.market || "" })),
      });

      // Dropdown options — competitors
      const compNames = selectedLocal.map(c => c.name);
      if (compNames.length > 0) {
        await supabase.from("dropdown_options").insert(compNames.map((name, i) => ({ project_id: projectId, category: "competitor", value: name, sort_order: i })));
        await supabase.from("project_brands").insert(compNames.map(name => ({ project_id: projectId, brand_name: name, scope: "local", category: "", country: "", status: "active", urls: [] })));
      }

      // Dropdown options — global brands
      if (selectedGlobal.length > 0) {
        await supabase.from("project_brands").insert(selectedGlobal.map(g => ({ project_id: projectId, brand_name: g.name, scope: "global", category: "", country: g.market || "", status: "active", urls: [] })));
      }

      // Default dropdown options
      const defaults = [
        ...["Brand Hero","Brand Tactical","Client Testimonials","Product","Innovation"].map((v,i)=>({category:"communicationIntent",value:v,sort_order:i})),
        ...["Innocent","Explorer","Sage","Hero","Outlaw","Magician","Regular Guy","Lover","Jester","Caregiver","Creator","Ruler"].map((v,i)=>({category:"brandArchetype",value:v,sort_order:i})),
        ...["Authoritative","Empathetic","Aspirational","Peer-level","Institutional","Playful","Urgent"].map((v,i)=>({category:"toneOfVoice",value:v,sort_order:i})),
        ...["Testimonial","Documentary","Manifesto","Product demo","Humor","Slice of life","Animation","Data-driven"].map((v,i)=>({category:"executionStyle",value:v,sort_order:i})),
        ...["Awareness","Consideration","Conversion","Retention","Advocacy"].map((v,i)=>({category:"funnel",value:v,sort_order:i})),
        ...["Video","Print","Digital","Social","OOH","Website","Blog","Event"].map((v,i)=>({category:"type",value:v,sort_order:i})),
      ];
      await supabase.from("dropdown_options").insert(defaults.map(d=>({...d, project_id: projectId})));

      // Import accepted videos
      for (let i = 0; i < acceptedVideos.length; i++) {
        const vid = acceptedVideos[i];
        const entry = {
          id: String(Date.now()) + "_" + i,
          project_id: projectId, created_by: email, updated_at: new Date().toISOString(),
          url: `https://www.youtube.com/watch?v=${vid.videoId}`,
          image_url: vid.thumbnail || "", description: vid.title || "",
          year: vid.year || "", type: "Video", synopsis: vid.description || "",
          scope: vid.scope || "local",
          brand_name: vid.brandName || "",
        };
        if (vid.scope === "global") { entry.brand = vid.brandName; entry.country = ""; }
        else { entry.competitor = vid.brandName; }
        await supabase.from("creative_source").insert(entry);
      }

      selectProject(projectId, projectName);
      addAI(`**All set!** ${acceptedVideos.length} entries imported across ${compNames.length + selectedGlobal.length} brands.\n\nTip: Go to **Audit** and click "Analyze with AI" on each entry to auto-classify.\n\nClick **Go to Scout** to continue discovering content.`);
    } catch (err) {
      addAI(`Error: ${err.message}. Please try again.`);
    }
    setSaving(false);
  };

  /* ─── Navigation ─── */
  const goToStep = (n) => {
    setStep(n);
    if (n === 2) initStep2();
    if (n === 3) initStep3();
    if (n === 4) initStep4();
    if (n === 5) initStep5();
    if (n === 6) finalize();
  };

  const canAdvance = () => {
    if (step === 1) return bp.name.length > 0;
    if (step === 5) return scoutDone || !scoutRunning;
    return true;
  };

  const handleSend = () => {
    if (loading) return;
    if (step === 1) handleStep1();
  };

  const handleKey = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } };

  const toggleLocal = (i) => setLocalComps(p => p.map((c, j) => j === i ? { ...c, selected: !c.selected } : c));
  const toggleGlobal = (i) => setGlobalRefs(p => p.map((g, j) => j === i ? { ...g, selected: !g.selected } : g));

  const addCustom = () => {
    if (!customInput.trim()) return;
    if (step === 3) setLocalComps(p => [...p, { name: customInput.trim(), selected: true }]);
    if (step === 4) setGlobalRefs(p => [...p, { name: customInput.trim(), market: "Custom", selected: true }]);
    setCustomInput("");
  };

  const progress = ((step - 1) / 5) * 100;

  return (
    <div className="h-screen flex flex-col" style={{ background: "var(--bg)" }}>
      {/* Header */}
      <div className="px-5 py-3 flex justify-between items-center flex-shrink-0" style={{ background: "#0a0f3c", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-3">
          <img src="/knots-dots-logo.png" alt="K&D" style={{ height: 22 }} />
          <div>
            <p className="text-sm font-semibold text-white">New Project</p>
            <p className="text-[10px] text-white/40">Step {step} of 6 — {STEPS[step-1].title}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            {STEPS.map(s => <div key={s.num} className={`w-1.5 h-1.5 rounded-full ${s.num===step?"bg-white":s.num<step?"bg-white/40":"bg-white/15"}`}/>)}
          </div>
          <button onClick={() => router.push("/projects")} className="text-[11px] text-white/25 hover:text-white/50">Cancel</button>
        </div>
      </div>
      <div className="h-0.5 w-full" style={{ background: "rgba(255,255,255,0.05)" }}>
        <div className="h-full transition-all duration-500" style={{ width: `${progress}%`, background: "#0019FF" }}/>
      </div>

      {/* Chat area */}
      <div ref={scrollRef} className="flex-1 overflow-auto px-5 py-6 space-y-4 max-w-3xl w-full mx-auto">
        {messages.map((m, i) => m.role === "ai" ? <AIBubble key={i}>{m.text}</AIBubble> : <UserBubble key={i} text={m.text}/>)}
        {loading && <AIBubble typing />}

        {/* Competitor chips (Step 3) */}
        {step === 3 && localComps.length > 0 && !loading && (
          <div className="pl-10">
            <div className="flex flex-wrap gap-2">
              {localComps.map((c, i) => <Chip key={i} label={c.name} selected={c.selected} onClick={() => toggleLocal(i)} />)}
            </div>
            <div className="flex gap-2 mt-3">
              <input value={customInput} onChange={e => setCustomInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addCustom()}
                placeholder="Add another competitor..." className="flex-1 px-3 py-1.5 bg-surface border border-main rounded-lg text-xs text-main placeholder:text-hint focus:outline-none focus:border-accent" />
              <button onClick={addCustom} className="px-3 py-1.5 text-xs font-semibold text-white rounded-lg" style={{ background: "#0019FF" }}>Add</button>
            </div>
          </div>
        )}

        {/* Global chips (Step 4) */}
        {step === 4 && globalRefs.length > 0 && !loading && (
          <div className="pl-10">
            <div className="flex flex-wrap gap-2">
              {globalRefs.map((g, i) => <Chip key={i} label={`${g.name}${g.market ? ` (${g.market})` : ""}`} selected={g.selected} onClick={() => toggleGlobal(i)} />)}
            </div>
            <div className="flex gap-2 mt-3">
              <input value={customInput} onChange={e => setCustomInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addCustom()}
                placeholder="Add another brand..." className="flex-1 px-3 py-1.5 bg-surface border border-main rounded-lg text-xs text-main placeholder:text-hint focus:outline-none focus:border-accent" />
              <button onClick={addCustom} className="px-3 py-1.5 text-xs font-semibold text-white rounded-lg" style={{ background: "#0019FF" }}>Add</button>
            </div>
          </div>
        )}

        {/* Scout videos (Step 5) */}
        {step === 5 && Object.keys(scoutResults).length > 0 && (
          <div className="pl-10 space-y-2">
            {scoutBrands.map(brand => (scoutResults[brand.name] || []).map(v => (
              <VideoCard key={`${brand.name}:${v.videoId}`} video={v} brandName={brand.name} scope={brand.scope}
                accepted={scoutVideoStatus[`${brand.name}:${v.videoId}`] === "accepted"}
                skipped={scoutVideoStatus[`${brand.name}:${v.videoId}`] === "skipped"}
                onAccept={() => setScoutVideoStatus(p => ({ ...p, [`${brand.name}:${v.videoId}`]: "accepted" }))}
                onSkip={() => setScoutVideoStatus(p => ({ ...p, [`${brand.name}:${v.videoId}`]: "skipped" }))} />
            )))}
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-main bg-surface px-5 py-3 flex-shrink-0">
        <div className="max-w-3xl mx-auto flex gap-3 items-end">
          {step === 1 ? (
            <>
              <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKey}
                placeholder="Tell me about your brand..." rows={1}
                className="flex-1 px-3.5 py-2.5 bg-surface border border-main rounded-xl text-sm text-main placeholder:text-hint focus:outline-none focus:border-accent resize-none"
                style={{ maxHeight: 120 }} />
              <button onClick={handleSend} disabled={loading || !input.trim()}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-white disabled:opacity-40" style={{ background: "#0019FF" }}>Send</button>
            </>
          ) : (
            <div className="flex-1 flex justify-between items-center">
              <div className="text-xs text-muted">
                {step === 6 && !saving && (
                  <button onClick={() => router.push("/scout")} className="px-4 py-2 rounded-xl text-xs font-bold text-white" style={{ background: "#0019FF" }}>
                    Go to Scout
                  </button>
                )}
                {saving && <span className="text-hint">Creating your project...</span>}
              </div>
              {step < 6 && (
                <button onClick={() => goToStep(step + 1)} disabled={!canAdvance() || loading}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-white disabled:opacity-40" style={{ background: "#0019FF" }}>
                  {step === 5 ? "Finish" : "Next"}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return <AuthGuard><OnboardingContent /></AuthGuard>;
}
