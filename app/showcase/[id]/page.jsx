"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import AuthGuard from "@/components/AuthGuard";

export default function SharedShowcasePage() {
  const { id } = useParams();
  const router = useRouter();
  const [showcase, setShowcase] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.from("saved_showcases").select("*").eq("id", id).single();
      setShowcase(data);
      setLoading(false);
    })();
  }, [id]);

  if (loading) return (
    <AuthGuard>
      <div className="min-h-screen flex items-center justify-center bg-black">
        <p className="text-white/50 text-sm">Loading showcase...</p>
      </div>
    </AuthGuard>
  );

  if (!showcase) return (
    <AuthGuard>
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center">
          <p className="text-white/50 text-lg mb-2">Showcase not found</p>
          <button onClick={() => router.push("/projects")} className="text-white/30 text-sm hover:text-white/60">
            Go to projects
          </button>
        </div>
      </div>
    </AuthGuard>
  );

  // Redirect to main showcase page with this showcase loaded
  // We use sessionStorage to pass the showcase data
  if (typeof window !== "undefined") {
    sessionStorage.setItem("shared-showcase", JSON.stringify(showcase));
    router.replace("/showcase?view=" + id);
  }

  return (
    <AuthGuard>
      <div className="min-h-screen flex items-center justify-center bg-black">
        <p className="text-white/50 text-sm">Opening showcase...</p>
      </div>
    </AuthGuard>
  );
}
