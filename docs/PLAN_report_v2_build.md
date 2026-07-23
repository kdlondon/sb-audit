# Report v2 — plan de implementación

_Handoff: `Report v2 Handoff` (README + `Report v2.dc.html`)._
_Flujo y brief de diseño: `FLUJO_report_v2.md`. Acuerdos base: `ACUERDOS_report-intelligence_junio.md`._
_Decisiones cerradas con Sergio 2026-07-23._

---

## 1. Decisiones cerradas

| # | Tema | Decisión |
|---|---|---|
| 1 | Informes legacy (guardados hoy como texto corrido) | **Convertir al abrir** — trocear en bloques con id, una vez, invisible |
| 2 | Configurador | **Uno por tipo de reporte**, no universal. Cada reporte declara sus secciones |
| 3 | Secciones extraíbles | Son **un reporte más en la lista**; su configurador ofrece la sección núcleo + Executive read (opcional) + Recommendations (opcional) como checkboxes |
| 4 | Comentarios al regenerar una sección | **Se borran** |
| 5 | Modelo LLM | **Subir al más capaz + centralizar** en una constante compartida |
| 6 | Innovation scan | **Motor nuevo y distinto** (no se mapea a Global). Ver §4 |
| 7 | "Others" (Competitor Snapshot, etc.) | **Fuera.** No se generan |
| 8 | Formato de los reportes | **Rico** (bullets, tablas, matrices, gráficos, imagen de caso incrustada). Ver §5 |
| 9 | Link de caso descargado | **Ruta pública + reescritura al exportar.** Ver §6 |

---

## 2. Catálogo definitivo (8 objetivos → destino)

Los 8 objetivos son los que el usuario elige en el **onboarding** (7 actuales + el social nuevo).

| Objetivo | Destino | Tipo | Estado |
|---|---|---|---|
| Competitive positioning & messaging | Strategic Positioning | Informe (Flagship) | ✅ Construido |
| Social content & engagement *(nuevo)* | Social Content Benchmark | Informe (Core) | ✅ Construido |
| Creative inspiration & benchmarking | Global Creative Inspiration | Informe (Core) | ✅ Construido |
| Innovation scan | **Innovation Report** | Informe (Core) | 🔨 **A construir** |
| Category landscape map | Category landscape | Sección extraíble | ⚙️ Preset del flagship |
| Identify white spaces / opportunities | White space & opportunity | Sección extraíble | ⚙️ Preset del flagship |
| Brand consistency audit | Hero & message consistency | Sección extraíble | ⚙️ Preset del flagship |
| Tone & territory analysis | Positioning x-ray | Sección extraíble | ⚙️ Preset del flagship |

**Competitor Snapshot y los otros 3 "Others" no existen y no se pintan.**

---

## 3. Configurador por reporte (decisión 2)

El configurador es **una plantilla que cada reporte rellena distinto**. La card **Sections** se pinta a partir de la "report-card" del reporte elegido.

- **Strategic Positioning** → 6 secciones toggleables + reorder + prompt por sección.
- **Social Benchmark** → sus 7.
- **Global / Innovation** → las suyas.
- **Sección extraíble** (p. ej. White space) → 1 sección núcleo (fija) + `☐ Executive read` + `☐ Recommendations`.

Común a todos: **Source** (by brand / by audit / by collection + contador de casos), **Lens** (Brand/Agency/VC), **Time frame**, **Communication intents**.
Fuera de todos: Weighting (ahora automático por familia), Brands (ya en Source), Custom instructions.

**Implementación**: un registro `REPORT_CARDS` (una entrada por tipo) que declara `{ family, weightMode, sections[], sourceDefaults }`. El configurador y el orquestador de generación leen de ahí. Añadir un reporte nuevo = añadir una entrada, no tocar UI.

---

## 4. Innovation Report vs Global — la distinción va en el prompt

- **Innovation Report** — estudia **el mensaje de marca sobre innovaciones / propuestas disruptivas**: qué innovación *comunica* la marca, no si el contenido es novedoso. Ej.: una marca comunicando una app de comunidad geolocalizada para negocios → entra. Fuente natural: `communication_intent = Innovation` + señales de propuesta/servicio disruptivo. Familia de peso: brand-signal filtrada a innovación.
- **Global Creative Inspiration** — contenido impresionante por **ejecución, abordaje creativo, insight disruptivo**, que **NO mueve el producto a un espacio de innovación**. Es craft, no propuesta. Familia: quality (rating).

