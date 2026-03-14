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
      if (!session) { router.replace("/login"); return; }
      setOk(true);
    })();
  }, [router]);
  if (!ok) return <div className="min-h-screen flex items-center justify-center"><p className="text-hint">Loading...</p></div>;
  return children;
}
