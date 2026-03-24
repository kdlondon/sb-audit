"use client";
import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { useProject } from "@/lib/project-context";
import AuthGuard from "@/components/AuthGuard";

// ── CONSTANTS ───────────────────────────────────────────────────
const INDUSTRIES = [
  "Banking & Financial Services","Fintech","Insurance","Retail & E-commerce","FMCG / CPG",
  "Food & Beverage","Technology","SaaS","Automotive","Telecom","Healthcare","Pharma",
  "Travel & Hospitality","Real Estate","Education","Energy","Fashion & Apparel",
  "Beauty & Personal Care","Media & Entertainment","Sports & Fitness","Non-profit",
  "Government","Professional Services","Agriculture","Logistics","Other",
];

const COUNTRIES = [
  {code:"CA",name:"Canada"},{code:"US",name:"United States"},{code:"GB",name:"United Kingdom"},
  {code:"AU",name:"Australia"},{code:"DE",name:"Germany"},{code:"FR",name:"France"},
  {code:"ES",name:"Spain"},{code:"MX",name:"Mexico"},{code:"BR",name:"Brazil"},
  {code:"JP",name:"Japan"},{code:"KR",name:"South Korea"},{code:"IN",name:"India"},
  {code:"CN",name:"China"},{code:"SG",name:"Singapore"},{code:"AE",name:"UAE"},
  {code:"NL",name:"Netherlands"},{code:"IT",name:"Italy"},{code:"SE",name:"Sweden"},
  {code:"CH",name:"Switzerland"},{code:"NZ",name:"New Zealand"},{code:"IE",name:"Ireland"},
  {code:"IL",name:"Israel"},{code:"ZA",name:"South Africa"},{code:"CL",name:"Chile"},
  {code:"CO",name:"Colombia"},{code:"AR",name:"Argentina"},{code:"PT",name:"Portugal"},
  {code:"NO",name:"Norway"},{code:"DK",name:"Denmark"},{code:"FI",name:"Finland"},
  {code:"PL",name:"Poland"},{code:"BE",name:"Belgium"},{code:"AT",name:"Austria"},
];

const LANGUAGES = [
  "English","French","Spanish","Portuguese","German","Italian","Dutch","Swedish",
  "Norwegian","Danish","Finnish","Polish","Japanese","Korean","Chinese (Simplified)",
  "Chinese (Traditional)","Arabic","Hindi","Hebrew","Turkish","Thai","Vietnamese",
];

const OBJECTIVES = [
  "Understand competitive positioning and messaging",
  "Find creative inspiration from global brands",
  "Track campaign activity and new launches",
  "Identify white spaces and opportunities",
  "Benchmark communication quality and consistency",
  "Support pitch or strategy development",
  "Monitor a specific competitor's evolution",
];

const TONES = [
  "Authoritative","Empathetic","Aspirational","Peer-level","Institutional",
  "Playful","Urgent","Warm","Purpose-driven","Innovative","Minimal","Bold",
];

const STANDARD_DIMS = [
  {key:"archetype",label:"Brand Archetype",desc:"Jungian 12 archetypes"},
  {key:"tone",label:"Tone of Voice",desc:"Communication tone analysis"},
  {key:"execution",label:"Execution Style",desc:"Creative execution classification"},
  {key:"funnel",label:"Funnel Stage",desc:"Marketing funnel mapping"},
  {key:"rating",label:"Quality Rating",desc:"1-5 quality assessment"},
];

const STEPS = [
  {num:1,title:"Your Brand",desc:"Tell us about your brand"},
  {num:2,title:"Your Market",desc:"Define your competitive landscape"},
  {num:3,title:"Your Objectives",desc:"What do you want to learn?"},
  {num:4,title:"Local Competitors",desc:"Who you compete with locally"},
  {num:5,title:"Global Benchmarks",desc:"International brands to watch"},
  {num:6,title:"Analysis Framework",desc:"Configure your audit dimensions"},
  {num:7,title:"Review & Launch",desc:"Confirm and create your project"},
];

// ── SHARED UI COMPONENTS ────────────────────────────────────────
function Input({label,required,value,onChange,placeholder,type="text",textarea}){
  const Tag=textarea?"textarea":"input";
  return(
    <div>
      <label className="block text-[11px] text-muted uppercase font-semibold mb-1.5 tracking-wide">
        {label}{required&&<span className="text-red-400 ml-0.5">*</span>}
      </label>
      <Tag value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
        type={type} rows={textarea?3:undefined}
        className="w-full px-3.5 py-2.5 bg-surface border border-main rounded-xl text-sm text-main placeholder:text-hint focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition" />
    </div>
  );
}