Ambas definiciones entran **explícitas y contrastadas** en sus prompts para que no se solapen.

> **Sesión aparte recomendada**: revisar los prompts completos de los 3+1 motores uno a uno antes de tocarlos. Es trabajo de producto (qué le pedimos a la IA), no de build; conviene no mezclarlo. Los prompts son editables sin tocar arquitectura.

---

## 5. Formato rico (decisión 8) — amplía el modelo de bloques

Hoy los reportes son prosa markdown. El modelo de bloques con id habilita tipos ricos. Bloques previstos:

| Tipo | Uso |
|---|---|
| `h2` / `p` / `bullets` | Texto (base) |
| `table` | Comparativas marca × dimensión |
| `matrix` | White space (2×2 de territorios/ejes) |
| `chart` | Mix de pilares, cadencia, engagement… (datos ya precalculados en Social) |
| `case` | **Caso incrustado**: imagen + marca + una línea, no un link suelto |

**Dos consecuencias:**
1. Los motores deben **devolver datos estructurados** (no solo prosa) para los bloques graficables. Algunos ya precalculan stats (Social); otros hay que ampliarlos.
2. Necesita **un pase de diseño**: cómo se ven matriz, card de caso, gráfico y tabla dentro del sistema Groundwork. **Lo defines tú como estilo; yo lo implemento como tipos de bloque.**

*Esto ensancha F0 (más tipos de bloque) y añade una dependencia de diseño antes de F3.*

---

## 6. Link de caso navegable (decisión 9)

**Bug confirmado en el código**: una cita es `[nombre](cite:ID)`, y `cite:ID` no es una URL — solo Groundwork la entiende (abre la barra lateral del caso). En un archivo descargado, el clic no lleva a nada.

Arreglo:
1. **Ruta pública de caso** `/(case)/[id]` — auth-gated: si no hay sesión, pide login; tras entrar, muestra el detalle de la pieza. Hoy no existe.
2. **Al exportar**, reescribir las citas de `cite:ID` → `https://groundwork.kad.london/case/ID` (absoluta). Dentro de la app siguen abriendo la barra lateral sin recargar.

Acotado y de alto valor: hace navegables los entregables descargados.

---

## 7. Migraciones (F0)

`MIGRATION_report_v2.sql`:

```sql
alter table saved_reports add column if not exists status text default 'in_process';   -- in_process|in_review|delivered
alter table saved_reports add column if not exists archived boolean default false;
alter table saved_reports add column if not exists deleted_at timestamptz;
alter table saved_reports add column if not exists updated_at timestamptz default now();

create table if not exists report_comments (
  id uuid primary key default gen_random_uuid(),
  report_id text not null,
  project_id text not null,
  block_id text not null,
  sel_start int, sel_end int,
  snippet text,
  body text not null,
  author text not null,
  author_role text not null default 'kd',   -- 'kd' | 'client'
  created_at timestamptz default now(),
  edited_at timestamptz,
  deleted_at timestamptz
);

alter table saved_showcases add column if not exists report_id text;
alter table saved_showcases add column if not exists archived boolean default false;
```

Backfill: reportes → `status='in_process'`, `archived=false`; showcases existentes → `archived=true`.
`report_id` es `text` porque `saved_reports.id` se genera en cliente como string.

---

## 8. Modelo de contenido por bloques

```json
{ "v": 2, "blocks": [
  { "id": "blk_a1b2", "type": "h2",    "sectionKey": "landscape", "text": "Category landscape" },
  { "id": "blk_c3d4", "type": "p",     "sectionKey": "landscape", "text": "…" },
  { "id": "blk_e5f6", "type": "matrix","sectionKey": "whitespace","data": { "axes": […], "cells": […] } },
  { "id": "blk_g7h8", "type": "case",  "sectionKey": "cases",     "data": { "entryId": "…", "brand": "…", "line": "…" } }
]}
```

- `id` estable — ancla de comentarios (`block_id + start + end`), nunca por texto.
- `sectionKey` — regenerar una sección = sustituir sus bloques.
- Lector acepta legacy: si `content` no es `{v:2}`, se convierte al abrir (función pura, párrafos → bloques `p` con id).

