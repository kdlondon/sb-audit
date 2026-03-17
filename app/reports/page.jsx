"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase";
import { STATIC_OPTIONS, fetchOptions, COMPETITOR_COLORS } from "@/lib/options";
import AuthGuard from "@/components/AuthGuard";
import Nav from "@/components/Nav";
import ProjectGuard from "@/components/ProjectGuard";
import { useProject } from "@/lib/project-context";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

function ytId(u){if(!u)return null;const m=u.match(/(?:youtube\.com\/watch\?.*v=|youtu\.be\/)([^&\s]+)/);return m?m[1]:null;}
function Tag({v}){return <span style={{background:COMPETITOR_COLORS[v]||"#888",color:"#fff",padding:"1px 6px",borderRadius:3,fontSize:11,fontWeight:600}}>{v}</span>;}

// ── TEMPLATES ─────────────────────────────────────────────────────────────────
const TEMPLATES=[
  {id:"competitor_snapshot",label:"Competitor Snapshot",scope:"local",badge:"Local",description:"Deep dive on one brand — all framework dimensions",singleBrand:true,sections:[
    {id:"positioning",label:"Brand positioning",desc:"Territories, archetype, VP, insight, idea"},
    {id:"identity",label:"Entrepreneur identity",desc:"Entry door, experience, portrait, richness"},
    {id:"journey",label:"Business journey",desc:"Phase, lifecycle, moments that matter"},
    {id:"comms",label:"Communication audit",desc:"Bank role, pain points, language register, R2B"},
    {id:"execution",label:"Execution",desc:"Channels, CTA, tone, representation, size"},
    {id:"campaign",label:"Campaign map",desc:"Pieces organised by funnel stage and year"},
    {id:"consistency",label:"Brand consistency",desc:"Tone, territory, VP and archetype coherence across all pieces"},
    {id:"strategic_read",label:"K&D strategic read",desc:"Editorial synthesis and white space signal"},
  ]},
  {id:"category_landscape",label:"Category Landscape",scope:"local",badge:"Local",description:"Full category — patterns, white spaces, positioning map",singleBrand:false,sections:[
    {id:"overview",label:"Category overview",desc:"Entry count, brand coverage, year range"},
    {id:"positioning",label:"Positioning landscape",desc:"Territory map, product vs human authority"},
    {id:"framework",label:"Framework mapping",desc:"Portrait, door, phase, lifecycle distribution"},
    {id:"moments",label:"Moment ownership",desc:"Acquisition, deepening, unexpected moments per brand"},
    {id:"audiences",label:"Audience targeting",desc:"Business size, industry, portrait cross-tabulation"},
    {id:"comms",label:"Communication patterns",desc:"Tone, register, execution style, channel mix"},
    {id:"tensions",label:"Human tensions",desc:"Control vs chaos, growth vs risk, support vs isolation"},
    {id:"drivers",label:"Driver map",desc:"Defensive, performative, transformational per brand"},
    {id:"whitespace",label:"White space & gaps",desc:"Unclaimed portraits, vacant doors, ignored phases"},
  ]},
  {id:"opportunity",label:"Opportunity Report",scope:"local",badge:"Local",description:"Strategic gaps — what the category is not doing",singleBrand:false,sections:[
    {id:"whitespace_map",label:"White space map",desc:"Saturated vs vacant territory overview"},
    {id:"portrait_gaps",label:"Portrait gaps",desc:"Underserved entrepreneur portraits"},
    {id:"door_gaps",label:"Entry door gaps",desc:"Unclaimed or weakly owned entry doors"},
    {id:"phase_gaps",label:"Journey phase gaps",desc:"Ignored phases — especially complexity & consolidation"},
    {id:"moment_gaps",label:"Moment gaps",desc:"Moments appearing in 0–1 entries across the category"},
    {id:"emotional_gaps",label:"Emotional & register gaps",desc:"Missing emotional territory and language register"},
    {id:"opportunities",label:"Opportunity territories",desc:"3–5 named strategic opportunities for Scotiabank"},
  ]},
  {id:"creative_intelligence",label:"Creative Intelligence",scope:"global",badge:"Global",description:"Global creative — territories, execution, transferable inspiration",singleBrand:false,sections:[
    {id:"landscape",label:"Creative landscape",desc:"Emotional and strategic territory globally"},
    {id:"execution",label:"Execution styles & patterns",desc:"How global brands execute their positioning"},
    {id:"archetypes",label:"Archetypes & roles",desc:"Which archetypes and bank roles dominate globally"},
    {id:"insights",label:"Insights & human truths",desc:"The human truths driving global creative"},
    {id:"portrait_door",label:"Portrait & door intelligence",desc:"Which entrepreneur identities global brands address"},
    {id:"inspiration",label:"Transferable inspiration",desc:"What Scotiabank could learn from global examples"},
  ]},
  {id:"innovation",label:"Innovation Report",scope:"global",badge:"Global",description:"Convention breaks — what global brands are doing differently",singleBrand:false,sections:[
    {id:"convention",label:"Category convention",desc:"The dominant global norm — the baseline"},
    {id:"breakers",label:"Convention breakers",desc:"Entries that score highest on differentiation"},
    {id:"emerging",label:"Emerging patterns",desc:"Signals appearing in 2–3 brands, not yet mainstream"},
    {id:"emotional",label:"Emotional frontier",desc:"Bravest emotional territory in the global set"},
    {id:"format",label:"Format & channel innovation",desc:"Unusual format or channel choices"},
    {id:"implications",label:"Strategic implications",desc:"3–5 signals distilled into actionable implications"},
  ]},
  {id:"agnostic_snapshot",label:"Agnostic Competitor Snapshot",scope:"local",badge:"Local + Global",description:"Framework-agnostic competitive communication audit — pure brand & product analysis",singleBrand:true,scopeAny:true,sections:[
    {id:"audience",label:"Understanding the Audience",desc:"Demographic, psychographic, tension, human insight"},
    {id:"brand_response",label:"The Brand Response",desc:"Proposition, archetype, role, positioning, territory, differentiators"},
    {id:"proof_points",label:"Proof Points & Communication Strategy",desc:"Primary proof, supporting points, focus, tone & voice"},
    {id:"product_comms",label:"Product Communication",desc:"Approach, key messages, channels, gaps"},
    {id:"beyond_banking",label:"Beyond Banking & Innovation",desc:"Lifestyle, community, innovation, white space"},
    {id:"brand_assessment",label:"Brand Assessment",desc:"Strengths and weaknesses of the brand itself"},
    {id:"comm_assessment",label:"Communication Assessment",desc:"Strengths and weaknesses across communication areas"},
  ]},
];