function Chips({label,options,selected,onChange,multi=true}){
  const toggle=(v)=>{
    if(multi){onChange(selected.includes(v)?selected.filter(x=>x!==v):[...selected,v]);}
    else{onChange(selected===v?null:v);}
  };
  return(
    <div>
      {label&&<label className="block text-[11px] text-muted uppercase font-semibold mb-2 tracking-wide">{label}</label>}
      <div className="flex flex-wrap gap-2">
        {options.map(o=>{
          const active=multi?selected.includes(o):selected===o;
          return(<button key={o} type="button" onClick={()=>toggle(o)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
              active?"bg-accent text-white border-accent":"bg-surface border-main text-muted hover:border-accent/40 hover:text-main"
            }`}>{o}</button>);
        })}
      </div>
    </div>
  );
}

function CompetitorChips({items,onRemove}){
  if(!items.length)return null;
  return(
    <div className="flex flex-wrap gap-2 mt-3">
      {items.map((c,i)=>(
        <span key={i} className="inline-flex items-center gap-1.5 bg-surface2 border border-main rounded-full pl-3 pr-1.5 py-1 text-xs text-main">
          {typeof c==="string"?c:c.name}
          {c.type&&<span className="text-[9px] text-hint">({c.type})</span>}
          <button onClick={()=>onRemove(i)} className="text-hint hover:text-red-500 text-sm leading-none">×</button>
        </span>
      ))}
    </div>
  );
}

function SearchDropdown({options,value,onChange,placeholder}){
  const[open,setOpen]=useState(false);
  const[search,setSearch]=useState("");
  const filtered=options.filter(o=>o.toLowerCase().includes(search.toLowerCase()));
  return(
    <div className="relative">
      <button type="button" onClick={()=>setOpen(!open)}
        className="w-full px-3.5 py-2.5 bg-surface border border-main rounded-xl text-sm text-left flex justify-between items-center hover:border-accent/40 transition">
        <span className={value?"text-main":"text-hint"}>{value||placeholder}</span>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-hint"><path d="M3 5l3 3 3-3"/></svg>
      </button>
      {open&&(
        <div className="absolute z-50 mt-1 w-full bg-surface border border-main rounded-xl shadow-xl max-h-64 overflow-hidden">
          <div className="p-2 border-b border-main">
            <input autoFocus value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search..."
              className="w-full px-2.5 py-1.5 text-xs bg-surface2 rounded-lg text-main placeholder:text-hint focus:outline-none" />
          </div>
          <div className="overflow-auto max-h-48">
            {filtered.map(o=>(
              <button key={o} type="button" onClick={()=>{onChange(o);setOpen(false);setSearch("");}}
                className={`w-full text-left px-3 py-2 text-xs hover:bg-accent-soft transition ${value===o?"font-semibold text-accent":"text-main"}`}>
                {o}
              </button>
            ))}
            {filtered.length===0&&<p className="px-3 py-2 text-xs text-hint">No matches</p>}
          </div>
        </div>
      )}
    </div>
  );
}

// ── MAIN COMPONENT ──────────────────────────────────────────────
function OnboardingContent() {
  const router = useRouter();
  const { selectProject } = useProject();
  const supabase = createClient();

  const [step, setStep] = useState(1);
  const [creating, setCreating] = useState(false);

  // Step 1: Brand
  const [brandName, setBrandName] = useState("");
  const [industry, setIndustry] = useState("");
  const [subCategory, setSubCategory] = useState("");
  const [brandDescription, setBrandDescription] = useState("");
  const [valueProposition, setValueProposition] = useState("");
  const [differentiator, setDifferentiator] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [brandTone, setBrandTone] = useState([]);
  const [yearsInMarket, setYearsInMarket] = useState("");

  // Step 2: Market
  const [primaryMarket, setPrimaryMarket] = useState("");
  const [primaryLanguage, setPrimaryLanguage] = useState("English");
  const [secondaryLanguage, setSecondaryLanguage] = useState("");
  const [globalMarkets, setGlobalMarkets] = useState([]);

  // Step 3: Objectives
  const [objectives, setObjectives] = useState([]);
  const [specificQuestions, setSpecificQuestions] = useState("");
  const [reportingFrequency, setReportingFrequency] = useState("");

  // Step 4: Local competitors
  const [localCompetitors, setLocalCompetitors] = useState([]);
  const [newCompetitor, setNewCompetitor] = useState("");
  const [suggestingLocal, setSuggestingLocal] = useState(false);
  const [localSuggestions, setLocalSuggestions] = useState([]);

  // Step 5: Global benchmarks
  const [globalBenchmarks, setGlobalBenchmarks] = useState([]);
  const [newBenchmark, setNewBenchmark] = useState("");
  const [suggestingGlobal, setSuggestingGlobal] = useState(false);
  const [globalSuggestions, setGlobalSuggestions] = useState([]);

  // Step 6: Framework
  const [tier, setTier] = useState("essential");
  const [standardDims, setStandardDims] = useState(["archetype","tone","execution","funnel","rating"]);
  const [customDimensions, setCustomDimensions] = useState([]);
  const [communicationIntents, setCommunicationIntents] = useState(["Brand Hero","Brand Tactical","Client Testimonials","Product","Innovation"]);
  const [newIntentInput, setNewIntentInput] = useState("");

  // ── Navigation ──
  const canProceed = useCallback(() => {
    switch(step){
      case 1: return brandName.trim() && industry && brandDescription.trim() && valueProposition.trim() && targetAudience.trim();
      case 2: return primaryMarket;
      case 3: return objectives.length > 0;
      case 4: return localCompetitors.length >= 2;
      case 5: return true;
      case 6: return true;
      default: return true;
    }
  }, [step, brandName, industry, brandDescription, valueProposition, targetAudience, primaryMarket, objectives, localCompetitors]);

  const next = () => { if(step < 7 && canProceed()) setStep(step + 1); };
  const prev = () => { if(step > 1) setStep(step - 1); };

  // ── AI Suggestions ──
  const suggestCompetitors = async (isGlobal) => {
    const setter = isGlobal ? setSuggestingGlobal : setSuggestingLocal;
    const sugSetter = isGlobal ? setGlobalSuggestions : setLocalSuggestions;
    setter(true);
    try {
      const res = await fetch("/api/suggest-competitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand_name: brandName,
          industry,
          market: isGlobal ? null : (COUNTRIES.find(c => c.code === primaryMarket)?.name || primaryMarket),
          global_markets: isGlobal ? globalMarkets : null,
          type: isGlobal ? "global" : "local",
        }),
      });
      const data = await res.json();
      sugSetter(data.suggestions || []);
    } catch { sugSetter([]); }
    setter(false);
  };

  const addCompetitor = (name, type) => {
    if (!name.trim()) return;
    const existing = localCompetitors.map(c => (typeof c === "string" ? c : c.name).toLowerCase());
    if (!existing.includes(name.trim().toLowerCase())) {
      setLocalCompetitors([...localCompetitors, { name: name.trim(), type: type || "direct" }]);
    }
  };

  const addBenchmark = (name, country, ind) => {
    if (!name.trim()) return;
    const existing = globalBenchmarks.map(c => (typeof c === "string" ? c : c.name).toLowerCase());
    if (!existing.includes(name.trim().toLowerCase())) {
      setGlobalBenchmarks([...globalBenchmarks, { name: name.trim(), country: country || "", industry: ind || "" }]);
    }
  };

  // ── Create Project ──
  const createProject = async () => {
    setCreating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const projectId = "proj_" + Date.now();
      const projectName = `${brandName} Competitive Audit`;

      // 1. Create project
      await supabase.from("projects").insert({
        id: projectId,
        name: projectName,
        client_name: brandName,
        description: `${industry} competitive intelligence audit`,
        created_by: session?.user?.email || "",
      });

      // 2. Grant access to creator
      await supabase.from("project_access").insert({
        user_id: session.user.id,
        email: session.user.email,
        project_id: projectId,
      });

      // 3. Build dimensions array for enhanced tier
      const dimensions = [];
      if (tier === "enhanced" && customDimensions.length > 0) {
        customDimensions.forEach(d => {
          if (d.name && d.values) {
            dimensions.push({
              name: d.name,
              key: d.name.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
              values: d.values.split(",").map(v => v.trim()).filter(Boolean),
              description: d.description || "",
            });
          }
        });
      }

      // 4. Insert framework
      await supabase.from("project_frameworks").insert({
        project_id: projectId,
        name: `${brandName} Framework`,
        tier,
        brand_name: brandName,
        brand_description: brandDescription,
        brand_positioning: valueProposition,
        brand_differentiator: differentiator,
        brand_audience: targetAudience,
        brand_tone: brandTone.join(", "),
        industry,
        sub_category: subCategory,
        primary_market: primaryMarket,
        global_markets: globalMarkets,
        language: primaryLanguage,
        secondary_language: secondaryLanguage || null,
        objectives,
        specific_questions: specificQuestions || null,
        reporting_frequency: reportingFrequency || null,
        years_in_market: yearsInMarket || null,
        dimensions,
        communication_intents: communicationIntents,
        standard_dimensions: standardDims,
        brand_categories: industry === "Banking & Financial Services"
          ? ["Traditional Banking","Fintech","Neobank","Credit Union","Other"]
          : ["Leader","Challenger","Niche","Emerging","Other"],
        local_competitors: localCompetitors,
        global_benchmarks: globalBenchmarks,
      });

      // 5. Insert dropdown options for competitors
      const competitorNames = localCompetitors.map(c => typeof c === "string" ? c : c.name);
      if (competitorNames.length > 0) {
        await supabase.from("dropdown_options").insert(
          competitorNames.map((name, i) => ({
            project_id: projectId,
            category: "competitor",
            value: name,
            sort_order: i,
          }))
        );
      }

      // 6. Insert communication intent options
      await supabase.from("dropdown_options").insert(
        communicationIntents.map((intent, i) => ({
          project_id: projectId,
          category: "communicationIntent",
          value: intent,
          sort_order: i,
        }))
      );

      // 7. Select project and redirect
      selectProject(projectId, projectName);
      router.push("/scout");
    } catch (err) {
      alert("Error creating project: " + err.message);
    }
    setCreating(false);
  };

  // ── Progress Bar ──
  const progress = ((step - 1) / 6) * 100;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg)" }}>
      {/* Header */}
      <div className="px-6 py-4 flex justify-between items-center" style={{ background: "#0a0f3c", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-3">
          <img src="/knots-dots-logo.png" alt="K&D" style={{ height: 22 }} />
          <div>
            <p className="text-sm font-semibold text-white">New Project</p>
            <p className="text-[10px] text-white/40">Step {step} of 7 — {STEPS[step-1].title}</p>
          </div>
        </div>
        <button onClick={() => router.push("/projects")} className="text-[11px] text-white/25 hover:text-white/50 transition">Cancel</button>
      </div>

      {/* Progress bar */}
      <div className="h-1 w-full" style={{ background: "rgba(0,0,0,0.05)" }}>
        <div className="h-full transition-all duration-500 ease-out" style={{ width: `${progress}%`, background: "#0019FF" }} />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-2xl mx-auto px-6 py-10">

          {/* ═══ STEP 1: YOUR BRAND ═══ */}
          {step === 1 && (
            <div className="space-y-5 animate-fadeIn">
              <div>
                <h1 className="text-2xl font-bold text-main">Your Brand</h1>
                <p className="text-sm text-muted mt-1">Tell us about the brand we'll be auditing for.</p>
              </div>
              <Input label="Brand Name" required value={brandName} onChange={setBrandName} placeholder="e.g., Allbirds" />
              <div>
                <label className="block text-[11px] text-muted uppercase font-semibold mb-1.5 tracking-wide">Industry / Category <span className="text-red-400">*</span></label>
                <SearchDropdown options={INDUSTRIES} value={industry} onChange={setIndustry} placeholder="Select industry..." />
              </div>
              <Input label="Sub-category" value={subCategory} onChange={setSubCategory} placeholder="e.g., Sustainable Fashion" />
              <Input label="Brand Description" required textarea value={brandDescription} onChange={setBrandDescription} placeholder="2-3 sentences about what the brand does..." />
              <Input label="Value Proposition" required textarea value={valueProposition} onChange={setValueProposition} placeholder="What's the core brand promise?" />
              <Input label="Key Differentiator" value={differentiator} onChange={setDifferentiator} placeholder="What makes this brand unique?" />
              <Input label="Target Audience" required textarea value={targetAudience} onChange={setTargetAudience} placeholder="Who does the brand serve?" />
              <Chips label="Brand Tone" options={TONES} selected={brandTone} onChange={setBrandTone} />
              <div>
                <label className="block text-[11px] text-muted uppercase font-semibold mb-1.5 tracking-wide">Years in Market</label>
                <SearchDropdown options={["Less than 1 year","1-3 years","3-5 years","5-10 years","10-20 years","20+ years"]}
                  value={yearsInMarket} onChange={setYearsInMarket} placeholder="Select..." />
              </div>
            </div>
          )}

          {/* ═══ STEP 2: YOUR MARKET ═══ */}
          {step === 2 && (
            <div className="space-y-5 animate-fadeIn">
              <div>
                <h1 className="text-2xl font-bold text-main">Your Market</h1>
                <p className="text-sm text-muted mt-1">Define the geographic scope for your competitive audit.</p>
              </div>
              <div>
                <label className="block text-[11px] text-muted uppercase font-semibold mb-1.5 tracking-wide">Primary Market <span className="text-red-400">*</span></label>
                <SearchDropdown options={COUNTRIES.map(c=>c.name)} value={COUNTRIES.find(c=>c.code===primaryMarket)?.name||""}
                  onChange={v=>{const c=COUNTRIES.find(x=>x.name===v);if(c)setPrimaryMarket(c.code);}} placeholder="Select country..." />
              </div>
              <div>
                <label className="block text-[11px] text-muted uppercase font-semibold mb-1.5 tracking-wide">Primary Language</label>
                <SearchDropdown options={LANGUAGES} value={primaryLanguage} onChange={setPrimaryLanguage} placeholder="English" />
              </div>
              <div>
                <label className="block text-[11px] text-muted uppercase font-semibold mb-1.5 tracking-wide">Secondary Language</label>
                <SearchDropdown options={LANGUAGES} value={secondaryLanguage} onChange={setSecondaryLanguage} placeholder="Optional..." />
              </div>
              <div>
                <label className="block text-[11px] text-muted uppercase font-semibold mb-2 tracking-wide">Global Markets of Interest <span className="text-hint text-[9px]">(max 10)</span></label>
                <div className="flex flex-wrap gap-2">
                  {COUNTRIES.filter(c=>c.code!==primaryMarket).map(c=>{
                    const active=globalMarkets.includes(c.code);
                    return(<button key={c.code} type="button" onClick={()=>{
                      if(active)setGlobalMarkets(globalMarkets.filter(x=>x!==c.code));
                      else if(globalMarkets.length<10)setGlobalMarkets([...globalMarkets,c.code]);
                    }}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition ${
                        active?"bg-accent text-white border-accent":"bg-surface border-main text-muted hover:border-accent/40"
                      }`}>{c.name}</button>);
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ═══ STEP 3: YOUR OBJECTIVES ═══ */}
          {step === 3 && (
            <div className="space-y-5 animate-fadeIn">
              <div>
                <h1 className="text-2xl font-bold text-main">Your Objectives</h1>
                <p className="text-sm text-muted mt-1">What do you want to learn from this competitive audit?</p>
              </div>
              <Chips label="Project Objectives" options={OBJECTIVES} selected={objectives} onChange={setObjectives} />
              <Input label="Specific Questions" textarea value={specificQuestions} onChange={setSpecificQuestions}
                placeholder="Any specific questions you want answered? e.g., 'How are DTC brands differentiating from legacy sportswear?'" />
              <div>
                <label className="block text-[11px] text-muted uppercase font-semibold mb-1.5 tracking-wide">Reporting Frequency</label>
                <SearchDropdown options={["Weekly","Monthly","Quarterly","Ad-hoc"]} value={reportingFrequency} onChange={setReportingFrequency} placeholder="Select..." />
              </div>
            </div>
          )}

          {/* ═══ STEP 4: LOCAL COMPETITORS ═══ */}
          {step === 4 && (
            <div className="space-y-5 animate-fadeIn">
              <div>
                <h1 className="text-2xl font-bold text-main">Local Competitors</h1>
                <p className="text-sm text-muted mt-1">Who does {brandName || "the brand"} compete with in {COUNTRIES.find(c=>c.code===primaryMarket)?.name || "the local market"}? <span className="text-hint">(Min 2)</span></p>
              </div>

              <div className="flex gap-2">
                <input value={newCompetitor} onChange={e=>setNewCompetitor(e.target.value)}
                  onKeyDown={e=>{if(e.key==="Enter"){addCompetitor(newCompetitor);setNewCompetitor("");}}}
                  placeholder="Type competitor name and press Enter..."
                  className="flex-1 px-3.5 py-2.5 bg-surface border border-main rounded-xl text-sm text-main placeholder:text-hint focus:outline-none focus:border-accent" />
                <button onClick={()=>{addCompetitor(newCompetitor);setNewCompetitor("");}}
                  className="px-4 py-2 bg-surface border border-main rounded-xl text-xs font-semibold text-main hover:bg-surface2 transition">Add</button>
              </div>

              <CompetitorChips items={localCompetitors} onRemove={i=>setLocalCompetitors(localCompetitors.filter((_,j)=>j!==i))} />

              <div className="border-t border-main pt-4">
                <button onClick={()=>suggestCompetitors(false)} disabled={suggestingLocal || !brandName || !industry}
                  className="px-4 py-2 rounded-xl text-xs font-semibold transition disabled:opacity-40"
                  style={{background:"#0019FF",color:"white"}}>
                  {suggestingLocal ? "Finding competitors..." : "Suggest competitors with AI"}
                </button>
                {localSuggestions.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    <p className="text-[10px] text-muted uppercase font-semibold">AI Suggestions — click to add</p>
                    {localSuggestions.map((s, i) => {
                      const name = s.name || s;
                      const already = localCompetitors.some(c => (typeof c === "string" ? c : c.name).toLowerCase() === name.toLowerCase());
                      return (
                        <button key={i} onClick={() => !already && addCompetitor(name, s.type)} disabled={already}
                          className={`w-full text-left px-3 py-2 rounded-lg border text-xs transition ${
                            already ? "bg-green-50 border-green-200 text-green-700 cursor-default" :
                            "bg-surface border-main text-main hover:border-accent hover:bg-accent-soft cursor-pointer"
                          }`}>
                          <span className="font-semibold">{name}</span>
                          {s.type && <span className="text-hint ml-1.5">({s.type})</span>}
                          {s.reason && <span className="text-hint ml-1.5">— {s.reason}</span>}
                          {already && <span className="float-right text-green-600">Added</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══ STEP 5: GLOBAL BENCHMARKS ═══ */}
          {step === 5 && (
            <div className="space-y-5 animate-fadeIn">
              <div>
                <h1 className="text-2xl font-bold text-main">Global Benchmarks</h1>
                <p className="text-sm text-muted mt-1">International brands to benchmark against. <span className="text-hint">(Optional)</span></p>
              </div>

              <div className="flex gap-2">
                <input value={newBenchmark} onChange={e=>setNewBenchmark(e.target.value)}
                  onKeyDown={e=>{if(e.key==="Enter"){addBenchmark(newBenchmark);setNewBenchmark("");}}}
                  placeholder="Type brand name and press Enter..."
                  className="flex-1 px-3.5 py-2.5 bg-surface border border-main rounded-xl text-sm text-main placeholder:text-hint focus:outline-none focus:border-accent" />
                <button onClick={()=>{addBenchmark(newBenchmark);setNewBenchmark("");}}
                  className="px-4 py-2 bg-surface border border-main rounded-xl text-xs font-semibold text-main hover:bg-surface2 transition">Add</button>
              </div>

              <CompetitorChips items={globalBenchmarks} onRemove={i=>setGlobalBenchmarks(globalBenchmarks.filter((_,j)=>j!==i))} />

              <div className="border-t border-main pt-4">
                <button onClick={()=>suggestCompetitors(true)} disabled={suggestingGlobal || !brandName || !industry}
                  className="px-4 py-2 rounded-xl text-xs font-semibold transition disabled:opacity-40"
                  style={{background:"#0019FF",color:"white"}}>
                  {suggestingGlobal ? "Finding benchmarks..." : "Suggest benchmarks with AI"}
                </button>
                {globalSuggestions.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    <p className="text-[10px] text-muted uppercase font-semibold">AI Suggestions — click to add</p>
                    {globalSuggestions.map((s, i) => {
                      const name = s.name || s;
                      const already = globalBenchmarks.some(c => (typeof c === "string" ? c : c.name).toLowerCase() === name.toLowerCase());
                      return (
                        <button key={i} onClick={() => !already && addBenchmark(name, s.country, s.industry)} disabled={already}
                          className={`w-full text-left px-3 py-2 rounded-lg border text-xs transition ${
                            already ? "bg-green-50 border-green-200 text-green-700 cursor-default" :
                            "bg-surface border-main text-main hover:border-accent hover:bg-accent-soft cursor-pointer"
                          }`}>
                          <span className="font-semibold">{name}</span>
                          {s.country && <span className="text-hint ml-1.5">({s.country})</span>}
                          {s.reason && <span className="text-hint ml-1.5">— {s.reason}</span>}
                          {already && <span className="float-right text-green-600">Added</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══ STEP 6: ANALYSIS FRAMEWORK ═══ */}
          {step === 6 && (
            <div className="space-y-6 animate-fadeIn">
              <div>
                <h1 className="text-2xl font-bold text-main">Analysis Framework</h1>
                <p className="text-sm text-muted mt-1">Choose your audit tier and configure dimensions.</p>
              </div>

              {/* Tier Selection */}
              <div className="space-y-3">
                <label className="block text-[11px] text-muted uppercase font-semibold tracking-wide">Choose Your Tier</label>
                {[
                  {key:"essential",title:"Essential",desc:"Standard competitive audit dimensions. Best for quick setup.",rec:true},
                  {key:"enhanced",title:"Enhanced",desc:"Add your own custom analysis dimensions. Best for brands with existing strategic frameworks."},
                  {key:"specialist",title:"Specialist",desc:"Full proprietary framework with classification rules. For agencies with deep methodologies."},
                ].map(t=>(
                  <button key={t.key} onClick={()=>setTier(t.key)}
                    className={`w-full text-left p-4 rounded-xl border-2 transition ${
                      tier===t.key?"border-accent bg-accent-soft":"border-main bg-surface hover:border-accent/30"
                    }`}>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-main">{t.title}</span>
                      {t.rec&&<span className="text-[9px] bg-accent/10 text-accent px-1.5 py-0.5 rounded-full font-semibold">Recommended</span>}
                    </div>
                    <p className="text-xs text-muted mt-1">{t.desc}</p>
                  </button>
                ))}
              </div>

              {/* Standard Dimensions */}
              <div className="bg-surface border border-main rounded-xl p-5">
                <h4 className="text-sm font-semibold text-main mb-3">Standard Dimensions</h4>
                <p className="text-xs text-muted mb-3">Toggle off dimensions you don't need.</p>
                <div className="space-y-2">
                  {STANDARD_DIMS.map(d=>(
                    <label key={d.key} className="flex items-center gap-3 cursor-pointer group">
                      <input type="checkbox" checked={standardDims.includes(d.key)}
                        onChange={e=>{
                          if(e.target.checked)setStandardDims([...standardDims,d.key]);
                          else setStandardDims(standardDims.filter(x=>x!==d.key));
                        }}
                        className="w-4 h-4 rounded border-main text-accent focus:ring-accent" />
                      <div>
                        <span className="text-xs font-semibold text-main group-hover:text-accent transition">{d.label}</span>
                        <span className="text-[10px] text-hint ml-1.5">{d.desc}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Communication Intents */}
              <div className="bg-surface border border-main rounded-xl p-5">
                <h4 className="text-sm font-semibold text-main mb-3">Communication Intents</h4>
                <div className="flex flex-wrap gap-2 mb-3">
                  {communicationIntents.map((intent, i) => (
                    <span key={i} className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full pl-2.5 pr-1 py-0.5 text-xs">
                      {intent}
                      <button onClick={() => setCommunicationIntents(communicationIntents.filter((_, j) => j !== i))}
                        className="text-blue-400 hover:text-red-500 ml-0.5">×</button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input value={newIntentInput} onChange={e => setNewIntentInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && newIntentInput.trim()) { setCommunicationIntents([...communicationIntents, newIntentInput.trim()]); setNewIntentInput(""); }}}
                    placeholder="Add custom intent..."
                    className="flex-1 px-3 py-1.5 bg-surface2 border border-main rounded-lg text-xs text-main placeholder:text-hint focus:outline-none focus:border-accent" />
                  <button onClick={() => { if (newIntentInput.trim()) { setCommunicationIntents([...communicationIntents, newIntentInput.trim()]); setNewIntentInput(""); }}}
                    className="px-3 py-1.5 bg-surface2 border border-main rounded-lg text-xs text-muted hover:text-main transition">Add</button>
                </div>
              </div>

              {/* Custom Dimensions (Tier 2 only) */}
              {tier === "enhanced" && (
                <div className="bg-surface border border-main rounded-xl p-5">
                  <h4 className="text-sm font-semibold text-main mb-3">Custom Dimensions <span className="text-hint font-normal">(up to 6)</span></h4>
                  <p className="text-xs text-muted mb-3">Add your own analysis dimensions. Each dimension becomes a classification field in the audit form.</p>
                  {customDimensions.map((dim, i) => (
                    <div key={i} className="border border-main rounded-lg p-3 mb-3">
                      <div className="flex justify-between items-start mb-2">
                        <input value={dim.name} onChange={e => {const upd=[...customDimensions];upd[i]={...upd[i],name:e.target.value};setCustomDimensions(upd);}}
                          placeholder="Dimension name (e.g., Customer Persona)"
                          className="text-xs font-semibold text-main bg-transparent border-b border-main focus:outline-none focus:border-accent flex-1 pb-1" />
                        <button onClick={() => setCustomDimensions(customDimensions.filter((_, j) => j !== i))}
                          className="text-hint hover:text-red-500 text-sm ml-2">×</button>
                      </div>
                      <input value={dim.values} onChange={e => {const upd=[...customDimensions];upd[i]={...upd[i],values:e.target.value};setCustomDimensions(upd);}}
                        placeholder="Values (comma-separated, e.g., Budget Hunter, Quality Seeker, Trend Chaser)"
                        className="w-full text-xs text-main bg-surface2 px-2.5 py-1.5 rounded-lg mb-2 focus:outline-none focus:border-accent border border-transparent" />
                      <input value={dim.description||""} onChange={e => {const upd=[...customDimensions];upd[i]={...upd[i],description:e.target.value};setCustomDimensions(upd);}}
                        placeholder="Description (optional)"
                        className="w-full text-[11px] text-muted bg-surface2 px-2.5 py-1.5 rounded-lg focus:outline-none border border-transparent" />
                    </div>
                  ))}
                  {customDimensions.length < 6 && (
                    <button onClick={() => setCustomDimensions([...customDimensions, {name:"",values:"",description:""}])}
                      className="text-xs text-accent hover:underline font-medium">+ Add Dimension</button>
                  )}
                </div>
              )}

              {/* Specialist note */}
              {tier === "specialist" && (
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-5">
                  <h4 className="text-sm font-semibold text-purple-800 mb-2">Specialist Framework Setup</h4>
                  <p className="text-xs text-purple-700">
                    For specialist frameworks with proprietary classification rules and cross-references,
                    our team will configure the structured dimensions after project creation.
                    You can upload framework documents in Settings after the project is created.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ═══ STEP 7: REVIEW & LAUNCH ═══ */}
          {step === 7 && (
            <div className="space-y-5 animate-fadeIn">
              <div>
                <h1 className="text-2xl font-bold text-main">Review & Launch</h1>
                <p className="text-sm text-muted mt-1">Everything look good? Create your project.</p>
              </div>

              <div className="bg-surface border border-main rounded-xl p-5">
                <h4 className="text-sm font-semibold text-main mb-3">Brand</h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-muted">Name:</span> <span className="text-main font-medium">{brandName}</span></div>
                  <div><span className="text-muted">Industry:</span> <span className="text-main">{industry}</span></div>
                  <div><span className="text-muted">Market:</span> <span className="text-main">{COUNTRIES.find(c=>c.code===primaryMarket)?.name}</span></div>
                  <div><span className="text-muted">Language:</span> <span className="text-main">{primaryLanguage}</span></div>
                  <div className="col-span-2"><span className="text-muted">Audience:</span> <span className="text-main">{targetAudience}</span></div>
                </div>
              </div>

              <div className="bg-surface border border-main rounded-xl p-5">
                <h4 className="text-sm font-semibold text-main mb-2">Objectives</h4>
                <div className="flex flex-wrap gap-1.5">
                  {objectives.map(o => <span key={o} className="text-[10px] bg-surface2 px-2 py-1 rounded-full text-main">{o}</span>)}
                </div>
              </div>

              <div className="bg-surface border border-main rounded-xl p-5">
                <h4 className="text-sm font-semibold text-main mb-2">Local Competitors ({localCompetitors.length})</h4>
                <div className="flex flex-wrap gap-1.5">
                  {localCompetitors.map((c, i) => <span key={i} className="text-xs bg-surface2 px-2.5 py-1 rounded-full text-main">{typeof c==="string"?c:c.name}</span>)}
                </div>
              </div>

              {globalBenchmarks.length > 0 && (
                <div className="bg-surface border border-main rounded-xl p-5">
                  <h4 className="text-sm font-semibold text-main mb-2">Global Benchmarks ({globalBenchmarks.length})</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {globalBenchmarks.map((c, i) => <span key={i} className="text-xs bg-surface2 px-2.5 py-1 rounded-full text-main">{typeof c==="string"?c:c.name}{c.country?` (${c.country})`:""}</span>)}
                  </div>
                </div>
              )}

              <div className="bg-surface border border-main rounded-xl p-5">
                <h4 className="text-sm font-semibold text-main mb-2">Framework</h4>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full ${
                    tier==="specialist"?"bg-purple-100 text-purple-800":tier==="enhanced"?"bg-blue-100 text-blue-800":"bg-gray-100 text-gray-800"
                  }`}>{tier}</span>
                  <span className="text-xs text-muted">{standardDims.length} standard dimensions</span>
                  {tier==="enhanced"&&customDimensions.length>0&&<span className="text-xs text-muted">+ {customDimensions.filter(d=>d.name).length} custom</span>}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {communicationIntents.map(i => <span key={i} className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{i}</span>)}
                </div>
              </div>

              <button onClick={createProject} disabled={creating}
                className="w-full py-3.5 rounded-xl text-sm font-bold text-white transition disabled:opacity-60"
                style={{ background: "#0019FF" }}>
                {creating ? "Creating project..." : "Create Project"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Footer navigation */}
      <div className="border-t border-main bg-surface px-6 py-4">
        <div className="max-w-2xl mx-auto flex justify-between items-center">
          <button onClick={prev} disabled={step===1}
            className="px-5 py-2 rounded-xl text-xs font-semibold text-muted border border-main hover:bg-surface2 transition disabled:opacity-30">
            Back
          </button>
          <div className="flex gap-1.5">
            {STEPS.map(s => (
              <div key={s.num} className={`w-2 h-2 rounded-full transition ${
                s.num===step?"bg-accent":s.num<step?"bg-accent/40":"bg-surface2"
              }`} />
            ))}
          </div>
          {step < 7 ? (
            <button onClick={next} disabled={!canProceed()}
              className="px-5 py-2 rounded-xl text-xs font-bold text-white transition disabled:opacity-40"
              style={{ background: "#0019FF" }}>
              Continue
            </button>
          ) : (
            <div className="w-[72px]" />
          )}
        </div>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <AuthGuard>
      <OnboardingContent />
    </AuthGuard>
  );
}
