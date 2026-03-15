"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { STATIC_OPTIONS, fetchOptions, COMPETITOR_COLORS, getFieldsForScope, getTableName } from "@/lib/options";
import AuthGuard from "@/components/AuthGuard";
import Nav from "@/components/Nav";
import ProjectGuard from "@/components/ProjectGuard";
import { useProject } from "@/lib/project-context";

function ytId(u){if(!u)return null;const m=u.match(/(?:youtube\.com\/watch\?.*v=|youtu\.be\/)([^&\s]+)/);return m?m[1]:null;}
function isImgUrl(u){return u&&(/\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(u)||u.includes("supabase.co/storage"));}
function Tag({v}){return <span style={{background:COMPETITOR_COLORS[v]||"#888",color:"#fff",padding:"1px 6px",borderRadius:3,fontSize:11,fontWeight:600}}>{v}</span>;}

function Toast({message,link,onClose}){
  useEffect(()=>{const t=setTimeout(onClose,4000);return()=>clearTimeout(t);},[onClose]);
  return(<div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-surface border border-main rounded-xl shadow-lg px-5 py-3 flex items-center gap-3 z-50 animate-[slideUp_0.3s_ease]">
    <span className="text-sm text-main font-medium">{message}</span>
    {link&&<button onClick={link.action} className="text-sm text-accent font-semibold hover:underline">{link.label}</button>}
    <button onClick={onClose} className="text-hint hover:text-main ml-2">×</button>
  </div>);
}

