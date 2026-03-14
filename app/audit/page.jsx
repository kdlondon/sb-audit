"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { OPTIONS, COMPETITOR_COLORS, FORM_SECTIONS } from "@/lib/options";
import AuthGuard from "@/components/AuthGuard";
import Nav from "@/components/Nav";

function ytId(u) {
  if (!u) return null;
  const m = u.match(/(?:youtube\.com\/watch\?.*v=|youtu\.be\/)([^&\s]+)/);
  return m ? m[1] : null;
}

function Tag({ v }) {
  return <span style={{ background: COMPETITOR_COLORS[v] || "#888", color: "#fff", padding: "1px 6px", borderRadius: 3, fontSize: 11, fontWeight: 600 }}>{v}</span>;
}

function AuditContent() {
  const [data, setData] = useState([]);
  const [cur, setCur] = useState({});
  const [vw, setVw] = useState("list");
  const [eid, setEid] = useState(null);
  const [fl, setFl] = useState({});
  const [sec, setSec] = useState(0);
  const [sb, setSb] = useState(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const load = useCallback(async () => {
    const { data: rows } = await supabase.from("audit_entries").select("*").order("created_at", { ascending: true });
    setData(rows || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    const e = { ...cur };
    delete e.created_at;
    if (!e.competitor && !e.description) return;
    if (eid) {
      await supabase.from("audit_entries").update(e).eq("id", eid);
    } else {
      e.id = String(Date.now());
      const { data: { session } } = await supabase.auth.getSession();
      e.created_by = session?.user?.email || "";
      await supabase.from("audit_entries").insert(e);
    }
    setCur({});
    setEid(null);
    setVw("list");
    load();
  };

  const del = async (id) => {
    await supabase.from("audit_entries").delete().eq("id", id);
    if (sb?.id === id) setSb(null);
    load();
  };

  const doExport = () => {
    const ks = ["competitor","category","description","year","type","url","transcript","entry_door","experience_reflected","portrait","richness_definition","journey_phase","client_lifecycle","moment_acquisition","moment_deepening","moment_unexpected","bank_role","pain_point_type","pain_point","language_register","main_vp","brand_attributes","emotional_benefit","rational_benefit","r2b","channel","cta","tone_of_voice","representation","industry_shown","business_size","brand_archetype","diff_claim"];
    const h = ks.join(",");
    const rows = data.map(e => ks.map(k => '"' + (e[k] || "").replace(/"/g, '""').replace(/\n/g, " ") + '"').join(","));
    const csv = [h, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "competitive_audit.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const fd = data.filter(e => Object.entries(fl).every(([k, v]) => !v || (e[k] || "").includes(v)));

  const getOpts = (f) => OPTIONS[f.optKey || f.key] || [];

  if (loading) return <div className="p-10 text-center text-gray-400">Loading entries...</div>;

  if (vw === "form") return (
    <div className="bg-gray-50 min-h-screen">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
        <h2 className="text-lg font-bold">{eid ? "Edit entry" : "New entry"}</h2>
        <div className="flex gap-2">
          <button onClick={() => { setVw("list"); setEid(null); setCur({}); }} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
          <button onClick={save} className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700">Save</button>
        </div>
      </div>
      <div className="p-6 max-w-3xl">
        {FORM_SECTIONS.map((s, si) => (
          <div key={si} className="mb-1">
            <div onClick={() => setSec(sec === si ? -1 : si)} className={`px-3 py-2 rounded-lg cursor-pointer flex justify-between text-sm font-semibold ${sec === si ? "bg-blue-50 text-blue-700 border border-blue-200" : "bg-white border border-gray-200 text-gray-700"}`}>
              <span>{s.title}</span><span className="text-gray-400">{sec === si ? "−" : "+"}</span>
            </div>
            {sec === si && (
              <div className="grid grid-cols-2 gap-2 py-3">
                {s.fields.map(f => (
                  <div key={f.key} className={f.type === "textarea" ? "col-span-2" : ""}>
                    <label className="block text-[10px] text-gray-500 uppercase font-semibold mb-0.5">{f.label}</label>
                    {f.type === "select" ? (
                      <div>
                        <select value={cur[f.key] || ""} onChange={e => setCur({ ...cur, [f.key]: e.target.value })} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm bg-white">
                          <option value="">—</option>
                          {getOpts(f).map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                        {cur[f.key] === "Other" && (
                          <input value={cur[f.key + "_other"] || ""} onChange={e => setCur({ ...cur, [f.key + "_other"]: e.target.value })} placeholder="Specify..." className="w-full mt-1 px-2 py-1 border border-blue-300 rounded text-xs bg-blue-50" />
                        )}
                      </div>
                    ) : f.type === "textarea" ? (
                      <textarea value={cur[f.key] || ""} onChange={e => setCur({ ...cur, [f.key]: e.target.value })} rows={3} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm resize-y" />
                    ) : (
                      <input value={cur[f.key] || ""} onChange={e => setCur({ ...cur, [f.key]: e.target.value })} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="bg-gray-50 min-h-screen relative">
      <div style={{ marginRight: sb ? 370 : 0 }}>
        <div className="bg-white border-b border-gray-200 px-6 py-3 flex justify-between items-center">
          <h2 className="text-lg font-bold">Audit entries</h2>
          <div className="flex gap-2">
            <button onClick={() => { setCur({}); setEid(null); setVw("form"); setSec(0); }} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700">+ Add</button>
            <button onClick={doExport} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Export</button>
          </div>
        </div>
        <div className="bg-white border-b border-gray-200 px-6 py-2 flex gap-2 flex-wrap items-center">
          <span className="text-[10px] text-gray-500 uppercase font-semibold">Filter:</span>
          {[["competitor","Competitor"],["category","Category"],["portrait","Portrait"],["journey_phase","Phase",OPTIONS.journeyPhase],["client_lifecycle","Lifecycle",OPTIONS.clientLifecycle],["brand_archetype","Archetype",OPTIONS.brandArchetype]].map(([k,l,opts]) => (
            <select key={k} value={fl[k]||""} onChange={e => setFl({...fl,[k]:e.target.value})} className="px-1.5 py-1 border border-gray-300 rounded text-xs bg-white">
              <option value="">{l}</option>
              {(opts || OPTIONS[k] || []).map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          ))}
          {Object.values(fl).some(Boolean) && <span onClick={() => setFl({})} className="text-blue-600 text-xs cursor-pointer">Clear</span>}
        </div>
        <div className="px-6 py-1 text-xs text-gray-500">{fd.length} of {data.length}</div>
        <div className="px-6 pb-6 overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b-2 border-gray-200">
                {["Competitor","Cat.","Description","Year","Type","Portrait","Phase",""].map((h,i) => (
                  <th key={i} className="text-left px-2 py-1.5 text-[10px] text-gray-500 uppercase font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fd.map(e => (
                <tr key={e.id} onClick={() => setSb(e)} className="border-b border-gray-100 cursor-pointer hover:bg-blue-50">
                  <td className="px-2 py-1.5"><Tag v={e.competitor}/></td>
                  <td className="px-2 py-1.5"><Tag v={e.category}/></td>
                  <td className="px-2 py-1.5 max-w-[180px] truncate font-medium">{e.description||"—"}</td>
                  <td className="px-2 py-1.5 text-gray-500">{e.year||"—"}</td>
                  <td className="px-2 py-1.5 text-gray-500">{e.type||"—"}</td>
                  <td className="px-2 py-1.5">{e.portrait||"—"}</td>
                  <td className="px-2 py-1.5">{e.journey_phase||"—"}</td>
                  <td className="px-2 py-1"><span onClick={ev => { ev.stopPropagation(); del(e.id); }} className="text-gray-300 hover:text-red-400 cursor-pointer">×</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {sb && (
        <div className="absolute top-0 right-0 w-[370px] bg-white border-l border-gray-200 min-h-full" style={{boxShadow:"-2px 0 12px rgba(0,0,0,0.04)"}}>
          <div className="p-3 border-b border-gray-200 flex justify-between items-center">
            <b className="text-sm">{sb.description || sb.competitor}</b>
            <span onClick={() => setSb(null)} className="cursor-pointer text-lg text-gray-400">×</span>
          </div>
          {ytId(sb.url) && <div className="px-3 pt-2"><iframe width="100%" height="185" src={`https://www.youtube.com/embed/${ytId(sb.url)}`} frameBorder="0" allowFullScreen className="rounded-md"/></div>}
          {sb.image_url && !ytId(sb.url) && <div className="px-3 pt-2"><img src={sb.image_url} className="w-full rounded-md"/></div>}
          {sb.url && !ytId(sb.url) && <div className="px-3 pt-1"><a href={sb.url} target="_blank" className="text-[11px] text-blue-600 break-all">{sb.url}</a></div>}
          <div className="p-3">
            <div className="flex gap-1 flex-wrap mb-2"><Tag v={sb.competitor}/>{sb.category&&<Tag v={sb.category}/>}{sb.year&&<span className="bg-gray-100 px-1.5 py-0.5 rounded text-[11px]">{sb.year}</span>}</div>
            {[["Type",sb.type],["Portrait",sb.portrait],["Phase",sb.journey_phase],["Lifecycle",sb.client_lifecycle],["Door",sb.entry_door],["Role",sb.bank_role],["Archetype",sb.brand_archetype],["Tone",sb.tone_of_voice],["Language",sb.language_register],["VP",sb.main_vp]].filter(([,v])=>v&&v!==""&&!v.includes("Not ")).map(([l,v])=><div key={l} className="text-xs mb-0.5"><span className="text-gray-400">{l}:</span> {v}</div>)}
          </div>
          {sb.transcript && <div className="px-3 pb-3"><div className="text-[10px] font-semibold text-gray-400 uppercase mb-1">Transcript</div><div className="text-xs leading-relaxed bg-gray-50 p-2 rounded max-h-[180px] overflow-auto whitespace-pre-wrap">{sb.transcript}</div></div>}
          <div className="px-3 pb-3">
            <button onClick={() => { setCur({...sb}); setEid(sb.id); setVw("form"); setSec(0); setSb(null); }} className="w-full bg-blue-600 text-white py-1.5 rounded text-sm font-semibold hover:bg-blue-700">Edit</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AuditPage() {
  return <AuthGuard><Nav/><AuditContent/></AuthGuard>;
}
