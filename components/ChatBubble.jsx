"use client";
import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { useProject } from "@/lib/project-context";
import { useRole, canAccess } from "@/lib/role-context";

export default function ChatBubble() {
  const pathname = usePathname();
  const { role } = useRole() || {};
  const { projectId } = useProject() || {};
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { setMounted(true); }, []);

  // Don't render anything until mounted (avoid SSR issues)
  if (!mounted) return null;
  if (!role || !canAccess(role, "chat")) return null;
  if (["/login", "/projects", "/chat"].includes(pathname)) return null;

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);

    try {
      const supabase = createClient();
      const [{ data: local }, { data: global }] = await Promise.all([
        supabase.from("audit_entries").select("competitor,description,insight,idea,primary_territory,year,type,rating").eq("project_id", projectId).limit(30),
        supabase.from("audit_global").select("brand,country,description,insight,idea,primary_territory,year,type,rating").eq("project_id", projectId).limit(30),
      ]);

      const context = [...(local || []), ...(global || [])].map(e =>
        `${e.competitor || e.brand}: ${e.description} (${e.year}, ${e.type}) — Insight: ${e.insight || "N/A"}, Territory: ${e.primary_territory || "N/A"}`
      ).join("\n");

      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: `You are an AI assistant for Groundwork, a competitive intelligence platform by Knots & Dots. Answer questions about the audit data concisely. Be strategic and insightful. Keep answers brief — this is a chat widget.\n\nAUDIT DATA:\n${context.slice(0, 4000)}`,
          messages: [...messages.slice(-6), { role: "user", content: userMsg }].map(m => ({ role: m.role, content: m.content })),
          max_tokens: 1000,
        }),
      });
      const data = await res.json();
      const reply = data.content?.[0]?.text || "Sorry, I couldn't process that.";
      setMessages(prev => [...prev, { role: "assistant", content: reply }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: "assistant", content: "Error: " + err.message }]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  useEffect(() => {
    if (open && inputRef.current) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  return (
    <>
      {/* Floating chat window */}
      {open && (
        <div className="fixed bottom-20 right-6 w-[380px] h-[500px] bg-surface border border-main rounded-2xl shadow-2xl z-[9999] flex flex-col overflow-hidden animate-fadeIn">
          {/* Header */}
          <div className="px-4 py-3 flex justify-between items-center flex-shrink-0" style={{ background: "#0a0f3c" }}>
            <div className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>
              <span className="text-sm font-semibold text-white">AI Chat</span>
            </div>
            <div className="flex items-center gap-1">
              <a href="/chat" className="text-white/40 hover:text-white/70 text-[10px] px-2 py-1 rounded hover:bg-white/10 transition">Expand</a>
              <button onClick={() => setOpen(false)} className="text-white/40 hover:text-white/70 text-lg w-7 h-7 flex items-center justify-center rounded hover:bg-white/10 transition">×</button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <div className="text-center py-8">
                <p className="text-sm text-muted">Ask anything about your audit data</p>
                <div className="mt-4 space-y-1.5">
                  {["What are the key trends?", "Compare brand territories", "Which brands stand out?"].map(q => (
                    <button key={q} onClick={() => setInput(q)}
                      className="block w-full text-left text-xs text-accent bg-accent-soft px-3 py-2 rounded-lg hover:opacity-80 transition">{q}</button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] px-3 py-2 rounded-xl text-sm whitespace-pre-wrap ${
                  m.role === "user" ? "bg-accent text-white rounded-br-sm" : "bg-surface2 text-main rounded-bl-sm"
                }`}>{m.content}</div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-surface2 px-3 py-2 rounded-xl rounded-bl-sm flex gap-1">
                  <span className="w-1.5 h-1.5 bg-hint rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 bg-hint rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 bg-hint rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-main px-3 py-2.5 flex gap-2 flex-shrink-0">
            <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && sendMessage()}
              placeholder="Ask about your data..."
              className="flex-1 px-3 py-2 bg-surface2 border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[var(--accent)]" />
            <button onClick={sendMessage} disabled={loading || !input.trim()}
              className="px-3 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-40" style={{ background: "#0019FF" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </div>
        </div>
      )}

      {/* Bubble button */}
      <button onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 z-[9998] w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110 hover:shadow-xl"
        style={{ background: open ? "#1a1e2c" : "#0019FF" }} title="AI Chat">
        {open ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>
        )}
      </button>
    </>
  );
}
