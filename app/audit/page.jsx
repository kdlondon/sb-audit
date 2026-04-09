"use client";
import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { STATIC_OPTIONS, fetchOptions, COMPETITOR_COLORS, getFieldsForScope, getSections, getTableName } from "@/lib/options";
import { useFramework } from "@/lib/framework-context";
import AuthGuard from "@/components/AuthGuard";
import Nav from "@/components/Nav";
import ProjectGuard from "@/components/ProjectGuard";
import { useProject } from "@/lib/project-context";
import dynamic from "next/dynamic";
const ImageCropper = dynamic(() => import("@/components/ImageCropper"), { ssr: false });
const MiniEditor = dynamic(() => import("@/components/MiniEditor"), { ssr: false });
import DropdownCheckbox, { StarRating } from "@/components/DropdownCheckbox";
import { getFieldValue } from "@/lib/system-dimensions";

function ytId(u){if(!u)return null;const m=u.match(/(?:youtube\.com\/watch\?.*v=|youtu\.be\/)([^&\s]+)/);return m?m[1]:null;}
function vimeoId(u){if(!u)return null;const m=u.match(/vimeo\.com\/(\d+)/);return m?m[1]:null;}
function isImgUrl(u){return u&&(/\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(u)||(u.includes("supabase.co/storage")&&!/\.(mp4|mov|webm|avi)(\?|$)/i.test(u)));}
function isVideoFile(u){return u&&/\.(mp4|mov|webm|avi)(\?|$)/i.test(u);}
function Tag({v}){return <span style={{background:COMPETITOR_COLORS[v]||"#888",color:"#fff",padding:"1px 6px",borderRadius:3,fontSize:11,fontWeight:600}}>{v}</span>;}

