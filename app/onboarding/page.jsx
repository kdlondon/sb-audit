"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { useProject } from "@/lib/project-context";
import { useRouter } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";

/* ─── Constants ─── */
const STEPS = [
  { num: 1, title: "Brand Profile" },
  { num: 2, title: "Brand Summary" },
  { num: 3, title: "Local Competitors" },
  { num: 4, title: "Global References" },
  { num: 5, title: "Auto-Scout" },
  { num: 6, title: "You're Ready!" },
];

const DEFAULT_DIMENSIONS = [
  { name: "Communication Intent", values: "Brand Hero, Brand Tactical, Client Testimonials, Product, Innovation, Beyond Banking", description: "The strategic purpose of the communication" },
  { name: "Brand Archetype", values: "Innocent, Explorer, Sage, Hero, Outlaw, Magician, Regular Guy, Lover, Jester, Caregiver, Creator, Ruler", description: "Jungian archetype the brand embodies" },
  { name: "Tone of Voice", values: "Authoritative, Empathetic, Aspirational, Peer-level, Institutional, Playful, Urgent", description: "Emotional register of the communication" },
  { name: "Execution Style", values: "Testimonial, Documentary, Manifesto, Product demo, Humor, Slice of life, Animation, Data-driven", description: "Creative format and production approach" },
  { name: "Funnel Stage", values: "Awareness, Consideration, Conversion, Retention, Advocacy", description: "Where in the customer journey it targets" },
  { name: "Rating", values: "1, 2, 3, 4, 5", description: "Overall quality score" },
];

const BRAND_QUESTIONS = [
  { key: "proposition", question: "What's your value proposition? What promise does your brand make to customers?" },
  { key: "differentiator", question: "What makes you different from competitors? What's your unique edge?" },
  { key: "tone", question: "What tone does your brand use? (e.g., professional, playful, authoritative, warm)" },
  { key: "target", question: "Who is your target audience? Describe your ideal customer." },
  { key: "yearsInMarket", question: "How long has your company been in the market?" },
  { key: "market", question: "What market or country do you primarily operate in?" },
  { key: "category", question: "What category or industry are you in?" },
];

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
                .replace(/\*([^*]+)\*/g, "<em>$1</em>")
                .replace(/`([^`]+)`/g, "<code class='px-1 py-0.5 bg-surface2 rounded text-xs'>$1</code>");
              const isBullet = /^\s*[-•–]\s/.test(line);
              const isNumbered = /^\s*\d+[\.\)]\s/.test(line);
              return <p key={li} className={`${isBullet || isNumbered ? "pl-3" : ""} ${li > 0 && line ? "mt-1.5" : !line ? "mt-2" : ""}`}
                dangerouslySetInnerHTML={{ __html: formatted || "&nbsp;" }} />;
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function UserBubble({ text, isFile, fileName }) {
  return (
    <div className="flex justify-end animate-fadeIn">
      <div className="rounded-2xl rounded-tr-md px-4 py-3 max-w-[420px]"
        style={{ background: isFile ? "rgba(0,25,255,0.12)" : "rgba(0,25,255,0.08)" }}>
        {isFile ? (
          <div className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-accent flex-shrink-0"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            <span className="text-sm text-main font-medium">{fileName || text}</span>
          </div>
        ) : (
          <p className="text-sm text-main leading-relaxed whitespace-pre-wrap">{text}</p>
        )}
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

function VideoCard({ video, brandName, brandScope, onAccept, onSkip, accepted, skipped }) {
  const [expanded, setExpanded] = useState(false);
  const formatDuration = (iso) => {
    if (!iso) return "";
    const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!m) return "";
    const h = parseInt(m[1] || 0), min = parseInt(m[2] || 0), s = parseInt(m[3] || 0);
    return h > 0 ? `${h}:${String(min).padStart(2,"0")}:${String(s).padStart(2,"0")}` : `${min}:${String(s).padStart(2,"0")}`;
  };
  const formatViews = (n) => {
    if (!n) return "N/A";
    if (n >= 1000000) return (n/1000000).toFixed(1) + "M";
    if (n >= 1000) return (n/1000).toFixed(0) + "K";
    return String(n);
  };
  const done = accepted || skipped;
  return (
    <div className={`border border-main rounded-xl overflow-hidden transition ${done ? "opacity-40" : ""}`}>
      {/* Compact view — click to expand */}
      <div className={`flex gap-3 p-3 cursor-pointer hover:bg-surface2 transition ${expanded ? "border-b border-main" : ""}`} onClick={() => !done && setExpanded(!expanded)}>
        <div className="w-20 h-14 flex-shrink-0 rounded-lg overflow-hidden bg-surface2 relative">
          {video.thumbnail && <img src={video.thumbnail} alt="" className="w-full h-full object-cover" />}
          {video.duration && <span className="absolute bottom-0.5 right-0.5 bg-black/80 text-white text-[8px] px-1 py-0.5 rounded font-mono">{formatDuration(video.duration)}</span>}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-main line-clamp-1">{video.title}</p>
          <p className="text-[10px] text-muted">{brandName} &middot; {video.year || ""} &middot; {brandScope === "global" ? "Global" : "Local"}</p>
          <p className="text-[10px] text-hint">{video.channel} &middot; {formatViews(video.viewCount)} views</p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {!done && <>
            <button onClick={e => { e.stopPropagation(); onAccept(); }}
              className="px-2 py-1 rounded text-[10px] font-semibold text-white hover:opacity-90" style={{ background: "#0019FF" }}>&#10003;</button>
            <button onClick={e => { e.stopPropagation(); onSkip(); }}
              className="px-2 py-1 rounded text-[10px] text-muted border border-main hover:text-main">&times;</button>
          </>}
          {accepted && <span className="text-[10px] text-green-600 font-semibold">Added</span>}
          {skipped && <span className="text-[10px] text-hint">Skipped</span>}
        </div>
      </div>
      {/* Expanded — video player */}
      {expanded && !done && (
        <div className="p-3">
          <iframe width="100%" height="240" src={`https://www.youtube.com/embed/${video.videoId}?rel=0`}
            frameBorder="0" allowFullScreen className="rounded-lg w-full" />
        </div>
      )}
    </div>
  );
}

