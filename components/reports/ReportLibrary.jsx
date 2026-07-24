"use client";
// Report v2 — Library (F1). Landing of the Report module.
// Row = status chip → title (+ comment bubble) → meta, with format icons (text / visual),
// a ⋯ menu and a chevron. Clicking the row or an icon expands an inline accordion with a
// Text/Visual toggle. Filters Active/Archived, sort recent/oldest/status.
import { useState, useMemo, useRef, useEffect } from "react";

const STATUS = {
  in_process: { label: "In process", style: { background: "var(--paper)", border: "1px solid var(--border-hairline)", color: "var(--text-muted)" } },
  in_review:  { label: "In review",  style: { background: "var(--accent-ember-tint)", border: "1px solid var(--accent-ember-tint)", color: "#7a3a24" } },
  delivered:  { label: "Delivered",  style: { background: "var(--ink-800)", border: "1px solid var(--ink-800)", color: "var(--brand-cream)" } },
  failed:     { label: "Generation failed", style: { background: "transparent", border: "1px solid var(--accent-ember)", color: "var(--accent-ember-deep)" } },
};
const chipBase = { display: "inline-block", padding: "3px 10px", borderRadius: 14, fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".06em", textTransform: "uppercase", fontWeight: 600 };

const SORTS = [["recent", "Most recent"], ["oldest", "Oldest"], ["status", "By status"]];
const STATUS_ORDER = { in_process: 0, in_review: 1, delivered: 2 };

const fmtMeta = (r) => {
  const d = r.created_at ? new Date(r.created_at) : null;
  const date = d ? d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";
  const time = d ? d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "";
  return [date, time, r.created_by].filter(Boolean).join(" · ");
};

const iconBtn = (on) => ({
  width: 34, height: 34, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
  background: on ? "var(--accent-ember-tint)" : "var(--brand-white)",
  border: `1px solid ${on ? "var(--accent-ember)" : "var(--border-hairline)"}`,
  color: on ? "var(--accent-ember-deep)" : "var(--text-secondary)",
});

const DocIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M15 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V7z" /><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M9 12h6M9 16h6" /></svg>;
const DeckIcon = ({ ghost }) => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeDasharray={ghost ? "3 2" : undefined}><rect x="2" y="4" width="20" height="13" rx="2" /><path d="M8 21h8M12 17v4" /></svg>;

