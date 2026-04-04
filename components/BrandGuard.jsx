"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useBrand } from "@/lib/brand-context";
export default function BrandGuard({ children }) {
  const { brandId, ready } = useBrand();
  const router = useRouter();
  useEffect(() => {
    if (ready && !brandId) router.replace("/dashboard");
  }, [ready, brandId, router]);
  if (!ready || !brandId) return <div className="min-h-screen flex items-center justify-center"><p className="text-hint">Loading...</p></div>;
  return children;
}
