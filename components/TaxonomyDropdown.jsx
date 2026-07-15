"use client";
// Taxonomy-driven dropdown with an inline "Other → add new term" flow.
// Extracted from app/settings/page.jsx so the Landscape registry (and any other
// module) shares the same category / sub-category behavior.
import { useState } from "react";

export default function TaxonomyDropdown({ label, value, options, onChange, onAddOther, placeholder }) {
  const [showOther, setShowOther] = useState(false);
  const [otherVal, setOtherVal] = useState("");

  return (
    <div>
      {label && <label className="block text-[10px] text-muted uppercase font-semibold mb-1">{label}</label>}
      <select
        value={value || ""}
        onChange={(e) => {
          if (e.target.value === "__other__") {
            setShowOther(true);
          } else {
            setShowOther(false);
            onChange(e.target.value);
          }
        }}
        className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[var(--accent)]"
      >
        <option value="">{placeholder || "-- Select --"}</option>
        {options.map((o) => (
          <option key={typeof o === "string" ? o : o.name} value={typeof o === "string" ? o : o.name}>
            {typeof o === "string" ? o : o.name}
          </option>
        ))}
        <option value="__other__">- Other</option>
      </select>
      {showOther && (
        <div className="flex gap-2 mt-1">
          <input
            value={otherVal}
            onChange={(e) => setOtherVal(e.target.value)}
            placeholder="Type new value..."
            className="flex-1 px-2 py-1.5 border border-accent rounded-lg text-xs bg-accent-soft text-main focus:outline-none"
            autoFocus
          />
          <button
            onClick={() => {
              if (otherVal.trim()) {
                onAddOther(otherVal.trim());
                onChange(otherVal.trim());
                setOtherVal("");
                setShowOther(false);
              }
            }}
            className="px-3 py-1.5 bg-accent text-white rounded-lg text-xs font-semibold"
          >
            Add
          </button>
          <button
            onClick={() => { setShowOther(false); setOtherVal(""); }}
            className="px-2 py-1.5 border border-main rounded-lg text-xs text-muted"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
