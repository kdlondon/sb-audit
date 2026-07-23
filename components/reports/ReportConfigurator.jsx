"use client";
// Report v2 — Generate step 2 (F2). The configurator is a TEMPLATE each report fills
// differently: the Sections card renders from the chosen report's card in REPORT_CARDS,
// so a section-extract offers its core section + optional exec/recs, while the flagship
// offers all six. Adding a report = adding a card, not touching this screen.
//
// Weighting is gone (tied to the report family). Brands are gone (now in Source).
import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase";
import { countSource } from "@/lib/report-source";

const LENSES = [["brand", "Brand lens"], ["agency", "Agency lens"], ["vc", "VC lens"]];
const AUDITS = [["local", "Local"], ["global", "Global"], ["both", "Both"]];

const LABEL = { display: "block", fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8 };
const CARD = { background: "var(--brand-white)", border: "1px solid var(--border-hairline)", borderRadius: 14, padding: "18px 20px" };
const chip = (on) => ({
  fontFamily: "var(--font-mono)", fontWeight: 500, fontSize: 10.5,
  color: on ? "#fff" : "var(--text-secondary)",
  background: on ? "var(--ink-800)" : "var(--brand-white)",
  border: `1px solid ${on ? "var(--ink-800)" : "var(--border-strong)"}`,
  borderRadius: 16, padding: "5px 12px", cursor: "pointer", whiteSpace: "nowrap",
});