function ImageViewer({src,onCrop}){
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
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-black/50 backdrop-blur-sm rounded-full px-2 py-1" onMouseDown={e=>e.stopPropagation()}>
        <button onClick={()=>setScale(s=>Math.max(0.5,s-0.25))} className="text-white/70 hover:text-white w-6 h-6 flex items-center justify-center text-lg rounded-full hover:bg-white/10">−</button>
        <span className="text-white/60 text-[10px] font-mono w-10 text-center">{Math.round(scale*100)}%</span>
        <button onClick={()=>setScale(s=>Math.min(5,s+0.25))} className="text-white/70 hover:text-white w-6 h-6 flex items-center justify-center text-lg rounded-full hover:bg-white/10">+</button>
        {scale!==1&&<button onClick={reset} className="text-white/50 hover:text-white text-[9px] ml-1 px-1.5 py-0.5 rounded hover:bg-white/10">Reset</button>}
        {onCrop&&<button onMouseDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();onCrop();}} className="text-white/70 hover:text-white text-[9px] ml-1 px-1.5 py-0.5 rounded hover:bg-white/10 border border-white/20" title="Crop image">Crop</button>}
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
  "business_size","industry_shown","channel","brand_archetype","funnel","communication_intent",
  "execution_style","tone_of_voice","representation","cta","category_proximity","category"
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
function MultiSelect({ fieldKey, value, opts, onChange, projectId, optKey }) {
  const [otherInput, setOtherInput] = useState("");
  const [showOther, setShowOther] = useState(false);
  const selected = value ? value.split(",").map(v => v.trim()).filter(Boolean) : [];

  const toggle = (opt) => {
    if (opt === "Other") {
      setShowOther(!showOther);
      return;
    }
    const next = selected.includes(opt)
      ? selected.filter(v => v !== opt)
      : [...selected, opt];
    onChange(next.join(", "));
  };

  const addOtherValue = async () => {
    const val = otherInput.trim();
    if (!val) return;
    const next = [...selected, val];
    onChange(next.join(", "));
    setOtherInput("");
    setShowOther(false);
    // Save to dropdown_options for this project so it appears in future entries
    if (projectId && optKey) {
      const supabase = createClient();
      const category = optKey || fieldKey;
      const { data: existing } = await supabase.from("dropdown_options").select("id").eq("project_id", projectId).eq("category", category).eq("value", val);
      if (!existing || existing.length === 0) {
        await supabase.from("dropdown_options").insert({ project_id: projectId, category, value: val, sort_order: 999 });
      }
    }
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
              opt === "Other" && showOther
                ? "bg-yellow-50 border-yellow-400 text-yellow-700"
                : selected.includes(opt)
                ? "bg-accent-soft border-[var(--accent)] text-accent"
                : "bg-surface border-main text-muted hover:border-[var(--accent)] hover:text-main"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
      {showOther && (
        <div className="flex gap-2 mt-2">
          <input value={otherInput} onChange={e => setOtherInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addOtherValue()}
            placeholder="Type custom value and press Enter..."
            className="flex-1 px-2 py-1 bg-surface border border-main rounded text-xs text-main focus:outline-none focus:border-accent" autoFocus />
          <button onClick={addOtherValue} className="px-2 py-1 bg-accent text-white rounded text-xs font-semibold">Add</button>
        </div>
      )}
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

function AuditContent({scope,onScopeChange,onAddWithScope,pendingForm,clearPendingForm,projectId,initialEntry,clearInitialEntry,initialCollectionId,clearInitialCollectionId}){
  const {framework,frameworkLoaded}=useFramework()||{};
  const {brandId,brand}=require("@/lib/brand-context").useBrand()||{};
  const {activeOrg,userEmail}=require("@/lib/role-context").useRole()||{};
  const orgId=activeOrg?.id;
  const [data,setData]=useState([]);
  const [OPTIONS,setOPTIONS]=useState(STATIC_OPTIONS);
  const [taxonomyTerms, setTaxonomyTerms] = useState({});
  const [localCompetitors, setLocalCompetitors] = useState([]);
  const [globalBrands, setGlobalBrands] = useState([]);
  const [formScope, setFormScope] = useState(scope || "local");
  const [globalBrandConfirmed, setGlobalBrandConfirmed] = useState(false);
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
  const [downloading,setDownloading]=useState(false);
  const [ytLoading,setYtLoading]=useState(false);
  const [showAddMenu,setShowAddMenu]=useState(false);
  const [dragOver,setDragOver]=useState(false);
  const [zoomImg,setZoomImg]=useState(null);
  const [viewingImg,setViewingImg]=useState(null); // which image is shown in viewer
  const [cropSrc,setCropSrc]=useState(null); // image URL being cropped
  const [cropTarget,setCropTarget]=useState(null); // "primary" | "sidebar" | index for extras
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
  const [viewMode,setViewMode]=useState("entries"); // "entries" or "collections"
  const [collections,setCollections]=useState([]);
  const [collectionsLoading,setCollectionsLoading]=useState(false);
  const [activeCollection,setActiveCollection]=useState(null); // viewing a specific collection
  const [collectionEntries,setCollectionEntries]=useState([]);
  const [showNewCollection,setShowNewCollection]=useState(false);
  const [newCol,setNewCol]=useState({name:"",description:"",objective:"",is_private:false});
  const [editingCollection,setEditingCollection]=useState(null);
  const [showAddToCollection,setShowAddToCollection]=useState(false);
  const [quickNewColName,setQuickNewColName]=useState("");
  const [showQuickNewCol,setShowQuickNewCol]=useState(false);
  const [collectionMenuOpen,setCollectionMenuOpen]=useState(null);
  const [presentationMode,setPresentationMode]=useState(false);
  const [presIndex,setPresIndex]=useState(0);
  const [presAutoplay,setPresAutoplay]=useState(false);
  // Auto-play YouTube after 6s on each slide
  useEffect(()=>{
    if(!presentationMode)return;
    setPresAutoplay(false);
    const timer=setTimeout(()=>setPresAutoplay(true),10000);
    return()=>clearTimeout(timer);
  },[presIndex,presentationMode]);
  const [aiStoryLoading,setAiStoryLoading]=useState(false);
  const [aiStorySuggestion,setAiStorySuggestion]=useState(null);
  const [showReportModal,setShowReportModal]=useState(false);
  const [reportInstructions,setReportInstructions]=useState("");
  const [reportGenerating,setReportGenerating]=useState(false);
  const [reportToast,setReportToast]=useState(null); // {reportId, title}
  const [sortPreset,setSortPreset]=useState("newest");
  const [addMenuPos,setAddMenuPos]=useState({top:0,right:0});
  const addBtnRef=useRef(null);
  const fmtDate=(d)=>{if(!d)return"—";const dt=new Date(d);return dt.toLocaleDateString("en-GB",{day:"2-digit",month:"short"})+" "+dt.toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"});};
  const supabase=createClient();

  const load=useCallback(async()=>{
    setLoading(true);
    const{data:rows}=await supabase.from(getTableName(scope)).select("*").eq("project_id",projectId).eq("scope",scope).order("created_at",{ascending:false});
    setData(rows||[]);setLoading(false);setSelected(new Set());setSbRaw(null);
  },[scope]);

  useEffect(()=>{
    load();
    fetchOptions(projectId).then(o=>setOPTIONS(o));
    // Load taxonomy terms + competitors + brand defaults
    (async()=>{
      const s=createClient();
      // Taxonomy terms
      const{data:terms}=await s.from("taxonomy_terms").select("*").eq("is_active",true).order("sort_order");
      if(terms){
        const grouped={};
        terms.forEach(t=>{
          if(!grouped[t.taxonomy_type])grouped[t.taxonomy_type]=[];
          grouped[t.taxonomy_type].push({...t});
        });
        setTaxonomyTerms(grouped);
      }
      // Competitors for brand dropdowns
      if(brandId){
        const{data:comps}=await s.from("brand_competitors").select("competitor_brand_id").eq("own_brand_id",brandId);
        if(comps?.length){
          const compIds=comps.map(c=>c.competitor_brand_id);
          // Local competitors (scope=local only, excludes own brand)
          const{data:localB}=await s.from("brands").select("id,name").in("id",compIds).eq("scope","local").order("name");
          setLocalCompetitors(localB||[]);
          // Global brands from same competitor set (scope=global)
          const{data:globalB}=await s.from("brands").select("id,name").in("id",compIds).eq("scope","global").order("name");
          setGlobalBrands(globalB||[]);
        }
      }
    })();
  },[load]);

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
    if(editParam==="new"){
      // Pre-fill defaults from active brand
      (async()=>{
        const defaults = { scope: formScope };
        if(brandId){
          const s=createClient();
          const{data:ownBrand}=await s.from("brands").select("market,category").eq("id",brandId).single();
          if(ownBrand?.market) defaults.country = ownBrand.market;
          if(ownBrand?.category) defaults.category = ownBrand.category;
        } else {
          if(brand?.market) defaults.country = brand.market;
          if(brand?.category) defaults.category = brand.category;
        }
        setCur(defaults);
      })();
      setMaterialType("none");
      return;
    }
    const entry=data.find(x=>x.id===editParam);
    if(entry){
      setCur({...entry});
      if(entry.scope) setFormScope(entry.scope);
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

  // Auto-fill R2B from communication fields
  const autoFillR2B=useCallback(()=>{
    if(cur.r2b)return; // Don't overwrite existing
    const parts=[];
    if(cur.emotional_benefit)parts.push(`Emotional: ${cur.emotional_benefit}`);
    if(cur.rational_benefit)parts.push(`Rational: ${cur.rational_benefit}`);
    if(cur.main_vp)parts.push(`VP: ${cur.main_vp}`);
    if(cur.insight)parts.push(`Insight: ${cur.insight}`);
    if(parts.length>=2){
      setCur(prev=>({...prev,r2b:`${prev.emotional_benefit||""} → ${prev.rational_benefit||""} → ${prev.main_vp||""}`}));
      highlightFields(["r2b"]);
    }
  },[cur.emotional_benefit,cur.rational_benefit,cur.main_vp,cur.insight,cur.r2b]);
  useEffect(()=>{autoFillR2B();},[cur.emotional_benefit,cur.rational_benefit,cur.main_vp]);

  const { getAllFieldKeys: _getAllKeys } = require("@/lib/system-dimensions");
  const ALL_COLUMNS = _getAllKeys(framework);
  // Legacy aliases kept for backward compat
  const LOCAL_COLUMNS = ALL_COLUMNS;
  const GLOBAL_COLUMNS = ALL_COLUMNS;

  const prepareSaveData=(rawCur)=>{
    const allowed=new Set(ALL_COLUMNS);
    const merged={...rawCur};
    // Handle "Other" overrides from selects
    Object.keys(merged).forEach(k=>{
      if(k.endsWith("_other") && merged[k]){
        const baseKey = k.replace("_other","");
        if(merged[baseKey]==="Other" || merged[baseKey]==="__other__"){
          merged[baseKey] = merged[k];
        }
      }
    });
    // Clean __other__ sentinel values
    Object.keys(merged).forEach(k=>{
      if(merged[k]==="__other__") merged[k] = "";
    });
    const e={};
    Object.keys(merged).forEach(k=>{
      if(allowed.has(k)&&!k.endsWith("_other"))e[k]=merged[k];
    });
    delete e.created_at;
    // Ensure critical fields
    e.scope = merged.scope || formScope || "local";
    e.brand_name = merged.brand_name || (e.scope === "local" ? (merged.competitor || "") : (merged.brand || ""));
    e.competitor = e.scope === "local" ? (merged.competitor || merged.brand_name || "") : undefined;
    e.brand = e.scope === "global" ? (merged.brand || merged.brand_name || "") : undefined;
    e.country = merged.country || "";
    e.category = merged.category || "";
    e.sub_category = merged.sub_category || "";
    e.category_proximity = merged.category_proximity || "";
    e.insight_type = merged.insight_type || "";
    e.creative_approach = merged.creative_approach || "";
    e.custom_dimensions = merged.custom_dimensions || {};
    e.brand_id = merged.brand_id || brandId || null;
    e.organization_id = orgId || null;
    // Clean undefined values and ensure custom_dimensions is proper JSON
    Object.keys(e).forEach(k => { if (e[k] === undefined) delete e[k]; });
    if (typeof e.custom_dimensions === "string") {
      try { e.custom_dimensions = JSON.parse(e.custom_dimensions); } catch { e.custom_dimensions = {}; }
    }
    return e;
  };

  const save=async()=>{
    const e=prepareSaveData(cur);
    if(!e.competitor&&!e.brand&&!e.brand_name&&!e.description){setToast({message:"Please fill at least a brand or description"});return;}

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
      e.brand_id=brandId;
      e.updated_at=new Date().toISOString();
      // Safety: remove any fields not in the allowed set that may have leaked in
      const finalAllowed=new Set(ALL_COLUMNS);
      Object.keys(e).forEach(k=>{if(!finalAllowed.has(k))delete e[k];});
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
    year:Array.from({length:27},(_,i)=>String(2000+i)),
    category:OPTIONS.category||[],
    brand_archetype:OPTIONS.brandArchetype||[],
  };
  const bulkDelete=async()=>{if(selected.size===0||!confirm(`Delete ${selected.size} entries?`))return;for(const id of selected){await supabase.from(getTableName(scope)).delete().eq("id",id);}if(sb&&selected.has(sb.id))setSb(null);load();};

  // ── COLLECTIONS ──────────────────────────────────────────────────────────────
  const loadCollections=useCallback(async()=>{
    if(!brandId)return;
    setCollectionsLoading(true);
    const{data:cols}=await supabase.from("collections").select("*").eq("brand_id",brandId).order("created_at",{ascending:false});
    if(cols){
      for(const c of cols){
        const{count}=await supabase.from("collection_entries").select("*",{count:"exact",head:true}).eq("collection_id",c.id);
        c.entryCount=count||0;
      }
      setCollections(cols);
    }
    setCollectionsLoading(false);
  },[brandId]);

  useEffect(()=>{if(viewMode==="collections")loadCollections();},[viewMode,loadCollections]);

  // Handle direct collection URL (?collection=<id> or ?view=collections)
  useEffect(()=>{
    if(!initialCollectionId||!brandId)return;
    setViewMode("collections");
    if(initialCollectionId==="list"){
      loadCollections();
      clearInitialCollectionId?.();
    } else {
      (async()=>{
        const{data:col}=await supabase.from("collections").select("*").eq("id",initialCollectionId).single();
        if(col)openCollection(col);
        clearInitialCollectionId?.();
      })();
    }
  },[initialCollectionId,brandId]);

  const createCollection=async(colData)=>{
    const{data:created,error}=await supabase.from("collections").insert({
      name:colData.name,
      description:colData.description||null,
      objective:colData.objective||null,
      is_private:colData.is_private||false,
      brand_id:brandId,
      organization_id:orgId||null,
      created_by:userEmail||"",
    }).select().single();
    if(error){setToast({message:"Error creating collection: "+error.message});return null;}
    setShowNewCollection(false);
    setNewCol({name:"",description:"",objective:"",is_private:false});
    loadCollections();
    return created;
  };

  const updateCollection=async(id,updates)=>{
    const{error}=await supabase.from("collections").update({...updates,updated_at:new Date().toISOString()}).eq("id",id);
    if(error){setToast({message:"Error updating: "+error.message});return;}
    setEditingCollection(null);
    if(activeCollection?.id===id)setActiveCollection(prev=>({...prev,...updates}));
    loadCollections();
  };

  const deleteCollection=async(id)=>{
    if(!confirm("Delete this collection? Entries will not be deleted."))return;
    await supabase.from("collection_entries").delete().eq("collection_id",id);
    const{error}=await supabase.from("collections").delete().eq("id",id);
    if(error){setToast({message:"Error deleting: "+error.message});return;}
    if(activeCollection?.id===id)setActiveCollection(null);
    loadCollections();
  };

  const openCollection=async(col)=>{
    setActiveCollection(col);
    // Update URL to include collection ID
    router.push(`/audit?collection=${col.id}`,{scroll:false});
    const{data:links}=await supabase.from("collection_entries").select("entry_id,sort_order,custom_title,custom_note,interstitial_note").eq("collection_id",col.id).order("sort_order",{ascending:true});
    if(!links||links.length===0){setCollectionEntries([]);return;}
    const entryIds=links.map(l=>l.entry_id);
    const{data:entries}=await supabase.from("creative_source").select("*").in("id",entryIds);
    // Merge custom fields and maintain sort order
    const ordered=links.map(l=>{
      const entry=(entries||[]).find(e=>e.id===l.entry_id);
      return entry?{...entry,_custom_title:l.custom_title,_custom_note:l.custom_note,_interstitial_note:l.interstitial_note,_sort_order:l.sort_order}:null;
    }).filter(Boolean);
    setCollectionEntries(ordered);
  };

  const addToCollection=async(collectionId,entryIds)=>{
    for(const entryId of entryIds){
      await supabase.from("collection_entries").insert({
        collection_id:collectionId,
        entry_id:entryId,
        added_by:userEmail||"",
      }).select();
    }
    setSelected(new Set());
    setShowAddToCollection(false);
    setToast({message:`Added ${entryIds.length} ${entryIds.length===1?"entry":"entries"} to collection`});
    if(activeCollection?.id===collectionId)openCollection(activeCollection);
    loadCollections();
  };

  const removeFromCollection=async(collectionId,entryId)=>{
    await supabase.from("collection_entries").delete().eq("collection_id",collectionId).eq("entry_id",entryId);
    if(activeCollection?.id===collectionId){
      setCollectionEntries(prev=>prev.filter(e=>e.id!==entryId));
      setActiveCollection(prev=>({...prev,entryCount:(prev.entryCount||1)-1}));
    }
    loadCollections();
  };

  // Drag-and-drop reorder — with insertion indicator
  const dragRef=useRef(null);
  const [dragOverIdx,setDragOverIdx]=useState(null);
  const [dragHalf,setDragHalf]=useState(null); // "top" or "bottom" — which half of the card is hovered
  const handleReorderDragStart=(e,idx)=>{dragRef.current=idx;e.dataTransfer.effectAllowed="move";};
  const handleReorderDragEnd=(e)=>{dragRef.current=null;setDragOverIdx(null);setDragHalf(null);};
  const handleReorderDragOver=(e,idx)=>{
    e.preventDefault();e.dataTransfer.dropEffect="move";
    const rect=e.currentTarget.getBoundingClientRect();
    const half=(e.clientY-rect.top)<rect.height/2?"top":"bottom";
    if(dragOverIdx!==idx||dragHalf!==half){setDragOverIdx(idx);setDragHalf(half);}
  };
  const getInsertIdx=()=>{
    if(dragOverIdx===null||dragRef.current===null)return null;
    return dragHalf==="top"?dragOverIdx:dragOverIdx+1;
  };
  const handleReorderDrop=async(e,toIdx)=>{
    e.preventDefault();
    const fromIdx=dragRef.current;
    const insertAt=getInsertIdx();
    dragRef.current=null;setDragOverIdx(null);setDragHalf(null);
    if(fromIdx===null||insertAt===null)return;
    // Adjust insert index if dragging from above
    let finalIdx=insertAt;
    if(fromIdx<insertAt)finalIdx--;
    if(fromIdx===finalIdx)return;
    const updated=[...collectionEntries];
    const [moved]=updated.splice(fromIdx,1);
    updated.splice(finalIdx,0,moved);
    setCollectionEntries(updated);
    // Persist sort order
    const colId=activeCollection?.id;if(!colId)return;
    for(let i=0;i<updated.length;i++){
      await supabase.from("collection_entries").update({sort_order:i}).eq("collection_id",colId).eq("entry_id",updated[i].id);
    }
  };

  // Update custom title/note for an entry in a collection
  const _cleanHtml=(v)=>{if(!v)return null;const t=v.replace(/<[^>]*>/g,"").replace(/&nbsp;/g," ").trim();return t.length>0?v:null;};
  const updateEntryCustom=async(entryId,field,value)=>{
    if(!activeCollection?.id)return;
    const cleanVal=(field==="custom_note"||field==="interstitial_note")?_cleanHtml(value):value;
    const updateMap={custom_title:{custom_title:cleanVal},custom_note:{custom_note:cleanVal},interstitial_note:{interstitial_note:cleanVal}};
    const update=updateMap[field];
    if(!update)return;
    await supabase.from("collection_entries").update(update).eq("collection_id",activeCollection.id).eq("entry_id",entryId);
    setCollectionEntries(prev=>prev.map(e=>e.id===entryId?{...e,[`_${field}`]:value}:e));
  };

  // ── AI STORYTELLING ─────────────────────────────────────────────────────────
  const requestAiStorytelling=async()=>{
    if(!activeCollection||collectionEntries.length<2)return;
    setAiStoryLoading(true);
    setAiStorySuggestion(null);
    try{
      const entrySummaries=collectionEntries.map((e,i)=>({
        id:e.id,
        current_position:i,
        brand:e.competitor||e.brand_name||"",
        description:e.description||"",
        category:e.category||"",
        type:e.type||"",
        year:e.year||"",
        rating:e.rating||"",
        communication_intent:e.communication_intent||"",
        portrait:e.portrait||"",
        journey_phase:e.journey_phase||"",
        funnel:e.funnel||"",
        brand_archetype:e.brand_archetype||"",
        main_slogan:e.main_slogan||"",
        transcript:e.transcript?e.transcript.slice(0,500):"",
        entry_door:e.entry_door||"",
        channel:e.channel||"",
      }));
      const collectionContext=`Collection: "${activeCollection.name}"${activeCollection.description?`\nDescription: ${activeCollection.description}`:""}${activeCollection.objective?`\nObjective: ${activeCollection.objective}`:""}`;
      const res=await fetch("/api/ai",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
        skip_framework:true,
        system:`You are a senior creative strategist who builds compelling narrative arcs from competitive intelligence cases. You think like a documentary filmmaker — every case is a scene, and the presentation must flow like a story.

${collectionContext}

You will receive a list of advertising/marketing cases (entries). Your job is to find the CONNECTIVE TISSUE between them and build a fluid, cohesive narrative.

STORYTELLING RULES:
- Find the KEY PATTERNS across cases: recurring themes, evolving strategies, contrasting approaches, emotional progressions, or strategic tensions.
- Each slide title must CONNECT to the previous and next one. Titles should read like chapter headings of the same book — they must feel like a continuous thought, not isolated labels.
- Think in narrative arcs: setup → tension → insight → resolution. Or: thesis → antithesis → synthesis.
- Use transitions: "From X to Y", "But then...", "Meanwhile...", "The counterpoint", "What if instead...", "Building on this..."
- Analyst notes must explicitly state HOW this case connects to the one before and after it. What pattern does it reinforce? What contrast does it reveal? What evolution does it show?
- Group by strategic insight, NOT by brand. The story is about IDEAS and PATTERNS, not a brand-by-brand catalog.
- If cases share similar approaches, place them together to build momentum. If one breaks the pattern, use it as a turning point.
- The opening case should set the strategic question or theme. The closing case should deliver the key takeaway or provocation.

TITLES STYLE:
- Max 8 words. Evocative, not descriptive.
- They should work as a sequence — reading just the titles should tell a mini-story.
- Avoid generic titles like "Brand X Campaign" — instead use insight-driven titles like "When Trust Becomes the Product" or "The Shift from Features to Feelings".

ANALYST NOTES:
- 2 sentences max. First sentence: what this case reveals. Second sentence: how it connects to the narrative (bridges to next case or reinforces the pattern).

IMPORTANT: Return ONLY valid JSON. No markdown, no code fences. Use this exact structure:
{
  "narrative": "The overarching narrative logic — what story are we telling and why this order makes it compelling (3-4 sentences)",
  "entries": [
    {"id": "entry-uuid", "slide_title": "Title here", "analyst_note": "Note here"},
    ...
  ]
}

The entries array must contain ALL entries in the suggested order (first = opening, last = closing). Every entry from the input must appear exactly once.
Write all output in English.`,
        messages:[{role:"user",content:`Here are the ${entrySummaries.length} entries to organize:\n\n${JSON.stringify(entrySummaries,null,2)}`}],
        max_tokens:3000,
      })});
      const data=await res.json();
      if(data.error){setToast({message:"AI error: "+data.error});setAiStoryLoading(false);return;}
      const text=(data.content||[])[0]?.text||"";
      const parsed=JSON.parse(text);
      if(!parsed.entries||!Array.isArray(parsed.entries)){throw new Error("Invalid response structure");}
      setAiStorySuggestion(parsed);
    }catch(err){
      console.error("AI storytelling error:",err);
      setToast({message:"Failed to get AI suggestion. Try again."});
    }
    setAiStoryLoading(false);
  };

  const applyAiStorytelling=async()=>{
    if(!aiStorySuggestion||!activeCollection)return;
    const colId=activeCollection.id;
    // Reorder and update titles/notes
    for(let i=0;i<aiStorySuggestion.entries.length;i++){
      const s=aiStorySuggestion.entries[i];
      await supabase.from("collection_entries").update({
        sort_order:i,
        custom_title:s.slide_title||null,
        custom_note:s.analyst_note||null,
      }).eq("collection_id",colId).eq("entry_id",s.id);
    }
    // Refresh the collection view
    await openCollection(activeCollection);
    setAiStorySuggestion(null);
    setToast({message:"Storytelling applied — entries reordered with titles and notes"});
  };

  // ── GENERATE REPORT FROM COLLECTION ────────────────────────────────────────
  const generateCollectionReport=async()=>{
    if(!activeCollection||collectionEntries.length===0||!reportInstructions.trim())return;
    setReportGenerating(true);
    try{
      const entriesData=collectionEntries.map((e,i)=>({
        id:e.id,
        position:i+1,
        brand:e.competitor||e.brand_name||"",
        title:e.description||"",
        category:e.category||"",
        type:e.type||"",
        year:e.year||"",
        rating:e.rating||"",
        communication_intent:e.communication_intent||"",
        main_slogan:e.main_slogan||"",
        synopsis:e.synopsis||"",
        insight:e.insight||"",
        idea:e.idea||"",
        primary_territory:e.primary_territory||"",
        portrait:e.portrait||"",
        brand_archetype:e.brand_archetype||"",
        funnel:e.funnel||"",
        journey_phase:e.journey_phase||"",
        tone_of_voice:e.tone_of_voice||"",
        transcript:e.transcript?e.transcript.slice(0,300):"",
        slide_title:e._custom_title||"",
        analyst_note:e._custom_note||"",
      }));
      const system=`You are a senior competitive intelligence analyst creating a professional report. Write in clear, analytical English with markdown formatting (## headers, **bold**, tables where appropriate).

Collection: "${activeCollection.name}"
${activeCollection.description?`Description: ${activeCollection.description}`:""}
${activeCollection.objective?`Objective: ${activeCollection.objective}`:""}
Number of cases: ${entriesData.length}

The user will provide specific instructions for what kind of report they need. Use ALL the case data provided to build a thorough, insight-driven report.

CITATION FORMAT: [descriptive name](cite:ENTRY_ID) — e.g., [their Rise Entrepreneur campaign](cite:abc123)
- Every case you mention MUST be cited using its exact ID from the data.
- The descriptive name IS the link — do NOT mention the case name and then repeat it as a separate citation. One mention, as a link.
- Use natural short names: "the Rise Entrepreneur spot", "their Built Different campaign", "the SumUp community ad"
- NEVER create fake citation IDs. Every (cite:ID) MUST use an exact ID from the case data.
- Do NOT place citations inside markdown table rows — only in prose and bullet points.
- Include a ## Sources section at the end listing all cited cases with their citations.

Structure the report with:
- An executive summary
- Sections based on the user's instructions
- Key findings and patterns
- Strategic implications or recommendations

Be analytical and conclusive, not merely descriptive. Find patterns, contrasts, and strategic implications across the cases.`;

      const userMsg=`USER INSTRUCTIONS:\n${reportInstructions.trim()}\n\nCASE DATA:\n${JSON.stringify(entriesData,null,2)}`;

      const res=await fetch("/api/ai",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
        use_opus:true,max_tokens:12000,system,brand_id:brandId,
        messages:[{role:"user",content:userMsg}],
      })});
      const result=await res.json();
      if(result.error){setToast({message:"AI error: "+result.error});setReportGenerating(false);return;}
      const content=result.content?.map(c=>c.text||"").join("")||"No content generated.";

      // Save to saved_reports
      const{data:{session}}=await supabase.auth.getSession();
      const reportId=String(Date.now());
      const reportTitle=`${activeCollection.name} — Report`;
      await supabase.from("saved_reports").insert({
        id:reportId,
        title:reportTitle,
        scope:"local",
        template_type:"collection",
        sections:"",
        competitors:collectionEntries.map(e=>e.competitor||e.brand_name||"").filter(Boolean).join(","),
        custom_instructions:reportInstructions,
        content,
        created_by:session?.user?.email||"",
        project_id:projectId,
        brand_id:brandId,
      });

      setShowReportModal(false);
      setReportInstructions("");
      setReportToast({reportId,title:reportTitle});
      // Auto-dismiss after 10s
      setTimeout(()=>setReportToast(null),10000);
    }catch(err){
      console.error("Report generation error:",err);
      setToast({message:"Failed to generate report. Try again."});
    }
    setReportGenerating(false);
  };

  const downloadCase=async(entry)=>{
    setDownloading(true);
    try{
      // Generate AI summary
      let summary="";
      try{
        const res=await fetch("/api/ai",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
          skip_framework:true,max_tokens:800,brand_id:brandId,
          messages:[{role:"user",content:`Write a brief competitive intelligence summary (2-3 paragraphs) for a strategy audience. Cover: what this piece is, what insight/territory it exploits, and why it's relevant for competitive analysis.\n\nBrand: ${entry.brand_name||entry.competitor||""}\nTitle: ${entry.description||""}\nCategory: ${entry.category||""}\nYear: ${entry.year||""}\nType: ${entry.type||""}\nIntent: ${entry.communication_intent||""}\nSynopsis: ${entry.synopsis||""}\nInsight: ${entry.insight||""}\nIdea: ${entry.idea||""}\nTerritory: ${entry.primary_territory||""}\nExecution: ${entry.execution_style||""}\nAnalyst Notes: ${entry.analyst_comment||""}`}]
        })});
        const d=await res.json();
        summary=d.content?.[0]?.text||"";
      }catch{}

      const stars=entry.rating?"★".repeat(Number(entry.rating))+"☆".repeat(5-Number(entry.rating)):"";
      const now=new Date();
      const dateStr=now.toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"});
      const timeStr=now.toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"});

      // Classification fields (two-column table)
      const classFields=[
        ["Category",entry.category],["Sub-category",entry.sub_category],["Country",entry.country],
        ["Year",entry.year],["Type",entry.type],["Communication Intent",entry.communication_intent],
        ["Funnel Stage",entry.funnel],["Rating",stars],["Brand Archetype",entry.brand_archetype],
        ["Tone",entry.tone_of_voice],["Execution Style",entry.execution_style],
        ["Creative Approach",entry.creative_approach],["Insight Type",entry.insight_type],
        ["Territory",entry.primary_territory],["Secondary Territory",entry.secondary_territory],
        ["Main Slogan",entry.main_slogan],["Channel",entry.channel],["CTA",entry.cta],
        ["Proximity",entry.category_proximity],["Differentiation",entry.diff_claim],
        ["Language Register",entry.language_register],["Brand Role",entry.bank_role],
      ].filter(([,v])=>v&&String(v).trim());

      // Custom dimensions
      const customEntries=entry.custom_dimensions&&Object.keys(entry.custom_dimensions).length>0
        ?Object.entries(entry.custom_dimensions).filter(([,v])=>v&&String(v).trim()):[];

      // Images — collect all available
      const images=[];
      if(entry.image_url)images.push(entry.image_url);
      try{const extra=JSON.parse(entry.image_urls||"[]");if(Array.isArray(extra))images.push(...extra);}catch{}
      // YouTube thumbnail as fallback
      const ytMatch=entry.url?.match(/(?:youtube\.com\/watch\?.*v=|youtu\.be\/)([^&\s]+)/);
      if(ytMatch&&images.length===0)images.push(`https://img.youtube.com/vi/${ytMatch[1]}/maxresdefault.jpg`);

      const html=`
        <div style="font-family:system-ui,-apple-system,sans-serif;color:#1a1a2e;line-height:1.5;padding:0">
          <!-- HEADER -->
          <div style="border-bottom:3px solid #0019FF;padding-bottom:14px;margin-bottom:20px">
            <div style="display:flex;justify-content:space-between;align-items:flex-end">
              <div>
                <div style="font-size:20px;font-weight:800;color:#0a0f3c;letter-spacing:0.05em">GROUNDWORK</div>
                <div style="font-size:9px;color:#888;text-transform:uppercase;letter-spacing:0.1em;margin-top:2px">Competitive Intelligence Brief</div>
              </div>
              <div style="text-align:right">
                <div style="font-size:10px;color:#888">${dateStr} · ${timeStr}</div>
              </div>
            </div>
          </div>

          <!-- TITLE + SOURCE -->
          <h1 style="font-size:20px;font-weight:800;color:#0a0f3c;margin:0 0 6px;line-height:1.2">${entry.description||"Case Brief"}</h1>
          <div style="font-size:12px;color:#555;margin-bottom:4px">
            <strong>${entry.brand_name||entry.competitor||""}</strong>
            ${entry.category?` · ${entry.category}`:""}${entry.sub_category?` / ${entry.sub_category}`:""}
            ${entry.year?` · ${entry.year}`:""}${entry.type?` · ${entry.type}`:""}
          </div>
          ${entry.url?`<div style="font-size:10px;margin-bottom:16px"><a href="${entry.url}" style="color:#0019FF;text-decoration:none">${entry.url}</a></div>`:`<div style="margin-bottom:16px"></div>`}

          <!-- EXECUTIVE SUMMARY -->
          ${summary?`<div style="background:#f0f0ff;border-left:4px solid #0019FF;padding:14px 18px;border-radius:0 10px 10px 0;margin-bottom:20px">
            <div style="font-size:10px;font-weight:700;color:#0019FF;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px">Executive Summary</div>
            <div style="font-size:11px;color:#333;line-height:1.7">${summary.replace(/\n\n/g,"</p><p style='margin:8px 0'>").replace(/\n/g,"<br>")}</div>
          </div>`:""}

          <!-- CLASSIFICATION TABLE -->
          <div style="margin-bottom:20px">
            <div style="font-size:10px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px">Classification</div>
            <table style="width:100%;border-collapse:collapse;font-size:11px">
              ${classFields.map(([l,v],i)=>`<tr style="background:${i%2===0?"#fafafa":"white"}"><td style="padding:5px 10px;color:#888;width:160px;vertical-align:top;font-weight:500">${l}</td><td style="padding:5px 10px;color:#222">${v}</td></tr>`).join("")}
            </table>
          </div>

          <!-- ANALYSIS -->
          ${(entry.synopsis||entry.insight||entry.idea||entry.main_vp)?`
          <div style="margin-bottom:20px">
            <div style="font-size:10px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:10px">Analysis</div>
            ${entry.synopsis?`<div style="margin-bottom:12px"><div style="font-size:11px;font-weight:700;color:#333;margin-bottom:3px">Synopsis</div><div style="font-size:11px;color:#555;line-height:1.6">${entry.synopsis}</div></div>`:""}
            ${entry.insight?`<div style="margin-bottom:12px"><div style="font-size:11px;font-weight:700;color:#333;margin-bottom:3px">Insight</div><div style="font-size:11px;color:#555;line-height:1.6">${entry.insight}</div></div>`:""}
            ${entry.idea?`<div style="margin-bottom:12px"><div style="font-size:11px;font-weight:700;color:#333;margin-bottom:3px">Creative Idea</div><div style="font-size:11px;color:#555;line-height:1.6">${entry.idea}</div></div>`:""}
            ${entry.main_vp?`<div style="margin-bottom:12px"><div style="font-size:11px;font-weight:700;color:#333;margin-bottom:3px">Value Proposition</div><div style="font-size:11px;color:#555;line-height:1.6">${entry.main_vp}</div></div>`:""}
            ${entry.r2b?`<div style="margin-bottom:12px"><div style="font-size:11px;font-weight:700;color:#333;margin-bottom:3px">Reason to Believe</div><div style="font-size:11px;color:#555;line-height:1.6">${entry.r2b}</div></div>`:""}
          </div>`:""}

          <!-- CUSTOM DIMENSIONS -->
          ${customEntries.length>0?`
          <div style="margin-bottom:20px">
            <div style="font-size:10px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px">Framework Dimensions</div>
            <table style="width:100%;border-collapse:collapse;font-size:11px">
              ${customEntries.map(([k,v],i)=>`<tr style="background:${i%2===0?"#faf8ff":"white"}"><td style="padding:5px 10px;color:#7c3aed;width:160px;vertical-align:top;font-weight:500;text-transform:capitalize">${k.replace(/_/g," ")}</td><td style="padding:5px 10px;color:#222">${v}</td></tr>`).join("")}
            </table>
          </div>`:""}

          <!-- ANALYST NOTES -->
          ${entry.analyst_comment?`
          <div style="background:#fffbeb;border:1px solid #fde68a;padding:14px 16px;border-radius:10px;margin-bottom:20px">
            <div style="font-size:10px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px">Analyst Notes</div>
            <div style="font-size:11px;color:#78350f;line-height:1.6">${entry.analyst_comment}</div>
          </div>`:""}

          <!-- IMAGES -->
          ${images.length>0?`
          <div style="margin-bottom:20px">
            <div style="font-size:10px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:10px">Visual Reference</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              ${images.slice(0,4).map(url=>`<img src="${url}" style="max-width:${images.length===1?"100%":"48%"};max-height:250px;border-radius:8px;border:1px solid #ddd;object-fit:cover" crossorigin="anonymous"/>`).join("")}
            </div>
            ${entry.url?`<div style="font-size:9px;color:#888;margin-top:6px">Source: ${entry.url}</div>`:""}
          </div>`:""}

          <!-- FOOTER -->
          <div style="margin-top:24px;padding-top:12px;border-top:2px solid #0019FF;display:flex;justify-content:space-between;align-items:center">
            <div style="font-size:9px;color:#888">Generated by <strong style="color:#0a0f3c">Groundwork</strong> — Competitive Intelligence Platform</div>
            <div style="font-size:9px;color:#888">groundwork.kad.london</div>
          </div>
        </div>`;

      const container=document.createElement("div");
      container.innerHTML=html;
      container.style.width="680px";
      container.style.background="white";
      container.style.padding="20px";
      document.body.appendChild(container);

      // Small delay to ensure rendering
      await new Promise(r=>setTimeout(r,200));

      const html2pdf=(await import("html2pdf.js")).default;
      await html2pdf().set({
        margin:[10,10,10,10],
        filename:`${(entry.brand_name||entry.competitor||"Brand").replace(/[^a-zA-Z0-9]/g,"")}-${new Date().toLocaleDateString("en-US",{month:"numeric",day:"numeric",year:"numeric"}).replace(/\//g,"")}-${(entry.description||"case").split(/\s+/).slice(0,3).join("-").replace(/[^a-zA-Z0-9-]/g,"")}.pdf`,
        image:{type:"jpeg",quality:0.95},
        html2canvas:{scale:2,useCORS:true,logging:false},
        jsPDF:{unit:"mm",format:"a4",orientation:"portrait"}
      }).from(container).save();

      document.body.removeChild(container);
    }catch(err){
      console.error("[Download]",err);
      setToast({message:"Error generating PDF: "+err.message});
    }
    setDownloading(false);
  };

  const moveEntry=async(entry)=>{
    const toScope=entry.scope==="local"?"global":"local";
    if(!confirm(`Move this entry to ${toScope==="global"?"Global benchmarks":"Local audit"}?`))return;
    // Update scope + map fields in place (single table now)
    const updates = { scope: toScope, updated_at: new Date().toISOString() };
    if(toScope==="global"){
      updates.brand = entry.competitor || entry.brand_name || "";
      updates.brand_name = entry.competitor || entry.brand_name || "";
    } else {
      updates.competitor = entry.brand || entry.brand_name || "";
      updates.brand_name = entry.brand || entry.brand_name || "";
    }
    const{error}=await supabase.from("creative_source").update(updates).eq("id",entry.id);
    if(error){setToast({message:"Error moving: "+error.message});return;}
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
  const fileToBase64=async(file)=>{
    const buf=await file.arrayBuffer();
    const bytes=new Uint8Array(buf);
    let binary="";for(let i=0;i<bytes.byteLength;i++)binary+=String.fromCharCode(bytes[i]);
    return btoa(binary);
  };
  const uploadDocument=async(file)=>{if(!file)return;setUploading(true);setToast({message:"Uploading document..."});
    // Read file as base64 for AI analysis
    let docBase64=null;
    let docMediaType="application/pdf";
    const ext=file.name.split(".").pop().toLowerCase();
    if(ext==="pdf")docMediaType="application/pdf";
    else if(ext==="txt")docMediaType="text/plain";
    else if(ext==="docx")docMediaType="application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    else if(ext==="doc")docMediaType="application/msword";
    try{docBase64=await fileToBase64(file);}catch{}

    const url=await uploadFile(file);
    if(url){
      const fileName=file.name.replace(/\.[^.]+$/,"");
      setCur(prev=>({...prev,url,description:prev.description||fileName}));
      setMaterialType("document");
      setUploading(false);
      // Auto-analyze with AI — send document directly to Claude
      if(docBase64){
        setToast({message:"Analyzing document with AI..."});
        setAnalyzing(true);
        try{
          const context=`Document: ${fileName}`;
          const res=await fetch("/api/analyze",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({documentBase64:docBase64,documentMediaType:docMediaType,context,project_id:projectId,brand_id:brandId})});
          if(res.ok){
            const result=await res.json();
            if(result.success&&result.analysis){
              // Also save any extracted transcript
              if(result.analysis.transcript)setCur(prev=>({...prev,transcript:prev.transcript||result.analysis.transcript}));
              autoFill(result.analysis);
              setToast({message:"✓ Document analyzed"});
            }else{setToast({message:"Analysis returned no data"});}
          }else{setToast({message:"Analysis error"});}
        }catch(err){setToast({message:"Error: "+err.message});}
        setAnalyzing(false);
      }else{setToast({message:"Document uploaded"});}
    }else{setToast({message:"Upload failed"});setUploading(false);}
  };
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
          context:context.join("\n"),
          project_id:projectId,
          brand_id:brandId
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
        console.log("[Analyze] Response keys:", Object.keys(result.analysis).length, "fields");
        console.log("[Analyze] Sample values — synopsis:", (result.analysis.synopsis||"").slice(0,50), "portrait:", result.analysis.portrait);
        // Force overwrite all fields from AI (not just empty ones)
        setCur(prev=>{
          const u={...prev};
          Object.entries(result.analysis).forEach(([k,v])=>{
            if(v && v !== "undefined" && v !== "null") u[k]=v;
          });
          return u;
        });
        highlightFields(Object.keys(result.analysis).filter(k=>result.analysis[k]));
        setToast({message:"✓ AI analysis complete — "+Object.keys(result.analysis).length+" fields"});
      }else{
        console.log("[Analyze] No analysis in response:", result);
        setToast({message:"Analysis returned no data"});
      }
    }catch(err){
      setToast({message:"Error: "+err.message});
    }
    setAnalyzing(false);
  };

  const openForm=(entry)=>{const e=entry||{};setCur({...e});setViewingImg(null);if(ytId(e.url))setMaterialType("video");else if(e.url&&/\.(mp4|mov|webm)(\?|$)/i.test(e.url))setMaterialType("videoFile");else if(e.url&&/\.(pdf|doc|docx|txt|rtf)(\?|$)/i.test(e.url))setMaterialType("document");else if(e.image_url)setMaterialType("image");else if(e.url)setMaterialType("web");else setMaterialType("none");setSec(0);router.push(entry?`/audit?edit=${entry.id}`:"/audit?edit=new",{scroll:false});setSbRaw(null);setHighlighted(new Set());setActiveCollection(null);setEditingCollection(null);};

  let fd=data.filter(e=>Object.entries(fl).every(([k,v])=>!v||(e[k]||"").includes(v)));
  if(sortPreset==="newest")fd=[...fd].sort((a,b)=>(b.created_at||"").localeCompare(a.created_at||""));
  else if(sortPreset==="oldest")fd=[...fd].sort((a,b)=>(a.created_at||"").localeCompare(b.created_at||""));
  else if(sortPreset==="updated")fd=[...fd].sort((a,b)=>(b.updated_at||b.created_at||"").localeCompare(a.updated_at||a.created_at||""));
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
  // ─── CROP HANDLER ───
  const handleCropped=async(blob)=>{
    setUploading(true);
    setToast({message:"Uploading cropped image..."});
    const file=new File([blob],`cropped_${Date.now()}.jpg`,{type:"image/jpeg"});
    const url=await uploadSingleImage(file);
    if(!url){setToast({message:"Upload failed"});setUploading(false);setCropSrc(null);setCropTarget(null);return;}

    if(cropTarget==="primary"){
      // Replace primary image in form
      setCur(prev=>({...prev,image_url:url}));
      if(viewingImg===cropSrc)setViewingImg(url);
    }else if(cropTarget==="sidebar"){
      // Replace primary image on saved entry via DB update
      const entryId=sb?.id;
      if(entryId){
        await supabase.from(getTableName(scope)).update({image_url:url,updated_at:new Date().toISOString()}).eq("id",entryId);
        setData(prev=>prev.map(e=>e.id===entryId?{...e,image_url:url}:e));
        setSbRaw(prev=>prev?{...prev,image_url:url}:prev);
      }
    }else if(typeof cropTarget==="number"){
      // Replace extra image at index
      const extras=cur.image_urls?JSON.parse(cur.image_urls||"[]"):[];
      extras[cropTarget]=url;
      setCur(prev=>({...prev,image_urls:JSON.stringify(extras)}));
      if(viewingImg===cropSrc)setViewingImg(url);
    }
    setUploading(false);
    setCropSrc(null);
    setCropTarget(null);
    setToast({message:"Image cropped"});
  };

  // Sort options alphabetically, "Other"/"None" always at the end
  const sortOpts = (opts) => {
    if (!opts || !Array.isArray(opts)) return opts || [];
    const endItems = ["Other", "- Other", "None", "None identifiable", "Not specific", "Not specified", "Not identifiable"];
    const normal = opts.filter(o => !endItems.includes(o)).sort((a, b) => a.localeCompare(b));
    const end = opts.filter(o => endItems.includes(o));
    return [...normal, ...end];
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
  const sections=frameworkLoaded?getSections(framework,scope):getFieldsForScope(scope);
  // Phase 1.5: load all dimensions for the config-driven form
  const { getAllDimensions: _getAllDims } = require("@/lib/system-dimensions");
  const allDimensions = _getAllDims(framework);
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
                    <iframe ref={videoIframeRef} width="100%" height="350" style={{maxWidth:700,margin:"0 auto",display:"block"}} src={y?`https://www.youtube-nocookie.com/embed/${y}?rel=0&modestbranding=1&iv_load_policy=3`:`https://player.vimeo.com/video/${vim}`} frameBorder="0" allowFullScreen className="rounded-lg" />
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
                  <ImageViewer src={viewingImg||imgUrl} onCrop={()=>{const activeSrc=viewingImg||imgUrl;const extras=cur.image_urls?JSON.parse(cur.image_urls||"[]"):[];const extraIdx=extras.indexOf(activeSrc);setCropSrc(activeSrc);setCropTarget(activeSrc===imgUrl?"primary":extraIdx>=0?extraIdx:"primary");}} />
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
                  <video id="videofile-player" controls width="100%" style={{maxWidth:700,maxHeight:400,margin:"0 auto",display:"block"}} className="rounded-lg" src={cur.url} />
                  <div className="flex items-center justify-center gap-3 mt-2">
                    <button onClick={()=>{
                      const v=document.getElementById("videofile-player");
                      if(!v)return;
                      const c=document.createElement("canvas");c.width=v.videoWidth;c.height=v.videoHeight;
                      c.getContext("2d").drawImage(v,0,0);
                      c.toBlob(async(blob)=>{
                        if(!blob)return;
                        const url=await uploadFile(new File([blob],`still_${Date.now()}.jpg`,{type:"image/jpeg"}));
                        if(url){
                          if(!cur.image_url){setCur(prev=>({...prev,image_url:url}));}
                          else{const extras=JSON.parse(cur.image_urls||"[]");extras.push(url);setCur(prev=>({...prev,image_urls:JSON.stringify(extras)}));}
                          setToast({message:"Still captured"});
                        }
                      },"image/jpeg",0.9);
                    }} className="flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-main rounded-lg text-xs font-medium text-muted hover:text-main hover:border-[var(--accent)] transition">
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="5"/><circle cx="8" cy="8" r="2" fill="currentColor"/></svg>
                      Capture stills
                    </button>
                    <span className="text-[9px] text-hint flex items-center gap-1">
                      <kbd className="px-1 py-0.5 bg-surface2 rounded text-[8px] font-mono border border-main">⌘V</kbd> paste screenshot
                    </span>
                  </div>
                  {(cur.image_url||(cur.image_urls&&JSON.parse(cur.image_urls||"[]").length>0))&&(
                    <div className="flex gap-2 items-center mt-3 px-2 overflow-x-auto pb-1">
                      {[cur.image_url,...(cur.image_urls?JSON.parse(cur.image_urls||"[]"):[])].filter(Boolean).map((url,i)=>(
                        <div key={i} className="relative group/still flex-shrink-0">
                          <img src={url} className="h-14 w-20 object-cover rounded border border-main cursor-pointer" onClick={()=>setZoomImg(url)} />
                          {i===0&&<span className="absolute -top-1 -left-1 bg-accent text-white text-[8px] px-1 rounded-sm">Main</span>}
                        </div>
                      ))}
                    </div>
                  )}
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

          {/* FORM FIELDS PANEL — config-driven from system + custom dimensions */}
          <div className="w-[380px] border-l border-main bg-surface overflow-auto">
            <div className="p-3">
              {allDimensions.filter(d => d.fields?.length > 0).map((dim, di) => {
                const isOpen = sec === di;
                const isCustom = !dim.is_system;
                // Skip fields already rendered in the left panel (Section A special fields)
                const skipKeys = new Set(["url", "image_url", "transcript", "analyst_comment"]);
                // Rating is rendered inline in Section A via StarRating, not skipped

                return (
                  <div key={di} className="mb-1">
                    <div onClick={() => setSec(isOpen ? -1 : di)}
                      className={`px-3 py-2 rounded-lg cursor-pointer flex justify-between text-xs font-semibold ${
                        isOpen
                          ? isCustom ? "bg-purple-50 text-purple-700 border border-purple-300" : "bg-accent-soft text-accent border border-[var(--accent)]"
                          : "bg-surface2 border border-main text-main"
                      }`}>
                      <span>{isCustom ? `${di + 1}. ${dim.name}` : dim.name}{isCustom && <span className="text-hint font-normal ml-1">(custom)</span>}</span>
                      <span className="text-hint">{isOpen ? "−" : "+"}</span>
                    </div>
                    {isOpen && (
                      <div className="py-2 space-y-3">
                        {(dim.fields || []).filter(f => !skipKeys.has(f.key) && !skipKeys.has(f.db_key)).map(f => {
                          const dbKey = f.db_key || f.key;
                          // Override values from framework for communication_intent
                          const fieldValues = (dbKey === "communication_intent" && framework?.communicationIntents?.length)
                            ? [...new Set([...framework.communicationIntents, ...(f.values || [])])]
                            : f.values;
                          const fWithValues = { ...f, values: fieldValues };
                          const val = cur[dbKey] ?? cur.custom_dimensions?.[f.key] ?? "";
                          const setVal = (v) => {
                            const update = { ...cur, [dbKey]: v };
                            if (isCustom) update.custom_dimensions = { ...(cur.custom_dimensions || {}), [f.key]: v };
                            setCur(update);
                          };

                          // Country field — special autocomplete
                          if (f.type === "country_search") return (
                            <div key={f.key} style={fieldStyle(dbKey)} className="rounded px-1 -mx-1">
                              <label className="block text-[10px] text-muted uppercase font-semibold mb-0.5">{f.name}</label>
                              <CountryInput value={val} onChange={v => setVal(v)} />
                            </div>
                          );

                          // Rating — star selector
                          if (f.type === "rating") return (
                            <div key={f.key} style={fieldStyle(dbKey)} className="rounded px-1 -mx-1">
                              <label className="block text-[10px] text-muted uppercase font-semibold mb-0.5">{f.name}</label>
                              <StarRating value={val} onChange={v => setVal(v)} />
                            </div>
                          );

                          // Brand selector — conditional on scope
                          if (f.type === "brand_selector") return (
                            <div key={f.key} style={fieldStyle(dbKey)} className="rounded px-1 -mx-1">
                              <label className="block text-[10px] text-muted uppercase font-semibold mb-0.5">Brand</label>
                              {formScope === "local" ? (
                                <select value={cur.competitor || cur.brand_name || ""} onChange={async (e) => {
                                  const v = e.target.value;
                                  const selected = localCompetitors.find(b => b.name === v);
                                  const updates = { brand_name: v, competitor: v, scope: "local" };
                                  if (selected) {
                                    updates.brand_id = selected.id;
                                    // Auto-fill from brand profile
                                    const s = createClient();
                                    const { data: bp } = await s.from("brands").select("country, category, sub_category").eq("id", selected.id).single();
                                    if (bp?.country) updates.country = bp.country;
                                    if (bp?.category) updates.category = bp.category;
                                    if (bp?.sub_category) updates.sub_category = bp.sub_category;
                                  }
                                  setCur(prev => ({...prev, ...updates}));
                                }} className="w-full px-2 py-1.5 bg-surface border border-main rounded text-sm text-main">
                                  <option value="">— Select competitor —</option>
                                  {localCompetitors.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                                </select>
                              ) : (
                                <div className="relative">
                                  <input value={cur.brand || cur.brand_name || ""} onChange={e => {
                                    const v = e.target.value;
                                    setGlobalBrandConfirmed(false);
                                    setCur({...cur, brand_name: v, brand: v, scope: "global"});
                                  }} placeholder="Type brand name..."
                                    className="w-full px-2 py-1.5 bg-surface border border-main rounded text-sm text-main" />
                                  {cur.brand && cur.brand.length > 1 && !globalBrandConfirmed && (
                                    <div className="absolute z-40 mt-1 w-full bg-surface border border-main rounded-lg shadow-lg max-h-32 overflow-auto">
                                      {globalBrands.filter(b => b.name.toLowerCase().includes((cur.brand||"").toLowerCase())).slice(0,5).map(b => (
                                        <button key={b.id} type="button" onClick={async () => {
                                          const s = createClient();
                                          const { data: bp } = await s.from("brands").select("country, category, sub_category").eq("id", b.id).single();
                                          const updates = { brand_name: b.name, brand: b.name, brand_id: b.id, scope: "global" };
                                          if (bp?.country) updates.country = bp.country;
                                          if (bp?.category) updates.category = bp.category;
                                          if (bp?.sub_category) updates.sub_category = bp.sub_category;
                                          setCur(prev => ({...prev, ...updates}));
                                          setGlobalBrandConfirmed(true);
                                        }}
                                          className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent-soft transition text-main">{b.name}</button>
                                      ))}
                                      {!globalBrands.some(b => b.name.toLowerCase() === (cur.brand||"").toLowerCase()) && cur.brand.length > 2 && (
                                        <button type="button" onClick={async () => {
                                          // Create new global brand in DB + link to workspace
                                          const s = createClient();
                                          const { data: nb } = await s.from("brands").insert({
                                            name: cur.brand.trim(), organization_id: orgId,
                                            scope: "global", proximity: "Target proximity",
                                            is_active: true, source: "manual",
                                          }).select("id").single();
                                          if (nb) {
                                            await s.from("brand_competitors").insert({ own_brand_id: brandId, competitor_brand_id: nb.id });
                                            // Link existing entries with this brand_name to the new brand_id
                                            await s.from("creative_source").update({ brand_id: nb.id }).eq("brand_name", cur.brand.trim()).is("brand_id", null);
                                            console.log("[Create Brand] Created:", nb.id, "linked existing entries");
                                            setCur({...cur, brand_name: cur.brand, brand_id: nb.id, scope: "global"});
                                            setGlobalBrands(prev => [...prev, { id: nb.id, name: cur.brand.trim() }]);
                                          }
                                          setGlobalBrandConfirmed(true);
                                        }}
                                          className="w-full text-left px-3 py-1.5 text-xs text-accent hover:bg-accent-soft transition font-medium">
                                          + Create "{cur.brand}" as new brand
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );

                          // Toggle (scope) — two buttons, state only (no page reload)
                          if (f.type === "toggle") return (
                            <div key={f.key} style={fieldStyle(dbKey)} className="rounded px-1 -mx-1">
                              <label className="block text-[10px] text-muted uppercase font-semibold mb-0.5">{f.name}</label>
                              <div className="flex gap-1">
                                {(fWithValues.values || []).map(v => (
                                  <button key={v} type="button" onClick={() => {
                                    setFormScope(v);
                                    setGlobalBrandConfirmed(false);
                                    if (v === "local") {
                                      // Pre-fill country + category for local
                                      setCur(prev => ({...prev, scope: v, country: brand?.market || prev.country || "", category: brand?.category || prev.category || ""}));
                                    } else {
                                      // Clear country for global — user fills manually
                                      setCur(prev => ({...prev, scope: v, country: "", competitor: "", brand: "", brand_name: ""}));
                                    }
                                  }}
                                    className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                                      formScope === v ? "bg-accent text-white border-accent" : "bg-surface border-main text-muted hover:border-accent/40"
                                    }`}>
                                    {v === "local" ? "Local" : "Global"}
                                  </button>
                                ))}
                              </div>
                            </div>
                          );

                          // Taxonomy — dropdown from taxonomy_terms (fallback to values)
                          if (f.type === "taxonomy") {
                            let opts = [];
                            let parentTermId = null;
                            if (f.taxonomy_type === "sub_category" && f.parent_key) {
                              const parentVal = cur[f.parent_key] || cur.category || "";
                              const parentTerm = (taxonomyTerms.category || []).find(t => t.name === parentVal);
                              if (parentTerm) {
                                parentTermId = parentTerm.id;
                                opts = (taxonomyTerms.sub_category || []).filter(t => t.parent_id === parentTerm.id).map(t => t.name);
                              }
                            } else {
                              opts = (taxonomyTerms[f.taxonomy_type] || []).map(t => t.name);
                            }
                            if (opts.length === 0 && f.taxonomy_type !== "sub_category") opts = OPTIONS[dbKey] || [];
                            const sorted = sortOpts(opts);
                            return (
                              <div key={f.key} style={fieldStyle(dbKey)} className="rounded px-1 -mx-1">
                                <label className="block text-[10px] text-muted uppercase font-semibold mb-0.5">{f.name}</label>
                                <select value={val} onChange={e => setVal(e.target.value)}
                                  className="w-full px-2 py-1.5 bg-surface border border-main rounded text-sm text-main">
                                  <option value="">—</option>
                                  {sorted.map(o => <option key={o} value={o}>{o}</option>)}
                                  <option value="__other__">- Other</option>
                                </select>
                                {val === "__other__" && (
                                  <input value={cur[`${dbKey}_other`] || ""} onChange={e => setCur({...cur, [`${dbKey}_other`]: e.target.value})}
                                    onBlur={async (e) => {
                                      const newVal = e.target.value.trim();
                                      if (!newVal) return;
                                      // Save to taxonomy_terms
                                      const s = createClient();
                                      const insertData = {
                                        organization_id: orgId || null,
                                        taxonomy_type: f.taxonomy_type,
                                        name: newVal,
                                        sort_order: 999,
                                        is_active: true,
                                      };
                                      if (f.taxonomy_type === "sub_category" && parentTermId) {
                                        insertData.parent_id = parentTermId;
                                      }
                                      await s.from("taxonomy_terms").insert(insertData);
                                      // Set the actual value and clear __other__
                                      setVal(newVal);
                                      setCur(prev => ({...prev, [dbKey]: newVal, [`${dbKey}_other`]: ""}));
                                      // Refresh taxonomy
                                      const{data:terms}=await s.from("taxonomy_terms").select("*").eq("is_active",true).order("sort_order");
                                      if(terms){const grouped={};terms.forEach(t=>{if(!grouped[t.taxonomy_type])grouped[t.taxonomy_type]=[];grouped[t.taxonomy_type].push({...t});});setTaxonomyTerms(grouped);}
                                    }}
                                    placeholder={`New ${f.name.toLowerCase()}...`}
                                    className="w-full mt-1 px-2 py-1 border border-accent rounded text-xs bg-accent-soft text-main" autoFocus />
                                )}
                              </div>
                            );
                          }

                          // URL — text input (skip, handled in left panel)
                          if (f.type === "url") return null;

                          // Single choice — always native dropdown
                          if (f.type === "single_choice" && fWithValues.values?.length > 0) {
                            const sorted = sortOpts(fWithValues.values);
                            return (
                              <div key={f.key} style={fieldStyle(dbKey)} className="rounded px-1 -mx-1">
                                <label className="block text-[10px] text-muted uppercase font-semibold mb-0.5">{f.name}</label>
                                <select value={val} onChange={e => setVal(e.target.value)}
                                  className="w-full px-2 py-1.5 bg-surface border border-main rounded text-sm text-main">
                                  <option value="">—</option>
                                  {sorted.map(o => <option key={o} value={o}>{o}</option>)}
                                </select>
                                {val === "Other" && (
                                  <input value={cur[`${dbKey}_other`] || ""} onChange={e => setCur({...cur, [`${dbKey}_other`]: e.target.value})}
                                    placeholder="Specify..." className="w-full mt-1 px-2 py-1 border border-accent rounded text-xs bg-accent-soft text-main" autoFocus />
                                )}
                              </div>
                            );
                          }

                          // Multi-choice — DropdownCheckbox (≤5 chips, >5 dropdown)
                          if (f.type === "multichoice" && fWithValues.values?.length > 0) {
                            const sorted = sortOpts(fWithValues.values);
                            return (
                              <div key={f.key} style={fieldStyle(dbKey)} className="rounded px-1 -mx-1">
                                <label className="block text-[10px] text-muted uppercase font-semibold mb-0.5">{f.name}</label>
                                <DropdownCheckbox
                                  options={sorted}
                                  selected={val ? String(val).split(",").map(v => v.trim()).filter(Boolean) : []}
                                  onChange={v => setVal(v.join(", "))}
                                  allowOther={f.allow_other || false}
                                  onOtherAdded={async (newVal) => {
                                    const s = createClient();
                                    if (dbKey === "communication_intent") {
                                      // Communication intents: save to brand_frameworks.communication_intents
                                      const { data: fw } = await s.from("brand_frameworks").select("id, communication_intents").eq("brand_id", brandId).single();
                                      if (fw) {
                                        const updated = [...(fw.communication_intents || []), newVal];
                                        await s.from("brand_frameworks").update({ communication_intents: updated }).eq("id", fw.id);
                                      }
                                    } else {
                                      // Other fields: save to taxonomy_terms
                                      await s.from("taxonomy_terms").insert({
                                        organization_id: orgId || null, taxonomy_type: f.taxonomy_type || dbKey,
                                        name: newVal, sort_order: 999, is_active: true,
                                      });
                                    }
                                  }}
                                />
                              </div>
                            );
                          }

                          // Textarea
                          if (f.type === "textarea") return (
                            <div key={f.key} style={fieldStyle(dbKey)} className="rounded px-1 -mx-1">
                              <label className="block text-[10px] text-muted uppercase font-semibold mb-0.5">{f.name}</label>
                              <textarea value={val} onChange={e => setVal(e.target.value)} rows={2}
                                className="w-full px-2 py-1.5 bg-surface border border-main rounded text-sm text-main resize-y" />
                            </div>
                          );

                          // Default: text input
                          return (
                            <div key={f.key} style={fieldStyle(dbKey)} className="rounded px-1 -mx-1">
                              <label className="block text-[10px] text-muted uppercase font-semibold mb-0.5">{f.name}</label>
                              <input value={val} onChange={e => setVal(e.target.value)}
                                className="w-full px-2 py-1.5 bg-surface border border-main rounded text-sm text-main" />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="p-3 border-t border-main"><button onClick={save} className="w-full bg-accent text-white py-2 rounded-lg text-sm font-semibold hover:opacity-90">{eid?"Save changes":"Save entry"}</button></div>
          </div>
        </div>
        {toast&&<Toast {...toast} onClose={()=>setToast(null)}/>}
        {/* Image crop modal (form view) */}
        {cropSrc&&typeof window!=="undefined"&&createPortal(
          <ImageCropper src={cropSrc} onCropped={handleCropped} onCancel={()=>{setCropSrc(null);setCropTarget(null);}} />,
          document.body
        )}
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
          <div className="flex items-center gap-5">
            <h2 className="text-[15px] font-bold text-white">Creative Source</h2>
            <div className="flex gap-1">
              <button onClick={()=>{onScopeChange("local");setViewMode("entries");setActiveCollection(null);router.push("/audit?scope=local",{scroll:false});}} className={`px-3.5 py-1 rounded-full text-[13px] font-medium transition ${scope==="local"&&viewMode==="entries"?"bg-white/15 text-white":"text-white/60 hover:text-white/90"}`}>Local audit</button>
              <button onClick={()=>{onScopeChange("global");setViewMode("entries");setActiveCollection(null);router.push("/audit?scope=global",{scroll:false});}} className={`px-3.5 py-1 rounded-full text-[13px] font-medium transition ${scope==="global"&&viewMode==="entries"?"bg-white/15 text-white":"text-white/60 hover:text-white/90"}`}>Global benchmarks</button>
              <button onClick={()=>{setViewMode("collections");setActiveCollection(null);router.push("/audit?view=collections",{scroll:false});}} className={`px-3.5 py-1 rounded-full text-[13px] font-medium transition ${viewMode==="collections"?"bg-white/15 text-white":"text-white/60 hover:text-white/90"}`}>Collections</button>
            </div>
            {viewMode==="entries"&&<span className="text-xs text-white/40">{fd.length} of {data.length}</span>}
          </div>
          {selected.size>0&&<div className="flex gap-1.5 items-center">
            <div className="relative">
              <button onClick={()=>{setShowAddToCollection(!showAddToCollection);if(!showAddToCollection)loadCollections();}}
                className="group h-[30px] px-2 rounded-full flex items-center gap-0 hover:gap-1.5 hover:px-3 bg-white/15 hover:bg-white/25 transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" className="flex-shrink-0"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
                <span className="text-[10px] font-bold overflow-hidden max-w-0 group-hover:max-w-[100px] opacity-0 group-hover:opacity-100 transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] whitespace-nowrap text-white">Collection</span>
              </button>
              {showAddToCollection&&(
                <div className="absolute right-0 top-full mt-1 bg-surface border border-main rounded-lg shadow-xl z-50 w-[240px] max-h-[300px] overflow-auto">
                  {collections.map(c=>(
                    <button key={c.id} onClick={()=>addToCollection(c.id,[...selected])} className="w-full text-left px-3 py-2 text-sm text-main hover:bg-[#f5f5f5] border-b border-main flex justify-between items-center">
                      <span className="truncate">{c.name}</span>
                      <span className="text-[10px] text-hint ml-2 shrink-0">{c.entryCount} entries</span>
                    </button>
                  ))}
                  {!showQuickNewCol?(
                    <button onClick={()=>setShowQuickNewCol(true)} className="w-full text-left px-3 py-2 text-sm text-[#555] hover:bg-[#f5f5f5] font-medium">+ New Collection</button>
                  ):(
                    <div className="p-2 flex gap-1">
                      <input value={quickNewColName} onChange={e=>setQuickNewColName(e.target.value)} placeholder="Collection name..." className="flex-1 px-2 py-1 text-xs bg-surface border border-main rounded text-main" autoFocus onKeyDown={e=>{if(e.key==="Enter"&&quickNewColName.trim()){(async()=>{const c=await createCollection({name:quickNewColName.trim()});if(c){await addToCollection(c.id,[...selected]);setQuickNewColName("");setShowQuickNewCol(false);}})();}}} />
                      <button onClick={async()=>{if(!quickNewColName.trim())return;const c=await createCollection({name:quickNewColName.trim()});if(c){await addToCollection(c.id,[...selected]);setQuickNewColName("");setShowQuickNewCol(false);}}} className="px-2 py-1 text-xs bg-[#333] text-white rounded font-semibold">Add</button>
                    </div>
                  )}
                </div>
              )}
            </div>
            <button onClick={bulkDelete}
              className="group h-[30px] px-2 rounded-full flex items-center gap-0 hover:gap-1.5 hover:px-3 bg-white/15 hover:bg-[#c0392b] transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" className="flex-shrink-0"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
              <span className="text-[10px] font-bold overflow-hidden max-w-0 group-hover:max-w-[60px] opacity-0 group-hover:opacity-100 transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] whitespace-nowrap text-white">{selected.size}</span>
            </button>
          </div>}
        </div>
        {/* Collections View */}
        {viewMode==="collections"&&!activeCollection&&(
          <div className="px-5 py-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-semibold text-main">Collections</h3>
              <button onClick={()=>setShowNewCollection(true)} className="px-3 py-1.5 text-xs bg-accent text-white rounded-lg font-semibold">+ New Collection</button>
            </div>
            {showNewCollection&&(
              <div className="bg-surface border border-main rounded-lg p-4 mb-4">
                <div className="space-y-3">
                  <div><label className="text-xs font-medium text-muted block mb-1">Name *</label>
                    <input value={newCol.name} onChange={e=>setNewCol({...newCol,name:e.target.value})} className="w-full px-2 py-1.5 bg-surface border border-main rounded text-sm text-main focus:outline-none focus:border-accent" placeholder="Collection name" autoFocus /></div>
                  <div><label className="text-xs font-medium text-muted block mb-1">Description</label>
                    <input value={newCol.description} onChange={e=>setNewCol({...newCol,description:e.target.value})} className="w-full px-2 py-1.5 bg-surface border border-main rounded text-sm text-main focus:outline-none focus:border-accent" placeholder="Optional description" /></div>
                  <div><label className="text-xs font-medium text-muted block mb-1">Objective</label>
                    <input value={newCol.objective} onChange={e=>setNewCol({...newCol,objective:e.target.value})} className="w-full px-2 py-1.5 bg-surface border border-main rounded text-sm text-main focus:outline-none focus:border-accent" placeholder="Optional objective" /></div>
                  <label className="flex items-center gap-2 text-xs text-main"><input type="checkbox" checked={newCol.is_private} onChange={e=>setNewCol({...newCol,is_private:e.target.checked})} /> Private (only visible to you)</label>
                  <div className="flex gap-2">
                    <button onClick={()=>{if(!newCol.name.trim()){setToast({message:"Name is required"});return;}createCollection(newCol);}} className="px-3 py-1.5 text-xs bg-accent text-white rounded-lg font-semibold">Save</button>
                    <button onClick={()=>{setShowNewCollection(false);setNewCol({name:"",description:"",objective:"",is_private:false});}} className="px-3 py-1.5 text-xs border border-main rounded-lg text-muted">Cancel</button>
                  </div>
                </div>
              </div>
            )}
            {collectionsLoading?(<div className="text-sm text-hint text-center py-8">Loading collections...</div>):(
              collections.length===0?(<div className="text-sm text-hint text-center py-8">No collections yet. Create one to organize your entries.</div>):(
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {collections.map(c=>(
                    <div key={c.id} onClick={()=>openCollection(c)} className="bg-surface border border-main rounded-lg p-4 cursor-pointer hover:border-[var(--accent)] transition relative group">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="text-sm font-bold text-main truncate pr-6">{c.name}</h4>
                        <div className="relative">
                          <button onClick={e=>{e.stopPropagation();setCollectionMenuOpen(collectionMenuOpen===c.id?null:c.id);}} className="text-hint hover:text-main text-lg leading-none opacity-0 group-hover:opacity-100 transition">...</button>
                          {collectionMenuOpen===c.id&&(
                            <div className="absolute right-0 top-full mt-1 bg-surface border border-main rounded-lg shadow-xl z-50 w-[120px] overflow-hidden">
                              <button onClick={e=>{e.stopPropagation();setCollectionMenuOpen(null);setEditingCollection(c);}} className="w-full text-left px-3 py-2 text-xs text-main hover:bg-accent-soft">Edit</button>
                              <button onClick={e=>{e.stopPropagation();setCollectionMenuOpen(null);deleteCollection(c.id);}} className="w-full text-left px-3 py-2 text-xs text-red-500 hover:bg-red-50">Delete</button>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1.5 mb-2 flex-wrap">
                        <span className="text-[10px] bg-accent-soft text-accent px-1.5 py-0.5 rounded font-medium">{c.entryCount} {c.entryCount===1?"entry":"entries"}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${c.is_private?"bg-yellow-50 text-yellow-700 border border-yellow-200":"bg-green-50 text-green-700 border border-green-200"}`}>{c.is_private?"Private":"Shared"}</span>
                      </div>
                      {c.description&&<p className="text-xs text-muted mb-2 line-clamp-2">{c.description}</p>}
                      <div className="text-[10px] text-hint">{c.created_by&&<span>By {c.created_by}</span>}{c.created_at&&<span> · {fmtDate(c.created_at)}</span>}</div>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        )}

        {/* Collection Detail View */}
        {viewMode==="collections"&&activeCollection&&(
          <div className="px-8 py-6 max-w-[1100px] mx-auto">
            {/* Header row */}
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-3">
                <h3 className="text-2xl font-bold text-main">{activeCollection.name}</h3>
                <span className="text-xs border border-[var(--border)] text-muted px-2 py-0.5 rounded-full">{collectionEntries.length} {collectionEntries.length===1?"entry":"entries"}</span>
                <span className="text-xs border border-[var(--border)] text-muted px-2 py-0.5 rounded-full">{activeCollection.is_private?"private":"shared"}</span>
              </div>
              <div className="flex gap-1.5 items-center">
                {/* AI Storytelling */}
                {collectionEntries.length>=2&&(aiStoryLoading?
                  <div className="h-[34px] px-3 rounded-full bg-purple-100 flex items-center gap-1.5">
                    <svg className="w-4 h-4 animate-spin text-purple-600" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="30 70" strokeLinecap="round"/></svg>
                    <span className="text-[11px] font-medium text-purple-600">Analyzing...</span>
                  </div>
                :
                  <button onClick={requestAiStorytelling} className="group h-[34px] px-2.5 rounded-full flex items-center gap-0 hover:gap-1.5 hover:px-3.5 bg-[#e8e8e8] hover:bg-gradient-to-r hover:from-purple-600 hover:to-indigo-600 transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="flex-shrink-0 text-[#888] group-hover:text-white transition-colors duration-300"><path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z" fill="currentColor"/></svg>
                    <span className="text-[11px] font-semibold overflow-hidden max-w-0 group-hover:max-w-[100px] opacity-0 group-hover:opacity-100 transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] whitespace-nowrap text-white">Storytelling</span>
                  </button>
                )}
                {/* Report */}
                <button onClick={()=>setShowReportModal(true)} className="group h-[34px] px-2.5 rounded-full flex items-center gap-0 hover:gap-1.5 hover:px-3.5 bg-[#e8e8e8] hover:bg-[#1a1a1a] transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="flex-shrink-0 text-[#888] group-hover:text-white transition-colors duration-300"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                  <span className="text-[11px] font-semibold overflow-hidden max-w-0 group-hover:max-w-[60px] opacity-0 group-hover:opacity-100 transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] whitespace-nowrap text-white">Report</span>
                </button>
                {/* Presentation */}
                {collectionEntries.length>0&&<button onClick={()=>{setPresentationMode(true);setPresIndex(0);}} className="group h-[34px] px-2.5 rounded-full flex items-center gap-0 hover:gap-1.5 hover:px-3.5 bg-[#e8e8e8] hover:bg-[#1a1a1a] transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="flex-shrink-0 text-[#888] group-hover:text-white transition-colors duration-300"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                  <span className="text-[11px] font-semibold overflow-hidden max-w-0 group-hover:max-w-[90px] opacity-0 group-hover:opacity-100 transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] whitespace-nowrap text-white">Presentation</span>
                </button>}
                {/* Export CSV */}
                <button onClick={()=>{
                  const keys=["competitor","brand","brand_name","description","country","category","category_proximity","year","type","communication_intent","funnel","rating","url","image_url","main_slogan","transcript","synopsis","insight","idea","primary_territory","secondary_territory","execution_style","analyst_comment","entry_door","portrait","journey_phase","client_lifecycle","moment_acquisition","moment_deepening","moment_unexpected","bank_role","pain_point_type","pain_point","language_register","main_vp","brand_attributes","emotional_benefit","rational_benefit","r2b","channel","cta","tone_of_voice","representation","industry_shown","business_size","brand_archetype","diff_claim","created_at","updated_at"];
                  const header=keys.join(",");
                  const rows=collectionEntries.map(e=>keys.map(k=>'"'+(e[k]||"").replace(/"/g,'""').replace(/\n/g," ")+'"').join(","));
                  const blob=new Blob([[header,...rows].join("\n")],{type:"text/csv;charset=utf-8;"});
                  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`${(activeCollection.name||"collection").replace(/\s+/g,"_")}.csv`;document.body.appendChild(a);a.click();document.body.removeChild(a);
                  setToast({message:"CSV exported"});
                }} className="group h-[34px] px-2.5 rounded-full flex items-center gap-0 hover:gap-1.5 hover:px-3.5 bg-[#e8e8e8] hover:bg-[#1a1a1a] transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="flex-shrink-0 text-[#888] group-hover:text-white transition-colors duration-300"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  <span className="text-[11px] font-semibold overflow-hidden max-w-0 group-hover:max-w-[60px] opacity-0 group-hover:opacity-100 transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] whitespace-nowrap text-white">Export</span>
                </button>
                {/* Edit */}
                <button onClick={()=>setEditingCollection(activeCollection)} className="group h-[34px] px-2.5 rounded-full flex items-center gap-0 hover:gap-1.5 hover:px-3.5 bg-[#e8e8e8] hover:bg-[#1a1a1a] transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="flex-shrink-0 text-[#888] group-hover:text-white transition-colors duration-300"><path d="M17 3a2.83 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5z"/></svg>
                  <span className="text-[11px] font-semibold overflow-hidden max-w-0 group-hover:max-w-[40px] opacity-0 group-hover:opacity-100 transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] whitespace-nowrap text-white">Edit</span>
                </button>
                {/* Delete */}
                <button onClick={()=>deleteCollection(activeCollection.id)} className="group h-[34px] px-2.5 rounded-full flex items-center gap-0 hover:gap-1.5 hover:px-3.5 bg-[#e8e8e8] hover:bg-red-500 transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="flex-shrink-0 text-[#888] group-hover:text-white transition-colors duration-300"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                  <span className="text-[11px] font-semibold overflow-hidden max-w-0 group-hover:max-w-[50px] opacity-0 group-hover:opacity-100 transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] whitespace-nowrap text-white">Delete</span>
                </button>
              </div>
            </div>
            {activeCollection.description&&<p className="text-sm text-muted mb-1">{activeCollection.description}</p>}
            {activeCollection.objective&&<p className="text-sm text-hint italic mb-1">Objective: {activeCollection.objective}</p>}
            <div className="flex gap-2 mb-4 mt-2">
              <button onClick={()=>{setActiveCollection(null);loadCollections();router.push("/audit?view=collections",{scroll:false});}} className="text-xs text-muted hover:text-main transition">&larr; Back to collections</button>
              <span className="text-xs text-hint">·</span>
              <button onClick={()=>{navigator.clipboard.writeText(`${window.location.origin}/audit?collection=${activeCollection.id}`);setToast({message:"Link copied"});}} className="text-xs text-muted hover:text-main transition">Copy link</button>
            </div>
            <hr className="border-[var(--border)] mb-5"/>
            {/* AI Storytelling Suggestion Panel */}
            {aiStorySuggestion&&(
              <div className="mb-6 border-2 border-purple-200 bg-purple-50 dark:bg-purple-950/20 dark:border-purple-800 rounded-xl p-5 animate-fadeIn">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">✦</span>
                    <h4 className="text-base font-bold text-main">AI Storytelling Suggestion</h4>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={()=>setAiStorySuggestion(null)} className="px-3 py-1.5 text-sm border border-[var(--border)] rounded-full text-muted hover:text-main transition">Dismiss</button>
                    <button onClick={applyAiStorytelling} className="px-4 py-1.5 text-sm bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-full font-semibold hover:from-purple-700 hover:to-indigo-700 transition">Apply — Reorder & Fill</button>
                  </div>
                </div>
                <p className="text-sm text-muted mb-4 italic">{aiStorySuggestion.narrative}</p>
                <div className="space-y-2">
                  {aiStorySuggestion.entries.map((s,i)=>{
                    const entry=collectionEntries.find(e=>e.id===s.id);
                    return(
                      <div key={s.id} className="flex items-center gap-3 bg-white dark:bg-surface rounded-lg p-3 border border-purple-100 dark:border-purple-900">
                        <span className="text-xs font-bold text-purple-600 w-6 text-center flex-shrink-0">{i+1}</span>
                        <div className="w-12 h-8 bg-surface2 rounded overflow-hidden flex-shrink-0">
                          {entry?.image_url?<img src={entry.image_url} className="w-full h-full object-cover" alt=""/>:<div className="w-full h-full flex items-center justify-center text-hint text-[8px]">—</div>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-main truncate">{entry?.description||s.id}</p>
                          <p className="text-xs text-muted truncate">{entry?.competitor||entry?.brand_name||""}</p>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-purple-700 dark:text-purple-400">{s.slide_title}</p>
                          <p className="text-xs text-muted">{s.analyst_note}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <p className="text-sm text-main mb-6">Drag entries to reorder. Click title/note fields to add presentation annotations.</p>
            {/* Intro interstitial — before first case, becomes slide after intro */}
            {collectionEntries.length>0&&(
              <div className="flex justify-center py-3 px-8 mb-2">
                <MiniEditor key={`intro-${activeCollection?.id}`} value={activeCollection?.intro_note||""} placeholder="Introduction note (shows as first slide after title)..." minimal
                  onBlur={html=>{const v=_cleanHtml(html);supabase.from("collections").update({intro_note:v}).eq("id",activeCollection.id).then(({error})=>{if(error)setToast({message:"Error saving intro note"});});setActiveCollection(prev=>({...prev,intro_note:v}));}}
                  className="w-[500px] px-3 py-2 border border-[#e0e0e0] rounded-lg bg-white focus-within:border-purple-300 transition" editorClassName="text-sm text-[var(--text2)] min-h-[32px]" />
              </div>
            )}
            {collectionEntries.length===0?(<div className="text-sm text-hint text-center py-12">No entries in this collection yet. Select entries from the Local/Global view and use "Add to Collection".</div>):(
              <div className="flex flex-col gap-0">
                {collectionEntries.map((e,idx)=>{
                  const thumb=ytId(e.url)?`https://img.youtube.com/vi/${ytId(e.url)}/mqdefault.jpg`:e.image_url;
                  const isDragging=dragRef.current!==null;
                  const isDragSource=dragRef.current===idx;
                  const insertIdx=getInsertIdx();
                  const showLineAbove=isDragging&&insertIdx===idx&&dragRef.current!==idx&&dragRef.current!==idx-1;
                  const showLineBelow=isDragging&&idx===collectionEntries.length-1&&insertIdx===collectionEntries.length&&dragRef.current!==idx;
                  // Push cards apart at insertion point
                  const pushDown=showLineAbove;
                  const pushUp=isDragging&&insertIdx===idx+1&&dragRef.current!==idx&&dragRef.current!==idx+1&&idx<collectionEntries.length-1;
                  return(<div key={e.id} className="relative"
                    onDragOver={ev=>handleReorderDragOver(ev,idx)} onDrop={ev=>handleReorderDrop(ev,idx)}
                    style={{transition:"padding 0.3s cubic-bezier(0.2,1,0.3,1)",paddingTop:showLineAbove?"24px":"4px",paddingBottom:(showLineBelow||pushUp)?"24px":"4px"}}>
                    {/* Insertion indicator line — above */}
                    {showLineAbove&&<div className="absolute left-4 right-4 top-[8px] flex items-center gap-2 pointer-events-none" style={{transition:"opacity 0.2s ease"}}>
                      <div className="w-3 h-3 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(147,51,234,0.5)] flex-shrink-0"/>
                      <div className="flex-1 h-[3px] rounded-full bg-gradient-to-r from-purple-500 to-purple-300 shadow-[0_0_10px_rgba(147,51,234,0.3)]"/>
                      <div className="w-3 h-3 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(147,51,234,0.5)] flex-shrink-0"/>
                    </div>}
                    {/* Insertion indicator line — below last */}
                    {showLineBelow&&<div className="absolute left-4 right-4 bottom-[8px] flex items-center gap-2 pointer-events-none">
                      <div className="w-3 h-3 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(147,51,234,0.5)] flex-shrink-0"/>
                      <div className="flex-1 h-[3px] rounded-full bg-gradient-to-r from-purple-500 to-purple-300 shadow-[0_0_10px_rgba(147,51,234,0.3)]"/>
                      <div className="w-3 h-3 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(147,51,234,0.5)] flex-shrink-0"/>
                    </div>}
                    {/* The card */}
                    <div style={{transition:"transform 0.3s cubic-bezier(0.2,1,0.3,1), opacity 0.25s ease",opacity:isDragSource?0.3:1,transform:isDragSource?"scale(0.97)":"scale(1)"}}
                    className={`flex items-center gap-5 bg-white border rounded-xl p-5 group border-[#e0e0e0] hover:border-[#bbb]`}>
                    {/* Drag handle — only this element is draggable */}
                    <div draggable onDragStart={ev=>handleReorderDragStart(ev,idx)} onDragEnd={handleReorderDragEnd}
                      className="text-[#ccc] text-xl select-none flex-shrink-0 cursor-grab active:cursor-grabbing group-hover:text-[#999] transition">☰</div>
                    {/* Thumbnail */}
                    <div className="w-[180px] h-[120px] bg-surface2 rounded-lg overflow-hidden flex-shrink-0 cursor-pointer" onClick={()=>setSb(e)}>
                      {thumb?<img src={thumb} className="w-full h-full object-cover" alt=""/>:<div className="w-full h-full flex items-center justify-center text-hint text-xs">No image</div>}
                    </div>
                    {/* Entry info */}
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={()=>setSb(e)}>
                      <div className="flex gap-2 items-center mb-1.5">
                        {(e.competitor||e.brand_name)&&<span className="text-xs font-medium bg-[#333] text-white px-2 py-0.5 rounded">{e.competitor||e.brand_name}</span>}
                        {e.rating&&<span className="text-sm">{"★".repeat(Number(e.rating))}</span>}
                      </div>
                      <p className="text-base font-bold text-main mb-1">{e.description||"—"}{e.year?` (${e.year})`:""}</p>
                      <p className="text-sm text-muted">{[e.category,e.type,e.brand_archetype||e.communication_intent].filter(Boolean).join(" • ")}</p>
                    </div>
                    {/* Custom title/note */}
                    <div className="flex flex-col gap-1.5 w-[260px] flex-shrink-0" onClick={ev=>ev.stopPropagation()}>
                      <input defaultValue={e._custom_title||""} placeholder="Slide title..." onBlur={ev=>updateEntryCustom(e.id,"custom_title",ev.target.value)} className="px-3 py-1.5 text-sm bg-white border border-[#e0e0e0] rounded-lg text-main placeholder:text-[#bbb] focus:outline-none focus:border-[#999] transition font-semibold" />
                      <MiniEditor key={`note-${e.id}`} value={e._custom_note||""} onBlur={html=>updateEntryCustom(e.id,"custom_note",html)} placeholder="Analyst note..." minimal
                        className="px-3 py-1.5 bg-white border border-[#e0e0e0] rounded-lg text-muted focus-within:border-[#999] transition min-h-[36px]"
                        editorClassName="text-[13px] text-[var(--text2)] min-h-[20px]" />
                    </div>
                    {/* Remove — hidden until hover */}
                    <button onClick={()=>removeFromCollection(activeCollection.id,e.id)} className="text-[#ccc] hover:text-red-400 text-lg flex-shrink-0 opacity-0 group-hover:opacity-100 transition" title="Remove from collection">×</button>
                  </div>
                  {/* Interstitial note — between cases */}
                  {idx<collectionEntries.length-1&&(
                    <div className="flex justify-center py-3 px-8">
                      <MiniEditor key={`inter-${e.id}`}
                        value={e._interstitial_note||""}
                        placeholder="Transition note between slides..."
                        minimal
                        onBlur={html=>updateEntryCustom(e.id,"interstitial_note",html)}
                        className="w-[500px] px-3 py-2 border border-[#e0e0e0] rounded-lg bg-white focus-within:border-purple-300 transition" editorClassName="text-sm text-[var(--text2)] min-h-[32px]" />
                    </div>
                  )}
                  </div>);
                })}
              </div>
            )}
            {/* Closing notes — up to 5 slides before thank you */}
            {collectionEntries.length>0&&(()=>{
              let notes=[];
              try{notes=JSON.parse(activeCollection?.closing_note||"[]");}catch{notes=activeCollection?.closing_note?[activeCollection.closing_note]:[];}
              if(!Array.isArray(notes))notes=notes?[notes]:[];
              const saveNotes=(updated,persist=true)=>{const json=JSON.stringify(updated);setActiveCollection(prev=>({...prev,closing_note:json}));if(persist){const clean=JSON.stringify(updated.filter(n=>_cleanHtml(n)));supabase.from("collections").update({closing_note:clean}).eq("id",activeCollection.id);}};
              return(
                <div className="px-8 py-4">
                  <p className="text-xs text-hint uppercase font-semibold mb-3 text-center">Closing slides (before thank you)</p>
                  <div className="flex flex-col items-center gap-2">
                    {notes.map((n,i)=>(
                      <div key={i} className="flex items-center gap-2">
                        <MiniEditor key={`closing-${i}-${activeCollection?.id}`} value={n||""} placeholder={`Closing slide ${i+1}...`} minimal
                          onBlur={html=>{const u=[...notes];u[i]=html;saveNotes(u);}}
                          className="w-[500px] px-3 py-2 border border-[#e0e0e0] rounded-lg bg-white focus-within:border-purple-300 transition" editorClassName="text-sm text-[var(--text2)] min-h-[32px]" />
                        <button onClick={()=>{const u=[...notes];u.splice(i,1);saveNotes(u);}} className="text-[#ccc] hover:text-red-400 text-lg transition">×</button>
                      </div>
                    ))}
                    {notes.length<5&&(
                      <button onClick={()=>{const u=[...notes,""];saveNotes(u,false);}} className="text-xs text-muted hover:text-main border border-dashed border-[#ddd] rounded-lg px-4 py-2 hover:border-[#bbb] transition">+ Add closing slide</button>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {viewMode==="entries"&&<>
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
              <option value="updated">Last updated</option>
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
                      <select autoFocus value={e[field]||""} onChange={ev=>{inlineSave(e.id,field,ev.target.value);}}
                        onBlur={ev=>{if(ev.relatedTarget&&ev.currentTarget.parentElement.contains(ev.relatedTarget))return;setTimeout(()=>setInlineEdit(null),250);}}
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
                  <td className="px-2 py-2.5">{scope==="local"?<Tag v={e.competitor||e.brand_name||"—"}/>:<span className="font-medium text-main">{e.brand||e.brand_name||"—"}</span>}</td>
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
              return(<div key={e.id} onClick={()=>setSb(e)} className="bg-surface border border-main rounded-lg overflow-hidden cursor-pointer hover:border-[var(--accent)] transition group relative">
                <div className={`absolute top-2 left-2 z-10 ${selected.size>0||selected.has(e.id)?"opacity-100":"opacity-0 group-hover:opacity-100"} transition`} onClick={ev=>ev.stopPropagation()}>
                  <input type="checkbox" checked={selected.has(e.id)} onChange={()=>toggleSelect(e.id)} className="w-4 h-4 rounded border-2 border-white shadow cursor-pointer accent-[var(--accent)]" />
                </div>
                <div className="h-[120px] bg-surface2 flex items-center justify-center overflow-hidden relative">
                  {thumb?<img src={thumb} className="w-full h-full object-cover" alt=""/>:isVideoFile(e.url)?<video src={e.url} className="w-full h-full object-cover" muted preload="metadata" onLoadedData={ev=>{ev.target.currentTime=1;}} />:<div className="text-hint text-xs">No preview</div>}
                  {(ytId(e.url)||isVideoFile(e.url))&&<div className="absolute inset-0 flex items-center justify-center pointer-events-none"><div className="w-8 h-8 rounded-full bg-black/50 flex items-center justify-center"><svg width="12" height="12" viewBox="0 0 20 20" fill="white"><polygon points="6,3 17,10 6,17"/></svg></div></div>}
                  {e.image_urls&&JSON.parse(e.image_urls||"[]").length>0&&<span className="absolute bottom-1 right-1 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded-full">+{JSON.parse(e.image_urls||"[]").length}</span>}
                </div>
                <div className="p-2.5">
                  <div className="flex gap-1 mb-1">{(e.competitor||e.brand_name)&&<Tag v={e.competitor||e.brand_name}/>}{e.brand&&<span className="text-[10px] font-semibold text-main bg-surface2 px-1 rounded">{e.brand}</span>}</div>
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
        </>}
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
        <div className="p-3 border-b border-main flex justify-between items-center sticky top-0 bg-surface z-10"><b className="text-sm text-main">{sb.description||sb.competitor||sb.brand||sb.brand_name}</b><span onClick={()=>setSb(null)} className="cursor-pointer text-lg text-hint hover:text-main">×</span></div>
        {ytId(sb.url)&&<div className="px-3 pt-2"><iframe width="100%" height="195" src={`https://www.youtube-nocookie.com/embed/${ytId(sb.url)}?rel=0&modestbranding=1&iv_load_policy=3`} frameBorder="0" allowFullScreen className="rounded-md" /></div>}
        {isVideoFile(sb.url)&&!ytId(sb.url)&&<div className="px-3 pt-2">
          <video controls width="100%" className="rounded-md" src={sb.url} style={{maxHeight:240}} />
          <div className="flex items-center justify-center gap-2 mt-2">
            <button onClick={()=>{
              const v=document.querySelector(`video[src="${sb.url}"]`);
              if(!v)return;
              const c=document.createElement("canvas");c.width=v.videoWidth;c.height=v.videoHeight;
              c.getContext("2d").drawImage(v,0,0);
              c.toBlob(async(blob)=>{
                if(!blob)return;
                const url=await uploadFile(blob.name?blob:new File([blob],`still_${Date.now()}.jpg`,{type:"image/jpeg"}));
                if(url){
                  if(!sb.image_url){
                    await supabase.from("creative_source").update({image_url:url}).eq("id",sb.id);
                    setSb({...sb,image_url:url});
                  }else{
                    const extras=JSON.parse(sb.image_urls||"[]");extras.push(url);
                    await supabase.from("creative_source").update({image_urls:JSON.stringify(extras)}).eq("id",sb.id);
                    setSb({...sb,image_urls:JSON.stringify(extras)});
                  }
                  setToast({message:"Still captured"});load();
                }
              },"image/jpeg",0.9);
            }} className="flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-main rounded-lg text-xs font-medium text-muted hover:text-main hover:border-[var(--accent)] transition">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="5"/><circle cx="8" cy="8" r="2" fill="currentColor"/></svg>
              Capture still
            </button>
          </div>
        </div>}
        {sb.image_url&&!ytId(sb.url)&&<div className="px-3 pt-2 relative group/sb">
          <img src={sb.image_url} className="w-full rounded-md cursor-pointer hover:opacity-90 transition" onClick={()=>setZoomImg(sb.image_url)} title="Click to zoom" />
          <button onClick={()=>{setCropSrc(sb.image_url);setCropTarget("sidebar");}} className="absolute top-3 right-4 bg-black/60 text-white/80 hover:text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover/sb:opacity-100 transition backdrop-blur-sm" title="Crop image">Crop</button>
          {sb.image_urls&&JSON.parse(sb.image_urls||"[]").length>0&&(
            <div className="flex gap-1.5 mt-1.5 flex-wrap">
              {JSON.parse(sb.image_urls||"[]").map((url,i)=>(
                <img key={i} src={url} className="w-16 h-16 object-cover rounded border border-main cursor-pointer hover:opacity-80" onClick={()=>window.open(url,"_blank")}/>
              ))}
            </div>
          )}
        </div>}
        {sb.url&&!ytId(sb.url)&&!isVideoFile(sb.url)&&!sb.image_url&&<div className="px-3 pt-1"><a href={sb.url} target="_blank" className="text-[11px] text-accent break-all">{sb.url}</a></div>}
        <div className="p-3">
          <div className="flex gap-1 flex-wrap mb-2">{(sb.competitor||sb.brand_name)&&<Tag v={sb.competitor||sb.brand_name}/>}{sb.brand&&<span className="text-xs font-semibold text-main bg-surface2 px-1.5 py-0.5 rounded">{sb.brand}</span>}{sb.category&&<Tag v={sb.category}/>}{sb.year&&<span className="bg-surface2 px-1.5 py-0.5 rounded text-[11px] text-main">{sb.year}</span>}{sb.rating&&<span className="text-[11px]">{"★".repeat(Number(sb.rating))}</span>}</div>
          <div className="flex gap-3 mt-1 flex-wrap">{sb.created_by&&<span className="text-[10px] text-hint">Added by <span className="text-main font-medium">{sb.created_by}</span></span>}{sb.created_at&&<span className="text-[10px] text-hint">Created <span className="text-main">{fmtDate(sb.created_at)}</span></span>}{sb.updated_at&&<span className="text-[10px] text-hint">Updated <span className="text-main">{fmtDate(sb.updated_at)}</span></span>}</div>
          {[["Type",sb.type],["Portrait",sb.portrait],["Phase",sb.journey_phase],["Lifecycle",sb.client_lifecycle],["Door",sb.entry_door],["Role",sb.bank_role],["Archetype",sb.brand_archetype],["Tone",sb.tone_of_voice],["Language",sb.language_register],["Territory",sb.primary_territory],["Execution",sb.execution_style],["VP",sb.main_vp],["Slogan",sb.main_slogan]].filter(([,v])=>v&&v!==""&&!v.startsWith("Not ")&&!v.startsWith("None")).map(([l,v])=>(<div key={l} className="text-xs mb-0.5"><span className="text-muted">{l}:</span> <span className="text-main">{v}</span></div>))}
        </div>
        {sb.synopsis&&<div className="px-3 pb-2"><div className="text-[10px] font-semibold text-hint uppercase mb-1">Synopsis</div><div className="text-xs leading-relaxed bg-surface2 p-2 rounded text-main">{sb.synopsis}</div></div>}
        {sb.insight&&<div className="px-3 pb-2"><div className="text-[10px] font-semibold text-hint uppercase mb-1">Insight</div><div className="text-xs leading-relaxed bg-surface2 p-2 rounded text-main">{sb.insight}</div></div>}
        {sb.transcript&&<div className="px-3 pb-2"><div className="text-[10px] font-semibold text-hint uppercase mb-1">Transcript</div><div className="text-xs leading-relaxed bg-surface2 p-2 rounded max-h-[150px] overflow-auto whitespace-pre-wrap text-main">{sb.transcript}</div></div>}
        {sb.analyst_comment&&<div className="px-3 pb-2"><div className="text-[10px] font-semibold text-hint uppercase mb-1">Analyst notes</div><div className="text-xs leading-relaxed bg-surface2 p-2 rounded text-main">{sb.analyst_comment}</div></div>}
        <div className="p-3 border-t border-main sticky bottom-0 bg-surface flex gap-2">
          <button onClick={()=>openForm(sb)} className="flex-1 bg-accent text-white py-2 rounded-lg text-sm font-semibold hover:opacity-90">Edit</button>
          <button onClick={()=>downloadCase(sb)} disabled={downloading} className="px-3 py-2 border border-main rounded-lg text-xs text-muted hover:text-main hover:bg-surface2 transition disabled:opacity-50">
            {downloading?"Generating...":"↓ PDF"}
          </button>
          <button onClick={()=>moveEntry(sb)} className="px-3 py-2 border border-main rounded-lg text-xs text-muted hover:text-main hover:bg-surface2 transition" title={`Move to ${sb.scope==="local"?"Global":"Local"}`}>
            {sb.scope==="local"?"→ Global":"→ Local"}
          </button>
        </div>
      </div>)}

      {toast&&<Toast {...toast} onClose={()=>setToast(null)}/>}

      {/* Image crop modal */}
      {cropSrc&&typeof window!=="undefined"&&createPortal(
        <ImageCropper src={cropSrc} onCropped={handleCropped} onCancel={()=>{setCropSrc(null);setCropTarget(null);}} />,
        document.body
      )}

      {/* Image zoom modal — via portal to escape stacking contexts */}
      {zoomImg&&typeof window!=="undefined"&&createPortal(
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center cursor-pointer animate-fadeIn" style={{zIndex:99999}} onClick={()=>setZoomImg(null)}>
          <div className="absolute top-5 right-5 flex items-center gap-2">
            <button className="text-white/60 hover:text-white text-xs px-3 py-1.5 rounded-lg hover:bg-white/10 border border-white/20 transition" onClick={(e)=>{e.stopPropagation();setCropSrc(zoomImg);setCropTarget(sb?"sidebar":"primary");setZoomImg(null);}}>Crop</button>
            <button className="text-white/60 hover:text-white text-3xl w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 transition" onClick={()=>setZoomImg(null)}>×</button>
          </div>
          <img src={zoomImg} className="max-w-[92vw] max-h-[92vh] object-contain rounded-lg shadow-2xl" onClick={e=>e.stopPropagation()} alt="" />
        </div>,
        document.body
      )}

      {/* Edit collection modal — portal to render above fixed bars */}
      {editingCollection&&typeof window!=="undefined"&&createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center animate-fadeIn" style={{zIndex:99999}} onClick={()=>setEditingCollection(null)}>
          <div className="bg-surface border border-main rounded-xl p-5 w-[400px] shadow-2xl" onClick={e=>e.stopPropagation()}>
            <h3 className="text-sm font-bold text-main mb-3">Edit Collection</h3>
            <div className="space-y-3">
              <div><label className="text-xs font-medium text-muted block mb-1">Name</label>
                <input defaultValue={editingCollection.name} onChange={e=>{editingCollection._name=e.target.value;}} className="w-full px-2 py-1.5 bg-surface border border-main rounded text-sm text-main focus:outline-none focus:border-accent" /></div>
              <div><label className="text-xs font-medium text-muted block mb-1">Description</label>
                <input defaultValue={editingCollection.description||""} onChange={e=>{editingCollection._description=e.target.value;}} className="w-full px-2 py-1.5 bg-surface border border-main rounded text-sm text-main focus:outline-none focus:border-accent" /></div>
              <div><label className="text-xs font-medium text-muted block mb-1">Objective</label>
                <input defaultValue={editingCollection.objective||""} onChange={e=>{editingCollection._objective=e.target.value;}} className="w-full px-2 py-1.5 bg-surface border border-main rounded text-sm text-main focus:outline-none focus:border-accent" /></div>
              <label className="flex items-center gap-2 text-xs text-main"><input type="checkbox" defaultChecked={editingCollection.is_private} onChange={e=>{editingCollection._is_private=e.target.checked;}} /> Private</label>
              <div className="flex gap-2">
                <button onClick={()=>{updateCollection(editingCollection.id,{name:editingCollection._name??editingCollection.name,description:editingCollection._description??editingCollection.description,objective:editingCollection._objective??editingCollection.objective,is_private:editingCollection._is_private??editingCollection.is_private});}} className="px-3 py-1.5 text-xs bg-[#333] text-white rounded-lg font-semibold">Save</button>
                <button onClick={()=>setEditingCollection(null)} className="px-3 py-1.5 text-xs border border-main rounded-lg text-muted">Cancel</button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Report generation modal */}
      {showReportModal&&typeof window!=="undefined"&&createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center animate-fadeIn" style={{zIndex:99999}} onClick={()=>{if(!reportGenerating)setShowReportModal(false);}}>
          <div className="bg-surface border border-main rounded-xl p-6 w-[500px] shadow-2xl" onClick={e=>e.stopPropagation()}>
            <h3 className="text-lg font-bold text-main mb-1">Generate Report</h3>
            <p className="text-xs text-muted mb-4">from "{activeCollection?.name}" · {collectionEntries.length} entries</p>
            <label className="text-xs font-medium text-muted block mb-1.5">What kind of report do you need?</label>
            <textarea value={reportInstructions} onChange={e=>setReportInstructions(e.target.value)} rows={5} placeholder="E.g., Compare the storytelling approaches across these campaigns and identify which emotional territories are most effective for small business banking. Include a section on tone consistency and creative differentiation..." className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[#999] resize-none placeholder:text-[#bbb]" autoFocus disabled={reportGenerating} />
            <div className="flex justify-between items-center mt-4">
              <p className="text-[10px] text-hint">Uses Claude Opus · saves to Reports section</p>
              <div className="flex gap-2">
                <button onClick={()=>{setShowReportModal(false);setReportInstructions("");}} disabled={reportGenerating} className="px-3 py-1.5 text-sm border border-main rounded-full text-muted hover:text-main transition disabled:opacity-50">Cancel</button>
                <button onClick={generateCollectionReport} disabled={reportGenerating||!reportInstructions.trim()} className="px-4 py-1.5 text-sm bg-[#1a1a1a] text-white rounded-full font-medium hover:bg-black transition disabled:opacity-50 flex items-center gap-1.5">
                  {reportGenerating?<><svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="30 70" strokeLinecap="round"/></svg>Generating...</>:"Generate Report"}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Report ready toast */}
      {reportToast&&typeof window!=="undefined"&&createPortal(
        <div className="fixed bottom-6 right-6 animate-fadeIn" style={{zIndex:99999}}>
          <div className="bg-white border border-[#e0e0e0] rounded-xl shadow-2xl p-4 flex items-center gap-3 max-w-[340px]">
            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-main">Report ready</p>
              <p className="text-xs text-muted truncate">{reportToast.title}</p>
            </div>
            <button onClick={()=>{setReportToast(null);router.push(`/reports?report=${reportToast.reportId}`);}} className="px-3 py-1 text-xs bg-[#1a1a1a] text-white rounded-full font-medium hover:bg-black transition flex-shrink-0">View</button>
            <button onClick={()=>setReportToast(null)} className="text-[#ccc] hover:text-[#999] text-lg flex-shrink-0">×</button>
          </div>
        </div>,
        document.body
      )}

      {/* Presentation mode — fullscreen slideshow */}
      {presentationMode&&collectionEntries.length>0&&typeof window!=="undefined"&&createPortal(
        <div className="fixed inset-0 flex flex-col" style={{zIndex:99999,background:"#0a0f3c"}}
          onKeyDown={e=>{
            const _hasText=(h)=>{if(!h)return false;return h.replace(/<[^>]*>/g,"").replace(/&nbsp;/g," ").trim().length>0;};
            let _cn=[];try{_cn=JSON.parse(activeCollection?.closing_note||"[]");}catch{_cn=activeCollection?.closing_note?[activeCollection.closing_note]:[];}
            if(!Array.isArray(_cn))_cn=_cn?[_cn]:[];
            const interstitialCount=collectionEntries.filter((ce,i)=>_hasText(ce._interstitial_note)&&i<collectionEntries.length-1).length+(_hasText(activeCollection?.intro_note)?1:0)+_cn.filter(c=>_hasText(c)).length;
            const totalSlides=collectionEntries.length+interstitialCount+2;
            // Don't navigate if user is editing text (input, textarea, contenteditable)
            const tag=document.activeElement?.tagName;
            const isEditing=tag==="INPUT"||tag==="TEXTAREA"||document.activeElement?.isContentEditable;
            if(isEditing&&e.key!=="Escape")return;
            if(e.key==="ArrowRight"||e.key===" ")setPresIndex(i=>Math.min(i+1,totalSlides-1));
            if(e.key==="ArrowLeft")setPresIndex(i=>Math.max(i-1,0));
            if(e.key==="Escape")setPresentationMode(false);
          }} tabIndex={0} ref={el=>el&&el.focus()}>
          {(()=>{
            // Build slide map: intro, then for each entry: entry slide + optional interstitial slide, then outro
            // Helper: check if HTML has actual visible text
            const hasText=(html)=>{if(!html)return false;const t=html.replace(/<[^>]*>/g,"").replace(/&nbsp;/g," ").trim();return t.length>0;};
            const slideMap=[{type:"intro"}];
            if(hasText(activeCollection?.intro_note)){
              slideMap.push({type:"interstitial",text:activeCollection.intro_note,entryIdx:-1});
            }
            collectionEntries.forEach((ce,i)=>{
              slideMap.push({type:"entry",entryIdx:i});
              if(hasText(ce._interstitial_note)&&i<collectionEntries.length-1){
                slideMap.push({type:"interstitial",text:ce._interstitial_note,entryIdx:i});
              }
            });
            // Closing notes — parse as JSON array (backward compat: string → single item)
            let _closingNotes=[];
            try{_closingNotes=JSON.parse(activeCollection?.closing_note||"[]");}catch{_closingNotes=activeCollection?.closing_note?[activeCollection.closing_note]:[];}
            if(!Array.isArray(_closingNotes))_closingNotes=_closingNotes?[_closingNotes]:[];
            _closingNotes.forEach((cn,ci)=>{
              if(hasText(cn))slideMap.push({type:"interstitial",text:cn,entryIdx:-2-ci});
            });
            slideMap.push({type:"outro"});
            const totalSlides=slideMap.length;
            const currentSlide=slideMap[presIndex]||slideMap[0];
            const isIntro=currentSlide.type==="intro";
            const isOutro=currentSlide.type==="outro";
            const isInterstitial=currentSlide.type==="interstitial";
            const entryIdx=currentSlide.entryIdx??-1;
            const entry=currentSlide.type==="entry"?collectionEntries[entryIdx]:null;

            // Navigation arrows (always visible)
            const navArrows=(<>
              <button onClick={()=>setPresIndex(i=>Math.max(i-1,0))} disabled={presIndex===0}
                className="absolute left-5 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/60 text-4xl w-12 h-12 flex items-center justify-center rounded-full hover:bg-white/5 transition disabled:opacity-0 z-10">&lsaquo;</button>
              <button onClick={()=>setPresIndex(i=>Math.min(i+1,totalSlides-1))} disabled={presIndex===totalSlides-1}
                className="absolute right-5 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/60 text-4xl w-12 h-12 flex items-center justify-center rounded-full hover:bg-white/5 transition disabled:opacity-0 z-10">&rsaquo;</button>
            </>);

            // Close button
            const closeBtn=<button onClick={()=>setPresentationMode(false)} className="absolute top-4 right-4 text-white/20 hover:text-white/60 text-2xl w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/5 transition z-10">×</button>;
            const kdLogo=<img src="/knots-dots-logo.png" alt="K&D" className="absolute z-10" style={{top:30,left:30,height:28}} />;

            // ── INTRO SLIDE ── (Inter font throughout)
            if(isIntro){
              const countrySet=new Set(collectionEntries.map(ce=>ce.country).filter(Boolean));
              return(<div className="flex-1 flex flex-col items-center justify-center relative" style={{background:"#0a0f3c"}}>
                {closeBtn}{kdLogo}{navArrows}
                <div className="flex flex-col items-center max-w-3xl px-8">
                  {/* K&D logo */}
                  <img src="/knots-dots-logo.png" alt="K&D" className="mb-16" style={{height:48}} />
                  {/* "presents" */}
                  <p className="text-white/30 text-[15px] italic mb-4">presents</p>
                  {/* Brand name — Inter Black 20 uppercase */}
                  <p className="text-white/50 text-[20px] font-black uppercase tracking-[0.08em] mb-2">{brand?.name||"Groundwork"}</p>
                  {/* Blue line */}
                  <div className="w-full max-w-xl h-[2px] mb-10" style={{background:"#0019FF"}}/>
                  {/* Collection name — Inter Black 48 uppercase */}
                  <h1 className="text-white text-[40px] md:text-[48px] font-black uppercase tracking-tight leading-[1.1] text-center mb-4">{activeCollection?.name||"Collection"}</h1>
                  {/* Blue line */}
                  <div className="w-full max-w-xl h-[2px] mt-2 mb-10" style={{background:"#0019FF"}}/>
                  {/* Stats — Inter Regular 15 */}
                  <p className="text-white/30 text-[15px] font-normal">{collectionEntries.length} cases{countrySet.size>0?<span className="mx-2 text-white/15">|</span>:""}{countrySet.size>0?`${countrySet.size} ${countrySet.size===1?"country":"countries"}`:""}</p>
                </div>
              </div>);
            }

            // ── OUTRO SLIDE ──
            if(isOutro){
              return(<div className="flex-1 flex flex-col items-center justify-center relative" style={{background:"#0a0f3c"}}>
                {closeBtn}{kdLogo}{navArrows}
                <div className="text-center max-w-lg px-8">
                  <div className="text-white/10 text-6xl font-bold uppercase tracking-[0.2em] mb-6" style={{lineHeight:1}}>K<br/>&<br/>D.</div>
                  <div className="w-16 h-px bg-white/10 mx-auto mb-6"></div>
                  <h2 className="text-white text-3xl md:text-4xl font-bold uppercase tracking-tight mb-4">Thank You</h2>
                  {activeCollection?.name&&<p className="text-white/40 text-sm mb-2">{activeCollection.name}</p>}
                  <p className="text-white/20 text-xs mt-6">A Knots & Dots product</p>
                  <p className="text-white/10 text-[10px] mt-2">groundwork by knots & dots &middot; {new Date().getFullYear()}</p>
                </div>
              </div>);
            }

            // ── INTERSTITIAL SLIDE ── Inter Black 48, blue bg, editable
            if(isInterstitial){
              const saveInterstitial=(html)=>{
                const eidx=currentSlide.entryIdx;
                if(eidx===-1){// intro
                  const v=_cleanHtml(html);
                  supabase.from("collections").update({intro_note:v}).eq("id",activeCollection.id);
                  setActiveCollection(prev=>({...prev,intro_note:v}));
                }else if(eidx<=-2){// closing (array index = -(eidx+2))
                  const ci=-(eidx+2);
                  let notes=[];try{notes=JSON.parse(activeCollection?.closing_note||"[]");}catch{notes=activeCollection?.closing_note?[activeCollection.closing_note]:[];}
                  if(!Array.isArray(notes))notes=notes?[notes]:[];
                  notes[ci]=html;
                  const json=JSON.stringify(notes.filter(n=>_cleanHtml(n)));
                  supabase.from("collections").update({closing_note:json}).eq("id",activeCollection.id);
                  setActiveCollection(prev=>({...prev,closing_note:json}));
                }else{// between entries
                  updateEntryCustom(collectionEntries[eidx]?.id,"interstitial_note",html);
                }
              };
              return(<div className="flex-1 flex flex-col items-center justify-center relative" style={{background:"#0019FF"}}>
                {closeBtn}{kdLogo}{navArrows}
                <div className="max-w-4xl px-16 w-full">
                  <MiniEditor key={`pres-inter-${presIndex}`} value={currentSlide.text||""} onBlur={saveInterstitial} dark
                    editorClassName="text-white text-[36px] md:text-[48px] font-black leading-[1.15] min-h-[60px]" />
                </div>
              </div>);
            }

            // ── ENTRY SLIDE ──
            const brandName=entry.competitor||entry.brand_name||entry.brand||"";
            const customTitle=entry._custom_title;
            const customNote=entry._custom_note;
            return(<div className="flex-1 flex flex-col relative" style={{background:"#111015"}}>
              {closeBtn}{kdLogo}
              {/* Counter */}
              <div className="absolute top-4 left-5 text-white/20 text-xs font-mono z-10">{presIndex} / {totalSlides-2}</div>
              {navArrows}

              {/* Content column — everything in one centered block */}
              <div className="flex-1 flex flex-col justify-center items-center py-4 overflow-hidden">
                <div className="w-full" style={{maxWidth:"min(960px, 80vw)"}}>
                  {/* Custom title + note — tight above the visual */}
                  {(customTitle||customNote||true)&&(
                    <div className="flex-shrink-0" style={{marginBottom:60}}>
                      <input key={`pres-title-${entry.id}`} defaultValue={customTitle||""} placeholder="Slide title..." onBlur={ev=>{const v=ev.target.value;updateEntryCustom(entry.id,"custom_title",v);setCollectionEntries(prev=>prev.map(ce=>ce.id===entry.id?{...ce,_custom_title:v}:ce));}}
                        className="text-white text-[24px] font-black leading-tight bg-transparent border-none focus:outline-none w-full placeholder:text-white/20" />
                      <MiniEditor key={`pres-note-${entry.id}`} value={customNote||""} placeholder="Analyst note..." minimal dark
                        onBlur={html=>{updateEntryCustom(entry.id,"custom_note",html);setCollectionEntries(prev=>prev.map(ce=>ce.id===entry.id?{...ce,_custom_note:html}:ce));}}
                        className="mt-1" editorClassName="text-[13px] text-white/50 min-h-[18px]" />
                    </div>
                  )}

                  {/* Visual */}
                  <div className="flex-shrink-0">
                    {ytId(entry.url)?(
                      <div style={{aspectRatio:"16/9"}}><iframe key={`${entry.id}-${presAutoplay}`} src={`https://www.youtube-nocookie.com/embed/${ytId(entry.url)}?autoplay=${presAutoplay?1:0}&rel=0&modestbranding=1&iv_load_policy=3&showinfo=0`} frameBorder="0" allow="autoplay; encrypted-media" allowFullScreen className="w-full h-full rounded-lg shadow-2xl" /></div>
                    ):entry.image_url?(
                      <img src={entry.image_url} className="w-full max-h-[55vh] object-contain rounded-lg shadow-2xl" alt="" />
                    ):entry.url?(
                      <div className="bg-white/5 rounded-xl p-8">
                        <a href={entry.url} target="_blank" className="text-[#4060ff] text-sm break-all hover:underline">{entry.url}</a>
                      </div>
                    ):(
                      <div className="bg-white/5 rounded-xl p-12 text-white/20 text-sm">No visual</div>
                    )}
                  </div>
                  {/* Case detail bar — below the visual with 30px gap */}
                  <div className="py-3 rounded-b-lg" style={{background:"#1a1a1f",marginTop:30}}>
                  <div className="flex items-center gap-3 mb-1">
                    {brandName&&<span className="text-white/80 text-[14px] font-bold">{brandName}</span>}
                    {entry.year&&<span className="text-white/30 text-[13px]">{entry.year}</span>}
                    {entry.category&&<span className="text-white/20 text-[11px] bg-white/5 px-2 py-0.5 rounded">{entry.category}</span>}
                    {entry.type&&<span className="text-white/20 text-[11px] bg-white/5 px-2 py-0.5 rounded">{entry.type}</span>}
                    {entry.communication_intent&&<span className="text-white/20 text-[11px] bg-white/5 px-2 py-0.5 rounded">{entry.communication_intent}</span>}
                    {entry.rating&&<span className="text-white/40 text-[11px]">{"★".repeat(Number(entry.rating))}</span>}
                  </div>
                  <h3 className="text-white/70 text-[13px] font-medium">{entry.description||"Untitled"}</h3>
                  {entry.synopsis&&<p className="text-white/30 text-[12px] leading-relaxed mt-1 line-clamp-2">{entry.synopsis}</p>}
                  </div>
                </div>
              </div>

              {/* Thumbnail strip */}
              <div className="px-4 py-2 flex-shrink-0 overflow-x-auto" style={{background:"#111015"}}>
                <div className="flex gap-1.5 justify-center">
                  {slideMap.map((s,si)=>{
                    if(s.type==="intro"||s.type==="outro")return null;
                    if(s.type==="interstitial")return(<button key={`inter-${si}`} onClick={()=>setPresIndex(si)} className={`w-8 h-8 rounded-full flex-shrink-0 border-2 transition flex items-center justify-center ${si===presIndex?"border-purple-500 opacity-100":"border-transparent opacity-30 hover:opacity-60"}`}><span className="text-white/40 text-[9px] italic" style={{fontFamily:"Georgia,serif"}}>&ldquo;&rdquo;</span></button>);
                    const ce=collectionEntries[s.entryIdx];
                    const t=ce?ytId(ce.url)?`https://img.youtube.com/vi/${ytId(ce.url)}/default.jpg`:ce.image_url:null;
                    return(<button key={`entry-${si}`} onClick={()=>setPresIndex(si)} className={`w-12 h-8 rounded overflow-hidden flex-shrink-0 border-2 transition ${si===presIndex?"border-[#0019FF] opacity-100":"border-transparent opacity-30 hover:opacity-60"}`}>
                      {t?<img src={t} className="w-full h-full object-cover" alt=""/>:<div className="w-full h-full bg-white/10 flex items-center justify-center text-white/20 text-[8px]">{s.entryIdx+1}</div>}
                    </button>);
                  })}
                </div>
              </div>
            </div>);
          })()}
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
  const[initialCollectionId,setInitialCollectionId]=useState(null);
  const{projectId,brandId}=useProject();
  const filterField="project_id"; // Use project_id for data queries during transition
  const filterValue=projectId||brandId;
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
        const{data:matches}=await supabase.from("creative_source").select("*").eq("id",entryId);
        const match=(matches||[])[0];
        if(match){setScope(match.scope||"local");setInitialEntry(match);}
      })();
    } else if(params.get("collection")){
      setInitialCollectionId(params.get("collection"));
    } else if(params.get("view")==="collections"){
      // Just show collections tab (no specific collection)
      setInitialCollectionId("list");
    } else if(params.get("add")&&s&&(s==="local"||s==="global")){
      handleAddWithScope(s);
    } else if(s&&(s==="local"||s==="global")){
      setScope(s);
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

  return(<AuthGuard><ProjectGuard><Nav/><AuditContent scope={scope} onScopeChange={handleScopeChange} onAddWithScope={handleAddWithScope} pendingForm={pendingForm} clearPendingForm={()=>setPendingForm(false)} projectId={projectId} initialEntry={initialEntry} clearInitialEntry={()=>setInitialEntry(null)} initialCollectionId={initialCollectionId} clearInitialCollectionId={()=>setInitialCollectionId(null)} key={scope}/></ProjectGuard></AuthGuard>);
}

export default function AuditPage(){
  return(<Suspense fallback={<div className="p-10 text-center text-hint">Loading...</div>}><AuditPageInner/></Suspense>);
}
