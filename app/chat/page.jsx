"use client";
import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase";
import AuthGuard from "@/components/AuthGuard";
import Nav from "@/components/Nav";

function ChatContent() {
  const [data, setData] = useState([]);
  const [messages, setMessages] = useState([{ role: "assistant", content: "Hi! I have access to your full competitive audit database. Ask me anything — which competitor dominates a portrait, who owns a journey moment, tone patterns, white space, whatever you need." }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data: rows } = await supabase.from("audit_entries").select("*");
      setData(rows || []);
      setDataLoaded(true);
    };
    load();
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);

    const dataStr = data.map(e =>
      `[${e.competitor}] ${e.description || ""} | Type:${e.type||""} | Portrait:${e.portrait||""} | Phase:${e.journey_phase||""} | Lifecycle:${e.client_lifecycle||""} | Role:${e.bank_role||""} | Tone:${e.tone_of_voice||""} | Lang:${e.language_register||""} | Pain:${e.pain_point_type||""} | CTA:${e.cta||""} | Archetype:${e.brand_archetype||""} | Channel:${e.channel||""} | Diff:${e.diff_claim||""} | Transcript:${(e.transcript||"").slice(0,80)}`
    ).join("\n");

    const history = messages.slice(-6).map(m => ({ role: m.role, content: m.content }));

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 2000,
          system: `You are a brand strategy analyst working on the Scotiabank Business Banking competitive audit. You have access to ${data.length} communication pieces from Canadian business banking competitors.

Here is the full dataset:
${dataStr}

Answer questions precisely using this data. Be strategic and conclusive. When citing patterns, reference specific competitors and counts. Keep answers focused and actionable.`,
          messages: [...history, { role: "user", content: userMsg }],
        }),
      });
      const result = await response.json();
      const text = result.content?.map(c => c.text || "").join("") || "Sorry, I couldn't process that.";
      setMessages(prev => [...prev, { role: "assistant", content: text }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: "assistant", content: "Error: " + err.message }]);
    }
    setLoading(false);
  };

  return (
    <div className="bg-gray-50 min-h-screen flex flex-col">
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <h2 className="text-lg font-bold">Chat with your data</h2>
        <p className="text-xs text-gray-500">{dataLoaded ? `${data.length} entries loaded` : "Loading..."}</p>
      </div>

      <div className="flex-1 overflow-auto px-6 py-4 max-w-3xl w-full mx-auto">
        {messages.map((m, i) => (
          <div key={i} className={`mb-4 ${m.role === "user" ? "text-right" : ""}`}>
            <div className={`inline-block max-w-[85%] px-4 py-2.5 rounded-xl text-sm leading-relaxed ${
              m.role === "user"
                ? "bg-blue-600 text-white rounded-br-sm"
                : "bg-white border border-gray-200 text-gray-800 rounded-bl-sm"
            }`}>
              <div className="whitespace-pre-wrap">{m.content}</div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="mb-4">
            <div className="inline-block bg-white border border-gray-200 px-4 py-2.5 rounded-xl rounded-bl-sm text-sm text-gray-400">
              Thinking...
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="border-t border-gray-200 bg-white px-6 py-3 max-w-3xl w-full mx-auto">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
            placeholder="Ask about your audit data..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
          />
          <button onClick={send} disabled={loading || !input.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
            Send
          </button>
        </div>
        <div className="flex gap-2 mt-2 flex-wrap">
          {["Which competitor talks to Builders?","What tone dominates across fintechs?","Does anyone own the first cash flow crisis moment?","Where is the white space?"].map(q => (
            <button key={q} onClick={() => { setInput(q); }} className="text-[11px] text-blue-600 bg-blue-50 px-2 py-1 rounded-full hover:bg-blue-100">{q}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ChatPage() {
  return <AuthGuard><Nav/><ChatContent/></AuthGuard>;
}
