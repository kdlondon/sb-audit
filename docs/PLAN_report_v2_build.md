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

## 10. Fases

| Fase | Qué | Riesgo |
|---|---|---|
| **F0** | Migraciones · modelo de bloques (incl. tipos ricos) · conversión de legacy | Medio |
| **F1** | Library sobre el shell: N2, filtros, orden, chips, indicador de presentación, ⋯ (Rename/Delete/Archive) + modales | Bajo |
| **F2** | Generate 1 (8 objetivos, chips Flagship/Core/Section) + 2 (**configurador por reporte** vía `REPORT_CARDS`) + selector de objetivos en Settings | Medio |
| **F3** | Generación por secciones orquestada + progreso real + guardado incremental + fallo a mitad. *(Depende del diseño de los bloques ricos.)* | Medio |
| **F4** | Documento: autosave, banner de concurrencia, 4 herramientas, raíl de comentarios con rol | **Alto** |
| **F5** | Download (pdf·md·doc) + **reescritura de citas a URL pública** | Medio |
| **F6** | Presentación anidada + Showcase fuera del sidebar + aviso | Medio |
| **F7** | **Innovation Report** (report-card nueva, prompt contrastado con Global) | Bajo — sin tocar arquitectura |
| **Fx** | **Ruta pública de caso** `/case/[id]` (auth-gated) — habilita F5. Puede ir en paralelo | Medio |

**Fuera de fase, previo**: pase de **diseño de bloques ricos** (matriz, case, chart, tabla) — bloquea F3.
**Recomendada, previa a tocar prompts**: sesión de revisión de prompts uno a uno.

---

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

## 13. Sigue abierto

1. **Diseño de los bloques ricos** — lo defines dentro del sistema Groundwork.
2. **Sesión de prompts** — revisión uno a uno de los 3+1 motores.
3. **Ruta pública de caso** — confirmar `/case/[id]` como path y su gating.
