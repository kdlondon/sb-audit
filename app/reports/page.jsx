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
    {id:"website_vs_comms",label:"Website vs Communication",desc:"Compare official website positioning with actual advertising execution — consistency gaps and contradictions"},
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
    {id:"website_vs_comms",label:"Website vs Communication",desc:"Compare official website positioning with actual advertising execution — consistency gaps"},
  ]},
];

// ── GLOBAL ANALYSIS RULES (injected into every report prompt) ─────────────────
const GLOBAL_RULES = `
GLOBAL ANALYSIS RULES — APPLY TO ALL REPORTS:

1. COMMUNICATION INTENT HIERARCHY:
The data classifies entries by communication intent. You MUST respect this hierarchy:
- **Brand Hero**: Core brand positioning pieces — manifestos, brand commercials, major campaign films, tagline-driven ads. These define what the brand STANDS FOR. Use these as the primary source for positioning analysis (archetype, territory, proposition, emotional/rational positioning).
- **Brand Tactical**: Brand-building pieces that support values but are NOT core positioning — events, sponsorships, community initiatives, cause marketing, employer branding, CSR. These build perception but don't define the central proposition. Analyze separately from hero pieces.
- **Client Testimonials**: Real customer stories and case studies. These reveal what customers value in their own voice. Analyze for audience insights and proof points, not brand positioning.
- **Product**: Drives a specific product/service/offer. Analyze for product communication strategy.
- **Innovation**: Showcases new capability or technology. Analyze for innovation positioning.
- **Beyond Banking**: Educational content, community building, financial literacy. Analyze for territory expansion.

When analyzing brand positioning, archetype, territory, or proposition: use ONLY Brand Hero entries. Brand Tactical, Client Testimonials, and other intents provide supporting context but should not define the core positioning analysis.

2. BRAND HERO EVOLUTION:
When a brand has Brand Hero entries across different years, trace the positioning evolution chronologically. Use the MOST RECENT Brand Hero campaign as the current reference, but note shifts in archetype, territory, and proposition over time. Assess whether the evolution is coherent (building equity) or fragmented (diluting the brand).

3. FAIR CROSS-BRAND COMPARISON:
Brands may have different numbers of entries in the data. Do NOT let volume bias your analysis — a brand with 20 entries is not necessarily stronger than one with 5. Normalize your assessments by quality and strategic clarity, not quantity. When comparing brands, evaluate the strength of their positioning and communication, not how many pieces they produced.

4. CITATION RULES — CRITICAL:
- Every time you reference a specific piece of communication, cite it using [ENTRY:entry_id].
- Citations must appear inline immediately after the claim.
- Never make a specific claim about a piece without citing it.
- Include a ## Sources section at the end listing all cited entries.
`;

