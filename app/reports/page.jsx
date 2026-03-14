"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { STATIC_OPTIONS, fetchOptions } from "@/lib/options";
import AuthGuard from "@/components/AuthGuard";
import Nav from "@/components/Nav";
import Markdown from "react-markdown";

const LOCAL_SECTIONS = [
  { id: "landscape", label: "Category landscape & perception", desc: "How business banking is entered and experienced, the retail lens problem, the differentiation void" },
  { id: "frameworks", label: "Audit findings mapped to frameworks", desc: "Findings mapped against entry doors, portraits, and journey phases" },
  { id: "audiences", label: "Who are competitors talking to?", desc: "Implied audiences by portrait type, lifecycle stage, and business size" },
  { id: "experiences", label: "Which experiences are they responding to?", desc: "Pain points, moments, and emotional territories addressed" },
  { id: "moments", label: "Does anyone own a journey moment?", desc: "Acquisition, deepening, and unexpected moments in competitive comms" },
  { id: "whitespace", label: "Where is the white space?", desc: "Gaps no competitor is filling — by portrait, phase, moment, and emotional territory" },
];

const GLOBAL_SECTIONS = [
  { id: "territories", label: "Creative territories & themes", desc: "Primary and secondary territories across global benchmarks" },
  { id: "execution", label: "Execution styles & patterns", desc: "How global brands execute their positioning" },
  { id: "archetypes", label: "Brand archetypes & roles", desc: "Which archetypes dominate and what roles brands play" },
  { id: "insights", label: "Insights & ideas mapping", desc: "Human truths and creative concepts" },
  { id: "inspiration", label: "Transferable inspiration", desc: "What Scotiabank could learn from global examples" },
];