---

## 9. Aprovechamientos (ya en el código)

- Las rutas **ya aceptan `section: regenKey`** → la generación por secciones se orquesta desde el cliente, sin reescribir motores.
- Config por sección (on/off + **prompt por sección**) ya soportada vía `sections: cfgIn`.
- `exec` y `recommendations` son de síntesis (reciben `priorSections`) → siempre al final.
- `maxDuration = 300`, motor de pesos con 3 modos, lente ICP, findings, editor TipTap, motor de presentaciones: se reutilizan.

---

## 10. Fases — estado

| Fase | Qué | Estado |
|---|---|---|
| **F0** | Migraciones · modelo de bloques · conversión de legacy | ✅ Hecho |
| **F1** | Library sobre el shell: N2, filtros, orden, chips, ⋯ (Rename/Delete/Archive) + modales | ✅ Hecho |
| **F2** | Generate 1 (objetivos + chips) + 2 (configurador por reporte) + objetivos en Settings | ✅ Hecho |
| **F3** | Generación por secciones + progreso real + guardado incremental + fallo a mitad | ✅ Hecho |
| **B1–B11** | Vía backend: migración, modelos, cards, bloques, citas, resolvedor, APIs, orquestador, motor Innovation, bloques visuales | ✅ Hecho |
| **F4** | Documento: **render de bloques ricos**, autosave, banner de concurrencia, 4 herramientas, raíl de comentarios | ⏳ **Siguiente** — riesgo alto |
| **F5** | Download (pdf · md · doc) + reescritura de citas a URL pública | ⏳ Pendiente |
| **Fx** | Ruta pública de caso `/case/[id]` (auth-gated) — habilita el link de caso en descargas | ⏳ Pendiente |
| **F6** | Presentación visual anidada (migrar Showcase + re-skin) | ⏸ Aparcado |
| **F7** | Showcase fuera del sidebar | ⏸ Aparcado (atado a F6) |

### Deuda técnica identificada durante F1–F3
1. **Seis peticiones recargan los mismos datos.** Cada sección vuelve a leer todas las entradas, el framework y el Brand DNA. Funciona, pero es 6× la carga y 6× la superficie de fallo. Lo correcto: que la ruta acepte varias secciones en una llamada.
2. **Los bloques visuales (B11) se generan pero no se pintan.** `socialVisuals`/`flagshipVisuals` ya devuelven KPI, barras, heatmap y matriz 2×2 con datos reales, y el motor social los adjunta — pero el documento aún renderiza solo markdown. Se conectan en F4.
3. **El motor Innovation nunca se ha ejecutado.** Construido y carteado, sin correr.
4. **Los extractos de sección sí se han probado** (White space, 2026-07-23): generan y guardan.

### Lección de la tanda de fallos (F2–F3)
Cinco causas encadenadas —columnas faltantes, uuid inválido, update bloqueado por RLS, 404 engañoso, y techo de tokens— **todas se presentaban como éxito**. El patrón a evitar: convertir un fallo en un resultado plausible (`catch` vacío, `data` sin comprobar `error`, update que no afecta filas). Instrumentar los caminos de escritura con comprobación de errores **antes** de darlos por terminados, no al depurar.

## 11. Riesgos

1. **Perder trabajo del analista en F4** — guardar versión nueva, nunca sobrescribir a ciegas; `updated_at` como testigo de concurrencia.
2. **Comentarios al regenerar** — se borran (decidido); avisar en la UI antes de regenerar una sección con comentarios.
3. **Legacy que deja de abrirse** — criterio duro: ningún informe guardado hoy puede dejar de abrirse. Se verifica al cerrar F0.
4. **Showcase fuera del sidebar** afecta a toda la navegación → va el último (F6).
5. **Motores devolviendo datos para gráficos** — algunos hoy solo devuelven prosa; ampliar sin romper el texto.

---

## 12. Lo que NO toco sin permiso

- El **prompting** actual (se revisa en sesión aparte antes de editar).
- El **motor de pesos**, la rúbrica de rating, los findings.
- El **editor TipTap** (se embebe) y el **motor de presentaciones** (cambia de dónde cuelga, no cómo funciona).

---

## 12bis. Vía backend (mientras el diseño se termina en Claude Design)

