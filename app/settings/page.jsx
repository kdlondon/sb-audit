"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { CATEGORY_LABELS } from "@/lib/options";
import AuthGuard from "@/components/AuthGuard";
import Nav from "@/components/Nav";
import ProjectGuard from "@/components/ProjectGuard";
import { useProject } from "@/lib/project-context";

function SettingsContent() {
  const { projectId } = useProject();
  const [options, setOptions] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState(null);
  const [newValue, setNewValue] = useState("");
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  const load = useCallback(async () => {
    const { data } = await supabase.from("dropdown_options").select("*").eq("project_id", projectId).order("sort_order", { ascending: true });
    if (data) {
      const grouped = {};
      data.forEach(row => {
        if (!grouped[row.category]) grouped[row.category] = [];
        grouped[row.category].push({ id: row.id, value: row.value, sort_order: row.sort_order });
      });
      setOptions(grouped);
      if (!activeCategory && Object.keys(grouped).length > 0) {
        setActiveCategory(Object.keys(grouped)[0]);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const addValue = async () => {
    if (!newValue.trim() || !activeCategory) return;
    setSaving(true);
    const currentItems = options[activeCategory] || [];
    const maxOrder = currentItems.length > 0 ? Math.max(...currentItems.map(i => i.sort_order)) : -1;
    await supabase.from("dropdown_options").insert({ project_id: projectId,
      category: activeCategory,
      value: newValue.trim(),
      sort_order: maxOrder + 1,
    });
    setNewValue("");
    await load();
    setSaving(false);
  };

  const removeValue = async (id) => {
    if (!confirm("Remove this option?")) return;
    await supabase.from("dropdown_options").delete().eq("id", id);
    await load();
  };

  const moveUp = async (item, index) => {
    const items = options[activeCategory];
    if (index === 0) return;
    const prev = items[index - 1];
    await supabase.from("dropdown_options").update({ sort_order: prev.sort_order }).eq("id", item.id);
    await supabase.from("dropdown_options").update({ sort_order: item.sort_order }).eq("id", prev.id);
    await load();
  };

  const moveDown = async (item, index) => {
    const items = options[activeCategory];
    if (index === items.length - 1) return;
    const next = items[index + 1];
    await supabase.from("dropdown_options").update({ sort_order: next.sort_order }).eq("id", item.id);
    await supabase.from("dropdown_options").update({ sort_order: item.sort_order }).eq("id", next.id);
    await load();
  };

  const categories = Object.keys(CATEGORY_LABELS);

  if (loading) return <div className="p-10 text-center text-hint">Loading settings...</div>;

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <div className="bg-surface border-b border-main px-5 py-3">
        <h2 className="text-lg font-bold text-main">Settings</h2>
        <p className="text-xs text-muted">Manage dropdown values across the application</p>
      </div>

      <div className="flex" style={{ height: "calc(100vh - 90px)" }}>
        {/* Left: Category list */}
        <div className="w-[240px] border-r border-main bg-surface overflow-auto">
          <div className="p-2">
            {categories.map(cat => {
              const count = (options[cat] || []).length;
              return (
                <button key={cat} onClick={() => { setActiveCategory(cat); setNewValue(""); }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm mb-0.5 transition flex justify-between items-center ${
                    activeCategory === cat ? "bg-accent-soft text-accent font-medium" : "text-main hover:bg-surface2"
                  }`}>
                  <span>{CATEGORY_LABELS[cat]}</span>
                  <span className="text-[10px] text-hint">{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Values editor */}
        <div className="flex-1 overflow-auto">
          {activeCategory ? (
            <div className="p-5 max-w-xl">
              <h3 className="text-base font-bold text-main mb-1">{CATEGORY_LABELS[activeCategory]}</h3>
              <p className="text-xs text-muted mb-4">
                {(options[activeCategory] || []).length} values. These appear as dropdown options in the audit form.
              </p>

              {/* Add new */}
              <div className="flex gap-2 mb-4">
                <input value={newValue} onChange={e => setNewValue(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addValue()}
                  placeholder="Add new value..."
                  className="flex-1 px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[var(--accent)]" />
                <button onClick={addValue} disabled={!newValue.trim() || saving}
                  className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50">
                  Add
                </button>
              </div>

              {/* Values list */}
              <div className="space-y-1">
                {(options[activeCategory] || []).map((item, i) => (
                  <div key={item.id}
                    className="flex items-center gap-2 px-3 py-2 bg-surface border border-main rounded-lg group">
                    <span className="flex-1 text-sm text-main">{item.value}</span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                      <button onClick={() => moveUp(item, i)} disabled={i === 0}
                        className="text-xs text-muted hover:text-main disabled:opacity-30 px-1">↑</button>
                      <button onClick={() => moveDown(item, i)} disabled={i === (options[activeCategory] || []).length - 1}
                        className="text-xs text-muted hover:text-main disabled:opacity-30 px-1">↓</button>
                      <button onClick={() => removeValue(item.id)}
                        className="text-xs text-red-400 hover:text-red-600 px-1">×</button>
                    </div>
                  </div>
                ))}
              </div>

              {(options[activeCategory] || []).length === 0 && (
                <p className="text-sm text-hint text-center py-8">No values yet. Add one above.</p>
              )}
            </div>
          ) : (
            <div className="p-10 text-center text-hint">Select a category from the left</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return <AuthGuard><ProjectGuard><Nav /><SettingsContent /></ProjectGuard></AuthGuard>;
}
