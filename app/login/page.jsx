"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

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

    // Check if user has MFA enrolled
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const totpFactor = factors?.totp?.find(f => f.status === "verified");

    if (totpFactor) {
      // User has TOTP MFA — need verification
      setMfaFactorId(totpFactor.id);
      setMfaMethod("totp");
      setMfaStep(true);
      setLoading(false);
      return;
    }

    // Check if user has email MFA enabled (stored in user metadata)
    const user = data?.user;
    if (user?.user_metadata?.mfa_email_enabled) {
      // Send email OTP
      setMfaMethod("email");
      setMfaStep(true);
      await sendEmailOtp(email);
      setLoading(false);
      return;
    }

    // No MFA — proceed
    router.replace("/projects");
  };

  const verifyTotp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { data: challenge } = await supabase.auth.mfa.challenge({ factorId: mfaFactorId });
    if (!challenge) { setError("MFA challenge failed"); setLoading(false); return; }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: mfaFactorId,
      challengeId: challenge.id,
      code: mfaCode,
    });

    if (verifyError) {
      setError("Invalid code. Please try again.");
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
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0a0f3c" }}>
        <div className="w-full max-w-sm relative z-10">
          <div className="rounded-2xl p-8 shadow-2xl" style={{ background: "#ffffff" }}>
            <div className="text-center mb-6">
              <div className="w-14 h-14 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ background: "#f0f0ff" }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0019FF" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
              </div>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0a0f3c" }}>
                {mfaMethod === "totp" ? "Authenticator Code" : "Email Verification"}
              </h1>
              <p style={{ fontSize: 13, color: "#8e90a6", marginTop: 8 }}>
                {mfaMethod === "totp"
                  ? "Enter the 6-digit code from your authenticator app"
                  : `We sent a code to ${email}`}
              </p>
            </div>

            <form onSubmit={mfaMethod === "totp" ? verifyTotp : verifyEmailOtp}>
              <div className="mb-5">
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
                  style={{ width: "100%", padding: "14px", background: "#f5f4f0", border: "1px solid #ddd9d0", borderRadius: 12, fontSize: 28, color: "#0a0f3c", outline: "none", textAlign: "center", letterSpacing: "0.5em", fontWeight: 700, boxSizing: "border-box" }}
                  placeholder="000000"
                  autoFocus
                  required
                />
              </div>
              {error && <p style={{ color: "#e53e3e", fontSize: 13, marginBottom: 12, textAlign: "center" }}>{error}</p>}
              <button type="submit" disabled={loading || (mfaMethod === "totp" ? mfaCode.length !== 6 : emailOtpCode.length !== 6)}
                style={{ width: "100%", background: "#0019FF", color: "#fff", padding: "11px", borderRadius: 8, fontSize: 14, fontWeight: 700, border: "none", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1 }}>
                {loading ? "Verifying..." : "Verify"}
              </button>
            </form>

            {mfaMethod === "email" && (
              <button onClick={() => sendEmailOtp(email)} disabled={loading}
                style={{ width: "100%", marginTop: 12, background: "transparent", border: "none", color: "#0019FF", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
                Resend code
              </button>
            )}

            <button onClick={() => { setMfaStep(false); setError(""); supabase.auth.signOut(); }}
              style={{ width: "100%", marginTop: 8, background: "transparent", border: "none", color: "#8e90a6", fontSize: 12, cursor: "pointer" }}>
              Back to login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Normal Login Screen
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#0a0f3c" }}>
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
        <div className="absolute top-[15%] left-[8%] w-[500px] h-[500px] rounded-full opacity-[0.03]" style={{ background: "#0019FF", filter: "blur(120px)" }} />
        <div className="absolute bottom-[10%] right-[5%] w-[400px] h-[400px] rounded-full opacity-[0.04]" style={{ background: "#D4E520", filter: "blur(100px)" }} />
      </div>

      <div className="fixed left-8 top-8 flex flex-col items-start gap-0 select-none pointer-events-none text-white/[0.08]">
        {["K","N","O","T","S"].map((l, i) => (
          <span key={i} className="text-sm font-bold leading-[1.3]" style={{ marginLeft: i === 2 ? 6 : i === 3 ? 3 : 0 }}>{l}</span>
        ))}
        <span className="text-base italic mt-1 mb-1" style={{ fontFamily: "Georgia, serif" }}>&amp;</span>
        {["D","O","T","S","."].map((l, i) => (
          <span key={i} className="text-sm font-bold leading-[1.3]" style={{ marginLeft: i === 1 ? 3 : 0 }}>{l}</span>
        ))}
      </div>

      <div className="w-full max-w-sm relative z-10">
        <div className="rounded-2xl p-8 shadow-2xl" style={{ background: "#ffffff" }}>
          <div className="text-center mb-8">
            <div className="flex justify-center mb-5">
              <img src="/knots-dots-logo.png" alt="Knots & Dots" style={{ height: 36, width: "auto" }} />
            </div>
            <h1 className="mb-1" style={{ fontSize: 28, fontWeight: 800, color: "#0a0f3c", letterSpacing: "-0.5px", lineHeight: 1.1 }}>
              Groundwork
            </h1>
            <p style={{ fontSize: 11, color: "#8e90a6", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", marginTop: 6 }}>
              Competitive Intelligence Platform
            </p>
          </div>

          <form onSubmit={handleLogin}>
            <div className="mb-4">
              <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#5a5e7a", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                style={{ width: "100%", padding: "10px 14px", background: "#f5f4f0", border: "1px solid #ddd9d0", borderRadius: 8, fontSize: 14, color: "#0a0f3c", outline: "none", boxSizing: "border-box" }}
                placeholder="you@company.com" required />
            </div>
            <div className="mb-6">
              <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#5a5e7a", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                style={{ width: "100%", padding: "10px 14px", background: "#f5f4f0", border: "1px solid #ddd9d0", borderRadius: 8, fontSize: 14, color: "#0a0f3c", outline: "none", boxSizing: "border-box" }}
                placeholder="••••••••" required />
            </div>
            {error && <p style={{ color: "#e53e3e", fontSize: 13, marginBottom: 16 }}>{error}</p>}
            <button type="submit" disabled={loading}
              style={{ width: "100%", background: "#0019FF", color: "#fff", padding: "11px", borderRadius: 8, fontSize: 14, fontWeight: 700, border: "none", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1, letterSpacing: "0.02em" }}>
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <div style={{ marginTop: 28, paddingTop: 20, borderTop: "1px solid #efeee9", textAlign: "center" }}>
            <p style={{ fontSize: 11, color: "#8e90a6", lineHeight: 1.6 }}>A Knots & Dots product</p>
            <p style={{ fontSize: 10, color: "#b0b2c0", marginTop: 2 }}>Version 2.5 · © 2026 Knots & Dots</p>
          </div>
        </div>
      </div>
    </div>
  );
}
