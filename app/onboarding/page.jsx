"use client";
import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase";
import { useProject } from "@/lib/project-context";
import { useRouter } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";

const STEPS = [
  { num: 1, title: "Tell me about your brand" },
  { num: 2, title: "Local competitors" },
  { num: 3, title: "Global references" },
  { num: 4, title: "Auto-Scout" },
  { num: 5, title: "Framework setup" },
  { num: 6, title: "You're ready!" },
];

const DEFAULT_DIMENSIONS = [
  "Communication Intent", "Brand Archetype", "Tone of Voice",
  "Execution Style", "Funnel Stage", "Rating",
];

/* ---- tiny helpers ---- */
function AIBubble({ text, typing }) {
  return (
    <div className="flex gap-3 items-start animate-fadeIn">
      <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold"
        style={{ background: "#0019FF", color: "#fff" }}>G</div>
      <div className="bg-surface border border-main rounded-2xl rounded-tl-md px-4 py-3 max-w-[520px]">
        {typing ? (
          <span className="flex gap-1 items-center py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-hint animate-pulse" />
            <span className="w-1.5 h-1.5 rounded-full bg-hint animate-pulse" style={{ animationDelay: "0.15s" }} />
            <span className="w-1.5 h-1.5 rounded-full bg-hint animate-pulse" style={{ animationDelay: "0.3s" }} />
          </span>
        ) : (
          <p className="text-sm text-main leading-relaxed whitespace-pre-wrap">{text}</p>
        )}
      </div>
    </div>
  );
}

