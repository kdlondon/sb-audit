"use client";
import { useEffect, useState } from "react";
import { listFindings } from "@/lib/findings";

// Configure-panel card: pick which saved analyst findings to overlay onto the report.
// Renders nothing if the project has no findings. Calls onSelect with the chosen finding objects.
export default function FindingsConfig({ projectId, onSelect }) {
  const [findings, setFindings] = useState([]);
  const [ids, setIds] = useState([]);

  useEffect(() => { if (!projectId) return; (async () => setFindings(await listFindings(projectId)))(); }, [projectId]);

  const toggle = (id) => {
    const next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
    setIds(next);
    onSelect?.(findings.filter((f) => next.includes(f.id)));
  };

  if (!findings.length) return null;
  return (
    <div className="bg-surface rounded-lg border border-main p-4">
      <h3 className="text-sm font-semibold text-main mb-1">Analyst findings</h3>
      <p className="text-[10px] text-hint mb-2">Saved conclusions from Intelligence. Selected findings are woven into the relevant sections and the recommendations.</p>
      <div className="space-y-1.5">
        {findings.map((f) => (
          <label key={f.id} className={`flex items-start gap-2 rounded-lg border p-2.5 cursor-pointer transition ${ids.includes(f.id) ? "border-[var(--accent)] bg-accent-soft" : "border-main hover:border-[var(--accent)]"}`}>
            <input type="checkbox" checked={ids.includes(f.id)} onChange={() => toggle(f.id)} className="mt-0.5 accent-[var(--accent)]" />
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                {f.stat && <span className="text-sm font-bold shrink-0" style={{ color: "var(--accent)" }}>{f.stat}</span>}
                <span className="text-sm font-medium text-main">{f.title || "Finding"}</span>
              </div>
              {f.summary && <p className="text-[11px] text-hint line-clamp-2">{f.summary}</p>}
            </div>
          </label>
        ))}
      </div>
      <p className="text-[10px] text-hint mt-2">{ids.length === 0 ? "None selected" : `${ids.length} finding${ids.length > 1 ? "s" : ""} included`}</p>
    </div>
  );
}
