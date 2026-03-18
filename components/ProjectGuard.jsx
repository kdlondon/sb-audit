"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useProject } from "@/lib/project-context";
export default function ProjectGuard({ children }) {
  const { projectId, ready } = useProject();
  const router = useRouter();
  useEffect(() => {
    if (ready && !projectId) router.replace("/projects");
  }, [ready, projectId, router]);
  if (!ready || !projectId) return <div className="min-h-screen flex items-center justify-center"><p className="text-hint">Loading...</p></div>;
  return children;
}
