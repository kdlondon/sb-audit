"use client";
import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase";
import AuthGuard from "@/components/AuthGuard";
import Nav from "@/components/Nav";
import ProjectGuard from "@/components/ProjectGuard";
import { useProject } from "@/lib/project-context";
import { useFramework } from "@/lib/framework-context";
import Markdown from "react-markdown";

function ytId(u){if(!u)return null;const m=u.match(/(?:youtube\.com\/watch\?.*v=|youtu\.be\/)([^&\s]+)/);return m?m[1]:null;}

function EntryViewerPanel({entry, onClose}) {
  if (!entry) return null;
  const e = entry;
  return (
    <div className="fixed top-0 right-0 w-[390px] h-screen bg-surface border-l border-main z-50 flex flex-col" style={{boxShadow:"-2px 0 12px rgba(0,0,0,0.05)"}}>
      <div className="p-3 border-b border-main flex justify-between items-center flex-shrink-0">
        <b className="text-sm text-main truncate">{e.description||e.competitor||e.brand}</b>
        <span onClick={onClose} className="cursor-pointer text-lg text-hint hover:text-main ml-2">×</span>
      </div>
      <div className="flex-1 overflow-auto">
        {ytId(e.url)&&<div className="px-3 pt-2"><iframe width="100%" height="180" src={`https://www.youtube.com/embed/${ytId(e.url)}`} frameBorder="0" allowFullScreen className="rounded-md"/></div>}
        {e.image_url&&!ytId(e.url)&&<div className="px-3 pt-2"><img src={e.image_url} className="w-full rounded-md"/></div>}
        <div className="p-3">
          <div className="flex gap-1 flex-wrap mb-2">
            {e.competitor&&<span style={{background:"#888",color:"#fff",padding:"1px 6px",borderRadius:3,fontSize:11,fontWeight:600}}>{e.competitor}</span>}
            {e.brand&&<span className="text-xs font-semibold text-main bg-surface2 px-1.5 py-0.5 rounded">{e.brand}</span>}
            {e.year&&<span className="bg-surface2 px-1.5 py-0.5 rounded text-[11px] text-main">{e.year}</span>}
          </div>
          {[["Portrait",e.portrait],["Phase",e.journey_phase],["Door",e.entry_door],["Archetype",e.brand_archetype],["Tone",e.tone_of_voice],["Territory",e.primary_territory],["Slogan",e.main_slogan]].filter(([,v])=>v&&v!==""&&!v.startsWith("Not ")&&!v.startsWith("None")).map(([l,v])=>(
            <div key={l} className="text-xs mb-0.5"><span className="text-muted">{l}:</span> <span className="text-main">{v}</span></div>
          ))}
        </div>
        {e.synopsis&&<div className="px-3 pb-2"><div className="text-[10px] font-semibold text-hint uppercase mb-1">Synopsis</div><div className="text-xs leading-relaxed bg-surface2 p-2 rounded text-main">{e.synopsis}</div></div>}
        {e.insight&&<div className="px-3 pb-2"><div className="text-[10px] font-semibold text-hint uppercase mb-1">Insight</div><div className="text-xs leading-relaxed bg-surface2 p-2 rounded text-main">{e.insight}</div></div>}
        {e.analyst_comment&&<div className="px-3 pb-2"><div className="text-[10px] font-semibold text-hint uppercase mb-1">Analyst notes</div><div className="text-xs leading-relaxed bg-surface2 p-2 rounded text-main">{e.analyst_comment}</div></div>}
      </div>
    </div>
  );
}