/* ─── Main Component ─── */
export default function OnboardingPage() {
  const router = useRouter();
  const { selectProject } = useProject();
  const supabase = createClient();
  const scrollRef = useRef(null);
  const textareaRef = useRef(null);

  // Core state
  const [step, setStep] = useState(1);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  // Step 1 - Brand profile
  const [brandProfile, setBrandProfile] = useState({
    name: "", market: "", category: "", proposition: "",
    differentiator: "", tone: "", target: "", yearsInMarket: "",
  });
  const [questionIndex, setQuestionIndex] = useState(0);
  const [exchangeCount, setExchangeCount] = useState(0);

  // Step 2 - Dimensions
  const [customDimensions, setCustomDimensions] = useState([]);
  const [showDimBuilder, setShowDimBuilder] = useState(false);
  const [dimName, setDimName] = useState("");
  const [dimValues, setDimValues] = useState("");
  const [dimDesc, setDimDesc] = useState("");

  // Step 3 & 4 - Competitors
  const [localCompetitors, setLocalCompetitors] = useState([]);
  const [globalReferences, setGlobalReferences] = useState([]);
  const [customInput, setCustomInput] = useState("");

  // Step 5 - Auto-Scout
  const [scoutBrands, setScoutBrands] = useState([]);
  const [scoutProgress, setScoutProgress] = useState({});
  const [scoutResults, setScoutResults] = useState({});
  const [scoutVideoStatus, setScoutVideoStatus] = useState({});
  const [scoutRunning, setScoutRunning] = useState(false);
  const [scoutDone, setScoutDone] = useState(false);
  const [importCount, setImportCount] = useState(0);

  // Step 6
  const [createdProjectId, setCreatedProjectId] = useState(null);
  const [saving, setSaving] = useState(false);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading, scoutResults, scoutProgress]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + "px";
    }
  }, [input]);

  // Init greeting
  useEffect(() => {
    addAI("Welcome to Groundwork! Let's set up your competitive benchmark.\n\nTell me about your brand -- what's the name and what do you do?");
  }, []);

  /* ─── Helpers ─── */
  const addAI = (text) => setMessages(prev => [...prev, { role: "ai", text }]);
  const addUser = (text) => setMessages(prev => [...prev, { role: "user", text }]);

  const callAI = async (systemPrompt, userMessage) => {
    const res = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
        max_tokens: 1500,
        skip_framework: true,
      }),
    });
    const data = await res.json();
    return data?.content?.[0]?.text || null;
  };

  /* ─── Step 1: Conversational Brand Profile ─── */
  const handleStep1Send = async () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    addUser(text);
    setLoading(true);

    const isSkip = text.toLowerCase() === "skip";
    const isDone = text.toLowerCase() === "done";
    const newExchangeCount = exchangeCount + 1;
    setExchangeCount(newExchangeCount);

    if (isDone && brandProfile.name) {
      setLoading(false);
      goToStep(2);
      return;
    }

    if (!isSkip) {
      // Extract structured data from user response
      const currentQ = questionIndex > 0 ? BRAND_QUESTIONS[questionIndex - 1] : null;
      const extractPrompt = `You are extracting brand profile data from a user's response. The user is setting up a competitive benchmark.

Current brand profile so far: ${JSON.stringify(brandProfile)}
${currentQ ? `The question they were answering: "${currentQ.question}" (field: ${currentQ.key})` : "This is their initial introduction of their brand."}

From the user's response, extract any of these fields:
- name: brand/company name
- market: country or region
- category: industry/category
- proposition: value proposition
- differentiator: what makes them unique
- tone: brand tone of voice
- target: target audience
- yearsInMarket: how long in business

Return ONLY valid JSON with the fields you can extract. Example: {"name":"Acme","category":"Fintech"}
If nothing extractable, return {}`;

      const extracted = await callAI(extractPrompt, text);
      if (extracted) {
        try {
          const match = extracted.match(/\{[\s\S]*?\}/);
          if (match) {
            const parsed = JSON.parse(match[0]);
            setBrandProfile(prev => {
              const updated = { ...prev };
              Object.keys(parsed).forEach(k => {
                if (parsed[k] && k in updated) updated[k] = parsed[k];
              });
              return updated;
            });
          }
        } catch {}
      }
    }

    // Determine next question
    let nextQIdx = isSkip ? questionIndex : questionIndex;
    if (!isSkip && questionIndex > 0) nextQIdx = questionIndex; // already incremented

    // Find next unanswered question
    let nextQuestion = null;
    for (let i = nextQIdx; i < BRAND_QUESTIONS.length; i++) {
      const q = BRAND_QUESTIONS[i];
      // Skip questions already answered
      if (brandProfile[q.key] && !isSkip) { continue; }
      if (isSkip && i === questionIndex - 1) { continue; } // skip current
      nextQuestion = q;
      setQuestionIndex(i + 1);
      break;
    }

    if (isDone || newExchangeCount >= 7 || !nextQuestion) {
      setLoading(false);
      addAI("Noted. We have a solid picture of your brand now — click Next to continue.");
      return;
    }

    // Generate conversational acknowledgment + ask next question
    if (isSkip) {
      setLoading(false);
      addAI(nextQuestion.question);
    } else {
      const responsePrompt = `You are a brand strategist onboarding a new client. The user just answered a question about their brand.
Respond in EXACTLY 2 sentences:
1. A brief note connecting their answer to the strategic context (DO NOT start with "I understand" or "Noted" — vary your openings, e.g. "That positions you in...", "A 3-year track record suggests...", "Eco-friendly premium is a clear differentiator in...")
2. Then ask: "${nextQuestion.question}"

No exclamation marks. No congratulations. Direct and analytical.`;
      const response = await callAI(responsePrompt, text);
      setLoading(false);
      if (response) {
        addAI(response.replace(/###.*?###/g, "").trim());
      } else {
        addAI(nextQuestion.question);
      }
    }
  };

  /* ─── Step 2: Brand Summary + Dimensions ─── */
  const initStep2 = () => {
    const bp = brandProfile;
    const summaryLines = [
      bp.name && `Name: ${bp.name}`,
      bp.market && `Market: ${bp.market}`,
      bp.category && `Category: ${bp.category}`,
      bp.proposition && `Value Proposition: ${bp.proposition}`,
      bp.differentiator && `Differentiator: ${bp.differentiator}`,
      bp.tone && `Tone: ${bp.tone}`,
      bp.target && `Target Audience: ${bp.target}`,
      bp.yearsInMarket && `Years in Market: ${bp.yearsInMarket}`,
    ].filter(Boolean).join("\n");

    addAI(`Here's what I learned about your brand:\n\n${summaryLines || "(No details collected yet)"}\n\nI'll use these universal dimensions to analyze competitors:\n${DEFAULT_DIMENSIONS.map(d => `- ${d.name}`).join("\n")}\n\nYou can confirm these defaults or add custom dimensions below.`);
  };

  const addCustomDimension = () => {
    if (!dimName.trim()) return;
    setCustomDimensions(prev => [...prev, {
      name: dimName.trim(),
      values: dimValues.trim(),
      description: dimDesc.trim(),
    }]);
    setDimName("");
    setDimValues("");
    setDimDesc("");
  };

  const removeCustomDimension = (idx) => {
    setCustomDimensions(prev => prev.filter((_, i) => i !== idx));
  };

  /* ─── Step 3: Local Competitors ─── */
  const initStep3 = async () => {
    addAI(`Now let's identify your local competitors in ${brandProfile.market || "your market"}.\n\nLet me suggest some based on what you've told me...`);
    setLoading(true);

    const prompt = `Based on this brand profile, suggest 6-8 local competitors in the same market:
Brand: ${brandProfile.name}
Market: ${brandProfile.market}
Category: ${brandProfile.category}
Proposition: ${brandProfile.proposition}

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
    addAI("Here are my suggestions. Toggle any to include or exclude, and add your own below.");
  };

  /* ─── Step 4: Global References ─── */
  const initStep4 = async () => {
    addAI(`Now let's think bigger. Which international brands should you benchmark against?\n\nI'll suggest some global references worth studying...`);
    setLoading(true);

    const selectedLocal = localCompetitors.filter(c => c.selected).map(c => c.name);
    const prompt = `Suggest 6-8 international/global brands worth benchmarking for competitive intelligence:
Brand: ${brandProfile.name}
Market: ${brandProfile.market}
Category: ${brandProfile.category}
Local competitors: ${selectedLocal.join(", ")}

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
    addAI("Here are my global suggestions. Toggle to include or exclude, and add your own.");
  };

  /* ─── Step 5: Auto-Scout ─── */
  const initStep5 = async () => {
    const selectedLocal = localCompetitors.filter(c => c.selected).map(c => ({ name: c.name, scope: "local" }));
    const selectedGlobal = globalReferences.filter(g => g.selected).map(g => ({ name: g.name, scope: "global" }));
    const allBrands = [...selectedLocal, ...selectedGlobal];

    if (allBrands.length === 0) {
      addAI("No competitors selected. You can add them later from Scout. Click [Continue] to finish.");
      return;
    }

    // Limit to max 5 local + 5 global brands, 1 best piece each = max 10 total
    const localBrands = allBrands.filter(b => b.scope === "local").slice(0, 5);
    const globalBrandsLimited = allBrands.filter(b => b.scope === "global").slice(0, 5);
    const limitedBrands = [...localBrands, ...globalBrandsLimited];
    setScoutBrands(limitedBrands);
    addAI(`Searching ${limitedBrands.length} brands for their best content...`);
    setScoutRunning(true);

    let totalImported = 0;

    for (let i = 0; i < limitedBrands.length; i++) {
      const brand = limitedBrands[i];
      setScoutProgress(prev => ({ ...prev, [brand.name]: "searching" }));

      try {
        const searchQuery = `${brand.name} ${brandProfile.category || ""} ad commercial campaign`;
        const res = await fetch("/api/youtube-scout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "search",
            query: searchQuery.trim(),
            maxResults: 1,
            publishedAfter: new Date(Date.now() - 730 * 86400000).toISOString(),
          }),
        });
        const data = await res.json();
        const videos = (data.videos || []).slice(0, 1);

        setScoutResults(prev => ({ ...prev, [brand.name]: videos }));
        setScoutProgress(prev => ({ ...prev, [brand.name]: `found ${videos.length}` }));

        // Initialize video statuses
        const statuses = {};
        videos.forEach(v => { statuses[`${brand.name}:${v.videoId}`] = "pending"; });
        setScoutVideoStatus(prev => ({ ...prev, ...statuses }));

        addAI(`Searching ${brand.name}... Found ${videos.length} pieces`);
      } catch (err) {
        setScoutProgress(prev => ({ ...prev, [brand.name]: "error" }));
        addAI(`Could not search ${brand.name}: ${err.message || "API error"}`);
      }
    }

    setScoutRunning(false);
    setScoutDone(true);
  };

  const handleAcceptVideo = (brandName, video, scope) => {
    const key = `${brandName}:${video.videoId}`;
    setScoutVideoStatus(prev => ({ ...prev, [key]: "accepted" }));
    setImportCount(prev => prev + 1);
  };

  const handleSkipVideo = (brandName, videoId) => {
    const key = `${brandName}:${videoId}`;
    setScoutVideoStatus(prev => ({ ...prev, [key]: "skipped" }));
  };

  /* ─── Step 6: Finalize & Save ─── */
  const initStep6 = async () => {
    setSaving(true);

    // Gather accepted videos
    const acceptedVideos = [];
    scoutBrands.forEach(brand => {
      const videos = scoutResults[brand.name] || [];
      videos.forEach(v => {
        const key = `${brand.name}:${v.videoId}`;
        if (scoutVideoStatus[key] === "accepted") {
          acceptedVideos.push({ ...v, brandName: brand.name, scope: brand.scope });
        }
      });
    });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userEmail = session?.user?.email || "";
      const projectId = "proj_" + Date.now();
      const projectName = brandProfile.name ? `${brandProfile.name} Audit` : "New Audit";
      const slug = (brandProfile.name || "brand").toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-");

      // Create client in clients table
      let clientId = null;
      const { data: existingClient } = await supabase.from("clients").select("id").eq("slug", slug).single();
      if (existingClient) {
        clientId = existingClient.id;
      } else {
        const { data: newClient } = await supabase.from("clients").insert({
          name: brandProfile.name || "New Client",
          slug,
          industry: brandProfile.category || "",
          country: brandProfile.market || "",
          status: "trial",
          tier: "starter",
          notes: JSON.stringify(brandProfile),
          primary_contact_email: userEmail,
          created_by: userEmail,
        }).select().single();
        if (newClient) clientId = newClient.id;
      }

      // Create project linked to client
      await supabase.from("projects").insert({
        id: projectId,
        name: projectName,
        client_name: brandProfile.name || "",
        client_id: clientId,
        description: [
          brandProfile.category && `${brandProfile.category}`,
          brandProfile.market && `Market: ${brandProfile.market}`,
          brandProfile.proposition && `Proposition: ${brandProfile.proposition}`,
          brandProfile.target && `Target: ${brandProfile.target}`,
        ].filter(Boolean).join(" · ") || "",
        created_by: userEmail,
      });

      // Log activity
      if (clientId) {
        await supabase.from("client_activity_log").insert({
          client_id: clientId,
          action: "project_created",
          description: `Project "${projectName}" created via onboarding`,
          performed_by: userEmail,
        });
      }

      // Create universal default dropdown_options (NOT copied from any template)
      const defaultOpts = [
        ...["Brand Hero","Brand Tactical","Client Testimonials","Product","Innovation","Beyond Banking"].map((v,i) => ({category:"communicationIntent",value:v,sort_order:i})),
        ...["Innocent","Explorer","Sage","Hero","Outlaw","Magician","Regular Guy","Lover","Jester","Caregiver","Creator","Ruler"].map((v,i) => ({category:"brandArchetype",value:v,sort_order:i})),
        ...["Authoritative","Empathetic","Aspirational","Peer-level","Institutional","Playful","Urgent"].map((v,i) => ({category:"toneOfVoice",value:v,sort_order:i})),
        ...["Testimonial","Documentary","Manifesto","Product demo","Humor","Slice of life","Animation","Data-driven"].map((v,i) => ({category:"executionStyle",value:v,sort_order:i})),
        ...["Awareness","Consideration","Conversion","Retention","Advocacy"].map((v,i) => ({category:"funnel",value:v,sort_order:i})),
        ...["Video","Print","Digital","Social","OOH","Website","Blog","Event"].map((v,i) => ({category:"type",value:v,sort_order:i})),
      ];
      await supabase.from("dropdown_options").insert(
        defaultOpts.map(d => ({ ...d, project_id: projectId }))
      );

      // Save competitors to dropdown_options
      const selectedLocal = localCompetitors.filter(c => c.selected).map(c => c.name);
      if (selectedLocal.length > 0) {
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

      // Save global references
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

      // Import accepted videos
      for (let vi = 0; vi < acceptedVideos.length; vi++) {
        const vid = acceptedVideos[vi];
        const table = vid.scope === "global" ? "audit_global" : "audit_entries";
        const entry = {
          id: String(Date.now()) + "_" + vi,
          project_id: projectId,
          created_by: userEmail,
          updated_at: new Date().toISOString(),
          url: `https://www.youtube.com/watch?v=${vid.videoId}`,
          image_url: vid.thumbnail || "",
          description: vid.title || "",
          year: vid.year || "",
          type: "Video",
          synopsis: vid.description || "",
        };
        if (vid.scope === "global") {
          entry.brand = vid.brandName;
          entry.country = vid.market || brandProfile.market || "";
        } else {
          entry.competitor = vid.brandName;
        }
        const { error } = await supabase.from(table).insert(entry);
        if (error) console.error("Insert error:", error);
      }

      // Grant access
      if (session?.user) {
        await supabase.from("project_access").insert({
          user_id: session.user.id,
          email: session.user.email,
          project_id: projectId,
        });
      }

      selectProject(projectId, projectName);
      setCreatedProjectId(projectId);

      const localCount = selectedLocal.length;
      const globalCount = selectedGlobal.length;
      addAI(`All done! ${acceptedVideos.length} entries imported across ${localCount + globalCount} brands.\n\nTip: Go to Audit and click \"Analyze with AI\" on each entry to auto-classify with your framework.`);
    } catch (err) {
      addAI(`Error saving project: ${err.message || "Unknown error"}. Please try again.`);
    }

    setSaving(false);
  };

  /* ─── Step Navigation ─── */
  const goToStep = (nextStep) => {
    setStep(nextStep);
    if (nextStep === 2) initStep2();
    if (nextStep === 3) initStep3();
    if (nextStep === 4) initStep4();
    if (nextStep === 5) initStep5();
    if (nextStep === 6) initStep6();
  };

  const canAdvance = () => {
    if (step === 1) return brandProfile.name.length > 0 && brandProfile.market.length > 0;
    if (step === 2) return true;
    if (step === 3) return true;
    if (step === 4) return true;
    if (step === 5) return scoutDone || !scoutRunning;
    return false;
  };

  // Handle send
  const handleSend = () => {
    if (loading) return;
    if (step === 1) handleStep1Send();
  };

  // Drag & drop state
  const [dragOver, setDragOver] = useState(false);

  // File upload handler — analyze with AI and extract brand info
  const handleFileUpload = async (files) => {
    if (!files.length || loading) return;
    // Process all files
    for (const file of files) {
      await processSingleFile(file);
    }
  };

  const processSingleFile = async (file) => {
    setLoading(true);

    // Show file in chat
    const isImage = file.type.startsWith("image/");
    const fileName = file.name;
    setMessages(prev => [...prev, { role: "user", text: `📎 ${fileName}`, isFile: true, fileName }]);

    try {
      const systemPrompt = `You are a professional brand strategist helping set up a competitive benchmark. Analyze the uploaded content and extract brand information: name, market, category, value proposition, differentiator, tone, target audience. Be direct and professional. Also return a JSON block: {"name":"...","market":"...","category":"...","proposition":"...","differentiator":"...","tone":"...","target":"..."}`;

      let messageContent;
      if (isImage) {
        // Send image as base64 to Claude (vision capability)
        const buf = await file.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let binary = ""; for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
        const b64 = btoa(binary);
        const mediaType = file.type || "image/png";
        messageContent = [
          { type: "image", source: { type: "base64", media_type: mediaType, data: b64 } },
          { type: "text", text: `This is an image file called "${fileName}". Extract any brand information visible in it.` },
        ];
      } else {
        // Text/PDF — read as text
        let fileContent = "";
        try { fileContent = await file.text(); } catch { fileContent = ""; }
        messageContent = `Here is the content from "${fileName}":\n\n${fileContent.slice(0, 6000)}\n\nExtract brand information.`;
      }

      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          max_tokens: 1500,
          skip_framework: true,
          system: systemPrompt,
          messages: [{ role: "user", content: messageContent }],
        }),
      });
      const result = await res.json();
      const aiText = result.content?.[0]?.text || "";

      // Try to extract JSON from response
      const jsonMatch = aiText.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        try {
          const extracted = JSON.parse(jsonMatch[0]);
          setBrandProfile(prev => {
            const updated = { ...prev };
            Object.entries(extracted).forEach(([k, v]) => { if (v && !prev[k]) updated[k] = v; });
            return updated;
          });
        } catch {}
      }

      // Don't repeat the full analysis — just confirm and move on
      const fieldsFound = [];
      if (brandProfile.name || jsonMatch) fieldsFound.push("name");
      if (brandProfile.market) fieldsFound.push("market");
      if (brandProfile.category) fieldsFound.push("category");
      if (brandProfile.proposition) fieldsFound.push("proposition");
      if (brandProfile.differentiator) fieldsFound.push("differentiator");
      if (brandProfile.tone) fieldsFound.push("tone");
      if (brandProfile.target) fieldsFound.push("target");

      const unanswered = BRAND_QUESTIONS.find(q => !brandProfile[q.key]);
      if (unanswered) {
        addAI(`Got it — extracted ${fieldsFound.length} data points from your file. Moving on: ${unanswered.question}`);
        setQuestionIndex(BRAND_QUESTIONS.indexOf(unanswered) + 1);
      } else {
        addAI(`Got it — I have a complete picture from your file. Click Next to continue.`);
      }
    } catch (err) {
      addAI(`I had trouble processing that file. No worries — just describe your brand and I'll take it from there.`);
    }
    setLoading(false);
  };

  // Textarea keydown
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Add custom competitor/reference
  const addCustomCompetitor = () => {
    if (!customInput.trim()) return;
    if (step === 3) {
      setLocalCompetitors(prev => [...prev, { name: customInput.trim(), selected: true }]);
    } else if (step === 4) {
      setGlobalReferences(prev => [...prev, { name: customInput.trim(), market: "Custom", selected: true }]);
    }
    setCustomInput("");
  };

  const toggleLocal = (idx) => setLocalCompetitors(prev => prev.map((c, i) => i === idx ? { ...c, selected: !c.selected } : c));
  const toggleGlobal = (idx) => setGlobalReferences(prev => prev.map((g, i) => i === idx ? { ...g, selected: !g.selected } : g));

  return (
    <AuthGuard>
      <div className="h-screen flex flex-col" style={{ background: "var(--bg)" }}>
        {/* Header */}
        <div className="flex-shrink-0 px-6 py-3 flex items-center justify-between"
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
        <div className="flex-shrink-0 h-1 w-full" style={{ background: "rgba(0,25,255,0.08)" }}>
          <div className="h-full transition-all duration-500 ease-out"
            style={{ width: `${(step / 6) * 100}%`, background: "#0019FF" }} />
        </div>

        {/* Messages area - scrollable */}
        <div ref={scrollRef} className={`flex-1 overflow-y-auto px-6 py-8 transition ${dragOver ? "ring-2 ring-[#0019FF] ring-inset bg-[rgba(0,25,255,0.03)]" : ""}`}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); const files = [...e.dataTransfer.files]; if (files.length > 0) handleFileUpload(files); }}>
          <div className="max-w-3xl mx-auto space-y-4">
            {messages.map((msg, i) => (
              msg.role === "ai"
                ? <AIBubble key={i}>{msg.text}</AIBubble>
                : <UserBubble key={i} text={msg.text} isFile={msg.isFile} fileName={msg.fileName} />
            ))}
            {loading && <AIBubble typing />}

            {/* Step 1: Skip button inline with questions */}
            {step === 1 && questionIndex > 0 && !loading && exchangeCount < 7 && (
              <div className="pl-10">
                <button onClick={() => { setInput("skip"); setTimeout(() => handleStep1Send(), 0); }}
                  className="px-3 py-1 rounded-lg text-[11px] font-medium text-muted border border-main hover:border-[#0019FF]/40 transition">
                  Skip this question
                </button>
              </div>
            )}

            {/* Step 2: Summary card + Dimensions */}
            {step === 2 && !loading && (
              <div className="pl-10 space-y-4 animate-fadeIn">
                {/* Default dimensions list */}
                <div className="bg-surface border border-main rounded-xl p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted mb-3">Universal Dimensions</p>
                  <div className="space-y-2">
                    {DEFAULT_DIMENSIONS.map((d, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: "#0019FF" }} />
                        <div>
                          <p className="text-sm font-medium text-main">{d.name}</p>
                          <p className="text-[11px] text-muted">{d.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Custom dimensions added */}
                {customDimensions.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Custom Dimensions</p>
                    {customDimensions.map((d, i) => (
                      <div key={i} className="bg-surface border border-[#0019FF]/20 rounded-xl p-3 flex items-start justify-between">
                        <div>
                          <p className="text-sm font-medium text-main">{d.name}</p>
                          <p className="text-[11px] text-muted">{d.values}</p>
                          {d.description && <p className="text-[11px] text-hint mt-0.5">{d.description}</p>}
                        </div>
                        <button onClick={() => removeCustomDimension(i)} className="text-muted hover:text-red-500 text-xs ml-2">&times;</button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add custom dimension builder */}
                {showDimBuilder ? (
                  <div className="bg-surface border border-main rounded-xl p-4 space-y-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Add Custom Dimension</p>
                    <div>
                      <label className="text-[11px] text-muted block mb-1">Category name</label>
                      <input value={dimName} onChange={e => setDimName(e.target.value)}
                        placeholder="e.g., Journey Phase"
                        className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[#0019FF]" />
                    </div>
                    <div>
                      <label className="text-[11px] text-muted block mb-1">Values (comma separated)</label>
                      <input value={dimValues} onChange={e => setDimValues(e.target.value)}
                        placeholder="e.g., Awareness, Discovery, Decision, Loyalty"
                        className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[#0019FF]" />
                    </div>
                    <div>
                      <label className="text-[11px] text-muted block mb-1">Description</label>
                      <input value={dimDesc} onChange={e => setDimDesc(e.target.value)}
                        placeholder="What does this dimension measure?"
                        className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[#0019FF]" />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={addCustomDimension} disabled={!dimName.trim()}
                        className="px-4 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-40 transition"
                        style={{ background: "#0019FF" }}>
                        + Add dimension
                      </button>
                      <button onClick={() => setShowDimBuilder(false)}
                        className="px-4 py-2 rounded-lg text-xs font-medium text-muted hover:text-main transition">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setShowDimBuilder(true)}
                    className="px-4 py-2 rounded-lg text-xs font-medium text-[#0019FF] border border-[#0019FF]/20 hover:bg-[rgba(0,25,255,0.05)] transition">
                    + Add custom dimensions
                  </button>
                )}
              </div>
            )}

            {/* Step 3: Local competitor chips */}
            {step === 3 && localCompetitors.length > 0 && !loading && (
              <div className="pl-10 animate-fadeIn">
                <div className="flex flex-wrap gap-2 mb-3">
                  {localCompetitors.map((c, i) => (
                    <Chip key={i} label={c.name} selected={c.selected} onClick={() => toggleLocal(i)} />
                  ))}
                </div>
                <div className="flex gap-2 items-center">
                  <input value={customInput} onChange={e => setCustomInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && addCustomCompetitor()}
                    placeholder="Add a competitor..."
                    className="px-3 py-1.5 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[#0019FF] w-48" />
                  <button onClick={addCustomCompetitor}
                    className="px-3 py-1.5 text-xs font-medium text-[#0019FF] hover:bg-[rgba(0,25,255,0.05)] rounded-lg transition">
                    + Add
                  </button>
                </div>
              </div>
            )}

            {/* Step 4: Global reference chips */}
            {step === 4 && globalReferences.length > 0 && !loading && (
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
                    onKeyDown={e => e.key === "Enter" && addCustomCompetitor()}
                    placeholder="Add a global brand..."
                    className="px-3 py-1.5 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[#0019FF] w-48" />
                  <button onClick={addCustomCompetitor}
                    className="px-3 py-1.5 text-xs font-medium text-[#0019FF] hover:bg-[rgba(0,25,255,0.05)] rounded-lg transition">
                    + Add
                  </button>
                </div>
              </div>
            )}

            {/* Step 5: Auto-Scout progress + results */}
            {step === 5 && (
              <div className="pl-10 space-y-4 animate-fadeIn">
                {/* Progress indicators */}
                {scoutBrands.length > 0 && (
                  <div className="bg-surface border border-main rounded-xl p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted mb-3">Scout Progress</p>
                    <div className="space-y-2">
                      {scoutBrands.map((brand, i) => {
                        const status = scoutProgress[brand.name];
                        return (
                          <div key={i} className="flex items-center gap-3">
                            <div className="w-32 text-xs text-main truncate font-medium">{brand.name}</div>
                            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(0,25,255,0.08)" }}>
                              <div className="h-full rounded-full transition-all duration-500" style={{
                                width: status === "searching" ? "50%" : status ? "100%" : "0%",
                                background: status === "error" ? "#ef4444" : "linear-gradient(90deg, #0019FF, #D4E520)",
                              }} />
                            </div>
                            <span className="text-[10px] text-muted w-16 text-right">
                              {status === "searching" ? "..." : status || "--"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Video results per brand */}
                {scoutBrands.map((brand) => {
                  const videos = scoutResults[brand.name];
                  if (!videos || videos.length === 0) return null;
                  return (
                    <div key={brand.name} className="space-y-2">
                      <p className="text-xs font-bold text-main">{brand.name} <span className="text-muted font-normal">({brand.scope})</span></p>
                      {videos.map((video) => {
                        const key = `${brand.name}:${video.videoId}`;
                        const status = scoutVideoStatus[key];
                        return (
                          <VideoCard
                            key={key}
                            video={video}
                            brandName={brand.name}
                            brandScope={brand.scope}
                            accepted={status === "accepted"}
                            skipped={status === "skipped"}
                            onAccept={() => handleAcceptVideo(brand.name, video, brand.scope)}
                            onSkip={() => handleSkipVideo(brand.name, video.videoId)}
                          />
                        );
                      })}
                    </div>
                  );
                })}

                {scoutDone && (
                  <p className="text-sm text-main font-medium">
                    Scouting complete. {importCount} videos accepted so far.
                  </p>
                )}
              </div>
            )}

            {/* Step 6: Done */}
            {step === 6 && saving && (
              <div className="pl-10 animate-fadeIn">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-[#0019FF] border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm text-muted">Setting up your project...</span>
                </div>
              </div>
            )}

            {step === 6 && !saving && createdProjectId && (
              <div className="pl-10 animate-fadeIn">
                <div className="flex items-center gap-3 mb-6">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center"
                      style={{ background: "#D4E520" }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0a0f3c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                    <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full animate-ping" style={{ background: "#D4E520", opacity: 0.5 }} />
                  </div>
                  <div>
                    <p className="text-lg font-bold text-main">Benchmark created</p>
                    <p className="text-xs text-muted">Your project is ready to go</p>
                  </div>
                </div>

                {/* Summary card */}
                <div className="bg-surface border border-main rounded-xl p-4 mb-4 max-w-md">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted mb-2">Summary</p>
                  <div className="space-y-1 text-sm">
                    <p className="text-main">Entries imported: <span className="font-semibold">{importCount}</span></p>
                    <p className="text-main">Local competitors: <span className="font-semibold">{localCompetitors.filter(c => c.selected).length}</span></p>
                    <p className="text-main">Global references: <span className="font-semibold">{globalReferences.filter(g => g.selected).length}</span></p>
                  </div>
                </div>

                {/* Quick links */}
                <div className="grid grid-cols-2 gap-3 max-w-md">
                  <button onClick={() => router.push("/scout")}
                    className="px-4 py-3 rounded-xl text-center transition hover:opacity-90"
                    style={{ background: "#0019FF", color: "#fff" }}>
                    <svg className="mx-auto mb-1.5" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <span className="text-xs font-semibold">Go to Scout</span>
                  </button>
                  <button onClick={() => router.push("/audit")}
                    className="px-4 py-3 rounded-xl text-center border border-main hover:border-[#0019FF] transition">
                    <svg className="mx-auto mb-1.5 text-main" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
                    <span className="text-xs font-semibold text-main">Go to Audit</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Input area - sticky bottom */}
        <div className="flex-shrink-0 border-t border-main px-6 py-4" style={{ background: "var(--bg)" }}>
          <div className="max-w-3xl mx-auto">
            {step === 1 ? (
              <div className="flex gap-2 items-end">
                <label className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl border border-main bg-surface hover:bg-surface2 cursor-pointer transition" title="Upload file or image">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
                  <input type="file" accept="image/*,.pdf,.doc,.docx,.txt" multiple onChange={e => handleFileUpload([...e.target.files])} className="hidden" />
                </label>
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Tell me about your brand, or upload a brief/doc..."
                  disabled={loading}
                  rows={1}
                  className="flex-1 px-4 py-2.5 bg-surface border border-main rounded-xl text-sm text-main focus:outline-none focus:border-[#0019FF] disabled:opacity-50 resize-none"
                  style={{ maxHeight: 120 }}
                />
                <button onClick={handleSend} disabled={loading || !input.trim()}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 transition hover:opacity-90 flex-shrink-0"
                  style={{ background: "#0019FF" }}>
                  Send
                </button>
                {brandProfile.name && brandProfile.market && (
                  <button onClick={() => goToStep(2)}
                    className="px-5 py-2.5 rounded-xl text-sm font-semibold transition hover:opacity-90 flex-shrink-0"
                    style={{ background: "#D4E520", color: "#0a0f3c" }}>
                    Next
                  </button>
                )}
              </div>
            ) : step === 2 ? (
              <div className="flex justify-between items-center">
                <button onClick={() => setStep(1)}
                  className="px-4 py-2 text-sm text-muted hover:text-main transition">
                  Back
                </button>
                <div className="flex gap-3">
                  <button onClick={() => goToStep(3)}
                    className="px-6 py-2.5 rounded-xl text-sm font-semibold transition hover:opacity-90"
                    style={{ background: "#D4E520", color: "#0a0f3c" }}>
                    {showDimBuilder || customDimensions.length > 0 ? "Save & continue" : "Confirm & continue"}
                  </button>
                </div>
              </div>
            ) : step < 6 ? (
              <div className="flex justify-between items-center">
                <button onClick={() => setStep(step - 1)}
                  className="px-4 py-2 text-sm text-muted hover:text-main transition">
                  Back
                </button>
                <button onClick={() => goToStep(step + 1)} disabled={!canAdvance() || loading || scoutRunning}
                  className="px-6 py-2.5 rounded-xl text-sm font-semibold transition hover:opacity-90 disabled:opacity-40"
                  style={{ background: "#D4E520", color: "#0a0f3c" }}>
                  {step === 5 ? "Finish & save" : "Continue"}
                </button>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-xs text-hint">Setup complete. Choose where to start above.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
