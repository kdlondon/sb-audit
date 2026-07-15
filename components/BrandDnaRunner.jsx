"use client";
// Background Brand DNA queue runner + global progress pill. Mounted inside Nav, so it
// lives on every page: the analyst keeps working while profiles generate, and the queue
// RESUMES automatically after an interruption (pending rows persist in project_brands).
//
// Lifecycle per row: pending → generating → generated | failed. Rows stuck in
// "generating" for >10 min (killed tab) are treated as pending again.
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { useProject } from "@/lib/project-context";

const STALE_MS = 10 * 60 * 1000;

export default function BrandDnaRunner() {
  const router = useRouter();
  const { projectId } = useProject() || {};
  const [progress, setProgress] = useState(null); // { done, total, current } | null
  const [flash, setFlash] = useState("");         // completion toast
  const runningRef = useRef(false);

  const fetchQueue = useCallback(async () => {
    if (!projectId) return [];
    try {
      const supabase = createClient();
      const { data } = await supabase.from("project_brands")
        .select("id,name,website,brand_dna_status,updated_at")
        .eq("project_id", projectId).eq("archived", false).not("website", "is", null);
      const now = Date.now();
      return (data || []).filter((r) => r.website && (
        r.brand_dna_status === "pending" ||
        (r.brand_dna_status === "generating" && now - new Date(r.updated_at).getTime() > STALE_MS)
      ));
    } catch { return []; }
  }, [projectId]);

  const run = useCallback(async () => {
    if (runningRef.current || !projectId) return;
    const queue = await fetchQueue();
    if (!queue.length) return;
    runningRef.current = true;
    const supabase = createClient();
    const total = queue.length;
    let done = 0;
    for (const row of queue) {
      // Re-check right before running (another tab may have taken it)
      const { data: fresh } = await supabase.from("project_brands").select("brand_dna_status,updated_at").eq("id", row.id).single();
      const stale = fresh?.brand_dna_status === "generating" && Date.now() - new Date(fresh.updated_at).getTime() > STALE_MS;
      if (fresh && fresh.brand_dna_status !== "pending" && !stale) { done++; setProgress({ done, total, current: "" }); continue; }
      setProgress({ done, total, current: row.name });
      await supabase.from("project_brands").update({ brand_dna_status: "generating", updated_at: new Date().toISOString() }).eq("id", row.id);
      let ok = false;
      try {
        const res = await fetch("/api/intelligence/brand-dna", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ project_id: projectId, brand: row.name, url: row.website }) });
        const d = await res.json();
        ok = !d?.error;
      } catch {}
      await supabase.from("project_brands").update({ brand_dna_status: ok ? "generated" : "failed", updated_at: new Date().toISOString() }).eq("id", row.id);
      done++;
      setProgress({ done, total, current: "" });
    }
    runningRef.current = false;
    setProgress(null);
    setFlash(`✓ Brand profiles ready (${total})`);
    setTimeout(() => setFlash(""), 8000);
  }, [projectId, fetchQueue]);

  // Kick off on mount / project switch, then poll for new pending rows.
  useEffect(() => {
    if (!projectId) return;
    run();
    const t = setInterval(run, 30000);
    return () => clearInterval(t);
  }, [projectId, run]);

  if (!progress && !flash) return null;
  return (
    <button
      onClick={() => router.push("/intelligence?tab=brands")}
      className="fixed bottom-5 right-5 flex items-center gap-2.5 pl-3 pr-4 py-2.5 rounded-full shadow-2xl text-xs font-medium text-white"
      style={{ background: "#000", zIndex: 9990 }}
      title="View brand profiles"
    >
      {progress ? (
        <>
          <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
          <span>Brand profiles {progress.done}/{progress.total}{progress.current ? ` · ${progress.current}` : ""}</span>
        </>
      ) : (
        <span>{flash}</span>
      )}
    </button>
  );
}
