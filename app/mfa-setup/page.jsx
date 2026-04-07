"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import AuthGuard from "@/components/AuthGuard";
import Nav from "@/components/Nav";

export default function MfaSetupPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [emailMfaEnabled, setEmailMfaEnabled] = useState(false);
  const [userEmail, setUserEmail] = useState("");

  // TOTP enrollment
  const [enrolling, setEnrolling] = useState(false);
  const [qrCode, setQrCode] = useState(null);
  const [secret, setSecret] = useState(null);
  const [factorId, setFactorId] = useState(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [toast, setToast] = useState("");

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/login"); return; }

      setUserEmail(session.user.email);
      setEmailMfaEnabled(session.user.user_metadata?.mfa_email_enabled || false);

      // Check TOTP factors
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const verified = factors?.totp?.find(f => f.status === "verified");
      setTotpEnabled(!!verified);
      if (verified) setFactorId(verified.id);

      setLoading(false);
    })();
  }, []);

  // ── TOTP Setup ──
  const startTotpEnroll = async () => {
    setEnrolling(true); setError("");
    const { data, error: err } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Groundwork Authenticator" });
    if (err) { setError(err.message); setEnrolling(false); return; }
    setQrCode(data.totp.qr_code);
    setSecret(data.totp.secret);
    setFactorId(data.id);
  };

  const verifyTotpEnroll = async (e) => {
    e.preventDefault();
    setError("");
    const { data: challenge } = await supabase.auth.mfa.challenge({ factorId });
    if (!challenge) { setError("Challenge failed"); return; }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId, challengeId: challenge.id, code: verifyCode,
    });

    if (verifyError) { setError("Invalid code. Try again."); setVerifyCode(""); return; }

    setTotpEnabled(true);
    setEnrolling(false);
    setQrCode(null);
    showToast("Authenticator app enabled successfully");
  };

  const disableTotp = async () => {
    if (!confirm("Disable authenticator app? You'll only use password to login.")) return;
    if (factorId) {
      await supabase.auth.mfa.unenroll({ factorId });
    }
    setTotpEnabled(false);
    setFactorId(null);
    showToast("Authenticator app disabled");
  };

  // ── Email MFA ──
  const toggleEmailMfa = async () => {
    const next = !emailMfaEnabled;
    const { error: err } = await supabase.auth.updateUser({
      data: { mfa_email_enabled: next },
    });
    if (err) { setError(err.message); return; }
    setEmailMfaEnabled(next);
    showToast(next ? "Email verification enabled" : "Email verification disabled");
  };

  if (loading) return <AuthGuard><Nav /><div className="p-10 text-center text-hint">Loading...</div></AuthGuard>;

  return (
    <AuthGuard>
      <Nav />
      <div className="min-h-screen" style={{ background: "var(--bg)" }}>
        <div className="section-bar px-5 py-3">
          <h2 className="text-lg font-bold text-white">Security Settings</h2>
          <p className="text-xs text-white/60">Manage two-factor authentication for your account</p>
        </div>

        <div className="max-w-xl mx-auto p-6 space-y-6">
          {/* Account info */}
          <div className="bg-surface border border-main rounded-xl p-5">
            <p className="text-xs text-muted">Signed in as</p>
            <p className="text-sm font-semibold text-main">{userEmail}</p>
          </div>

          {/* TOTP / Google Authenticator */}
          <div className="bg-surface border border-main rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-main">Authenticator App</h3>
                <p className="text-xs text-muted mt-0.5">Google Authenticator, Authy, or similar</p>
              </div>
              {totpEnabled ? (
                <span className="text-xs font-semibold text-green-600 bg-green-50 px-2.5 py-1 rounded-full">Enabled</span>
              ) : (
                <span className="text-xs font-semibold text-hint bg-surface2 px-2.5 py-1 rounded-full">Disabled</span>
              )}
            </div>

            {!totpEnabled && !enrolling && (
              <button onClick={startTotpEnroll}
                className="px-4 py-2 text-xs font-semibold text-white rounded-lg" style={{ background: "#0019FF" }}>
                Set up authenticator
              </button>
            )}

            {totpEnabled && !enrolling && (
              <button onClick={disableTotp}
                className="px-4 py-2 text-xs font-semibold text-red-500 border border-red-200 rounded-lg hover:bg-red-50">
                Disable
              </button>
            )}

            {enrolling && qrCode && (
              <div className="mt-4 space-y-4">
                <p className="text-xs text-muted">Scan this QR code with your authenticator app:</p>
                <div className="flex justify-center">
                  <img src={qrCode} alt="QR Code" className="w-48 h-48 rounded-lg border border-main" />
                </div>
                <div className="bg-surface2 rounded-lg p-3">
                  <p className="text-[10px] text-hint uppercase font-semibold mb-1">Manual entry code</p>
                  <p className="text-xs font-mono text-main select-all break-all">{secret}</p>
                </div>
                <form onSubmit={verifyTotpEnroll} className="flex gap-2">
                  <input type="text" inputMode="numeric" maxLength={6} value={verifyCode}
                    onChange={e => setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="Enter 6-digit code"
                    className="flex-1 px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main text-center tracking-widest font-mono focus:outline-none focus:border-accent" autoFocus />
                  <button type="submit" disabled={verifyCode.length !== 6}
                    className="px-4 py-2 text-xs font-semibold text-white rounded-lg disabled:opacity-40" style={{ background: "#0019FF" }}>
                    Verify
                  </button>
                </form>
                <button onClick={() => { setEnrolling(false); setQrCode(null); }}
                  className="text-xs text-muted hover:text-main">Cancel</button>
              </div>
            )}
          </div>

          {/* Email MFA */}
          <div className="bg-surface border border-main rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-main">Email Verification</h3>
                <p className="text-xs text-muted mt-0.5">Receive a 6-digit code by email on each login</p>
              </div>
              {emailMfaEnabled ? (
                <span className="text-xs font-semibold text-green-600 bg-green-50 px-2.5 py-1 rounded-full">Enabled</span>
              ) : (
                <span className="text-xs font-semibold text-hint bg-surface2 px-2.5 py-1 rounded-full">Disabled</span>
              )}
            </div>
            <button onClick={toggleEmailMfa}
              className={`px-4 py-2 text-xs font-semibold rounded-lg ${
                emailMfaEnabled
                  ? "text-red-500 border border-red-200 hover:bg-red-50"
                  : "text-white"
              }`} style={!emailMfaEnabled ? { background: "#0019FF" } : {}}>
              {emailMfaEnabled ? "Disable" : "Enable email verification"}
            </button>
          </div>

          {/* Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-xs text-blue-700">
              <strong>Recommendation:</strong> Use the Authenticator App for the strongest security.
              Email verification is a good alternative if you don't want to install an app.
              You can enable both — the authenticator app takes priority.
            </p>
          </div>

          {error && <p className="text-sm text-red-500 text-center">{error}</p>}
        </div>

        {/* Toast */}
        {toast && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-main text-white px-5 py-2.5 rounded-xl text-sm font-medium shadow-xl animate-fadeIn" style={{ zIndex: 99999 }}>
            {toast}
          </div>
        )}
      </div>
    </AuthGuard>
  );
}
