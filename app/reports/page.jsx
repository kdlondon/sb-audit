"use client";
import { useState, useEffect, useRef } from "react";
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
};

const BADGE={local:"bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",global:"bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200"};

// ── CITATION RENDERER ─────────────────────────────────────────────────────────
// Replaces [ENTRY:id] tokens in markdown with clickable citation chips
function renderWithCitations(content, allData, onCiteClick) {
  if (!content) return content;
  return content.replace(/\[ENTRY:([^\]]+)\]/g, (match, id) => {
    const entry = allData.find(e => e.id === id);
    const label = entry ? (entry.description || entry.competitor || entry.brand || id).slice(0, 35) : id;
    return `<cite-entry data-id="${id}" data-label="${label.replace(/"/g, '&quot;')}"></cite-entry>`;
  });
}

// Custom markdown component that handles citation chips
function ReportContent({ content, allData, onCiteClick, reportRef }) {
  useEffect(() => {
    if (!reportRef.current) return;
    const chips = reportRef.current.querySelectorAll("cite-entry");
    chips.forEach(chip => {
      const id = chip.getAttribute("data-id");
      const label = chip.getAttribute("data-label");
      chip.innerHTML = `<button class="cite-chip" data-id="${id}" style="display:inline-flex;align-items:center;gap:3px;background:var(--accent-soft);border:1px solid var(--accent);color:var(--accent);border-radius:4px;padding:0 6px;font-size:10px;font-weight:600;cursor:pointer;vertical-align:middle;margin:0 2px;line-height:1.8;">↗ ${label}</button>`;
      chip.querySelector("button").addEventListener("click", () => {
        const entry = allData.find(e => e.id === id);
        if (entry) onCiteClick(entry);
      });
    });
  }, [content, allData]);

  // Pre-process citations out of the raw markdown before rendering
  const processed = content ? content.replace(/\[ENTRY:([^\]]+)\]/g, (match, id) => {
    const entry = allData.find(e => e.id === id);
    const label = entry ? (entry.description || entry.competitor || entry.brand || id).slice(0, 35) : id;
    return `<cite-chip id="${id}">${label}</cite-chip>`;
  }) : "";

  return (
    <div ref={reportRef}>
      <article
        className="prose prose-sm md:prose-base max-w-none dark:prose-invert prose-headings:text-[var(--text)] prose-p:text-[var(--text2)] prose-strong:text-[var(--text)] prose-li:text-[var(--text2)] prose-h2:border-b prose-h2:border-[var(--border)] prose-h2:pb-2 prose-h2:mt-8 prose-h3:mt-6 prose-table:text-sm prose-th:bg-[var(--surface2)] prose-th:px-3 prose-th:py-2 prose-td:px-3 prose-td:py-2 prose-td:border-[var(--border)]"
        dangerouslySetInnerHTML={{ __html: renderMarkdownWithCitations(content, allData, onCiteClick) }}
      />
    </div>
  );
}

// Simple markdown-to-html + citations (uses react-markdown indirectly via a wrapper)
function CitationMarkdown({ content, allData, onCiteClick, containerRef }) {
  const divRef = useRef(null);
  const combinedRef = (el) => { divRef.current = el; if (containerRef) containerRef.current = el; };

  useEffect(() => {
    if (!divRef.current) return;
    divRef.current.querySelectorAll(".cite-chip-btn").forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute("data-id");
        const entry = allData.find(e => e.id === id);
        if (entry) onCiteClick(entry);
      };
    });
  });

  // Split content on [ENTRY:id] tokens and build mixed React tree
  const parts = [];
  const regex = /\[ENTRY:([^\]]+)\]/g;
  let last = 0, match;
  const segments = [];
  while ((match = regex.exec(content || "")) !== null) {
    segments.push({ text: content.slice(last, match.index), id: match[1] });
    last = match.index + match[0].length;
  }
  segments.push({ text: content ? content.slice(last) : "", id: null });

  return (
    <div ref={combinedRef}>
      {segments.map((seg, i) => (
        <span key={i}>
          {seg.text && (
            <Markdown remarkPlugins={[remarkGfm]}
              components={{
                // keep default rendering
              }}
            >{seg.text}</Markdown>
          )}
          {seg.id && (() => {
            const entry = allData.find(e => e.id === seg.id);
            const label = entry ? (entry.description || entry.competitor || entry.brand || seg.id).slice(0, 40) : seg.id;
            return (
              <button
                key={`cite-${i}`}
                data-id={seg.id}
                className="cite-chip-btn"
                onClick={() => { const e = allData.find(x => x.id === seg.id); if (e) onCiteClick(e); }}
                style={{display:"inline-flex",alignItems:"center",gap:3,background:"var(--accent-soft)",border:"1px solid var(--accent)",color:"var(--accent)",borderRadius:4,padding:"0 6px",fontSize:10,fontWeight:600,cursor:"pointer",verticalAlign:"middle",margin:"0 2px",lineHeight:1.8}}
              >
                ↗ {label}
              </button>
            );
          })()}
        </span>
      ))}
    </div>
  );
}