function AuditContent({scope,onScopeChange,onAddWithScope,pendingForm,clearPendingForm}){
  const [data,setData]=useState([]);
  const [OPTIONS,setOPTIONS]=useState(STATIC_OPTIONS);
  const [cur,setCur]=useState({});
  const [vw,setVw]=useState("list");
  const [eid,setEid]=useState(null);
  const [fl,setFl]=useState({});
  const [sec,setSec]=useState(0);
  const [sb,setSb]=useState(null);
  const [loading,setLoading]=useState(true);
  const [sortCol,setSortCol]=useState("created_at");
  const [sortDir,setSortDir]=useState("desc");
  const [selected,setSelected]=useState(new Set());
  const [uploading,setUploading]=useState(false);
  const [analyzing,setAnalyzing]=useState(false);
  const [ytLoading,setYtLoading]=useState(false);
  const [showAddMenu,setShowAddMenu]=useState(false);
  const [dragOver,setDragOver]=useState(false);
  const [materialType,setMaterialType]=useState("none");
  const [highlighted,setHighlighted]=useState(new Set());
  const [listMode,setListMode]=useState("list");
  const [toast,setToast]=useState(null);
  const [sortPreset,setSortPreset]=useState("newest");
  const supabase=createClient();

  const load=useCallback(async()=>{
    setLoading(true);
    const{data:rows}=await supabase.from(getTableName(scope)).select("*").order("created_at",{ascending:false});
    setData(rows||[]);setLoading(false);setSelected(new Set());setSb(null);
  },[scope]);

  useEffect(()=>{load();fetchOptions().then(o=>setOPTIONS(o));},[load]);
  useEffect(()=>{if(pendingForm&&!loading){setCur({});setEid(null);setMaterialType("none");setSec(0);setVw("form");setHighlighted(new Set());clearPendingForm();}},[pendingForm,loading,clearPendingForm]);

  const highlightFields=(fields)=>{setHighlighted(new Set(fields));setTimeout(()=>setHighlighted(new Set()),3000);};
  const autoFill=(updates)=>{const fk=[];setCur(prev=>{const u={...prev};Object.entries(updates).forEach(([k,v])=>{if(!u[k]&&v){u[k]=v;fk.push(k);}});return u;});if(fk.length>0)highlightFields(fk);};
  const clearForm=()=>{if(!confirm("Clear all form data?"))return;setCur({});setMaterialType("none");setSec(0);setHighlighted(new Set());};

  // Merge "Other" custom values into main fields before saving
  const LOCAL_COLUMNS=["id","created_by","competitor","category","description","year","type","xtype","url","image_url","main_slogan","transcript","synopsis","insight","idea","primary_territory","secondary_territory","execution_style","rating","analyst_comment","entry_door","experience_reflected","portrait","richness_definition","journey_phase","client_lifecycle","moment_acquisition","moment_deepening","moment_unexpected","bank_role","pain_point_type","pain_point","language_register","main_vp","brand_attributes","emotional_benefit","rational_benefit","r2b","channel","cta","tone_of_voice","representation","industry_shown","business_size","brand_archetype","diff_claim"];
  const GLOBAL_COLUMNS=[...LOCAL_COLUMNS,"brand","country","category_proximity","company_type"];

  const prepareSaveData=(rawCur)=>{
    const allowed=new Set(scope==="global"?GLOBAL_COLUMNS:LOCAL_COLUMNS);
    const allFields=getFieldsForScope(scope).flatMap(s=>s.fields);
    const merged={...rawCur};
    // Merge "Other" values — for EVERY select field, if value is "Other" and _other has text, use the text
    allFields.forEach(f=>{
      if(f.type==="select"&&merged[f.key]==="Other"&&merged[f.key+"_other"]){
        merged[f.key]=merged[f.key+"_other"];
      }
    });
    // Build clean object with only allowed columns
    const e={};
    Object.keys(merged).forEach(k=>{
      if(allowed.has(k)&&!k.endsWith("_other"))e[k]=merged[k];
    });
    delete e.created_at;
    return e;
  };

  const save=async()=>{
    const e=prepareSaveData(cur);
    if(!e.competitor&&!e.brand&&!e.description){setToast({message:"Please fill at least a brand or description"});return;}
    const table=getTableName(scope);
    let savedId=eid;
    if(eid){
      const{error}=await supabase.from(table).update(e).eq("id",eid);
      if(error){setToast({message:"Error saving: "+error.message});return;}
    }else{
      e.id=String(Date.now());savedId=e.id;
      const{data:{session}}=await supabase.auth.getSession();
      e.created_by=session?.user?.email||"";
      const{error}=await supabase.from(table).insert(e);
      if(error){setToast({message:"Error saving: "+error.message});return;}
    }
    setCur({});setEid(null);setVw("list");setMaterialType("none");
    await load();
    setToast({message:eid?"Entry updated":"Entry saved",link:{label:"View →",action:()=>{const found=data.find(x=>x.id===savedId);if(found)setSb(found);}}});
  };

  const del=async(id)=>{await supabase.from(getTableName(scope)).delete().eq("id",id);if(sb?.id===id)setSb(null);load();};
  const bulkDelete=async()=>{if(selected.size===0||!confirm(`Delete ${selected.size} entries?`))return;for(const id of selected){await supabase.from(getTableName(scope)).delete().eq("id",id);}if(sb&&selected.has(sb.id))setSb(null);load();};
  const toggleSelect=(id)=>{setSelected(prev=>{const n=new Set(prev);n.has(id)?n.delete(id):n.add(id);return n;});};

  const doExport=()=>{
    const ks=getFieldsForScope(scope).flatMap(s=>s.fields.map(f=>f.key));
    const rows=data.map(e=>ks.map(k=>'"'+(e[k]||"").replace(/"/g,'""').replace(/\n/g," ")+'"').join(","));
    const blob=new Blob([[ks.join(","),...rows].join("\n")],{type:"text/csv;charset=utf-8;"});
    const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`audit_${scope}.csv`;document.body.appendChild(a);a.click();document.body.removeChild(a);
  };

  const fetchYTMeta=async(url)=>{
    setYtLoading(true);
    try{const res=await fetch("/api/youtube",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({url})});const meta=await res.json();
      if(!meta.error){const updates={};if(meta.title)updates.description=meta.title;if(meta.thumbnail)updates.image_url=meta.thumbnail;if(meta.description)updates.synopsis=meta.description;if(meta.year)updates.year=meta.year;if(meta.transcript)updates.transcript=meta.transcript;if(scope==="global"&&meta.channel)updates.brand=meta.channel;autoFill(updates);}
    }catch{}setYtLoading(false);
  };

  const setVideoUrl=(url)=>{setCur(prev=>({...prev,url}));setMaterialType("video");if(ytId(url))fetchYTMeta(url);};
  const setWebUrl=(url)=>{setCur(prev=>({...prev,url}));setMaterialType("web");};
  const setImageFromUrl=(url)=>{setCur(prev=>({...prev,image_url:url,url:""}));setMaterialType("image");};
  const uploadImage=async(file)=>{if(!file)return;setUploading(true);const ext=file.name.split(".").pop();const path=`${Date.now()}.${ext}`;const{error}=await supabase.storage.from("media").upload(path,file);if(!error){const{data:{publicUrl}}=supabase.storage.from("media").getPublicUrl(path);setCur(prev=>({...prev,image_url:publicUrl,url:""}));setMaterialType("image");}setUploading(false);};
  const handleDrop=(e)=>{e.preventDefault();setDragOver(false);const file=e.dataTransfer.files?.[0];if(file&&file.type.startsWith("image/"))uploadImage(file);};

  const analyzeWithAI=async()=>{
    const imgUrl=cur.image_url;const transcript=cur.transcript;const notes=cur.analyst_comment;
    if(!imgUrl&&!transcript)return;setAnalyzing(true);
    try{let context=[];if(cur.competitor)context.push(`Brand: ${cur.competitor}`);if(cur.brand)context.push(`Brand: ${cur.brand}`);if(transcript)context.push(`Transcript/copy: ${transcript.slice(0,1500)}`);if(notes)context.push(`Analyst observations: ${notes}`);
      const res=await fetch("/api/analyze",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({imageUrl:imgUrl||"",context:context.join("\n")})});const result=await res.json();
      if(result.success&&result.analysis){autoFill(result.analysis);}
    }catch{}setAnalyzing(false);
  };

  const openForm=(entry)=>{const e=entry||{};setCur({...e});setEid(entry?entry.id:null);if(ytId(e.url))setMaterialType("video");else if(e.image_url)setMaterialType("image");else if(e.url)setMaterialType("web");else setMaterialType("none");setSec(0);setVw("form");setSb(null);setHighlighted(new Set());};

  // Sort
  let fd=data.filter(e=>Object.entries(fl).every(([k,v])=>!v||(e[k]||"").includes(v)));
  if(sortPreset==="newest")fd=[...fd].sort((a,b)=>(b.created_at||"").localeCompare(a.created_at||""));
  else if(sortPreset==="oldest")fd=[...fd].sort((a,b)=>(a.created_at||"").localeCompare(b.created_at||""));
  else if(sortPreset==="rating")fd=[...fd].sort((a,b)=>(Number(b.rating)||0)-(Number(a.rating)||0));
  else if(sortCol){fd=[...fd].sort((a,b)=>{const va=(a[sortCol]||"").toLowerCase(),vb=(b[sortCol]||"").toLowerCase();return sortDir==="asc"?va.localeCompare(vb):vb.localeCompare(va);});}

  const handleSort=(col)=>{setSortPreset("");if(sortCol===col)setSortDir(d=>d==="asc"?"desc":"asc");else{setSortCol(col);setSortDir("asc");}};
  const getOpts=(f)=>OPTIONS[f.optKey||f.key]||[];
  const sections=getFieldsForScope(scope);
  const fieldStyle=(key)=>highlighted.has(key)?{background:"var(--accent-soft)",borderColor:"var(--accent)",transition:"background 0.3s"}:{};

  if(loading)return <div className="p-10 text-center text-hint">Loading...</div>;

  // ── FORM ──
  if(vw==="form"){
    const y=ytId(cur.url);const imgUrl=cur.image_url;
    return(
      <div className="min-h-screen" style={{background:"var(--bg)"}}>
        <div className="bg-surface border-b border-main px-5 py-3 flex justify-between items-center sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-main">{eid?"Edit entry":"New entry"}</h2>
            <span className="text-xs text-hint bg-accent-soft px-2 py-0.5 rounded font-medium">{scope==="local"?"Local":"Global"}</span>
            {ytLoading&&<span className="text-xs text-accent animate-pulse">Fetching YouTube data...</span>}
            {analyzing&&<span className="text-xs text-accent animate-pulse">AI analyzing...</span>}
          </div>
          <div className="flex gap-2">
            <button onClick={clearForm} className="px-3 py-1.5 text-sm text-red-500 border border-red-200 rounded-lg hover:bg-red-50">Clear</button>
            <button onClick={()=>{setVw("list");setEid(null);setCur({});setMaterialType("none");}} className="px-3 py-1.5 text-sm border border-main rounded-lg text-muted hover:bg-surface2">Cancel</button>
            <button onClick={save} className="px-4 py-1.5 text-sm bg-accent text-white rounded-lg font-semibold hover:opacity-90">Save</button>
          </div>
        </div>
        <div className="flex" style={{height:"calc(100vh - 52px)"}}>
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="bg-surface border-b border-main px-4 py-3 flex-shrink-0">
              {materialType==="none"?(<div><p className="text-sm font-medium text-main mb-2">Choose material type</p><div className="flex gap-2">{[["video","Video URL"],["web","Website URL"],["image","Image"]].map(([k,l])=>(<button key={k} onClick={()=>setMaterialType(k)} className="flex-1 py-3 rounded-lg border border-main text-sm font-medium text-main hover:bg-accent-soft hover:border-[var(--accent)] transition text-center">{l}</button>))}</div></div>
              ):(<div className="space-y-2">
                <div className="flex items-center gap-2"><div className="flex bg-surface2 rounded-lg p-0.5">{[["video","Video"],["web","Website"],["image","Image"]].map(([k,l])=>(<button key={k} onClick={()=>{setMaterialType(k);if(k!=="image")setCur(prev=>({...prev,url:"",image_url:prev.image_url||""}));if(k==="image")setCur(prev=>({...prev,url:""}));}} className={`px-3 py-1 rounded-md text-xs font-medium transition ${materialType===k?"bg-surface text-accent shadow-sm":"text-muted"}`}>{l}</button>))}</div></div>
                {materialType==="video"&&<div><label className="block text-[9px] text-hint uppercase font-semibold mb-0.5">Video URL (YouTube)</label><input value={cur.url||""} onChange={e=>setVideoUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=..." className="w-full px-2 py-1.5 bg-surface2 border border-main rounded text-sm text-main" /></div>}
                {materialType==="web"&&<div><label className="block text-[9px] text-hint uppercase font-semibold mb-0.5">Website URL</label><input value={cur.url||""} onChange={e=>setWebUrl(e.target.value)} placeholder="https://www.example.com" className="w-full px-2 py-1.5 bg-surface2 border border-main rounded text-sm text-main" /></div>}
                {materialType==="image"&&(<div className="flex gap-2"><div className="flex-1"><label className="block text-[9px] text-hint uppercase font-semibold mb-0.5">Image URL</label><input value={cur.image_url||""} onChange={e=>setImageFromUrl(e.target.value)} placeholder="https://...image.jpg" className="w-full px-2 py-1.5 bg-surface2 border border-main rounded text-sm text-main" /></div><div className="flex items-end"><label className="px-3 py-1.5 bg-surface2 border border-main rounded text-xs text-muted cursor-pointer hover:bg-accent-soft">{uploading?"...":"Upload"}<input type="file" accept="image/*" onChange={e=>uploadImage(e.target.files?.[0])} className="hidden" /></label></div></div>)}
              </div>)}
            </div>
            <div className="flex-1 overflow-auto" onDrop={handleDrop} onDragOver={e=>{e.preventDefault();setDragOver(true);}} onDragLeave={()=>setDragOver(false)}>
              <div className={`flex items-center justify-center p-4 min-h-[250px] transition ${dragOver?"ring-2 ring-[var(--accent)] ring-inset":""}`} style={{background:dragOver?"var(--accent-soft)":"var(--surface2)"}}>
                {materialType==="video"&&y?<iframe width="100%" height="350" style={{maxWidth:700}} src={`https://www.youtube.com/embed/${y}`} frameBorder="0" allowFullScreen className="rounded-lg" />
                :materialType==="image"&&imgUrl&&isImgUrl(imgUrl)?<img src={imgUrl} className="max-w-full max-h-[400px] rounded-lg" alt="" />
                :materialType==="web"&&cur.url?<div className="w-full flex flex-col" style={{height:350}}><iframe src={cur.url} width="100%" className="rounded-lg border border-main flex-1" sandbox="allow-scripts allow-same-origin" /><div className="mt-2 text-center"><a href={cur.url} target="_blank" rel="noopener" className="text-xs text-accent hover:underline">Open in new tab ↗</a></div></div>
                :<div className="text-center text-hint"><p className="text-lg mb-2">{dragOver?"Drop image here":materialType==="none"?"Choose a material type above":"Enter a URL or drop an image"}</p></div>}
              </div>
              <div className="bg-surface border-t border-main px-4 py-3 space-y-3">
                <div style={fieldStyle("transcript")}><div className="flex justify-between items-center mb-1"><label className="text-[10px] text-muted uppercase font-semibold">Transcript / Copy</label><span className="text-[9px] text-hint">Paste from YouTube or type what you see</span></div><textarea value={cur.transcript||""} onChange={e=>setCur({...cur,transcript:e.target.value})} rows={4} placeholder="Paste the video transcript, ad copy, or any text content here..." className="w-full px-3 py-2 bg-surface2 border border-main rounded-lg text-sm text-main resize-y" /></div>
                <div style={fieldStyle("analyst_comment")}><div className="flex justify-between items-center mb-1"><label className="text-[10px] text-muted uppercase font-semibold">Analyst notes</label><span className="text-[9px] text-hint">Your observations — also sent to AI</span></div><textarea value={cur.analyst_comment||""} onChange={e=>setCur({...cur,analyst_comment:e.target.value})} rows={3} placeholder="What stands out? Initial observations, strategic notes..." className="w-full px-3 py-2 bg-surface2 border border-main rounded-lg text-sm text-main resize-y" /></div>
                {(cur.image_url||cur.transcript||cur.analyst_comment)&&(<button onClick={analyzeWithAI} disabled={analyzing} className="text-sm bg-accent-soft text-accent border border-[var(--accent)] px-4 py-2 rounded-lg font-medium hover:opacity-80 disabled:opacity-50 w-full">{analyzing?"Analyzing with AI...":"✦ Analyze with AI"}</button>)}
              </div>
            </div>
          </div>
          <div className="w-[380px] border-l border-main bg-surface overflow-auto">
            <div className="p-3">
              {sections.map((s,si)=>(<div key={si} className="mb-1">
                <div onClick={()=>setSec(sec===si?-1:si)} className={`px-3 py-2 rounded-lg cursor-pointer flex justify-between text-xs font-semibold ${sec===si?"bg-accent-soft text-accent border border-[var(--accent)]":"bg-surface2 border border-main text-main"}`}><span>{s.title}</span><span className="text-hint">{sec===si?"−":"+"}</span></div>
                {sec===si&&(<div className="py-2 space-y-2">
                  {s.fields.filter(f=>f.key!=="url"&&f.key!=="image_url"&&f.key!=="transcript"&&f.key!=="analyst_comment").map(f=>(<div key={f.key} style={fieldStyle(f.key)} className="rounded px-1 -mx-1 transition-all duration-500">
                    <label className="block text-[10px] text-muted uppercase font-semibold mb-0.5">{f.label}</label>
                    {f.type==="select"?(<div><select value={cur[f.key]||""} onChange={e=>setCur({...cur,[f.key]:e.target.value})} className="w-full px-2 py-1.5 bg-surface border border-main rounded text-sm text-main"><option value="">—</option>{getOpts(f).map(o=><option key={o} value={o}>{o}</option>)}</select>{cur[f.key]==="Other"&&<input value={cur[f.key+"_other"]||""} onChange={e=>setCur({...cur,[f.key+"_other"]:e.target.value})} placeholder="Specify..." className="w-full mt-1 px-2 py-1 border border-[var(--accent)] rounded text-xs bg-accent-soft text-main" />}</div>)
                    :f.type==="textarea"?<textarea value={cur[f.key]||""} onChange={e=>setCur({...cur,[f.key]:e.target.value})} rows={2} className="w-full px-2 py-1.5 bg-surface border border-main rounded text-sm text-main resize-y" />
                    :<input value={cur[f.key]||""} onChange={e=>setCur({...cur,[f.key]:e.target.value})} className="w-full px-2 py-1.5 bg-surface border border-main rounded text-sm text-main" />}
                  </div>))}
                </div>)}
              </div>))}
            </div>
            <div className="p-3 border-t border-main"><button onClick={save} className="w-full bg-accent text-white py-2 rounded-lg text-sm font-semibold hover:opacity-90">{eid?"Save changes":"Save entry"}</button></div>
          </div>
        </div>
        {toast&&<Toast {...toast} onClose={()=>setToast(null)}/>}
      </div>
    );
  }

  // ── LIST ──
  const cols=[{key:"_select",label:"",nosort:true},{key:scope==="local"?"competitor":"brand",label:"Brand"},{key:"category",label:"Cat."},{key:"description",label:"Description"},{key:"year",label:"Year"},{key:"type",label:"Type"},{key:"portrait",label:"Portrait"},{key:"journey_phase",label:"Phase"},{key:"rating",label:"★"}];
  const filterKeys=scope==="local"?[["competitor","Competitor"],["category","Category"],["portrait","Portrait"],["journey_phase","Phase",OPTIONS.journeyPhase],["client_lifecycle","Lifecycle",OPTIONS.clientLifecycle],["brand_archetype","Archetype",OPTIONS.brandArchetype]]:[["category","Category"],["portrait","Portrait"],["journey_phase","Phase",OPTIONS.journeyPhase],["category_proximity","Proximity",OPTIONS.categoryProximity],["brand_archetype","Archetype",OPTIONS.brandArchetype]];

  const ListIcon=()=><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="2" y1="4" x2="14" y2="4"/><line x1="2" y1="8" x2="14" y2="8"/><line x1="2" y1="12" x2="14" y2="12"/></svg>;
  const GridIcon=()=><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9" y="2" width="5" height="5" rx="1"/><rect x="2" y="9" width="5" height="5" rx="1"/><rect x="9" y="9" width="5" height="5" rx="1"/></svg>;

  return(
    <div className="min-h-screen" style={{background:"var(--bg)"}}>
      <div style={{marginRight:sb?380:0,transition:"margin 0.15s"}}>
        <div className="bg-surface border-b border-main px-5 py-2.5 flex justify-between items-center sticky top-[53px] z-40">
          <div className="flex items-center gap-3">
            <div className="flex bg-surface2 rounded-lg p-0.5">
              <button onClick={()=>onScopeChange("local")} className={`px-3 py-1 rounded-md text-sm font-medium transition ${scope==="local"?"bg-surface text-accent shadow-sm":"text-muted hover:text-main"}`}>Local audit</button>
              <button onClick={()=>onScopeChange("global")} className={`px-3 py-1 rounded-md text-sm font-medium transition ${scope==="global"?"bg-surface text-accent shadow-sm":"text-muted hover:text-main"}`}>Global benchmarks</button>
            </div>
            <span className="text-xs text-hint">{fd.length} of {data.length}</span>
          </div>
          <div className="flex gap-2 items-center">
            {selected.size>0&&<button onClick={bulkDelete} className="px-3 py-1.5 text-xs bg-red-500 text-white rounded-lg font-semibold">Delete {selected.size}</button>}
            {/* Sort */}
            <select value={sortPreset} onChange={e=>{setSortPreset(e.target.value);setSortCol("");}} className="px-2 py-1 border border-main rounded text-xs bg-surface text-main">
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="rating">Best rated</option>
            </select>
            {/* View toggle */}
            <div className="flex bg-surface2 rounded p-0.5">
              <button onClick={()=>setListMode("list")} className={`p-1 rounded ${listMode==="list"?"bg-surface shadow-sm text-accent":"text-muted"}`}><ListIcon/></button>
              <button onClick={()=>setListMode("grid")} className={`p-1 rounded ${listMode==="grid"?"bg-surface shadow-sm text-accent":"text-muted"}`}><GridIcon/></button>
            </div>
            <div className="relative">
              <button onClick={()=>setShowAddMenu(!showAddMenu)} className="px-3 py-1.5 text-sm bg-accent text-white rounded-lg font-semibold hover:opacity-90">+ Add</button>
              {showAddMenu&&(<div className="absolute right-0 top-full mt-1 bg-surface border border-main rounded-lg shadow-lg z-20 overflow-hidden w-[160px]">
                <button onClick={()=>{setShowAddMenu(false);if(scope==="local")openForm(null);else onAddWithScope("local");}} className="w-full text-left px-4 py-2.5 text-sm text-main hover:bg-accent-soft border-b border-main">Local entry</button>
                <button onClick={()=>{setShowAddMenu(false);if(scope==="global")openForm(null);else onAddWithScope("global");}} className="w-full text-left px-4 py-2.5 text-sm text-main hover:bg-accent-soft">Global entry</button>
              </div>)}
            </div>
            <button onClick={doExport} className="px-3 py-1.5 text-sm border border-main rounded-lg text-muted hover:bg-surface2">Export</button>
          </div>
        </div>
        <div className="bg-surface border-b border-main px-5 py-2 flex gap-2 flex-wrap items-center sticky top-[97px] z-40">
          <span className="text-[10px] text-hint uppercase font-semibold">Filter:</span>
          {filterKeys.map(([k,l,opts])=>(<select key={k} value={fl[k]||""} onChange={e=>setFl({...fl,[k]:e.target.value})} className="px-1.5 py-1 border border-main rounded text-xs bg-surface text-main"><option value="">{l}</option>{(opts||OPTIONS[k]||[]).map(o=><option key={o} value={o}>{o}</option>)}</select>))}
          {Object.values(fl).some(Boolean)&&<span onClick={()=>setFl({})} className="text-accent text-xs cursor-pointer">Clear</span>}
        </div>

        {/* LIST VIEW */}
        {listMode==="list"?(
          <div className="px-5 pb-5 overflow-x-auto">
            <table className="w-full border-collapse text-xs mt-1">
              <thead><tr className="border-b-2 border-main">
                {cols.map((c,i)=>(<th key={i} onClick={()=>!c.nosort&&handleSort(c.key)} className={`text-left px-2 py-2 text-[10px] text-muted uppercase font-semibold ${!c.nosort?"cursor-pointer hover:text-main select-none":""}`}>{c.key==="_select"?<input type="checkbox" checked={selected.size===fd.length&&fd.length>0} onChange={()=>selected.size===fd.length?setSelected(new Set()):setSelected(new Set(fd.map(e=>e.id)))} />:<span>{c.label} {sortCol===c.key?(sortDir==="asc"?"↑":"↓"):""}</span>}</th>))}<th></th>
              </tr></thead>
              <tbody>{fd.map(e=>(<tr key={e.id} className="border-b border-main hover:bg-accent-soft cursor-pointer" onClick={()=>setSb(e)}>
                <td className="px-2 py-1.5" onClick={ev=>ev.stopPropagation()}><input type="checkbox" checked={selected.has(e.id)} onChange={()=>toggleSelect(e.id)} /></td>
                <td className="px-2 py-1.5">{scope==="local"?<Tag v={e.competitor}/>:<span className="font-medium text-main">{e.brand||"—"}</span>}</td>
                <td className="px-2 py-1.5"><Tag v={e.category}/></td>
                <td className="px-2 py-1.5 max-w-[180px] truncate font-medium text-main">{e.description||"—"}</td>
                <td className="px-2 py-1.5 text-muted">{e.year||"—"}</td>
                <td className="px-2 py-1.5 text-muted">{e.type||"—"}</td>
                <td className="px-2 py-1.5 text-main">{e.portrait||"—"}</td>
                <td className="px-2 py-1.5 text-main">{e.journey_phase||"—"}</td>
                <td className="px-2 py-1.5 text-main">{e.rating?"★".repeat(Number(e.rating)):"—"}</td>
                <td className="px-2 py-1" onClick={ev=>ev.stopPropagation()}><span onClick={()=>del(e.id)} className="text-hint hover:text-red-400 cursor-pointer text-sm">×</span></td>
              </tr>))}</tbody>
            </table>
          </div>
        ):(
          /* GALLERY VIEW */
          <div className="px-5 py-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {fd.map(e=>{
              const thumb=ytId(e.url)?`https://img.youtube.com/vi/${ytId(e.url)}/mqdefault.jpg`:e.image_url;
              return(<div key={e.id} onClick={()=>setSb(e)} className="bg-surface border border-main rounded-lg overflow-hidden cursor-pointer hover:border-[var(--accent)] transition group">
                <div className="h-[120px] bg-surface2 flex items-center justify-center overflow-hidden">
                  {thumb?<img src={thumb} className="w-full h-full object-cover" alt=""/>:<div className="text-hint text-xs">No preview</div>}
                </div>
                <div className="p-2.5">
                  <div className="flex gap-1 mb-1">{e.competitor&&<Tag v={e.competitor}/>}{e.brand&&<span className="text-[10px] font-semibold text-main bg-surface2 px-1 rounded">{e.brand}</span>}</div>
                  <p className="text-xs font-medium text-main truncate">{e.description||"—"}</p>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-[10px] text-muted">{e.year||""}</span>
                    {e.rating&&<span className="text-[10px]">{"★".repeat(Number(e.rating))}</span>}
                  </div>
                </div>
              </div>);
            })}
          </div>
        )}
      </div>

      {/* Sidebar */}
      {sb&&(<div className="fixed top-0 right-0 w-[380px] h-screen bg-surface border-l border-main overflow-auto z-50" style={{boxShadow:"-2px 0 12px rgba(0,0,0,0.05)"}}>
        <div className="p-3 border-b border-main flex justify-between items-center sticky top-0 bg-surface z-10"><b className="text-sm text-main">{sb.description||sb.competitor||sb.brand}</b><span onClick={()=>setSb(null)} className="cursor-pointer text-lg text-hint hover:text-main">×</span></div>
        {ytId(sb.url)&&<div className="px-3 pt-2"><iframe width="100%" height="195" src={`https://www.youtube.com/embed/${ytId(sb.url)}`} frameBorder="0" allowFullScreen className="rounded-md" /></div>}
        {sb.image_url&&!ytId(sb.url)&&<div className="px-3 pt-2"><img src={sb.image_url} className="w-full rounded-md" /></div>}
        {sb.url&&!ytId(sb.url)&&!sb.image_url&&<div className="px-3 pt-1"><a href={sb.url} target="_blank" className="text-[11px] text-accent break-all">{sb.url}</a></div>}
        <div className="p-3">
          <div className="flex gap-1 flex-wrap mb-2">{sb.competitor&&<Tag v={sb.competitor}/>}{sb.brand&&<span className="text-xs font-semibold text-main bg-surface2 px-1.5 py-0.5 rounded">{sb.brand}</span>}{sb.category&&<Tag v={sb.category}/>}{sb.year&&<span className="bg-surface2 px-1.5 py-0.5 rounded text-[11px] text-main">{sb.year}</span>}{sb.rating&&<span className="text-[11px]">{"★".repeat(Number(sb.rating))}</span>}</div>
          {[["Type",sb.type],["Portrait",sb.portrait],["Phase",sb.journey_phase],["Lifecycle",sb.client_lifecycle],["Door",sb.entry_door],["Role",sb.bank_role],["Archetype",sb.brand_archetype],["Tone",sb.tone_of_voice],["Language",sb.language_register],["Territory",sb.primary_territory],["Execution",sb.execution_style],["VP",sb.main_vp],["Slogan",sb.main_slogan]].filter(([,v])=>v&&v!==""&&!v.startsWith("Not ")&&!v.startsWith("None")).map(([l,v])=>(<div key={l} className="text-xs mb-0.5"><span className="text-muted">{l}:</span> <span className="text-main">{v}</span></div>))}
        </div>
        {sb.synopsis&&<div className="px-3 pb-2"><div className="text-[10px] font-semibold text-hint uppercase mb-1">Synopsis</div><div className="text-xs leading-relaxed bg-surface2 p-2 rounded text-main">{sb.synopsis}</div></div>}
        {sb.insight&&<div className="px-3 pb-2"><div className="text-[10px] font-semibold text-hint uppercase mb-1">Insight</div><div className="text-xs leading-relaxed bg-surface2 p-2 rounded text-main">{sb.insight}</div></div>}
        {sb.transcript&&<div className="px-3 pb-2"><div className="text-[10px] font-semibold text-hint uppercase mb-1">Transcript</div><div className="text-xs leading-relaxed bg-surface2 p-2 rounded max-h-[150px] overflow-auto whitespace-pre-wrap text-main">{sb.transcript}</div></div>}
        {sb.analyst_comment&&<div className="px-3 pb-2"><div className="text-[10px] font-semibold text-hint uppercase mb-1">Analyst notes</div><div className="text-xs leading-relaxed bg-surface2 p-2 rounded text-main">{sb.analyst_comment}</div></div>}
        <div className="p-3 border-t border-main sticky bottom-0 bg-surface"><button onClick={()=>openForm(sb)} className="w-full bg-accent text-white py-2 rounded-lg text-sm font-semibold hover:opacity-90">Edit</button></div>
      </div>)}

      {toast&&<Toast {...toast} onClose={()=>setToast(null)}/>}
    </div>
  );
}

export default function AuditPage(){
  const[scope,setScope]=useState("local");
  const[pendingForm,setPendingForm]=useState(false);
  const handleScopeChange=(s)=>{setScope(s);};
  const handleAddWithScope=(s)=>{if(s!==scope){setScope(s);setPendingForm(true);}else setPendingForm(true);};
  return(<AuthGuard><ProjectGuard><Nav/><AuditContent scope={scope} onScopeChange={handleScopeChange} onAddWithScope={handleAddWithScope} pendingForm={pendingForm} clearPendingForm={()=>setPendingForm(false)} key={scope}/></ProjectGuard></AuthGuard>);
}
