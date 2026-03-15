"use client";
import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase";
import AuthGuard from "@/components/AuthGuard";
import Nav from "@/components/Nav";
import ProjectGuard from "@/components/ProjectGuard";
import { useProject } from "@/lib/project-context";
import Markdown from "react-markdown";

function ChatContent() {
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
      const [{ data: local }, { data: global }] = await Promise.all([
        supabase.from("audit_entries").select("*").eq("project_id",projectId),
        supabase.from("audit_global").select("*").eq("project_id",projectId),
      ]);
      const all = [
        ...(local || []).map(e => ({ ...e, _scope: "local" })),
        ...(global || []).map(e => ({ ...e, _scope: "global" })),
      ];
      setData(all);
      setDataLoaded(true);
    })();
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const copyMsg = (idx, content) => { navigator.clipboard.writeText(content); setCopiedIdx(idx); setTimeout(() => setCopiedIdx(null), 2000); };

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);

    const localEntries = data.filter(e => e._scope === "local");
    const globalEntries = data.filter(e => e._scope === "global");

    const formatEntry = (e) =>
      `[${e._scope.toUpperCase()}] ${e.competitor || e.brand || "?"} | ${e.description || ""} | Type:${e.type || ""} | Portrait:${e.portrait || ""} | Phase:${e.journey_phase || ""} | Role:${e.bank_role || ""} | Tone:${e.tone_of_voice || ""} | Lang:${e.language_register || ""} | Archetype:${e.brand_archetype || ""} | Territory:${e.primary_territory || ""} | Insight:${(e.insight || "").slice(0, 60)} | Transcript:${(e.transcript || "").slice(0, 60)}`;

    const dataStr = data.map(formatEntry).join("\n");
    const history = messages.filter((_, i) => i > 0).slice(-6).map(m => ({ role: m.role, content: m.content }));

    try {
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          max_tokens: 2000,
          system: `You are a senior brand strategy analyst for Scotiabank Business Banking. You have access to two datasets:

1. LOCAL AUDIT (${localEntries.length} pieces) — Canadian market competitors: TD, RBC, BMO, CIBC, Desjardins, Amex, Venn, Float
2. GLOBAL BENCHMARKS (${globalEntries.length} pieces) — International creative references across banking, fintech, and adjacent categories

Full dataset:
${dataStr}

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
      <div className="bg-surface border-b border-main px-5 py-3">
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
                <div className="prose prose-sm max-w-none dark:prose-invert"><Markdown>{m.content}</Markdown></div>
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
          {["Which competitor talks to Builders?","Compare local vs global tone patterns","Who owns the first cash flow crisis?","Where is the white space?","What can local brands learn from global benchmarks?"].map(q => (
            <button key={q} onClick={() => setInput(q)}
              className="text-[11px] text-accent bg-accent-soft px-2 py-1 rounded-full hover:opacity-80">{q}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ChatPage() {
  return <AuthGuard><ProjectGuard><Nav /><ChatContent /></ProjectGuard></AuthGuard>;
}