export default function ReportConfigurator({
  card, projectId, brands = [], intents = [], collections = [], onBack, onGenerate, generating,
}) {
  const [lens, setLens] = useState("brand");
  const [srcMode, setSrcMode] = useState("audit");
  const [srcBrands, setSrcBrands] = useState([]);
  const [srcAudit, setSrcAudit] = useState("both");
  const [srcCollection, setSrcCollection] = useState("");
  const [yearFrom, setYearFrom] = useState("");
  const [yearTo, setYearTo] = useState("");
  const [pickedIntents, setPickedIntents] = useState([]);
  const [count, setCount] = useState(null);

  // Sections state is seeded FROM THE CARD — this is what makes the configurator per-report.
  const [sections, setSections] = useState(() =>
    (card?.sections || []).map((s) => ({ ...s, on: s.optional ? s.defaultOn !== false : true, prompt: "" }))
  );
  useEffect(() => {
    setSections((card?.sections || []).map((s) => ({ ...s, on: s.optional ? s.defaultOn !== false : true, prompt: "" })));
  }, [card?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const selection = useMemo(() => ({
    mode: srcMode,
    value: srcMode === "brand" ? srcBrands : srcMode === "audit" ? srcAudit : srcCollection,
  }), [srcMode, srcBrands, srcAudit, srcCollection]);

  // Live "N cases resolved" — the only signal that the report will have material.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!projectId) return;
      if (srcMode === "collection" && !srcCollection) { setCount(0); return; }
      setCount(null);
      try {
        const n = await countSource(createClient(), projectId, selection);
        if (!cancelled) setCount(n);
      } catch { if (!cancelled) setCount(null); }
    })();
    return () => { cancelled = true; };
  }, [projectId, selection, srcMode, srcCollection]);

  const move = (i, d) => setSections((prev) => {
    const j = i + d;
    if (j < 0 || j >= prev.length) return prev;
    const n = [...prev]; [n[i], n[j]] = [n[j], n[i]]; return n;
  });

  const submit = () => onGenerate?.({
    lens, source: selection, yearFrom, yearTo, intents: pickedIntents,
    sections: sections.map((s) => ({ key: s.key, on: s.on, prompt: s.prompt })),
  });

  if (!card) return null;

  return (
    <div style={{ animation: "gwrise .25s ease" }}>
      {/* Back + title */}
      <button onClick={onBack} style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)" }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M11 18l-6-6 6-6" /></svg>
        Generate
      </button>
      <h2 style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 700, color: "var(--ink-900)", margin: "12px 0 0" }}>{card.title}</h2>
      <p style={{ fontFamily: "var(--font-body)", fontStyle: "italic", fontSize: 14, color: "var(--text-secondary)", margin: "8px 0 0", maxWidth: 760 }}>{card.description}</p>

      {/* Lens + ACTION */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap", margin: "22px 0 18px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ ...LABEL, margin: 0 }}>Lens</span>
          {LENSES.map(([k, l]) => <button key={k} onClick={() => setLens(k)} style={chip(lens === k)}>{l}</button>)}
        </div>
        <button onClick={submit} disabled={generating || count === 0} className="gw-ember-btn"
          style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--accent-ember)", color: "#fff", border: "none", borderRadius: 10, padding: "12px 22px", cursor: "pointer", fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 700, opacity: generating || count === 0 ? 0.45 : 1 }}>
          {generating ? "Generating…" : "Generate report"}
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h13M13 6l6 6-6 6" /></svg>
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {/* SOURCE */}
        <div style={CARD}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <span style={LABEL}>Source</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: count === 0 ? "var(--accent-ember-deep)" : "var(--text-muted)" }}>
              {count === null ? "resolving…" : `${count} case${count === 1 ? "" : "s"} resolved`}
            </span>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
            {[["brand", "By brand"], ["audit", "By audit"], ["collection", "By collection"]].map(([k, l]) => (
              <button key={k} onClick={() => setSrcMode(k)} style={chip(srcMode === k)}>{l}</button>
            ))}
          </div>

          {srcMode === "brand" && (
            brands.length ? (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {brands.map((b) => {
                  const on = srcBrands.includes(b);
                  return <button key={b} onClick={() => setSrcBrands((p) => on ? p.filter((x) => x !== b) : [...p, b])} style={chip(on)}>{b}</button>;
                })}
                {srcBrands.length > 0 && <button onClick={() => setSrcBrands([])} style={{ ...chip(false), border: "none", color: "var(--accent-ember-deep)" }}>Clear</button>}
              </div>
            ) : <Empty text="No brands in this project yet." />
          )}

          {srcMode === "audit" && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {AUDITS.map(([k, l]) => <button key={k} onClick={() => setSrcAudit(k)} style={chip(srcAudit === k)}>{l}</button>)}
            </div>
          )}

          {srcMode === "collection" && (
            collections.length ? (
              <select value={srcCollection} onChange={(e) => setSrcCollection(e.target.value)} className="gw-finput" style={{ maxWidth: 340 }}>
                <option value="">— Select a collection —</option>
                {collections.map((c) => <option key={c.id} value={c.id}>{c.name || c.title || "Untitled"}</option>)}
              </select>
            ) : <Empty text="No collections in Creative Source yet." />
          )}
        </div>

        {/* TIME FRAME */}
        <div style={CARD}>
          <span style={LABEL}>Time frame</span>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <input value={yearFrom} onChange={(e) => setYearFrom(e.target.value)} placeholder="From (year)" className="gw-finput" style={{ width: 150 }} />
            <span style={{ color: "var(--text-muted)" }}>→</span>
            <input value={yearTo} onChange={(e) => setYearTo(e.target.value)} placeholder="To (year)" className="gw-finput" style={{ width: 150 }} />
          </div>
        </div>

        {/* COMMUNICATION INTENTS */}
        {intents.length > 0 && (
          <div style={CARD}>
            <span style={LABEL}>Communication intents</span>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {intents.map((it) => {
                const on = pickedIntents.includes(it);
                return <button key={it} onClick={() => setPickedIntents((p) => on ? p.filter((x) => x !== it) : [...p, it])} style={chip(on)}>{it}</button>;
              })}
              {pickedIntents.length > 0 && <button onClick={() => setPickedIntents([])} style={{ ...chip(false), border: "none", color: "var(--accent-ember-deep)" }}>All</button>}
            </div>
          </div>
        )}

        {/* SECTIONS — rendered from the report's own card */}
        <div style={CARD}>
          <span style={LABEL}>Sections</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {sections.map((s, i) => (
              <div key={s.key} style={{ border: "1px solid var(--border-hairline)", borderRadius: 10, padding: "12px 14px", background: s.on ? "var(--brand-white)" : "var(--paper)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button
                    onClick={() => s.required ? null : setSections((p) => p.map((x, j) => j === i ? { ...x, on: !x.on } : x))}
                    title={s.required ? "This section is the report" : (s.on ? "Exclude" : "Include")}
                    style={{ flex: "none", width: 18, height: 18, borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center", cursor: s.required ? "default" : "pointer", background: s.on ? "var(--accent-ember)" : "transparent", border: `1px solid ${s.on ? "var(--accent-ember)" : "var(--border-strong)"}`, opacity: s.required ? 0.6 : 1 }}>
                    {s.on && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>}
                  </button>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)", flex: "none" }}>{String(i + 1).padStart(2, "0")}</span>
                  <span style={{ flex: 1, minWidth: 0, fontFamily: "var(--font-body)", fontSize: 14, fontWeight: 600, color: "var(--ink-900)" }}>{s.title}</span>
                  <div style={{ display: "flex", gap: 3, flex: "none" }}>
                    <Arrow dir="up" onClick={() => move(i, -1)} disabled={i === 0} />
                    <Arrow dir="down" onClick={() => move(i, 1)} disabled={i === sections.length - 1} />
                  </div>
                </div>
                {s.desc && <p style={{ fontFamily: "var(--font-body)", fontSize: 12.5, color: "var(--text-secondary)", margin: "8px 0 0 28px", lineHeight: 1.5 }}>{s.desc}</p>}
                {s.on && (
                  <input value={s.prompt} onChange={(e) => setSections((p) => p.map((x, j) => j === i ? { ...x, prompt: e.target.value } : x))}
                    placeholder="Direction for this section (optional)…" className="gw-finput" style={{ marginTop: 10, marginLeft: 28, width: "calc(100% - 28px)" }} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const Empty = ({ text }) => (
  <div style={{ border: "1px dashed var(--border-strong)", borderRadius: 10, padding: "16px", textAlign: "center", fontFamily: "var(--font-body)", fontStyle: "italic", fontSize: 13, color: "var(--text-muted)" }}>{text}</div>
);

const Arrow = ({ dir, onClick, disabled }) => (
  <button onClick={onClick} disabled={disabled} title={dir === "up" ? "Move up" : "Move down"}
    style={{ width: 24, height: 24, borderRadius: 6, background: "transparent", border: "1px solid var(--border-hairline)", cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.3 : 1, color: "var(--text-secondary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.7" style={{ transform: dir === "up" ? "rotate(180deg)" : "none" }}><path d="M2 4l3 3 3-3" /></svg>
  </button>
);