export default function ReportLibrary({
  reports = [],
  commentCounts = {},
  onOpenText,
  onOpenVisual,
  onGenerateVisual,
  onAction,          // (id, action, value) → server
  onGenerate,        // → Generate view
  error = null,      // message from a failed action — shown, never swallowed
}) {
  const [filter, setFilter] = useState("active");
  const [sort, setSort] = useState("recent");
  const [sortOpen, setSortOpen] = useState(false);
  const [openRow, setOpenRow] = useState(null);
  const [openFmt, setOpenFmt] = useState("text");
  const [menuFor, setMenuFor] = useState(null);
  const [renaming, setRenaming] = useState(null);
  const [renameVal, setRenameVal] = useState("");
  const [deleting, setDeleting] = useState(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    const away = (e) => { if (!wrapRef.current?.contains(e.target)) { setMenuFor(null); setSortOpen(false); } };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, []);

  const counts = useMemo(() => ({
    active: reports.filter((r) => !r.archived && !r.deleted_at).length,
    archived: reports.filter((r) => r.archived && !r.deleted_at).length,
  }), [reports]);

  const rows = useMemo(() => {
    const list = reports.filter((r) => !r.deleted_at && (filter === "archived" ? r.archived : !r.archived));
    const t = (r) => new Date(r.created_at || 0).getTime();
    if (sort === "oldest") return [...list].sort((a, b) => t(a) - t(b));
    if (sort === "status") return [...list].sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9) || t(b) - t(a));
    return [...list].sort((a, b) => t(b) - t(a));
  }, [reports, filter, sort]);

  const act = async (id, action, value) => { setMenuFor(null); await onAction?.(id, action, value); };

  return (
    <div ref={wrapRef}>
      {error && (
        <div style={{ marginBottom: 14, padding: "10px 14px", borderRadius: 10, background: "var(--accent-ember-tint)", color: "#7a3a24", fontFamily: "var(--font-body)", fontSize: 12.5 }}>{error}</div>
      )}

      {/* Filter + sort */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <div style={{ display: "inline-flex", gap: 2, background: "var(--brand-white)", border: "1px solid var(--border-hairline)", borderRadius: 10, padding: 3 }}>
          {[["active", "Active", counts.active], ["archived", "Archived", counts.archived]].map(([k, l, n]) => {
            const on = filter === k;
            return (
              <button key={k} onClick={() => { setFilter(k); setOpenRow(null); }}
                style={{ padding: "6px 13px", borderRadius: 8, border: "none", cursor: "pointer", background: on ? "var(--ink-800)" : "transparent", color: on ? "var(--brand-cream)" : "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: on ? 600 : 500 }}>
                {l} ({n})
              </button>
            );
          })}
        </div>
        <div style={{ position: "relative" }}>
          <button onClick={() => setSortOpen((v) => !v)} className="gw-tbtn"
            style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "var(--brand-white)", border: "1px solid var(--border-hairline)", borderRadius: 8, padding: "7px 12px", cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-secondary)" }}>
            {SORTS.find(([k]) => k === sort)[1]}
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M2 4l3 3 3-3" /></svg>
          </button>
          {sortOpen && (
            <div style={{ position: "absolute", right: 0, top: "100%", marginTop: 6, zIndex: 40, minWidth: 168, background: "var(--brand-white)", border: "1px solid var(--border-hairline)", borderRadius: 12, boxShadow: "var(--shadow-card-hover)", padding: 5 }}>
              {SORTS.map(([k, l]) => (
                <button key={k} onClick={() => { setSort(k); setSortOpen(false); }}
                  style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "8px 10px", borderRadius: 7, border: "none", background: "transparent", cursor: "pointer", fontFamily: "var(--font-body)", fontSize: 13, color: sort === k ? "var(--accent-ember-deep)" : "var(--ink-800)", textAlign: "left" }}>
                  {l}{sort === k && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {rows.map((r) => {
          const st = STATUS[r.status] || STATUS.in_process;
          const open = openRow === r.id;
          const hasVisual = !!r.has_presentation;
          const cc = commentCounts[r.id] || 0;
          return (
            <div key={r.id} className="gw-card" style={{
              background: "var(--brand-white)", border: "1px solid var(--border-hairline)", borderRadius: 12,
              // No overflow:hidden — it clipped the ⋯ popover. The accordion has no bleeding
              // background of its own, so the rounded corners hold without it.
              // Raise this row while its menu is open so later rows can't paint over it.
              position: "relative", zIndex: menuFor === r.id ? 30 : undefined,
            }}>
              <div onClick={() => { setOpenRow(open ? null : r.id); setOpenFmt("text"); }}
                style={{ display: "flex", alignItems: "center", gap: 18, padding: "16px 18px", cursor: "pointer" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ ...chipBase, ...st.style }}>{st.label}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 8 }}>
                    <span style={{ fontFamily: "var(--font-body)", fontSize: 16, fontWeight: 600, color: "var(--ink-900)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.title || "Untitled report"}</span>
                    {cc > 0 && (
                      <span title="Comments" style={{ display: "inline-flex", alignItems: "center", gap: 4, flex: "none", padding: "3px 9px", borderRadius: 14, background: "var(--accent-ember-tint)", color: "#7a3a24", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600 }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>{cc}
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".06em", color: "var(--text-muted)", marginTop: 8 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>{fmtMeta(r)}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 6, flex: "none" }}>
                  <button title="Text report" style={iconBtn(open && openFmt === "text")}
                    onClick={(e) => { e.stopPropagation(); setOpenRow(r.id); setOpenFmt("text"); }}><DocIcon /></button>
                  <button title={hasVisual ? "Visual presentation" : "No visual presentation yet"}
                    style={{ ...iconBtn(open && openFmt === "visual"), opacity: hasVisual ? 1 : 0.55 }}
                    onClick={(e) => { e.stopPropagation(); setOpenRow(r.id); setOpenFmt("visual"); }}><DeckIcon ghost={!hasVisual} /></button>
                </div>

                <div style={{ position: "relative", flex: "none" }}>
                  <button onClick={(e) => { e.stopPropagation(); setMenuFor(menuFor === r.id ? null : r.id); }}
                    style={{ width: 34, height: 34, borderRadius: 8, background: "var(--brand-white)", border: "1px solid var(--border-hairline)", color: "var(--text-secondary)", cursor: "pointer" }}>⋯</button>
                  {menuFor === r.id && (
                    <div onClick={(e) => e.stopPropagation()}
                      style={{ position: "absolute", right: 0, top: "100%", marginTop: 6, zIndex: 40, minWidth: 172, background: "var(--brand-white)", border: "1px solid var(--border-hairline)", borderRadius: 12, boxShadow: "var(--shadow-card-hover)", padding: 5 }}>
                      {[
                        ["Rename", () => { setMenuFor(null); setRenaming(r); setRenameVal(r.title || ""); }],
                        [r.archived ? "Restore" : "Archive", () => act(r.id, r.archived ? "restore" : "archive")],
                      ].map(([l, fn]) => (
                        <button key={l} onClick={fn} style={{ width: "100%", textAlign: "left", padding: "8px 10px", borderRadius: 7, border: "none", background: "transparent", cursor: "pointer", fontFamily: "var(--font-body)", fontSize: 13, color: "var(--ink-800)" }}>{l}</button>
                      ))}
                      <div style={{ height: 1, background: "var(--border-hairline)", margin: "4px 6px" }} />
                      <button onClick={() => { setMenuFor(null); setDeleting(r); }}
                        style={{ width: "100%", textAlign: "left", padding: "8px 10px", borderRadius: 7, border: "none", background: "transparent", cursor: "pointer", fontFamily: "var(--font-body)", fontSize: 13, color: "var(--accent-ember-deep)" }}>Delete</button>
                    </div>
                  )}
                </div>

                <svg width="12" height="12" viewBox="0 0 10 10" fill="none" stroke="var(--text-muted)" strokeWidth="1.7"
                  style={{ flex: "none", transform: open ? "rotate(180deg)" : "none", transition: "transform .15s ease" }}><path d="M2 4l3 3 3-3" /></svg>
              </div>

              {/* Inline accordion */}
              {open && (
                <div style={{ padding: "0 18px 18px", borderTop: "1px solid var(--paper-edge)", animation: "gwrise .22s ease" }}>
                  <div style={{ display: "inline-flex", gap: 2, background: "var(--paper)", borderRadius: 9, padding: 3, margin: "14px 0" }}>
                    {[["text", "Text"], ["visual", "Visual"]].map(([k, l]) => {
                      const on = openFmt === k;
                      return (
                        <button key={k} onClick={() => setOpenFmt(k)}
                          style={{ padding: "6px 14px", borderRadius: 7, border: "none", cursor: "pointer", background: on ? "var(--ink-800)" : "transparent", color: on ? "var(--brand-cream)" : "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: on ? 600 : 500 }}>{l}</button>
                      );
                    })}
                  </div>

                  {openFmt === "text" ? (
                    <div>
                      <p style={{ fontFamily: "var(--font-body)", fontSize: 13.5, lineHeight: 1.6, color: "var(--text-secondary)", margin: "0 0 14px", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {r.preview || "Open the document to read the full report."}
                      </p>
                      <button onClick={() => onOpenText?.(r)} className="gw-ember-btn"
                        style={{ background: "var(--accent-ember)", color: "#fff", border: "none", borderRadius: 9, padding: "10px 18px", cursor: "pointer", fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 700 }}>Open document →</button>
                    </div>
                  ) : hasVisual ? (
                    <div>
                      <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)", margin: "0 0 14px" }}>{r.slide_count || 0} slides</p>
                      <button onClick={() => onOpenVisual?.(r)} className="gw-ember-btn"
                        style={{ background: "var(--accent-ember)", color: "#fff", border: "none", borderRadius: 9, padding: "10px 18px", cursor: "pointer", fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 700 }}>Open presentation →</button>
                    </div>
                  ) : (
                    <div style={{ border: "1px dashed var(--border-strong)", borderRadius: 12, padding: "22px 18px", textAlign: "center" }}>
                      <p style={{ fontFamily: "var(--font-body)", fontStyle: "italic", fontSize: 13.5, color: "var(--text-muted)", margin: "0 0 14px" }}>No visual presentation for this report yet.</p>
                      <button onClick={() => onGenerateVisual?.(r)} className="gw-ember-btn"
                        style={{ background: "var(--accent-ember)", color: "#fff", border: "none", borderRadius: 9, padding: "10px 18px", cursor: "pointer", fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 700 }}>Generate visual presentation →</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {rows.length === 0 && (
          <div style={{ textAlign: "center", padding: "48px 0", fontFamily: "var(--font-body)", fontStyle: "italic", color: "var(--text-muted)" }}>
            {filter === "archived" ? "No archived reports yet." : "No reports yet — generate your first one."}
          </div>
        )}
        {rows.length === 0 && filter === "active" && (
          <div style={{ textAlign: "center" }}>
            <button onClick={onGenerate} className="gw-ember-btn"
              style={{ background: "var(--accent-ember)", color: "#fff", border: "none", borderRadius: 9, padding: "11px 20px", cursor: "pointer", fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 700 }}>Generate report</button>
          </div>
        )}
      </div>

      {/* Rename modal */}
      {renaming && (
        <Modal onClose={() => setRenaming(null)} title="Rename report">
          <input autoFocus value={renameVal} onChange={(e) => setRenameVal(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && renameVal.trim()) { act(renaming.id, "rename", renameVal.trim()); setRenaming(null); } }}
            className="gw-finput" style={{ width: "100%" }} />
          <ModalActions
            onCancel={() => setRenaming(null)}
            confirmLabel="Rename"
            disabled={!renameVal.trim()}
            onConfirm={() => { act(renaming.id, "rename", renameVal.trim()); setRenaming(null); }} />
        </Modal>
      )}

      {/* Delete modal — soft delete */}
      {deleting && (
        <Modal onClose={() => setDeleting(null)} title="Delete report">
          <p style={{ fontFamily: "var(--font-body)", fontSize: 13.5, lineHeight: 1.6, color: "var(--text-secondary)", margin: 0 }}>
            <b>{deleting.title || "This report"}</b> will be removed from the library. Its presentation and comments are kept and can be restored for 30 days.
          </p>
          <ModalActions onCancel={() => setDeleting(null)} confirmLabel="Delete" danger
            onConfirm={() => { act(deleting.id, "delete"); setDeleting(null); }} />
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 90, background: "rgba(26,26,26,.38)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 420, background: "var(--brand-white)", border: "1px solid var(--border-hairline)", borderRadius: 16, padding: "22px 24px", boxShadow: "0 16px 44px rgba(0,0,0,.2)", animation: "gwrise .18s ease" }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700, color: "var(--ink-900)", marginBottom: 14 }}>{title}</div>
        {children}
      </div>
    </div>
  );
}

function ModalActions({ onCancel, onConfirm, confirmLabel, danger, disabled }) {
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
      <button onClick={onCancel} style={{ background: "var(--brand-white)", border: "1px solid var(--border-hairline)", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-secondary)" }}>Cancel</button>
      <button onClick={onConfirm} disabled={disabled} className="gw-ember-btn"
        style={{ background: danger ? "var(--accent-ember-deep)" : "var(--accent-ember)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", cursor: "pointer", fontFamily: "var(--font-body)", fontSize: 12, fontWeight: 600, opacity: disabled ? 0.45 : 1 }}>{confirmLabel}</button>
    </div>
  );
}
