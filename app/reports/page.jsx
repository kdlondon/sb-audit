"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { STATIC_OPTIONS, fetchOptions, COMPETITOR_COLORS } from "@/lib/options";
import AuthGuard from "@/components/AuthGuard";
import Nav from "@/components/Nav";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

function ytId(u){if(!u)return null;const m=u.match(/(?:youtube\.com\/watch\?.*v=|youtu\.be\/)([^&\s]+)/);return m?m[1]:null;}
function Tag({v}){return <span style={{background:COMPETITOR_COLORS[v]||"#888",color:"#fff",padding:"1px 6px",borderRadius:3,fontSize:11,fontWeight:600}}>{v}</span>;}

const LOCAL_SECTIONS=[{id:"landscape",label:"Category landscape & perception",desc:"How business banking is entered and experienced, the retail lens problem, the differentiation void"},{id:"frameworks",label:"Audit findings mapped to frameworks",desc:"Findings mapped against entry doors, portraits, and journey phases"},{id:"audiences",label:"Who are competitors talking to?",desc:"Implied audiences by portrait type, lifecycle stage, and business size"},{id:"experiences",label:"Which experiences are they responding to?",desc:"Pain points, moments, and emotional territories addressed"},{id:"moments",label:"Does anyone own a journey moment?",desc:"Acquisition, deepening, and unexpected moments in competitive comms"},{id:"whitespace",label:"Where is the white space?",desc:"Gaps no competitor is filling"}];
const GLOBAL_SECTIONS=[{id:"territories",label:"Creative territories & themes",desc:"Primary and secondary territories across global benchmarks"},{id:"execution",label:"Execution styles & patterns",desc:"How global brands execute their positioning"},{id:"archetypes",label:"Brand archetypes & roles",desc:"Which archetypes dominate and what roles brands play"},{id:"insights",label:"Insights & ideas mapping",desc:"Human truths and creative concepts"},{id:"inspiration",label:"Transferable inspiration",desc:"What Scotiabank could learn from global examples"}];

function EntryViewer({entry,onClose}){
  if(!entry)return null;const e=entry;
  return(<div className="h-full flex flex-col">
    <div className="p-3 border-b border-main flex justify-between items-center flex-shrink-0"><b className="text-sm text-main truncate">{e.description||e.competitor||e.brand}</b><span onClick={onClose} className="cursor-pointer text-lg text-hint hover:text-main ml-2">×</span></div>
    <div className="flex-1 overflow-auto">
      {ytId(e.url)&&<div className="px-3 pt-2"><iframe width="100%" height="180" src={`https://www.youtube.com/embed/${ytId(e.url)}`} frameBorder="0" allowFullScreen className="rounded-md"/></div>}
      {e.image_url&&!ytId(e.url)&&<div className="px-3 pt-2"><img src={e.image_url} className="w-full rounded-md"/></div>}
      {e.url&&!ytId(e.url)&&!e.image_url&&<div className="px-3 pt-1"><a href={e.url} target="_blank" className="text-[11px] text-accent break-all">{e.url}</a></div>}
      <div className="p-3">
        <div className="flex gap-1 flex-wrap mb-2">{e.competitor&&<Tag v={e.competitor}/>}{e.brand&&<span className="text-xs font-semibold text-main bg-surface2 px-1.5 py-0.5 rounded">{e.brand}</span>}{e.category&&<Tag v={e.category}/>}{e.year&&<span className="bg-surface2 px-1.5 py-0.5 rounded text-[11px] text-main">{e.year}</span>}{e.rating&&<span className="text-[11px]">{"★".repeat(Number(e.rating))}</span>}</div>
        {[["Portrait",e.portrait],["Phase",e.journey_phase],["Door",e.entry_door],["Role",e.bank_role],["Archetype",e.brand_archetype],["Tone",e.tone_of_voice],["Territory",e.primary_territory],["Execution",e.execution_style],["Slogan",e.main_slogan]].filter(([,v])=>v&&v!==""&&!v.startsWith("Not ")&&!v.startsWith("None")).map(([l,v])=>(<div key={l} className="text-xs mb-0.5"><span className="text-muted">{l}:</span> <span className="text-main">{v}</span></div>))}
      </div>
      {e.synopsis&&<div className="px-3 pb-2"><div className="text-[10px] font-semibold text-hint uppercase mb-1">Synopsis</div><div className="text-xs leading-relaxed bg-surface2 p-2 rounded text-main">{e.synopsis}</div></div>}
      {e.insight&&<div className="px-3 pb-2"><div className="text-[10px] font-semibold text-hint uppercase mb-1">Insight</div><div className="text-xs leading-relaxed bg-surface2 p-2 rounded text-main">{e.insight}</div></div>}
      {e.transcript&&<div className="px-3 pb-2"><div className="text-[10px] font-semibold text-hint uppercase mb-1">Transcript</div><div className="text-xs leading-relaxed bg-surface2 p-2 rounded max-h-[120px] overflow-auto whitespace-pre-wrap text-main">{e.transcript}</div></div>}
    </div>
  </div>);
}