Todo lo que NO depende de pantallas. Se puede construir ya, en paralelo al diseño, sin bloquear nada.

| Paso | Qué | Depende de diseño? | Nuevo/aislado? |
|---|---|---|---|
| **B1** | `MIGRATION_report_v2.sql` (status/archived/deleted_at/updated_at + `report_comments` + `report_id` en showcases) | No | Solo se escribe; Sergio la corre |
| **B2** | `lib/models.js` — ids de modelo centralizados; reportes al más capaz | No | Nuevo, aislado |
| **B3** | `lib/report-cards.js` — registro `REPORT_CARDS` (familia, weightMode, secciones por reporte) | No | Nuevo, aislado |
| **B4** | `lib/report-blocks.js` — modelo de bloques con id + conversor de legacy + bloques↔markdown | No | Nuevo, aislado |
| **B5** | `lib/report-citations.js` — reescritura `cite:ID` → URL absoluta para export | No | Nuevo, aislado |
| **B6** | Resolvedor `resolveSource({mode,value})` → entries[] (by brand / audit / collection) | No | Nuevo, aislado |
| **B7** | API comentarios (CRUD sobre `report_comments`, anclados a block_id) | No | Nuevo endpoint |
| **B8** | API estado/archivar/borrar-suave sobre `saved_reports` | No | Nuevo endpoint |
| **B9** | Orquestador de generación por secciones (helper server/cliente sobre las rutas actuales) | No | Envuelve lo existente |
| **B10** | **Innovation Report** — report-card + ruta, prompt contrastado con Global | No (prompt = sesión aparte) | Nuevo motor |
| **B11** | Datos estructurados desde los motores (para bloques `chart`/`matrix`/`table`) | **Parcial** — el esquema sí, el gráfico concreto necesita diseño | Amplía motores |
| **Bx** | Ruta pública de caso `/case/[id]` (fetch + gating; la piel, luego) | La piel sí; la lógica no | Nuevo |

**Orden sugerido de trabajo backend:** B1 → B2 → B4 → B3 → B5 → B6 → B8 → B7 → B9 → B10. B11 y Bx quedan a medias hasta que aterrice el diseño (esquema listo, render después).

**Regla dura durante esta vía:** todo lo nuevo va en archivos nuevos y **sin cablear a las páginas actuales**, para que el módulo Report siga funcionando igual hasta que empiece F1. Nada de esto cambia comportamiento visible.

---

## 12ter. Actualización handoff v3 (GW3)

v3 no cambia el flujo: **añade los dos entregables diseñados** encima del módulo v2.

### Lo que trae
1. **El documento deja de ser un muro de texto.** Cada sección = numeral + heading + **visual** + prosa editable. Los tipos de visual quedan especificados: **KPI row · ranking bars · format split · heatmap comparativo · white-space 2×2 · pull-quote**. → **Cierra B11**: ya no es "esquema sí, gráfico luego".
2. **Los gráficos son bloques de datos, no imágenes.** El motor debe emitirlos como datos estructurados y editables.
3. **PDF = imprimir el mismo HTML** (`doc-page.js`, una página por sección). No hay render aparte.
4. **La presentación es un deck real** (`deck-stage.js`, 1920×1080, 10 diapositivas), embebido en la vista anidada, exporta PDF/PPTX.
5. **Paleta de datos cálida** — clay `#BE6B45`, ochre `#C6A15B`, taupe `#A89B88`, **solo para series múltiples**. Ember sigue marcando el líder.

### Impacto en el código ya escrito
- `lib/report-blocks.js`: `BLOCK_TYPES` actualizado al set real de v3 (`kpi`, `bars`, `split`, `heatmap`, `quadrant`, `pullquote`) sustituyendo mis `matrix`/`chart` genéricos. Degradación a markdown para export .md/.doc; el PDF conserva el gráfico porque imprime el HTML.
- **B11 pasa de bloqueado a construible**: los motores deben emitir estos bloques con datos.

### ⚠️ Inconsistencias detectadas (v3 vs. lo acordado)

