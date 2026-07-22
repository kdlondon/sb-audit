# Rediseño de navegación — estado y pendientes

_Handoff: `design_handoff_navigation` (README + views 01–09). Tokens ember, sin azul/violeta._

## ✅ Hecho
- **Shell** (Phase 1): sidebar vertical (N0 proyecto + New entry, N1 módulos con activo ember, footer, colapso 240↔62), N2 SectionTabs, tokens scoped `.gw-shell`, fuente **Klamp 105** instalada.
- **Creative Source** (Phase 2):
  - Chrome: `AppShell` (Sidebar + main), header Klamp + eyebrow, N2 tabs cableados a scope/viewMode.
  - **Cabecera sticky con glass blur.**
  - **Galería** re-skin (masonry 3-col, 4:5 cover, tag ink, estrellas ember).
  - **Lista** re-skin (mono headers, hairline, ember, inline-edit intacto).
  - **Toolbar** del diseño (Filter/Sort con label, grid/list cuadrados activo-ink, descarga).
  - **Peek modal** = quick-read de view 07 (hero, handle, slogan ember, grid 4 campos, sinopsis, PDF/Edit/View full).

## ⏳ Pendiente — Creative Source
1. ~~**Full view (view 08)**~~ ✅ HECHO — `components/creative-source/FullView.jsx`, read-only, sidebar colapsado (`?full=<id>` → forceCollapsed), top bar (back · pager · Export PDF · Edit), hero + slogan/metrics dark card + synopsis, framework completo en cards 01–05 + transcript/notes. "View full" del peek la abre; su "Edit" abre el editor.
   - Nota: las herramientas SOLO-edición (still-capture, crop, multi-imagen, mover individual) viven en el **editor** (read-only no las lleva, por diseño). Transcript/insight/notes/todos los campos sí se ven en la full view.
2. **Editor (view 09)** — form de edición a 2 columnas (fuente izq / acordeón de secciones der, una abierta), "Analyze with AI". Hoy funciona con estilo viejo dentro del shell.
3. **Collections (view 06)** — re-skin + features nuevas que **necesitan backend**: cover mosaico 2×2, badge origen `AI CURATED`/`BY YOU`, chips "why it's here" (conecta con el spec de auto-colecciones del roadmap).
4. **Columns dropdown** en la lista (toggle Year/Type/Intent/Platform/Rating/Created + ocultar por defecto para evitar scroll horizontal) — view 05.
5. **Map** — re-skin dentro del shell (hoy estilo viejo).

## ⏳ Pendiente — otros módulos (Phase 3–4)
6. **Intelligence (Phase 3)**
   - ~~Chrome~~ ✅ HECHO — shell (Sidebar + main), cabecera sticky glass con título Klamp por tab + eyebrow INTELLIGENCE, N2 `SectionTabs` (Dashboard/Insights/Explore/Brands/Generate) cableados al estado `tab`.
   - ~~Re-skin de vistas 01–03 (paleta ember)~~ ✅ HECHO.
   - ~~Alineación con Creative Source + fidelidad al handoff~~ ✅ HECHO (feedback Sergio):
     - **Márgenes/ancho unificados**: Intelligence a `maxWidth 1180 / padding 34px` (header + contenido), igual que Creative Source (header, galería y lista, todas 1180/34). Mismo borde izquierdo entre módulos.
     - **Dashboard realmente ember**: el azul/navy venía de tokens legacy de globals (`--kd-data-1 #011EFF`, `--accent-deep/-tint/-step` oklch hue-266, `--text #0a0f3c` navy, `--text2` slate) que se cuelan en el shell por cascada. Se remapean **dentro de `.gw-shell`** (redesign.css) a la rampa ember→ink → barras/donut/heatmap/títulos/números en paleta, sin tocar globals ni páginas de nav viejo.
     - **Stat cards** del diseño: blancas + hairline (antes rellenos de color), número del líder en ember, sublabels mono.
     - **Insights** = diseño: fuera el título interno duplicado; chips en una sola barra blanca **LENSES** con Analyst Picks + Regenerate; lente activa = pill ink-800.
     - **Brands**: fuera la línea de descripción duplicada (ya va en el subtítulo del shell); Excel/PDF arriba-derecha en botones hairline.
     - **Tabs a 3**: Dashboard · Insights · Brands. **Explore y Generate retirados** del nav (su contenido queda como código muerto accesible solo por `?tab=`; limpiar en un pase posterior).
     - Subtítulos del chrome ahora coinciden con el handoff (contadores dinámicos).
   - ⏳ Deuda menor: borrar el código muerto de los bloques `explore`/`generate`; revisar legibilidad de charts sobre datos reales; Brands 3ª columna **Intended** llega con el spec Brand DNA a 3 bandas.
7. **Roll-out (Phase 4)**: Scout · Report · Showcase · Settings · Chat · Admin adoptan `AppShell`; retirar `Nav.jsx` viejo + `.section-bar` de globals; converger tokens `.gw-shell` a globales; limpiar `--kd-*` obsoletos.

## Notas / deuda
- Dos sistemas de tokens conviven durante la migración (globals `--kd-*` vs `.gw-shell`). Convergen en Phase 4.
- Klamp 105 self-hosted en `public/fonts/klamp`.
