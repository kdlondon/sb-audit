"use client";
import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { STATIC_OPTIONS, fetchOptions, COMPETITOR_COLORS, getFieldsForScope, getTableName } from "@/lib/options";
import AuthGuard from "@/components/AuthGuard";
import Nav from "@/components/Nav";
import ProjectGuard from "@/components/ProjectGuard";
import { useProject } from "@/lib/project-context";

function ytId(u){if(!u)return null;const m=u.match(/(?:youtube\.com\/watch\?.*v=|youtu\.be\/)([^&\s]+)/);return m?m[1]:null;}
function vimeoId(u){if(!u)return null;const m=u.match(/vimeo\.com\/(\d+)/);return m?m[1]:null;}
function isImgUrl(u){return u&&(/\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(u)||u.includes("supabase.co/storage"));}
function Tag({v}){return <span style={{background:COMPETITOR_COLORS[v]||"#888",color:"#fff",padding:"1px 6px",borderRadius:3,fontSize:11,fontWeight:600}}>{v}</span>;}

function ImageViewer({src}){
  const [scale,setScale]=useState(1);
  const [pos,setPos]=useState({x:0,y:0});
  const [dragging,setDragging]=useState(false);
  const [start,setStart]=useState({x:0,y:0});
  const containerRef=useRef(null);

  const handleWheel=(e)=>{e.preventDefault();const delta=e.deltaY>0?-0.15:0.15;setScale(s=>Math.min(Math.max(0.5,s+delta),5));};
  const handleMouseDown=(e)=>{if(scale<=1)return;e.preventDefault();setDragging(true);setStart({x:e.clientX-pos.x,y:e.clientY-pos.y});};
  const handleMouseMove=(e)=>{if(!dragging)return;setPos({x:e.clientX-start.x,y:e.clientY-start.y});};
  const handleMouseUp=()=>setDragging(false);
  const reset=()=>{setScale(1);setPos({x:0,y:0});};

  useEffect(()=>{
    const el=containerRef.current;if(!el)return;
    el.addEventListener("wheel",handleWheel,{passive:false});
    return()=>el.removeEventListener("wheel",handleWheel);
  });

  return(
    <div ref={containerRef} className="w-full h-full min-h-[300px] flex flex-col items-center justify-center relative overflow-hidden select-none rounded-lg"
      style={{background:"#111015"}}
      onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
      style={{cursor:scale>1?(dragging?"grabbing":"grab"):"zoom-in"}}>
      <img src={src} alt="" draggable={false}
        className="max-w-full max-h-[500px] rounded-lg transition-transform duration-100"
        style={{transform:`translate(${pos.x}px,${pos.y}px) scale(${scale})`,transformOrigin:"center center"}} />
      {/* Zoom controls */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-black/50 backdrop-blur-sm rounded-full px-2 py-1">
        <button onClick={()=>setScale(s=>Math.max(0.5,s-0.25))} className="text-white/70 hover:text-white w-6 h-6 flex items-center justify-center text-lg rounded-full hover:bg-white/10">−</button>
        <span className="text-white/60 text-[10px] font-mono w-10 text-center">{Math.round(scale*100)}%</span>
        <button onClick={()=>setScale(s=>Math.min(5,s+0.25))} className="text-white/70 hover:text-white w-6 h-6 flex items-center justify-center text-lg rounded-full hover:bg-white/10">+</button>
        {scale!==1&&<button onClick={reset} className="text-white/50 hover:text-white text-[9px] ml-1 px-1.5 py-0.5 rounded hover:bg-white/10">Reset</button>}
      </div>
    </div>
  );
}

function Toast({message,link,onClose}){
  useEffect(()=>{const t=setTimeout(onClose,4000);return()=>clearTimeout(t);},[onClose]);
  return(<div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-surface border border-main rounded-xl shadow-lg px-5 py-3 flex items-center gap-3 z-50 animate-[slideUp_0.3s_ease]">
    <span className="text-sm text-main font-medium">{message}</span>
    {link&&<button onClick={link.action} className="text-sm text-accent font-semibold hover:underline">{link.label}</button>}
    <button onClick={onClose} className="text-hint hover:text-main ml-2">×</button>
  </div>);
}


// ── COUNTRIES LIST ────────────────────────────────────────────────────────────
const COUNTRIES = [
  "Afghanistan","Albania","Algeria","Angola","Argentina","Armenia","Australia",
  "Austria","Azerbaijan","Bahrain","Bangladesh","Belarus","Belgium","Bolivia",
  "Bosnia and Herzegovina","Brazil","Bulgaria","Cambodia","Cameroon","Canada",
  "Chile","China","Colombia","Congo","Costa Rica","Croatia","Cuba","Czech Republic",
  "Denmark","Dominican Republic","Ecuador","Egypt","El Salvador","Estonia",
  "Ethiopia","Finland","France","Georgia","Germany","Ghana","Greece","Guatemala",
  "Honduras","Hong Kong","Hungary","India","Indonesia","Iran","Iraq","Ireland",
  "Israel","Italy","Ivory Coast","Jamaica","Japan","Jordan","Kazakhstan","Kenya",
  "Kuwait","Latvia","Lebanon","Libya","Lithuania","Luxembourg","Malaysia","Mexico",
  "Moldova","Morocco","Mozambique","Myanmar","Netherlands","New Zealand","Nigeria",
  "Norway","Pakistan","Panama","Paraguay","Peru","Philippines","Poland","Portugal",
  "Qatar","Romania","Russia","Saudi Arabia","Senegal","Serbia","Singapore",
  "Slovakia","South Africa","South Korea","Spain","Sri Lanka","Sweden","Switzerland",
  "Taiwan","Tanzania","Thailand","Tunisia","Turkey","Ukraine","United Arab Emirates",
  "United Kingdom","United States","Uruguay","Uzbekistan","Venezuela","Vietnam",
  "Zimbabwe"
];

function CountryInput({ value, onChange }) {
  const [query, setQuery] = useState(value || "");
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const ref = useRef(null);

  useEffect(() => { setQuery(value || ""); }, [value]);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = query.length > 0
    ? COUNTRIES.filter(c => c.toLowerCase().startsWith(query.toLowerCase())).slice(0, 8)
    : [];

  const select = (country) => {
    setQuery(country);
    onChange(country);
    setOpen(false);
  };

  return (
    <div ref={ref} style={{position:"relative"}}>
      <input
        value={query}
        onChange={e => { setQuery(e.target.value); onChange(e.target.value); setOpen(true); }}
        onFocus={() => { setFocused(true); if (query.length > 0) setOpen(true); }}
        onBlur={() => setFocused(false)}
        placeholder="Type to search..."
        className="w-full px-2 py-1.5 bg-surface border border-main rounded text-sm text-main"
        style={focused ? {borderColor:"var(--accent)",outline:"none"} : {}}
      />
      {open && filtered.length > 0 && (
        <div className="absolute left-0 right-0 bg-surface border border-main rounded-lg shadow-lg overflow-hidden" style={{top:"100%",marginTop:2,zIndex:9999}}>
          {filtered.map(c => (
            <button key={c} onMouseDown={() => select(c)}
              className="w-full text-left px-3 py-1.5 text-sm text-main hover:bg-accent-soft transition"
            >{c}</button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── MULTI-SELECT FIELDS ───────────────────────────────────────────────────────
const MULTI_SELECT_FIELDS = new Set([
  "portrait","entry_door","journey_phase","client_lifecycle",
  "moment_acquisition","moment_deepening","moment_unexpected",
  "business_size","industry_shown","channel","brand_archetype","funnel","communication_intent"
]);

// ── DESCRIPTIONS ──────────────────────────────────────────────────────────────
const PORTRAIT_DESCRIPTIONS = {
  "Dreamer": "Just starting out. Business exists as a vision more than a reality. Driven by the desire to escape dependence and build something of their own. Every decision feels existential.",
  "Builder": "Business is identity. Measures success by impact on people — employees, community, customers. In the messy middle of scaling. Lonely at the top but won't show it.",
  "Sovereign": "Business is a vehicle for lifestyle design. Values freedom and autonomy above growth. Not interested in empire-building — interested in a life well-designed on their own terms.",
  "Architect": "Operates the business like a system. Strategic, analytical, exit-aware. Measures richness by capability and optionality. Treats the bank as a tool, not a partner.",
};

const ARCHETYPE_DESCRIPTIONS = {
  "Innocent": "Optimistic, pure, simple. Promises happiness and goodness. Avoids complexity and darkness.",
  "Explorer": "Independent, adventurous, ambitious. Helps people discover new possibilities and break free from constraints.",
  "Sage": "Knowledgeable, trusted, analytical. Guides through expertise and truth. The brand people turn to for answers.",
  "Hero": "Courageous, determined, bold. Helps people overcome challenges and prove their worth.",
  "Outlaw": "Rebellious, disruptive, provocative. Challenges conventions and speaks for the underdog.",
  "Magician": "Transformative, visionary, inspiring. Turns dreams into reality. Makes the impossible feel possible.",
  "Regular Guy": "Authentic, unpretentious, relatable. Connects through shared values and everyday reality.",
  "Lover": "Passionate, intimate, sensual. Creates deep emotional connections and a sense of belonging.",
  "Jester": "Playful, irreverent, fun. Brings joy and lightness. Doesn't take itself too seriously.",
  "Caregiver": "Nurturing, protective, generous. Puts others first. Makes people feel safe and supported.",
  "Creator": "Imaginative, inventive, expressive. Builds things of enduring value. Celebrates originality.",
  "Ruler": "Authoritative, responsible, organised. Provides structure and leadership. Commands respect.",
};

// ── MULTI-SELECT CHIP COMPONENT ───────────────────────────────────────────────
function MultiSelect({ fieldKey, value, opts, onChange }) {
  // value is a comma-separated string e.g. "Builder, Dreamer"
  const selected = value ? value.split(",").map(v => v.trim()).filter(Boolean) : [];

  const toggle = (opt) => {
    const next = selected.includes(opt)
      ? selected.filter(v => v !== opt)
      : [...selected, opt];
    onChange(next.join(", "));
  };

  const desc = fieldKey === "portrait"
    ? selected.map(s => PORTRAIT_DESCRIPTIONS[s]).filter(Boolean)
    : fieldKey === "brand_archetype"
    ? selected.map(s => ARCHETYPE_DESCRIPTIONS[s]).filter(Boolean)
    : [];

  return (
    <div>
      <div className="flex flex-wrap gap-1 mt-0.5">
        {opts.map(opt => (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            className={`px-2 py-0.5 rounded text-xs font-medium border transition ${
              selected.includes(opt)
                ? "bg-accent-soft border-[var(--accent)] text-accent"
                : "bg-surface border-main text-muted hover:border-[var(--accent)] hover:text-main"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
      {desc.length > 0 && (
        <div className="mt-1.5 space-y-1">
          {desc.map((d, i) => (
            <p key={i} className="text-[10px] text-hint leading-relaxed bg-surface2 px-2 py-1 rounded italic">{d}</p>
          ))}
        </div>
      )}
    </div>
  );
}

function AuditContent({scope,onScopeChange,onAddWithScope,pendingForm,clearPendingForm,projectId,initialEntry,clearInitialEntry}){
  const [data,setData]=useState([]);
  const [OPTIONS,setOPTIONS]=useState(STATIC_OPTIONS);
  const [cur,setCur]=useState({});
  const router=useRouter();
  const searchParams=useSearchParams();
  const editParam=searchParams.get("edit");
  const entryParam=searchParams.get("entry");
  const vw=editParam?"form":"list";
  const eid=editParam==="new"?null:editParam;
  const [fl,setFl]=useState({});
  const [sec,setSec]=useState(0);
  const [sb,setSbRaw]=useState(null);
  const setSb=(entry)=>{if(entry){router.push(`/audit?entry=${entry.id}`,{scroll:false});setSbRaw(entry);}else{router.push("/audit",{scroll:false});setSbRaw(null);}};
  const [loading,setLoading]=useState(true);
  const [sortCol,setSortCol]=useState("created_at");
  const [sortDir,setSortDir]=useState("desc");
  const [selected,setSelected]=useState(new Set());
  const [uploading,setUploading]=useState(false);
  const [analyzing,setAnalyzing]=useState(false);
  const [ytLoading,setYtLoading]=useState(false);
  const [showAddMenu,setShowAddMenu]=useState(false);
  const [dragOver,setDragOver]=useState(false);
  const [zoomImg,setZoomImg]=useState(null);
  const [viewingImg,setViewingImg]=useState(null); // which image is shown in viewer
  const [materialType,setMaterialType]=useState("none");
  const [highlighted,setHighlighted]=useState(new Set());
  const [listMode,setListMode]=useState("list");
  const [inlineEdit,setInlineEdit]=useState(null); // {id, field}
  // Close inline multi-select on outside click
  useEffect(()=>{
    if(!inlineEdit)return;
    const handler=(ev)=>{if(!ev.target.closest("[data-inline-multi]"))setInlineEdit(null);};
    document.addEventListener("mousedown",handler);
    return()=>document.removeEventListener("mousedown",handler);
  },[inlineEdit]);
  const [toast,setToast]=useState(null);
  const [sortPreset,setSortPreset]=useState("newest");
  const [addMenuPos,setAddMenuPos]=useState({top:0,right:0});
  const addBtnRef=useRef(null);
  const fmtDate=(d)=>{if(!d)return"—";const dt=new Date(d);return dt.toLocaleDateString("en-GB",{day:"2-digit",month:"short"})+" "+dt.toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"});};
  const supabase=createClient();

  const load=useCallback(async()=>{
    setLoading(true);
    const{data:rows}=await supabase.from(getTableName(scope)).select("*").eq("project_id",projectId).order("created_at",{ascending:false});
    setData(rows||[]);setLoading(false);setSelected(new Set());setSbRaw(null);
  },[scope]);

  useEffect(()=>{load();fetchOptions(projectId).then(o=>setOPTIONS(o));},[load]);

  // Sync sidebar from URL entryParam (browser back/forward)
  useEffect(()=>{
    if(!entryParam){return;}
    if(sb?.id===entryParam)return;
    const found=data.find(x=>x.id===entryParam);
    if(found)setSbRaw(found);
  },[entryParam,data]);

  // Sync form from URL editParam (browser back/forward)
  useEffect(()=>{
    if(!editParam)return;
    if(editParam==="new"){setCur({});setMaterialType("none");return;}
    const entry=data.find(x=>x.id===editParam);
    if(entry){
      setCur({...entry});
      if(entry.url&&/youtube|youtu\.be/i.test(entry.url))setMaterialType("video");
      else if(entry.url&&/\.(mp4|mov|webm)(\?|$)/i.test(entry.url))setMaterialType("videoFile");
      else if(entry.url&&/\.(pdf|doc|docx|txt|rtf)(\?|$)/i.test(entry.url))setMaterialType("document");
      else if(entry.url)setMaterialType("web");
      else if(entry.image_url)setMaterialType("image");
      else setMaterialType("none");
    }
  },[editParam,data]);

  // Open entry passed from parent (via URL ?id=xxx)
  useEffect(()=>{
    if(initialEntry){setSbRaw(initialEntry);clearInitialEntry();}
  },[initialEntry]);
  useEffect(()=>{if(pendingForm&&!loading){setCur({});setMaterialType("none");setSec(0);router.push("/audit?edit=new",{scroll:false});setHighlighted(new Set());clearPendingForm();}},[pendingForm,loading,clearPendingForm]);

  const highlightFields=(fields)=>{setHighlighted(new Set(fields));setTimeout(()=>setHighlighted(new Set()),3000);};
  const autoFill=(updates)=>{const fk=[];setCur(prev=>{const u={...prev};Object.entries(updates).forEach(([k,v])=>{if(!u[k]&&v){u[k]=v;fk.push(k);}});return u;});if(fk.length>0)highlightFields(fk);};
  const clearForm=()=>{if(!confirm("Clear all form data?"))return;setCur({});setMaterialType("none");setSec(0);setHighlighted(new Set());};

  const LOCAL_COLUMNS=["id","created_by","updated_at","competitor","category","description","year","type","xtype","url","image_url","image_urls","funnel","communication_intent","main_slogan","transcript","synopsis","insight","idea","primary_territory","secondary_territory","execution_style","rating","analyst_comment","entry_door","experience_reflected","portrait","richness_definition","journey_phase","client_lifecycle","moment_acquisition","moment_deepening","moment_unexpected","bank_role","pain_point_type","pain_point","language_register","main_vp","brand_attributes","emotional_benefit","rational_benefit","r2b","channel","cta","tone_of_voice","representation","industry_shown","business_size","brand_archetype","diff_claim"];
  const GLOBAL_COLUMNS=[...LOCAL_COLUMNS,"brand","country","category_proximity","company_type"];

  const prepareSaveData=(rawCur)=>{
    const allowed=new Set(scope==="global"?GLOBAL_COLUMNS:LOCAL_COLUMNS);
    const allFields=getFieldsForScope(scope).flatMap(s=>s.fields);
    const merged={...rawCur};
    allFields.forEach(f=>{
      if(f.type==="select"&&merged[f.key]==="Other"&&merged[f.key+"_other"]){
        merged[f.key]=merged[f.key+"_other"];
      }
    });
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

    // Auto-save "Other" custom values to dropdown_options
    const allFields=getFieldsForScope(scope).flatMap(s=>s.fields);
    for(const f of allFields){
      if(f.type==="select"&&cur[f.key]==="Other"&&cur[f.key+"_other"]){
        const category=f.optKey||f.key;
        const value=cur[f.key+"_other"].trim();
        if(value){
          const{data:existing}=await supabase.from("dropdown_options").select("id").eq("project_id",projectId).eq("category",category).eq("value",value);
          if(!existing||existing.length===0){
            await supabase.from("dropdown_options").insert({project_id:projectId,category,value,sort_order:999});
          }
        }
      }
    }

    const table=getTableName(scope);
    let savedId=eid;
    if(eid){
      e.updated_at=new Date().toISOString();
      const{error}=await supabase.from(table).update(e).eq("id",eid);
      if(error){setToast({message:"Error saving: "+error.message});return;}
    }else{
      e.id=String(Date.now());savedId=e.id;
      const{data:{session}}=await supabase.auth.getSession();
      e.created_by=session?.user?.email||"";
      e.project_id=projectId;
      e.updated_at=new Date().toISOString();
      const{error}=await supabase.from(table).insert(e);
      if(error){setToast({message:"Error saving: "+error.message});return;}
    }
    const wasEdit=!!eid;
    setCur({});setMaterialType("none");
    router.push("/audit",{scroll:false});
    await load();
    setToast({message:wasEdit?"Entry updated":"Entry saved",link:{label:"View →",action:()=>{const found=data.find(x=>x.id===savedId);if(found)setSb(found);}}});
  };

  const del=async(id)=>{await supabase.from(getTableName(scope)).delete().eq("id",id);if(sb?.id===id)setSb(null);load();};

  // Inline edit — save single field
  const inlineSave=async(id,field,value,keepOpen=false)=>{
    await supabase.from(getTableName(scope)).update({[field]:value,updated_at:new Date().toISOString()}).eq("id",id);
    setData(prev=>prev.map(e=>e.id===id?{...e,[field]:value,updated_at:new Date().toISOString()}:e));
    if(sb?.id===id)setSbRaw(prev=>({...prev,[field]:value}));
    if(!keepOpen)setInlineEdit(null);
  };

  // Map column keys to option arrays for inline dropdowns
  const inlineOpts={
    type:OPTIONS.type||[],
    communication_intent:OPTIONS.communicationIntent||[],
    portrait:OPTIONS.portrait||[],
    journey_phase:OPTIONS.journeyPhase||[],
    rating:["1","2","3","4","5"],
    year:["2020","2021","2022","2023","2024","2025","2026"],
    category:OPTIONS.category||[],
    brand_archetype:OPTIONS.brandArchetype||[],
  };
  const bulkDelete=async()=>{if(selected.size===0||!confirm(`Delete ${selected.size} entries?`))return;for(const id of selected){await supabase.from(getTableName(scope)).delete().eq("id",id);}if(sb&&selected.has(sb.id))setSb(null);load();};

  const moveEntry=async(entry)=>{
    const fromTable=getTableName(scope);
    const toScope=scope==="local"?"global":"local";
    const toTable=getTableName(toScope);
    if(!confirm(`Move this entry to ${toScope==="global"?"Global benchmarks":"Local audit"}?`))return;
    // Copy entry data
    const e={...entry};delete e.id;
    // Map fields between scopes
    if(toScope==="global"){
      if(e.competitor&&!e.brand){e.brand=e.competitor;}
      delete e.competitor;
      if(!e.country)e.country="";
    }else{
      if(e.brand&&!e.competitor){e.competitor=e.brand;}
      delete e.brand;delete e.country;delete e.category_proximity;delete e.company_type;
    }
    e.id=String(Date.now());
    e.updated_at=new Date().toISOString();
    const{error:insertErr}=await supabase.from(toTable).insert(e);
    if(insertErr){setToast({message:"Error moving: "+insertErr.message});return;}
    await supabase.from(fromTable).delete().eq("id",entry.id);
    if(sb?.id===entry.id)setSb(null);
    load();
    setToast({message:`Moved to ${toScope==="global"?"Global benchmarks":"Local audit"}`});
  };
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
  const uploadFile=async(file)=>{if(!file)return null;const ext=file.name.split(".").pop();const path=`${Date.now()}_${Math.random().toString(36).slice(2,6)}.${ext}`;const{error}=await supabase.storage.from("media").upload(path,file);if(error){console.error("Upload error:",error);return null;}const{data:{publicUrl}}=supabase.storage.from("media").getPublicUrl(path);return publicUrl;};
  const uploadSingleImage=async(file)=>uploadFile(file);
  const uploadImage=async(file)=>{if(!file)return;setUploading(true);const url=await uploadFile(file);if(url){setCur(prev=>({...prev,image_url:url,url:""}));setMaterialType("image");}setUploading(false);};
  const uploadVideoFile=async(file)=>{if(!file)return;setUploading(true);setToast({message:"Uploading video..."});const url=await uploadFile(file);if(url){setCur(prev=>({...prev,url}));setMaterialType("videoFile");setToast({message:"Video uploaded"});}else{setToast({message:"Upload failed"});}setUploading(false);};
  const uploadDocument=async(file)=>{if(!file)return;setUploading(true);setToast({message:"Uploading document..."});const url=await uploadFile(file);if(url){setCur(prev=>({...prev,url,description:prev.description||file.name.replace(/\.[^.]+$/,"")}));setMaterialType("document");setToast({message:"Document uploaded"});}else{setToast({message:"Upload failed"});}setUploading(false);};
  const handleDrop=async(e)=>{e.preventDefault();setDragOver(false);const files=[...e.dataTransfer.files].filter(f=>f.type.startsWith("image/"));if(files.length===0)return;setUploading(true);setToast({message:`Uploading ${files.length} image${files.length>1?"s":""}...`});for(let i=0;i<files.length;i++){const url=await uploadSingleImage(files[i]);if(!url)continue;if(i===0&&!cur.image_url){setCur(prev=>({...prev,image_url:url,url:""}));setMaterialType("image");}else{const existing=cur.image_urls?JSON.parse(cur.image_urls||"[]"):[];if(!existing.includes(url))setCur(prev=>({...prev,image_urls:JSON.stringify([...(prev.image_urls?JSON.parse(prev.image_urls||"[]"):[]),url])}));}}setUploading(false);setToast({message:`✓ ${files.length} image${files.length>1?"s":""} uploaded`});};

  // ─── CLIPBOARD PASTE (CMD+V to paste screenshots) ───
  useEffect(()=>{
    if(vw!=="form")return;
    const handlePaste=async(e)=>{
      const items=[...e.clipboardData.items].filter(i=>i.type.startsWith("image/"));
      if(items.length===0)return;
      e.preventDefault();
      setUploading(true);
      setToast({message:"Uploading pasted image..."});
      for(const item of items){
        const file=item.getAsFile();if(!file)continue;
        const url=await uploadSingleImage(file);
        if(!url)continue;
        if(!cur.image_url){
          setCur(prev=>({...prev,image_url:url,url:""}));setMaterialType("image");
        }else{
          setCur(prev=>({...prev,image_urls:JSON.stringify([...(prev.image_urls?JSON.parse(prev.image_urls||"[]"):[]),url])}));
        }
      }
      setUploading(false);
      setToast({message:"✓ Screenshot pasted"});
    };
    window.addEventListener("paste",handlePaste);
    return()=>window.removeEventListener("paste",handlePaste);
  },[vw,cur.image_url,cur.image_urls]);

  // ─── SCREEN CAPTURE TOOL ───
  const captureStreamRef=useRef(null);
  const captureVideoRef=useRef(null);
  const [captureActive,setCaptureActive]=useState(false);
  const [captureCount,setCaptureCount]=useState(0);

  const startCapture=async()=>{
    try{
      const stream=await navigator.mediaDevices.getDisplayMedia({
        video:{displaySurface:"browser"},
        preferCurrentTab:true,
      });
      captureStreamRef.current=stream;
      // Create hidden video element to draw from
      const video=document.createElement("video");
      video.srcObject=stream;
      video.muted=true;
      await video.play();
      captureVideoRef.current=video;
      setCaptureActive(true);
      setCaptureCount(0);
      setToast({message:"Capture mode active — click the capture button anytime"});
      // Auto-stop when user stops sharing
      stream.getVideoTracks()[0].onended=()=>stopCapture();
    }catch(err){
      if(err.name!=="NotAllowedError")setToast({message:"Could not start capture: "+err.message});
    }
  };

  const stopCapture=()=>{
    if(captureStreamRef.current){
      captureStreamRef.current.getTracks().forEach(t=>t.stop());
      captureStreamRef.current=null;
    }
    if(captureVideoRef.current){
      captureVideoRef.current.pause();
      captureVideoRef.current.srcObject=null;
      captureVideoRef.current=null;
    }
    setCaptureActive(false);
  };

  const videoIframeRef=useRef(null);

  const captureFrame=async()=>{
    const video=captureVideoRef.current;
    if(!video||video.readyState<2)return;

    // Get the iframe's position to crop
    const iframe=videoIframeRef.current;
    if(!iframe){return;}
    const rect=iframe.getBoundingClientRect();
    const dpr=window.devicePixelRatio||1;

    // Draw full screen capture to temp canvas
    const fullCanvas=document.createElement("canvas");
    fullCanvas.width=video.videoWidth;
    fullCanvas.height=video.videoHeight;
    fullCanvas.getContext("2d").drawImage(video,0,0);

    // Calculate crop coordinates (map iframe rect to capture coordinates)
    const scaleX=video.videoWidth/window.innerWidth;
    const scaleY=video.videoHeight/window.innerHeight;
    const cropX=Math.round(rect.left*scaleX);
    const cropY=Math.round(rect.top*scaleY);
    const cropW=Math.round(rect.width*scaleX);
    const cropH=Math.round(rect.height*scaleY);

    // Draw cropped region to final canvas
    const canvas=document.createElement("canvas");
    canvas.width=cropW;
    canvas.height=cropH;
    canvas.getContext("2d").drawImage(fullCanvas,cropX,cropY,cropW,cropH,0,0,cropW,cropH);

    // Convert to blob and upload
    const blob=await new Promise(r=>canvas.toBlob(r,"image/jpeg",0.92));
    const file=new File([blob],`capture_${Date.now()}.jpg`,{type:"image/jpeg"});
    setUploading(true);
    const url=await uploadSingleImage(file);
    if(url){
      if(!cur.image_url){
        setCur(prev=>({...prev,image_url:url}));setMaterialType("image");
      }else{
        setCur(prev=>({...prev,image_urls:JSON.stringify([...(prev.image_urls?JSON.parse(prev.image_urls||"[]"):[]),url])}));
      }
      setCaptureCount(c=>c+1);
      setToast({message:`✓ Frame captured (${captureCount+1})`});
    }
    setUploading(false);
  };

  // Clean up capture on unmount or view change
  useEffect(()=>{return()=>{if(captureStreamRef.current)captureStreamRef.current.getTracks().forEach(t=>t.stop());};},[]);
  useEffect(()=>{if(vw!=="form")stopCapture();},[vw]);

  const resizeImageToBase64=async(url,maxW=800,quality=0.75)=>{
    try{
      const img=new Image();img.crossOrigin="anonymous";
      await new Promise((res,rej)=>{img.onload=res;img.onerror=rej;img.src=url+"?t="+Date.now();});
      // Calculate size — keep aspect ratio, max 800px on longest side
      const longest=Math.max(img.width,img.height);
      const scale=Math.min(1,maxW/longest);
      const canvas=document.createElement("canvas");
      canvas.width=Math.round(img.width*scale);
      canvas.height=Math.round(img.height*scale);
      canvas.getContext("2d").drawImage(img,0,0,canvas.width,canvas.height);
      let b64=canvas.toDataURL("image/jpeg",quality).split(",")[1];
      // If still too large (~3.5MB base64 = ~2.6MB binary), compress more aggressively
      if(b64.length>3500000){
        b64=canvas.toDataURL("image/jpeg",0.5).split(",")[1];
      }
      if(b64.length>3500000){
        // Last resort: shrink canvas further
        const canvas2=document.createElement("canvas");
        canvas2.width=Math.round(canvas.width*0.6);
        canvas2.height=Math.round(canvas.height*0.6);
        canvas2.getContext("2d").drawImage(canvas,0,0,canvas2.width,canvas2.height);
        b64=canvas2.toDataURL("image/jpeg",0.5).split(",")[1];
      }
      return b64;
    }catch(err){
      console.warn("Image resize failed:",err);
      return null;
    }
  };

  const analyzeWithAI=async()=>{
    const imgUrl=cur.image_url;const transcript=cur.transcript;const notes=cur.analyst_comment;
    if(!imgUrl&&!transcript){setToast({message:"Add an image or transcript first"});return;}
    setAnalyzing(true);
    try{
      let context=[];
      if(cur.competitor)context.push(`Brand: ${cur.competitor}`);
      if(cur.brand)context.push(`Brand: ${cur.brand}`);
      if(transcript)context.push(`Transcript/copy: ${transcript.slice(0,1500)}`);
      if(notes)context.push(`Analyst observations: ${notes}`);

      // Compress primary image to base64
      let imageBase64=null;
      if(imgUrl){
        setToast({message:"Compressing image..."});
        imageBase64=await resizeImageToBase64(imgUrl,800,0.75);
      }

      // Compress extra images
      const extraImgs=cur.image_urls?JSON.parse(cur.image_urls||"[]"):[];
      const extraBase64=[];
      for(const u of extraImgs.slice(0,3)){
        const b64=await resizeImageToBase64(u,600,0.65);
        if(b64)extraBase64.push(b64);
      }

      const res=await fetch("/api/analyze",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          imageUrl:imageBase64?null:imgUrl,
          imageBase64,
          extraImageUrls:extraBase64.length>0?null:extraImgs,
          extraImageBase64:extraBase64,
          context:context.join("\n")
        })
      });
      if(!res.ok){
        const err=await res.text();
        setToast({message:"Analysis error: "+res.status+" — "+err.slice(0,80)});
        setAnalyzing(false);return;
      }
      const result=await res.json();
      if(result.error){setToast({message:"AI error: "+result.error});setAnalyzing(false);return;}
      if(result.success&&result.analysis){
        autoFill(result.analysis);
        setToast({message:"✓ AI analysis complete"});
      }else{
        setToast({message:"Analysis returned no data"});
      }
    }catch(err){
      setToast({message:"Error: "+err.message});
    }
    setAnalyzing(false);
  };

  const openForm=(entry)=>{const e=entry||{};setCur({...e});setViewingImg(null);if(ytId(e.url))setMaterialType("video");else if(e.url&&/\.(mp4|mov|webm)(\?|$)/i.test(e.url))setMaterialType("videoFile");else if(e.url&&/\.(pdf|doc|docx|txt|rtf)(\?|$)/i.test(e.url))setMaterialType("document");else if(e.image_url)setMaterialType("image");else if(e.url)setMaterialType("web");else setMaterialType("none");setSec(0);router.push(entry?`/audit?edit=${entry.id}`:"/audit?edit=new",{scroll:false});setSbRaw(null);setHighlighted(new Set());};

  let fd=data.filter(e=>Object.entries(fl).every(([k,v])=>!v||(e[k]||"").includes(v)));
  if(sortPreset==="newest")fd=[...fd].sort((a,b)=>(b.created_at||"").localeCompare(a.created_at||""));
  else if(sortPreset==="oldest")fd=[...fd].sort((a,b)=>(a.created_at||"").localeCompare(b.created_at||""));
  else if(sortPreset==="rating")fd=[...fd].sort((a,b)=>(Number(b.rating)||0)-(Number(a.rating)||0));
  else if(sortCol){fd=[...fd].sort((a,b)=>{const va=(a[sortCol]||"").toLowerCase(),vb=(b[sortCol]||"").toLowerCase();return sortDir==="asc"?va.localeCompare(vb):vb.localeCompare(va);});}

  const handleSort=(col)=>{setSortPreset("");if(sortCol===col)setSortDir(d=>d==="asc"?"desc":"asc");else{setSortCol(col);setSortDir("asc");}};
  const getOpts=(f)=>OPTIONS[f.optKey||f.key]||[];
  const getImages=(e)=>{
    const extra=e.image_urls?JSON.parse(e.image_urls||"[]"):[];
    return [e.image_url,...extra].filter(Boolean);
  };
  const addExtraImage=(url)=>{
    const existing=cur.image_urls?JSON.parse(cur.image_urls||"[]"):[];
    if(!existing.includes(url))setCur(prev=>({...prev,image_urls:JSON.stringify([...existing,url])}));
  };
  const removeExtraImage=(idx)=>{
    const existing=cur.image_urls?JSON.parse(cur.image_urls||"[]"):[];
    existing.splice(idx,1);
    setCur(prev=>({...prev,image_urls:JSON.stringify(existing)}));
  };
  const uploadExtraImage=async(file)=>{
    if(!file)return;
    setUploading(true);
    const ext=file.name.split(".").pop();
    const path=`${Date.now()}_extra.${ext}`;
    const{error}=await supabase.storage.from("media").upload(path,file);
    if(!error){
      const{data:{publicUrl}}=supabase.storage.from("media").getPublicUrl(path);
      addExtraImage(publicUrl);
    }
    setUploading(false);
  };
  const sections=getFieldsForScope(scope);
  const fieldStyle=(key)=>highlighted.has(key)?{background:"var(--accent-soft)",borderColor:"var(--accent)",transition:"background 0.3s"}:{};

  if(loading)return <div className="p-10 text-center text-hint">Loading...</div>;

  // ── FORM ──
  if(vw==="form"){
    const y=ytId(cur.url);const vim=vimeoId(cur.url);const imgUrl=cur.image_url;
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
            <button onClick={()=>{router.push("/audit",{scroll:false});setCur({});setMaterialType("none");}} className="px-3 py-1.5 text-sm border border-main rounded-lg text-muted hover:bg-surface2">Cancel</button>
            <button onClick={save} className="px-4 py-1.5 text-sm bg-accent text-white rounded-lg font-semibold hover:opacity-90">Save</button>
          </div>
        </div>
        <div className="flex" style={{height:"calc(100vh - 52px)"}}>
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="bg-surface border-b border-main px-4 py-3 flex-shrink-0">
              {materialType==="none"?(<div><p className="text-sm font-medium text-main mb-2">Choose material type</p><div className="flex gap-2 flex-wrap">{[["video","Video URL"],["videoFile","Video File"],["web","Website URL"],["image","Image"],["document","Document"]].map(([k,l])=>(<button key={k} onClick={()=>setMaterialType(k)} className="flex-1 min-w-[100px] py-3 rounded-lg border border-main text-sm font-medium text-main hover:bg-accent-soft hover:border-[var(--accent)] transition text-center">{l}</button>))}</div></div>
              ):(<div className="space-y-2">
                <div className="flex items-center gap-2"><div className="flex bg-surface2 rounded-lg p-0.5">{[["video","Video URL"],["videoFile","Video File"],["web","Website"],["image","Image"],["document","Document"]].map(([k,l])=>(<button key={k} onClick={()=>{setMaterialType(k);}} className={`px-3 py-1 rounded-md text-xs font-medium transition ${materialType===k?"bg-surface text-accent shadow-sm":"text-muted"}`}>{l}</button>))}</div></div>
                {materialType==="video"&&<div><label className="block text-[9px] text-hint uppercase font-semibold mb-0.5">Video URL (YouTube / Vimeo)</label><input value={cur.url||""} onChange={e=>setVideoUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=... or https://vimeo.com/..." className="w-full px-2 py-1.5 bg-surface2 border border-main rounded text-sm text-main" /></div>}
                {materialType==="videoFile"&&<div className="flex gap-2 items-end"><div className="flex-1"><label className="block text-[9px] text-hint uppercase font-semibold mb-0.5">Upload Video (MP4, MOV, WebM)</label>{cur.url&&!ytId(cur.url)?<p className="text-xs text-accent truncate mb-1">{cur.url.split("/").pop()}</p>:null}<label className="inline-flex px-3 py-1.5 bg-surface2 border border-main rounded text-xs text-muted cursor-pointer hover:bg-accent-soft">{uploading?"Uploading...":"Choose file"}<input type="file" accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm" onChange={e=>{if(e.target.files[0])uploadVideoFile(e.target.files[0]);}} className="hidden" /></label></div></div>}
                {materialType==="web"&&<div><label className="block text-[9px] text-hint uppercase font-semibold mb-0.5">Website URL</label><input value={cur.url||""} onChange={e=>setWebUrl(e.target.value)} placeholder="https://www.example.com" className="w-full px-2 py-1.5 bg-surface2 border border-main rounded text-sm text-main" /></div>}
                {materialType==="image"&&(<div className="flex gap-2"><div className="flex-1"><label className="block text-[9px] text-hint uppercase font-semibold mb-0.5">Image URL</label><input value={cur.image_url||""} onChange={e=>setImageFromUrl(e.target.value)} placeholder="https://...image.jpg" className="w-full px-2 py-1.5 bg-surface2 border border-main rounded text-sm text-main" /></div><div className="flex items-end"><label className="px-3 py-1.5 bg-surface2 border border-main rounded text-xs text-muted cursor-pointer hover:bg-accent-soft">{uploading?"Uploading...":"Upload"}<input type="file" accept="image/*" multiple onChange={async(e)=>{const files=[...e.target.files];if(files.length===0)return;setUploading(true);setToast({message:`Uploading ${files.length} image${files.length>1?"s":""}...`});for(let i=0;i<files.length;i++){const url=await uploadSingleImage(files[i]);if(!url)continue;if(i===0&&!cur.image_url){setCur(prev=>({...prev,image_url:url,url:""}));setMaterialType("image");}else{setCur(prev=>({...prev,image_urls:JSON.stringify([...(prev.image_urls?JSON.parse(prev.image_urls||"[]"):[]),url])}));}}setUploading(false);setToast({message:`✓ ${files.length} image${files.length>1?"s":""} uploaded`});}} className="hidden" /></label></div></div>)}
                {materialType==="document"&&<div><label className="block text-[9px] text-hint uppercase font-semibold mb-0.5">Upload Document (PDF, Word, TXT)</label>{cur.url&&!ytId(cur.url)?<p className="text-xs text-accent truncate mb-1">{cur.url.split("/").pop()}</p>:null}<label className="inline-flex px-3 py-1.5 bg-surface2 border border-main rounded text-xs text-muted cursor-pointer hover:bg-accent-soft">{uploading?"Uploading...":"Choose file"}<input type="file" accept=".pdf,.doc,.docx,.txt,.rtf,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" onChange={e=>{if(e.target.files[0])uploadDocument(e.target.files[0]);}} className="hidden" /></label></div>}
              </div>)}
            </div>
            <div className="flex-1 overflow-auto" onDrop={handleDrop} onDragOver={e=>{e.preventDefault();setDragOver(true);}} onDragLeave={()=>setDragOver(false)}>
              <div className={`flex items-center justify-center p-4 min-h-[250px] transition ${dragOver?"ring-2 ring-[var(--accent)] ring-inset":""}`} style={{background:dragOver?"var(--accent-soft)":"var(--surface2)"}}>
                {materialType==="video"&&(y||vim)?(
                  <div className="w-full">
                    <iframe ref={videoIframeRef} width="100%" height="350" style={{maxWidth:700,margin:"0 auto",display:"block"}} src={y?`https://www.youtube.com/embed/${y}`:`https://player.vimeo.com/video/${vim}`} frameBorder="0" allowFullScreen className="rounded-lg" />
                    {/* Capture tools bar */}
                    <div className="flex items-center justify-center gap-2 mt-3 px-4">
                      {captureActive?(
                        <>
                          <button onClick={captureFrame} disabled={uploading}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white transition disabled:opacity-50 hover:opacity-90"
                            style={{background:"#dc2626"}}>
                            <span className="w-2 h-2 bg-white rounded-full animate-pulse"/>
                            {uploading?"Saving...":"Capture frame"}
                          </button>
                          {captureCount>0&&<span className="text-[10px] text-muted">{captureCount} captured</span>}
                          <button onClick={stopCapture}
                            className="px-3 py-2 text-xs text-muted hover:text-main border border-main rounded-lg transition">
                            Stop
                          </button>
                        </>
                      ):(
                        <>
                          <button onClick={startCapture}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-main rounded-lg text-xs font-medium text-muted hover:text-main hover:border-[var(--accent)] transition">
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="5"/><circle cx="8" cy="8" r="2" fill="currentColor"/></svg>
                            Capture stills
                          </button>
                          <div className="h-4 w-px bg-surface2"/>
                          <span className="text-[9px] text-hint flex items-center gap-1">
                            <kbd className="px-1 py-0.5 bg-surface2 rounded text-[8px] font-mono border border-main">⌘V</kbd> paste screenshot
                          </span>
                        </>
                      )}
                    </div>
                    {captureActive&&(
                      <p className="text-center text-[10px] text-muted mt-2 px-4">
                        Play the video and click <strong>Capture frame</strong> at the moments you want. Each click saves a still to your gallery.
                      </p>
                    )}
                    {/* Filmstrip for captured stills */}
                    {(cur.image_url||(cur.image_urls&&JSON.parse(cur.image_urls||"[]").length>0))&&(
                      <div className="flex gap-2 items-center mt-3 px-2 overflow-x-auto pb-1">
                        {[cur.image_url,...(cur.image_urls?JSON.parse(cur.image_urls||"[]"):[])].filter(Boolean).map((url,i)=>(
                          <div key={i} className="relative group flex-shrink-0">
                            <img src={url} onClick={()=>setZoomImg(url)}
                              className="w-14 h-14 object-cover rounded cursor-pointer opacity-80 hover:opacity-100 transition border border-white/10" alt="" />
                            {i>0&&<button onClick={()=>removeExtraImage(i-1)} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition">×</button>}
                          </div>
                        ))}
                        <span className="text-[9px] text-hint whitespace-nowrap">{[cur.image_url,...(cur.image_urls?JSON.parse(cur.image_urls||"[]"):[])].filter(Boolean).length} stills</span>
                      </div>
                    )}
                  </div>
                )
                :materialType==="image"&&imgUrl&&isImgUrl(imgUrl)?<div className="w-full">
                  <ImageViewer src={viewingImg||imgUrl} />
                  {/* Filmstrip — primary + extras */}
                  {(()=>{const extras=cur.image_urls?JSON.parse(cur.image_urls||"[]"):[];const allImgs=[imgUrl,...extras].filter(Boolean);return allImgs.length>0?(
                    <div className="flex gap-2 items-center mt-2 px-2 overflow-x-auto pb-1"
                      onDrop={async(e)=>{e.preventDefault();e.stopPropagation();const files=[...e.dataTransfer.files].filter(f=>f.type.startsWith("image/"));if(!files.length)return;setUploading(true);setToast({message:`Uploading ${files.length} image${files.length>1?"s":""}...`});for(const file of files){const url=await uploadSingleImage(file);if(url)setCur(prev=>({...prev,image_urls:JSON.stringify([...(prev.image_urls?JSON.parse(prev.image_urls||"[]"):[]),url])}));}setUploading(false);setToast({message:"✓ Images uploaded"});}}
                      onDragOver={e=>{e.preventDefault();e.stopPropagation();}}>
                      {allImgs.map((url,i)=>(
                        <div key={i} className="relative group flex-shrink-0">
                          <img src={url} onClick={()=>setViewingImg(url)}
                            className={`w-14 h-14 object-cover rounded cursor-pointer transition ${(viewingImg||imgUrl)===url?"ring-2 ring-[var(--accent)] opacity-100":"opacity-60 hover:opacity-100"}`} alt="" />
                          {i>0&&<button onClick={(e)=>{e.stopPropagation();removeExtraImage(i-1);if(viewingImg===url)setViewingImg(null);}} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition">×</button>}
                        </div>
                      ))}
                      <label className="w-14 h-14 flex-shrink-0 border-2 border-dashed border-main rounded flex flex-col items-center justify-center cursor-pointer hover:border-[var(--accent)] hover:bg-accent-soft transition">
                        <span className="text-lg text-hint">+</span>
                        <input type="file" accept="image/*" multiple onChange={async(e)=>{const files=[...e.target.files];if(!files.length)return;setUploading(true);for(const file of files){const url=await uploadSingleImage(file);if(url)setCur(prev=>({...prev,image_urls:JSON.stringify([...(prev.image_urls?JSON.parse(prev.image_urls||"[]"):[]),url])}));}setUploading(false);setToast({message:`✓ ${files.length} image${files.length>1?"s":""} added`});}} className="hidden"/>
                      </label>
                    </div>
                  ):null;})()}
                </div>
                :materialType==="videoFile"&&cur.url&&!ytId(cur.url)?<div className="w-full">
                  <video controls width="100%" style={{maxWidth:700,maxHeight:400,margin:"0 auto",display:"block"}} className="rounded-lg" src={cur.url} />
                  <p className="text-center text-[10px] text-hint mt-2">{cur.url.split("/").pop()}</p>
                </div>
                :materialType==="web"&&cur.url?<div className="w-full flex flex-col" style={{height:350}}><iframe src={cur.url} width="100%" className="rounded-lg border border-main flex-1" sandbox="allow-scripts allow-same-origin" /><div className="mt-2 text-center"><a href={cur.url} target="_blank" rel="noopener" className="text-xs text-accent hover:underline">Open in new tab ↗</a></div></div>
                :materialType==="document"&&cur.url?<div className="flex flex-col items-center justify-center gap-3">
                  <div className="w-16 h-20 rounded-lg bg-surface border-2 border-main flex items-center justify-center">
                    <span className="text-2xl">📄</span>
                  </div>
                  <p className="text-sm font-medium text-main">{cur.url.split("/").pop()}</p>
                  <a href={cur.url} target="_blank" rel="noopener" className="text-xs text-accent hover:underline">Open document ↗</a>
                </div>
                :<div className="text-center text-hint"><p className="text-lg mb-2">{dragOver?"Drop images here":materialType==="none"?"Choose a material type above":materialType==="videoFile"?"Upload a video file":materialType==="document"?"Upload a document":"Enter a URL or drop images"}</p><p className="text-xs">{materialType==="image"&&!dragOver?"Drop images, paste screenshots (⌘V), or upload":""}</p></div>}
              </div>
              <div className="bg-surface border-t border-main px-4 py-3 space-y-3">
                <div style={fieldStyle("transcript")}><div className="flex justify-between items-center mb-1"><label className="text-[10px] text-muted uppercase font-semibold">Transcript / Copy</label><span className="text-[9px] text-hint">Paste from YouTube or type what you see</span></div><textarea value={cur.transcript||""} onChange={e=>setCur({...cur,transcript:e.target.value})} rows={4} placeholder="Paste the video transcript, ad copy, or any text content here..." className="w-full px-3 py-2 bg-surface2 border border-main rounded-lg text-sm text-main resize-y" /></div>
                <div style={fieldStyle("analyst_comment")}><div className="flex justify-between items-center mb-1"><label className="text-[10px] text-muted uppercase font-semibold">Analyst notes</label><span className="text-[9px] text-hint">Your observations — also sent to AI</span></div><textarea value={cur.analyst_comment||""} onChange={e=>setCur({...cur,analyst_comment:e.target.value})} rows={3} placeholder="What stands out? Initial observations, strategic notes..." className="w-full px-3 py-2 bg-surface2 border border-main rounded-lg text-sm text-main resize-y" /></div>
                {(cur.image_url||cur.transcript||cur.analyst_comment)&&(<button onClick={analyzeWithAI} disabled={analyzing} className="text-sm bg-accent-soft text-accent border border-[var(--accent)] px-4 py-2 rounded-lg font-medium hover:opacity-80 disabled:opacity-50 w-full">{analyzing?"Analyzing with AI...":"✦ Analyze with AI"}</button>)}
              </div>
            </div>
          </div>

          {/* FORM FIELDS PANEL */}
          <div className="w-[380px] border-l border-main bg-surface overflow-auto">
            <div className="p-3">
              {sections.map((s,si)=>(
                <div key={si} className="mb-1">
                  <div onClick={()=>setSec(sec===si?-1:si)} className={`px-3 py-2 rounded-lg cursor-pointer flex justify-between text-xs font-semibold ${sec===si?"bg-accent-soft text-accent border border-[var(--accent)]":"bg-surface2 border border-main text-main"}`}>
                    <span>{s.title}</span><span className="text-hint">{sec===si?"−":"+"}</span>
                  </div>
                  {sec===si&&(
                    <div className="py-2 space-y-3">
                      {s.fields.filter(f=>f.key!=="url"&&f.key!=="image_url"&&f.key!=="transcript"&&f.key!=="analyst_comment").map(f=>(
                        <div key={f.key} style={fieldStyle(f.key)} className="rounded px-1 -mx-1 transition-all duration-500">
                          <label className="block text-[10px] text-muted uppercase font-semibold mb-0.5">{f.label}</label>
                          {f.key==="country" ? (
                            <CountryInput
                              value={cur[f.key]||""}
                              onChange={v=>setCur({...cur,[f.key]:v})}
                            />
                          ) : f.type==="select" && MULTI_SELECT_FIELDS.has(f.key) ? (
                            <MultiSelect
                              fieldKey={f.key}
                              value={cur[f.key]||""}
                              opts={getOpts(f)}
                              onChange={v=>setCur({...cur,[f.key]:v})}
                            />
                          ) : f.type==="select" ? (
                            <div>
                              <select value={cur[f.key]||""} onChange={e=>setCur({...cur,[f.key]:e.target.value})} className="w-full px-2 py-1.5 bg-surface border border-main rounded text-sm text-main">
                                <option value="">—</option>
                                {getOpts(f).map(o=><option key={o} value={o}>{o}</option>)}
                              </select>
                              {cur[f.key]==="Other"&&<input value={cur[f.key+"_other"]||""} onChange={e=>setCur({...cur,[f.key+"_other"]:e.target.value})} placeholder="Specify..." className="w-full mt-1 px-2 py-1 border border-[var(--accent)] rounded text-xs bg-accent-soft text-main" />}
                            </div>
                          ) : f.type==="textarea" ? (
                            <textarea value={cur[f.key]||""} onChange={e=>setCur({...cur,[f.key]:e.target.value})} rows={2} className="w-full px-2 py-1.5 bg-surface border border-main rounded text-sm text-main resize-y" />
                          ) : (
                            <input value={cur[f.key]||""} onChange={e=>setCur({...cur,[f.key]:e.target.value})} className="w-full px-2 py-1.5 bg-surface border border-main rounded text-sm text-main" />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="p-3 border-t border-main"><button onClick={save} className="w-full bg-accent text-white py-2 rounded-lg text-sm font-semibold hover:opacity-90">{eid?"Save changes":"Save entry"}</button></div>
          </div>
        </div>
        {toast&&<Toast {...toast} onClose={()=>setToast(null)}/>}
      </div>
    );
  }

  // ── LIST ──
  const cols=[{key:"_select",label:"",nosort:true},{key:scope==="local"?"competitor":"brand",label:"Brand"},{key:"category",label:"Cat."},{key:"description",label:"Description"},{key:"year",label:"Yr"},{key:"type",label:"Type"},{key:"communication_intent",label:"Int."},{key:"portrait",label:"Portrait"},{key:"journey_phase",label:"Phase"},{key:"rating",label:"★"},{key:"created_at",label:"Created"},{key:"updated_at",label:"Updated"}];
  const filterKeys=scope==="local"?[["competitor","Competitor"],["category","Category"],["communication_intent","Intent",OPTIONS.communicationIntent],["portrait","Portrait"],["journey_phase","Phase",OPTIONS.journeyPhase],["client_lifecycle","Lifecycle",OPTIONS.clientLifecycle],["brand_archetype","Archetype",OPTIONS.brandArchetype]]:[["category","Category"],["communication_intent","Intent",OPTIONS.communicationIntent],["portrait","Portrait"],["journey_phase","Phase",OPTIONS.journeyPhase],["category_proximity","Proximity",OPTIONS.categoryProximity],["brand_archetype","Archetype",OPTIONS.brandArchetype]];

  const ListIcon=()=><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="2" y1="4" x2="14" y2="4"/><line x1="2" y1="8" x2="14" y2="8"/><line x1="2" y1="12" x2="14" y2="12"/></svg>;
  const GridIcon=()=><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9" y="2" width="5" height="5" rx="1"/><rect x="2" y="9" width="5" height="5" rx="1"/><rect x="9" y="9" width="5" height="5" rx="1"/></svg>;

  return(
    <div className="min-h-screen" style={{background:"var(--bg)"}}>
      <div style={{marginRight:sb?380:0,transition:"margin 0.15s"}}>
        {/* Bar 2 — Section bar: title + scope toggle */}
        <div className="section-bar px-5 py-2.5 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-bold text-main">Audit</h2>
            <div className="flex bg-surface2 rounded-lg p-0.5">
              <button onClick={()=>onScopeChange("local")} className={`px-3 py-1 rounded-md text-xs font-medium transition ${scope==="local"?"bg-surface text-accent shadow-sm":"text-muted hover:text-main"}`}>Local audit</button>
              <button onClick={()=>onScopeChange("global")} className={`px-3 py-1 rounded-md text-xs font-medium transition ${scope==="global"?"bg-surface text-accent shadow-sm":"text-muted hover:text-main"}`}>Global benchmarks</button>
            </div>
            <span className="text-xs text-hint">{fd.length} of {data.length}</span>
          </div>
          {selected.size>0&&<button onClick={bulkDelete} className="px-3 py-1.5 text-xs bg-red-500 text-white rounded-lg font-semibold">Delete {selected.size}</button>}
        </div>
        {/* Bar 3 — Filter + sort + view + export */}
        <div className="bg-surface border-b border-main px-5 py-2 flex justify-between items-center sticky z-[29]" style={{top:"calc(var(--nav-h) + 44px)"}}>
          <div className="flex gap-2 flex-wrap items-center">
            <span className="text-[10px] text-hint uppercase font-semibold">Filter:</span>
            {filterKeys.map(([k,l,opts])=>(<select key={k} value={fl[k]||""} onChange={e=>setFl({...fl,[k]:e.target.value})} className="px-1.5 py-1 border border-main rounded text-xs bg-surface text-main"><option value="">{l}</option>{(opts||OPTIONS[k]||[]).map(o=><option key={o} value={o}>{o}</option>)}</select>))}
            {Object.values(fl).some(Boolean)&&<span onClick={()=>setFl({})} className="text-accent text-xs cursor-pointer">Clear</span>}
          </div>
          <div className="flex gap-2 items-center">
            <select value={sortPreset} onChange={e=>{setSortPreset(e.target.value);setSortCol("created_at");}} className="px-2 py-1 border border-main rounded text-xs bg-surface text-main">
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="rating">Rating</option>
            </select>
            <div className="flex bg-surface2 rounded p-0.5">
              <button onClick={()=>setListMode("list")} className={`p-1 rounded ${listMode==="list"?"bg-surface shadow-sm text-accent":"text-muted"}`}><ListIcon/></button>
              <button onClick={()=>setListMode("grid")} className={`p-1 rounded ${listMode==="grid"?"bg-surface shadow-sm text-accent":"text-muted"}`}><GridIcon/></button>
            </div>
            <button onClick={doExport} className="px-2 py-1 text-xs border border-main rounded text-muted hover:bg-surface2">Export</button>
          </div>
        </div>


        {listMode==="list"?(
          <div className="px-5 pb-5 overflow-x-auto">
            <table className="w-full border-collapse text-xs mt-1">
              <thead><tr className="border-b-2 border-main">
                {cols.map((c,i)=>(<th key={i} onClick={()=>!c.nosort&&handleSort(c.key)} className={`text-left px-2 py-2 text-[10px] text-muted uppercase font-semibold ${!c.nosort?"cursor-pointer hover:text-main select-none":""}`}>{c.key==="_select"?<input type="checkbox" checked={selected.size===fd.length&&fd.length>0} onChange={()=>selected.size===fd.length?setSelected(new Set()):setSelected(new Set(fd.map(e=>e.id)))} />:<span>{c.label} {sortCol===c.key?(sortDir==="asc"?"↑":"↓"):""}</span>}</th>))}<th></th>
              </tr></thead>
              <tbody>{fd.map(e=>{
                const IC=({field,children,className=""})=>{
                  const editing=inlineEdit?.id===e.id&&inlineEdit?.field===field;
                  const opts=inlineOpts[field];
                  const isMulti=MULTI_SELECT_FIELDS.has(field);
                  if(editing&&opts&&isMulti){
                    const curVals=(e[field]||"").split(",").map(v=>v.trim()).filter(Boolean);
                    // Include any legacy values not in current options so they can be unchecked
                    const allOpts=[...opts,...curVals.filter(v=>!opts.includes(v))];
                    return(<td className={"px-1 py-1 relative "+className} onClick={ev=>ev.stopPropagation()} data-inline-multi>
                      <div className="absolute top-full left-0 mt-1 bg-surface border border-main rounded-lg shadow-xl p-2 z-50 min-w-[160px] max-h-[240px] overflow-y-auto" data-inline-multi>
                        {allOpts.map(o=>{
                          const checked=curVals.includes(o);
                          return(<label key={o} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent-soft cursor-pointer text-xs text-main">
                            <input type="checkbox" checked={checked} onChange={()=>{
                              const next=checked?curVals.filter(v=>v!==o):[...curVals,o];
                              inlineSave(e.id,field,next.join(", "),true);
                            }} className="rounded" />
                            {o}
                          </label>);
                        })}
                      </div>
                      <span className="text-xs text-accent">{curVals.join(", ")||"—"}</span>
                    </td>);
                  }
                  if(editing&&opts){
                    return(<td className={"px-1 py-1 "+className} onClick={ev=>ev.stopPropagation()}>
                      <select autoFocus value={e[field]||""} onChange={ev=>{inlineSave(e.id,field,ev.target.value);}} onBlur={()=>setInlineEdit(null)}
                        className="w-full px-1 py-1 bg-surface border border-[var(--accent)] rounded text-xs text-main focus:outline-none">
                        <option value="">—</option>
                        {opts.map(o=><option key={o} value={o}>{o}</option>)}
                      </select>
                    </td>);
                  }
                  // Text input for fields without dropdown options
                  if(editing&&!opts){
                    return(<td className={"px-1 py-1 "+className} onClick={ev=>ev.stopPropagation()}>
                      <input autoFocus defaultValue={e[field]||""} onKeyDown={ev=>{if(ev.key==="Enter"){inlineSave(e.id,field,ev.target.value);}if(ev.key==="Escape")setInlineEdit(null);}} onBlur={ev=>inlineSave(e.id,field,ev.target.value)}
                        className="w-full px-1 py-1 bg-surface border border-[var(--accent)] rounded text-xs text-main focus:outline-none" />
                    </td>);
                  }
                  return(<td className={"px-2 py-2.5 cursor-pointer hover:bg-blue-50 dark:hover:bg-white/5 rounded transition "+className}
                    onClick={ev=>{ev.stopPropagation();setInlineEdit({id:e.id,field});}}>
                    {children}
                  </td>);
                };
                return(<tr key={e.id} className={`border-b border-main cursor-pointer transition-colors ${sb?.id===e.id?"bg-blue-50 dark:bg-blue-950/30 border-l-2 border-l-[#0019FF]":"hover:bg-accent-soft"}`} onClick={()=>setSb(e)}>
                  <td className="px-2 py-2.5" onClick={ev=>ev.stopPropagation()}><input type="checkbox" checked={selected.has(e.id)} onChange={()=>toggleSelect(e.id)} /></td>
                  <td className="px-2 py-2.5">{scope==="local"?<Tag v={e.competitor}/>:<span className="font-medium text-main">{e.brand||"—"}</span>}</td>
                  <IC field="category" className=""><Tag v={e.category}/></IC>
                  <IC field="description" className="max-w-[180px] truncate font-medium text-main">{e.description||"—"}</IC>
                  <IC field="year" className="text-muted">{e.year||"—"}</IC>
                  <IC field="type" className="text-muted">{e.type||"—"}</IC>
                  <IC field="communication_intent" className="text-muted">{e.communication_intent||"—"}</IC>
                  <IC field="portrait" className="text-main">{e.portrait||"—"}</IC>
                  <IC field="journey_phase" className="text-main">{e.journey_phase||"—"}</IC>
                  <IC field="rating" className="text-main">{e.rating?"★".repeat(Number(e.rating)):"—"}</IC>
                  <td className="px-2 py-2.5 text-hint text-[10px] whitespace-nowrap">{fmtDate(e.created_at)}</td>
                  <td className="px-2 py-2.5 text-hint text-[10px] whitespace-nowrap">{fmtDate(e.updated_at)}</td>
                  <td className="px-2 py-2.5" onClick={ev=>ev.stopPropagation()}><span onClick={()=>del(e.id)} className="text-hint hover:text-red-400 cursor-pointer text-sm">×</span></td>
                </tr>);
              })}</tbody>
            </table>
          </div>
        ):(
          <div className="px-5 py-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {fd.map(e=>{
              const thumb=ytId(e.url)?`https://img.youtube.com/vi/${ytId(e.url)}/mqdefault.jpg`:e.image_url;
              return(<div key={e.id} onClick={()=>setSb(e)} className="bg-surface border border-main rounded-lg overflow-hidden cursor-pointer hover:border-[var(--accent)] transition group">
                <div className="h-[120px] bg-surface2 flex items-center justify-center overflow-hidden relative">
                  {thumb?<img src={thumb} className="w-full h-full object-cover" alt=""/>:<div className="text-hint text-xs">No preview</div>}
                  {e.image_urls&&JSON.parse(e.image_urls||"[]").length>0&&<span className="absolute bottom-1 right-1 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded-full">+{JSON.parse(e.image_urls||"[]").length}</span>}
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

      {showAddMenu&&typeof window!=="undefined"&&createPortal(
        <>
          <div className="fixed inset-0" style={{zIndex:9998}} onClick={()=>setShowAddMenu(false)}/>
          <div className="fixed bg-surface border border-main rounded-lg shadow-xl overflow-hidden w-[160px]" style={{zIndex:9999,top:addMenuPos.top,right:addMenuPos.right}}>
            <button onClick={()=>{setShowAddMenu(false);if(scope==="local")openForm(null);else onAddWithScope("local");}} className="w-full text-left px-4 py-2.5 text-sm text-main hover:bg-accent-soft border-b border-main">Local entry</button>
            <button onClick={()=>{setShowAddMenu(false);if(scope==="global")openForm(null);else onAddWithScope("global");}} className="w-full text-left px-4 py-2.5 text-sm text-main hover:bg-accent-soft">Global entry</button>
          </div>
        </>,
        document.body
      )}

      {sb&&(<div className="fixed right-0 w-[380px] bg-surface border-l border-main overflow-auto z-40" style={{boxShadow:"-2px 0 12px rgba(0,0,0,0.05)",top:"var(--nav-h)",height:"calc(100vh - var(--nav-h))"}}>
        <div className="p-3 border-b border-main flex justify-between items-center sticky top-0 bg-surface z-10"><b className="text-sm text-main">{sb.description||sb.competitor||sb.brand}</b><span onClick={()=>setSb(null)} className="cursor-pointer text-lg text-hint hover:text-main">×</span></div>
        {ytId(sb.url)&&<div className="px-3 pt-2"><iframe width="100%" height="195" src={`https://www.youtube.com/embed/${ytId(sb.url)}`} frameBorder="0" allowFullScreen className="rounded-md" /></div>}
        {sb.image_url&&!ytId(sb.url)&&<div className="px-3 pt-2">
          <img src={sb.image_url} className="w-full rounded-md cursor-pointer hover:opacity-90 transition" onClick={()=>setZoomImg(sb.image_url)} title="Click to zoom" />
          {sb.image_urls&&JSON.parse(sb.image_urls||"[]").length>0&&(
            <div className="flex gap-1.5 mt-1.5 flex-wrap">
              {JSON.parse(sb.image_urls||"[]").map((url,i)=>(
                <img key={i} src={url} className="w-16 h-16 object-cover rounded border border-main cursor-pointer hover:opacity-80" onClick={()=>window.open(url,"_blank")}/>
              ))}
            </div>
          )}
        </div>}
        {sb.url&&!ytId(sb.url)&&!sb.image_url&&<div className="px-3 pt-1"><a href={sb.url} target="_blank" className="text-[11px] text-accent break-all">{sb.url}</a></div>}
        <div className="p-3">
          <div className="flex gap-1 flex-wrap mb-2">{sb.competitor&&<Tag v={sb.competitor}/>}{sb.brand&&<span className="text-xs font-semibold text-main bg-surface2 px-1.5 py-0.5 rounded">{sb.brand}</span>}{sb.category&&<Tag v={sb.category}/>}{sb.year&&<span className="bg-surface2 px-1.5 py-0.5 rounded text-[11px] text-main">{sb.year}</span>}{sb.rating&&<span className="text-[11px]">{"★".repeat(Number(sb.rating))}</span>}</div>
          <div className="flex gap-3 mt-1 flex-wrap">{sb.created_by&&<span className="text-[10px] text-hint">Added by <span className="text-main font-medium">{sb.created_by}</span></span>}{sb.created_at&&<span className="text-[10px] text-hint">Created <span className="text-main">{fmtDate(sb.created_at)}</span></span>}{sb.updated_at&&<span className="text-[10px] text-hint">Updated <span className="text-main">{fmtDate(sb.updated_at)}</span></span>}</div>
          {[["Type",sb.type],["Portrait",sb.portrait],["Phase",sb.journey_phase],["Lifecycle",sb.client_lifecycle],["Door",sb.entry_door],["Role",sb.bank_role],["Archetype",sb.brand_archetype],["Tone",sb.tone_of_voice],["Language",sb.language_register],["Territory",sb.primary_territory],["Execution",sb.execution_style],["VP",sb.main_vp],["Slogan",sb.main_slogan]].filter(([,v])=>v&&v!==""&&!v.startsWith("Not ")&&!v.startsWith("None")).map(([l,v])=>(<div key={l} className="text-xs mb-0.5"><span className="text-muted">{l}:</span> <span className="text-main">{v}</span></div>))}
        </div>
        {sb.synopsis&&<div className="px-3 pb-2"><div className="text-[10px] font-semibold text-hint uppercase mb-1">Synopsis</div><div className="text-xs leading-relaxed bg-surface2 p-2 rounded text-main">{sb.synopsis}</div></div>}
        {sb.insight&&<div className="px-3 pb-2"><div className="text-[10px] font-semibold text-hint uppercase mb-1">Insight</div><div className="text-xs leading-relaxed bg-surface2 p-2 rounded text-main">{sb.insight}</div></div>}
        {sb.transcript&&<div className="px-3 pb-2"><div className="text-[10px] font-semibold text-hint uppercase mb-1">Transcript</div><div className="text-xs leading-relaxed bg-surface2 p-2 rounded max-h-[150px] overflow-auto whitespace-pre-wrap text-main">{sb.transcript}</div></div>}
        {sb.analyst_comment&&<div className="px-3 pb-2"><div className="text-[10px] font-semibold text-hint uppercase mb-1">Analyst notes</div><div className="text-xs leading-relaxed bg-surface2 p-2 rounded text-main">{sb.analyst_comment}</div></div>}
        <div className="p-3 border-t border-main sticky bottom-0 bg-surface flex gap-2">
          <button onClick={()=>openForm(sb)} className="flex-1 bg-accent text-white py-2 rounded-lg text-sm font-semibold hover:opacity-90">Edit</button>
          <button onClick={()=>moveEntry(sb)} className="px-3 py-2 border border-main rounded-lg text-xs text-muted hover:text-main hover:bg-surface2 transition" title={`Move to ${scope==="local"?"Global":"Local"}`}>
            {scope==="local"?"→ Global":"→ Local"}
          </button>
        </div>
      </div>)}

      {toast&&<Toast {...toast} onClose={()=>setToast(null)}/>}

      {/* Image zoom modal — via portal to escape stacking contexts */}
      {zoomImg&&typeof window!=="undefined"&&createPortal(
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center cursor-pointer animate-fadeIn" style={{zIndex:99999}} onClick={()=>setZoomImg(null)}>
          <button className="absolute top-5 right-5 text-white/60 hover:text-white text-3xl w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 transition" onClick={()=>setZoomImg(null)}>×</button>
          <img src={zoomImg} className="max-w-[92vw] max-h-[92vh] object-contain rounded-lg shadow-2xl" onClick={e=>e.stopPropagation()} alt="" />
        </div>,
        document.body
      )}
    </div>
  );
}

function AuditPageInner(){
  const[scope,setScope]=useState("local");
  const[pendingForm,setPendingForm]=useState(false);
  const[initialEntry,setInitialEntry]=useState(null);
  const{projectId}=useProject();
  const handleScopeChange=(s)=>{setScope(s);};
  const handleAddWithScope=(s)=>{if(s!==scope){setScope(s);setPendingForm(true);}else setPendingForm(true);};

  // Handle URL params: ?scope=...&add=1 or ?id=...
  useEffect(()=>{
    if(typeof window==="undefined"||!projectId)return;
    const params=new URLSearchParams(window.location.search);
    const s=params.get("scope");
    const entryId=params.get("id");

    if(entryId){
      // Search both tables to find the entry and set correct scope
      (async()=>{
        const supabase=createClient();
        const[{data:local},{data:global}]=await Promise.all([
          supabase.from("audit_entries").select("*").eq("id",entryId),
          supabase.from("audit_global").select("*").eq("id",entryId),
        ]);
        const localMatch=(local||[])[0];
        const globalMatch=(global||[])[0];
        if(localMatch){setScope("local");setInitialEntry(localMatch);}
        else if(globalMatch){setScope("global");setInitialEntry(globalMatch);}
      })();
    } else if(s&&(s==="local"||s==="global")){
      handleAddWithScope(s);
      window.history.replaceState({},"","/audit");
    }
  },[projectId]);

  // Listen for custom "openAddForm" event from Nav (when already on /audit)
  useEffect(()=>{
    const handler=(e)=>{
      const s=e.detail?.scope||"local";
      handleAddWithScope(s);
    };
    window.addEventListener("openAddForm",handler);
    return()=>window.removeEventListener("openAddForm",handler);
  },[scope]);

  return(<AuthGuard><ProjectGuard><Nav/><AuditContent scope={scope} onScopeChange={handleScopeChange} onAddWithScope={handleAddWithScope} pendingForm={pendingForm} clearPendingForm={()=>setPendingForm(false)} projectId={projectId} initialEntry={initialEntry} clearInitialEntry={()=>setInitialEntry(null)} key={scope}/></ProjectGuard></AuthGuard>);
}

export default function AuditPage(){
  return(<Suspense fallback={<div className="p-10 text-center text-hint">Loading...</div>}><AuditPageInner/></Suspense>);
}
