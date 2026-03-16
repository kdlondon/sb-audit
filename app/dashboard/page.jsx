"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { COMPETITOR_COLORS } from "@/lib/options";
import AuthGuard from "@/components/AuthGuard";
import Nav from "@/components/Nav";
import ProjectGuard from "@/components/ProjectGuard";
import { useProject } from "@/lib/project-context";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, ScatterChart, Scatter, ZAxis, CartesianGrid } from "recharts";

/* ─── PNG DOWNLOAD HELPER ─── */
async function downloadChartAsPNG(element, filename) {
  const html2canvas = (await import("html2canvas")).default;
  const canvas = await html2canvas(element, { scale: 3, backgroundColor: "#ffffff", useCORS: true });
  const link = document.createElement("a");
  link.download = `${filename}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

const COLORS=["#2563eb","#7c3aed","#059669","#dc2626","#0ea5e9","#d97706","#14b8a6","#ec4899","#6366f1","#84cc16","#f97316","#06b6d4"];
const PORTRAIT_COLORS={Dreamer:"#7c3aed",Builder:"#059669",Sovereign:"#d97706",Architect:"#2563eb"};
const DOOR_COLORS={Freedom:"#0ea5e9",Craft:"#059669",Identity:"#d97706","Build to Exit":"#dc2626"};
const PHASE_COLORS={Existential:"#dc2626",Validation:"#d97706",Complexity:"#2563eb",Consolidation:"#059669"};

function count(arr,key){const c={};arr.forEach(e=>{const v=e[key];if(v&&!v.startsWith("Not ")&&!v.startsWith("None")&&v!=="")c[v]=(c[v]||0)+1;});return Object.entries(c).map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value);}

function heatmapData(arr,rowKey,colKey){const rows=new Set();const cols=new Set();const grid={};arr.forEach(e=>{const r=e[rowKey];const c=e[colKey];if(!r||!c||r.startsWith("Not ")||r.startsWith("None")||c.startsWith("Not ")||c.startsWith("None"))return;rows.add(r);cols.add(c);const k=`${r}__${c}`;grid[k]=(grid[k]||0)+1;});return{rows:[...rows],cols:[...cols],grid};}

function Heatmap({data,rowKey,colKey,title,subtitle}){
  const ref=useRef(null);
  const download=()=>{if(ref.current)downloadChartAsPNG(ref.current,title.replace(/\s+/g,"-").toLowerCase());};
  const{rows,cols,grid}=heatmapData(data,rowKey,colKey);if(rows.length===0)return null;const max=Math.max(...Object.values(grid),1);
  return(<div ref={ref} className="bg-surface border border-main rounded-lg p-5 relative group">
    <div className="flex justify-between items-start mb-1">
      <div><h3 className="text-sm font-semibold text-main">{title}</h3>{subtitle&&<p className="text-xs text-muted mt-0.5">{subtitle}</p>}</div>
      <button onClick={download} className="opacity-0 group-hover:opacity-100 transition text-[9px] text-muted hover:text-main px-2 py-1 rounded border border-main hover:bg-surface2" title="Download as PNG">PNG ↓</button>
    </div>
    <div className="overflow-x-auto"><table className="text-xs border-collapse w-full"><thead><tr><th className="px-3 py-2 text-left text-muted font-medium"></th>{cols.map(c=><th key={c} className="px-3 py-2 text-center text-muted font-medium" style={{minWidth:70,fontSize:10}}>{c}</th>)}</tr></thead>
    <tbody>{rows.map(r=>(<tr key={r}><td className="px-3 py-2 text-main font-medium whitespace-nowrap" style={{fontSize:11}}>{r}</td>{cols.map(c=>{const v=grid[`${r}__${c}`]||0;const i=v/max;return(<td key={c} className="px-3 py-2 text-center" style={{background:v>0?`rgba(37,99,235,${0.1+i*0.6})`:"transparent",color:i>0.5?"#fff":"var(--text2)",borderRadius:4,fontSize:11,fontWeight:v>0?600:400}}>{v||"·"}</td>);})}</tr>))}</tbody></table></div>
  </div>);
}

function StatCard({label,value,sub}){return(<div className="bg-surface border border-main rounded-lg p-4"><p className="text-[10px] text-muted uppercase font-semibold tracking-wide">{label}</p><p className="text-2xl font-bold text-main mt-1">{value}</p>{sub&&<p className="text-xs text-hint mt-0.5">{sub}</p>}</div>);}

function ChartCard({title,subtitle,children,height}){
  const ref=useRef(null);
  const download=()=>{if(ref.current)downloadChartAsPNG(ref.current,title.replace(/\s+/g,"-").toLowerCase());};
  return(<div ref={ref} className="bg-surface border border-main rounded-lg p-5 relative group">
    <div className="flex justify-between items-start mb-1">
      <div><h3 className="text-sm font-semibold text-main">{title}</h3>{subtitle&&<p className="text-xs text-muted mt-0.5">{subtitle}</p>}</div>
      <button onClick={download} className="opacity-0 group-hover:opacity-100 transition text-[9px] text-muted hover:text-main px-2 py-1 rounded border border-main hover:bg-surface2" title="Download as PNG">PNG ↓</button>
    </div>
    <div className="mt-3"><ResponsiveContainer width="100%" height={height||280}>{children}</ResponsiveContainer></div>
  </div>);
}

function DownloadableCard({title,children}){
  const ref=useRef(null);
  const download=()=>{if(ref.current)downloadChartAsPNG(ref.current,title.replace(/\s+/g,"-").toLowerCase());};
  return(<div ref={ref} className="bg-surface border border-main rounded-lg p-5 relative group">
    <div className="flex justify-between items-start mb-1">
      <h3 className="text-sm font-semibold text-main">{title}</h3>
      <button onClick={download} className="opacity-0 group-hover:opacity-100 transition text-[9px] text-muted hover:text-main px-2 py-1 rounded border border-main hover:bg-surface2">PNG ↓</button>
    </div>
    {children}
  </div>);
}

function PieCard({title,data}){
  const ref=useRef(null);
  const download=()=>{if(ref.current)downloadChartAsPNG(ref.current,title.replace(/\s+/g,"-").toLowerCase());};
  return(<div ref={ref} className="bg-surface border border-main rounded-lg p-5 relative group">
    <div className="flex justify-between items-start mb-3">
      <h3 className="text-sm font-semibold text-main">{title}</h3>
      <button onClick={download} className="opacity-0 group-hover:opacity-100 transition text-[9px] text-muted hover:text-main px-2 py-1 rounded border border-main hover:bg-surface2">PNG ↓</button>
    </div>
    <ResponsiveContainer width="100%" height={200}><PieChart><Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={75}>{data.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}</Pie><Legend wrapperStyle={{fontSize:11}}/><Tooltip/></PieChart></ResponsiveContainer>
  </div>);
}

const CT=({active,payload})=>{if(!active||!payload?.[0])return null;const d=payload[0].payload;return <div className="bg-surface border border-main rounded-lg px-3 py-2 shadow-lg text-xs"><p className="font-semibold text-main">{d.name}</p><p className="text-muted">{d.value} entries</p></div>;};

function DashboardContent(){
  const[localData,setLocalData]=useState([]);const[globalData,setGlobalData]=useState([]);const[loading,setLoading]=useState(true);const[scope,setScope]=useState("all");
  const[selectedBrands,setSelectedBrands]=useState([]);
  const[brandFilterOpen,setBrandFilterOpen]=useState(false);
  const brandFilterRef=useRef(null);

  const{projectId}=useProject();
  useEffect(()=>{(async()=>{const supabase=createClient();const[{data:local},{data:global}]=await Promise.all([supabase.from("audit_entries").select("*").eq("project_id",projectId),supabase.from("audit_global").select("*").eq("project_id",projectId)]);setLocalData(local||[]);setGlobalData(global||[]);setLoading(false);})();},[projectId]);

  // Close brand filter on outside click
  useEffect(()=>{
    if(!brandFilterOpen)return;
    const handler=(e)=>{if(brandFilterRef.current&&!brandFilterRef.current.contains(e.target))setBrandFilterOpen(false);};
    document.addEventListener("mousedown",handler);
    return()=>document.removeEventListener("mousedown",handler);
  },[brandFilterOpen]);

  if(loading)return <div className="p-10 text-center text-hint">Loading...</div>;

  const scopedData=scope==="local"?localData:scope==="global"?globalData:[...localData,...globalData];
  // All brands for filter
  const allBrands=[...new Set(scopedData.map(e=>e.competitor||e.brand).filter(Boolean))].sort();
  // Apply brand filter
  const data=selectedBrands.length>0?scopedData.filter(e=>{const b=e.competitor||e.brand;return b&&selectedBrands.includes(b);}):scopedData;
  const rated=data.filter(e=>e.rating);const avgRating=rated.length>0?(rated.reduce((s,e)=>s+Number(e.rating),0)/rated.length).toFixed(1):"—";
  const brands=[...new Set(data.map(e=>e.competitor||e.brand).filter(Boolean))];
  const brandCounts=count(data,data.some(e=>e.competitor)?"competitor":"brand");
  const categoryCounts=count(data,"category");
  const portraitCounts=count(data,"portrait");
  const doorCounts=count(data,"entry_door");
  const phaseCounts=count(data,"journey_phase");
  const toneCounts=count(data,"tone_of_voice");
  const archetypeCounts=count(data,"brand_archetype");
  const languageCounts=count(data,"language_register");
  const executionCounts=count(data,"execution_style");
  const intentCounts=count(data,"communication_intent");
  const INTENT_COLORS={Brand:"#0019FF",Product:"#059669",Innovation:"#d97706"};
  // Intent by brand — normalized percentages
  const intentByBrand={};data.forEach(e=>{const b=e.competitor||e.brand;const intent=e.communication_intent;if(!b||!intent)return;if(!intentByBrand[b])intentByBrand[b]={Brand:0,Product:0,Innovation:0,total:0};intentByBrand[b][intent]=(intentByBrand[b][intent]||0)+1;intentByBrand[b].total++;});
  const intentNormalized=Object.entries(intentByBrand).map(([name,d])=>({name,Brand:Math.round((d.Brand/d.total)*100),Product:Math.round((d.Product/d.total)*100),Innovation:Math.round((d.Innovation/d.total)*100),total:d.total})).sort((a,b)=>b.total-a.total);

  const ratingByBrand={};data.forEach(e=>{const b=e.competitor||e.brand;if(!b||!e.rating)return;if(!ratingByBrand[b])ratingByBrand[b]={total:0,count:0};ratingByBrand[b].total+=Number(e.rating);ratingByBrand[b].count++;});
  const ratingData=Object.entries(ratingByBrand).map(([name,{total,count:c}])=>({name,value:Math.round((total/c)*10)/10})).sort((a,b)=>b.value-a.value);

  const positionData=[];brands.forEach(b=>{const entries=data.filter(e=>(e.competitor||e.brand)===b);if(!entries.length)return;const ol=entries.filter(e=>e.language_register==="Owner language").length;const bl=entries.filter(e=>e.language_register==="Banking language").length;const asp=entries.filter(e=>e.pain_point_type==="Aspiration territory").length;const prod=entries.filter(e=>e.pain_point_type==="Product-focused only").length;const t=entries.length;positionData.push({name:b,x:t>0?Math.round(((ol-bl)/t)*100):0,y:t>0?Math.round(((asp-prod)/t)*100):0,z:t});});

  return(
    <div className="min-h-screen" style={{background:"var(--bg)"}}>
      <div className="section-bar px-5 py-3 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-bold text-main">Dashboard</h2>
          <div className="flex bg-surface2 rounded-lg p-0.5">{[["all","All"],["local","Local"],["global","Global"]].map(([k,l])=>(<button key={k} onClick={()=>setScope(k)} className={`px-3 py-1 rounded-md text-xs font-medium transition ${scope===k?"bg-surface text-accent shadow-sm":"text-muted"}`}>{l}</button>))}</div>
        </div>
        <div className="flex items-center gap-3">
          {/* Brand filter */}
          <div className="relative" ref={brandFilterRef}>
            <button onClick={()=>setBrandFilterOpen(!brandFilterOpen)}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium border transition flex items-center gap-1.5 ${selectedBrands.length>0?"border-[var(--accent)] bg-accent-soft text-accent":"border-main text-muted hover:text-main"}`}>
              {selectedBrands.length>0?`${selectedBrands.length} brand${selectedBrands.length>1?"s":""}  selected`:"All brands"}
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" className={`transition ${brandFilterOpen?"rotate-180":""}`}><path d="M2 4l3 3 3-3"/></svg>
            </button>
            {brandFilterOpen&&(
              <div className="absolute right-0 top-full mt-2 w-56 bg-surface border border-main rounded-xl shadow-xl py-2 max-h-[300px] overflow-y-auto" style={{zIndex:50}}>
                <div className="px-3 pb-2 mb-1 border-b border-main flex justify-between">
                  <button onClick={()=>setSelectedBrands(allBrands)} className="text-[10px] text-accent hover:underline">Select all</button>
                  <button onClick={()=>setSelectedBrands([])} className="text-[10px] text-muted hover:text-main">Clear</button>
                </div>
                {allBrands.map(b=>(
                  <label key={b} className="flex items-center gap-2 px-3 py-1.5 hover:bg-surface2 cursor-pointer">
                    <input type="checkbox" checked={selectedBrands.includes(b)}
                      onChange={()=>setSelectedBrands(prev=>prev.includes(b)?prev.filter(x=>x!==b):[...prev,b])}
                      className="rounded border-gray-300 text-accent"/>
                    <span className="text-xs text-main">{b}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="p-5 max-w-5xl mx-auto space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard label="Total entries" value={data.length} sub={`${localData.length} local · ${globalData.length} global`}/>
          <StatCard label="Brands" value={brands.length}/>
          <StatCard label="Classified" value={rated.length} sub={`${data.length-rated.length} pending`}/>
          <StatCard label="Avg rating" value={avgRating} sub="out of 5"/>
          <StatCard label="Categories" value={categoryCounts.length}/>
        </div>

        {/* Entries by brand */}
        <ChartCard title="Entries by brand" height={Math.max(220,brandCounts.length*28)}>
          <BarChart data={brandCounts} layout="vertical" margin={{left:90,right:20}}>
            <XAxis type="number" tick={{fontSize:11,fill:"var(--text3)"}}/><YAxis type="category" dataKey="name" tick={{fontSize:11,fill:"var(--text)"}} width={85}/>
            <Tooltip content={<CT/>}/><Bar dataKey="value" radius={[0,4,4,0]}>{brandCounts.map((e,i)=><Cell key={i} fill={COMPETITOR_COLORS[e.name]||COLORS[i%COLORS.length]}/>)}</Bar>
          </BarChart>
        </ChartCard>

        {/* Communication Intent */}
        {intentCounts.length>0&&(
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <PieCard title="Communication intent split" data={intentCounts.map(d=>({...d,fill:INTENT_COLORS[d.name]||COLORS[0]}))}/>
            {intentNormalized.length>0&&(
              <ChartCard title="Intent mix by brand (normalized %)" height={Math.max(200,intentNormalized.length*32)}>
                <BarChart data={intentNormalized} layout="vertical" margin={{left:90,right:20}}>
                  <XAxis type="number" domain={[0,100]} tick={{fontSize:10,fill:"var(--text3)"}} tickFormatter={v=>v+"%"}/>
                  <YAxis type="category" dataKey="name" tick={{fontSize:11,fill:"var(--text)"}} width={85}/>
                  <Tooltip formatter={(v)=>v+"%"}/>
                  <Bar dataKey="Brand" stackId="a" fill="#0019FF" radius={[0,0,0,0]}/>
                  <Bar dataKey="Product" stackId="a" fill="#059669" radius={[0,0,0,0]}/>
                  <Bar dataKey="Innovation" stackId="a" fill="#d97706" radius={[0,4,4,0]}/>
                  <Legend wrapperStyle={{fontSize:11}}/>
                </BarChart>
              </ChartCard>
            )}
          </div>
        )}

        {/* OUR RESEARCH FRAMEWORKS */}
        {/* Portraits */}
        <ChartCard title="Entries by portrait" subtitle="Dreamer · Builder · Sovereign · Architect — our four founder identity types" height={220}>
          <BarChart data={portraitCounts} margin={{left:10,right:10}}>
            <XAxis dataKey="name" tick={{fontSize:11,fill:"var(--text2)"}}/><YAxis tick={{fontSize:10,fill:"var(--text3)"}}/>
            <Tooltip/><Bar dataKey="value" radius={[4,4,0,0]}>{portraitCounts.map((e,i)=><Cell key={i} fill={PORTRAIT_COLORS[e.name]||COLORS[i%COLORS.length]}/>)}</Bar>
          </BarChart>
        </ChartCard>

        {/* Entry Doors */}
        <ChartCard title="Entries by entry door" subtitle="Freedom · Craft · Identity · Build to Exit — why founders started their business" height={220}>
          <BarChart data={doorCounts} margin={{left:10,right:10}}>
            <XAxis dataKey="name" tick={{fontSize:11,fill:"var(--text2)"}}/><YAxis tick={{fontSize:10,fill:"var(--text3)"}}/>
            <Tooltip/><Bar dataKey="value" radius={[4,4,0,0]}>{doorCounts.map((e,i)=><Cell key={i} fill={DOOR_COLORS[e.name]||COLORS[i%COLORS.length]}/>)}</Bar>
          </BarChart>
        </ChartCard>

        {/* Journey Phases */}
        <ChartCard title="Entries by journey phase" subtitle="Existential · Validation · Complexity · Consolidation — the experiential business journey" height={220}>
          <BarChart data={phaseCounts} margin={{left:10,right:10}}>
            <XAxis dataKey="name" tick={{fontSize:11,fill:"var(--text2)"}}/><YAxis tick={{fontSize:10,fill:"var(--text3)"}}/>
            <Tooltip/><Bar dataKey="value" radius={[4,4,0,0]}>{phaseCounts.map((e,i)=><Cell key={i} fill={PHASE_COLORS[e.name]||COLORS[i%COLORS.length]}/>)}</Bar>
          </BarChart>
        </ChartCard>

        {/* Portrait coverage heatmap */}
        <Heatmap data={data} rowKey={data[0]?.competitor?"competitor":"brand"} colKey="portrait" title="Portrait coverage by brand" subtitle="Which brands talk to which founder types — gaps are white space"/>

        {/* Entry door coverage */}
        <Heatmap data={data} rowKey={data[0]?.competitor?"competitor":"brand"} colKey="entry_door" title="Entry door coverage by brand" subtitle="Which motivations does each brand address?"/>

        {/* Phase coverage */}
        <Heatmap data={data} rowKey={data[0]?.competitor?"competitor":"brand"} colKey="journey_phase" title="Journey phase coverage by brand" subtitle="Which business stages does each brand speak to?"/>

        {/* Portrait × Door */}
        <Heatmap data={data} rowKey="portrait" colKey="entry_door" title="Portrait × entry door" subtitle="Which doors lead to which portraits in competitive comms"/>

        {/* Tone */}
        <ChartCard title="Tone of voice distribution" height={250}>
          <BarChart data={toneCounts} margin={{left:10,right:10}}>
            <XAxis dataKey="name" tick={{fontSize:10,fill:"var(--text2)"}} angle={-30} textAnchor="end" height={60}/><YAxis tick={{fontSize:10,fill:"var(--text3)"}}/>
            <Tooltip/><Bar dataKey="value" radius={[4,4,0,0]}>{toneCounts.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}</Bar>
          </BarChart>
        </ChartCard>

        {/* Archetype */}
        <ChartCard title="Brand archetype frequency" height={250}>
          <BarChart data={archetypeCounts} margin={{left:10,right:10}}>
            <XAxis dataKey="name" tick={{fontSize:10,fill:"var(--text2)"}} angle={-30} textAnchor="end" height={60}/><YAxis tick={{fontSize:10,fill:"var(--text3)"}}/>
            <Tooltip/><Bar dataKey="value" radius={[4,4,0,0]}>{archetypeCounts.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}</Bar>
          </BarChart>
        </ChartCard>

        {/* Category + Language + Execution */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <PieCard title="Category split" data={categoryCounts}/>
          <PieCard title="Language register" data={languageCounts}/>
          <PieCard title="Execution style" data={executionCounts}/>
        </div>

        {/* Positioning matrix */}
        <DownloadableCard title="Positioning matrix">
          <p className="text-xs text-muted mb-3">X: Owner language ↔ Banking language · Y: Aspiration ↔ Product-focused · Size: entries</p>
          <ResponsiveContainer width="100%" height={380}>
            <ScatterChart margin={{top:20,right:20,bottom:20,left:20}}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/>
              <XAxis type="number" dataKey="x" tick={{fontSize:10,fill:"var(--text3)"}} label={{value:"← Banking · Owner →",position:"bottom",fontSize:10,fill:"var(--text3)"}}/>
              <YAxis type="number" dataKey="y" tick={{fontSize:10,fill:"var(--text3)"}} label={{value:"← Product · Aspiration →",angle:-90,position:"left",fontSize:10,fill:"var(--text3)"}}/>
              <ZAxis type="number" dataKey="z" range={[100,800]}/>
              <Tooltip content={({payload})=>{if(!payload?.[0])return null;const d=payload[0].payload;return <div className="bg-surface border border-main rounded-lg px-3 py-2 shadow-lg text-xs"><p className="font-semibold text-main">{d.name}</p><p className="text-muted">{d.z} entries</p></div>;}}/>
              <Scatter data={positionData}>{positionData.map((e,i)=><Cell key={i} fill={COMPETITOR_COLORS[e.name]||COLORS[i%COLORS.length]} fillOpacity={0.7}/>)}</Scatter>
            </ScatterChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-2 mt-2 justify-center">{positionData.map((d,i)=>(<span key={d.name} className="text-[10px] flex items-center gap-1"><span style={{width:8,height:8,borderRadius:"50%",background:COMPETITOR_COLORS[d.name]||COLORS[i%COLORS.length],display:"inline-block"}}/>{d.name}</span>))}</div>
        </DownloadableCard>

        {/* Rating */}
        {ratingData.length>0&&<ChartCard title="Average rating by brand" height={Math.max(180,ratingData.length*28)}>
          <BarChart data={ratingData} layout="vertical" margin={{left:90,right:20}}>
            <XAxis type="number" domain={[0,5]} tick={{fontSize:10,fill:"var(--text3)"}}/><YAxis type="category" dataKey="name" tick={{fontSize:11,fill:"var(--text)"}} width={85}/>
            <Tooltip/><Bar dataKey="value" radius={[0,4,4,0]}>{ratingData.map((e,i)=><Cell key={i} fill={COMPETITOR_COLORS[e.name]||COLORS[i%COLORS.length]}/>)}</Bar>
          </BarChart>
        </ChartCard>}

        {/* Moment heatmaps */}
        <Heatmap data={data} rowKey={data[0]?.competitor?"competitor":"brand"} colKey="moment_acquisition" title="Acquisition moment coverage"/>
        <Heatmap data={data} rowKey={data[0]?.competitor?"competitor":"brand"} colKey="moment_deepening" title="Deepening moment coverage"/>

        {/* Portrait × Tone */}
        <Heatmap data={data} rowKey="portrait" colKey="tone_of_voice" title="Portrait × tone of voice" subtitle="How do competitors speak to each founder type?"/>

        {/* Intent × Brand */}
        <Heatmap data={data} rowKey={data[0]?.competitor?"competitor":"brand"} colKey="communication_intent" title="Communication intent by brand" subtitle="Brand building vs Product selling vs Innovation — who does what?"/>
      </div>
    </div>
  );
}

export default function DashboardPage(){return <AuthGuard><ProjectGuard><Nav/><DashboardContent/></ProjectGuard></AuthGuard>;}
