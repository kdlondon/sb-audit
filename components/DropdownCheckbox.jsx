"use client";
import { useState, useRef, useEffect } from "react";

/**
 * Smart multi-select component that auto-switches between chips and dropdown.
 * ≤5 options → visible chips (pill buttons)
 * >5 options → dropdown with checkboxes + selected tags below
 *
 * Props:
 *   options: string[] — available options
 *   selected: string[] — currently selected values
 *   onChange: (string[]) => void
 *   placeholder?: string
 *   allowOther?: boolean — shows "Other" with custom input
 *   onOtherAdded?: (string) => void — called when custom "Other" value is added
 *   singleChoice?: boolean — only allow one selection (dropdown/chips toggle one at a time)
 */
export default function DropdownCheckbox({
  options = [], selected = [], onChange, placeholder = "Select...",
  allowOther = false, onOtherAdded, singleChoice = false,
}) {
  const useChips = options.length <= 5;
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [otherInput, setOtherInput] = useState("");
  const [showOther, setShowOther] = useState(false);
  const dropRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (dropRef.current && !dropRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const toggle = (val) => {
    if (val === "__other__") {
      setShowOther(!showOther);
      return;
    }
    if (singleChoice) {
      onChange(selected.includes(val) ? [] : [val]);
    } else {
      onChange(selected.includes(val) ? selected.filter(v => v !== val) : [...selected, val]);
    }
  };

  const addOther = () => {
    const val = otherInput.trim();
    if (!val) return;
    if (!selected.includes(val)) onChange([...selected, val]);
    onOtherAdded?.(val);
    setOtherInput("");
    setShowOther(false);
  };

  const remove = (val) => onChange(selected.filter(v => v !== val));

  const filtered = search ? options.filter(o => o.toLowerCase().includes(search.toLowerCase())) : options;

  // ── CHIPS MODE (≤5 options) ──
  if (useChips) {
    return (
      <div>
        <div className="flex flex-wrap gap-1.5">
          {options.map(opt => (
            <button key={opt} type="button" onClick={() => toggle(opt)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition ${
                selected.includes(opt)
                  ? "bg-accent-soft border-accent text-accent"
                  : "bg-surface border-main text-muted hover:border-accent/40 hover:text-main"
              }`}>
              {opt}
            </button>
          ))}
          {allowOther && (
            <button type="button" onClick={() => setShowOther(!showOther)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition ${
                showOther ? "bg-yellow-50 border-yellow-400 text-yellow-700" : "bg-surface border-main text-muted hover:border-accent/40"
              }`}>
              Other
            </button>
          )}
        </div>
        {showOther && (
          <div className="flex gap-2 mt-2">
            <input value={otherInput} onChange={e => setOtherInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addOther()}
              placeholder="Type custom value..."
              className="flex-1 px-2.5 py-1.5 bg-surface border border-main rounded-lg text-xs text-main focus:outline-none focus:border-accent" autoFocus />
            <button type="button" onClick={addOther} className="px-2.5 py-1.5 bg-accent text-white rounded-lg text-xs font-semibold">Add</button>
          </div>
        )}
        {/* Show custom values not in options */}
        {selected.filter(v => !options.includes(v)).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {selected.filter(v => !options.includes(v)).map(v => (
              <span key={v} className="inline-flex items-center gap-1 bg-surface2 border border-main rounded-full pl-2 pr-1 py-0.5 text-[10px] text-main">
                {v}
                <button type="button" onClick={() => remove(v)} className="text-hint hover:text-red-500">×</button>
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── DROPDOWN MODE (>5 options) ──
  return (
    <div className="relative" ref={dropRef}>
      {/* Trigger button */}
      <button type="button" onClick={() => setOpen(!open)}
        className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-xs text-left flex justify-between items-center hover:border-accent/40 transition">
        <span className={selected.length > 0 ? "text-main" : "text-hint"}>
          {selected.length > 0 ? `${selected.length} selected` : placeholder}
        </span>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" className={`text-hint transition ${open ? "rotate-180" : ""}`}><path d="M2 4l3 3 3-3"/></svg>
      </button>

      {/* Selected tags */}
      {selected.length > 0 && !open && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {selected.map(v => (
            <span key={v} className="inline-flex items-center gap-1 bg-accent-soft border border-accent/20 rounded-full pl-2 pr-1 py-0.5 text-[10px] text-accent font-medium">
              {v}
              <button type="button" onClick={(e) => { e.stopPropagation(); remove(v); }} className="text-accent/50 hover:text-red-500">×</button>
            </span>
          ))}
        </div>
      )}

      {/* Dropdown panel */}
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-surface border border-main rounded-xl shadow-xl max-h-64 overflow-hidden" style={{ minWidth: 220 }}>
          {/* Search (only if >10 options) */}
          {options.length > 10 && (
            <div className="p-2 border-b border-main">
              <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..."
                className="w-full px-2.5 py-1.5 text-xs bg-surface2 rounded-lg text-main placeholder:text-hint focus:outline-none" />
            </div>
          )}
          <div className="overflow-auto max-h-48 py-1">
            {filtered.map(opt => (
              <label key={opt} className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-accent-soft transition cursor-pointer">
                <input type="checkbox" checked={selected.includes(opt)} onChange={() => toggle(opt)}
                  className="w-3.5 h-3.5 rounded border-main text-accent focus:ring-accent/30" />
                <span className="text-xs text-main">{opt}</span>
              </label>
            ))}
            {filtered.length === 0 && <p className="px-3 py-2 text-xs text-hint">No matches</p>}
            {allowOther && (
              <>
                <div className="border-t border-main my-1" />
                <label className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-accent-soft transition cursor-pointer"
                  onClick={(e) => { e.preventDefault(); setShowOther(!showOther); }}>
                  <span className="text-xs text-accent font-medium">+ Other</span>
                </label>
              </>
            )}
          </div>
          {showOther && (
            <div className="p-2 border-t border-main flex gap-2">
              <input value={otherInput} onChange={e => setOtherInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addOther()}
                placeholder="Custom value..."
                className="flex-1 px-2.5 py-1.5 text-xs bg-surface2 rounded-lg text-main focus:outline-none" autoFocus />
              <button type="button" onClick={addOther} className="px-2.5 py-1.5 bg-accent text-white rounded-lg text-xs font-semibold">Add</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Star rating component.
 * Props: value (string "1"-"5"), onChange (string => void)
 */
export function StarRating({ value, onChange }) {
  const rating = parseInt(value) || 0;
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button" onClick={() => onChange(String(n))}
          className={`text-lg transition ${n <= rating ? "text-yellow-400" : "text-gray-200 hover:text-yellow-200"}`}>
          ★
        </button>
      ))}
      {rating > 0 && (
        <button type="button" onClick={() => onChange("")} className="text-[10px] text-hint hover:text-muted ml-1">clear</button>
      )}
    </div>
  );
}
