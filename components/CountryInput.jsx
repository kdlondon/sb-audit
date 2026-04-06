"use client";
import { useState, useEffect, useRef } from "react";

const COUNTRIES = [
  "Afghanistan","Albania","Algeria","Angola","Argentina","Armenia","Australia",
  "Austria","Azerbaijan","Bahrain","Bangladesh","Belarus","Belgium","Bolivia",
  "Bosnia and Herzegovina","Brazil","Bulgaria","Cambodia","Cameroon","Canada",
  "Chile","China","Colombia","Congo","Costa Rica","Croatia","Cuba","Czech Republic",
  "Denmark","Dominican Republic","Ecuador","Egypt","El Salvador","Estonia",
  "Ethiopia","Finland","France","Georgia","Germany","Ghana","Greece","Guatemala",
  "Honduras","Hong Kong","Hungary","India","Indonesia","Iran","Iraq","Ireland",
  "Israel","Italy","Ivory Coast","Jamaica","Japan","Jordan","Kazakhstan","Kenya",
  "Kuwait","Latvia","Lebanon","Libya","Lithuania","Luxembourg","Malaysia","Mexico",
  "Moldova","Morocco","Mozambique","Myanmar","Netherlands","New Zealand","Nigeria",
  "Norway","Pakistan","Panama","Paraguay","Peru","Philippines","Poland","Portugal",
  "Qatar","Romania","Russia","Saudi Arabia","Senegal","Serbia","Singapore",
  "Slovakia","South Africa","South Korea","Spain","Sri Lanka","Sweden","Switzerland",
  "Taiwan","Tanzania","Thailand","Tunisia","Turkey","Ukraine","United Arab Emirates",
  "United Kingdom","United States","Uruguay","Uzbekistan","Venezuela","Vietnam",
  "Zimbabwe"
];

export { COUNTRIES };

export default function CountryInput({ value, onChange, placeholder }) {
  const [query, setQuery] = useState(value || "");
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => { setQuery(value || ""); }, [value]);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = query.length > 0
    ? COUNTRIES.filter(c => c.toLowerCase().startsWith(query.toLowerCase())).slice(0, 8)
    : [];

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <input
        value={query}
        onChange={e => { setQuery(e.target.value); onChange(e.target.value); setOpen(true); }}
        onFocus={() => { if (query.length > 0) setOpen(true); }}
        placeholder={placeholder || "Type to search..."}
        className="w-full px-2.5 py-1.5 bg-surface border border-main rounded-lg text-xs text-main focus:outline-none focus:border-accent"
      />
      {open && filtered.length > 0 && (
        <div className="absolute left-0 right-0 bg-surface border border-main rounded-lg shadow-lg overflow-hidden" style={{ top: "100%", marginTop: 2, zIndex: 9999, maxHeight: 200, overflowY: "auto" }}>
          {filtered.map(c => (
            <button key={c} type="button" onMouseDown={() => { setQuery(c); onChange(c); setOpen(false); }}
              className="w-full text-left px-3 py-1.5 text-xs text-main hover:bg-accent-soft transition">
              {c}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