function ChatContent() {
  const { projectId, brandId } = useProject();
  const filterField = brandId ? "brand_id" : "project_id";
  const filterValue = brandId || projectId;
  const { framework, frameworkLoaded } = useFramework();
  const [data, setData] = useState([]);
  const [messages, setMessages] = useState([{
    role: "assistant",
    content: "Hi! I have access to your full competitive audit — both local Canadian market and global creative benchmarks. Ask me anything."
  }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState(null);
  const endRef = useRef(null);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      // [PHASE 0] Single query to creative_source
      const { data: entries } = await supabase.from("creative_source").select("*").eq(filterField, filterValue);
      const all = (entries || []).map(e => ({ ...e, _scope: e.scope || "local" }));
      setData(all);
      setDataLoaded(true);
    })();
  }, [projectId]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const copyMsg = (idx, content) => { navigator.clipboard.writeText(content); setCopiedIdx(idx); setTimeout(() => setCopiedIdx(null), 2000); };

  const [viewerEntry, setViewerEntry] = useState(null);
  const [viewerOpen, setViewerOpen] = useState(false);

  const handleCiteClick = (entry) => {
    setViewerEntry(entry);
    setViewerOpen(true);
  };

  const renderChatContent = (rawContent) => {
    if (!rawContent) return null;

    // Strip citations from table rows
    let cleaned = rawContent
      .replace(/^(.*\|.*)$/gm, row => row.replace(/\[ENTRY:[^\]]+\]/g, ""));

    // Pull [ENTRY:id] tokens that are on their own line back inline
    cleaned = cleaned.replace(/([^\n]+)\n(\[ENTRY:[^\]]+\])/g, (m, prev, cite) => prev + " " + cite);

    // Convert [ENTRY:id] to markdown link — all inline now
    const withCiteLinks = cleaned.replace(/\[ENTRY:([^\]]+)\]/g, (match, id) => {
      const entry = data.find(e => e.id === id);
      let label = entry
        ? (entry.description || entry.competitor || entry.brand || "source").slice(0, 50)
        : "source";
      label = label.replace(/\s*\(?ID[:\s]+[\d\w]+\)?/gi, "").trim().replace(/[\[\]]/g, "").slice(0, 50);
      return `[${label}](__cite__${id})`;
    });

    return (
      <Markdown
        urlTransform={(url) => url}
        components={{
          a: ({href, children}) => {
            if (href?.startsWith("__cite__")) {
              const id = href.replace("__cite__", "");
              const entry = data.find(e => e.id === id);
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

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);

    const localEntries = data.filter(e => e._scope === "local");
    const globalEntries = data.filter(e => e._scope === "global");

    const formatEntry = (e) =>
      `[ID:${e.id}] [${e._scope.toUpperCase()}] ${e.competitor || e.brand || "?"} | ${e.description || ""} | Type:${e.type || ""} | Portrait:${e.portrait || ""} | Phase:${e.journey_phase || ""} | Role:${e.bank_role || ""} | Tone:${e.tone_of_voice || ""} | Lang:${e.language_register || ""} | Archetype:${e.brand_archetype || ""} | Territory:${e.primary_territory || ""} | Insight:${(e.insight || "").slice(0, 60)} | Transcript:${(e.transcript || "").slice(0, 60)}`;

    const dataStr = data.map(formatEntry).join("\n");
    const history = messages.filter((_, i) => i > 0).slice(-6).map(m => ({ role: m.role, content: m.content }));

    try {
      // Build dynamic system prompt based on framework
      const brandName = framework?.brandName || "the client brand";
      const industry = framework?.industry || "the competitive category";
      const market = framework?.primaryMarket || "the local market";
      const competitors = framework?.localCompetitors?.map(c => c.name || c).join(", ") || "competitors in the audit";

      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          max_tokens: 2000,
          project_id: projectId,
          brand_id: brandId,
          system: `You are a senior brand strategy analyst working on the ${brandName} competitive audit in the ${industry} industry. You have access to two datasets:

1. LOCAL AUDIT (${localEntries.length} pieces) — ${market} market competitors: ${competitors}
2. GLOBAL BENCHMARKS (${globalEntries.length} pieces) — International creative references across the category and adjacent industries

Full dataset:
${dataStr}

CITATION RULES — ABSOLUTELY MANDATORY:
- Every entry starts with [ID:xxxxxxxxxxxxxxx] — use that EXACT full numeric ID.
- Write a SHORT HUMAN-READABLE name for the piece, then add [ENTRY:id] right after it.
- Example: "Brand X's campaign [ENTRY:1773496163636] directly addresses this positioning"
- NEVER put the numeric ID in your prose. NEVER write "(ID: 883404)" or the raw description with ID.
- Use short descriptive names: "their Instagram post", "the How I made it series" — not raw DB descriptions.
- The [ENTRY:id] token is invisible to the reader. Never write it anywhere except as [ENTRY:123456].
- NEVER use short invented IDs like e28, e15 — ONLY the exact numeric ID from [ID:xxx] in the data.

Answer precisely. Be strategic and conclusive. Reference specific brands, counts, and patterns. Compare local vs global when relevant. Use markdown formatting.`,
          messages: [...history, { role: "user", content: userMsg }],
        }),
      });
      const result = await response.json();
      if (result.error) setMessages(prev => [...prev, { role: "assistant", content: "Error: " + result.error }]);
      else setMessages(prev => [...prev, { role: "assistant", content: result.content?.map(c => c.text || "").join("") || "No response." }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: "assistant", content: "Error: " + err.message }]);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg)" }}>
      <div className="section-bar px-5 py-3">
        <h2 className="text-lg font-bold text-main">Chat with your data</h2>
        <p className="text-xs text-muted">{dataLoaded ? `${data.length} entries loaded (${data.filter(e=>e._scope==="local").length} local + ${data.filter(e=>e._scope==="global").length} global)` : "Loading..."}</p>
      </div>

      <div className="flex-1 overflow-auto px-5 py-4 max-w-3xl w-full mx-auto">
        {messages.map((m, i) => (
          <div key={i} className={`mb-4 ${m.role === "user" ? "text-right" : ""}`}>
            <div className={`inline-block max-w-[85%] px-4 py-2.5 rounded-xl text-sm leading-relaxed ${
              m.role === "user" ? "bg-accent text-white rounded-br-sm" : "bg-surface border border-main text-main rounded-bl-sm"
            }`}>
              {m.role === "assistant" ? (
                <div className="prose prose-sm max-w-none dark:prose-invert">{renderChatContent(m.content)}</div>
              ) : (
                <div className="whitespace-pre-wrap">{m.content}</div>
              )}
            </div>
            {m.role === "assistant" && i > 0 && (
              <div className="mt-1">
                <button onClick={() => copyMsg(i, m.content)} className="text-[10px] text-hint hover:text-muted">
                  {copiedIdx === i ? "Copied!" : "Copy"}
                </button>
              </div>
            )}
          </div>
        ))}
        {loading && <div className="mb-4"><div className="inline-block bg-surface border border-main px-4 py-2.5 rounded-xl rounded-bl-sm text-sm text-hint animate-pulse">Thinking...</div></div>}
        <div ref={endRef} />
      </div>

      <div className="border-t border-main bg-surface px-5 py-3 max-w-3xl w-full mx-auto">
        <div className="flex gap-2">
          <input value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
            placeholder="Ask about your audit data..."
            className="flex-1 px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[var(--accent)]" />
          <button onClick={send} disabled={loading || !input.trim()}
            className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50">Send</button>
        </div>
        <div className="flex gap-2 mt-2 flex-wrap">
          {(framework?.tier === "specialist"
            ? ["Which competitor talks to Builders?","Compare local vs global tone patterns","Who owns the first cash flow crisis?","Where is the white space?","What can local brands learn from global benchmarks?"]
            : ["What positioning do competitors use?","Compare tone across competitors","Which brand stands out creatively?","Where is the white space?","What can local brands learn from global benchmarks?"]
          ).map(q => (
            <button key={q} onClick={() => setInput(q)}
              className="text-[11px] text-accent bg-accent-soft px-2 py-1 rounded-full hover:opacity-80">{q}</button>
          ))}
        </div>
      </div>
      {viewerOpen && viewerEntry && (
        <EntryViewerPanel entry={viewerEntry} onClose={() => { setViewerOpen(false); setViewerEntry(null); }} />
      )}
    </div>
  );
}

export default function ChatPage() {
  return <AuthGuard><ProjectGuard><Nav /><ChatContent /></ProjectGuard></AuthGuard>;
}
