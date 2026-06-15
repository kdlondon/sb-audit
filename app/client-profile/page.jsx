"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { useRole } from "@/lib/role-context";
import Nav from "@/components/Nav";
import AuthGuard from "@/components/AuthGuard";

function Row({ label, value }) {
  return (
    <div className="flex justify-between items-center py-2.5 border-b border-main last:border-0">
      <span className="text-xs text-muted">{label}</span>
      <span className="text-sm text-main font-medium">{value || "—"}</span>
    </div>
  );
}

export default function ClientProfilePage() {
  const { activeOrg } = useRole() || {};
  const supabase = createClient();
  const [org, setOrg] = useState(null);
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeOrg?.id) return;
    (async () => {
      const [{ data: o }, { data: c }] = await Promise.all([
        supabase.from("organizations").select("*").eq("id", activeOrg.id).single(),
        supabase.from("clients").select("*").eq("organization_id", activeOrg.id).maybeSingle(),
      ]);
      setOrg(o || null);
      setClient(c || null);
      setLoading(false);
    })();
  }, [activeOrg?.id]);

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";

  return (
    <AuthGuard>
      <Nav />
      <div className="min-h-screen" style={{ background: "var(--bg)" }}>
        <div className="max-w-2xl mx-auto p-8">
          <h1 className="text-2xl font-bold text-main mb-1">Client profile</h1>
          <p className="text-sm text-muted mb-8">Your organization's account and plan.</p>

          {loading ? (
            <p className="text-hint text-center py-20">Loading...</p>
          ) : (
            <div className="space-y-5">
              {/* Account */}
              <div className="bg-surface border border-main rounded-xl p-5">
                <h2 className="text-sm font-bold text-main mb-3">Account</h2>
                <Row label="Organization" value={org?.name || activeOrg?.name} />
                <Row label="Type" value={org?.type} />
                <Row label="Status" value={org?.status} />
                <Row label="Industry" value={client?.industry} />
                <Row label="Country" value={client?.country} />
                <Row label="Website" value={client?.website} />
                <Row label="Company size" value={client?.company_size} />
              </div>

              {/* Plan */}
              <div className="bg-surface border border-main rounded-xl p-5">
                <h2 className="text-sm font-bold text-main mb-3">Plan</h2>
                <Row label="Plan" value={org?.plan || client?.tier} />
                <Row label="Tier" value={client?.tier} />
                <Row label="Monthly value" value={client?.monthly_value ? `$${Number(client.monthly_value).toLocaleString()}` : "—"} />
                <Row label="Contract start" value={fmtDate(client?.contract_start)} />
                <Row label="Contract end" value={fmtDate(client?.contract_end)} />
              </div>

              {/* Contact */}
              <div className="bg-surface border border-main rounded-xl p-5">
                <h2 className="text-sm font-bold text-main mb-3">Primary contact</h2>
                <Row label="Name" value={client?.primary_contact_name} />
                <Row label="Email" value={client?.primary_contact_email} />
              </div>

              <p className="text-[11px] text-hint text-center">Need a change to your plan or details? Contact your Knots & Dots admin.</p>
            </div>
          )}
        </div>
      </div>
    </AuthGuard>
  );
}
