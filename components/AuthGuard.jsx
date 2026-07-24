"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

export default function AuthGuard({ children }) {
  const [ok, setOk] = useState(false);
  const router = useRouter();
  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // Keep where the user was heading — a case link shared in a deliverable must land
        // on that case after login, not on the project picker.
        const here = window.location.pathname + window.location.search;
        const next = here && here !== "/" ? `?next=${encodeURIComponent(here)}` : "";
        router.replace(`/login${next}`);
        return;
      }
      setOk(true);
    })();
  }, [router]);
  if (!ok) return <div className="min-h-screen flex items-center justify-center"><p className="text-hint">Loading...</p></div>;
  return children;
}