function UserBubble({ text }) {
  return (
    <div className="flex justify-end animate-fadeIn">
      <div className="rounded-2xl rounded-tr-md px-4 py-3 max-w-[420px]"
        style={{ background: "rgba(0,25,255,0.08)" }}>
        <p className="text-sm text-main leading-relaxed">{text}</p>
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

/* ---- main component ---- */
export default function OnboardingPage() {
  const router = useRouter();
  const { selectProject } = useProject();
  const supabase = createClient();
  const scrollRef = useRef(null);

  // core state
  const [step, setStep] = useState(1);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  // data collected across steps
  const [brandInfo, setBrandInfo] = useState({ name: "", market: "", category: "", audit_goal: "" });
  const [localCompetitors, setLocalCompetitors] = useState([]); // [{name, selected}]
  const [globalReferences, setGlobalReferences] = useState([]); // [{name, market, selected}]
  const [customInput, setCustomInput] = useState("");
  const [customFramework, setCustomFramework] = useState(false);
  const [customDimensions, setCustomDimensions] = useState("");
  const [saving, setSaving] = useState(false);
  const [createdProjectId, setCreatedProjectId] = useState(null);

  // auto-scroll
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  // init step 1 greeting
  useEffect(() => {
    setMessages([{
      role: "ai",
      text: "Welcome to Groundwork! I'm here to help you set up your competitive benchmark.\n\nLet's start with your brand. Tell me:\n- What's your brand name?\n- What market or region do you operate in?\n- What category or industry?\n- What do you want to audit or benchmark?\n\nJust tell me in your own words -- no need for a form."
    }]);
  }, []);

  /* ---- AI call ---- */
  const callAI = async (systemPrompt, userMessage) => {
    const res = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
        max_tokens: 1500,
      }),
    });
    const data = await res.json();
    if (data?.content?.[0]?.text) return data.content[0].text;
    return null;
  };

  /* ---- Step handlers ---- */

  // Step 1: Brand info
  const handleStep1 = async () => {
    if (!input.trim()) return;
    const userMsg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", text: userMsg }]);
    setLoading(true);

    const systemPrompt = `You are the onboarding assistant for Groundwork, a competitive intelligence platform. The user is describing their brand, market, category, and audit goals.

Your job:
1. Extract: brand_name, market, category, audit_goal from their message.
2. Respond conversationally acknowledging what they told you.
3. At the END of your response, add a JSON block on its own line in this exact format:
###JSON###{"brand_name":"...","market":"...","category":"...","audit_goal":"..."}###END###

If any field is unclear, make a reasonable inference from context. Be warm, encouraging, and professional.`;

    const aiText = await callAI(systemPrompt, userMsg);
    setLoading(false);

    if (aiText) {
      // Parse JSON from response
      const jsonMatch = aiText.match(/###JSON###(.+?)###END###/s);
      let parsed = {};
      if (jsonMatch) {
        try { parsed = JSON.parse(jsonMatch[1]); } catch {}
      }
      const cleanText = aiText.replace(/###JSON###.+?###END###/s, "").trim();

      setBrandInfo({
        name: parsed.brand_name || brandInfo.name,
        market: parsed.market || brandInfo.market,
        category: parsed.category || brandInfo.category,
        audit_goal: parsed.audit_goal || brandInfo.audit_goal,
      });

      setMessages(prev => [
        ...prev,
        { role: "ai", text: cleanText + "\n\nWhen you're happy with this, click \"Next\" to move on. Or tell me more to refine." },
      ]);
    }
  };

  // Step 2: Local competitors - request AI suggestions
  const initStep2 = async () => {
    setMessages(prev => [
      ...prev,
      { role: "ai", text: `Great. Now let's identify your local competitors in ${brandInfo.market || "your market"}.\n\nLet me suggest some based on what you've told me...` },
    ]);
    setLoading(true);

    const prompt = `Based on this brand profile, suggest 6-10 local competitors in the same market:
Brand: ${brandInfo.name}
Market: ${brandInfo.market}
Category: ${brandInfo.category}
Goal: ${brandInfo.audit_goal}

Return ONLY a JSON array of competitor names, e.g. ["Competitor A","Competitor B"]. No other text.`;

    const aiText = await callAI("You are a competitive intelligence expert. Return only a JSON array of competitor names.", prompt);
    setLoading(false);

    let suggestions = [];
    if (aiText) {
      try {
        const match = aiText.match(/\[[\s\S]*?\]/);
        if (match) suggestions = JSON.parse(match[0]);
      } catch {}
    }
    if (suggestions.length === 0) suggestions = ["Competitor 1", "Competitor 2", "Competitor 3"];

    setLocalCompetitors(suggestions.map(name => ({ name, selected: true })));
    setMessages(prev => [
      ...prev,
      { role: "ai", text: `Here are my suggestions. Toggle any to include or exclude, and add your own below.` },
    ]);
  };

  // Step 3: Global references - request AI suggestions
  const initStep3 = async () => {
    setMessages(prev => [
      ...prev,
      { role: "ai", text: `Now let's think bigger. Which international brands should you benchmark against?\n\nI'll suggest some global references worth studying...` },
    ]);
    setLoading(true);

    const selectedLocal = localCompetitors.filter(c => c.selected).map(c => c.name);
    const prompt = `Suggest 6-8 international/global brands worth benchmarking for competitive intelligence:
Brand: ${brandInfo.name}
Market: ${brandInfo.market}
Category: ${brandInfo.category}
Local competitors already selected: ${selectedLocal.join(", ")}

Suggest brands from DIFFERENT markets/countries that are leaders or innovators in this category.
Return a JSON array of objects: [{"name":"Brand","market":"Country/Region"}]. No other text.`;

    const aiText = await callAI("You are a global competitive intelligence expert. Return only JSON.", prompt);
    setLoading(false);

    let suggestions = [];
    if (aiText) {
      try {
        const match = aiText.match(/\[[\s\S]*?\]/);
        if (match) suggestions = JSON.parse(match[0]);
      } catch {}
    }
    if (suggestions.length === 0) suggestions = [{ name: "Global Brand 1", market: "US" }, { name: "Global Brand 2", market: "UK" }];

    setGlobalReferences(suggestions.map(s => ({ ...s, selected: true })));
    setMessages(prev => [
      ...prev,
      { role: "ai", text: `Here are my global suggestions. Different markets highlighted -- toggle to include or exclude.` },
    ]);
  };

  // Step 4: Auto-Scout (coming soon)
  const initStep4 = () => {
    setMessages(prev => [
      ...prev,
      { role: "ai", text: `This is where the magic happens. Auto-Scout will automatically search YouTube for content from each brand in your benchmark.\n\nThis feature is coming soon -- for now, you can use Scout manually after setup to discover and save content.` },
    ]);
  };

  // Step 5: Framework
  const initStep5 = () => {
    setMessages(prev => [
      ...prev,
      { role: "ai", text: `Almost done! Let's set up your classification framework.\n\nBy default, Groundwork uses these universal dimensions:\n${DEFAULT_DIMENSIONS.map(d => "- " + d).join("\n")}\n\nThese work great for most audits. You can always customize later in Settings.\n\nWant to add custom dimensions now, or use the defaults?` },
    ]);
  };

  // Step 6: Complete
  const initStep6 = async () => {
    setSaving(true);

    // Create project
    const { data: { session } } = await supabase.auth.getSession();
    const projectId = "proj_" + Date.now();
    const projectName = brandInfo.name ? `${brandInfo.name} Audit` : "New Audit";

    await supabase.from("projects").insert({
      id: projectId,
      name: projectName,
      client_name: brandInfo.name || "",
      description: `${brandInfo.category || ""} competitive benchmark - ${brandInfo.market || ""}. ${brandInfo.audit_goal || ""}`.trim(),
      created_by: session?.user?.email || "",
    });

    // Copy default dropdown_options from template project
    const { data: defaults } = await supabase
      .from("dropdown_options")
      .select("category, value, sort_order")
      .eq("project_id", "proj_sb_bb");

    if (defaults && defaults.length > 0) {
      await supabase.from("dropdown_options").insert(
        defaults.map(d => ({ ...d, project_id: projectId }))
      );
    }

    // Add selected local competitors to dropdown_options
    const selectedLocal = localCompetitors.filter(c => c.selected).map(c => c.name);
    if (selectedLocal.length > 0) {
      // Remove default competitors, insert ours
      await supabase.from("dropdown_options").delete()
        .eq("project_id", projectId).eq("category", "competitor");

      await supabase.from("dropdown_options").insert(
        selectedLocal.map((name, i) => ({
          project_id: projectId,
          category: "competitor",
          value: name,
          sort_order: i,
        }))
      );
    }

    // Add selected global references as a separate category
    const selectedGlobal = globalReferences.filter(g => g.selected).map(g => g.name);
    if (selectedGlobal.length > 0) {
      await supabase.from("dropdown_options").insert(
        selectedGlobal.map((name, i) => ({
          project_id: projectId,
          category: "globalBrand",
          value: name,
          sort_order: i,
        }))
      );
    }

    // Grant access to creator
    if (session?.user) {
      await supabase.from("project_access").insert({
        user_id: session.user.id,
        email: session.user.email,
        project_id: projectId,
      });
    }

    selectProject(projectId, projectName);
    setCreatedProjectId(projectId);
    setSaving(false);

    setMessages(prev => [
      ...prev,
      { role: "ai", text: `Your benchmark is ready!\n\nHere's what we set up:\n- Project: ${projectName}\n- Market: ${brandInfo.market || "Not specified"}\n- Category: ${brandInfo.category || "Not specified"}\n- Local competitors: ${selectedLocal.length}\n- Global references: ${selectedGlobal.length}\n- Framework: ${customFramework ? "Custom" : "Universal defaults"}\n\nYou're all set to start discovering and analyzing content. Where would you like to go first?` },
    ]);
  };

  // Step navigation
  const goNext = () => {
    const nextStep = step + 1;
    if (nextStep > 6) return;
    setStep(nextStep);
    if (nextStep === 2) initStep2();
    if (nextStep === 3) initStep3();
    if (nextStep === 4) initStep4();
    if (nextStep === 5) initStep5();
    if (nextStep === 6) initStep6();
  };

  const canAdvance = () => {
    if (step === 1) return brandInfo.name.length > 0;
    if (step === 2) return localCompetitors.some(c => c.selected);
    if (step === 3) return true;
    if (step === 4) return true;
    if (step === 5) return true;
    return false;
  };

  // Handle send (step 1 only uses free text)
  const handleSend = () => {
    if (step === 1) handleStep1();
  };

  // Add custom competitor/reference
  const addCustom = () => {
    if (!customInput.trim()) return;
    if (step === 2) {
      setLocalCompetitors(prev => [...prev, { name: customInput.trim(), selected: true }]);
    } else if (step === 3) {
      setGlobalReferences(prev => [...prev, { name: customInput.trim(), market: "Custom", selected: true }]);
    }
    setCustomInput("");
  };

  // toggle competitor/reference
  const toggleLocal = (idx) => {
    setLocalCompetitors(prev => prev.map((c, i) => i === idx ? { ...c, selected: !c.selected } : c));
  };
  const toggleGlobal = (idx) => {
    setGlobalReferences(prev => prev.map((g, i) => i === idx ? { ...g, selected: !g.selected } : g));
  };

  return (
    <AuthGuard>
      <div className="min-h-screen flex flex-col" style={{ background: "var(--bg)" }}>
        {/* Header */}
        <div className="px-6 py-3 flex items-center justify-between"
          style={{ background: "#0a0f3c", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-3">
            <img src="/knots-dots-logo.png" alt="K&D" style={{ height: 20 }} />
            <span className="text-[10px] font-bold text-white/60 uppercase tracking-[0.15em]">Groundwork</span>
            <div className="w-px h-4 mx-2" style={{ background: "rgba(255,255,255,0.1)" }} />
            <span className="text-xs text-white/80 font-medium">{STEPS[step - 1]?.title}</span>
          </div>
          <span className="text-[10px] text-white/40">Step {step} of 6</span>
        </div>

        {/* Progress bar */}
        <div className="h-1 w-full" style={{ background: "rgba(0,25,255,0.08)" }}>
          <div className="h-full transition-all duration-500 ease-out"
            style={{ width: `${(step / 6) * 100}%`, background: "#0019FF" }} />
        </div>

        {/* Chat area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-8 max-w-3xl mx-auto w-full">
          <div className="space-y-4">
            {messages.map((msg, i) => (
              msg.role === "ai"
                ? <AIBubble key={i} text={msg.text} />
                : <UserBubble key={i} text={msg.text} />
            ))}
            {loading && <AIBubble typing />}

            {/* Step 2: Competitor chips */}
            {step === 2 && localCompetitors.length > 0 && !loading && (
              <div className="pl-10 animate-fadeIn">
                <div className="flex flex-wrap gap-2 mb-3">
                  {localCompetitors.map((c, i) => (
                    <Chip key={i} label={c.name} selected={c.selected} onClick={() => toggleLocal(i)} />
                  ))}
                </div>
                <div className="flex gap-2 items-center">
                  <input value={customInput} onChange={e => setCustomInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && addCustom()}
                    placeholder="Add a competitor..."
                    className="px-3 py-1.5 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[#0019FF] w-48" />
                  <button onClick={addCustom}
                    className="px-3 py-1.5 text-xs font-medium text-[#0019FF] hover:bg-[rgba(0,25,255,0.05)] rounded-lg transition">
                    + Add
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Global reference chips */}
            {step === 3 && globalReferences.length > 0 && !loading && (
              <div className="pl-10 animate-fadeIn">
                <div className="flex flex-wrap gap-2 mb-3">
                  {globalReferences.map((g, i) => (
                    <Chip key={i}
                      label={`${g.name}${g.market ? ` (${g.market})` : ""}`}
                      selected={g.selected}
                      onClick={() => toggleGlobal(i)} />
                  ))}
                </div>
                <div className="flex gap-2 items-center">
                  <input value={customInput} onChange={e => setCustomInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && addCustom()}
                    placeholder="Add a global brand..."
                    className="px-3 py-1.5 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[#0019FF] w-48" />
                  <button onClick={addCustom}
                    className="px-3 py-1.5 text-xs font-medium text-[#0019FF] hover:bg-[rgba(0,25,255,0.05)] rounded-lg transition">
                    + Add
                  </button>
                </div>
              </div>
            )}

            {/* Step 4: Coming soon mock */}
            {step === 4 && !loading && (
              <div className="pl-10 animate-fadeIn">
                <div className="bg-surface border border-main rounded-xl p-5 max-w-md">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#D4E520" }} />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Coming Soon</span>
                  </div>
                  <p className="text-sm text-main mb-4">Auto-Scout will search YouTube for content from each brand in your benchmark.</p>
                  {/* Mock progress */}
                  <div className="space-y-2">
                    {localCompetitors.filter(c => c.selected).slice(0, 4).map((c, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="w-32 text-xs text-muted truncate">{c.name}</div>
                        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(0,25,255,0.08)" }}>
                          <div className="h-full rounded-full" style={{
                            width: `${30 + i * 20}%`,
                            background: "linear-gradient(90deg, #0019FF, #D4E520)",
                            opacity: 0.5,
                          }} />
                        </div>
                        <span className="text-[10px] text-hint">--</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-hint mt-3">For now, use Scout manually after setup.</p>
                </div>
              </div>
            )}

            {/* Step 5: Framework options */}
            {step === 5 && !loading && (
              <div className="pl-10 animate-fadeIn">
                <div className="space-y-3">
                  <button onClick={() => setCustomFramework(false)}
                    className={`w-full text-left px-4 py-3 rounded-xl border transition ${
                      !customFramework ? "border-[#0019FF] bg-[rgba(0,25,255,0.05)]" : "border-main hover:border-[#0019FF]/40"
                    }`}>
                    <p className="text-sm font-semibold text-main">Use universal defaults</p>
                    <p className="text-xs text-muted mt-0.5">{DEFAULT_DIMENSIONS.join(", ")}</p>
                  </button>
                  <button onClick={() => setCustomFramework(true)}
                    className={`w-full text-left px-4 py-3 rounded-xl border transition ${
                      customFramework ? "border-[#0019FF] bg-[rgba(0,25,255,0.05)]" : "border-main hover:border-[#0019FF]/40"
                    }`}>
                    <p className="text-sm font-semibold text-main">Add custom dimensions</p>
                    <p className="text-xs text-muted mt-0.5">Portraits, Journey Phases, Entry Doors, etc.</p>
                  </button>
                  {customFramework && (
                    <div className="mt-2">
                      <input value={customDimensions} onChange={e => setCustomDimensions(e.target.value)}
                        placeholder="E.g., Portraits, Journey Phase, Entry Door..."
                        className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[#0019FF]" />
                      <p className="text-[10px] text-hint mt-1">Separate with commas. You can customize this later in Settings.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Step 6: Celebration + links */}
            {step === 6 && !saving && createdProjectId && (
              <div className="pl-10 animate-fadeIn">
                {/* Celebration */}
                <div className="flex items-center gap-3 mb-6">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center"
                      style={{ background: "#D4E520" }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0a0f3c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                    {/* sparkle decorations */}
                    <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full animate-ping" style={{ background: "#D4E520", opacity: 0.5 }} />
                    <div className="absolute -bottom-1 -left-1 w-2 h-2 rounded-full animate-ping" style={{ background: "#0019FF", opacity: 0.4, animationDelay: "0.3s" }} />
                  </div>
                  <div>
                    <p className="text-lg font-bold text-main">Benchmark created</p>
                    <p className="text-xs text-muted">Your project is ready to go</p>
                  </div>
                </div>

                {/* Quick links */}
                <div className="grid grid-cols-3 gap-3 max-w-md">
                  <button onClick={() => router.push("/scout")}
                    className="px-4 py-3 rounded-xl text-center transition hover:opacity-90"
                    style={{ background: "#0019FF", color: "#fff" }}>
                    <svg className="mx-auto mb-1.5" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <span className="text-xs font-semibold">Scout</span>
                  </button>
                  <button onClick={() => router.push("/audit")}
                    className="px-4 py-3 rounded-xl text-center border border-main hover:border-[#0019FF] transition">
                    <svg className="mx-auto mb-1.5 text-main" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
                    <span className="text-xs font-semibold text-main">Audit</span>
                  </button>
                  <button onClick={() => router.push("/dashboard")}
                    className="px-4 py-3 rounded-xl text-center border border-main hover:border-[#0019FF] transition">
                    <svg className="mx-auto mb-1.5 text-main" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
                    <span className="text-xs font-semibold text-main">Dashboard</span>
                  </button>
                </div>
              </div>
            )}
            {step === 6 && saving && (
              <div className="pl-10 animate-fadeIn">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-[#0019FF] border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm text-muted">Setting up your project...</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-main px-6 py-4 max-w-3xl mx-auto w-full">
          {step === 1 ? (
            /* Step 1: text input */
            <div className="flex gap-3">
              <input value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !loading && handleSend()}
                placeholder="Tell me about your brand..."
                disabled={loading}
                className="flex-1 px-4 py-2.5 bg-surface border border-main rounded-xl text-sm text-main focus:outline-none focus:border-[#0019FF] disabled:opacity-50" />
              <button onClick={handleSend} disabled={loading || !input.trim()}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 transition hover:opacity-90"
                style={{ background: "#0019FF" }}>
                Send
              </button>
              {brandInfo.name && (
                <button onClick={goNext}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold transition hover:opacity-90"
                  style={{ background: "#D4E520", color: "#0a0f3c" }}>
                  Next
                </button>
              )}
            </div>
          ) : step < 6 ? (
            /* Steps 2-5: next button */
            <div className="flex justify-between items-center">
              <button onClick={() => setStep(step - 1)}
                className="px-4 py-2 text-sm text-muted hover:text-main transition">
                Back
              </button>
              <button onClick={goNext} disabled={!canAdvance() || loading}
                className="px-6 py-2.5 rounded-xl text-sm font-semibold transition hover:opacity-90 disabled:opacity-40"
                style={{ background: "#D4E520", color: "#0a0f3c" }}>
                {step === 5 ? "Finish setup" : "Next"}
              </button>
            </div>
          ) : (
            /* Step 6: done */
            <div className="text-center">
              <p className="text-xs text-hint">Setup complete. Choose where to start above, or close this page.</p>
            </div>
          )}
        </div>
      </div>
    </AuthGuard>
  );
}
