"use client";
// KD Product Charts — canonical product-UI chart primitives, replicated 1:1 from the
// design system's "KD Product Charts.html" (content, markup and design unchanged).
// Base tokens (--kd-paper, --accent-*, --p-stone/-sand, --q1/2/3, --data-track) come from
// globals.css; the local tokens below mirror the source file. The Groundwork/Sounding toggle
// re-themes only this page's root (#kd-charts-root), not the whole app.

const CSS = `
.kd-charts-page{
  --ink:#161413; --cream:#FFF7F0;
  --line:rgba(22,20,19,.10); --line-soft:rgba(22,20,19,.06);
  --p-ember: oklch(0.902 0.055 44);
  --d-ember: oklch(0.62 0.150 44);
  background:#e9e7e4; min-height:100vh; font-family:var(--kd-sans); color:var(--ink); -webkit-font-smoothing:antialiased;
}
.kd-charts-page .frame{ max-width:1080px; margin:0 auto; background:var(--kd-paper); box-shadow:0 1px 4px rgba(0,0,0,.07),0 22px 64px rgba(0,0,0,.07); }
.kd-charts-page code{ font-family:var(--kd-mono); font-size:12px; background:#fff; border:1px solid var(--line); padding:1px 5px; border-radius:4px; }

.kd-charts-page .head{ background:var(--ink); color:var(--cream); padding:34px 44px 30px; }
.kd-charts-page .head .eyebrow{ font-family:var(--kd-mono); font-size:11px; letter-spacing:.12em; text-transform:uppercase; opacity:.6; }
.kd-charts-page .head h1{ font-weight:700; font-size:30px; letter-spacing:-.03em; margin:10px 0 0; }
.kd-charts-page .head h1 em{ font-family:var(--kd-serif); font-style:italic; font-weight:400; }
.kd-charts-page .head p{ margin:12px 0 0; font-size:14px; line-height:1.55; color:rgba(255,247,240,.82); max-width:680px; }
.kd-charts-page .head .switch{ margin-top:18px; display:flex; gap:8px; align-items:center; }
.kd-charts-page .head .switch .lab{ font-family:var(--kd-mono); font-size:10px; letter-spacing:.07em; text-transform:uppercase; color:rgba(255,247,240,.5); }
.kd-charts-page .head .switch button{ font-family:var(--kd-mono); font-size:11px; letter-spacing:.04em; padding:6px 14px; border-radius:13px; border:1px solid rgba(255,247,240,.2); background:transparent; color:rgba(255,247,240,.7); cursor:pointer; }
.kd-charts-page .head .switch button.on{ background:var(--accent-tint); color:var(--ink); border-color:transparent; font-weight:600; }

.kd-charts-page .body{ padding:36px 44px 48px; display:flex; flex-direction:column; gap:26px; }

.kd-charts-page .block{ border:1px solid var(--line); border-radius:16px; background:#fff; overflow:hidden; }
.kd-charts-page .block .bt{ display:flex; align-items:flex-start; justify-content:space-between; gap:20px; padding:20px 24px 0; }
.kd-charts-page .block .bt .l .n{ font-weight:700; font-size:17px; letter-spacing:-.02em; }
.kd-charts-page .block .bt .l .u{ font-size:13px; line-height:1.45; color:rgba(22,20,19,.66); margin-top:5px; max-width:520px; }
.kd-charts-page .block .bt .r{ font-family:var(--kd-mono); font-size:9px; letter-spacing:.07em; text-transform:uppercase; color:#fff; background:var(--d-stone); padding:5px 9px; border-radius:7px; flex:none; }
.kd-charts-page .block .bt .r.ok{ background:oklch(0.55 0.09 152); }
.kd-charts-page .block .demo{ padding:22px 24px 24px; }
.kd-charts-page .block .why{ font-family:var(--kd-mono); font-size:10px; letter-spacing:.04em; color:rgba(22,20,19,.5); padding:0 24px 18px; }
.kd-charts-page .block .why b{ color:var(--ink); }

.kd-charts-page .kpis{ display:grid; grid-template-columns:repeat(4,1fr); gap:12px; }
.kd-charts-page .kpi{ border-radius:14px; padding:18px 18px 16px; min-height:96px; display:flex; flex-direction:column; justify-content:space-between; border:1px solid rgba(0,0,0,.035); }
.kd-charts-page .kpi .l{ font-family:var(--kd-mono); font-size:9px; letter-spacing:.08em; text-transform:uppercase; color:rgba(22,20,19,.55); }
.kd-charts-page .kpi .v{ font-family:var(--kd-mono); font-size:32px; line-height:.9; letter-spacing:-.02em; color:var(--ink); }
.kd-charts-page .kpi .v small{ font-size:17px; color:rgba(22,20,19,.5); }
.kd-charts-page .kpi .d{ font-family:var(--kd-mono); font-size:9px; margin-top:3px; }

.kd-charts-page .bars{ display:flex; flex-direction:column; gap:12px; }
.kd-charts-page .brow{ display:grid; grid-template-columns:120px 1fr 44px; align-items:center; gap:12px; }
.kd-charts-page .brow .nm{ font-size:12.5px; font-weight:500; text-align:right; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.kd-charts-page .brow .tr{ height:13px; background:var(--data-track); border-radius:7px; overflow:hidden; }
.kd-charts-page .brow .fl{ height:13px; border-radius:7px; }
.kd-charts-page .brow .vl{ font-family:var(--kd-mono); font-size:11px; color:rgba(22,20,19,.6); text-align:right; }

.kd-charts-page .ringwrap{ display:flex; align-items:center; gap:26px; }
.kd-charts-page .ringwrap .meta .big{ font-weight:600; font-size:14px; letter-spacing:-.01em; }
.kd-charts-page .ringwrap .meta .sm{ font-size:12.5px; color:rgba(22,20,19,.62); margin-top:6px; line-height:1.45; max-width:300px; }
.kd-charts-page .ringwrap .meta .tiles{ display:flex; gap:10px; margin-top:14px; }
.kd-charts-page .rtile{ border-radius:12px; padding:12px 15px; min-width:80px; }
.kd-charts-page .rtile .v{ font-family:var(--kd-mono); font-size:20px; line-height:1; color:var(--ink); }
.kd-charts-page .rtile .l{ font-size:11px; margin-top:5px; color:rgba(22,20,19,.6); }

.kd-charts-page .stack{ height:28px; border-radius:14px; overflow:hidden; display:flex; }
.kd-charts-page .stack i{ height:28px; display:block; }
.kd-charts-page .leg{ display:flex; flex-wrap:wrap; gap:11px 20px; margin-top:16px; }
.kd-charts-page .leg .it{ display:flex; align-items:center; gap:8px; }
.kd-charts-page .leg .it i{ width:11px; height:11px; border-radius:4px; flex:none; }
.kd-charts-page .leg .it .n{ font-size:12px; color:rgba(22,20,19,.76); }
.kd-charts-page .leg .it .p{ font-family:var(--kd-mono); font-size:11px; color:var(--ink); }

.kd-charts-page .heat{ display:grid; gap:6px; }
.kd-charts-page .hrow{ display:grid; grid-template-columns:120px repeat(5,1fr); gap:6px; align-items:center; }
.kd-charts-page .colhd{ font-family:var(--kd-mono); font-size:9px; letter-spacing:.04em; text-transform:uppercase; color:rgba(22,20,19,.5); text-align:center; }
.kd-charts-page .rname{ font-size:12px; font-weight:500; }
.kd-charts-page .cell{ height:38px; border-radius:9px; display:flex; align-items:center; justify-content:center; font-family:var(--kd-mono); font-size:12.5px; color:var(--ink); }
.kd-charts-page .cell.hi{ color:var(--cream); }
`;

