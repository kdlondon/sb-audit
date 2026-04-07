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
import { useFramework } from "@/lib/framework-context";
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
    {id:"opportunities",label:"Opportunity territories",desc:"3–5 named strategic opportunities for the client brand"},
  ]},
  {id:"creative_intelligence",label:"Creative Intelligence",scope:"global",badge:"Global",description:"Global creative — territories, execution, transferable inspiration",singleBrand:false,sections:[
    {id:"landscape",label:"Creative landscape",desc:"Emotional and strategic territory globally"},
    {id:"execution",label:"Execution styles & patterns",desc:"How global brands execute their positioning"},
    {id:"archetypes",label:"Archetypes & roles",desc:"Which archetypes and bank roles dominate globally"},
    {id:"insights",label:"Insights & human truths",desc:"The human truths driving global creative"},
    {id:"portrait_door",label:"Portrait & door intelligence",desc:"Which entrepreneur identities global brands address"},
    {id:"inspiration",label:"Transferable inspiration",desc:"What the client brand could learn from global examples"},
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

0. ABSOLUTE RULE — NO FABRICATION:
- You may ONLY reference entries that appear in the data provided. NEVER invent entries, brands, campaigns, percentages, or citations.
- NEVER create fake citation IDs. Every [cite:ID] MUST use an exact ID from the data.
- If the data is insufficient for a section, say so explicitly: "Insufficient data for this analysis — only N entries available."
- If you cannot fill a section with real data, write: "Not enough entries to generate this section." Do NOT fill it with imagined content.
- NEVER fabricate statistics, percentages, or distribution numbers. Only cite numbers you can calculate from the actual data provided.

1. COMMUNICATION INTENT HIERARCHY:
- **Brand Hero**: Core positioning — manifestos, brand commercials, tagline-driven campaigns. Use as PRIMARY source for positioning analysis (tension, insight, creative proposition, archetype, territory).
- **Brand Tactical**: Brand-building support — events, sponsorships, CSR, community initiatives.
- **Client Testimonials**: Customer stories, case studies.
- **Product**: Product/service/offer driven communication.
- **Innovation**: New capability/technology positioning.
- **Beyond Banking**: Educational content, community programs, financial literacy, thought leadership.

→ For audience, proof points, tone, and communication patterns: use full body of entries, weighted toward last 3 years.

2. BRAND HERO RULES:
- Trace chronological evolution across all Brand Hero entries. Most recent = current positioning reference.
- When multiple Brand Hero campaigns exist (2+), the through-line or evolution is a finding worth naming.
- When only one Brand Hero exists: positioning read carries moderate confidence. Note this explicitly. Use tactical/product consistency as corroborating evidence. Never treat a single hero piece as equivalent to a proven, repeated conviction.

3. RECENCY WEIGHTING:
- Demographic, psychographic, and communication pattern analysis: weight toward entries from the last 3 years (2023-2026).
- Older entries contribute to Evolution narratives. Current snapshot is the headline. Historical trajectory is supporting context.

4. FAIR CROSS-BRAND COMPARISON:
- Do not treat brands with more entries as "more strategic" than those with fewer.
- Do not fabricate specificity to match higher-volume brands. If the data is thinner, say so — that itself is a finding.
- Compare positioning quality, not communication volume.

5. CITATION RULES:
- Inline: [descriptive name](cite:ENTRY_ID) — renders as clickable links.
- End of report: ## Sources section listing all cited entries.
- Every claim about a specific piece must carry a citation. Pattern-level observations using pre-calculated distribution data do not require individual citations.

6. DEMOGRAPHIC QUALITY GATE:
- NEVER fabricate firmographic ranges (revenue bands, employee counts, years in business) unless entry metadata explicitly contains them.
- Describe audience through observed signals: channels, tones, representation, business size where tagged.
- When a brand's communications don't define their audience by size or revenue, say so — the absence is a finding.
- When Brand Hero targets a different profile than tactical work, name both.

7. INSIGHT QUALITY GATE:
- Human Insight must be specific to this brand's emotional territory. Distinctiveness test: if the same insight could describe 3+ competitors, rewrite.
- Must express the Tension in first person. Must feel like something a real business owner would say — raw, specific, slightly uncomfortable.
- Must connect: Insight (what audience feels) → Tension (the conflict) → Brand Response (how brand resolves it). If this chain breaks, the analysis is wrong.
- AVOID the "I don't need X, I need Y" construction — this is an AI writing pattern.

8. VOICE RULES:
You are a senior brand strategist. Write with precision, point of view, and economy. Every sentence earns its place.

Anti-patterns — avoid systematically:
- Negation-correction as reflex ("It's not about X. It's about Y.") — once per section max
- False escalation ("But more importantly…" / "The real question is…")
- Hedge-then-certainty ("While it's true that X, what we're actually seeing is Y.")
- Colon-as-drumroll ("And this reveals something critical: [claim]")
- Forced tripling — real analysis is messier than parallel threes
- Empathy preambles ("It's worth noting…") — cut the cushion
- Abstraction creep — if no concrete evidence attaches, cut it
- Echo summarizing ("In other words…" / "Put simply…")

Interchangeability test: if you could swap in any other brand name and the text still holds, the analysis is too generic.

Tone: Direct, intelligent, with point of view. Clarity over cleverness. Economy of words. Short paragraphs, strong openings, clean endings.

9. WEBSITE PROFILE DATA:
Website data represents the brand's declared positioning — what the brand claims to be in its most controlled owned channel.
Weight hierarchy: (1) Brand Hero campaigns > (2) Campaign body > (3) Website profile.
- Section 02: Website provides declared baseline that campaigns confirm or contradict.
- Section 04: Website reveals product priorities that may differ from campaign emphasis.
- Section 08/09: Formal structured comparison between declared and executed positioning.
- Do NOT use website data for: audience insight/tension, tone assessment, or proof points.
- The gap between declared (website) and executed (campaigns) is one of the most valuable findings. Always diagnose: (1) website hasn't caught up, (2) internal silos, or (3) positioning that collapses under product reality.

INTERNAL VERIFICATION (apply during generation):
- No fabricated firmographics
- Insight passes distinctiveness test, no "I don't need X / I need Y"
- All strengths/weaknesses are diagnostic
- No paragraph passes interchangeability swap
- All anti-patterns avoided
- Distribution ratios cited from pre-calculated data, not manual counting
- Citation format: [descriptive name](cite:ENTRY_ID)
`;

// ── SYSTEM PROMPTS ────────────────────────────────────────────────────────────
// System prompts are now functions that accept framework context
function getSystemPrompts(fw) {
  const brandName = fw?.brandName || "the client brand";
  const industry = fw?.industry || "the competitive category";
  const market = fw?.primaryMarket || "the local market";

  return {
    competitor_snapshot: "DYNAMIC",

    category_landscape:`You are a world-class brand strategist analyzing the full ${market} ${industry} competitive landscape for ${brandName}.

${GLOBAL_RULES}

When comparing brands across the category, group your analysis by communication intent:
- Compare Brand Hero positioning across competitors (archetype, territory, proposition)
- Compare Product communication strategies
- Compare innovation and value-added approaches
- Note which brands use Client Testimonials effectively and what those reveal

Use ## for sections, **bold** for key findings, markdown tables for cross-brand comparisons. Be conclusive.`,

    opportunity:`You are a world-class brand strategist identifying strategic white spaces for ${brandName} in the ${market} ${industry} market.

${GLOBAL_RULES}

RECENCY RULE — CRITICAL:
Focus ONLY on entries from the last 2 years. Ignore older entries for opportunity analysis. White spaces and strategic gaps must be based on the current competitive landscape, not historical data. If an entry is older than 2 years, exclude it from your analysis entirely.

When identifying opportunities, consider gaps across all communication intent categories:
- Unclaimed Brand Hero territories (positioning no competitor owns)
- Product communication gaps (product stories no one is telling)
- Value-added white spaces (lifestyle/community territories unexplored)
- Client Testimonial opportunities (customer voices no one is amplifying)

Be specific, opinionated, and direct. End with 3–5 named opportunity territories.`,

    creative_intelligence:`You are a world-class creative strategist analyzing global ${industry} brand communications to extract inspiration for ${brandName}.

${GLOBAL_RULES}

QUALITY FOCUS — CRITICAL:
Focus primarily on entries rated 4–5 stars. These represent the most creatively outstanding cases and should be the spotlight of your analysis. Lower-rated entries (1–3 stars) may provide useful context or contrast, but the core of the report must highlight excellence. When selecting transferable examples, prioritize the highest-rated work.

For transferable examples, state: what they do, why it works, the transferable principle, and how it could apply in the ${market} context. Distinguish between Brand Hero inspiration (positioning/territory ideas) and tactical inspiration (execution/format ideas).`,

    innovation:`You are a world-class brand strategist identifying communication innovation and convention breaks in global ${industry} brands.

${GLOBAL_RULES}

Focus on what breaks category norms. Identify emerging signals before they become mainstream. Note whether innovation appears in Brand Hero positioning (strategic innovation) or in tactical execution (format/channel innovation).`,

    agnostic_snapshot: "DYNAMIC",
  };
}

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
  const{projectId,projectName,brandId}=useProject()||{};
  const filterField="project_id"; // Use project_id for data queries during transition
  const filterValue=projectId||brandId;
  const{framework,frameworkLoaded,hasDimension}=useFramework()||{};
  const searchParams=useSearchParams();
  const tabParam=searchParams.get("tab");
  const reportParam=searchParams.get("report");
  const view=reportParam?"archive":(tabParam||"dashboard");
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
  const[sectionOverrides,setSectionOverrides]=useState({}); // {sectionId: {label, desc}}
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
  const[pendingGenerate,setPendingGenerate]=useState(false);
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
      if(text.length>3&&inReport){
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
      // Apply highlights — try multiple search strategies
      comments.forEach(c=>{
        try{
          if(!c.quote||!c.id)return;
          const walker=document.createTreeWalker(container,NodeFilter.SHOW_TEXT,null);
          // Try progressively shorter search strings
          const searchVariants=[
            c.quote.slice(0,80),
            c.quote.slice(0,40),
            c.quote.slice(0,20),
          ].filter(s=>s.length>=5);
          let found=false;
          let node;
          for(const searchText of searchVariants){
            if(found)break;
            // Reset walker
            const w=document.createTreeWalker(container,NodeFilter.SHOW_TEXT,null);
            while(node=w.nextNode()){
              const idx=node.textContent.indexOf(searchText);
              if(idx===-1)continue;
              const endIdx=Math.min(idx+searchText.length,node.textContent.length);
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
              try{range.surroundContents(mark);found=true;}catch{/* range crosses elements */}
              break;
            }
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
  const[renamingReport,setRenamingReport]=useState(null); // report id being renamed

  useEffect(()=>{(async()=>{
    const[{data:csData},{data:reports}]=await Promise.all([
      supabase.from("creative_source").select("*").eq(filterField,filterValue),
      supabase.from("saved_reports").select("*").eq(filterField,filterValue).order("created_at",{ascending:false}),
    ]);
    const allCs=csData||[];
    const ld=allCs.filter(e=>e.scope==="local");const gd=allCs.filter(e=>e.scope==="global");
    setLocalData(ld);setGlobalData(gd);setSavedReports(reports||[]);
    const years=[...new Set([...ld,...gd].map(e=>e.year).filter(Boolean))].sort();
    setAllYears(years);
    if(years.length>0){setYearFrom(years[0]);setYearTo(years[years.length-1]);}
    const opts=await fetchOptions(projectId);
    // Override competitor list from brand_competitors with scope info
    if(brandId){
      const{data:compLinks}=await supabase.from("brand_competitors").select("competitor_brand_id").eq("own_brand_id",brandId);
      if(compLinks?.length){
        const compIds=compLinks.map(c=>c.competitor_brand_id);
        const{data:compBrands}=await supabase.from("brands").select("id, name, scope").in("id",compIds).order("name");
        if(compBrands){
          opts.competitor=compBrands.map(b=>b.name);
          opts._competitorFull=compBrands; // Full data with scope for filtering
          console.log("[Reports] competitors from brand_competitors:", compBrands.length, compBrands.map(b=>b.name));
        }
      }
    }
    setOPTIONS(opts);setLoading(false);
  })();},[projectId]);

  useEffect(()=>{
    if(!reportParam){setViewingReport(null);setComments([]);return;}
    const found=savedReports.find(r=>r.id===reportParam);
    if(found){
      // Always update viewingReport with latest data from savedReports
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
      // Always save to localStorage as backup
      try{localStorage.setItem(`report_comments_${reportId}`,JSON.stringify(newComments));}catch{}
      // Try saving to DB
      const{error}=await supabase.from("saved_reports").update({comments:newComments}).eq("id",reportId);
      if(error)console.warn("Comment save error:",error.message);
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

  // Regenerate: run generate() AFTER React has applied the new state (competitors, sections, etc.)
  useEffect(()=>{
    if(!pendingGenerate)return;
    setPendingGenerate(false);
    generate();
  },[pendingGenerate,competitors,sections,yearFrom,yearTo]);

  const currentData=selectedTemplate?.scopeAny?[...localData,...globalData]:selectedTemplate?.scope==="local"?localData:globalData;
  const allCountries=[...new Set(currentData.map(e=>e.country).filter(c=>c&&c!=="All regions"))].sort();
  const filteredData=currentData.filter(e=>{
    const brand=e.competitor||e.brand||"";
    const matchBrand=competitors.length===0||competitors.includes(brand);
    const matchYear=(!yearFrom||!e.year||e.year>=yearFrom)&&(!yearTo||!e.year||e.year<=yearTo);
    const matchCountry=countryFilter.length===0||!e.country||countryFilter.includes(e.country);
    return matchBrand&&matchYear&&matchCountry;
  });
  // Load brand metadata
  useEffect(()=>{(async()=>{
    const{data}=await supabase.from("brand_metadata").select("brand_name,brand_category").eq(filterField,filterValue);
    const map={};(data||[]).forEach(m=>{map[m.brand_name]=m.brand_category;});
    setBrandMetaMap(map);
  })();},[projectId]);

  const buildGroupedBrands=(dataArr,brandKey,scopeFilter)=>{
    // LOCKED list from brand_competitors — do NOT add from entries
    const allBrandSet=new Set();
    const fullComps = OPTIONS._competitorFull || [];
    if(fullComps.length > 0){
      // Filter by scope if specified
      const filtered = scopeFilter && scopeFilter !== "all"
        ? fullComps.filter(b => b.scope === (scopeFilter === "local" ? "local" : "global"))
        : fullComps;
      filtered.forEach(b => allBrandSet.add(b.name));
    } else {
      // Fallback: use OPTIONS.competitor or entries
      (OPTIONS.competitor||[]).filter(v=>v!=="Other").forEach(b=>allBrandSet.add(b));
    }
    console.log("[Reports] brands for scope", scopeFilter, ":", allBrandSet.size);
    const groups={};
    allBrandSet.forEach(b=>{const cat=brandMetaMap[b]||"Other";if(!groups[cat])groups[cat]=[];groups[cat].push(b);});
    const order=["Traditional Banking","Fintech","Neobank","Credit Union","Supplementary Services","Non-financial","Other"];
    return Object.entries(groups).sort((a,b)=>{const ia=order.indexOf(a[0]),ib=order.indexOf(b[0]);return(ia===-1?99:ia)-(ib===-1?99:ib);}).map(([cat,brands])=>({cat,brands:brands.sort()}));
  };
  // Filter data by country for brand list
  const countryFilteredLocal=countryFilter.length>0?localData.filter(e=>countryFilter.includes(e.country)):localData;
  const countryFilteredGlobal=countryFilter.length>0?globalData.filter(e=>countryFilter.includes(e.country)):globalData;
  const groupedBrands=selectedTemplate?.scopeAny
    ?(()=>{const localG=buildGroupedBrands(countryFilteredLocal,"competitor","local");const globalG=buildGroupedBrands(countryFilteredGlobal,"brand","global");const merged={};[...localG,...globalG].forEach(g=>{if(!merged[g.cat])merged[g.cat]=new Set();g.brands.forEach(b=>merged[g.cat].add(b));});const order=["Traditional Banking","Fintech","Neobank","Credit Union","Supplementary Services","Non-financial","Other"];return Object.entries(merged).sort((a,b)=>{const ia=order.indexOf(a[0]),ib=order.indexOf(b[0]);return(ia===-1?99:ia)-(ib===-1?99:ib);}).map(([cat,set])=>({cat,brands:[...set].sort()}));})()
    :selectedTemplate?.scope==="local"
      ?buildGroupedBrands(countryFilteredLocal,"competitor","local")
      :buildGroupedBrands(countryFilteredGlobal,"brand","global");
  const availableBrands=groupedBrands.flatMap(g=>g.brands);
  const allData=[...localData,...globalData];

  const toggleComp=(c)=>{
    if(selectedTemplate?.singleBrand){setCompetitors([c]);return;}
    setCompetitors(prev=>prev.includes(c)?prev.filter(x=>x!==c):[...prev,c]);
  };
  const toggleSec=(id)=>setSections(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id]);
  const copyReport=()=>{navigator.clipboard.writeText(report||viewingReport?.content||"");setCopied(true);setTimeout(()=>setCopied(false),2000);};
  const resolveCiteLinks=(md)=>{
    return md.replace(/\[([^\]]+)\]\(cite:([^)]+)\)/g,(match,label,id)=>{
      const entry=allData.find(e=>e.id===id);
      if(entry?.url)return`[${label}](${entry.url})`;
      return label;
    });
  };
  const downloadMD=()=>{const title=viewingReport?.title||reportTitleRef.current||"report";const filename=title.replace(/[^a-zA-Z0-9\s\-_]/g,"").replace(/\s+/g,"_")+".md";const header=`# ${title}\n\n${[viewingReport?.competitors,viewingReport?.year_from&&viewingReport?.year_to?viewingReport.year_from+"–"+viewingReport.year_to:"",new Date(viewingReport?.created_at||Date.now()).toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"})].filter(Boolean).join(" · ")}\n\n---\n\n`;const rawContent=report||viewingReport?.content||"";const content=header+resolveCiteLinks(rawContent);const blob=new Blob([content],{type:"text/markdown"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=filename;document.body.appendChild(a);a.click();document.body.removeChild(a);};
  const downloadPDF=async()=>{
    if(!reportRef.current)return;
    const title=viewingReport?.title||reportTitleRef.current||"report";
    const filename=title.replace(/[^a-zA-Z0-9\s-_]/g,"").replace(/\s+/g,"_")+".pdf";
    // Create a wrapper with header for PDF
    const wrapper=document.createElement("div");
    wrapper.style.cssText="font-family:system-ui,sans-serif;color:#1a1a2e;";
    // PDF header
    const header=document.createElement("div");
    header.style.cssText="margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #0a0f3c;";
    header.innerHTML=`<h1 style="font-size:24px;font-weight:bold;color:#0a0f3c;margin:0 0 8px;">${title}</h1>
      <p style="font-size:11px;color:#888;margin:0;">${[viewingReport?.competitors,viewingReport?.year_from&&viewingReport?.year_to?viewingReport.year_from+"–"+viewingReport.year_to:"",new Date(viewingReport?.created_at||Date.now()).toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"})].filter(Boolean).join(" · ")}</p>
      <p style="font-size:10px;color:#aaa;margin:4px 0 0;">Generated by Groundwork — groundwork.kad.london</p>`;
    wrapper.appendChild(header);
    // Clone report content
    const content=reportRef.current.cloneNode(true);
    // Convert cite spans to real links (or styled text if no URL)
    content.querySelectorAll("span[style*='dotted']").forEach(el=>{
      // Try to find the entry ID from the onclick or nearby data
      const text=el.textContent||"";
      const entry=allData.find(e=>(e.description||"").slice(0,50).includes(text.slice(0,30))||(e.competitor||e.brand||"")===text);
      if(entry?.url){
        const link=document.createElement("a");
        link.href=entry.url;
        link.textContent=text;
        link.style.cssText="color:#0019FF;text-decoration:underline;";
        el.replaceWith(link);
      }else{
        const span=document.createElement("span");
        span.textContent=text;
        span.style.cssText="color:#0019FF;font-weight:500;";
        el.replaceWith(span);
      }
    });
    wrapper.appendChild(content);
    document.body.appendChild(wrapper);
    const html2pdf=(await import("html2pdf.js")).default;
    await html2pdf(wrapper,{margin:[15,15,25,15],filename,image:{type:"jpeg",quality:0.98},html2canvas:{scale:2,useCORS:true},jsPDF:{unit:"mm",format:"a4",orientation:"portrait"},pagebreak:{mode:["avoid-all","css","legacy"]}});
    document.body.removeChild(wrapper);
  };

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
      brand_id:brandId,
    };
    await supabase.from("saved_reports").insert(reportObj);
    const{data:reports}=await supabase.from("saved_reports").select("*").eq(filterField,filterValue).order("created_at",{ascending:false});
    setSavedReports(reports||[]);setSaving(false);
    if(openEditor)router.push(`/reports/editor?id=${id}`);
    return reportObj;
  };

  const deleteReport=async(id)=>{
    if(!confirm("Delete this report?"))return;
    await supabase.from("saved_reports").delete().eq("id",id);
    const{data:reports}=await supabase.from("saved_reports").select("*").eq(filterField,filterValue).order("created_at",{ascending:false});
    setSavedReports(reports||[]);
    if(viewingReport?.id===id)router.push("/reports?tab=archive",{scroll:false});
  };

  const searchResults=searchQuery.length>1?allData.filter(e=>{const q=searchQuery.toLowerCase();return(e.description||"").toLowerCase().includes(q)||(e.competitor||"").toLowerCase().includes(q)||(e.brand||"").toLowerCase().includes(q)||(e.main_slogan||"").toLowerCase().includes(q);}).slice(0,10):[];

  // Agnostic snapshot — section instructions (used to build dynamic prompt)
  const AGNOSTIC_SECTION_PROMPTS={
    audience:`(Data sources: ALL entries weighted toward last 3 years for demographic; Brand Hero for tension/insight; full timeline for evolution)

**Opening line:** One sentence framing who the brand targets and the defining characteristic. No preamble — start with the finding.

**Demographic:** Who the brand addresses across all touchpoints. Describe through observed signals: channels, tones, representation, business size where tagged. Reference the pre-calculated distributions. When Brand Hero targets a narrower profile than the full body, state both. Never invent firmographic specifics the data doesn't contain.

**Psychographic:** Anchored to Brand Hero and mass communication. What does this audience value, fear, aspire to? Describe the brand's character in plain strategic language (e.g., "nurturing-supportive," "premium-authority," "rebellious challenger"). Tactical work extends the psychographic — doesn't contradict it unless contradiction is the finding.

**Tension:** From the most recent Brand Hero. The underlying conflict the brand claims to resolve. One sentence, sharp.

**Human Insight:** First-person quote (20-35 words) from the Brand Hero's emotional territory. Must pass the distinctiveness test. Must express the tension. Must feel like something a specific person would say at 2am. AVOID "I don't need X, I need Y" construction.

**Audience Evolution:** Full timeline for trajectory, emphasis on current state. Name the shift (if any). For single Brand Hero brands, include a confidence note.

TERMINOLOGY BLACKLIST (agnostic only): Never use Portrait labels (Builder, Dreamer, Sovereign, Architect), Entry Doors, Journey Phases, Moments that Matter, Richness Definitions, Client Lifecycle labels, Bank Roles, or Archetype labels by name (Caregiver, Sage, Magician, etc.). Instead use plain descriptors: "nurturing-supportive brand character," "knowledge-authority positioning," "hands-on, established owner."`,

    brand_response:`(Data sources: Brand Hero primary, all entries for evolution, website profile for declared baseline)

**Opening line:** One sentence on the brand's current positioning.

**Creative Proposition:** Current brand platform/tagline. Name it, cite the piece.

**Brand Character:** What the brand consistently projects. Describe in plain language. Use the pre-calculated archetype distribution to cite consistency ratio. Also provide a short 2-3 word descriptor suitable for showcase display (e.g., "Supportive Partner," "Premium Authority"). When inconsistencies appear, diagnose strategic variation vs. identity confusion.

**Brand Role:** What the brand is trying to be for the business owner. One sentence.

**Emotional Positioning Statement:** What the brand wants the audience to feel. In quotes.

**Rational Positioning Statement:** What the brand functionally delivers. One sentence.

**Brand Territory:** Primary and secondary. Name whether each is owned or shared in the competitive set.

**Key Differentiators:** 2-3, each anchored to specific pieces. Note whether genuinely differentiating or table stake disguised as advantage.

**Positioning Evolution:** Chronological Brand Hero trace. Name what changed, what stayed, trajectory direction. For single Brand Hero, acknowledge limitation.`,

    proof_points:`(Data sources: All entries, Brand Hero and Brand Tactical primary. Use r2b and diff_claim fields where populated.)

**Opening line:** One sentence on how the brand proves its promises.

**Primary Proof Point:** The single strongest proof of positioning. Cite the piece. Explain why it's strongest.

**Secondary Proof Points:** 2-3, each cited. Distinguish demonstrated proof (actions, data) from declared proof (claims without evidence).

**Communication Focus:** What communications consistently revolve around. Name the recurring theme across pieces.

**Tone & Voice:** Reference the pre-calculated tone distribution. When tone varies across piece types, name the pattern. Note whether variation is strategic or inconsistent.

**Brand Tactical Support:** How well do tactical pieces reinforce core positioning? Strong alignment = strategic discipline. Weak alignment = silo problem or positioning that doesn't hold under creative pressure.`,

    product_comms:`(Data sources: Entries tagged Product + website profile for key products, key messages, differentiators)

**Approach:** Feature-led, outcome-led, or benefit-led? With evidence.

**Key Product Messages:** 2-3 core messages the brand repeats. In their language.

**Channels & Formats:** Where and how product communication appears.

**Gap:** The disconnect (if any) between product communication and brand positioning. Does product work reinforce the brand promise or live in a parallel universe?`,

    beyond_banking:`(Data sources: Entries tagged Beyond Banking and Innovation)

**Beyond Banking:** What territories outside functional banking? Evaluate credibility. Distinguish genuine initiatives (structural, sustained) from superficial lifestyle marketing (one-off, cosmetic).

**Innovation:** Demonstrated or declared? Demonstrated = shows capabilities in action. Declared = says "innovative" without evidence. Name which and cite.

**White Space:** Most credible unclaimed territory. Must pass: (1) no competitor owns it, (2) brand has credible permission from existing communication equity.`,

    brand_assessment:`(Data sources: Primarily Brand Hero, full body for consistency. Use brand_attributes field where populated.)

**Strengths:** 3, each with **bold label** + 1-2 sentences of evidence. Must be specific to this brand — "strong positioning" is not a strength. "The only brand in the set that sacrificed its own media budget to promote client businesses" is.

**Weaknesses:** 2, same format. Must be diagnostic: name the cause, evidence, and vulnerability it creates.`,

    comm_assessment:`(Data sources: All entries, evaluated as a communication system)

**Strengths:** 3, each with **bold label** + evidence. Evaluate the ecosystem, not individual pieces. A mediocre hero backed by excellent tactical execution can outperform a brilliant hero with no follow-through.

**Weaknesses:** 2, same format. Focus on systemic issues: channel concentration, tone inconsistencies, proof point gaps, creative repetition.`,

    website_vs_comms:`(Only generate if BRAND WEBSITE PROFILE data is provided. Skip entirely if not.)

**Comparison table:**
| Dimension | Website Profile (declared) | Actual Communications (executed) | Alignment |

Dimensions: Core Positioning, Brand Character, Tone, Target Audience, Value Proposition, Key Differentiators

Alignment values: **Aligned**, **Partial**, **Disconnect**, or **Major Gap** — with brief diagnosis.

**Closing paragraph:** Interpret the pattern. Diagnose disconnects as: (1) website hasn't caught up, (2) internal silos, or (3) positioning that collapses under product reality. Don't leave ambiguous.

**Strategic implication:** Name the consequence for the audience's journey. Disconnect between website and campaign typically weakens conversion.`,
  };

  const buildAgnosticPrompt=()=>{
    let structureParts=[];
    sections.forEach((secId,i)=>{
      const ov=sectionOverrides[secId]||{};
      const tmpl=selectedTemplate?.sections?.find(s=>s.id===secId);
      const label=ov.label||tmpl?.label||secId;
      const customDesc=ov.desc;
      const defaultInstructions=AGNOSTIC_SECTION_PROMPTS[secId]||"";
      const num=String(i+1).padStart(2,"0");
      structureParts.push(`## ${num} — ${label}\n${customDesc&&customDesc!==tmpl?.desc?`CUSTOM INSTRUCTIONS: ${customDesc}\n`:""}${defaultInstructions}`);
    });
    return `You are a senior brand strategist writing a competitive communication audit. Framework-agnostic — no proprietary terminology.

CRITICAL: Do NOT reference any proprietary frameworks, models, or methodologies. No portraits, entry doors, journey phases, richness definitions, moments that matter, or client lifecycle. Write as a pure competitive communication audit using plain strategic language.

${GLOBAL_RULES}

CITATION FORMAT: [descriptive name](cite:ENTRY_ID) — e.g., [their national awards program](cite:1773496163636)
Do NOT mention the piece name and then repeat it as a separate link. The name IS the link. One mention only.
Include a ## Sources section at the end.

REPORT STRUCTURE — follow this EXACTLY in this order. ONLY generate the sections listed below:

${structureParts.join("\n\n")}

Use ## for sections, **bold** for labels. Be conclusive and opinionated. Write with authority.`;
  };

  // Competitor Snapshot (with K&D framework) — section instructions
  const CS_SECTION_PROMPTS={
    positioning:`(Data sources: Brand Hero primary, full body for consistency, website profile for declared baseline)

**Creative Proposition:** Current brand platform/tagline with citation.

**Brand Archetype:** Named archetype (Caregiver, Sage, Magician, Ruler, Outlaw, Enabler, Hero, Creator, Regular Guy). Use pre-calculated archetype distribution to cite consistency ratio. When archetype shifts between Brand Hero campaigns, assess growth vs. instability.

**Brand Role:** The role the bank plays. Use K&D bank role taxonomy where applicable.

**Primary Territory:** Named, with ownership vs. shared occupancy assessment.

**Secondary Territory:** Same assessment.

**Main Value Proposition:** The core promise. One sentence. Cross-reference main_vp and diff_claim fields.

**Insight:** The human truth the brand addresses. From Brand Hero. Apply distinctiveness test.

**Creative Idea:** The creative concept translating insight into communication. From Brand Hero.

**Positioning Evolution:** Chronological Brand Hero trace. Name archetype shifts, territory changes, tone migration. For single Brand Hero, acknowledge limitation and cite tactical consistency.`,

    identity:`(Data sources: All entries, using pre-calculated portrait and entry_door distributions)

**Entry Doors:** Which Entry Doors (Freedom, Identity, Craft, Build to Exit) appear? Reference pre-calculated entry_door distribution. Name dominant door, assess whether secondary doors are strategic extensions or noise.

**Portraits:** Which Portraits (Dreamer, Builder, Sovereign, Architect)? Reference pre-calculated portrait distribution. When Brand Hero targets one portrait and tactical targets another, name the gap.

**Richness Definition:** How does the brand define success? (Financial, Impact, Life well-designed, Strategic capability, Potential). Reference pre-calculated richness_definition distribution. Assess alignment with positioning.`,

    journey:`(Data sources: All entries, using journey_phase, client_lifecycle, moment fields)

**Journey Phases:** Where does communication concentrate? Reference distribution.

**Client Lifecycle:** Which stages? Acquisition, Deepening, Retention. Reference balance.

**Moments that Matter — Table:**
| Moment Type | Present? | Evidence | Piece |
| Acquisition | | | |
| Deepening | | | |
| Unexpected | | | |

Assess meaningful vs. superficial coverage. Gaps are strategic findings.`,

    comms:`(Data sources: All entries, using pre-calculated distributions)

**Communication Intent Mix:** Reference pre-calculated intent breakdown. Assess balance vs. concentration.

**Channel Strategy:** Reference pre-calculated channel distribution. Assess reach vs. depth.

**Tone Architecture:** Reference pre-calculated tone distribution. Assess strategic vs. inconsistent variation.

**Execution Style Mix:** Reference pre-calculated execution_style distribution. Name dominant style and implications.

**Language Register:** Formal, colloquial, technical, peer-level. Assess consistency.`,

    execution:`(Data sources: All entries)

**Representation:** How does the brand show business owners? Reference pre-calculated distribution. Assess what representation choices say about who the brand values.

**Industry Shown:** Which industries appear? Category-specific or universal? Gaps are findings.

**Business Size:** Reference pre-calculated business_size distribution. When mostly untagged, note as finding.

**CTA Patterns:** What does the brand ask the audience to do? Assess CTA-to-intent alignment.`,

    campaign:`(Data sources: All entries, organized chronologically)

**Campaign Timeline:** Chronological map organized by communication intent:
- Year | Piece name | Communication Intent | Rating | Key observation (one line)

This section is data organization for strategic pattern reading.`,

    consistency:`(Data sources: All entries, using pre-calculated distributions)

**Archetype Consistency:** Reference pre-calculated archetype distribution. Anomalies = identity problems or unrealized opportunities — diagnose which.

**Tone Consistency:** Same analysis using tone distribution.

**Territory Consistency:** Same for primary/secondary territory.

**Portrait-to-Communication Alignment:** Same portrait across piece types? Name gaps.

**Overall Coherence Rating:** High / Moderate / Low — one sentence justification.`,

    strategic_read:`(Data sources: All entries + competitive context. Use brand_attributes, diff_claim, r2b fields.)

**What They Do Well:** 3 findings with **bold labels** + evidence. Must be specific and anchored.

**What's Missing:** 3 findings with **bold labels** + evidence. Diagnostic — name the vulnerability each gap creates.

**White Space:** Most credible unclaimed territory. Must pass credibility and ownership tests.

**Implication for ${framework?.brandName || "the client brand"}:** 1-2 sentences on what this means for ${framework?.brandName || "the client brand"}'s positioning.`,

    website_vs_comms:`(Only generate if BRAND WEBSITE PROFILE data is provided. Skip entirely if not.)

Same structure as Agnostic Report Section 08. In the K&D version, the Brand Character row uses named archetypes.

**Comparison table:**
| Dimension | Website Profile (declared) | Actual Communications (executed) | Alignment |

Dimensions: Core Positioning, Brand Archetype, Tone, Target Audience, Value Proposition, Entry Door

Alignment: **Aligned**, **Partial**, **Disconnect**, **Major Gap** — with diagnosis.

**Closing paragraph + Strategic implication:** Same as agnostic version.`,
  };

  const buildCompetitorPrompt=()=>{
    let structureParts=[];
    sections.forEach((secId,i)=>{
      const ov=sectionOverrides[secId]||{};
      const tmpl=selectedTemplate?.sections?.find(s=>s.id===secId);
      const label=ov.label||tmpl?.label||secId;
      const customDesc=ov.desc;
      const defaultInstructions=CS_SECTION_PROMPTS[secId]||"";
      const num=String(i+1).padStart(2,"0");
      structureParts.push(`## ${num} — ${label}\n${customDesc&&customDesc!==tmpl?.desc?`CUSTOM INSTRUCTIONS: ${customDesc}\n`:""}${defaultInstructions}`);
    });
    return `You are a world-class brand strategist analyzing competitive communications using the K&D proprietary framework. Use all framework dimensions where the data supports them.

This report uses K&D terminology freely: Portraits (Dreamer, Builder, Sovereign, Architect), Entry Doors, Journey Phases, Moments that Matter, Client Lifecycle, Richness Definitions, Bank Roles, and Archetype labels by name.

${GLOBAL_RULES}

CITATION FORMAT: [descriptive name](cite:ENTRY_ID) — e.g., [their national awards program](cite:1773496163636)
Do NOT mention the piece name and then repeat it as a separate link. The name IS the link. One mention only.
Include a ## Sources section at the end.

REPORT STRUCTURE — follow this EXACTLY in this order. ONLY generate the sections listed below:

${structureParts.join("\n\n")}

Use ## for sections, **bold** for labels, markdown tables where useful. Be conclusive and opinionated.`;
  };

  const generate=async()=>{
    if(!selectedTemplate||generating)return;
    // Data gate — prevent hallucinated reports with insufficient data
    if(filteredData.length<3){
      alert(`Not enough data to generate this report. You have ${filteredData.length} ${filteredData.length===1?"entry":"entries"} but need at least 3.\n\nAdd more audit entries first, then try again.`);
      return;
    }
    setGenerating(true);setReport("");setViewingReport(null);
    const timeRange=yearFrom&&yearTo?` (${yearFrom}–${yearTo})`:"";
    const sectionNames=sections.map(id=>{
      const ov=sectionOverrides[id];
      const tmpl=selectedTemplate.sections.find(s=>s.id===id);
      return ov?.label||tmpl?.label||id;
    }).filter(Boolean).join(", ");
    const sectionDetails=sections.map(id=>{
      const ov=sectionOverrides[id];
      const tmpl=selectedTemplate.sections.find(s=>s.id===id);
      const label=ov?.label||tmpl?.label||id;
      const desc=ov?.desc||tmpl?.desc||"";
      return `- ${label}: ${desc}`;
    }).join("\n");

    // Build data string with IDs for citations
    let dataStr;
    if(selectedTemplate.id==="agnostic_snapshot"||selectedTemplate.id==="competitor_snapshot"){
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

BRAND HERO ENTRIES (core positioning pieces — these are the MOST IMPORTANT entries for sections 01 and 02):
${fd.filter(e=>(e.communication_intent||"").toLowerCase().includes("hero")).map(e=>`[ID:${e.id}] ★★★ BRAND HERO ★★★ [${e.year||""}] ${e.description||""} | Slogan:${e.main_slogan||""} | Territory:${e.primary_territory||""} | Tone:${e.tone_of_voice||""} | Archetype:${e.brand_archetype||""} | Synopsis:${(e.synopsis||"").slice(0,200)} | Insight:${(e.insight||"").slice(0,200)}`).join("\n")||"No Brand Hero entries found"}

ALL ENTRY DESCRIPTIONS (including Brand Hero + Brand Tactical + Product + other):
${fd.map(e=>`[ID:${e.id}] [${e.year||""}] [${e.type||""}] [Intent:${e.communication_intent||""}] ${e.description||""} | Slogan:${e.main_slogan||""} | Territory:${e.primary_territory||""} | SecTerritory:${e.secondary_territory||""} | Tone:${e.tone_of_voice||""} | Archetype:${e.brand_archetype||""} | Portrait:${e.portrait||""} | Door:${e.entry_door||""} | Phase:${e.journey_phase||""} | Lifecycle:${e.client_lifecycle||""} | Role:${e.bank_role||""} | Pain:${e.pain_point_type||""} | Moment_Acq:${e.moment_acquisition||""} | Moment_Deep:${e.moment_deepening||""} | Moment_Unexp:${e.moment_unexpected||""} | Richness:${e.richness_definition||""} | Size:${e.business_size||""} | Rating:${e.rating||""}`).join("\n")}`;
    }else{
      dataStr=filteredData.map(e=>`[ID:${e.id}] [${e.competitor||e.brand}${e.year?" "+e.year:""}] ${e.description||""} | Portrait:${e.portrait||""} | Door:${e.entry_door||""} | Phase:${e.journey_phase||""} | Lifecycle:${e.client_lifecycle||""} | Tone:${e.tone_of_voice||""} | Role:${e.bank_role||""} | Lang:${e.language_register||""} | Pain:${e.pain_point_type||""} | Archetype:${e.brand_archetype||""} | Territory:${e.primary_territory||""} | SecTerritory:${e.secondary_territory||""} | Execution:${e.execution_style||""} | Size:${e.business_size||""} | Moment_Acq:${e.moment_acquisition||""} | Moment_Deep:${e.moment_deepening||""} | Moment_Unexp:${e.moment_unexpected||""} | Richness:${e.richness_definition||""} | Diff:${e.diff_claim||""} | Insight:${(e.insight||"").slice(0,120)} | Synopsis:${(e.synopsis||"").slice(0,120)}`).join("\n");
    }

    // Fetch brand profiles for context
    let brandProfileContext="";
    if(competitors.length>0){
      const{data:bProfiles}=await supabase.from("brand_profiles").select("brand_name,profile_data").eq(filterField,filterValue).in("brand_name",competitors).order("created_at",{ascending:false});
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

    const SYSTEM_PROMPTS=getSystemPrompts(framework);
    const system=selectedTemplate.id==="agnostic_snapshot"?buildAgnosticPrompt():selectedTemplate.id==="competitor_snapshot"?buildCompetitorPrompt():SYSTEM_PROMPTS[selectedTemplate.id];
    const brandLabel=competitors.length>0?competitors.join(", "):"all brands";
    const userMsg=`SUBJECT BRAND: ${brandLabel}\n\nCRITICAL: This report is EXCLUSIVELY about ${brandLabel}. Every section must analyze ${brandLabel} only. Do NOT confuse with other brands that may appear in comparison data. If you mention other brands, it must be clearly framed as comparison context, not as the subject.\n\nAudit data${timeRange} — ${filteredData.length} pieces:\n${dataStr}${brandProfileContext}\n\nGenerate the following sections IN THIS ORDER:\n${sectionDetails}\n\n${customInstructions?`Additional instructions: ${customInstructions}\n\n`:""}IMPORTANT — CITATION RULE:
- When you reference a specific piece of communication, make the descriptive name itself the citation link.
- Format: [descriptive name](cite:ENTRY_ID) — e.g., [their AI adoption guide](cite:1773496163636)
- Do NOT mention the piece name and then repeat it as a separate link. The name IS the link. One mention only.
- WRONG: "The Small Business Saturday initiative 16th Annual Small Business Saturday" — this repeats the name.
- RIGHT: "The [Small Business Saturday initiative](cite:123456) reinforces..." — name is the link, mentioned once.
- Use short natural names: "their Instagram campaign", "the women entrepreneur series", "How I made it"
- NEVER put raw IDs in prose. NEVER write "(ID: 883404)".
- Do NOT place citations inside markdown table rows — only in prose and bullet points.\n\nUse markdown with ## headers, tables, and **bold** key findings. Be analytical and conclusive, not descriptive.`;
    try{
      const res=await fetch("/api/ai",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({use_opus:true,max_tokens:12000,system,project_id:projectId,brand_id:brandId,messages:[{role:"user",content:userMsg}]})});
      const result=await res.json();
      if(result.error){setReport("Error: "+result.error);setGenerating(false);return;}
      const content=result.content?.map(c=>c.text||"").join("")||"No content.";
      setReport(content);
      // Auto-save immediately after generation
      const{data:{session}}=await supabase.auth.getSession();
      const rTitle=reportTitleRef.current||reportTitle||`${selectedTemplate?.label} — ${new Date().toLocaleDateString()}`;
      const id=String(Date.now());
      const reportObj={id,title:rTitle,scope:selectedTemplate?.scopeAny?"local":selectedTemplate?.scope||"local",template_type:selectedTemplate?.id||"",sections:sections.join(","),competitors:competitors.join(","),custom_instructions:customInstructions,year_from:yearFrom,year_to:yearTo,content,created_by:session?.user?.email||"",project_id:projectId,brand_id:brandId};
      await supabase.from("saved_reports").insert(reportObj);
      const{data:reports}=await supabase.from("saved_reports").select("*").eq(filterField,filterValue).order("created_at",{ascending:false});
      setSavedReports(reports||[]);
      setViewingReport(reportObj);
      setReport("");
      router.push(`/reports?report=${id}`,{scroll:false});
    }catch(err){
      if(err.message?.includes("fetch")||err.message?.includes("network")){
        setReport("Error: Network connection lost. Please check your internet and try again.");
      }else{
        setReport("Error: "+err.message);
      }
    }
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

    // Get the original entries from creative_source
    let csQuery = supabase.from("creative_source").select("*").eq(filterField, filterValue);
    if (scope === "local") csQuery = csQuery.eq("scope", "local");
    else if (scope === "global") csQuery = csQuery.eq("scope", "global");
    const { data: csEntries } = await csQuery;
    let entries = csEntries || [];
    if (brandNames.length > 0) {
      entries = entries.filter(e => brandNames.includes(e.brand_name) || brandNames.includes(e.competitor) || brandNames.includes(e.brand));
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
        body: JSON.stringify({ use_opus: true, max_tokens: 8000, system: systemPrompt, project_id: projectId, brand_id: brandId, messages: [{ role: "user", content: userMsg }] }),
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
        project_id: projectId, brand_id: brandId,
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

    // 2. Convert citations to markdown links
    // Handle old format [ENTRY:id] → [label](__cite__id)
    let withCiteLinks = cleaned.replace(/\[ENTRY:([^\]]+)\]/g, (match, id) => {
      const entry = allData.find(e => e.id === id);
      let label = entry
        ? (entry.description || entry.competitor || entry.brand || "source").slice(0, 50)
        : "source";
      label = label.replace(/\s*\(?ID[:\s]+[\d\w]+\)?/gi, "").trim().slice(0, 50);
      label = label.replace(/[\[\]]/g, "");
      return `[${label}](__cite__${id})`;
    });
    // Handle new format [name](cite:id) → [name](__cite__id)
    withCiteLinks = withCiteLinks.replace(/\]\(cite:([^)]+)\)/g, "](__cite__$1)");
    // Handle Sources section: [ID:xxx] - description → clickable link
    withCiteLinks = withCiteLinks.replace(/\[ID:([^\]]+)\]\s*[-–—]\s*(.+)/g, (match, id, desc) => {
      const entry = allData.find(e => e.id === id);
      return `[${desc.trim()}](__cite__${id})`;
    });

    const proseClass = "prose prose-sm md:prose-base max-w-none dark:prose-invert prose-headings:text-[var(--text)] prose-p:text-[var(--text2)] prose-strong:text-[var(--text)] prose-li:text-[var(--text2)] prose-h2:border-b prose-h2:border-[var(--border)] prose-h2:pb-2 prose-h2:mt-8 prose-h3:mt-6 prose-table:text-sm prose-th:bg-[var(--surface2)] prose-th:px-3 prose-th:py-2 prose-td:px-3 prose-td:py-2 prose-td:border-[var(--border)]";

    // 3. Single Markdown pass — citations become <a> tags handled by custom component
    return (
      <Markdown
        remarkPlugins={[remarkGfm]}
        urlTransform={(url) => url}
        className={proseClass}
        components={{
          table: ({children, ...props}) => (
            <div className="overflow-x-auto -mx-2 px-2 mb-4">
              <table {...props} className="min-w-full">{children}</table>
            </div>
          ),
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
          <h2 className="text-lg font-bold text-white">Report</h2>
          <div className="flex bg-white/15 rounded-lg p-0.5">
            <button onClick={()=>router.push("/reports",{scroll:false})} className={`px-3 py-1 rounded-md text-xs font-medium transition ${view==="dashboard"?"bg-white/15 text-white shadow-sm":"text-white/60"}`}>Dashboard</button>
            <button onClick={()=>router.push("/reports?tab=generate",{scroll:false})} className={`px-3 py-1 rounded-md text-xs font-medium transition ${view==="generate"?"bg-white/15 text-white shadow-sm":"text-white/60"}`}>Generate</button>
            <button onClick={()=>router.push("/reports?tab=journey",{scroll:false})} className={`px-3 py-1 rounded-md text-xs font-medium transition ${view==="journey"?"bg-white/15 text-white shadow-sm":"text-white/60"}`}>Journey Map</button>
            <button onClick={()=>router.push("/reports?tab=archive",{scroll:false})} className={`px-3 py-1 rounded-md text-xs font-medium transition ${view==="archive"?"bg-white/15 text-white shadow-sm":"text-white/60"}`}>Archive ({savedReports.length})</button>
          </div>
        </div>
        {activeContent&&<button onClick={()=>setViewerOpen(!viewerOpen)} className={`px-3 py-1.5 text-xs rounded-lg font-medium border transition ${viewerOpen?"bg-white/15 border-white/30 text-white":"border-white/20 text-white/60 hover:bg-white/15"}`}>{viewerOpen?"Hide entries":"Search entries"}</button>}
      </div>

      {/* DASHBOARD VIEW — embedded */}
      {view==="dashboard"&&(
        <div style={{height:"calc(100vh - 100px)",overflow:"hidden"}}>
          <iframe src="/analytics?embedded=1" style={{width:"100%",height:"100%",border:"none"}} />
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
                {[...new Set(localData.map(e=>e.competitor||e.brand_name).filter(Boolean))].sort().map(c=>(
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
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {renamingReport===r.id?(
                      <input autoFocus defaultValue={r.title} className="text-sm font-medium text-main bg-surface border border-[var(--accent)] rounded px-2 py-0.5 w-full max-w-[400px] focus:outline-none"
                        onClick={ev=>ev.stopPropagation()}
                        onBlur={async(ev)=>{const v=ev.target.value.trim();if(v&&v!==r.title){await supabase.from("saved_reports").update({title:v}).eq("id",r.id);const{data}=await supabase.from("saved_reports").select("*").eq(filterField,filterValue).order("created_at",{ascending:false});setSavedReports(data||[]);}setRenamingReport(null);}}
                        onKeyDown={ev=>{if(ev.key==="Enter")ev.target.blur();if(ev.key==="Escape")setRenamingReport(null);}}/>
                    ):(
                      <p className="text-sm font-medium text-main cursor-text" onDoubleClick={ev=>{ev.stopPropagation();setRenamingReport(r.id);}}>{r.title}</p>
                    )}
                    {r.template_type&&<span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold flex-shrink-0 ${BADGE[r.scope]||"bg-surface2 text-hint"}`}>{TEMPLATES.find(t=>t.id===r.template_type)?.label||r.template_type}</span>}
                  </div>
                  <div className="flex gap-2">
                    {r.year_from&&r.year_to&&<span className="text-[10px] text-hint">{r.year_from}–{r.year_to}</span>}
                    <span className="text-[10px] text-hint">{new Date(r.created_at).toLocaleDateString("en-GB",{day:"numeric",month:"short"})} {new Date(r.created_at).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})}</span>
                    <span className="text-[10px] text-hint">{r.created_by}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={async(ev)=>{ev.stopPropagation();router.push(`/reports?report=${r.id}`,{scroll:false});setTimeout(async()=>{const el=document.querySelector("[data-report-content]");if(!el)return;const html2pdf=(await import("html2pdf.js")).default;html2pdf(el,{margin:[15,15,25,15],filename:`${r.title||"report"}.pdf`,image:{type:"jpeg",quality:0.98},html2canvas:{scale:2,useCORS:true},jsPDF:{unit:"mm",format:"a4",orientation:"portrait"}});},1500);}} className="text-xs text-muted hover:text-main px-2">PDF</button>
                  <button onClick={ev=>{ev.stopPropagation();router.push(`/reports/editor?id=${r.id}`);}} className="text-xs text-accent hover:underline px-2">Edit</button>
                  <button onClick={ev=>{ev.stopPropagation();deleteReport(r.id);}} className="text-hint hover:text-red-400 text-sm px-2">×</button>
                </div>
              </div>
            ))}</div>
          }
        </div></div>
      )}

      {/* GENERATE / VIEW */}
      {(view==="generate"||(view==="archive"&&viewingReport))&&(
        <div className="px-5 py-5 w-full flex justify-center"><div className="w-full max-w-5xl" style={{marginRight:viewerOpen?390:0,transition:"margin 0.15s"}}>

          {/* REPORT CONTENT */}
          {activeContent&&(
            <div className="bg-surface rounded-lg border border-main">
              <div className="sticky top-0 z-20 bg-surface border-b border-main px-5 py-3" style={{borderTopLeftRadius:"0.5rem",borderTopRightRadius:"0.5rem"}}>
                {/* Row 1: Back + Title + Icon buttons */}
                <div className="flex items-center gap-3">
                  <button onClick={()=>{router.push("/reports?tab=archive",{scroll:false});setViewingReport(null);setReport("");}} className="text-muted hover:text-main flex-shrink-0">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                  </button>
                  <input className="text-2xl font-bold text-main flex-1 min-w-0 bg-transparent focus:outline-none focus:bg-surface focus:px-2 focus:rounded-lg transition-all"
                    defaultValue={viewingReport?.title||reportTitleRef.current||reportTitle||"Report"}
                    key={viewingReport?.id}
                    onBlur={async(ev)=>{const v=ev.target.value.trim();if(v&&viewingReport&&v!==viewingReport.title){await supabase.from("saved_reports").update({title:v}).eq("id",viewingReport.id);setViewingReport({...viewingReport,title:v});const{data}=await supabase.from("saved_reports").select("*").eq(filterField,filterValue).order("created_at",{ascending:false});setSavedReports(data||[]);}}}
                    onKeyDown={ev=>{if(ev.key==="Enter")ev.target.blur();}}
                  />
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {/* Copy */}
                    <button onClick={copyReport} className="w-8 h-8 flex items-center justify-center rounded-lg border border-main text-muted hover:text-main hover:bg-surface2 transition" title={copied?"Copied!":"Copy"}>
                      {copied?<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                      :<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>}
                    </button>
                    {/* Download */}
                    <div className="relative">
                      <button onClick={()=>setDownloadMenu(!downloadMenu)} className="w-8 h-8 flex items-center justify-center rounded-lg border border-main text-muted hover:text-main hover:bg-surface2 transition" title="Download">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                      </button>
                      {downloadMenu&&<>
                        <div className="fixed inset-0 z-30" onClick={()=>setDownloadMenu(false)}/>
                        <div className="absolute top-full right-0 mt-1 bg-surface border border-main rounded-lg shadow-lg overflow-hidden z-40 w-[80px]">
                          <button onClick={()=>{downloadMD();setDownloadMenu(false);}} className="w-full text-left px-3 py-2 text-xs text-main hover:bg-accent-soft">.md</button>
                          <button onClick={()=>{downloadPDF();setDownloadMenu(false);}} className="w-full text-left px-3 py-2 text-xs text-main hover:bg-accent-soft border-t border-main">.pdf</button>
                        </div>
                      </>}
                    </div>
                    {viewingReport&&<>
                      {/* Refresh */}
                      <button onClick={async()=>{
                        if(!confirm("Regenerate with latest data?"))return;
                        const tmpl=TEMPLATES.find(t=>t.id===viewingReport.template_type);
                        if(tmpl){setSelectedTemplate(tmpl);setSections(tmpl.sections.map(s=>s.id));setCompetitors((viewingReport.competitors||"").split(",").filter(Boolean));setYearFrom(viewingReport.year_from||"");setYearTo(viewingReport.year_to||"");setCustomInstructions(viewingReport.custom_instructions||"");setReportTitle(viewingReport.title||"");reportTitleRef.current=viewingReport.title||"";setViewingReport(null);router.push("/reports?tab=generate",{scroll:false});setPendingGenerate(true);}
                      }} className="w-8 h-8 flex items-center justify-center rounded-lg border border-amber-300 text-amber-500 hover:bg-amber-50 transition" title="Refresh">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
                      </button>
                      {/* Edit */}
                      <button onClick={()=>router.push(`/reports/editor?id=${viewingReport.id}`)} className="w-8 h-8 flex items-center justify-center rounded-lg border border-main text-muted hover:text-main hover:bg-surface2 transition" title="Edit">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      {/* Showcase */}
                      <button onClick={()=>generateShowcaseFromReport()} disabled={generatingShowcase} className="h-8 px-3 flex items-center gap-1.5 rounded-lg text-white text-xs font-semibold hover:opacity-90 disabled:opacity-50 transition" style={{background:"#1D9A42"}} title="Generate Showcase">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                        {generatingShowcase?"...":"Showcase"}
                      </button>
                    </>}
                  </div>
                </div>
                {/* Row 2: Metadata */}
                <div className="flex items-center gap-2 text-[10px] text-hint mt-1 ml-8 flex-wrap">
                  {viewingReport?.template_type&&<span className={`px-1.5 py-0.5 rounded font-semibold ${BADGE[viewingReport.scope]||"bg-surface2 text-hint"}`}>{TEMPLATES.find(t=>t.id===viewingReport.template_type)?.label||""}</span>}
                  {viewingReport?.year_from && viewingReport?.year_to && <span>{viewingReport.year_from}–{viewingReport.year_to}</span>}
                  {viewingReport?.created_at && <span>{new Date(viewingReport.created_at).toLocaleDateString("en-GB",{day:"numeric",month:"short"})} {new Date(viewingReport.created_at).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})}</span>}
                  {viewingReport?.competitors && <span className="truncate max-w-[300px]" title={viewingReport.competitors}>{viewingReport.competitors}</span>}
                </div>
              </div>
              <div className="flex">
                <div className="flex-1 px-8 py-6" ref={reportRef} data-report-content>
                  <div data-report-content>{renderContent(activeContent)}</div>
                  <Signature/>
                </div>

                {/* Comments sidebar */}
                {comments.length > 0 && (
                  <div className="w-[260px] flex-shrink-0 border-l border-main p-3 space-y-2 overflow-y-auto sticky top-[90px] self-start" style={{maxHeight:"calc(100vh - 110px)"}}>
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

                  {/* SECTIONS — editable + reorderable */}
                  <div className="bg-surface rounded-lg border border-main p-4 mb-3">
                    <h3 className="text-sm font-semibold text-main mb-2">Sections</h3>
                    <div className="space-y-1">
                      {sections.map((secId,si)=>{
                        const tmplSec=selectedTemplate.sections.find(s=>s.id===secId);
                        if(!tmplSec)return null;
                        const ov=sectionOverrides[secId]||{};
                        const label=ov.label||tmplSec.label;
                        const desc=ov.desc||tmplSec.desc;
                        return(
                          <div key={secId} className="flex items-start gap-2 bg-surface2 rounded-lg p-2 group">
                            <input type="checkbox" checked={true} onChange={()=>setSections(prev=>prev.filter(x=>x!==secId))} className="mt-1.5 flex-shrink-0"/>
                            <div className="flex-1 min-w-0">
                              <input value={label} onChange={e=>setSectionOverrides(prev=>({...prev,[secId]:{...prev[secId],label:e.target.value}}))}
                                className="text-sm font-medium text-main bg-transparent w-full focus:outline-none focus:bg-surface px-1 rounded"/>
                              <input value={desc} onChange={e=>setSectionOverrides(prev=>({...prev,[secId]:{...prev[secId],desc:e.target.value}}))}
                                className="text-xs text-hint bg-transparent w-full focus:outline-none focus:bg-surface px-1 rounded mt-0.5"/>
                            </div>
                            <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition flex-shrink-0">
                              {si>0&&<button onClick={()=>setSections(prev=>{const n=[...prev];[n[si-1],n[si]]=[n[si],n[si-1]];return n;})} className="text-[10px] text-muted hover:text-main">↑</button>}
                              {si<sections.length-1&&<button onClick={()=>setSections(prev=>{const n=[...prev];[n[si],n[si+1]]=[n[si+1],n[si]];return n;})} className="text-[10px] text-muted hover:text-main">↓</button>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {/* Unchecked sections */}
                    {selectedTemplate.sections.filter(s=>!sections.includes(s.id)).map(s=>(
                      <label key={s.id} className="flex items-start gap-2 mt-1.5 cursor-pointer opacity-50 hover:opacity-80 transition px-2">
                        <input type="checkbox" checked={false} onChange={()=>setSections(prev=>[...prev,s.id])} className="mt-0.5"/>
                        <div><div className="text-sm font-medium text-main">{sectionOverrides[s.id]?.label||s.label}</div><div className="text-xs text-hint">{sectionOverrides[s.id]?.desc||s.desc}</div></div>
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
        <div className="fixed right-0 w-[390px] bg-surface border-l border-main z-40 flex flex-col" style={{boxShadow:"-2px 0 12px rgba(0,0,0,0.05)",top:"var(--nav-h, 41px)",height:"calc(100vh - var(--nav-h, 41px))"}}>
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
