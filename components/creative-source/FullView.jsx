"use client";
// Creative Source — FULL VIEW (read-only). A dedicated screen showing the entire
// framework for one entry, following design_handoff view 08. NOT the editor.
// Collapsed sidebar is applied by the page (via ?full= → forceCollapsed).
import { engagementRate, fmtRate } from "@/lib/engagement";

const ytId = (u) => { if (!u) return null; const m = String(u).match(/(?:youtube\.com\/watch\?.*v=|youtu\.be\/)([^&\s]+)/); return m ? m[1] : null; };
const isVideoFile = (u) => /\.(mp4|mov|webm|m4v)(\?|$)/i.test(u || "");
const clean = (v) => v && String(v).trim() && !String(v).startsWith("Not ") && !String(v).startsWith("None");

// A labeled read-only field
const Field = ({ label, value, span }) => clean(value) ? (
  <div style={span ? { gridColumn: `span ${span}` } : undefined}>
    <div className="gw-fl">{label}</div>
    <div className="gw-fv">{value}</div>
  </div>
) : null;
// Comma-separated → chips
const Tags = ({ label, value, span }) => {
  const items = String(value || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!items.length) return null;
  return (
    <div style={span ? { gridColumn: `span ${span}` } : undefined}>
      <div className="gw-fl">{label}</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{items.map((t, i) => <span key={i} className="gw-fvtag">{t}</span>)}</div>
    </div>
  );
};
const Stars = ({ n }) => { const r = Number(n) || 0; return r > 0 ? <span style={{ fontSize: 14, letterSpacing: 1 }}><span style={{ color: "var(--accent-ember)" }}>{"★".repeat(r)}</span><span style={{ color: "var(--ink-300)" }}>{"★".repeat(5 - r)}</span></span> : null; };
const Card = ({ n, title, children, cols = 2 }) => (
  <div style={{ background: "var(--brand-white)", border: "1px solid var(--border-hairline)", borderRadius: 16, padding: "22px 24px" }}>
    <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: ".18em", color: "var(--accent-ember-deep)", marginBottom: 18 }}>{n} · {title}</div>
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols},1fr)`, gap: "18px 24px" }}>{children}</div>
  </div>
);

export default function FullView({ entry: e, onBack, onEdit, onPdf, downloading, index, total, scopeLabel }) {
  if (!e) return <div style={{ padding: 40, fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-muted)" }}>Entry not found.</div>;
  const cd = (() => { try { return typeof e.custom_dimensions === "string" ? JSON.parse(e.custom_dimensions) : (e.custom_dimensions || {}); } catch { return {}; } })();
  const s = cd._social || {}, m = cd._meta || {};
  const brand = e.competitor || e.brand_name || e.brand || "—";
  const thumb = ytId(e.url) ? `https://img.youtube.com/vi/${ytId(e.url)}/hqdefault.jpg` : e.image_url;
  const plat = s.platform || m.platform || (ytId(e.url) ? "YouTube" : /instagram/i.test(e.url || "") ? "Instagram" : /tiktok/i.test(e.url || "") ? "TikTok" : "");
  const metaLine = [plat, e.year, e.type, s.format].filter(Boolean).join(" · ").toUpperCase();
  const rate = engagementRate({ likes: m.likes, comments: m.comments, views: m.views, followers: m.followers });
  const likes = Number(m.likes) || 0, comments = Number(m.comments) || 0, views = Number(m.views) || 0;
  const kfmt = (n) => n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, "") + "k" : String(n);
  const hasSocial = plat || s.format || s.post_objective || s.content_pillar || s.visual_codes;

  return (
    <div className="gw-shell" style={{ background: "var(--paper)", minHeight: "100%" }}>
      <style>{`.gw-fv{font-family:var(--font-body);font-size:12.5px;line-height:1.5;color:var(--ink-900)}.gw-fl{font-family:var(--font-mono);font-size:8px;letter-spacing:.14em;color:var(--text-muted);margin-bottom:5px;text-transform:uppercase}.gw-fvtag{font-family:var(--font-mono);font-size:10px;color:var(--text-secondary);background:var(--paper);border:1px solid var(--border-hairline);border-radius:16px;padding:4px 10px;white-space:nowrap}`}</style>
      <div style={{ padding: "22px 40px 56px", maxWidth: 1260, margin: "0 auto" }}>
        {/* top bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button onClick={onBack} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-secondary)", background: "transparent", border: "none", cursor: "pointer" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="m15 18-6-6 6-6" /></svg>{scopeLabel}
          </button>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".12em", color: "var(--ink-300)" }}>/ ENTRY · READ-ONLY</span>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
            {total > 0 && <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)" }}>{index} / {total}</span>}
            <span style={{ width: 1, height: 16, background: "var(--border-hairline)" }} />
            <button onClick={onPdf} disabled={downloading} className="gw-tbtn" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-secondary)", background: "var(--brand-white)", border: "1px solid var(--border-hairline)", borderRadius: 8, padding: "8px 12px", cursor: "pointer" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 3v12M7 10l5 5 5-5M5 21h14" /></svg>{downloading ? "…" : "Export PDF"}
            </button>
            <button onClick={onEdit} className="gw-ember-btn" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "var(--font-body)", fontWeight: 500, fontSize: 11, color: "#fff", background: "var(--accent-ember-deep)", border: "none", borderRadius: 8, padding: "8px 14px", cursor: "pointer" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>Edit
            </button>
          </div>
        </div>

        {/* title */}
        <div style={{ marginTop: 22, maxWidth: 940 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: ".18em", color: "var(--accent-ember-deep)", marginBottom: 12 }}>CREATIVE SOURCE · ENTRY</div>
          <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 32, lineHeight: 1.1, letterSpacing: "-.01em", margin: 0, color: "var(--ink-900)" }}>{e.description || "Untitled entry"}</h1>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 16, flexWrap: "wrap" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600, color: "var(--ink-900)" }}><span style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--ink-200)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9 }}>{brand.charAt(0).toUpperCase()}</span>{brand}</span>
            {metaLine && <><span style={{ width: 1, height: 14, background: "var(--border-hairline)" }} /><span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".05em", color: "var(--text-secondary)" }}>{metaLine}</span></>}
            <Stars n={e.rating} />
            {(likes || comments) > 0 && <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)" }}>♥ {kfmt(likes)} · 💬 {kfmt(comments)}</span>}
          </div>
        </div>

        {/* hero row */}
        <div style={{ marginTop: 24, display: "grid", gridTemplateColumns: "340px 1fr", gap: 24, alignItems: "start", maxWidth: 1180 }}>
          <div style={{ border: "1px solid var(--border-hairline)", borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
            {thumb ? <img src={thumb} alt="" style={{ width: "100%", aspectRatio: "1/1", objectFit: "cover", display: "block" }} /> : <div style={{ width: "100%", aspectRatio: "1/1", background: "var(--ink-200)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)" }}>No preview</div>}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {(e.main_slogan || likes || comments || views || rate != null) && (
              <div style={{ background: "var(--ink-800)", borderRadius: 16, padding: "22px 24px" }}>
                {e.main_slogan && <>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: ".14em", color: "#8a8a8a", marginBottom: 8 }}>MAIN SLOGAN</div>
                  <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 24, lineHeight: 1.15, color: "var(--brand-cream)" }}>&ldquo;{e.main_slogan}&rdquo;</div>
                </>}
                {(likes || comments || views || rate != null) && (
                  <div style={{ display: "flex", gap: 22, marginTop: e.main_slogan ? 20 : 0, paddingTop: e.main_slogan ? 18 : 0, borderTop: e.main_slogan ? "1px solid rgba(255,255,255,.12)" : "none", flexWrap: "wrap" }}>
                    {rate != null && <div><div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 22, color: "var(--accent-ember)" }}>{fmtRate(rate)}</div><div style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: ".08em", color: "#8a8a8a", marginTop: 4 }}>ENGAGEMENT</div></div>}
                    <div><div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 22, color: "#fff" }}>{kfmt(likes)}</div><div style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: ".08em", color: "#8a8a8a", marginTop: 4 }}>LIKES</div></div>
                    <div><div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 22, color: "#fff" }}>{kfmt(comments)}</div><div style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: ".08em", color: "#8a8a8a", marginTop: 4 }}>COMMENTS</div></div>
                    {views > 0 && <div><div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 22, color: "#fff" }}>{kfmt(views)}</div><div style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: ".08em", color: "#8a8a8a", marginTop: 4 }}>VIEWS</div></div>}
                  </div>
                )}
              </div>
            )}
            {clean(e.synopsis) && (
              <div style={{ background: "var(--brand-white)", border: "1px solid var(--border-hairline)", borderRadius: 16, padding: "18px 20px" }}>
                <div className="gw-fl">SYNOPSIS</div>
                <p className="gw-fv" style={{ margin: 0 }}>{e.synopsis}</p>
              </div>
            )}
          </div>
        </div>

        {/* full framework */}
        <div style={{ marginTop: 30, maxWidth: 1180, display: "flex", flexDirection: "column", gap: 16 }}>
          <Card n="01" title="IDENTIFICATION" cols={4}>
            <Field label="Scope" value={e.scope === "global" ? "Global" : "Local"} />
            <Field label="Brand" value={brand} />
            <Field label="Country / Market" value={e.country} />
            <Field label="Category" value={e.category} />
            <Field label="Category proximity" value={e.category_proximity} />
            <Field label="Year" value={e.year} />
            <Field label="Type (format)" value={e.type} />
            <Field label="Funnel stage" value={e.funnel} />
            <Tags label="Communication intent" value={e.communication_intent} span={2} />
            {Number(e.rating) > 0 && <div style={{ gridColumn: "span 2" }}><div className="gw-fl">Rating</div><Stars n={e.rating} /></div>}
          </Card>

          {(clean(e.insight) || clean(e.idea) || clean(e.primary_territory) || clean(e.execution_style)) && (
            <Card n="02" title="CREATIVE EVALUATION">
              <Field label="Insight" value={e.insight} span={2} />
              <Field label="Idea" value={e.idea} span={2} />
              <Field label="Primary territory" value={e.primary_territory} />
              <Field label="Secondary territory" value={e.secondary_territory} />
              <Tags label="Execution style" value={e.execution_style} span={2} />
            </Card>
          )}

          {(clean(e.bank_role) || clean(e.main_vp) || clean(e.brand_archetype) || clean(e.tone_of_voice)) && (
            <Card n="03" title="BRAND & COMMUNICATION">
              <Field label="Brand role" value={e.bank_role} />
              <Field label="Language register" value={e.language_register} />
              <Field label="Pain point type" value={e.pain_point_type} />
              <Field label="Pain point" value={e.pain_point} />
              <Field label="Main value proposition" value={e.main_vp} span={2} />
              <Field label="Emotional benefit" value={e.emotional_benefit} />
              <Field label="Rational benefit" value={e.rational_benefit} />
              <Field label="R2B (reason to believe)" value={e.r2b} />
              <Tags label="Brand archetype" value={e.brand_archetype} />
              <Tags label="Brand attributes" value={e.brand_attributes} span={2} />
            </Card>
          )}

          <div style={{ display: "grid", gridTemplateColumns: hasSocial ? "1fr 1fr" : "1fr", gap: 16 }}>
            <Card n="04" title="EXECUTION">
              <Tags label="Channel" value={e.channel} />
              <Tags label="CTA" value={e.cta} />
              <Tags label="Tone of voice" value={e.tone_of_voice} />
              <Field label="Differentiation" value={e.diff_claim} />
            </Card>
            {hasSocial && (
              <Card n="05" title="SOCIAL CONTENT">
                <Field label="Platform" value={plat} />
                <Field label="Format" value={s.format} />
                <Field label="Objective" value={s.post_objective} />
                <Field label="Content pillar" value={s.content_pillar} />
                <Field label="Visual codes" value={s.visual_codes} span={2} />
              </Card>
            )}
          </div>

          {(clean(e.transcript) || clean(e.analyst_comment)) && (
            <div style={{ display: "grid", gridTemplateColumns: (clean(e.transcript) && clean(e.analyst_comment)) ? "1fr 1fr" : "1fr", gap: 16 }}>
              {clean(e.transcript) && (
                <div style={{ background: "var(--paper)", border: "1px solid var(--border-hairline)", borderRadius: 16, padding: "20px 22px" }}>
                  <div className="gw-fl">TRANSCRIPT / COPY</div>
                  <p className="gw-fv" style={{ margin: 0, color: "var(--text-secondary)", whiteSpace: "pre-wrap", maxHeight: 260, overflow: "auto" }}>{e.transcript}</p>
                </div>
              )}
              {clean(e.analyst_comment) && (
                <div style={{ background: "var(--paper)", border: "1px solid var(--border-hairline)", borderRadius: 16, padding: "20px 22px" }}>
                  <div className="gw-fl">ANALYST NOTES</div>
                  <p className="gw-fv" style={{ margin: 0, color: "var(--text-secondary)" }}>{e.analyst_comment}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