const HTML = `
<div class="frame">
  <div class="head">
    <div class="eyebrow">KD · Product UI · Canonical chart primitives</div>
    <h1>Copia <em>estos</em> gráficos.</h1>
    <p>Estas son las piezas correctas para cualquier interfaz de producto KD (Groundwork, Sounding, dashboards). Ya usan la paleta atenuada: el color vive en los tiles, los gráficos van en gris con un solo acento, y no hay pies ni azul eléctrico. Copia el markup de aquí en vez de regenerarlo.</p>
    <div class="switch">
      <span class="lab">Acento de producto</span>
      <button class="on" onclick="document.getElementById('kd-charts-root').setAttribute('data-product','groundwork');[...this.parentNode.querySelectorAll('button')].forEach(b=>b.classList.remove('on'));this.classList.add('on')">Groundwork · azul</button>
      <button onclick="document.getElementById('kd-charts-root').setAttribute('data-product','sounding');[...this.parentNode.querySelectorAll('button')].forEach(b=>b.classList.remove('on'));this.classList.add('on')">Sounding · coral</button>
    </div>
  </div>

  <div class="body">

    <div class="block">
      <div class="bt">
        <div class="l"><div class="n">1 · KPI tiles</div><div class="u">El color vive aquí. Fondo en un tint (<code>--accent-tint</code> / <code>--p-stone</code> / <code>--p-sand</code>), número en tinta. El acento principal va en el primer tile.</div></div>
        <div class="r ok">Use</div>
      </div>
      <div class="demo">
        <div class="kpis">
          <div class="kpi" style="background:var(--accent-tint);"><div class="l">Contenido</div><div class="v">406</div></div>
          <div class="kpi" style="background:var(--p-stone);"><div class="l">Marcas</div><div class="v">6</div></div>
          <div class="kpi" style="background:var(--p-sand);"><div class="l">Analizado IA</div><div class="v">100<small>%</small></div></div>
          <div class="kpi" style="background:var(--p-ember);"><div class="l">Engagement líder</div><div class="v">10.5<small>k</small></div><div class="d" style="color:var(--d-ember);">↑ Latam</div></div>
        </div>
      </div>
      <div class="why"><b>Regla:</b> el sólido solo aparece como fondo de un número. Nunca como relleno de cada barra.</div>
    </div>

    <div class="block">
      <div class="bt">
        <div class="l"><div class="n">2 · Ranking — barras en calma</div><div class="u">Track gris (<code>--data-track</code>), barras en grises de tinta (<code>--q1/2/3</code>). Solo el líder toma <code>--accent-deep</code>; una alerta puntual toma <code>--d-ember</code>.</div></div>
        <div class="r ok">Use</div>
      </div>
      <div class="demo">
        <div class="bars">
          <div class="brow"><span class="nm">Iberia</span><div class="tr"><div class="fl" style="width:100%;background:var(--accent-deep)"></div></div><span class="vl">96</span></div>
          <div class="brow"><span class="nm">Air Europa</span><div class="tr"><div class="fl" style="width:100%;background:var(--q1)"></div></div><span class="vl">96</span></div>
          <div class="brow"><span class="nm">Latam</span><div class="tr"><div class="fl" style="width:75%;background:var(--q2)"></div></div><span class="vl">72</span></div>
          <div class="brow"><span class="nm">Plus Ultra</span><div class="tr"><div class="fl" style="width:50%;background:var(--q2)"></div></div><span class="vl">48</span></div>
          <div class="brow"><span class="nm">Laser</span><div class="tr"><div class="fl" style="width:49%;background:var(--q3)"></div></div><span class="vl">47</span></div>
        </div>
      </div>
      <div class="why"><b>Regla:</b> un acento por gráfico. El resto en gris. Nada de un color por categoría.</div>
    </div>

    <div class="block">
      <div class="bt">
        <div class="l"><div class="n">3 · Ring — reemplaza el pie de 2 partes</div><div class="u">Un solo arco con cap redondo (<code>stroke-linecap:round</code>) y el valor en mono dentro. Sin segunda porción, sin líneas guía.</div></div>
        <div class="r ok">Use en vez de pie</div>
      </div>
      <div class="demo">
        <div class="ringwrap">
          <svg width="118" height="118" viewBox="0 0 118 118">
            <circle cx="59" cy="59" r="48" fill="none" stroke="var(--data-track)" stroke-width="15"></circle>
            <circle cx="59" cy="59" r="48" fill="none" stroke="var(--accent-deep)" stroke-width="15" stroke-linecap="round"
              stroke-dasharray="301.6" stroke-dashoffset="105" transform="rotate(-90 59 59)"></circle>
            <text x="59" y="56" text-anchor="middle" font-family="'IBM Plex Mono',monospace" font-size="24" font-weight="500" fill="#161413">65%</text>
            <text x="59" y="73" text-anchor="middle" font-family="'IBM Plex Mono',monospace" font-size="8.5" letter-spacing="1" fill="#7A746C">INSTAGRAM</text>
          </svg>
          <div class="meta">
            <div class="big">Instagram lidera la distribución</div>
            <div class="sm">El valor dominante en el arco; el resto como un tile secundario al lado. Nunca dos porciones peleando.</div>
            <div class="tiles">
              <div class="rtile" style="background:var(--accent-tint);"><div class="v">65%</div><div class="l">Instagram</div></div>
              <div class="rtile" style="background:var(--p-stone);"><div class="v">35%</div><div class="l">TikTok</div></div>
            </div>
          </div>
        </div>
      </div>
      <div class="why"><b>Prohibido:</b> pie / donut con leyenda flotante o líneas guía.</div>
    </div>

    <div class="block">
      <div class="bt">
        <div class="l"><div class="n">4 · Stacked capsule — reemplaza el pie de varias partes</div><div class="u">Una sola franja redondeada con los tints en orden (<code>--accent-tint</code> → <code>--accent-step</code> → neutros → <code>--p-ember</code>) y leyenda directa debajo.</div></div>
        <div class="r ok">Use en vez de pie</div>
      </div>
      <div class="demo">
        <div class="stack">
          <i style="width:42%;background:var(--accent-tint)"></i>
          <i style="width:33%;background:var(--accent-step)"></i>
          <i style="width:13%;background:var(--p-stone)"></i>
          <i style="width:8%;background:var(--p-sand)"></i>
          <i style="width:4%;background:var(--p-ember)"></i>
        </div>
        <div class="leg">
          <div class="it"><i style="background:var(--accent-tint)"></i><span class="n">Video</span><span class="p">42%</span></div>
          <div class="it"><i style="background:var(--accent-step)"></i><span class="n">Reel</span><span class="p">33%</span></div>
          <div class="it"><i style="background:var(--p-stone)"></i><span class="n">Post</span><span class="p">13%</span></div>
          <div class="it"><i style="background:var(--p-sand)"></i><span class="n">Carrusel</span><span class="p">8%</span></div>
          <div class="it"><i style="background:var(--p-ember)"></i><span class="n">Slideshow</span><span class="p">4%</span></div>
        </div>
      </div>
      <div class="why"><b>Prohibido:</b> un color saturado distinto por categoría (arcoíris).</div>
    </div>

    <div class="block">
      <div class="bt">
        <div class="l"><div class="n">5 · Heatmap — una sola tinta</div><div class="u">La magnitud se codifica con <code>color-mix(in oklab, var(--accent-deep) N%, var(--p-stone))</code>. Un matiz, cualquier número de celdas.</div></div>
        <div class="r ok">Use</div>
      </div>
      <div class="demo">
        <div class="heat">
          <div class="hrow"><span></span><span class="colhd">Táctico</span><span class="colhd">Testim.</span><span class="colhd">Producto</span><span class="colhd">Innov.</span><span class="colhd">Hero</span></div>
          <div class="hrow"><span class="rname">Iberia</span>
            <span class="cell hi" style="background:color-mix(in oklab, var(--accent-deep) 92%, var(--p-stone))">87</span>
            <span class="cell" style="background:color-mix(in oklab, var(--accent-deep) 32%, var(--p-stone))">30</span>
            <span class="cell" style="background:color-mix(in oklab, var(--accent-deep) 13%, var(--p-stone))">12</span>
            <span class="cell" style="background:var(--p-stone)">—</span>
            <span class="cell" style="background:color-mix(in oklab, var(--accent-deep) 13%, var(--p-stone))">12</span>
          </div>
          <div class="hrow"><span class="rname">Latam</span>
            <span class="cell hi" style="background:color-mix(in oklab, var(--accent-deep) 70%, var(--p-stone))">65</span>
            <span class="cell" style="background:color-mix(in oklab, var(--accent-deep) 11%, var(--p-stone))">8</span>
            <span class="cell" style="background:color-mix(in oklab, var(--accent-deep) 22%, var(--p-stone))">21</span>
            <span class="cell" style="background:color-mix(in oklab, var(--accent-deep) 8%, var(--p-stone))">5</span>
            <span class="cell" style="background:color-mix(in oklab, var(--accent-deep) 6%, var(--p-stone))">3</span>
          </div>
          <div class="hrow"><span class="rname">Air Europa</span>
            <span class="cell hi" style="background:color-mix(in oklab, var(--accent-deep) 95%, var(--p-stone))">89</span>
            <span class="cell" style="background:color-mix(in oklab, var(--accent-deep) 18%, var(--p-stone))">14</span>
            <span class="cell" style="background:color-mix(in oklab, var(--accent-deep) 21%, var(--p-stone))">19</span>
            <span class="cell" style="background:color-mix(in oklab, var(--accent-deep) 13%, var(--p-stone))">10</span>
            <span class="cell" style="background:var(--p-stone)">1</span>
          </div>
        </div>
      </div>
      <div class="why"><b>Regla:</b> opacidad de UN matiz = magnitud. Nunca un color por celda.</div>
    </div>

  </div>
</div>
`;

export default function StyleChartsPage() {
  return (
    <div id="kd-charts-root" data-product="groundwork" className="kd-charts-page">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div dangerouslySetInnerHTML={{ __html: HTML }} />
    </div>
  );
}
