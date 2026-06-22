"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

/* KD Design System tokens (mirrors colors_and_type.css) */
const KD = {
  white: "#FFFFFF",
  cream: "#FFF7F0",
  black: "#000000",
  blue: "#011EFF",
  ember: "#FF4A1A",
  sans: "var(--kd-sans, 'IBM Plex Sans', system-ui, sans-serif)",
  serif: "var(--kd-serif, 'IBM Plex Serif', Georgia, serif)",
  mono: "var(--kd-mono, 'IBM Plex Mono', monospace)",
  smallcaps: "var(--kd-smallcaps, 'Bodoni 72', Georgia, serif)",
  easing: "cubic-bezier(0.16, 1, 0.3, 1)",
};

/* "Dots + connecting lines" — the brand's literal motif, drawn slow & subtle */
function ConnectedDots() {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = canvas.getContext("2d");
    let raf, w, h, dots;
    const DPR = Math.min(window.devicePixelRatio || 1, 2);

    const seed = () => {
      const rect = canvas.getBoundingClientRect();
      w = rect.width; h = rect.height;
      canvas.width = w * DPR; canvas.height = h * DPR;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      dots = Array.from({ length: 26 }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        r: 1.4 + Math.random() * 2.2,
      }));
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < dots.length; i++) {
        const d = dots[i];
        if (!reduce) { d.x += d.vx; d.y += d.vy; }
        if (d.x < 0 || d.x > w) d.vx *= -1;
        if (d.y < 0 || d.y > h) d.vy *= -1;
        for (let j = i + 1; j < dots.length; j++) {
          const o = dots[j];
          const dist = Math.hypot(d.x - o.x, d.y - o.y);
          if (dist < 170) {
            ctx.strokeStyle = `rgba(255,247,240,${0.18 * (1 - dist / 170)})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(d.x, d.y);
            ctx.lineTo(o.x, o.y);
            ctx.stroke();
          }
        }
      }
      for (const d of dots) {
        ctx.fillStyle = "rgba(255,247,240,0.55)";
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fill();
      }
      if (!reduce) raf = requestAnimationFrame(draw);
    };

    seed();
    draw();
    window.addEventListener("resize", seed);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", seed); };
  }, []);
  return <canvas ref={ref} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} aria-hidden="true" />;
}

/* Vertical stacked wordmark — KNOTS / & / DOTS, the "&" in serif italic */
function VerticalWordmark({ color = KD.cream }) {
  const row = (ch, i) => (
    <span key={i} style={{ fontFamily: KD.sans, fontWeight: 600, fontSize: 13, letterSpacing: "0.22em", lineHeight: 1.5, color }}>{ch}</span>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }} aria-label="Knots & Dots">
      {["K", "N", "O", "T", "S"].map(row)}
      <span style={{ fontFamily: KD.smallcaps, fontStyle: "italic", fontSize: 18, lineHeight: 1.4, margin: "2px 0", color }}>&amp;</span>
      {["D", "O", "T", "S"].map(row)}
    </div>
  );
}

/* Left brand panel — electric-blue field, cream text, dots motif */
function BrandPanel() {
  return (
    <div
      style={{
        position: "relative", overflow: "hidden", background: KD.blue, color: KD.cream,
        padding: "44px", display: "flex", flexDirection: "column", justifyContent: "space-between",
      }}
    >
      <ConnectedDots />
      <div style={{ position: "relative", zIndex: 1, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <VerticalWordmark />
        <span style={{ fontFamily: KD.mono, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,247,240,0.7)" }}>
          Competitive Intelligence /
        </span>
      </div>

      <div style={{ position: "relative", zIndex: 1, maxWidth: 460 }}>
        <p style={{ fontFamily: KD.serif, fontStyle: "italic", fontWeight: 300, fontSize: 40, lineHeight: 1.22, color: KD.cream }}>
          Strategy is not about doing more. It&rsquo;s about clarity&nbsp;&mdash; finding the signal in the noise.
        </p>
        <div style={{ marginTop: 28, height: 3, width: 56, background: KD.ember }} />
      </div>

      <div style={{ position: "relative", zIndex: 1 }}>
        <span style={{ fontFamily: KD.mono, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,247,240,0.6)" }}>
          We untie. We connect.
        </span>
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%", padding: "12px 14px", background: KD.white, border: "1px solid rgba(0,0,0,0.14)",
  borderRadius: 4, fontSize: 15, color: KD.black, outline: "none", boxSizing: "border-box", fontFamily: KD.sans,
};
const labelStyle = {
  display: "block", fontFamily: KD.mono, fontSize: 11, fontWeight: 500, color: "rgba(0,0,0,0.55)",
  textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8,
};
const primaryBtn = (loading) => ({
  width: "100%", background: KD.blue, color: KD.white, padding: "13px", borderRadius: 4, fontSize: 14,
  fontWeight: 600, border: "none", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1,
  letterSpacing: "0.01em", fontFamily: KD.sans, transition: `background 0.2s ${KD.easing}`,
});

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // MFA state
  const [mfaStep, setMfaStep] = useState(false); // true = show MFA verification
  const [mfaCode, setMfaCode] = useState("");
  const [mfaFactorId, setMfaFactorId] = useState(null);
  const [mfaMethod, setMfaMethod] = useState(null); // "totp" or "email"
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [emailOtpCode, setEmailOtpCode] = useState("");

  const supabase = createClient();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) { setError("Invalid email or password"); setLoading(false); return; }

    // MFA DISABLED (2026-06-15) — it was locking users out and the admin
    // "Reset MFA" escape hatch was unavailable (needs the Supabase service
    // role key, which is not configured). Logging in now goes straight
    // through after the password. The MFA verification screen and the
    // verifyTotp/verifyEmailOtp helpers below are kept intact (just no longer
    // reached) so MFA can be re-enabled later by restoring the factor checks.
    // Clear any cached brand/project/org from a previous user, then do a FULL
    // reload so every provider re-reads the new session (fixes stale identity
    // where a freshly-logged-in user still saw the previous user's email).
    try {
      ["gw-active-brand", "gw-active-brand-name", "gw-active-org", "sb-project-id", "sb-project-name", "sb-client-name", "groundwork_profile"]
        .forEach(k => localStorage.removeItem(k));
    } catch {}
    window.location.href = "/projects";
  };

  const verifyTotp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: mfaFactorId });
    if (challengeError || !challenge) {
      console.error("MFA challenge error:", challengeError);
      setError("MFA factor may be invalid. Please contact your admin to reset MFA.");
      setLoading(false);
      return;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: mfaFactorId,
      challengeId: challenge.id,
      code: mfaCode,
    });

    if (verifyError) {
      console.error("MFA verify error:", verifyError);
      setError(verifyError.message || "Invalid code. Please try again.");
      setMfaCode("");
      setLoading(false);
      return;
    }

    router.replace("/projects");
  };

  const sendEmailOtp = async (userEmail) => {
    // Generate a 6-digit code and store it server-side
    const res = await fetch("/api/mfa-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "send", email: userEmail }),
    });
    const data = await res.json();
    if (data.success) setEmailOtpSent(true);
    else setError(data.error || "Failed to send code");
  };

  const verifyEmailOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/mfa-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "verify", email, code: emailOtpCode }),
    });
    const data = await res.json();

    if (data.success) {
      router.replace("/projects");
    } else {
      setError("Invalid code. Please try again.");
      setEmailOtpCode("");
      setLoading(false);
    }
  };

  // MFA Verification Screen
  if (mfaStep) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: KD.black, fontFamily: KD.sans }}>
        <div style={{ width: "100%", maxWidth: 400, padding: 24 }}>
          <div style={{ background: KD.white, borderRadius: 6, padding: 40, boxShadow: "0 24px 60px rgba(0,0,0,0.35)" }}>
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <div style={{ width: 52, height: 52, margin: "0 auto 18px", borderRadius: 4, background: KD.blue, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={KD.white} strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
              </div>
              <h1 style={{ fontFamily: KD.sans, fontSize: 24, fontWeight: 600, color: KD.black, letterSpacing: "-0.01em" }}>
                {mfaMethod === "totp" ? "Authenticator code" : "Email verification"}
              </h1>
              <p style={{ fontFamily: KD.serif, fontStyle: "italic", fontSize: 15, color: "rgba(0,0,0,0.6)", marginTop: 8 }}>
                {mfaMethod === "totp"
                  ? "Enter the 6-digit code from your authenticator app"
                  : `We sent a code to ${email}`}
              </p>
            </div>

            <form onSubmit={mfaMethod === "totp" ? verifyTotp : verifyEmailOtp}>
              <div style={{ marginBottom: 20 }}>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={mfaMethod === "totp" ? mfaCode : emailOtpCode}
                  onChange={e => {
                    const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                    mfaMethod === "totp" ? setMfaCode(v) : setEmailOtpCode(v);
                  }}
                  style={{ ...inputStyle, fontFamily: KD.mono, padding: "14px", fontSize: 28, textAlign: "center", letterSpacing: "0.5em", fontWeight: 500 }}
                  placeholder="000000"
                  autoFocus
                  required
                />
              </div>
              {error && <p style={{ color: KD.ember, fontFamily: KD.mono, fontSize: 12, marginBottom: 14, textAlign: "center", letterSpacing: "0.04em" }}>{error}</p>}
              <button type="submit" disabled={loading || (mfaMethod === "totp" ? mfaCode.length !== 6 : emailOtpCode.length !== 6)}
                style={primaryBtn(loading)}>
                {loading ? "Verifying…" : "Verify"}
              </button>
            </form>

            {mfaMethod === "email" && (
              <button onClick={() => sendEmailOtp(email)} disabled={loading}
                style={{ width: "100%", marginTop: 14, background: "transparent", border: "none", color: KD.blue, fontFamily: KD.mono, fontSize: 12, cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Resend code
              </button>
            )}

            <button onClick={() => { setMfaStep(false); setError(""); supabase.auth.signOut(); }}
              style={{ width: "100%", marginTop: 10, background: "transparent", border: "none", color: "rgba(0,0,0,0.45)", fontFamily: KD.mono, fontSize: 11, cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Back to login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Normal Login Screen — KD split: blue brand panel + cream form
  return (
    <div className="kd-login-root" style={{ minHeight: "100vh", background: KD.white, fontFamily: KD.sans }}>
      <style>{`
        @keyframes kdRise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .kd-rise { animation: kdRise 1.2s ${KD.easing} both; }
        .kd-rise-2 { animation: kdRise 1.2s ${KD.easing} 0.12s both; }
        .kd-rise-3 { animation: kdRise 1.2s ${KD.easing} 0.24s both; }
        .kd-login-root { display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr); }
        .kd-login-brand { display: block; }
        .kd-login-form { display: flex; align-items: center; justify-content: center; padding: 48px 32px; }
        @media (max-width: 880px) {
          .kd-login-root { grid-template-columns: 1fr; }
          .kd-login-brand { display: none; }
        }
      `}</style>

      <div className="kd-login-brand"><BrandPanel /></div>

      <div className="kd-login-form">
        <div style={{ width: "100%", maxWidth: 384 }}>
          <div className="kd-rise" style={{ marginBottom: 36 }}>
            <img src="/brand/kd-logo-horizontal.svg" alt="Knots & Dots" style={{ height: 30, width: "auto", color: KD.black }} />
          </div>

          <div className="kd-rise-2" style={{ marginBottom: 32 }}>
            <span style={{ fontFamily: KD.mono, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(0,0,0,0.5)" }}>
              Welcome back /
            </span>
            <h1 style={{ fontFamily: KD.sans, fontSize: 44, fontWeight: 600, color: KD.black, letterSpacing: "-0.025em", lineHeight: 1.0, marginTop: 12 }}>
              Groundwork
            </h1>
            <p style={{ fontFamily: KD.serif, fontStyle: "italic", fontWeight: 400, fontSize: 18, color: "rgba(0,0,0,0.6)", marginTop: 10 }}>
              Competitive intelligence, untangled.
            </p>
          </div>

          <form onSubmit={handleLogin} className="kd-rise-3">
            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                style={inputStyle} placeholder="you@company.com" required />
            </div>
            <div style={{ marginBottom: 26 }}>
              <label style={labelStyle}>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                style={inputStyle} placeholder="••••••••" required />
            </div>
            {error && <p style={{ color: KD.ember, fontFamily: KD.mono, fontSize: 12, marginBottom: 16, letterSpacing: "0.04em" }}>{error}</p>}
            <button type="submit" disabled={loading} style={primaryBtn(loading)}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.background = KD.black; }}
              onMouseLeave={e => { e.currentTarget.style.background = KD.blue; }}>
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <div style={{ marginTop: 32, paddingTop: 22, borderTop: "1px solid rgba(0,0,0,0.08)" }}>
            <p style={{ fontFamily: KD.mono, fontSize: 11, color: "rgba(0,0,0,0.45)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
              A Knots &amp; Dots product
            </p>
            <p style={{ fontFamily: KD.mono, fontSize: 10, color: "rgba(0,0,0,0.3)", marginTop: 4, letterSpacing: "0.06em" }}>
              Version 2.5 · © 2026 Knots &amp; Dots
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