function ReportsContent() {
  const [scope, setScope] = useState("local");
  const [localData, setLocalData] = useState([]);
  const [globalData, setGlobalData] = useState([]);
  const [OPTIONS, setOPTIONS] = useState(STATIC_OPTIONS);
  const [loading, setLoading] = useState(true);
  const [competitors, setCompetitors] = useState([]);
  const [sections, setSections] = useState(LOCAL_SECTIONS.map(s => s.id));
  const [customInstructions, setCustomInstructions] = useState("");
  const [report, setReport] = useState("");
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const [{ data: local }, { data: global }] = await Promise.all([
        supabase.from("audit_entries").select("*"),
        supabase.from("audit_global").select("*"),
      ]);
      setLocalData(local || []);
      setGlobalData(global || []);
      const opts = await fetchOptions();
      setOPTIONS(opts);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    setSections(scope === "global" ? GLOBAL_SECTIONS.map(s => s.id) : LOCAL_SECTIONS.map(s => s.id));
    setCompetitors([]);
    setReport("");
  }, [scope]);

  const currentSections = scope === "global" ? GLOBAL_SECTIONS : LOCAL_SECTIONS;
  const currentData = scope === "local" ? localData : scope === "global" ? globalData : [...localData, ...globalData];
  const filteredData = competitors.length > 0 ? currentData.filter(e => competitors.includes(e.competitor || e.brand)) : currentData;

  const availableBrands = scope === "local"
    ? [...new Set(localData.map(e => e.competitor).filter(Boolean))]
    : [...new Set(globalData.map(e => e.brand).filter(Boolean))];

  const toggleComp = (c) => setCompetitors(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  const toggleSec = (id) => setSections(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const copyReport = () => { navigator.clipboard.writeText(report); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  const downloadMD = () => { const blob = new Blob([report], { type: "text/markdown" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `report_${scope}.md`; document.body.appendChild(a); a.click(); document.body.removeChild(a); };

  const generate = async () => {
    setGenerating(true);
    setReport("");
    const dataStr = filteredData.map(e =>
      `[${e.competitor || e.brand}] ${e.description || ""} | Type:${e.type || ""} | Portrait:${e.portrait || ""} | Phase:${e.journey_phase || ""} | Role:${e.bank_role || ""} | Tone:${e.tone_of_voice || ""} | Lang:${e.language_register || ""} | Pain:${e.pain_point_type || ""} | CTA:${e.cta || ""} | Archetype:${e.brand_archetype || ""} | Territory:${e.primary_territory || ""} | Execution:${e.execution_style || ""} | Insight:${(e.insight || "").slice(0, 100)} | Synopsis:${(e.synopsis || "").slice(0, 100)} | Transcript:${(e.transcript || "").slice(0, 100)}`
    ).join("\n");
    const sectionNames = sections.map(id => currentSections.find(s => s.id === id)?.label).filter(Boolean).join(", ");
    const scopeContext = scope === "local" ? "analyzing Canadian business banking competitive communications for Scotiabank" : scope === "global" ? "analyzing global creative benchmarks for Scotiabank business banking positioning" : "analyzing both local and global data for Scotiabank business banking";

    try {
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          use_opus: true,
          max_tokens: 6000,
          system: `You are a world-class brand strategist ${scopeContext}. Write with authority and precision. Every claim must reference specific brands and data points from the audit. Structure your report with clear markdown: use ## for main sections, ### for subsections, **bold** for key findings, and bullet points for supporting evidence. Be conclusive — state what the data means, not just what it shows. Challenge assumptions where the data supports it.`,
          messages: [{ role: "user", content: `Audit data (${filteredData.length} pieces):\n${dataStr}\n\nGenerate a strategic report covering: ${sectionNames}\n\n${customInstructions ? `Additional instructions: ${customInstructions}` : ""}\n\nUse proper markdown formatting with headers, subheaders, bold emphasis, and structured lists.` }],
        }),
      });
      const result = await response.json();
      if (result.error) setReport("Error: " + result.error);
      else setReport(result.content?.map(c => c.text || "").join("") || "No content generated.");
    } catch (err) { setReport("Error: " + err.message); }
    setGenerating(false);
  };

  if (loading) return <div className="p-10 text-center text-hint">Loading...</div>;

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <div className="bg-surface border-b border-main px-5 py-3">
        <h2 className="text-lg font-bold text-main">AI reports</h2>
        <p className="text-xs text-muted">Powered by Claude Opus — strategic analysis from your audit data</p>
      </div>
      <div className="p-5 max-w-4xl">
        <div className="bg-surface rounded-lg border border-main p-4 mb-3">
          <h3 className="text-sm font-semibold text-main mb-2">Report scope</h3>
          <div className="flex gap-2">
            {[["local","Local (Canadian market)"],["global","Global (creative benchmarks)"],["combined","Combined"]].map(([k,l]) => (
              <button key={k} onClick={() => setScope(k)} className={`px-4 py-1.5 rounded-lg text-xs font-medium border transition ${scope === k ? "bg-accent-soft border-[var(--accent)] text-accent" : "bg-surface border-main text-muted"}`}>{l}</button>
            ))}
          </div>
        </div>
        <div className="bg-surface rounded-lg border border-main p-4 mb-3">
          <h3 className="text-sm font-semibold text-main mb-2">Brands to include</h3>
          <div className="flex gap-2 flex-wrap">
            {availableBrands.map(c => (
              <button key={c} onClick={() => toggleComp(c)} className={`px-3 py-1 rounded-full text-xs font-medium border transition ${competitors.includes(c) || competitors.length === 0 ? "bg-accent-soft border-[var(--accent)] text-accent" : "bg-surface border-main text-hint"}`}>{c}</button>
            ))}
          </div>
          <p className="text-[10px] text-hint mt-1">{competitors.length === 0 ? "All included" : `${competitors.length} selected`} — {filteredData.length} entries</p>
        </div>
        <div className="bg-surface rounded-lg border border-main p-4 mb-3">
          <h3 className="text-sm font-semibold text-main mb-2">Report sections</h3>
          {currentSections.map(s => (
            <label key={s.id} className="flex items-start gap-2 mb-2 cursor-pointer">
              <input type="checkbox" checked={sections.includes(s.id)} onChange={() => toggleSec(s.id)} className="mt-0.5" />
              <div><div className="text-sm font-medium text-main">{s.label}</div><div className="text-xs text-hint">{s.desc}</div></div>
            </label>
          ))}
        </div>
        <div className="bg-surface rounded-lg border border-main p-4 mb-3">
          <h3 className="text-sm font-semibold text-main mb-2">Custom instructions (optional)</h3>
          <textarea value={customInstructions} onChange={e => setCustomInstructions(e.target.value)}
            placeholder="E.g., Focus on fintechs vs traditional banks, emphasize white space..."
            className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main resize-y" rows={3} />
        </div>
        <button onClick={generate} disabled={generating || sections.length === 0}
          className="bg-accent text-white px-6 py-2 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 mb-5">
          {generating ? "Generating with Opus..." : "Generate report"}
        </button>

        {report && (
          <div className="bg-surface rounded-lg border border-main overflow-hidden">
            <div className="flex justify-between items-center px-5 py-3 border-b border-main">
              <h3 className="text-sm font-semibold text-main">Generated report</h3>
              <div className="flex gap-2">
                <button onClick={copyReport} className="px-3 py-1 text-xs border border-main rounded-lg text-muted hover:bg-surface2">{copied ? "Copied!" : "Copy"}</button>
                <button onClick={downloadMD} className="px-3 py-1 text-xs border border-main rounded-lg text-muted hover:bg-surface2">Download .md</button>
              </div>
            </div>
            <div className="px-8 py-6">
              <article className="prose prose-sm md:prose-base max-w-none dark:prose-invert prose-headings:text-[var(--text)] prose-p:text-[var(--text2)] prose-strong:text-[var(--text)] prose-li:text-[var(--text2)] prose-h2:border-b prose-h2:border-[var(--border)] prose-h2:pb-2 prose-h2:mt-8 prose-h3:mt-6">
                <Markdown>{report}</Markdown>
              </article>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const [scope, setScope] = useState("local");
  return <AuthGuard><Nav scope={scope} onScopeChange={setScope} /><ReportsContent /></AuthGuard>;
}
