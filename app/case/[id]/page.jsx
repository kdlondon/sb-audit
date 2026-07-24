"use client";
// A citation's destination. Report bodies cite pieces as [label](cite:ID); inside the app
// those open the side panel, but a DOWNLOADED report needs a real URL — so exports rewrite
// them to /case/<id> and this page is what the reader lands on.
//
// Auth-gated: a case is client evidence, not public. AuthGuard sends an anonymous reader to
// /login?next=/case/<id> and back here once signed in.
//
// The view itself is Creative Source's FullView — the same read-only entry screen the
// analyst already knows. One entry, one presentation, everywhere.
import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import AuthGuard from "@/components/AuthGuard";
import FullView from "@/components/creative-source/FullView";

const supabase = createClient();

function CaseContent() {
  const { id } = useParams();
  const router = useRouter();
  const params = useSearchParams();
  const [entry, setEntry] = useState(null);
  const [state, setState] = useState("loading"); // loading | ready | missing | error
  const [downloading, setDownloading] = useState(false);
  const holder = useRef(null);

  // Where the reader came from, when a report linked here.
  const fromReport = params.get("report") || "";

  useEffect(() => {
    if (!id) return;
    let alive = true;
    (async () => {
      // ids are text in some projects and numeric in others; match on the text form so a
      // link never dies on a type mismatch.
      const { data, error } = await supabase
        .from("creative_source").select("*").eq("id", String(id)).maybeSingle();
      if (!alive) return;
      if (error) { setState("error"); return; }
      if (!data) { setState("missing"); return; }
      setEntry(data);
      setState("ready");
    })();
    return () => { alive = false; };
  }, [id]);

  const back = () => {
    if (fromReport) router.push(`/reports?report=${encodeURIComponent(fromReport)}`);
    else if (window.history.length > 1) router.back();
    else router.push("/audit");
  };

  const downloadPdf = async () => {
    if (!holder.current || downloading) return;
    setDownloading(true);
    try {
      const html2pdf = (await import("html2pdf.js")).default;
      // The clone must carry .gw-shell or every custom property resolves to nothing and
      // the export comes out unstyled.
      const wrapper = document.createElement("div");
      wrapper.className = "gw-shell";
      wrapper.style.background = "#fff";
      wrapper.innerHTML = holder.current.innerHTML;
      document.body.appendChild(wrapper);
      const name = `${(entry?.description || entry?.competitor || "case").replace(/[^a-zA-Z0-9\s\-_]/g, "").replace(/\s+/g, "_").slice(0, 60)}.pdf`;
      await html2pdf(wrapper, {
        margin: [12, 12, 16, 12], filename: name,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["avoid-all", "css", "legacy"] },
      });
      document.body.removeChild(wrapper);
    } finally { setDownloading(false); }
  };

  if (state !== "ready") {
    const msg = state === "loading" ? "Loading case…"
      : state === "missing" ? "This case no longer exists, or you don't have access to it."
      : "Could not load this case.";
    return (
      <div className="gw-shell" style={{ minHeight: "100vh", background: "var(--paper)", display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
        <div style={{ textAlign: "center", maxWidth: 420 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: ".18em", color: "var(--accent-ember-deep)", marginBottom: 12 }}>CREATIVE SOURCE · CASE</div>
          <p style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "var(--text-secondary)", margin: "0 0 18px" }}>{msg}</p>
          {state !== "loading" && (
            <button onClick={back} className="gw-tbtn"
              style={{ background: "var(--brand-white)", border: "1px solid var(--border-hairline)", borderRadius: 9, padding: "9px 16px", cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-800)" }}>
              Go back
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div ref={holder}>
      <FullView
        entry={entry}
        onBack={back}
        onEdit={() => router.push(`/audit?edit=${entry.id}`)}
        onPdf={downloadPdf}
        downloading={downloading}
        index={0}
        total={0}
        scopeLabel={fromReport ? "Back to report" : entry.scope === "global" ? "Global benchmarks" : "Local audit"}
      />
    </div>
  );
}

export default function CasePage() {
  return (
    <AuthGuard>
      <Suspense fallback={null}>
        <CaseContent />
      </Suspense>
    </AuthGuard>
  );
}
