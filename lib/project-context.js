"use client";
import { createContext, useContext, useState, useEffect } from "react";

const ProjectContext = createContext(null);

export function ProjectProvider({ children }) {
  const [projectId, setProjectId] = useState(null);
  const [projectName, setProjectName] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("sb-project-id");
    const savedName = localStorage.getItem("sb-project-name");
    if (saved) { setProjectId(saved); setProjectName(savedName || ""); }
    setReady(true);
  }, []);

  const selectProject = (id, name) => {
    setProjectId(id); setProjectName(name);
    localStorage.setItem("sb-project-id", id);
    localStorage.setItem("sb-project-name", name);
  };

  const clearProject = () => {
    setProjectId(null); setProjectName("");
    localStorage.removeItem("sb-project-id");
    localStorage.removeItem("sb-project-name");
  };

  return (
    <ProjectContext.Provider value={{ projectId, projectName, selectProject, clearProject, ready }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() { return useContext(ProjectContext); }