// ── SYSTEM PROMPTS ────────────────────────────────────────────────────────────
const SYSTEM_PROMPTS={
  competitor_snapshot:`You are a world-class brand strategist analyzing Canadian business banking competitive communications for Scotiabank. Write a deep competitor snapshot.

CITATION RULES — CRITICAL:
- Every time you reference a specific piece of communication, you MUST cite it using this exact format: [ENTRY:entry_id] where entry_id is the ID provided in the data.
- Citations must appear inline immediately after the claim, e.g. "Their 2024 awareness campaign leads with fear reduction [ENTRY:1234567890]"
- Never make a specific claim about a piece without citing it.
- At the end of the report, include a ## Sources section listing all cited entries as: [ENTRY:id] — Brand, Description, Year

BRAND CONSISTENCY SECTION — when generating this section, evaluate:
1. Tone consistency — does the emotional register stay coherent across channels and funnel stages?
2. Territory consistency — does the creative territory hold or fragment across pieces?
3. Value proposition evolution — how has the VP shifted or stayed stable over time?
4. Archetype coherence — does the brand archetype hold across all touchpoints?
5. Moment integrity — are there pieces that break the brand's own pattern? Which ones and why?
Rate each dimension: Strong / Partial / Fragmented, with specific cited evidence.

Write with authority. Use ## for sections, ### for subsections, **bold** for key findings. Use markdown tables where useful. Be conclusive and opinionated.`,

  category_landscape:`You are a world-class brand strategist analyzing the full Canadian business banking competitive landscape for Scotiabank.

CITATION RULES — CRITICAL:
- When referencing a specific piece as evidence, cite it as [ENTRY:entry_id]
- Citations appear inline: "TD's warmth-led approach peaks in their 2024 testimonial series [ENTRY:1234567890]"
- Include a ## Sources section at the end listing all cited entries.

Use ## for sections, **bold** for key findings, markdown tables for cross-brand comparisons. Be conclusive.`,

  opportunity:`You are a world-class brand strategist identifying strategic white spaces for Scotiabank in Canadian business banking.

CITATION RULES — CRITICAL:
- When pointing to specific evidence of a gap or a pattern, cite the entry as [ENTRY:entry_id]
- Include a ## Sources section at the end.

Be specific, opinionated, and direct. End with 3–5 named opportunity territories.`,

  creative_intelligence:`You are a world-class creative strategist analyzing global financial brand communications to extract inspiration for Scotiabank business banking.

CITATION RULES — CRITICAL:
- Cite specific global pieces as [ENTRY:entry_id] when referencing them as examples.
- Include a ## Sources section at the end.

For transferable examples, state: what they do, why it works, the transferable principle, and how it could apply in the Canadian context.`,

  innovation:`You are a world-class brand strategist identifying communication innovation and convention breaks in global financial brands.

CITATION RULES — CRITICAL:
- Cite specific pieces as [ENTRY:entry_id] when naming convention breakers or emerging signals.
- Include a ## Sources section at the end.

Focus on what breaks category norms. Identify emerging signals before they become mainstream.`,

  agnostic_snapshot:`You are a senior brand strategist writing a competitive communication audit.

CRITICAL: This is framework-agnostic. Do NOT reference any proprietary frameworks, models, or methodologies. No portraits, entry doors, journey phases, richness definitions, moments that matter, or client lifecycle. Write as a pure competitive communication audit.

Be specific — reference actual slogans, campaign names, and patterns from the data. No filler, no hedging. Confident analytical prose.

IMPORTANT — BRAND HERO EVOLUTION:
The data contains entries across multiple years. Brand Hero pieces represent core positioning campaigns. When a brand has Brand Hero entries from different years, this tells a story of positioning evolution. You MUST:
- Identify Brand Hero entries chronologically by year
- Use the MOST RECENT Brand Hero campaign as the current positioning reference
- Trace how the brand's positioning has evolved over time — shifts in archetype, territory, proposition, tone
- Note whether the evolution shows strategic consistency (building on the same territory) or strategic pivots (shifting direction)
- Reference specific campaigns by name/slogan and year when describing the evolution

CITATION RULES — CRITICAL:
- Every time you reference a specific piece of communication, cite it using [ENTRY:entry_id].
- Citations must appear inline immediately after the claim.
- Never make a specific claim about a piece without citing it.
- Include a ## Sources section at the end.

REPORT STRUCTURE — follow this EXACTLY:

## 01 — Understanding the Audience
(Focus ONLY on entries with Brand Hero communication intent — these are the core positioning pieces)
- **Demographic:** age range, financial profile, experience level inferred from the brand's hero communications
- **Psychographic:** mindset, motivations, self-image of the target audience as projected by the brand's core positioning
- **Tension:** the core unresolved need their brand addresses (1–2 sentences)
- **Human Insight:** a first-person quote (20–35 words) in italics, capturing the human truth the brand responds to
- **Audience Evolution:** If the brand's target audience has shifted across Brand Hero campaigns over time, describe the shift in 1–2 sentences. If consistent, state that.

## 02 — The Brand Response
(Focus ONLY on entries with Brand Hero communication intent — the core positioning pieces like manifestos, brand commercials, tagline-driven campaigns. Do NOT include Brand Tactical pieces like events, sponsorships, or cause marketing here.)

First, present the CURRENT positioning (based on the most recent Brand Hero campaign):
- **Creative Proposition:** 3–6 word campaign/brand idea label derived from the most recent hero pieces
- **Brand Archetype:** single archetype + one sentence explanation
- **Brand Role:** one sentence on what role the brand plays in the customer's life
- **Emotional Positioning Statement:** short phrase (5–10 words)
- **Rational Positioning Statement:** one sentence (15–25 words)
- **Brand Territory:** primary + secondary if applicable
- **Key Differentiators:** 3 bullet points
Include references to specific Brand Hero cases that support the findings.

Then, if multiple Brand Hero campaigns exist across different years:
- **Positioning Evolution:** A brief chronological narrative (3–5 sentences) tracing how the brand's core proposition, archetype, and territory have evolved. Reference specific campaigns by name/slogan and year. End with an assessment: is the evolution coherent and building equity, or fragmented and diluting the brand?

## 03 — Proof Points & Communication Strategy
(Analyze how the brand proves its positioning across Brand Hero and Brand Tactical pieces)
- **Primary Proof Point:** 1–2 sentences on the main proof of their positioning
- **Secondary Proof Points:** 3 supporting points, one line each
- **Communication Focus:** what their ads consistently revolve around (1–2 sentences)
- **Tone & Voice:** 3 labels (e.g., "Confident, Clear, Supportive")
- **Brand Tactical Support:** 1–2 sentences on how tactical brand pieces (events, sponsorships, community initiatives) reinforce or diverge from the core positioning

## 04 — Product Communication
(Focus on entries with Product communication intent)
- **Approach:** feature-led, outcome-led, or emotion-led — and one sentence explaining why
- **Key Product Messages:** the 3 most recurring product claims from the communications
- **Channels & Formats:** where and how product communication is primarily delivered
- **Gap:** one sentence on what product story they are NOT telling

## 05 — Beyond Banking & Innovation
(Focus on entries with Innovation or Beyond Banking communication intent)
- **Beyond Banking:** are they occupying lifestyle, community, aspiration, identity, or life-moment territories — and how genuinely? One paragraph.
- **Innovation:** Does innovation appear as a stated claim, a demonstrated capability, or is it absent? One paragraph with evidence from the communications.
- **White Space:** one sentence on the most credible territory this brand has not yet claimed

## 06 — Brand Assessment
Assessment of the brand itself — its positioning, identity, proposition, and territory. Base this primarily on Brand Hero pieces. Consider the positioning evolution in the assessment.
- **Strengths:** 3 bullets, each with a **bold label** + brief one-sentence explanation
- **Weaknesses:** 2 bullets, each with a **bold label** + brief one-sentence explanation

## 07 — Communication Assessment
Assessment across the three communication areas: proof points & strategy (section 03), product communication (section 04), and beyond banking & innovation (section 05).
- **Strengths:** 3 bullets, each with a **bold label** + brief one-sentence explanation referencing the specific communication area
- **Weaknesses:** 2 bullets, each with a **bold label** + brief one-sentence explanation referencing the specific communication area

Use ## for sections, **bold** for labels. Be conclusive and opinionated. Write with authority.`,
};

const BADGE={local:"bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",global:"bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200"};


// ── CAMPAIGN MAP COMPONENT ────────────────────────────────────────────────────
const JOURNEY_VIEWS = [
  {
    id:"funnel",
    label:"Conversion Funnel",
    stages:["Awareness","Consideration","Conversion","Retention","Advocacy"],
    field:"funnel",
    colors:{
      "Awareness":    {bg:"#EEF2FF",border:"#818CF8",text:"#3730A3",dot:"#6366F1"},
      "Consideration":{bg:"#F0FDF4",border:"#4ADE80",text:"#166534",dot:"#22C55E"},
      "Conversion":   {bg:"#FFF7ED",border:"#FB923C",text:"#9A3412",dot:"#F97316"},
      "Retention":    {bg:"#FDF4FF",border:"#E879F9",text:"#86198F",dot:"#D946EF"},
      "Advocacy":     {bg:"#FFFBEB",border:"#FBBF24",text:"#92400E",dot:"#F59E0B"},
    }
  },
  {
    id:"journey",
    label:"Business Journey",
    stages:["Existential","Validation","Complexity","Consolidation","Cross-phase","Not specific"],
    field:"journey_phase",
    colors:{
      "Existential":  {bg:"#FFF1F2",border:"#FB7185",text:"#9F1239",dot:"#F43F5E"},
      "Validation":   {bg:"#FFF7ED",border:"#FB923C",text:"#9A3412",dot:"#F97316"},
      "Complexity":   {bg:"#FFFBEB",border:"#FBBF24",text:"#92400E",dot:"#F59E0B"},
      "Consolidation":{bg:"#F0FDF4",border:"#4ADE80",text:"#166534",dot:"#22C55E"},
      "Cross-phase":  {bg:"#EEF2FF",border:"#818CF8",text:"#3730A3",dot:"#6366F1"},
      "Not specific": {bg:"#F9FAFB",border:"#D1D5DB",text:"#374151",dot:"#9CA3AF"},
    }
  },
  {
    id:"lifecycle",
    label:"Client Lifecycle",
    stages:["Starter","Growth","Steady","Succession","Cross-lifecycle","Not specific"],
    field:"client_lifecycle",
    colors:{
      "Starter":       {bg:"#EEF2FF",border:"#818CF8",text:"#3730A3",dot:"#6366F1"},
      "Growth":        {bg:"#F0FDF4",border:"#4ADE80",text:"#166534",dot:"#22C55E"},
      "Steady":        {bg:"#FFFBEB",border:"#FBBF24",text:"#92400E",dot:"#F59E0B"},
      "Succession":    {bg:"#FDF4FF",border:"#E879F9",text:"#86198F",dot:"#D946EF"},
      "Cross-lifecycle":{bg:"#FFF7ED",border:"#FB923C",text:"#9A3412",dot:"#F97316"},
      "Not specific":  {bg:"#F9FAFB",border:"#D1D5DB",text:"#374151",dot:"#9CA3AF"},
    }
  },
];

