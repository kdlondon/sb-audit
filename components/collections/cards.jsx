"use client";
// Small presentational pieces shared by the collection card grids (the Creative Source
// list today, the Intelligence workspace as Collections moves there).

// A collection card's 2×2 mosaic of member pieces. Real thumbnails where we have them,
// warm ink/ember tiles where we don't — so a card always reads as a set.
export function Mosaic({ thumbs = [], half = 52 }) {
  const tones = ["var(--ink-700,#3a3a3a)", "var(--accent-ember,#DF5C29)", "var(--ink-300,#d8d2c8)", "var(--ink-500,#8a8a8a)"];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: `${half}px ${half}px`, gap: 2, background: "#efe9e1" }}>
      {[0, 1, 2, 3].map(i => {
        const t = thumbs[i];
        return t
          ? <img key={i} src={t} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => { e.currentTarget.style.display = "none"; }} />
          : <div key={i} style={{ background: tones[i % 4] }} />;
      })}
    </div>
  );
}

// The overlapping brand initials on a suggestion card's footer.
export function BrandAvatars({ brands = [] }) {
  const tones = ["var(--ink-200,#e2ddd4)", "#d8d2c8", "#cfc7bc", "#c4bbaf", "#b9afa2"];
  const shown = brands.slice(0, 4);
  return (
    <div className="flex items-center">
      {shown.map((b, i) => (
        <span key={i} title={b} style={{ background: tones[i % tones.length], marginLeft: i ? -6 : 0, border: "1.5px solid #fff" }} className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-semibold text-[var(--text2,#666)] flex-none">{String(b).charAt(0).toUpperCase()}</span>
      ))}
      {brands.length > 4 && <span className="ml-2 text-[9.5px] text-hint">+{brands.length - 4} more</span>}
    </div>
  );
}
