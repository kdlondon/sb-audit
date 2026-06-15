"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase";
import { useRole } from "@/lib/role-context";
import Nav from "@/components/Nav";
import AuthGuard from "@/components/AuthGuard";

const ROLE_LABELS = { full_admin: "Admin", platform_admin: "Platform Admin", org_admin: "Admin", analyst: "Analyst", client: "Client", viewer: "Viewer" };

function Row({ label, value }) {
  return (
    <div className="flex justify-between items-center py-2.5 border-b border-main last:border-0">
      <span className="text-xs text-muted">{label}</span>
      <span className="text-sm text-main font-medium">{value || "—"}</span>
    </div>
  );
}

export default function UserProfilePage() {
  const { userEmail, role, orgRole, activeOrg } = useRole() || {};
  const supabase = createClient();

  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null); // { type, text }

  const changePassword = async () => {
    setMsg(null);
    if (pw.length < 6) { setMsg({ type: "err", text: "Password must be at least 6 characters." }); return; }
    if (pw !== pw2) { setMsg({ type: "err", text: "Passwords don't match." }); return; }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setSaving(false);
    if (error) { setMsg({ type: "err", text: error.message }); return; }
    setPw(""); setPw2("");
    setMsg({ type: "ok", text: "Password updated." });
  };

  return (
    <AuthGuard>
      <Nav />
      <div className="min-h-screen" style={{ background: "var(--bg)" }}>
        <div className="max-w-2xl mx-auto p-8">
          <h1 className="text-2xl font-bold text-main mb-1">User profile</h1>
          <p className="text-sm text-muted mb-8">Your personal details and password.</p>

          <div className="space-y-5">
            {/* Details */}
            <div className="bg-surface border border-main rounded-xl p-5">
              <h2 className="text-sm font-bold text-main mb-3">Details</h2>
              <Row label="Email" value={userEmail} />
              <Row label="Role" value={ROLE_LABELS[orgRole] || ROLE_LABELS[role] || role} />
              <Row label="Organization" value={activeOrg?.name} />
            </div>

            {/* Change password */}
            <div className="bg-surface border border-main rounded-xl p-5">
              <h2 className="text-sm font-bold text-main mb-3">Change password</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] text-muted uppercase font-semibold mb-1">New password</label>
                  <input type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="Min 6 characters"
                    className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[var(--accent)]" />
                </div>
                <div>
                  <label className="block text-[10px] text-muted uppercase font-semibold mb-1">Confirm new password</label>
                  <input type="password" value={pw2} onChange={e => setPw2(e.target.value)} placeholder="Repeat password"
                    className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[var(--accent)]" />
                </div>
                {msg && <p className={`text-xs ${msg.type === "ok" ? "text-green-600" : "text-red-500"}`}>{msg.text}</p>}
                <button onClick={changePassword} disabled={saving || !pw || !pw2}
                  className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50">
                  {saving ? "Saving..." : "Update password"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
