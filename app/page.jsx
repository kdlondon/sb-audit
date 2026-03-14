"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      router.replace(session ? "/audit" : "/login");
    })();
  }, [router]);
  return <div className="min-h-screen flex items-center justify-center"><p className="text-hint">Loading...</p></div>;
}
