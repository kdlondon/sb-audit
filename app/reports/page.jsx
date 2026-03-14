"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { OPTIONS } from "@/lib/options";
import AuthGuard from "@/components/AuthGuard";
import Nav from "@/components/Nav";

const REPORT_SECTIONS = [
  { id: "landscape", label: "Category landscape & perception", desc: "How business banking is entered and experienced, the retail lens problem, the differentiation void" },
  { id: "frameworks", label: "Audit findings mapped to frameworks", desc: "Local audit findings mapped against entry doors, portraits, and journey phases" },
  { id: "audiences", label: "Who are competitors talking to?", desc: "Implied audiences by portrait type, lifecycle stage, and business size" },
  { id: "experiences", label: "Which experiences are they responding to?", desc: "Pain points, moments, and emotional territories addressed" },
  { id: "moments", label: "Does anyone own a journey moment?", desc: "Acquisition, deepening, and unexpected moments in competitive comms" },
  { id: "whitespace", label: "Where is the white space?", desc: "Gaps no competitor is filling — by portrait, phase, moment, and emotional territory" },
];

function ReportsContent() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [competitors, setCompetitors] = useState([]);
  const [sections, setSections] = useState(REPORT_SECTIONS.map(s => s.id));
  const [customInstructions, setCustomInstructions] = useState("");
  const [report, setReport] = useState("");
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data: rows } = await supabase.from("audit_entries").select("*");
      setData(rows || []);
      setLoading(false);
    };
    load();
  }, []);

  const toggleComp = (c) => {
    setCompetitors(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  };

  const toggleSec = (id) => {
    setSections(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const generate = async () => {
    setGenerating(true);
    setReport("");

    const filtered = competitors.length > 0
      ? data.filter(e => competitors.includes(e.competitor))
      : data;

    const dataStr = filtered.map(e =>
      `[${e.competitor}] ${e.description || ""} | Type: ${e.type || ""} | Portrait: ${e.portrait || ""} | Phase: ${e.journey_phase || ""} | Role: ${e.bank_role || ""} | Tone: ${e.tone_of_voice || ""} | Language: ${e.language_register || ""} | Pain: ${e.pain_point_type || ""} | CTA: ${e.cta || ""} | Archetype: ${e.brand_archetype || ""} | Transcript: ${(e.transcript || "").slice(0, 100)}`
    ).join("\n");

    const sectionNames = sections.map(id => REPORT_SECTIONS.find(s => s.id === id)?.label).filter(Boolean).join(", ");

    const prompt = `You are a brand strategist analyzing competitive communications in Canadian business banking for Scotiabank.

Here is the audit data for ${filtered.length} communication pieces:
${dataStr}

Generate a strategic report covering these sections: ${sectionNames}

${customInstructions ? `Additional instructions: ${customInstructions}` : ""}

Format the report in Markdown with clear headers for each section. Be conclusive and strategic — lead with insights, support with evidence from the data. Use the language of brand strategy, not research summaries. Be specific about which competitors do what.`;

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4000,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const result = await response.json();
      const text = result.content?.map(c => c.text || "").join("") || "Error generating report.";
      setReport(text);
    } catch (err) {
      setReport("Error: " + err.message);
    }
    setGenerating(false);
  };

  const downloadMD = () => {
    const blob = new Blob([report], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "competitive_report.md";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (loading) return <div className="p-10 text-center text-gray-400">Loading data...</div>;

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <h2 className="text-lg font-bold">AI reports</h2>
        <p className="text-xs text-gray-500">Generate strategic analysis from your audit data</p>
      </div>

      <div className="p-6 max-w-4xl">
        <div className="bg-white rounded-lg border border-gray-200 p-5 mb-4">
          <h3 className="text-sm font-semibold mb-3">Competitors to include</h3>
          <div className="flex gap-2 flex-wrap">
            {OPTIONS.competitor.filter(c => c !== "Other").map(c => (
              <button key={c} onClick={() => toggleComp(c)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition ${
                  competitors.includes(c) || competitors.length === 0
                    ? "bg-blue-50 border-blue-200 text-blue-700"
                    : "bg-white border-gray-200 text-gray-400"
                }`}>{c}</button>
            ))}
          </div>
          <p className="text-[10px] text-gray-400 mt-2">{competitors.length === 0 ? "All competitors included" : `${competitors.length} selected`} — {data.filter(e => competitors.length === 0 || competitors.includes(e.competitor)).length} entries</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-5 mb-4">
          <h3 className="text-sm font-semibold mb-3">Report sections</h3>
          {REPORT_SECTIONS.map(s => (
            <label key={s.id} className="flex items-start gap-2 mb-2 cursor-pointer">
              <input type="checkbox" checked={sections.includes(s.id)} onChange={() => toggleSec(s.id)} className="mt-0.5" />
              <div>
                <div className="text-sm font-medium">{s.label}</div>
                <div className="text-xs text-gray-400">{s.desc}</div>
              </div>
            </label>
          ))}
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-5 mb-4">
          <h3 className="text-sm font-semibold mb-2">Custom instructions (optional)</h3>
          <textarea value={customInstructions} onChange={e => setCustomInstructions(e.target.value)}
            placeholder="E.g., Focus on how fintechs position against traditional banks, emphasize white space opportunities..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-y" rows={3} />
        </div>

        <button onClick={generate} disabled={generating || sections.length === 0}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 mb-6">
          {generating ? "Generating report..." : "Generate report"}
        </button>

        {report && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-semibold">Generated report</h3>
              <button onClick={downloadMD} className="px-3 py-1 text-xs border border-gray-300 rounded-lg hover:bg-gray-50">Download .md</button>
            </div>
            <div className="prose prose-sm max-w-none text-sm leading-relaxed whitespace-pre-wrap">{report}</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ReportsPage() {
  return <AuthGuard><Nav/><ReportsContent/></AuthGuard>;
}