| # | Inconsistencia | Lectura |
|---|---|---|
| 1 | **v3 mantiene un bloque "Others"** ("engines not tied to a chosen objective"). Acordamos que los 4 Others **no van** | El bloque Others queda **vacío** salvo que se muestren informes no ligados al objetivo elegido pero **sí existentes** (p. ej. el flagship cuando no es objetivo). Propongo: "Others" = motores construidos no sugeridos, no un catálogo de informes inexistentes |
| 2 | **El Innovation Report desaparece del orden de build de v3** (§9 no lo incluye) | Ya está **construido** (B10). No requiere fase; solo entra en el catálogo |
| 3 | **v3 §0 dice "editado como HTML rico"**, pero §1.1 y §5 dicen bloques estructurados | Fuente de verdad = **bloques**; el HTML es un *render* (y lo que se imprime a PDF). Si se guardara HTML, se pierden los comentarios anclados y la regeneración por sección |
| 4 | **El deck es NUEVO** (`deck-stage.js`, 10 slides diseñadas). Mi plan asumía reutilizar el motor de Showcase (2.586 líneas, `saved_showcases`) | **Cambio de alcance real**: no es "colgar Showcase de un reporte", es **construir un generador de deck nuevo**. Showcase queda archivado, no reutilizado. F6 crece bastante |
| 5 | **Paleta cálida de datos** contradice el "acento único ember, nunca otro tono" que venimos aplicando | Es una **excepción deliberada y acotada**: solo series múltiples en gráficos, nunca cromo/títulos/marcas de un solo valor. La adopto como tal, documentada |
| 6 | v3 §8 deja abierto "valores de gráfico editables" | Es parte de F4 (bloques ricos editables), no un extra |

### Resolución de las inconsistencias (Sergio, 2026-07-23)

| # | Resolución |
|---|---|
| 1 | **Se mantiene nuestro acuerdo**: "Others" = motores **construidos** no sugeridos para el objetivo elegido. No se pinta un catálogo de informes inexistentes |
| 2 | **Se mantiene**: Innovation ya está construido (B10); entra en el catálogo, sin fase propia |
| 3 | **Se mantiene la decisión cerrada nº1**: los **bloques son la fuente de verdad**; el HTML es un render (y lo que se imprime a PDF). Guardar HTML rompería comentarios anclados y regeneración por sección |
| 4 | **La presentación visual queda APARCADA.** No se avanza hasta nueva orden. **Aclaración (Sergio):** cuando se retome, **se migra la funcionalidad del Showcase existente** y se le aplica el **estilo visual del handoff** — no se reconstruye un deck desde cero. Esto reduce F6 de "motor nuevo" a "migración + re-skin". Ver aviso abajo |
| 5 | **La paleta cálida es para los REPORTES** (gráficos de series múltiples del documento). El cromo de la app sigue en ember único |
| 6 | Valores de gráfico editables = parte de F4 |

> ⚠️ **Dependencia que crea aparcar la presentación (nº4).** F7 sacaba Showcase del sidebar *porque* la presentación pasaba a vivir dentro del reporte. Si el deck no se construye, **retirar Showcase dejaría al usuario sin ninguna forma de hacer presentaciones**. Por tanto **F7 queda atado a F6**: mientras el deck esté aparcado, **Showcase se queda en el sidebar** y `saved_showcases` no se archiva. La columna `archived` de la migración se queda preparada pero **el UPDATE de archivado no se ejecuta todavía**.

### Orden actualizado
**F0** migraciones + bloques · **F1** Library (acordeón, iconos de formato, rename/delete) · **F2** Generate 1-2 · **F3** generación por secciones · **F4** refinamiento (bloques ricos editables, autosave, concurrencia, comentarios) · **F5** documento paginado + PDF.
**⏸ Aparcado:** F6 deck + PPTX + embed anidado · F7 Showcase fuera del sidebar.
*(Innovation ya no es fase: construido en B10.)*

**Consecuencia en Library**: el icono ▦ (visual) y el toggle Text/Visual del acordeón se diseñan y construyen, pero en estado "sin presentación" permanente hasta que se retome F6. Alternativa: ocultarlos hasta entonces. **A decidir al llegar a F1.**

---

## 13. Sigue abierto

1. **Diseño de los bloques ricos** — lo defines dentro del sistema Groundwork.
2. **Sesión de prompts** — revisión uno a uno de los 3+1 motores.
3. **Ruta pública de caso** — confirmar `/case/[id]` como path y su gating.
