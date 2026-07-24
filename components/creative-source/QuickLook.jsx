"use client";
// Creative Source — QUICK LOOK. The centred modal that previews one entry: hero, brand,
// slogan, the four quick-read fields, synopsis, and PDF / Edit / View full.
//
// Extracted from the audit grid so every surface that opens a case shows the SAME thing —
// a citation clicked inside a report must look like a case opened from the grid, because
// it is the same case. Behaviour is unchanged from the original inline version.
//
// The host supplies the actions, since "edit" and "view full" mean different navigation
// depending on where the case was opened from.

const ytId = (u) => { if (!u) return null; const m = String(u).match(/(?:youtube\.com\/watch\?.*v=|youtu\.be\/)([^&\s]+)/); return m ? m[1] : null; };
const isVideoFile = (u) => /\.(mp4|mov|webm|m4v)(\?|$)/i.test(u || "");
const usable = (v) => v && !String(v).startsWith("Not ") && !String(v).startsWith("None");

export default function QuickLook({ entry, onClose, onEdit, onFull, onPdf, downloading, onZoomImage, loading, missing }) {
  if (!entry) return null;
  const sb = entry;

  // A cited piece that can't be resolved is stated plainly — an empty modal reads as a
  // broken app when the truth is simply that the case is gone.
  if (loading || missing) {
    return (
      <Shell onClose={onClose}>
        <div style={{ padding: "40px 26px", textAlign: "center" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: ".18em", color: "var(--accent-ember-deep)", marginBottom: 12 }}>CREATIVE SOURCE · CASE</div>
          {loading
            ? <p className="animate-pulse" style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-muted)", margin: 0 }}>Loading case…</p>
            : <>
                <p style={{ fontFamily: "var(--font-body)", fontSize: 13, lineHeight: 1.55, color: "var(--text-secondary)", margin: 0 }}>
                  This case couldn&rsquo;t be found. It may have been deleted, or it belongs to another project.
                </p>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)", marginTop: 12 }}>ID {String(sb.id || "—")}</div>
              </>}
        </div>
      </Shell>
    );
  }

  const bname = sb.competitor || sb.brand_name || sb.brand || "—";
  const heroThumb = ytId(sb.url) ? `https://img.youtube.com/vi/${ytId(sb.url)}/hqdefault.jpg` : sb.image_url;
  const isVid = ytId(sb.url) || isVideoFile(sb.url) || /(instagram\.com\/reel|tiktok\.com)/i.test(sb.url || "");
  const cd = (() => { try { return typeof sb.custom_dimensions === "string" ? JSON.parse(sb.custom_dimensions) : (sb.custom_dimensions || {}); } catch { return {}; } })();
  const plat = cd?._social?.platform || cd?._meta?.platform || (ytId(sb.url) ? "YouTube" : /instagram/i.test(sb.url || "") ? "Instagram" : /tiktok/i.test(sb.url || "") ? "TikTok" : "");
  const rate = Number(sb.rating) || 0;
  const qr = [["ROLE", sb.bank_role], ["ARCHETYPE", sb.brand_archetype], ["TONE", sb.tone_of_voice], ["TERRITORY", sb.primary_territory]].filter(([, v]) => usable(v));

  return (
    <Shell onClose={onClose}>
      {/* hero */}
      <div style={{ position: "relative", flex: "none" }}>
        {heroThumb
          ? <img src={heroThumb} onClick={() => { if (isVid && sb.url) window.open(sb.url, "_blank"); else if (sb.image_url) onZoomImage?.(sb.image_url); }}
              style={{ width: "100%", height: 236, objectFit: "cover", display: "block", cursor: "pointer" }} alt="" />
          : <div style={{ width: "100%", height: 236, background: "var(--ink-200)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)" }}>No preview</div>}
        {isVid && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
            <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="16" height="16" viewBox="0 0 20 20" fill="white"><polygon points="6,3 17,10 6,17" /></svg>
            </div>
          </div>
        )}
        <button onClick={onClose} style={{ position: "absolute", top: 12, right: 12, width: 30, height: 30, borderRadius: "50%", background: "rgba(0,0,0,.5)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", cursor: "pointer" }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
        <span style={{ position: "absolute", bottom: 12, left: 14, fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 600, color: "#fff", background: "rgba(0,0,0,.55)", borderRadius: 6, padding: "4px 9px" }}>{bname}</span>
      </div>

      {/* body */}
      <div style={{ padding: "18px 22px", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--ink-200)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600, flex: "none" }}>{bname.charAt(0).toUpperCase()}</span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, fontWeight: 600, color: "var(--ink-900)" }}>{bname}</div>
            {sb.category && <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-muted)" }}>{sb.category}</div>}
          </div>
          {sb.url && <a href={sb.url} target="_blank" rel="noopener" style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-accent)", flex: "none" }}>Open original ↗</a>}
        </div>
        {sb.description && <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, lineHeight: 1.2, margin: "14px 0 0", color: "var(--ink-900)" }}>{sb.description}</h2>}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 9, flexWrap: "wrap" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: ".05em", color: "var(--text-muted)", textTransform: "uppercase" }}>{[plat, sb.year, sb.type].filter(Boolean).join(" · ")}</span>
          {rate > 0 && <span style={{ fontSize: 12, letterSpacing: 1 }}><span style={{ color: "var(--accent-ember)" }}>{"★".repeat(rate)}</span><span style={{ color: "var(--ink-300)" }}>{"★".repeat(5 - rate)}</span></span>}
        </div>
        {sb.main_slogan && (
          <div style={{ marginTop: 14, padding: "12px 14px", background: "var(--accent-ember-tint)", borderRadius: 10 }}>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, lineHeight: 1.25, color: "#5a3020" }}>&ldquo;{sb.main_slogan}&rdquo;</div>
          </div>
        )}
        {qr.length > 0 && (
          <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 20px" }}>
            {qr.map(([l, v]) => (
              <div key={l}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: ".14em", color: "var(--text-muted)", marginBottom: 3 }}>{l}</div>
                <div style={{ fontFamily: "var(--font-body)", fontSize: 11.5, color: "var(--ink-900)" }}>{v}</div>
              </div>
            ))}
          </div>
        )}
        {sb.synopsis && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: ".14em", color: "var(--text-muted)", marginBottom: 5 }}>SYNOPSIS</div>
            <p className="line-clamp-3" style={{ fontFamily: "var(--font-body)", fontSize: 11.5, lineHeight: 1.55, color: "var(--text-secondary)", margin: 0 }}>{sb.synopsis}</p>
          </div>
        )}
      </div>

      {/* footer */}
      <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 10, padding: "14px 22px", borderTop: "1px solid var(--paper-edge)", background: "var(--brand-white)" }}>
        {onPdf && (
          <button onClick={() => onPdf(sb)} disabled={downloading} className="gw-tbtn" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-secondary)", background: "transparent", border: "1px solid var(--border-hairline)", borderRadius: 8, padding: "9px 12px", cursor: "pointer" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 3v12M7 10l5 5 5-5M5 21h14" /></svg>{downloading ? "…" : "PDF"}
          </button>
        )}
        <div style={{ flex: 1 }} />
        {onEdit && (
          <button onClick={() => onEdit(sb)} className="gw-tbtn" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-secondary)", background: "var(--brand-white)", border: "1px solid var(--border-strong)", borderRadius: 8, padding: "9px 14px", cursor: "pointer" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>Edit
          </button>
        )}
        {onFull && (
          <button onClick={() => onFull(sb)} className="gw-ember-btn" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "var(--font-body)", fontWeight: 500, fontSize: 11, color: "#fff", background: "var(--accent-ember-deep)", border: "none", borderRadius: 8, padding: "10px 15px", cursor: "pointer" }}>
            View full<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M7 17 17 7M9 7h8v8" /></svg>
          </button>
        )}
      </div>
    </Shell>
  );
}

function Shell({ children, onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "rgba(26,26,26,0.6)", backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)" }} onClick={onClose}>
      <div onClick={(ev) => ev.stopPropagation()} style={{ width: "100%", maxWidth: 540, maxHeight: "88vh", background: "var(--brand-white)", borderRadius: 18, boxShadow: "var(--shadow-modal)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {children}
      </div>
    </div>
  );
}
