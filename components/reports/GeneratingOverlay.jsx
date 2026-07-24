"use client";
// Report v2 — Generating (F3). Real per-section progress, because generation IS
// per-section: one request each, saved as it goes. Never a fake bar.
//
// Mid-run failure is a first-class state: the orchestrator keeps every section that
// landed, so the analyst is offered the partial report rather than losing the work.

const Spinner = () => (
  <span style={{ width: 44, height: 44, borderRadius: "50%", border: "3px solid var(--ink-150)", borderTopColor: "var(--accent-ember)", animation: "gwspin .8s linear infinite", display: "block" }} />
);

const Check = () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>;
const Bang = () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><path d="M12 7v6M12 17h.01" /></svg>;

export default function GeneratingOverlay({ sections = [], statuses = {}, errors = {}, saveError = null, done = 0, total = 0, failed = [], finished = false, onOpenPartial, onRetry, onRetrySave, onDismiss }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const someFailed = failed.length > 0 || !!saveError;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(244,239,233,.86)", backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 440, background: "var(--brand-white)", border: "1px solid var(--border-hairline)", borderRadius: 18, padding: "30px 32px", boxShadow: "0 16px 44px rgba(0,0,0,.18)", animation: "gwrise .2s ease" }}>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 12 }}>
          {finished ? (
            <span style={{ width: 44, height: 44, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: someFailed ? "var(--accent-ember-tint)" : "var(--accent-ember)" }}>
              {someFailed ? <span style={{ color: "var(--accent-ember-deep)", fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 700 }}>!</span> : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>}
            </span>
          ) : <Spinner />}

          <div style={{ fontFamily: "var(--font-display)", fontSize: 19, fontWeight: 700, color: "var(--ink-900)" }}>
            {finished ? (someFailed ? "Finished with gaps" : "Report ready") : "Generating report…"}
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: ".06em", color: "var(--text-muted)" }}>
            {finished
              ? (saveError ? `${done} of ${total} written — but NOT saved` : someFailed ? `${done} of ${total} sections written · the rest can be regenerated` : `${total} sections · saved`)
              : `${done} of ${total} sections · saved as it goes`}
          </div>
          {finished && saveError && (
            <div style={{ width: "100%", marginTop: 4, padding: "10px 12px", borderRadius: 9, background: "var(--accent-ember-tint)", color: "#7a3a24", fontFamily: "var(--font-body)", fontSize: 12.5, lineHeight: 1.5, textAlign: "left" }}>
              {saveError}
            </div>
          )}

          <div style={{ width: "100%", height: 6, borderRadius: 3, background: "var(--ink-150)", overflow: "hidden", marginTop: 4 }}>
            <div style={{ height: "100%", width: `${pct}%`, background: "var(--accent-ember)", borderRadius: 3, transition: "width .3s ease" }} />
          </div>
        </div>

        {/* Section checklist */}
        <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 22 }}>
          {sections.map((s) => {
            const st = statuses[s.key] || "pending";
            const isDone = st === "done", isErr = st === "error" || st === "empty", isNow = st === "generating";
            return (
              <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 4px" }}>
                <span style={{
                  flex: "none", width: 17, height: 17, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                  background: isDone ? "var(--accent-ember)" : isErr ? "var(--accent-ember-deep)" : "transparent",
                  border: isNow ? "2px solid var(--accent-ember)" : isDone || isErr ? "none" : "1px solid var(--border-strong)",
                  animation: isNow ? "gwpulse .9s ease-in-out infinite" : undefined,
                }}>
                  {isDone && <Check />}{isErr && <Bang />}
                </span>
                <span style={{
                  fontFamily: "var(--font-body)", fontSize: 13.5,
                  color: isDone || isNow ? "var(--ink-900)" : isErr ? "var(--accent-ember-deep)" : "var(--text-muted)",
                  fontWeight: isNow ? 600 : 400,
                }}>{s.title}</span>
                {isErr && (
                  <span title={errors[s.key] || "Failed"} style={{ marginLeft: "auto", maxWidth: 150, fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: ".04em", color: "var(--accent-ember-deep)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {errors[s.key] || "failed"}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {finished && (
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 22 }}>
            {/* A save failure is recoverable — the sections are written and in memory, only
                the write failed. Retrying beats making the analyst generate them again. */}
            {saveError && onRetrySave && (
              <button onClick={onRetrySave} className="gw-ember-btn"
                style={{ background: "var(--accent-ember)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600 }}>
                Retry save
              </button>
            )}
            {failed.length > 0 && onRetry && (
              <button onClick={onRetry} style={{ background: "var(--brand-white)", border: "1px solid var(--border-hairline)", borderRadius: 8, padding: "9px 14px", cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-secondary)" }}>
                Retry {failed.length} section{failed.length === 1 ? "" : "s"}
              </button>
            )}
            <button onClick={onOpenPartial || onDismiss} className="gw-ember-btn"
              style={{ background: "var(--accent-ember)", color: "#fff", border: "none", borderRadius: 9, padding: "10px 18px", cursor: "pointer", fontFamily: "var(--font-display)", fontSize: 13.5, fontWeight: 700 }}>
              {saveError ? "Close" : someFailed ? "Open what we have →" : "Open report →"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