function ReportsContent(){
  const[scope,setScope]=useState("local");const[localData,setLocalData]=useState([]);const[globalData,setGlobalData]=useState([]);const[OPTIONS,setOPTIONS]=useState(STATIC_OPTIONS);const[loading,setLoading]=useState(true);const[competitors,setCompetitors]=useState([]);const[sections,setSections]=useState(LOCAL_SECTIONS.map(s=>s.id));const[customInstructions,setCustomInstructions]=useState("");const[report,setReport]=useState("");const[generating,setGenerating]=useState(false);const[copied,setCopied]=useState(false);const[viewerOpen,setViewerOpen]=useState(false);const[viewerEntry,setViewerEntry]=useState(null);const[searchQuery,setSearchQuery]=useState("");

  useEffect(()=>{(async()=>{const supabase=createClient();const[{data:local},{data:global}]=await Promise.all([supabase.from("audit_entries").select("*"),supabase.from("audit_global").select("*")]);setLocalData(local||[]);setGlobalData(global||[]);const opts=await fetchOptions();setOPTIONS(opts);setLoading(false);})();},[]);
  useEffect(()=>{setSections(scope==="global"?GLOBAL_SECTIONS.map(s=>s.id):LOCAL_SECTIONS.map(s=>s.id));setCompetitors([]);setReport("");},[scope]);

  const currentSections=scope==="global"?GLOBAL_SECTIONS:LOCAL_SECTIONS;
  const currentData=scope==="local"?localData:scope==="global"?globalData:[...localData,...globalData];
  const filteredData=competitors.length>0?currentData.filter(e=>competitors.includes(e.competitor||e.brand)):currentData;
  const allData=[...localData,...globalData];
  const availableBrands=scope==="local"?[...new Set(localData.map(e=>e.competitor).filter(Boolean))]:[...new Set(globalData.map(e=>e.brand).filter(Boolean))];
  const toggleComp=(c)=>setCompetitors(prev=>prev.includes(c)?prev.filter(x=>x!==c):[...prev,c]);
  const toggleSec=(id)=>setSections(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id]);
  const copyReport=()=>{navigator.clipboard.writeText(report);setCopied(true);setTimeout(()=>setCopied(false),2000);};
  const downloadMD=()=>{const blob=new Blob([report],{type:"text/markdown"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`report_${scope}.md`;document.body.appendChild(a);a.click();document.body.removeChild(a);};
  const searchResults=searchQuery.length>1?allData.filter(e=>{const q=searchQuery.toLowerCase();return(e.description||"").toLowerCase().includes(q)||(e.competitor||"").toLowerCase().includes(q)||(e.brand||"").toLowerCase().includes(q)||(e.main_slogan||"").toLowerCase().includes(q);}).slice(0,10):[];

  const generate=async()=>{
    setGenerating(true);setReport("");
    const dataStr=filteredData.map(e=>`[${e.competitor||e.brand}] ${e.description||""} | Portrait:${e.portrait||""} | Door:${e.entry_door||""} | Phase:${e.journey_phase||""} | Tone:${e.tone_of_voice||""} | Role:${e.bank_role||""} | Lang:${e.language_register||""} | Pain:${e.pain_point_type||""} | Archetype:${e.brand_archetype||""} | Territory:${e.primary_territory||""} | Execution:${e.execution_style||""} | Insight:${(e.insight||"").slice(0,100)} | Synopsis:${(e.synopsis||"").slice(0,100)}`).join("\n");
    const sectionNames=sections.map(id=>currentSections.find(s=>s.id===id)?.label).filter(Boolean).join(", ");
    const scopeCtx=scope==="local"?"analyzing Canadian business banking competitive communications for Scotiabank":scope==="global"?"analyzing global creative benchmarks for Scotiabank business banking":"analyzing both local and global data for Scotiabank business banking";
    try{
      const res=await fetch("/api/ai",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({use_opus:true,max_tokens:6000,system:`You are a world-class brand strategist ${scopeCtx}. Write with authority. Reference specific brands and data. Use ## for sections, ### for subsections, **bold** for key findings, bullet points for evidence. Use markdown tables where comparison data is appropriate. Be conclusive.`,messages:[{role:"user",content:`Audit data (${filteredData.length} pieces):\n${dataStr}\n\nReport sections: ${sectionNames}\n\n${customInstructions?`Instructions: ${customInstructions}`:""}\n\nUse proper markdown with tables where useful.`}]})});
      const result=await res.json();
      if(result.error)setReport("Error: "+result.error);
      else setReport(result.content?.map(c=>c.text||"").join("")||"No content.");
    }catch(err){setReport("Error: "+err.message);}
    setGenerating(false);
  };

  if(loading)return <div className="p-10 text-center text-hint">Loading...</div>;

  return(
    <div className="min-h-screen" style={{background:"var(--bg)"}}>
      <div className="bg-surface border-b border-main px-5 py-3"><h2 className="text-lg font-bold text-main">AI reports</h2><p className="text-xs text-muted">Powered by Claude Opus</p></div>
      <div className="p-5 max-w-4xl" style={{marginRight:viewerOpen?390:0,transition:"margin 0.15s"}}>
        <div className="bg-surface rounded-lg border border-main p-4 mb-3"><h3 className="text-sm font-semibold text-main mb-2">Report scope</h3><div className="flex gap-2">{[["local","Local"],["global","Global"],["combined","Combined"]].map(([k,l])=>(<button key={k} onClick={()=>setScope(k)} className={`px-4 py-1.5 rounded-lg text-xs font-medium border transition ${scope===k?"bg-accent-soft border-[var(--accent)] text-accent":"bg-surface border-main text-muted"}`}>{l}</button>))}</div></div>
        <div className="bg-surface rounded-lg border border-main p-4 mb-3"><h3 className="text-sm font-semibold text-main mb-2">Brands</h3><div className="flex gap-2 flex-wrap">{availableBrands.map(c=>(<button key={c} onClick={()=>toggleComp(c)} className={`px-3 py-1 rounded-full text-xs font-medium border transition ${competitors.includes(c)||competitors.length===0?"bg-accent-soft border-[var(--accent)] text-accent":"bg-surface border-main text-hint"}`}>{c}</button>))}</div><p className="text-[10px] text-hint mt-1">{competitors.length===0?"All":""+competitors.length} — {filteredData.length} entries</p></div>
        <div className="bg-surface rounded-lg border border-main p-4 mb-3"><h3 className="text-sm font-semibold text-main mb-2">Sections</h3>{currentSections.map(s=>(<label key={s.id} className="flex items-start gap-2 mb-2 cursor-pointer"><input type="checkbox" checked={sections.includes(s.id)} onChange={()=>toggleSec(s.id)} className="mt-0.5"/><div><div className="text-sm font-medium text-main">{s.label}</div><div className="text-xs text-hint">{s.desc}</div></div></label>))}</div>
        <div className="bg-surface rounded-lg border border-main p-4 mb-3"><h3 className="text-sm font-semibold text-main mb-2">Custom instructions</h3><textarea value={customInstructions} onChange={e=>setCustomInstructions(e.target.value)} placeholder="E.g., Focus on fintechs vs traditional banks..." className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main resize-y" rows={2}/></div>
        <button onClick={generate} disabled={generating||sections.length===0} className="bg-accent text-white px-6 py-2 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 mb-5">{generating?"Generating with Opus...":"Generate report"}</button>

        {report&&(
          <div className="bg-surface rounded-lg border border-main overflow-hidden">
            <div className="flex justify-between items-center px-5 py-3 border-b border-main"><h3 className="text-sm font-semibold text-main">Generated report</h3><div className="flex gap-2"><button onClick={copyReport} className="px-3 py-1 text-xs border border-main rounded-lg text-muted hover:bg-surface2">{copied?"Copied!":"Copy"}</button><button onClick={downloadMD} className="px-3 py-1 text-xs border border-main rounded-lg text-muted hover:bg-surface2">Download .md</button></div></div>
            <div className="px-8 py-6">
              <article className="prose prose-sm md:prose-base max-w-none dark:prose-invert prose-headings:text-[var(--text)] prose-p:text-[var(--text2)] prose-strong:text-[var(--text)] prose-li:text-[var(--text2)] prose-h2:border-b prose-h2:border-[var(--border)] prose-h2:pb-2 prose-h2:mt-8 prose-h3:mt-6 prose-table:text-sm prose-th:bg-[var(--surface2)] prose-th:px-3 prose-th:py-2 prose-td:px-3 prose-td:py-2 prose-td:border-[var(--border)]">
                <Markdown remarkPlugins={[remarkGfm]}>{report}</Markdown>
              </article>
            </div>
          </div>
        )}
      </div>

      {/* Floating search FAB */}
      {report&&!viewerOpen&&(
        <button onClick={()=>setViewerOpen(true)} className="fixed bottom-6 right-6 bg-accent text-white w-12 h-12 rounded-full shadow-lg flex items-center justify-center hover:opacity-90 z-50" title="Search entries">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="9" cy="9" r="6"/><line x1="14" y1="14" x2="18" y2="18"/></svg>
        </button>
      )}

      {/* Floating entry viewer panel */}
      {viewerOpen&&(
        <div className="fixed top-0 right-0 w-[390px] h-screen bg-surface border-l border-main z-50 flex flex-col" style={{boxShadow:"-2px 0 12px rgba(0,0,0,0.05)"}}>
          <div className="p-3 border-b border-main flex-shrink-0">
            <div className="flex justify-between items-center mb-2"><span className="text-xs font-semibold text-main">Search entries</span><span onClick={()=>{setViewerOpen(false);setViewerEntry(null);setSearchQuery("");}} className="cursor-pointer text-hint hover:text-main text-sm">×</span></div>
            <input value={searchQuery} onChange={e=>{setSearchQuery(e.target.value);setViewerEntry(null);}} placeholder="Search by brand, description, slogan..." className="w-full px-3 py-2 bg-surface2 border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[var(--accent)]"/>
          </div>
          {viewerEntry?<EntryViewer entry={viewerEntry} onClose={()=>setViewerEntry(null)}/>:(
            <div className="flex-1 overflow-auto">{searchQuery.length<=1?<div className="p-4 text-center text-hint text-sm">Type to search {allData.length} entries</div>:searchResults.length===0?<div className="p-4 text-center text-hint text-sm">No entries found</div>:<div className="p-2">{searchResults.map(e=>(<button key={e.id} onClick={()=>setViewerEntry(e)} className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-accent-soft transition mb-1"><div className="flex gap-1.5 items-center mb-0.5">{e.competitor&&<Tag v={e.competitor}/>}{e.brand&&<span className="text-[10px] font-semibold text-main bg-surface2 px-1 rounded">{e.brand}</span>}{e.year&&<span className="text-[10px] text-hint">{e.year}</span>}</div><p className="text-xs font-medium text-main truncate">{e.description||"—"}</p></button>))}</div>}</div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ReportsPage(){
  return <AuthGuard><Nav/><ReportsContent/></AuthGuard>;
}