// ── SYSTEM PROMPTS ────────────────────────────────────────────────────────────
const SYSTEM_PROMPTS={
  competitor_snapshot:`You are a world-class brand strategist analyzing Canadian business banking competitive communications for Scotiabank. Write a deep competitor snapshot.

${GLOBAL_RULES}

BRAND CONSISTENCY SECTION — when generating this section, evaluate:
1. Tone consistency — does the emotional register stay coherent across channels and funnel stages?
2. Territory consistency — does the creative territory hold or fragment across pieces?
3. Value proposition evolution — how has the VP shifted or stayed stable over time?
4. Archetype coherence — does the brand archetype hold across all touchpoints?
5. Moment integrity — are there pieces that break the brand's own pattern? Which ones and why?
Rate each dimension: Strong / Partial / Fragmented, with specific cited evidence.

Write with authority. Use ## for sections, ### for subsections, **bold** for key findings. Use markdown tables where useful. Be conclusive and opinionated.`,

  category_landscape:`You are a world-class brand strategist analyzing the full Canadian business banking competitive landscape for Scotiabank.

${GLOBAL_RULES}

When comparing brands across the category, group your analysis by communication intent:
- Compare Brand Hero positioning across competitors (archetype, territory, proposition)
- Compare Product communication strategies
- Compare Beyond Banking and Innovation approaches
- Note which brands use Client Testimonials effectively and what those reveal

Use ## for sections, **bold** for key findings, markdown tables for cross-brand comparisons. Be conclusive.`,

  opportunity:`You are a world-class brand strategist identifying strategic white spaces for Scotiabank in Canadian business banking.

${GLOBAL_RULES}

RECENCY RULE — CRITICAL:
Focus ONLY on entries from the last 2 years. Ignore older entries for opportunity analysis. White spaces and strategic gaps must be based on the current competitive landscape, not historical data. If an entry is older than 2 years, exclude it from your analysis entirely.

When identifying opportunities, consider gaps across all communication intent categories:
- Unclaimed Brand Hero territories (positioning no competitor owns)
- Product communication gaps (product stories no one is telling)
- Beyond Banking white spaces (lifestyle/community territories unexplored)
- Client Testimonial opportunities (customer voices no one is amplifying)

Be specific, opinionated, and direct. End with 3–5 named opportunity territories.`,

  creative_intelligence:`You are a world-class creative strategist analyzing global financial brand communications to extract inspiration for Scotiabank business banking.

${GLOBAL_RULES}

QUALITY FOCUS — CRITICAL:
Focus primarily on entries rated 4–5 stars. These represent the most creatively outstanding cases and should be the spotlight of your analysis. Lower-rated entries (1–3 stars) may provide useful context or contrast, but the core of the report must highlight excellence. When selecting transferable examples, prioritize the highest-rated work.

For transferable examples, state: what they do, why it works, the transferable principle, and how it could apply in the Canadian context. Distinguish between Brand Hero inspiration (positioning/territory ideas) and tactical inspiration (execution/format ideas).`,

  innovation:`You are a world-class brand strategist identifying communication innovation and convention breaks in global financial brands.

${GLOBAL_RULES}

Focus on what breaks category norms. Identify emerging signals before they become mainstream. Note whether innovation appears in Brand Hero positioning (strategic innovation) or in tactical execution (format/channel innovation).`,

  agnostic_snapshot:`You are a senior brand strategist writing a competitive communication audit.

CRITICAL: This is framework-agnostic. Do NOT reference any proprietary frameworks, models, or methodologies. No portraits, entry doors, journey phases, richness definitions, moments that matter, or client lifecycle. Write as a pure competitive communication audit.

${GLOBAL_RULES}

Be specific — reference actual slogans, campaign names, and patterns from the data. No filler, no hedging. Confident analytical prose.

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
    {/* Fixed header */}
    <div className="p-3 border-b border-main flex justify-between items-center flex-shrink-0">
      <b className="text-sm text-main truncate">{e.description||e.competitor||e.brand}</b>
      <span onClick={onClose} className="cursor-pointer text-lg text-hint hover:text-main ml-2">×</span>
    </div>
    {/* Scrollable content */}
    <div className="flex-1 overflow-auto">
      {ytId(e.url)&&<div className="px-3 pt-2"><iframe width="100%" height="180" src={`https://www.youtube.com/embed/${ytId(e.url)}`} frameBorder="0" allowFullScreen className="rounded-md"/></div>}
      {e.image_url&&!ytId(e.url)&&<div className="px-3 pt-2"><img src={e.image_url} className="w-full rounded-md"/></div>}
      <div className="p-3">
        <div className="flex gap-1 flex-wrap mb-2">{e.competitor&&<Tag v={e.competitor}/>}{e.brand&&<span className="text-xs font-semibold text-main bg-surface2 px-1.5 py-0.5 rounded">{e.brand}</span>}{e.year&&<span className="bg-surface2 px-1.5 py-0.5 rounded text-[11px] text-main">{e.year}</span>}</div>
        {[["Intent",e.communication_intent],["Portrait",e.portrait],["Phase",e.journey_phase],["Door",e.entry_door],["Archetype",e.brand_archetype],["Tone",e.tone_of_voice],["Territory",e.primary_territory],["Execution",e.execution_style],["Slogan",e.main_slogan],["Rating",e.rating?"★".repeat(Number(e.rating)):null]].filter(([,v])=>v&&v!==""&&!v.startsWith("Not ")&&!v.startsWith("None")).map(([l,v])=>(<div key={l} className="text-xs mb-0.5"><span className="text-muted">{l}:</span> <span className="text-main font-medium">{v}</span></div>))}
      </div>
      {e.synopsis&&<div className="px-3 pb-2"><div className="text-[10px] font-semibold text-hint uppercase mb-1">Synopsis</div><div className="text-xs leading-relaxed bg-surface2 p-2 rounded text-main">{e.synopsis}</div></div>}
      {e.insight&&<div className="px-3 pb-2"><div className="text-[10px] font-semibold text-hint uppercase mb-1">Insight</div><div className="text-xs leading-relaxed bg-surface2 p-2 rounded text-main">{e.insight}</div></div>}
      {e.idea&&<div className="px-3 pb-2"><div className="text-[10px] font-semibold text-hint uppercase mb-1">Creative Idea</div><div className="text-xs leading-relaxed bg-surface2 p-2 rounded text-main">{e.idea}</div></div>}
      {e.emotional_benefit&&<div className="px-3 pb-2"><div className="text-[10px] font-semibold text-hint uppercase mb-1">Emotional Benefit</div><div className="text-xs leading-relaxed bg-surface2 p-2 rounded text-main">{e.emotional_benefit}</div></div>}
      {e.analyst_comment&&<div className="px-3 pb-2"><div className="text-[10px] font-semibold text-hint uppercase mb-1">Analyst notes</div><div className="text-xs leading-relaxed bg-surface2 p-2 rounded text-main">{e.analyst_comment}</div></div>}
    </div>
    {/* Fixed footer with actions */}
    <div className="p-3 border-t border-main flex-shrink-0 flex gap-2">
      <a href={`/audit?edit=${e.id}`} className="flex-1 text-center px-3 py-2 text-xs text-white rounded-lg font-semibold hover:opacity-90 transition" style={{background:"#0019FF"}}>Edit entry</a>
      <a href={`/audit?entry=${e.id}`} className="flex-1 text-center px-3 py-2 text-xs border border-main rounded-lg text-muted hover:text-main transition">View in Audit</a>
      {e.url&&<a href={e.url} target="_blank" rel="noopener noreferrer" className="px-3 py-2 text-xs border border-main rounded-lg text-muted hover:text-main transition">Open ↗</a>}
    </div>
  </div>);
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
function ReportsContent(){
  const{projectId,projectName}=useProject()||{};
  const searchParams=useSearchParams();
  const tabParam=searchParams.get("tab");
  const reportParam=searchParams.get("report");
  const view=reportParam?"generate":(tabParam||"dashboard");
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
  const[countryFilter,setCountryFilter]=useState([]);
  const[sections,setSections]=useState([]);
  const[customInstructions,setCustomInstructions]=useState("");
  const[report,setReport]=useState("");
  const[reportTitle,setReportTitle]=useState("");
  const reportTitleRef=useRef("");
  const[generating,setGenerating]=useState(false);
  const[copied,setCopied]=useState(false);
  const[viewerOpen,setViewerOpen]=useState(false);
  const[viewerEntry,setViewerEntry]=useState(null);
  const[searchQuery,setSearchQuery]=useState("");
  const[savedReports,setSavedReports]=useState([]);
  const[viewingReport,setViewingReport]=useState(null);
  const[saving,setSaving]=useState(false);
  const[downloadMenu,setDownloadMenu]=useState(false);
  const reportRef=useRef(null);
  const supabase=createClient();

  // Report contextual assistant
  const[assistOpen,setAssistOpen]=useState(false);
  const[assistSelection,setAssistSelection]=useState("");
  const[assistMessages,setAssistMessages]=useState([]);
  const[assistQuery,setAssistQuery]=useState("");
  const[assistLoading,setAssistLoading]=useState(false);
  const[selectionPos,setSelectionPos]=useState(null);
  const assistEndRef=useRef(null);

  // Comments / highlights
  const[comments,setComments]=useState([]);
  const[commentDraft,setCommentDraft]=useState(null); // {quote, rect}
  const[activeComment,setActiveComment]=useState(null); // id of focused comment
  const[hoverComment,setHoverComment]=useState(null); // {comment, rect} for inline popup

  // Detect text selection in report
  useEffect(()=>{
    const handler=()=>{
      const sel=window.getSelection();
      const text=(sel?.toString()||"").trim();
      const node=sel?.anchorNode||sel?.focusNode;
      const el=node?.nodeType===3?node.parentElement:node;
      const inReport=el&&el.closest&&el.closest("[data-report-content]");
      if(text.length>10&&inReport){
        setAssistSelection(text);
        setSelectionPos(true);
      }else{
        // Small delay to allow clicking the button before it disappears
        setTimeout(()=>{if(!assistOpen)setSelectionPos(null);},200);
      }
    };
    document.addEventListener("mouseup",handler);
    return()=>document.removeEventListener("mouseup",handler);
  },[assistOpen]);

  // Highlight commented text in report DOM
  useEffect(()=>{
    try{
      const container=reportRef.current;
      if(!container||!comments||comments.length===0)return;
      // Clear old highlights
      container.querySelectorAll("mark[data-comment-id]").forEach(m=>{
        try{const parent=m.parentNode;parent.replaceChild(document.createTextNode(m.textContent),m);parent.normalize();}catch{}
      });
      // Apply highlights
      comments.forEach(c=>{
        try{
          if(!c.quote||!c.id)return;
          const walker=document.createTreeWalker(container,NodeFilter.SHOW_TEXT,null);
          const searchText=c.quote.slice(0,60);
          let node;
          while(node=walker.nextNode()){
            const idx=node.textContent.indexOf(searchText);
            if(idx===-1)continue;
            // Only highlight within a single text node
            const endIdx=Math.min(idx+c.quote.length,node.textContent.length);
            const range=document.createRange();
            range.setStart(node,idx);
            range.setEnd(node,endIdx);
            const mark=document.createElement("mark");
            mark.setAttribute("data-comment-id",c.id);
            mark.style.cssText="background:rgba(251,191,36,0.25);border-bottom:2px solid #F59E0B;cursor:pointer;border-radius:2px;padding:0 1px;";
            mark.addEventListener("mouseenter",()=>{
              const rect=mark.getBoundingClientRect();
              setHoverComment({comment:c,rect:{top:rect.top,left:rect.right,bottom:rect.bottom}});
            });
            mark.addEventListener("mouseleave",()=>{
              setTimeout(()=>setHoverComment(prev=>prev?.comment?.id===c.id?null:prev),200);
            });
            mark.addEventListener("click",()=>setActiveComment(c.id));
            try{range.surroundContents(mark);}catch{/* range crosses elements — skip */}
            break;
          }
        }catch{}
      });
    }catch(err){console.warn("Comment highlight error:",err);}
  },[comments,viewingReport,report]);

  const askAssistant=async(directQuestion)=>{
    const q=directQuestion||assistQuery.trim()||"Explain this in more detail";
    if(!q||!assistSelection)return;
    setAssistMessages(prev=>[...prev,{role:"user",text:q}]);
    setAssistQuery("");
    setAssistLoading(true);
    setTimeout(()=>assistEndRef.current?.scrollIntoView({behavior:"smooth"}),50);
    try{
      const sysPrompt=[
        "You are a senior brand strategist explaining findings from a competitive intelligence report.",
        "",
        "The user selected this text from the report:",
        `"${assistSelection}"`,
        "",
        "Full report for context:",
        (viewingReport?.content||report||"").slice(0,4000),
        "",
        "Explain the strategic reasoning. Be specific, reference data from the report, provide actionable insight. Professional and concise."
      ].join("\n");
      const res=await fetch("/api/ai",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
        max_tokens:1500,
        skip_framework:true,
        system:sysPrompt,
        messages:[{role:"user",content:q}],
      })});
      const data=await res.json();
      const reply=data.content?.[0]?.text||"I couldn't analyze that section. Try selecting a different part of the report.";
      setAssistMessages(prev=>[...prev,{role:"assistant",text:reply}]);
      setTimeout(()=>assistEndRef.current?.scrollIntoView({behavior:"smooth"}),100);
    }catch(err){
      setAssistMessages(prev=>[...prev,{role:"assistant",text:"Error: "+(err.message||"Could not connect to AI.")}]);
    }
    setAssistLoading(false);
  };
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
    if(!reportParam){setViewingReport(null);setComments([]);return;}
    if(viewingReport?.id===reportParam)return;
    const found=savedReports.find(r=>r.id===reportParam);
    if(found){
      setViewingReport(found);
      const dbComments=Array.isArray(found.comments)?found.comments:[];
      let lsComments=[];
      try{lsComments=typeof window!=="undefined"?JSON.parse(localStorage.getItem(`report_comments_${found.id}`)||"[]"):[];}catch{}
      if(!Array.isArray(lsComments))lsComments=[];
      setComments(dbComments.length>0?dbComments:lsComments);
    }
  },[reportParam,savedReports]);

  const saveComment=async(newComments)=>{
    setComments(newComments);
    const reportId=viewingReport?.id;
    if(reportId){
      const{error}=await supabase.from("saved_reports").update({comments:newComments}).eq("id",reportId);
      if(error&&error.message?.includes("comments")){
        // Column doesn't exist yet — store in localStorage as fallback
        localStorage.setItem(`report_comments_${reportId}`,JSON.stringify(newComments));
      }
    }
  };
  const addComment=async(quote,text)=>{
    const{data:{session}}=await supabase.auth.getSession();
    const c={id:String(Date.now()),quote,text,author:session?.user?.email||"Unknown",created_at:new Date().toISOString()};
    await saveComment([...comments,c]);
    setCommentDraft(null);
    setActiveComment(c.id);
  };
  const deleteComment=async(id)=>{
    await saveComment(comments.filter(c=>c.id!==id));
    if(activeComment===id)setActiveComment(null);
  };
  const editComment=async(id,text)=>{
    await saveComment(comments.map(c=>c.id===id?{...c,text,edited_at:new Date().toISOString()}:c));
  };

  useEffect(()=>{
    if(!selectedTemplate)return;
    setSections(selectedTemplate.sections.map(s=>s.id));
    setCompetitors([]);setCountryFilter([]);setReport("");setViewingReport(null);
  },[selectedTemplate]);

  const currentData=selectedTemplate?.scopeAny?[...localData,...globalData]:selectedTemplate?.scope==="local"?localData:globalData;
  const allCountries=[...new Set(currentData.map(e=>e.country).filter(c=>c&&c!=="All regions"))].sort();
  const filteredData=currentData.filter(e=>{
    const brand=e.competitor||e.brand||"";
    const matchBrand=competitors.length===0||competitors.includes(brand);
    const matchYear=(!yearFrom||!e.year||e.year>=yearFrom)&&(!yearTo||!e.year||e.year<=yearTo);
    const matchCountry=countryFilter.length===0||countryFilter.includes(e.country);
    return matchBrand&&matchYear&&matchCountry;
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
  // Filter data by country for brand list
  const countryFilteredLocal=countryFilter.length>0?localData.filter(e=>countryFilter.includes(e.country)):localData;
  const countryFilteredGlobal=countryFilter.length>0?globalData.filter(e=>countryFilter.includes(e.country)):globalData;
  const groupedBrands=selectedTemplate?.scopeAny
    ?(()=>{const localG=buildGroupedBrands(countryFilteredLocal,"competitor");const globalG=buildGroupedBrands(countryFilteredGlobal,"brand");const merged={};[...localG,...globalG].forEach(g=>{if(!merged[g.cat])merged[g.cat]=new Set();g.brands.forEach(b=>merged[g.cat].add(b));});const order=["Traditional Banking","Fintech","Neobank","Credit Union","Supplementary Services","Non-financial","Other"];return Object.entries(merged).sort((a,b)=>{const ia=order.indexOf(a[0]),ib=order.indexOf(b[0]);return(ia===-1?99:ia)-(ib===-1?99:ib);}).map(([cat,set])=>({cat,brands:[...set].sort()}));})()
    :selectedTemplate?.scope==="local"
      ?buildGroupedBrands(countryFilteredLocal,"competitor")
      :buildGroupedBrands(countryFilteredGlobal,"brand");
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
    const rTitle=reportTitleRef.current||reportTitle||`${selectedTemplate?.label} — ${new Date().toLocaleDateString()}`;
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

    // Fetch brand profiles for context
    let brandProfileContext="";
    if(competitors.length>0){
      const{data:bProfiles}=await supabase.from("brand_profiles").select("brand_name,profile_data").eq("project_id",projectId).in("brand_name",competitors).order("created_at",{ascending:false});
      if(bProfiles&&bProfiles.length>0){
        const seen=new Set();
        const unique=bProfiles.filter(p=>{if(seen.has(p.brand_name))return false;seen.add(p.brand_name);return true;});
        brandProfileContext="\n\nBRAND WEBSITE PROFILES (official website data — compare with communication data above):\n"+unique.map(p=>{
          const pr=p.profile_data||{};
          return`--- ${p.brand_name} (from website) ---
Tagline: ${pr.tagline||""}
Description: ${pr.description||""}
Target Audience: ${pr.target_audience||""}
Value Proposition: ${pr.value_proposition||""}
Positioning: ${pr.positioning||""}
Brand Archetype: ${pr.brand_archetype||""}
Tone of Voice: ${pr.tone_of_voice||""}
Key Products: ${(pr.key_products||[]).join(", ")}
Key Messages: ${(pr.key_messages||[]).join(", ")}
Differentiators: ${(pr.differentiators||[]).join(", ")}
Strengths: ${(pr.strengths||[]).join(", ")}
Weaknesses: ${(pr.weaknesses||[]).join(", ")}`;
        }).join("\n\n");
      }
    }

    const system=SYSTEM_PROMPTS[selectedTemplate.id];
    const userMsg=`Audit data${timeRange} — ${filteredData.length} pieces:\n${dataStr}${brandProfileContext}\n\nGenerate the following sections: ${sectionNames}\n\n${customInstructions?`Additional instructions: ${customInstructions}`:""}\n\nIMPORTANT — CITATION RULE:
- Every entry starts with [ID:xxxxxxxxxxxxxxx] — use that EXACT full numeric ID.
- Write a SHORT HUMAN-READABLE name for the piece in your prose, then add [ENTRY:id] right after.
- Example: "Their AI adoption guide [ENTRY:1773496163636] positions CIBC as..."
- NEVER put the numeric ID in your prose text. NEVER write "(ID: 883404)" or "Meta Ad Library creative (ID: 883404)".
- Use short descriptive names like "their Instagram campaign", "the women entrepreneur series", "How I made it" — NOT the raw description field which may contain technical IDs.
- The [ENTRY:id] token is invisible to the reader. It only appears in your output as [ENTRY:123456], nowhere else.
- Do NOT place citations inside markdown table rows (| col | col |) — only use them in prose paragraphs and bullet points.\n\nUse markdown with ## headers, tables, and **bold** key findings. Be analytical and conclusive, not descriptive.`;
    try{
      const res=await fetch("/api/ai",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({use_opus:true,max_tokens:12000,system,messages:[{role:"user",content:userMsg}]})});
      const result=await res.json();
      if(result.error)setReport("Error: "+result.error);
      else setReport(result.content?.map(c=>c.text||"").join("")||"No content.");
    }catch(err){setReport("Error: "+err.message);}
    setGenerating(false);
  };

  /* ─── GENERATE SHOWCASE FROM REPORT (using original entry data) ─── */
  const generateShowcaseFromReport = async (reportOverride) => {
    const rpt = reportOverride || viewingReport;
    if (!rpt) { alert("No report selected"); return; }
    setGeneratingShowcase(true);

    // Debug: log what report we're working with
    console.log("[Showcase] Report:", { id: rpt.id, title: rpt.title, template_type: rpt.template_type, competitors: rpt.competitors, scope: rpt.scope, contentLength: rpt.content?.length });

    const isAgnostic = rpt.template_type === "agnostic_snapshot";
    const isCompetitorSnapshot = rpt.template_type === "competitor_snapshot";
    const useCSFormat = isAgnostic || isCompetitorSnapshot;
    let brandNames = (rpt.competitors || "").split(",").map(s => s.trim()).filter(Boolean);

    // If competitors is empty, try to extract brand from report title
    if (brandNames.length === 0 && rpt.title) {
      // Try common patterns: "Brand Snapshot", "Snapshot - Brand", "Brand —", etc.
      const titleBrand = rpt.title.replace(/^(Agnostic\s+)?Competitor\s+Snapshot\s*[-—]\s*/i, "")
        .replace(/\s*[-—]\s*\d{4}.*$/, "")
        .replace(/\s*[-—]\s*(Local|Global|Agnostic|Snapshot).*$/i, "")
        .trim();
      if (titleBrand && titleBrand.length > 1 && titleBrand.length < 50) {
        brandNames = [titleBrand];
        console.log("[Showcase] Extracted brand from title:", titleBrand);
      }
    }

    // For agnostic snapshots, search both scopes regardless of saved scope
    const scope = isAgnostic ? "both" : (rpt.scope || "local");
    console.log("[Showcase] useCSFormat:", useCSFormat, "brands:", brandNames, "scope:", scope, "template_type:", rpt.template_type);

    // Get the original entries — ALWAYS search both tables for agnostic, otherwise use scope
    let entries = [];
    if (scope === "local" || scope === "both") {
      const { data } = await supabase.from("audit_entries").select("*").eq("project_id", projectId);
      if (data) entries.push(...(brandNames.length > 0 ? data.filter(e => brandNames.includes(e.competitor)) : data));
    }
    if (scope === "global" || scope === "both") {
      const { data } = await supabase.from("audit_global").select("*").eq("project_id", projectId);
      if (data) entries.push(...(brandNames.length > 0 ? data.filter(e => brandNames.includes(e.brand)) : data));
    }
    console.log("[Showcase] Entries found:", entries.length, "for brands:", brandNames, "scope:", scope);
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
    const brandName = brandNames[0] || "Unknown";
    const scopeLabel = scope === "local" ? "Local Audit" : scope === "global" ? "Global Benchmark" : "Local + Global";
    const dateStr = new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" });
    const fullDateStr = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

    let systemPrompt, userMsg;

    if (useCSFormat) {
      systemPrompt = `You are reformatting a Competitor Snapshot report about "${brandName}" into a structured slide deck.

CRITICAL: The report content is provided below. EXTRACT the content from each section and map it to the corresponding slide fields. Do NOT generate new analysis — use what the report already says, shortened for visual scannability.

The brand being analyzed is: ${brandName}. ALL slides must be about this brand only.

The original audit entries are also provided so you can include image_url and media_url (video URLs) for relevant entries.

MAPPING — Look for report sections matching these patterns and extract their content:
- Audience / Understanding the Audience → SLIDE 2: extract Demographic, Psychographic, Tension, Human Insight
- Brand Response / Brand Positioning → SLIDE 3: extract Creative Proposition, Brand Archetype, Brand Role, Emotional/Rational Positioning, Brand Territory, Key Differentiators
- Proof Points / Communication Strategy → SLIDE 5: extract Primary/Secondary Proof Points, Communication Focus, Tone & Voice
- Product Communication → SLIDE 6: extract Approach, Key Product Messages, Channels & Formats, Gap
- Beyond Banking / Innovation → SLIDE 7: extract Beyond Banking, Innovation, White Space
- Brand Assessment → SLIDE 8: extract Strengths and Weaknesses (brand-focused)
- Communication Assessment → SLIDE 9: extract Strengths and Weaknesses (communication-focused)

Return EXACTLY 10 slides as JSON:

SLIDE 1: type:"cs_title" — brand ("${brandName}"), scope ("${scopeLabel}"), date ("${dateStr}"), entry_count (${entries.length}), subtitle ("Competitive Communication Snapshot")
SLIDE 2: type:"cs_audience" — demographic (string), psychographic (string), tension (string), human_insight (string — first-person quote 20-35 words), entries (array of 1-2 most representative entries: {description, image_url, url, year} — pick Client Testimonials or Brand Hero entries that best illustrate the audience)
SLIDE 3: type:"cs_brand_response" — creative_proposition (3-6 words), proposition_description (one line), brand_archetype (name + sentence), brand_role (sentence), emotional_positioning (5-10 words), rational_positioning (15-25 words), brand_territory (primary + secondary), key_differentiators (array of 3 strings), entries (array of 2-3 Brand Hero entries: {description, image_url, url, year} — the key positioning pieces)
SLIDE 4: type:"cs_hero_gallery" — title (string, e.g. "Brand Hero Content"), subtitle (string — one-line summary of what defines this brand's hero work), entries (array of ALL Brand Hero entries from the data — include: {description, image_url, url, year, type, rating, main_slogan, synopsis} — these will be shown as full-size visual slides, so include every Brand Hero entry that has an image_url)
SLIDE 5: type:"cs_proof_points" — creative_proposition (same as slide 3), primary_proof (1-2 sentences), secondary_proofs (array of 3 strings), communication_focus (1-2 sentences), tone_voice (array of 3 labels), entries (array of 2-3 entries: {description, image_url, url, year} — pieces that prove the positioning)
SLIDE 6: type:"cs_product" — approach (one sentence), key_messages (array of 3), channels_formats (string), gap (one sentence insight), entries (array of 2-3 Product entries: {description, image_url, url, year})
SLIDE 7: type:"cs_beyond_banking" — beyond_banking (one paragraph), innovation (one paragraph), white_space (one sentence insight), entries (array of 1-2 Innovation/Beyond Banking entries: {description, image_url, url, year})
SLIDE 8: type:"cs_brand_assessment" — strengths (array of 3 {label, explanation}), weaknesses (array of 2 {label, explanation})
SLIDE 9: type:"cs_comm_assessment" — strengths (array of 3 {label, explanation}), weaknesses (array of 2 {label, explanation})
SLIDE 10: type:"cs_closing" — title ("Thank You"), subtitle ("Generated by Knots & Dots — Category Landscape Platform"), date ("${fullDateStr}")

CRITICAL — ENTRIES: For slides 2-6, include an "entries" array with REAL entries from the data. Copy the exact image_url and url fields from the original entries. These will be displayed as visual references in the showcase.

Return ONLY valid JSON: {"title":"...","slides":[...]}`;

      userMsg = `BRAND: ${brandName}\nREPORT TITLE: ${rpt.title || brandName}\n\nREPORT CONTENT (this is specifically about ${brandName} — ALL slides must be about ${brandName}):\n${reportContent}\n\nORIGINAL ENTRIES for ${brandName} (${entries.length} entries — use for image_url/url references):\n${JSON.stringify(entryData.slice(0, 30), null, 1)}`;
    } else {
      // Creative showcase from non-CS reports (landscape, opportunity, etc.)
      const reportTitle = rpt.title || "Report";
      const brandList = brandNames.length > 0 ? brandNames.join(", ") : "all brands in the category";
      systemPrompt = `You are a senior creative strategist at Knots & Dots. Transform this report into a cinematic showcase presentation.

CRITICAL CONTEXT:
- Report title: "${reportTitle}"
- Brands covered: ${brandList}
- Report type: ${rpt.template_type || "analysis"}
- The showcase MUST faithfully represent the findings from the report below. Do NOT invent new analysis or change the subject.
- The title slide should reflect the report's actual title/topic, NOT a generic title.

The original audit entries are provided so you can include image_url and media_url for relevant findings.

STRUCTURE:
1. type:"title" — Fields: title (use the report's actual title or a direct derivative), subtitle (one-line summary from the report), client ("${projectName}"), objective (from the report's focus)
2. type:"key_findings" — Fields: title, findings (array of {number, heading, summary}) — extract the KEY findings from the report
3. Multiple type:"finding" — One per key insight FROM THE REPORT. Fields: title, body (markdown 3-5 sentences from the report), brand, year, country, territory, image_url (from matching entry), media_url (YouTube URL from matching entry), media_type ("Video"/"Image"), entry_id
4. type:"takeaways" — Fields: title, takeaways (array of 4-6 strings FROM the report's conclusions)
5. type:"closing" — Fields: title, subtitle

RULES:
- EXTRACT findings from the report content — do NOT create new analysis
- The showcase must be about the SAME topic as the report
- For each finding, match it to the relevant entry and include its image_url and url (as media_url if YouTube)
- Bold, provocative slide headlines but based on actual report content
- ALL output in English
- Return ONLY valid JSON: {"title":"...","slides":[...]}`;

      userMsg = `REPORT TITLE: ${reportTitle}\nBRANDS: ${brandNames.join(", ") || "see report content"}\n\nREPORT CONTENT (the showcase MUST be about THIS report only — do not change the subject):\n${reportContent.slice(0, 6000)}\n\nORIGINAL ENTRIES (use for images/videos):\n${JSON.stringify(entryData.slice(0, 25), null, 1)}`;
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
          brand: brandName,
          ...(useCSFormat ? { showcaseType: "competitor_snapshot" } : {}),
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
          <h2 className="text-lg font-bold text-main">Report</h2>
          <div className="flex bg-surface2 rounded-lg p-0.5">
            <button onClick={()=>router.push("/reports",{scroll:false})} className={`px-3 py-1 rounded-md text-xs font-medium transition ${view==="dashboard"?"bg-surface text-accent shadow-sm":"text-muted"}`}>Dashboard</button>
            <button onClick={()=>router.push("/reports?tab=generate",{scroll:false})} className={`px-3 py-1 rounded-md text-xs font-medium transition ${view==="generate"?"bg-surface text-accent shadow-sm":"text-muted"}`}>Generate</button>
            <button onClick={()=>router.push("/reports?tab=journey",{scroll:false})} className={`px-3 py-1 rounded-md text-xs font-medium transition ${view==="journey"?"bg-surface text-accent shadow-sm":"text-muted"}`}>Journey Map</button>
            <button onClick={()=>router.push("/reports?tab=archive",{scroll:false})} className={`px-3 py-1 rounded-md text-xs font-medium transition ${view==="archive"?"bg-surface text-accent shadow-sm":"text-muted"}`}>Archive ({savedReports.length})</button>
          </div>
        </div>
        {activeContent&&<button onClick={()=>setViewerOpen(!viewerOpen)} className={`px-3 py-1.5 text-xs rounded-lg font-medium border transition ${viewerOpen?"bg-accent-soft border-[var(--accent)] text-accent":"border-main text-muted hover:bg-surface2"}`}>{viewerOpen?"Hide entries":"Search entries"}</button>}
      </div>

      {/* DASHBOARD VIEW — embedded */}
      {view==="dashboard"&&(
        <div style={{height:"calc(100vh - 100px)",overflow:"hidden"}}>
          <iframe src="/dashboard?embedded=1" style={{width:"100%",height:"100%",border:"none"}} />
        </div>
      )}

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
            <div className="bg-surface rounded-lg border border-main">
              <div className="sticky top-[52px] z-20 bg-surface border-b border-main" style={{borderTopLeftRadius:"0.5rem",borderTopRightRadius:"0.5rem"}}>
                <div className="flex items-center gap-2 px-5 pt-3 pb-1">
                  <button onClick={()=>{router.push("/reports",{scroll:false});setReport("");setSelectedTemplate(null);}} className="text-xs text-muted hover:text-main">← Back</button>
                  <h3 className="text-sm font-semibold text-main flex-1 truncate">{viewingReport?.title||reportTitleRef.current||reportTitle||"Generated report"}</h3>
                </div>
                <div className="flex items-center gap-2 px-5 pb-3 pt-1 flex-wrap">
                  {/* Save */}
                  {report&&!viewingReport&&<button onClick={()=>saveReport(false)} disabled={saving} className="px-4 py-1.5 text-xs text-white rounded-lg font-semibold hover:opacity-90 disabled:opacity-50" style={{background:"#0019FF"}}>{saving?"Saving...":"Save"}</button>}
                  {/* Copy */}
                  <button onClick={copyReport} className="px-3 py-1.5 text-xs border border-main rounded-lg text-muted hover:bg-surface2 hover:text-main">{copied?"Copied!":"Copy"}</button>
                  {/* Download dropdown */}
                  <div className="relative">
                    <button onClick={()=>setDownloadMenu(!downloadMenu)} className="px-3 py-1.5 text-xs border border-main rounded-lg text-muted hover:bg-surface2 hover:text-main flex items-center gap-1">
                      Download <span className="text-[9px]">▾</span>
                    </button>
                    {downloadMenu&&<>
                      <div className="fixed inset-0 z-30" onClick={()=>setDownloadMenu(false)}/>
                      <div className="absolute top-full left-0 mt-1 bg-surface border border-main rounded-lg shadow-lg overflow-hidden z-40 w-[100px]">
                        <button onClick={()=>{downloadMD();setDownloadMenu(false);}} className="w-full text-left px-3 py-2 text-xs text-main hover:bg-accent-soft">.md</button>
                        <button onClick={()=>{downloadPDF();setDownloadMenu(false);}} className="w-full text-left px-3 py-2 text-xs text-main hover:bg-accent-soft border-t border-main">.pdf</button>
                      </div>
                    </>}
                  </div>
                  {/* Divider */}
                  <div className="w-px h-5 bg-main mx-1"/>
                  {/* Save & Edit / Save & Showcase */}
                  {report&&!viewingReport&&<>
                    <button onClick={()=>saveReport(true)} disabled={saving} className="px-3 py-1.5 text-xs border border-main rounded-lg text-muted hover:text-main hover:bg-surface2 disabled:opacity-50">{saving?"...":"Save & Edit"}</button>
                    <button onClick={async()=>{const saved=await saveReport(false);if(saved)generateShowcaseFromReport(saved);}} disabled={saving||generatingShowcase} className="px-3 py-1.5 text-xs text-white rounded-lg font-semibold hover:opacity-90 disabled:opacity-50" style={{background:"#1D9A42"}}>{generatingShowcase?"Generating...":"Save & Showcase"}</button>
                  </>}
                  {viewingReport&&<>
                    <button onClick={async()=>{
                      if(!confirm("Regenerate this report with the latest data?"))return;
                      const tmpl=TEMPLATES.find(t=>t.id===viewingReport.template_type);
                      if(tmpl){
                        setSelectedTemplate(tmpl);
                        setSections(tmpl.sections.map(s=>s.id));
                        setCompetitors((viewingReport.competitors||"").split(",").filter(Boolean));
                        setYearFrom(viewingReport.year_from||"");
                        setYearTo(viewingReport.year_to||"");
                        setCustomInstructions(viewingReport.custom_instructions||"");
                        setReportTitle(viewingReport.title||"");
                        reportTitleRef.current=viewingReport.title||"";
                        setViewingReport(null);
                        router.push("/reports?tab=generate",{scroll:false});
                        // Small delay for state to settle, then generate
                        setTimeout(()=>generate(),500);
                      }
                    }} className="px-3 py-1.5 text-xs border border-amber-300 rounded-lg text-amber-600 hover:bg-amber-50" title="Regenerate with latest data">Refresh</button>
                    <button onClick={()=>router.push(`/reports/editor?id=${viewingReport.id}`)} className="px-3 py-1.5 text-xs border border-main rounded-lg text-muted hover:text-main hover:bg-surface2">Edit</button>
                    <button onClick={generateShowcaseFromReport} disabled={generatingShowcase} className="px-3 py-1.5 text-xs text-white rounded-lg font-semibold hover:opacity-90 disabled:opacity-50" style={{background:"#1D9A42"}}>{generatingShowcase?"Generating...":"Showcase"}</button>
                  </>}
                </div>
              </div>
              <div className="flex">
                <div className="flex-1 px-8 py-6" ref={reportRef} data-report-content>
                  <div data-report-content>{renderContent(activeContent)}</div>
                  <Signature/>
                </div>

                {/* Comments sidebar */}
                {comments.length > 0 && (
                  <div className="w-[280px] flex-shrink-0 border-l border-main p-4 space-y-3 overflow-y-auto" style={{maxHeight:"calc(100vh - 120px)"}}>
                    <p className="text-[10px] text-hint uppercase font-semibold tracking-wider">{comments.length} Comment{comments.length!==1?"s":""}</p>
                    {comments.map(c => (
                      <div key={c.id}
                        className={`rounded-lg border p-3 transition cursor-pointer ${activeComment===c.id?"border-amber-400 bg-amber-50 dark:bg-amber-950/20 shadow-sm":"border-main hover:border-amber-300"}`}
                        onClick={()=>setActiveComment(activeComment===c.id?null:c.id)}>
                        <div className="flex items-center gap-2 mb-1.5">
                          <div className="w-5 h-5 rounded-full bg-amber-500 text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0">
                            {(c.author||"U")[0].toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-semibold text-main truncate">{(c.author||"").split("@")[0]}</p>
                            <p className="text-[9px] text-hint">{new Date(c.created_at).toLocaleDateString("en-GB",{day:"numeric",month:"short"})} {new Date(c.created_at).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})}</p>
                          </div>
                          <button onClick={(e)=>{e.stopPropagation();deleteComment(c.id);}} className="text-hint hover:text-red-400 text-xs opacity-0 group-hover:opacity-100" style={{opacity:activeComment===c.id?1:undefined}}>×</button>
                        </div>
                        <p className="text-[10px] text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-2 py-1 rounded italic mb-1.5 leading-relaxed line-clamp-2">&ldquo;{c.quote}&rdquo;</p>
                        {activeComment===c.id ? (
                          <textarea defaultValue={c.text} rows={2}
                            onBlur={(e)=>editComment(c.id,e.target.value)}
                            className="w-full text-xs text-main bg-surface border border-main rounded p-1.5 focus:outline-none focus:border-amber-400 resize-none"
                            placeholder="Add your comment..."
                            autoFocus
                          />
                        ) : (
                          <p className="text-xs text-main leading-relaxed">{c.text||<span className="text-hint italic">No comment text</span>}</p>
                        )}
                        {c.edited_at && <p className="text-[8px] text-hint mt-1">edited</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Selection toolbar — Ask + Comment */}
              {selectionPos&&!assistOpen&&!commentDraft&&(
                <div className="fixed bottom-6 left-6 z-50 flex gap-2" style={{animation:"fadeIn 0.2s"}}>
                  <button onClick={()=>{setAssistOpen(true);setAssistMessages([]);setSelectionPos(null);}}
                    className="px-4 py-2.5 bg-[#0a0f3c] text-white text-xs font-semibold rounded-xl shadow-2xl hover:opacity-90 transition flex items-center gap-2">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                    Ask about this
                  </button>
                  <button onClick={()=>{setCommentDraft({quote:assistSelection});setSelectionPos(null);}}
                    className="px-4 py-2.5 bg-amber-500 text-white text-xs font-semibold rounded-xl shadow-2xl hover:opacity-90 transition flex items-center gap-2">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>
                    Comment
                  </button>
                </div>
              )}

              {/* Inline comment popup on hover */}
              {hoverComment&&!activeComment&&(
                <div className="fixed z-50 w-[260px] bg-surface border border-amber-300 rounded-xl shadow-xl"
                  style={{top:Math.max(60,hoverComment.rect.top-10),left:Math.min(hoverComment.rect.left+12,window.innerWidth-280),animation:"fadeIn 0.15s"}}
                  onMouseEnter={()=>setHoverComment(hoverComment)}
                  onMouseLeave={()=>setHoverComment(null)}>
                  <div className="p-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="w-5 h-5 rounded-full bg-amber-500 text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0">
                        {(hoverComment.comment.author||"U")[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold text-main">{(hoverComment.comment.author||"").split("@")[0]}</p>
                        <p className="text-[9px] text-hint">{new Date(hoverComment.comment.created_at).toLocaleDateString("en-GB",{day:"numeric",month:"short"})} {new Date(hoverComment.comment.created_at).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})}</p>
                      </div>
                    </div>
                    <p className="text-xs text-main leading-relaxed">{hoverComment.comment.text||<span className="text-hint italic">No comment</span>}</p>
                  </div>
                </div>
              )}

              {/* Comment draft popup */}
              {commentDraft&&(
                <div className="fixed bottom-6 left-6 z-50 w-[340px] bg-surface border border-amber-300 rounded-2xl shadow-2xl" style={{animation:"fadeIn 0.2s"}}>
                  <div className="px-4 py-3 border-b border-amber-200 dark:border-amber-800 flex items-center gap-2" style={{background:"#FEF3C7",borderRadius:"16px 16px 0 0"}}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>
                    <span className="text-xs font-semibold text-amber-800">Add comment</span>
                    <button onClick={()=>setCommentDraft(null)} className="ml-auto text-amber-600 hover:text-amber-800">&times;</button>
                  </div>
                  <div className="p-3">
                    <p className="text-[10px] text-amber-700 bg-amber-50 dark:bg-amber-900/20 px-2 py-1.5 rounded italic mb-3 leading-relaxed line-clamp-3">&ldquo;{commentDraft.quote}&rdquo;</p>
                    <textarea id="comment-input" rows={2} placeholder="Your comment..." autoFocus
                      className="w-full text-sm text-main bg-surface border border-main rounded-lg px-3 py-2 focus:outline-none focus:border-amber-400 resize-none mb-2"/>
                    <div className="flex justify-end gap-2">
                      <button onClick={()=>setCommentDraft(null)} className="px-3 py-1.5 text-xs text-muted hover:text-main">Cancel</button>
                      <button onClick={()=>{const t=document.getElementById("comment-input")?.value||"";addComment(commentDraft.quote,t);}}
                        className="px-4 py-1.5 text-xs bg-amber-500 text-white rounded-lg font-semibold hover:opacity-90">Comment</button>
                    </div>
                  </div>
                </div>
              )}

              {/* Contextual assistant panel */}
              {assistOpen&&(
                <div className="fixed bottom-6 right-6 w-[380px] bg-surface border border-main rounded-2xl shadow-2xl z-50 flex flex-col" style={{maxHeight:"50vh"}}>
                  <div className="px-4 py-3 flex justify-between items-center border-b border-main flex-shrink-0" style={{background:"#0a0f3c",borderRadius:"16px 16px 0 0"}}>
                    <div>
                      <h3 className="text-sm font-bold text-white">Report Assistant</h3>
                      <p className="text-[9px] text-white/40 truncate max-w-[250px]">"{assistSelection.slice(0,60)}..."</p>
                    </div>
                    <button onClick={()=>{setAssistOpen(false);setAssistMessages([]);}} className="text-white/40 hover:text-white text-lg">&times;</button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3 space-y-3">
                    {assistMessages.length===0&&(
                      <div className="space-y-1.5">
                        {["Why was this conclusion reached?","What data supports this?","How could this insight be applied?","What are the implications?"].map(q=>(
                          <button key={q} onClick={()=>askAssistant(q)}
                            className="block w-full text-left px-3 py-2 rounded-lg bg-surface2 text-xs text-main hover:bg-accent-soft transition">{q}</button>
                        ))}
                      </div>
                    )}
                    {assistMessages.map((m,i)=>(
                      <div key={i} className={m.role==="user"?"text-right":""}>
                        <div className={`inline-block max-w-[90%] px-3 py-2 rounded-xl text-xs leading-relaxed ${m.role==="user"?"bg-[#0019FF] text-white rounded-br-sm":"bg-surface2 text-main rounded-bl-sm"}`}>
                          <div className="whitespace-pre-wrap">{m.text}</div>
                        </div>
                      </div>
                    ))}
                    {assistLoading&&<div className="flex gap-1 px-3 py-2"><span className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{animationDelay:"0ms"}}/><span className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{animationDelay:"150ms"}}/><span className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{animationDelay:"300ms"}}/></div>}
                    <div ref={assistEndRef}/>
                  </div>
                  <div className="border-t border-main p-2 flex gap-2 flex-shrink-0">
                    <input value={assistQuery} onChange={e=>setAssistQuery(e.target.value)}
                      onKeyDown={e=>{if(e.key==="Enter")askAssistant();}}
                      placeholder="Ask a follow-up question..."
                      className="flex-1 px-3 py-2 bg-surface2 border border-main rounded-lg text-xs text-main focus:outline-none focus:border-[var(--accent)]"/>
                    <button onClick={askAssistant} disabled={assistLoading}
                      className="px-3 py-2 bg-[#0019FF] text-white rounded-lg text-xs font-semibold hover:opacity-90 disabled:opacity-50">Send</button>
                  </div>
                </div>
              )}
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

                  {/* BRANDS + COUNTRY */}
                  <div className="bg-surface rounded-lg border border-main p-4 mb-3">
                    <h3 className="text-sm font-semibold text-main mb-1">{selectedTemplate.singleBrand?"Brand — select one":"Brands"}</h3>
                    {selectedTemplate.singleBrand&&<p className="text-[10px] text-hint mb-2">This report analyses a single brand in depth</p>}
                    {/* Country filter */}
                    {allCountries.length>1&&(
                      <div className="mb-3 pb-3 border-b border-main">
                        <p className="text-[9px] text-hint uppercase font-semibold tracking-wider mb-1.5">Filter by country</p>
                        <div className="flex gap-1.5 flex-wrap">
                          <button onClick={()=>{setCountryFilter([]);setCompetitors([]);}}
                            className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition ${countryFilter.length===0?"bg-accent-soft border-[var(--accent)] text-accent":"bg-surface border-main text-hint hover:border-[var(--accent)]"}`}>All regions</button>
                          {allCountries.map(c=>(
                            <button key={c} onClick={()=>{setCountryFilter(prev=>{const next=prev.includes(c)?prev.filter(x=>x!==c):[...prev,c];return next;});setCompetitors([]);}}
                              className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition ${countryFilter.includes(c)?"bg-accent-soft border-[var(--accent)] text-accent":"bg-surface border-main text-hint hover:border-[var(--accent)]"}`}>{c}</button>
                          ))}
                        </div>
                      </div>
                    )}
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
                    <input value={reportTitle} onChange={e=>{setReportTitle(e.target.value);reportTitleRef.current=e.target.value;}} placeholder={`E.g., ${selectedTemplate.label} — Q1 2026`} className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main mb-3 focus:outline-none focus:border-[var(--accent)]"/>
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
            ?<div className="flex-1 overflow-hidden"><EntryViewer entry={viewerEntry} onClose={()=>setViewerEntry(null)}/></div>
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