function CampaignMap({ entries, onEntryClick, activeView: extActiveView, setActiveView: extSetActiveView }) {
  const [internalView, setInternalView] = useState("funnel");
  const activeView = extActiveView || internalView;
  const setActiveView = extSetActiveView || setInternalView;
  const [expandedStage, setExpandedStage] = useState(null);

  const view = JOURNEY_VIEWS.find(v => v.id === activeView);

  // Group entries by the active field — values can be comma-separated
  const grouped = {};
  view.stages.forEach(s => grouped[s] = []);
  grouped["Unassigned"] = [];

  entries.forEach(e => {
    const vals = e[view.field] ? e[view.field].split(",").map(v => v.trim()).filter(Boolean) : [];
    if (vals.length === 0) {
      grouped["Unassigned"].push(e);
    } else {
      vals.forEach(v => {
        if (grouped[v] !== undefined) grouped[v].push(e);
        else grouped["Unassigned"].push(e);
      });
    }
  });

  const stages = [...view.stages, "Unassigned"].filter(s => grouped[s]?.length > 0);

  return (
    <div style={{marginTop:32,marginBottom:8}}>
      {/* Header + view switcher */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,borderBottom:"1px solid var(--border)",paddingBottom:12}}>
        <h2 style={{fontSize:20,fontWeight:700,color:"var(--text)",margin:0}}>Campaign Map</h2>
        <div style={{display:"flex",gap:4,background:"var(--surface2)",borderRadius:8,padding:3}}>
          {JOURNEY_VIEWS.map(v => (
            <button key={v.id} onClick={() => { setActiveView(v.id); setExpandedStage(null); }}
              style={{
                padding:"5px 12px",borderRadius:6,border:"none",cursor:"pointer",fontSize:11,fontWeight:600,
                transition:"all 0.15s",
                background: activeView===v.id ? "var(--surface)" : "transparent",
                color: activeView===v.id ? "var(--accent)" : "var(--text2)",
                boxShadow: activeView===v.id ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
              }}
            >{v.label}</button>
          ))}
        </div>
      </div>

      {/* Stage columns */}
      <div style={{display:"grid",gridTemplateColumns:`repeat(${Math.min(stages.length,5)},1fr)`,gap:10}}>
        {stages.map(stage => {
          const items = grouped[stage];
          const colors = view.colors[stage] || {bg:"#F9FAFB",border:"#D1D5DB",text:"#374151",dot:"#9CA3AF"};
          const isExpanded = expandedStage === stage;
          const shown = isExpanded ? items : items.slice(0, 4);

          return (
            <div key={stage} style={{background:colors.bg,border:`1.5px solid ${colors.border}`,borderRadius:12,padding:12}}>
              {/* Stage header */}
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10}}>
                <div style={{width:8,height:8,borderRadius:"50%",background:colors.dot,flexShrink:0}}/>
                <span style={{fontSize:11,fontWeight:700,color:colors.text,textTransform:"uppercase",letterSpacing:"0.05em",flex:1}}>{stage}</span>
                <span style={{fontSize:10,color:colors.text,opacity:0.6,fontWeight:700,background:"rgba(0,0,0,0.06)",borderRadius:10,padding:"1px 6px"}}>{items.length}</span>
              </div>

              {/* Entry cards */}
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {shown.map(e => {
                  const thumb = ytId(e.url)
                    ? `https://img.youtube.com/vi/${ytId(e.url)}/mqdefault.jpg`
                    : e.image_url;
                  return (
                    <div key={e.id} onClick={() => onEntryClick(e)}
                      style={{background:"rgba(255,255,255,0.8)",borderRadius:8,padding:"8px 8px 6px",cursor:"pointer",border:"1px solid rgba(255,255,255,0.9)",transition:"all 0.15s"}}
                      onMouseEnter={el => {el.currentTarget.style.background="rgba(255,255,255,0.98)";el.currentTarget.style.transform="translateY(-1px)";}}
                      onMouseLeave={el => {el.currentTarget.style.background="rgba(255,255,255,0.8)";el.currentTarget.style.transform="none";}}
                    >
                      {thumb && (
                        <div style={{width:"100%",height:56,borderRadius:6,overflow:"hidden",marginBottom:6,background:"#e5e7eb"}}>
                          <img src={thumb} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                        </div>
                      )}
                      <p style={{fontSize:11,fontWeight:600,color:"#111",lineHeight:1.3,margin:"0 0 4px"}}>
                        {(e.description||"Untitled").slice(0,48)}{(e.description||"").length>48?"…":""}
                      </p>
                      <div style={{display:"flex",gap:3,flexWrap:"wrap",alignItems:"center"}}>
                        {e.year&&<span style={{fontSize:9,color:"#555",background:"rgba(0,0,0,0.05)",borderRadius:3,padding:"1px 4px"}}>{e.year}</span>}
                        {e.type&&<span style={{fontSize:9,color:"#555",background:"rgba(0,0,0,0.05)",borderRadius:3,padding:"1px 4px"}}>{e.type}</span>}
                        {e.portrait&&<span style={{fontSize:9,color:colors.text,fontWeight:600,background:"rgba(255,255,255,0.5)",borderRadius:3,padding:"1px 4px"}}>{e.portrait.split(",")[0].trim()}</span>}
                        {e.rating&&<span style={{fontSize:9,marginLeft:"auto"}}>{"★".repeat(Number(e.rating))}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>

              {items.length > 4 && (
                <button onClick={() => setExpandedStage(isExpanded ? null : stage)}
                  style={{marginTop:6,width:"100%",fontSize:10,color:colors.text,background:"transparent",border:"none",cursor:"pointer",padding:"4px 0",fontWeight:600,opacity:0.75}}
                >
                  {isExpanded ? "Show less ↑" : `+${items.length - 4} more ↓`}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Unassigned note */}
      {grouped["Unassigned"]?.length > 0 && (
        <p style={{fontSize:11,color:"var(--text2)",marginTop:8,opacity:0.5}}>
          * {grouped["Unassigned"].length} piece{grouped["Unassigned"].length>1?"s":""} without {view.label.toLowerCase()} assigned
        </p>
      )}
    </div>
  );
}

function EntryViewer({entry,onClose}){
  if(!entry)return null;const e=entry;
  return(<div className="h-full flex flex-col">
    <div className="p-3 border-b border-main flex justify-between items-center flex-shrink-0"><b className="text-sm text-main truncate">{e.description||e.competitor||e.brand}</b><span onClick={onClose} className="cursor-pointer text-lg text-hint hover:text-main ml-2">×</span></div>
    <div className="flex-1 overflow-auto">
      {ytId(e.url)&&<div className="px-3 pt-2"><iframe width="100%" height="180" src={`https://www.youtube.com/embed/${ytId(e.url)}`} frameBorder="0" allowFullScreen className="rounded-md"/></div>}
      {e.image_url&&!ytId(e.url)&&<div className="px-3 pt-2"><img src={e.image_url} className="w-full rounded-md"/></div>}
      <div className="p-3">
        <div className="flex gap-1 flex-wrap mb-2">{e.competitor&&<Tag v={e.competitor}/>}{e.brand&&<span className="text-xs font-semibold text-main bg-surface2 px-1.5 py-0.5 rounded">{e.brand}</span>}{e.year&&<span className="bg-surface2 px-1.5 py-0.5 rounded text-[11px] text-main">{e.year}</span>}</div>
        {[["Portrait",e.portrait],["Phase",e.journey_phase],["Door",e.entry_door],["Archetype",e.brand_archetype],["Tone",e.tone_of_voice],["Territory",e.primary_territory],["Slogan",e.main_slogan]].filter(([,v])=>v&&v!==""&&!v.startsWith("Not ")&&!v.startsWith("None")).map(([l,v])=>(<div key={l} className="text-xs mb-0.5"><span className="text-muted">{l}:</span> <span className="text-main">{v}</span></div>))}
      </div>
      {e.synopsis&&<div className="px-3 pb-2"><div className="text-[10px] font-semibold text-hint uppercase mb-1">Synopsis</div><div className="text-xs leading-relaxed bg-surface2 p-2 rounded text-main">{e.synopsis}</div></div>}
      {e.insight&&<div className="px-3 pb-2"><div className="text-[10px] font-semibold text-hint uppercase mb-1">Insight</div><div className="text-xs leading-relaxed bg-surface2 p-2 rounded text-main">{e.insight}</div></div>}
      {e.analyst_comment&&<div className="px-3 pb-2"><div className="text-[10px] font-semibold text-hint uppercase mb-1">Analyst notes</div><div className="text-xs leading-relaxed bg-surface2 p-2 rounded text-main">{e.analyst_comment}</div></div>}
    </div>
  </div>);
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
function ReportsContent(){
  const{projectId}=useProject();
  const searchParams=useSearchParams();
  const tabParam=searchParams.get("tab");
  const reportParam=searchParams.get("report");
  const view=reportParam?"generate":(tabParam||"generate");
  const[journeyBrand,setJourneyBrand]=useState("");
  const[journeyView,setJourneyView]=useState("funnel");
  const[selectedTemplate,setSelectedTemplate]=useState(null);
  const[localData,setLocalData]=useState([]);
  const[globalData,setGlobalData]=useState([]);
  const[allYears,setAllYears]=useState([]);
  const[yearFrom,setYearFrom]=useState("");
  const[yearTo,setYearTo]=useState("");
  const[OPTIONS,setOPTIONS]=useState(STATIC_OPTIONS);
  const[loading,setLoading]=useState(true);
  const[brandMetaMap,setBrandMetaMap]=useState({});
  const[competitors,setCompetitors]=useState([]);
  const[sections,setSections]=useState([]);
  const[customInstructions,setCustomInstructions]=useState("");
  const[report,setReport]=useState("");
  const[reportTitle,setReportTitle]=useState("");
  const[generating,setGenerating]=useState(false);
  const[copied,setCopied]=useState(false);
  const[viewerOpen,setViewerOpen]=useState(false);
  const[viewerEntry,setViewerEntry]=useState(null);
  const[searchQuery,setSearchQuery]=useState("");
  const[savedReports,setSavedReports]=useState([]);
  const[viewingReport,setViewingReport]=useState(null);
  const[saving,setSaving]=useState(false);
  const reportRef=useRef(null);
  const supabase=createClient();
  const router=useRouter();
  const[generatingShowcase,setGeneratingShowcase]=useState(false);

  useEffect(()=>{(async()=>{
    const[{data:local},{data:global},{data:reports}]=await Promise.all([
      supabase.from("audit_entries").select("*").eq("project_id",projectId),
      supabase.from("audit_global").select("*").eq("project_id",projectId),
      supabase.from("saved_reports").select("*").eq("project_id",projectId).order("created_at",{ascending:false}),
    ]);
    const ld=local||[];const gd=global||[];
    setLocalData(ld);setGlobalData(gd);setSavedReports(reports||[]);
    const years=[...new Set([...ld,...gd].map(e=>e.year).filter(Boolean))].sort();
    setAllYears(years);
    if(years.length>0){setYearFrom(years[0]);setYearTo(years[years.length-1]);}
    const opts=await fetchOptions(projectId);setOPTIONS(opts);setLoading(false);
  })();},[projectId]);

  useEffect(()=>{
    if(!reportParam){setViewingReport(null);return;}
    if(viewingReport?.id===reportParam)return;
    const found=savedReports.find(r=>r.id===reportParam);
    if(found)setViewingReport(found);
  },[reportParam,savedReports]);

  useEffect(()=>{
    if(!selectedTemplate)return;
    setSections(selectedTemplate.sections.map(s=>s.id));
    setCompetitors([]);setReport("");setViewingReport(null);
  },[selectedTemplate]);

  const currentData=selectedTemplate?.scopeAny?[...localData,...globalData]:selectedTemplate?.scope==="local"?localData:globalData;
  const filteredData=currentData.filter(e=>{
    const brand=e.competitor||e.brand||"";
    const matchBrand=competitors.length===0||competitors.includes(brand);
    const matchYear=(!yearFrom||!e.year||e.year>=yearFrom)&&(!yearTo||!e.year||e.year<=yearTo);
    return matchBrand&&matchYear;
  });
  // Load brand metadata
  useEffect(()=>{(async()=>{
    const{data}=await supabase.from("brand_metadata").select("brand_name,brand_category").eq("project_id",projectId);
    const map={};(data||[]).forEach(m=>{map[m.brand_name]=m.brand_category;});
    setBrandMetaMap(map);
  })();},[projectId]);

  const buildGroupedBrands=(dataArr,brandKey)=>{
    const allBrandSet=new Set();
    dataArr.forEach(e=>{if(e[brandKey])allBrandSet.add(e[brandKey]);});
    if(brandKey==="competitor")(OPTIONS.competitor||[]).filter(v=>v!=="Other").forEach(b=>allBrandSet.add(b));
    const groups={};
    allBrandSet.forEach(b=>{const cat=brandMetaMap[b]||"Other";if(!groups[cat])groups[cat]=[];groups[cat].push(b);});
    const order=["Traditional Banking","Fintech","Neobank","Credit Union","Supplementary Services","Non-financial","Other"];
    return Object.entries(groups).sort((a,b)=>{const ia=order.indexOf(a[0]),ib=order.indexOf(b[0]);return(ia===-1?99:ia)-(ib===-1?99:ib);}).map(([cat,brands])=>({cat,brands:brands.sort()}));
  };
  const groupedBrands=selectedTemplate?.scopeAny
    ?(()=>{const localG=buildGroupedBrands(localData,"competitor");const globalG=buildGroupedBrands(globalData,"brand");const merged={};[...localG,...globalG].forEach(g=>{if(!merged[g.cat])merged[g.cat]=new Set();g.brands.forEach(b=>merged[g.cat].add(b));});const order=["Traditional Banking","Fintech","Neobank","Credit Union","Supplementary Services","Non-financial","Other"];return Object.entries(merged).sort((a,b)=>{const ia=order.indexOf(a[0]),ib=order.indexOf(b[0]);return(ia===-1?99:ia)-(ib===-1?99:ib);}).map(([cat,set])=>({cat,brands:[...set].sort()}));})()
    :selectedTemplate?.scope==="local"
      ?buildGroupedBrands(localData,"competitor")
      :buildGroupedBrands(globalData,"brand");
  const availableBrands=groupedBrands.flatMap(g=>g.brands);
  const allData=[...localData,...globalData];

  const toggleComp=(c)=>{
    if(selectedTemplate?.singleBrand){setCompetitors([c]);return;}
    setCompetitors(prev=>prev.includes(c)?prev.filter(x=>x!==c):[...prev,c]);
  };
  const toggleSec=(id)=>setSections(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id]);
  const copyReport=()=>{navigator.clipboard.writeText(report||viewingReport?.content||"");setCopied(true);setTimeout(()=>setCopied(false),2000);};
  const downloadMD=()=>{const content=report||viewingReport?.content||"";const blob=new Blob([content],{type:"text/markdown"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="report.md";document.body.appendChild(a);a.click();document.body.removeChild(a);};
  const downloadPDF=async()=>{if(!reportRef.current)return;const html2pdf=(await import("html2pdf.js")).default;html2pdf(reportRef.current,{margin:[15,15,25,15],filename:"report.pdf",image:{type:"jpeg",quality:0.98},html2canvas:{scale:2,useCORS:true},jsPDF:{unit:"mm",format:"a4",orientation:"portrait"},pagebreak:{mode:["avoid-all","css","legacy"]}});};

  const handleCiteClick=(entry)=>{
    setViewerEntry(entry);
    setViewerOpen(true);
  };

  const saveReport=async(openEditor=false)=>{
    if(!report)return null;setSaving(true);
    const{data:{session}}=await supabase.auth.getSession();
    const rTitle=reportTitle||`${selectedTemplate?.label} — ${new Date().toLocaleDateString()}`;
    const id=String(Date.now());
    const reportObj={
      id,title:rTitle,
      scope:selectedTemplate?.scopeAny?"local":selectedTemplate?.scope||"local",
      template_type:selectedTemplate?.id||"",
      sections:sections.join(","),
      competitors:competitors.join(","),
      custom_instructions:customInstructions,
      year_from:yearFrom,year_to:yearTo,
      content:report,
      created_by:session?.user?.email||"",
      project_id:projectId,
    };
    await supabase.from("saved_reports").insert(reportObj);
    const{data:reports}=await supabase.from("saved_reports").select("*").eq("project_id",projectId).order("created_at",{ascending:false});
    setSavedReports(reports||[]);setSaving(false);
    if(openEditor)router.push(`/reports/editor?id=${id}`);
    return reportObj;
  };

  const deleteReport=async(id)=>{
    if(!confirm("Delete this report?"))return;
    await supabase.from("saved_reports").delete().eq("id",id);
    const{data:reports}=await supabase.from("saved_reports").select("*").eq("project_id",projectId).order("created_at",{ascending:false});
    setSavedReports(reports||[]);
    if(viewingReport?.id===id)router.push("/reports?tab=archive",{scroll:false});
  };

  const searchResults=searchQuery.length>1?allData.filter(e=>{const q=searchQuery.toLowerCase();return(e.description||"").toLowerCase().includes(q)||(e.competitor||"").toLowerCase().includes(q)||(e.brand||"").toLowerCase().includes(q)||(e.main_slogan||"").toLowerCase().includes(q);}).slice(0,10):[];

  const generate=async()=>{
    if(!selectedTemplate)return;
    setGenerating(true);setReport("");setViewingReport(null);
    const timeRange=yearFrom&&yearTo?` (${yearFrom}–${yearTo})`:"";
    const sectionNames=sections.map(id=>selectedTemplate.sections.find(s=>s.id===id)?.label).filter(Boolean).join(", ");

    // Build data string with IDs for citations
    let dataStr;
    if(selectedTemplate.id==="agnostic_snapshot"){
      // Agnostic snapshot: aggregated counts + full text fields
      const fd=filteredData;
      const countField=(field)=>{const c={};fd.forEach(e=>{const v=e[field];if(v&&v!=="Other"&&!v.startsWith("Not ")&&!v.startsWith("None"))v.split(",").map(s=>s.trim()).forEach(s=>{c[s]=(c[s]||0)+1;});});return Object.entries(c).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${k} (${v})`).join(", ");};
      const collectField=(field)=>fd.map(e=>e[field]).filter(Boolean).map((v,i)=>`[ID:${fd[i]?.id}] ${v}`);
      const avgRating=fd.filter(e=>e.rating).length>0?(fd.filter(e=>e.rating).reduce((s,e)=>s+Number(e.rating),0)/fd.filter(e=>e.rating).length).toFixed(1):"N/A";

      dataStr=`BRAND: ${competitors[0]||"Unknown"}
TOTAL ENTRIES: ${fd.length}
AVERAGE RATING: ${avgRating}/5

COMMUNICATION INTENT BREAKDOWN:
${countField("communication_intent")}

AGGREGATED FREQUENCIES:
Brand Archetype: ${countField("brand_archetype")}
Primary Territory: ${countField("primary_territory")}
Secondary Territory: ${countField("secondary_territory")}
Tone of Voice: ${countField("tone_of_voice")}
Execution Style: ${countField("execution_style")}
Channel: ${countField("channel")}
CTA: ${countField("cta")}
Differentiation: ${countField("diff_claim")}
Media Type: ${countField("type")}
Pain Point Type: ${countField("pain_point_type")}

EMOTIONAL BENEFITS:
${collectField("emotional_benefit").join("\n")}

RATIONAL BENEFITS:
${collectField("rational_benefit").join("\n")}

MAIN VALUE PROPOSITIONS:
${collectField("main_vp").join("\n")}

SLOGANS:
${collectField("main_slogan").join("\n")}

INSIGHTS (human truths):
${collectField("insight").join("\n")}

CREATIVE IDEAS:
${collectField("idea").join("\n")}

PAIN POINTS:
${fd.map(e=>e.pain_point?`[ID:${e.id}] (${e.pain_point_type||""}) ${e.pain_point}`:"").filter(Boolean).join("\n")}

SYNOPSES:
${collectField("synopsis").join("\n")}

ANALYST COMMENTS:
${collectField("analyst_comment").join("\n")}

ENTRY DESCRIPTIONS:
${fd.map(e=>`[ID:${e.id}] [${e.year||""}] [${e.type||""}] [Intent:${e.communication_intent||""}] ${e.description||""} | Slogan:${e.main_slogan||""} | Territory:${e.primary_territory||""} | Tone:${e.tone_of_voice||""} | Archetype:${e.brand_archetype||""} | URL:${e.url||""} | Image:${e.image_url||""}`).join("\n")}`;
    }else{
      dataStr=filteredData.map(e=>`[ID:${e.id}] [${e.competitor||e.brand}${e.year?" "+e.year:""}] ${e.description||""} | Portrait:${e.portrait||""} | Door:${e.entry_door||""} | Phase:${e.journey_phase||""} | Lifecycle:${e.client_lifecycle||""} | Tone:${e.tone_of_voice||""} | Role:${e.bank_role||""} | Lang:${e.language_register||""} | Pain:${e.pain_point_type||""} | Archetype:${e.brand_archetype||""} | Territory:${e.primary_territory||""} | SecTerritory:${e.secondary_territory||""} | Execution:${e.execution_style||""} | Size:${e.business_size||""} | Moment_Acq:${e.moment_acquisition||""} | Moment_Deep:${e.moment_deepening||""} | Moment_Unexp:${e.moment_unexpected||""} | Richness:${e.richness_definition||""} | Diff:${e.diff_claim||""} | Insight:${(e.insight||"").slice(0,120)} | Synopsis:${(e.synopsis||"").slice(0,120)}`).join("\n");
    }

    const system=SYSTEM_PROMPTS[selectedTemplate.id];
    const userMsg=`Audit data${timeRange} — ${filteredData.length} pieces:\n${dataStr}\n\nGenerate the following sections: ${sectionNames}\n\n${customInstructions?`Additional instructions: ${customInstructions}`:""}\n\nIMPORTANT — CITATION RULE:
- Every entry starts with [ID:xxxxxxxxxxxxxxx] — use that EXACT full numeric ID.
- Write a SHORT HUMAN-READABLE name for the piece in your prose, then add [ENTRY:id] right after.
- Example: "Their AI adoption guide [ENTRY:1773496163636] positions CIBC as..."
- NEVER put the numeric ID in your prose text. NEVER write "(ID: 883404)" or "Meta Ad Library creative (ID: 883404)".
- Use short descriptive names like "their Instagram campaign", "the women entrepreneur series", "How I made it" — NOT the raw description field which may contain technical IDs.
- The [ENTRY:id] token is invisible to the reader. It only appears in your output as [ENTRY:123456], nowhere else.
- Do NOT place citations inside markdown table rows (| col | col |) — only use them in prose paragraphs and bullet points.\n\nUse markdown with ## headers, tables, and **bold** key findings. Be analytical and conclusive, not descriptive.`;
    try{
      const res=await fetch("/api/ai",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({use_opus:true,max_tokens:8000,system,messages:[{role:"user",content:userMsg}]})});
      const result=await res.json();
      if(result.error)setReport("Error: "+result.error);
      else setReport(result.content?.map(c=>c.text||"").join("")||"No content.");
    }catch(err){setReport("Error: "+err.message);}
    setGenerating(false);
  };

  /* ─── GENERATE SHOWCASE FROM REPORT (using original entry data) ─── */
  const generateShowcaseFromReport = async (reportOverride) => {
    const rpt = reportOverride || viewingReport;
    if (!rpt) return;
    setGeneratingShowcase(true);

    const isAgnostic = rpt.template_type === "agnostic_snapshot";
    const brandName = rpt.competitors || "";
    const scope = rpt.scope || "local";

    // Get the original entries for this brand — same data the report was built from
    let entries = [];
    if (scope === "local" || isAgnostic) {
      const { data } = await supabase.from("audit_entries").select("*").eq("project_id", projectId);
      if (data) entries.push(...(brandName ? data.filter(e => e.competitor === brandName) : data));
    }
    if (scope === "global" || isAgnostic) {
      const { data } = await supabase.from("audit_global").select("*").eq("project_id", projectId);
      if (data) entries.push(...(brandName ? data.filter(e => e.brand === brandName) : data));
    }
    // Apply year filters if the report had them
    if (rpt.year_from) entries = entries.filter(e => e.year >= rpt.year_from);
    if (rpt.year_to) entries = entries.filter(e => e.year <= rpt.year_to);

    if (entries.length === 0) { alert("No entries found for this report's brand/scope"); setGeneratingShowcase(false); return; }

    const entryData = entries.map(e => ({
      id: e.id, brand: e.competitor || e.brand || "Unknown", country: e.country || "Local market",
      year: e.year, type: e.type, description: e.description, insight: e.insight, idea: e.idea,
      synopsis: e.synopsis, main_slogan: e.main_slogan, primary_territory: e.primary_territory,
      secondary_territory: e.secondary_territory, tone_of_voice: e.tone_of_voice,
      brand_archetype: e.brand_archetype, communication_intent: e.communication_intent,
      funnel: e.funnel, rating: e.rating, image_url: e.image_url, image_urls: e.image_urls,
      url: e.url, analyst_comment: e.analyst_comment, execution_style: e.execution_style,
      main_vp: e.main_vp, emotional_benefit: e.emotional_benefit,
      rational_benefit: e.rational_benefit, pain_point: e.pain_point,
    }));

    // Also pass the report content so AI can extract the exact findings
    const reportContent = rpt.content || "";
    const scopeLabel = scope === "local" ? "Local Audit" : scope === "global" ? "Global Benchmark" : "Local + Global";
    const dateStr = new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" });
    const fullDateStr = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

    let systemPrompt, userMsg;

    if (isAgnostic) {
      systemPrompt = `You are reformatting an Agnostic Competitor Snapshot report into a structured slide deck.

CRITICAL: The report content is provided below. EXTRACT the content from each section and map it to the corresponding slide fields. Do NOT generate new analysis — use what the report already says, shortened for visual scannability.

The original audit entries are also provided so you can include image_url and media_url (video URLs) for relevant entries.

This is framework-agnostic. No portraits, entry doors, journey phases, richness definitions, moments that matter, or client lifecycle.

MAPPING — Report section → Slide:
- "## 01 — Understanding the Audience" → SLIDE 2: extract Demographic, Psychographic, Tension, Human Insight
- "## 02 — The Brand Response" → SLIDE 3: extract Creative Proposition, Brand Archetype, Brand Role, Emotional/Rational Positioning, Brand Territory, Key Differentiators
- "## 03 — Proof Points & Communication Strategy" → SLIDE 4: extract Primary/Secondary Proof Points, Communication Focus, Tone & Voice
- "## 04 — Product Communication" → SLIDE 5: extract Approach, Key Product Messages, Channels & Formats, Gap
- "## 05 — Beyond Banking & Innovation" → SLIDE 6: extract Beyond Banking, Innovation, White Space
- "## 06 — Brand Assessment" → SLIDE 7: extract Strengths and Weaknesses (brand-focused)
- "## 07 — Communication Assessment" → SLIDE 8: extract Strengths and Weaknesses (communication-focused)

Return EXACTLY 9 slides as JSON:

SLIDE 1: type:"cs_title" — brand ("${brandName}"), scope ("${scopeLabel}"), date ("${dateStr}"), entry_count (${entries.length}), subtitle ("Competitive Communication Snapshot")
SLIDE 2: type:"cs_audience" — demographic (string), psychographic (string), tension (string), human_insight (string — first-person quote 20-35 words)
SLIDE 3: type:"cs_brand_response" — creative_proposition (3-6 words), proposition_description (one line), brand_archetype (name + sentence), brand_role (sentence), emotional_positioning (5-10 words), rational_positioning (15-25 words), brand_territory (primary + secondary), key_differentiators (array of 3 strings)
SLIDE 4: type:"cs_proof_points" — creative_proposition (same as slide 3), primary_proof (1-2 sentences), secondary_proofs (array of 3 strings), communication_focus (1-2 sentences), tone_voice (array of 3 labels)
SLIDE 5: type:"cs_product" — approach (one sentence), key_messages (array of 3), channels_formats (string), gap (one sentence insight)
SLIDE 6: type:"cs_beyond_banking" — beyond_banking (one paragraph), innovation (one paragraph), white_space (one sentence insight)
SLIDE 7: type:"cs_brand_assessment" — strengths (array of 3 {label, explanation}), weaknesses (array of 2 {label, explanation})
SLIDE 8: type:"cs_comm_assessment" — strengths (array of 3 {label, explanation}), weaknesses (array of 2 {label, explanation})
SLIDE 9: type:"cs_closing" — title ("Thank You"), subtitle ("Generated by Knots & Dots — Category Landscape Platform"), date ("${fullDateStr}")

Return ONLY valid JSON: {"title":"...","slides":[...]}`;

      userMsg = `REPORT CONTENT:\n${reportContent}\n\nORIGINAL ENTRIES (${entries.length} entries — use for image_url/url references):\n${JSON.stringify(entryData.slice(0, 30), null, 1)}`;
    } else {
      // Creative showcase from non-agnostic reports
      systemPrompt = `You are a senior creative strategist at Knots & Dots. Transform this report into a cinematic showcase presentation.

The original audit entries are provided so you can include image_url and media_url for relevant findings.

STRUCTURE:
1. type:"title" — Fields: title, subtitle, client, objective
2. type:"key_findings" — Fields: title, findings (array of {number, heading, summary})
3. Multiple type:"finding" — One per key insight. Fields: title, body (markdown 3-5 sentences), brand, year, country, territory, image_url (from entry), media_url (YouTube URL from entry), media_type ("Video"/"Image"), entry_id
4. type:"takeaways" — Fields: title, takeaways (array of 4-6 strings)
5. type:"closing" — Fields: title, subtitle

RULES:
- Extract findings from the report — use the original entries for image_url and media_url
- CRITICAL: For each finding, match it to the relevant entry and include its image_url and url (as media_url if YouTube)
- Bold, provocative slide headlines
- ALL output in English
- Return ONLY valid JSON: {"title":"...","slides":[...]}`;

      userMsg = `REPORT CONTENT:\n${reportContent}\n\nORIGINAL ENTRIES (use for images/videos):\n${JSON.stringify(entryData, null, 1)}`;
    }

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ use_opus: true, max_tokens: 8000, system: systemPrompt, messages: [{ role: "user", content: userMsg }] }),
      });
      const data = await res.json();
      const text = data.content?.[0]?.text || "";
      let parsed;
      try { parsed = JSON.parse(text); } catch {
        const m2 = text.match(/\{[\s\S]*\}/);
        if (m2) parsed = JSON.parse(m2[0]); else throw new Error("Could not parse AI response");
      }

      const { data: { session } } = await supabase.auth.getSession();
      const { data: showcase } = await supabase.from("saved_showcases").insert({
        title: parsed.title || rpt.title || "Showcase",
        project_id: projectId,
        slides: parsed.slides || [],
        created_by: session?.user?.email || "",
        filters: {
          source_report_id: rpt.id,
          ...(isAgnostic ? { showcaseType: "competitor_snapshot" } : {}),
        },
      }).select().single();

      if (showcase) router.push(`/showcase?view=${showcase.id}`);
    } catch (err) {
      alert("Error generating showcase: " + err.message);
    }
    setGeneratingShowcase(false);
  };

  if(loading)return <div className="p-10 text-center text-hint">Loading...</div>;
  const activeContent=viewingReport?.content||report;

  const Signature=()=>(<div className="mt-10 pt-6 border-t border-main text-center"><img src="/knots-dots-logo.png" alt="Knots & Dots" style={{height:24,margin:"0 auto 8px"}}/><p className="text-[10px] text-hint">Generated by Knots & Dots — Category Landscape Platform</p><p className="text-[9px] text-hint mt-0.5">{new Date().toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"})}</p></div>);

  const renderContent = (rawContent) => {
    if (!rawContent) return null;

    // 1. Strip citations from table rows (they break table rendering)
    const cleaned = rawContent
      .replace(/^\s*\[ENTRY:[^\]]+\]\s*$/gm, "")
      .replace(/^(.*\|.*)$/gm, row => row.replace(/\[ENTRY:[^\]]+\]/g, ""));

    // 2. Convert [ENTRY:id] to markdown links [label](cite:id) — inline, no line breaks
    const withCiteLinks = cleaned.replace(/\[ENTRY:([^\]]+)\]/g, (match, id) => {
      const entry = allData.find(e => e.id === id);
      let label = entry
        ? (entry.description || entry.competitor || entry.brand || "source").slice(0, 50)
        : "source";
      label = label.replace(/\s*\(?ID[:\s]+[\d\w]+\)?/gi, "").trim().slice(0, 50);
      // Escape brackets in label for markdown safety
      label = label.replace(/[\[\]]/g, "");
      return `[${label}](__cite__${id})`;
    });

    const proseClass = "prose prose-sm md:prose-base max-w-none dark:prose-invert prose-headings:text-[var(--text)] prose-p:text-[var(--text2)] prose-strong:text-[var(--text)] prose-li:text-[var(--text2)] prose-h2:border-b prose-h2:border-[var(--border)] prose-h2:pb-2 prose-h2:mt-8 prose-h3:mt-6 prose-table:text-sm prose-th:bg-[var(--surface2)] prose-th:px-3 prose-th:py-2 prose-td:px-3 prose-td:py-2 prose-td:border-[var(--border)]";

    // 3. Single Markdown pass — citations become <a> tags handled by custom component
    return (
      <Markdown
        remarkPlugins={[remarkGfm]}
        urlTransform={(url) => url}
        className={proseClass}
        components={{
          a: ({href, children}) => {
            if (href?.startsWith("__cite__")) {
              const id = href.replace("__cite__", "");
              const entry = allData.find(e => e.id === id);
              return (
                <span
                  onClick={() => handleCiteClick(entry || {id, description: String(children)})}
                  style={{color:"var(--accent)",textDecoration:"underline",textDecorationStyle:"dotted",cursor:"pointer",textUnderlineOffset:"3px"}}
                >{children}</span>
              );
            }
            return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
          }
        }}
      >{withCiteLinks}</Markdown>
    );
  };

  return(
    <div className="min-h-screen" style={{background:"var(--bg)"}}>

      {/* TOP BAR */}
      <div className="section-bar px-5 py-3 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-bold text-main">Reports</h2>
          <div className="flex bg-surface2 rounded-lg p-0.5">
            <button onClick={()=>router.push("/reports",{scroll:false})} className={`px-3 py-1 rounded-md text-xs font-medium transition ${view==="generate"?"bg-surface text-accent shadow-sm":"text-muted"}`}>Generate</button>
            <button onClick={()=>router.push("/reports?tab=journey",{scroll:false})} className={`px-3 py-1 rounded-md text-xs font-medium transition ${view==="journey"?"bg-surface text-accent shadow-sm":"text-muted"}`}>Journey Map</button>
            <button onClick={()=>router.push("/reports?tab=archive",{scroll:false})} className={`px-3 py-1 rounded-md text-xs font-medium transition ${view==="archive"?"bg-surface text-accent shadow-sm":"text-muted"}`}>Archive ({savedReports.length})</button>
          </div>
        </div>
        {activeContent&&<button onClick={()=>setViewerOpen(!viewerOpen)} className={`px-3 py-1.5 text-xs rounded-lg font-medium border transition ${viewerOpen?"bg-accent-soft border-[var(--accent)] text-accent":"border-main text-muted hover:bg-surface2"}`}>{viewerOpen?"Hide entries":"Search entries"}</button>}
      </div>

      {/* JOURNEY MAP VIEW */}
      {view==="journey"&&(
        <div className="px-5 py-5 w-full flex justify-center">
          <div className="w-full max-w-5xl">
            {/* Brand selector */}
            <div className="mb-5">
              <p className="text-xs text-hint mb-2">Select a brand to explore its journey map</p>
              <div className="flex gap-2 flex-wrap">
                {[...new Set(localData.map(e=>e.competitor).filter(Boolean))].sort().map(c=>(
                  <button key={c} onClick={()=>setJourneyBrand(c)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${journeyBrand===c?"bg-accent-soft border-[var(--accent)] text-accent":"bg-surface border-main text-hint hover:border-[var(--accent)]"}`}
                  >{c}</button>
                ))}
              </div>
            </div>
            {journeyBrand&&(
              <CampaignMap
                entries={localData.filter(e=>e.competitor===journeyBrand)}
                onEntryClick={handleCiteClick}
                activeView={journeyView}
                setActiveView={setJourneyView}
              />
            )}
            {!journeyBrand&&(
              <div className="text-center py-20 text-hint text-sm">Select a brand above to see its journey map</div>
            )}
          </div>
        </div>
      )}

      {/* ARCHIVE */}
      {view==="archive"&&!viewingReport&&(
        <div className="px-5 py-5 w-full flex justify-center"><div className="w-full max-w-3xl">
          {savedReports.length===0
            ?<div className="text-center text-hint py-20">No saved reports yet.</div>
            :<div className="space-y-2">{savedReports.map(r=>(
              <div key={r.id} className="bg-surface border border-main rounded-lg p-4 flex justify-between items-center hover:border-[var(--accent)] transition cursor-pointer" onClick={()=>router.push(`/reports?report=${r.id}`,{scroll:false})}>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium text-main">{r.title}</p>
                    {r.template_type&&<span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${BADGE[r.scope]||"bg-surface2 text-hint"}`}>{TEMPLATES.find(t=>t.id===r.template_type)?.label||r.template_type}</span>}
                  </div>
                  <div className="flex gap-2">
                    {r.year_from&&r.year_to&&<span className="text-[10px] text-hint">{r.year_from}–{r.year_to}</span>}
                    <span className="text-[10px] text-hint">{new Date(r.created_at).toLocaleDateString()}</span>
                    <span className="text-[10px] text-hint">{r.created_by}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={ev=>{ev.stopPropagation();router.push(`/reports/editor?id=${r.id}`);}} className="text-xs text-accent hover:underline px-2">Edit</button>
                  <button onClick={ev=>{ev.stopPropagation();deleteReport(r.id);}} className="text-hint hover:text-red-400 text-sm px-2">×</button>
                </div>
              </div>
            ))}</div>
          }
        </div></div>
      )}

      {/* GENERATE / VIEW */}
      {(view==="generate"||viewingReport)&&(
        <div className="px-5 py-5 w-full flex justify-center"><div className="w-full max-w-3xl" style={{marginRight:viewerOpen?390:0,transition:"margin 0.15s"}}>

          {/* REPORT CONTENT */}
          {activeContent&&(
            <div className="bg-surface rounded-lg border border-main overflow-hidden">
              <div className="flex justify-between items-center px-5 py-3 border-b border-main flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <button onClick={()=>{router.push("/reports",{scroll:false});setReport("");setSelectedTemplate(null);}} className="text-xs text-muted hover:text-main">← Back</button>
                  <h3 className="text-sm font-semibold text-main">{viewingReport?.title||reportTitle||"Generated report"}</h3>
                </div>
                <div className="flex gap-2">
                  {report&&!viewingReport&&<>
                    <button onClick={()=>saveReport(true)} disabled={saving} className="px-3 py-1 text-xs text-white rounded-lg font-semibold hover:opacity-90 disabled:opacity-50" style={{background:"#0019FF"}}>{saving?"Saving...":"Save & Edit"}</button>
                    <button onClick={()=>saveReport(false)} disabled={saving} className="px-3 py-1 text-xs border border-main rounded-lg text-muted hover:text-main">Skip editing</button>
                    <button onClick={async()=>{const saved=await saveReport(false);if(saved)generateShowcaseFromReport(saved);}} disabled={saving||generatingShowcase} className="px-3 py-1 text-xs text-white rounded-lg font-semibold hover:opacity-90 disabled:opacity-50" style={{background:"#1D9A42"}}>{generatingShowcase?"Generating...":"Save & Showcase"}</button>
                  </>}
                  {viewingReport&&<button onClick={()=>router.push(`/reports/editor?id=${viewingReport.id}`)} className="px-3 py-1 text-xs text-white rounded-lg font-semibold hover:opacity-90" style={{background:"#0019FF"}}>Edit</button>}
                  {viewingReport&&<button onClick={generateShowcaseFromReport} disabled={generatingShowcase} className="px-3 py-1 text-xs text-white rounded-lg font-semibold hover:opacity-90 disabled:opacity-50" style={{background:"#1D9A42"}}>{generatingShowcase?"Generating...":"Showcase"}</button>}
                  <button onClick={copyReport} className="px-3 py-1 text-xs border border-main rounded-lg text-muted hover:bg-surface2">{copied?"Copied!":"Copy"}</button>
                  <button onClick={downloadMD} className="px-3 py-1 text-xs border border-main rounded-lg text-muted hover:bg-surface2">.md</button>
                  <button onClick={downloadPDF} className="px-3 py-1 text-xs border border-main rounded-lg text-muted hover:bg-surface2">.pdf</button>
                </div>
              </div>
              <div className="px-8 py-6" ref={reportRef}>
                <div>{renderContent(activeContent)}</div>

                <Signature/>
              </div>
            </div>
          )}

          {/* CONFIGURATOR */}
          {!activeContent&&(
            <>
              {!selectedTemplate?(
                <div>
                  <p className="text-xs text-hint mb-3">Select a report type to get started</p>
                  <div className="grid grid-cols-1 gap-2">
                    {TEMPLATES.map(t=>(
                      <button key={t.id} onClick={()=>setSelectedTemplate(t)} className="bg-surface border border-main rounded-lg p-4 text-left hover:border-[var(--accent)] transition group">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${BADGE[t.scope]}`}>{t.badge}</span>
                          <span className="text-sm font-semibold text-main group-hover:text-accent transition">{t.label}</span>
                        </div>
                        <p className="text-xs text-hint">{t.description}</p>
                      </button>
                    ))}
                  </div>
                </div>
              ):(
                <>
                  <button onClick={()=>{setSelectedTemplate(null);setReport("");setCompetitors([]);}} className="text-xs text-muted hover:text-main mb-4 flex items-center gap-1">
                    ← Change report type
                    <span className={`ml-1 text-[10px] px-1.5 py-0.5 rounded font-semibold ${BADGE[selectedTemplate.scope]}`}>{selectedTemplate.label}</span>
                  </button>

                  {/* TIME FRAME */}
                  {allYears.length>0&&(
                    <div className="bg-surface rounded-lg border border-main p-4 mb-3">
                      <h3 className="text-sm font-semibold text-main mb-2">Time frame</h3>
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] text-hint uppercase font-semibold">From</label>
                          <select value={yearFrom} onChange={e=>setYearFrom(e.target.value)} className="px-3 py-1.5 bg-surface border border-main rounded-lg text-sm text-main">
                            {allYears.map(y=><option key={y} value={y}>{y}</option>)}
                          </select>
                        </div>
                        <div className="text-hint mt-4">→</div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] text-hint uppercase font-semibold">To</label>
                          <select value={yearTo} onChange={e=>setYearTo(e.target.value)} className="px-3 py-1.5 bg-surface border border-main rounded-lg text-sm text-main">
                            {allYears.map(y=><option key={y} value={y}>{y}</option>)}
                          </select>
                        </div>
                        <div className="mt-4 text-xs text-hint">{filteredData.length} entries in range</div>
                      </div>
                    </div>
                  )}

                  {/* BRANDS */}
                  <div className="bg-surface rounded-lg border border-main p-4 mb-3">
                    <h3 className="text-sm font-semibold text-main mb-1">{selectedTemplate.singleBrand?"Brand — select one":"Brands"}</h3>
                    {selectedTemplate.singleBrand&&<p className="text-[10px] text-hint mb-2">This report analyses a single brand in depth</p>}
                    <div className="space-y-3">
                      {groupedBrands.map(g=>(
                        <div key={g.cat}>
                          <p className="text-[9px] text-hint uppercase font-semibold tracking-wider mb-1.5">{g.cat}</p>
                          <div className="flex gap-2 flex-wrap">
                            {g.brands.map(c=>(
                              <button key={c} onClick={()=>toggleComp(c)} className={`px-3 py-1 rounded-full text-xs font-medium border transition ${competitors.includes(c)?"bg-accent-soft border-[var(--accent)] text-accent":"bg-surface border-main text-hint hover:border-[var(--accent)]"}`}>{c}</button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                    {!selectedTemplate.singleBrand&&<p className="text-[10px] text-hint mt-1">{competitors.length===0?"All brands selected":`${competitors.length} brand${competitors.length>1?"s":""} selected`}</p>}
                  </div>

                  {/* SECTIONS */}
                  <div className="bg-surface rounded-lg border border-main p-4 mb-3">
                    <h3 className="text-sm font-semibold text-main mb-2">Sections</h3>
                    {selectedTemplate.sections.map(s=>(
                      <label key={s.id} className="flex items-start gap-2 mb-2 cursor-pointer">
                        <input type="checkbox" checked={sections.includes(s.id)} onChange={()=>toggleSec(s.id)} className="mt-0.5"/>
                        <div><div className="text-sm font-medium text-main">{s.label}</div><div className="text-xs text-hint">{s.desc}</div></div>
                      </label>
                    ))}
                  </div>

                  {/* TITLE + INSTRUCTIONS */}
                  <div className="bg-surface rounded-lg border border-main p-4 mb-3">
                    <h3 className="text-sm font-semibold text-main mb-2">Report title (optional)</h3>
                    <input value={reportTitle} onChange={e=>setReportTitle(e.target.value)} placeholder={`E.g., ${selectedTemplate.label} — Q1 2026`} className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main mb-3 focus:outline-none focus:border-[var(--accent)]"/>
                    <h3 className="text-sm font-semibold text-main mb-2">Custom instructions</h3>
                    <textarea value={customInstructions} onChange={e=>setCustomInstructions(e.target.value)} placeholder="E.g., Focus on fintechs vs traditional banks..." className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main resize-y focus:outline-none focus:border-[var(--accent)]" rows={2}/>
                  </div>

                  {/* GENERATE */}
                  <div className="flex items-center gap-3">
                    <button onClick={generate} disabled={generating||sections.length===0||(selectedTemplate.singleBrand&&competitors.length===0)} className="bg-accent text-white px-6 py-2 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50">
                      {generating?"Generating with Opus...":`Generate ${selectedTemplate.label}`}
                    </button>
                    {selectedTemplate.singleBrand&&competitors.length===0&&<p className="text-xs text-hint">← Select a brand first</p>}
                  </div>
                </>
              )}
            </>
          )}
        </div></div>
      )}

      {/* FAB */}
      {activeContent&&!viewerOpen&&(
        <button onClick={()=>setViewerOpen(true)} className="fixed bottom-6 right-6 bg-accent text-white w-12 h-12 rounded-full shadow-lg flex items-center justify-center hover:opacity-90 z-40" title="Search entries">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="9" cy="9" r="6"/><line x1="14" y1="14" x2="18" y2="18"/></svg>
        </button>
      )}

      {/* ENTRY VIEWER PANEL */}
      {viewerOpen&&(
        <div className="fixed top-0 right-0 w-[390px] h-screen bg-surface border-l border-main z-50 flex flex-col" style={{boxShadow:"-2px 0 12px rgba(0,0,0,0.05)"}}>
          <div className="p-3 border-b border-main flex-shrink-0">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-semibold text-main">{viewerEntry?"Entry detail":"Search entries"}</span>
              <span onClick={()=>{setViewerOpen(false);setViewerEntry(null);setSearchQuery("");}} className="cursor-pointer text-hint hover:text-main text-sm">×</span>
            </div>
            {!viewerEntry&&<input value={searchQuery} onChange={e=>{setSearchQuery(e.target.value);setViewerEntry(null);}} placeholder="Search brand, description, slogan..." className="w-full px-3 py-2 bg-surface2 border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[var(--accent)]"/>}
          </div>
          {viewerEntry
            ?<><EntryViewer entry={viewerEntry} onClose={()=>setViewerEntry(null)}/></>
            :(
              <div className="flex-1 overflow-auto">
                {searchQuery.length<=1?<div className="p-4 text-center text-hint text-sm">Type to search {allData.length} entries</div>
                :searchResults.length===0?<div className="p-4 text-center text-hint text-sm">No entries found</div>
                :<div className="p-2">{searchResults.map(e=>(<button key={e.id} onClick={()=>setViewerEntry(e)} className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-accent-soft transition mb-1"><div className="flex gap-1.5 items-center mb-0.5">{e.competitor&&<Tag v={e.competitor}/>}{e.brand&&<span className="text-[10px] font-semibold text-main bg-surface2 px-1 rounded">{e.brand}</span>}</div><p className="text-xs font-medium text-main truncate">{e.description||"—"}</p></button>))}</div>}
              </div>
            )
          }
        </div>
      )}
    </div>
  );
}

export default function ReportsPage(){return <AuthGuard><ProjectGuard><Nav/><Suspense fallback={null}><ReportsContent/></Suspense></ProjectGuard></AuthGuard>;}