// ── ENTRY VIEWER ──────────────────────────────────────────────────────────────
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
  const[view,setView]=useState("generate");
  const[selectedTemplate,setSelectedTemplate]=useState(null);
  const[localData,setLocalData]=useState([]);
  const[globalData,setGlobalData]=useState([]);
  const[allYears,setAllYears]=useState([]);
  const[yearFrom,setYearFrom]=useState("");
  const[yearTo,setYearTo]=useState("");
  const[OPTIONS,setOPTIONS]=useState(STATIC_OPTIONS);
  const[loading,setLoading]=useState(true);
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
    if(!selectedTemplate)return;
    setSections(selectedTemplate.sections.map(s=>s.id));
    setCompetitors([]);setReport("");setViewingReport(null);
  },[selectedTemplate]);

  const currentData=selectedTemplate?.scope==="local"?localData:globalData;
  const filteredData=currentData.filter(e=>{
    const brand=e.competitor||e.brand||"";
    const matchBrand=competitors.length===0||competitors.includes(brand);
    const matchYear=(!yearFrom||!e.year||e.year>=yearFrom)&&(!yearTo||!e.year||e.year<=yearTo);
    return matchBrand&&matchYear;
  });
  const availableBrands=selectedTemplate?.scope==="local"
    ?[...new Set(localData.map(e=>e.competitor).filter(Boolean))].sort()
    :[...new Set(globalData.map(e=>e.brand).filter(Boolean))].sort();
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

  const saveReport=async()=>{
    if(!report)return;setSaving(true);
    const{data:{session}}=await supabase.auth.getSession();
    const title=reportTitle||`${selectedTemplate?.label} — ${new Date().toLocaleDateString()}`;
    await supabase.from("saved_reports").insert({
      id:String(Date.now()),title,
      scope:selectedTemplate?.scope||"local",
      template_type:selectedTemplate?.id||"",
      sections:sections.join(","),
      competitors:competitors.join(","),
      custom_instructions:customInstructions,
      year_from:yearFrom,year_to:yearTo,
      content:report,
      created_by:session?.user?.email||"",
      project_id:projectId,
    });
    const{data:reports}=await supabase.from("saved_reports").select("*").eq("project_id",projectId).order("created_at",{ascending:false});
    setSavedReports(reports||[]);setSaving(false);
  };

  const deleteReport=async(id)=>{
    if(!confirm("Delete this report?"))return;
    await supabase.from("saved_reports").delete().eq("id",id);
    const{data:reports}=await supabase.from("saved_reports").select("*").eq("project_id",projectId).order("created_at",{ascending:false});
    setSavedReports(reports||[]);
    if(viewingReport?.id===id)setViewingReport(null);
  };

  const searchResults=searchQuery.length>1?allData.filter(e=>{const q=searchQuery.toLowerCase();return(e.description||"").toLowerCase().includes(q)||(e.competitor||"").toLowerCase().includes(q)||(e.brand||"").toLowerCase().includes(q)||(e.main_slogan||"").toLowerCase().includes(q);}).slice(0,10):[];

  const generate=async()=>{
    if(!selectedTemplate)return;
    setGenerating(true);setReport("");setViewingReport(null);
    const timeRange=yearFrom&&yearTo?` (${yearFrom}–${yearTo})`:"";
    const sectionNames=sections.map(id=>selectedTemplate.sections.find(s=>s.id===id)?.label).filter(Boolean).join(", ");

    // Build data string with IDs for citations
    const dataStr=filteredData.map(e=>`[ID:${e.id}] [${e.competitor||e.brand}${e.year?" "+e.year:""}] ${e.description||""} | Portrait:${e.portrait||""} | Door:${e.entry_door||""} | Phase:${e.journey_phase||""} | Lifecycle:${e.client_lifecycle||""} | Tone:${e.tone_of_voice||""} | Role:${e.bank_role||""} | Lang:${e.language_register||""} | Pain:${e.pain_point_type||""} | Archetype:${e.brand_archetype||""} | Territory:${e.primary_territory||""} | SecTerritory:${e.secondary_territory||""} | Execution:${e.execution_style||""} | Size:${e.business_size||""} | Moment_Acq:${e.moment_acquisition||""} | Moment_Deep:${e.moment_deepening||""} | Moment_Unexp:${e.moment_unexpected||""} | Richness:${e.richness_definition||""} | Diff:${e.diff_claim||""} | Insight:${(e.insight||"").slice(0,120)} | Synopsis:${(e.synopsis||"").slice(0,120)}`).join("\n");

    const system=SYSTEM_PROMPTS[selectedTemplate.id];
    const userMsg=`Audit data${timeRange} — ${filteredData.length} pieces:\n${dataStr}\n\nGenerate the following sections: ${sectionNames}\n\n${customInstructions?`Additional instructions: ${customInstructions}`:""}\n\nIMPORTANT — CITATION RULE: Every entry starts with [ID:xxxxxxxxxxxxxxx]. Use that EXACT full ID when citing: [ENTRY:xxxxxxxxxxxxxxx]. NEVER shorten or invent IDs. Place citation immediately after the piece name inline.\n\nUse markdown with ## headers, tables, and **bold** key findings. Be analytical and conclusive, not descriptive.`;
    try{
      const res=await fetch("/api/ai",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({use_opus:true,max_tokens:8000,system,messages:[{role:"user",content:userMsg}]})});
      const result=await res.json();
      if(result.error)setReport("Error: "+result.error);
      else setReport(result.content?.map(c=>c.text||"").join("")||"No content.");
    }catch(err){setReport("Error: "+err.message);}
    setGenerating(false);
  };

  if(loading)return <div className="p-10 text-center text-hint">Loading...</div>;
  const activeContent=viewingReport?.content||report;

  const Signature=()=>(<div className="mt-10 pt-6 border-t border-main text-center"><img src="/knots-dots-logo.png" alt="Knots & Dots" style={{height:24,margin:"0 auto 8px"}}/><p className="text-[10px] text-hint">Generated by Knots & Dots — Category Landscape Platform</p><p className="text-[9px] text-hint mt-0.5">{new Date().toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"})}</p></div>);

  const renderContent = (rawContent) => {
    if (!rawContent) return null;
    // Replace [ENTRY:id] with a special marker that survives markdown rendering
    // We use a data attribute approach via dangerouslySetInnerHTML after markdown
    const withLinks = rawContent.replace(/\[ENTRY:([^\]]+)\]/g, (match, id) => {
      const entry = allData.find(e => e.id === id);
      const label = entry ? (entry.description || entry.competitor || entry.brand || id).slice(0, 50) : id;
      return `__CITE_START__${id}__CITE_MID__${label}__CITE_END__`;
    });

    // Split on cite markers and render as React tree
    const segments = withLinks.split(/(__CITE_START__[^_]+__CITE_MID__[^_]+__CITE_END__)/);
    const proseClass = "prose prose-sm md:prose-base max-w-none dark:prose-invert prose-headings:text-[var(--text)] prose-p:text-[var(--text2)] prose-strong:text-[var(--text)] prose-li:text-[var(--text2)] prose-h2:border-b prose-h2:border-[var(--border)] prose-h2:pb-2 prose-h2:mt-8 prose-h3:mt-6 prose-table:text-sm prose-th:bg-[var(--surface2)] prose-th:px-3 prose-th:py-2 prose-td:px-3 prose-td:py-2 prose-td:border-[var(--border)]";

    return (
      <div>
        {segments.map((seg, i) => {
          const citeMatch = seg.match(/^__CITE_START__([^_]+)__CITE_MID__(.+)__CITE_END__$/);
          if (citeMatch) {
            const id = citeMatch[1];
            const label = citeMatch[2];
            const entry = allData.find(e => e.id === id);
            return (
              <span key={i}
                onClick={() => handleCiteClick(entry || {id, description: label})}
                style={{color:"var(--accent)",textDecoration:"underline",textDecorationStyle:"dotted",cursor:"pointer",textUnderlineOffset:"3px",fontSize:"inherit"}}
              >{label}</span>
            );
          }
          return seg ? <Markdown key={i} remarkPlugins={[remarkGfm]} className={proseClass}>{seg}</Markdown> : null;
        })}
      </div>
    );
  };

  return(
    <div className="min-h-screen" style={{background:"var(--bg)"}}>

      {/* TOP BAR */}
      <div className="bg-surface border-b border-main px-5 py-3 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-bold text-main">Reports</h2>
          <div className="flex bg-surface2 rounded-lg p-0.5">
            <button onClick={()=>{setView("generate");setViewingReport(null);}} className={`px-3 py-1 rounded-md text-xs font-medium transition ${view==="generate"?"bg-surface text-accent shadow-sm":"text-muted"}`}>Generate</button>
            <button onClick={()=>setView("archive")} className={`px-3 py-1 rounded-md text-xs font-medium transition ${view==="archive"?"bg-surface text-accent shadow-sm":"text-muted"}`}>Archive ({savedReports.length})</button>
          </div>
        </div>
        {activeContent&&<button onClick={()=>setViewerOpen(!viewerOpen)} className={`px-3 py-1.5 text-xs rounded-lg font-medium border transition ${viewerOpen?"bg-accent-soft border-[var(--accent)] text-accent":"border-main text-muted hover:bg-surface2"}`}>{viewerOpen?"Hide entries":"Search entries"}</button>}
      </div>

      {/* ARCHIVE */}
      {view==="archive"&&!viewingReport&&(
        <div className="p-5 max-w-4xl">
          {savedReports.length===0
            ?<div className="text-center text-hint py-20">No saved reports yet.</div>
            :<div className="space-y-2">{savedReports.map(r=>(
              <div key={r.id} className="bg-surface border border-main rounded-lg p-4 flex justify-between items-center hover:border-[var(--accent)] transition cursor-pointer" onClick={()=>{setViewingReport(r);setView("generate");}}>
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
                <button onClick={ev=>{ev.stopPropagation();deleteReport(r.id);}} className="text-hint hover:text-red-400 text-sm px-2">×</button>
              </div>
            ))}</div>
          }
        </div>
      )}

      {/* GENERATE / VIEW */}
      {(view==="generate"||viewingReport)&&(
        <div className="p-5 max-w-4xl" style={{marginRight:viewerOpen?390:0,transition:"margin 0.15s"}}>

          {/* REPORT CONTENT */}
          {activeContent&&(
            <div className="bg-surface rounded-lg border border-main overflow-hidden">
              <div className="flex justify-between items-center px-5 py-3 border-b border-main flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <button onClick={()=>{setViewingReport(null);setReport("");setSelectedTemplate(null);}} className="text-xs text-muted hover:text-main">← Back</button>
                  <h3 className="text-sm font-semibold text-main">{viewingReport?.title||reportTitle||"Generated report"}</h3>
                </div>
                <div className="flex gap-2">
                  {report&&!viewingReport&&<button onClick={saveReport} disabled={saving} className="px-3 py-1 text-xs bg-accent text-white rounded-lg font-semibold hover:opacity-90 disabled:opacity-50">{saving?"Saving...":"Save report"}</button>}
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
                    <div className="flex gap-2 flex-wrap">
                      {availableBrands.map(c=>(
                        <button key={c} onClick={()=>toggleComp(c)} className={`px-3 py-1 rounded-full text-xs font-medium border transition ${competitors.includes(c)?"bg-accent-soft border-[var(--accent)] text-accent":"bg-surface border-main text-hint hover:border-[var(--accent)]"}`}>{c}</button>
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
        </div>
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

export default function ReportsPage(){return <AuthGuard><ProjectGuard><Nav/><ReportsContent/></ProjectGuard></AuthGuard>;}
