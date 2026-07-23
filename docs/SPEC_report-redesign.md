# Report — plan de implementación (handoff IT 3)

_Handoff: `design_handoff_report` (README + `Report.dc.html` hi-fi). Flow y Wireframes = solo racional._
_Incorpora la arquitectura de producto acordada el 2026-06-20/24 (pipeline, catálogo consolidado, motor de pesos, findings, rúbrica de rating)._

---

## 1. La buena noticia: el motor ya está construido

Esto **no es un módulo nuevo**. Lo caro —la inteligencia— ya está en producción:

| Pieza | Estado | Dónde |
|---|---|---|
| **Strategic Positioning** (flagship, 6 secciones, arco narrativo) | ✅ Construido | `app/reports/flagship/` + `app/api/reports/flagship/` |
| **Social Content Benchmark** (7 secciones, familia performance) | ✅ Construido | `app/reports/social/` + api |
| **Global Creative Inspiration** (4 secciones, familia quality) | ✅ Construido | `app/reports/global/` + api |
| **Motor de pesos** (intent × source, 3 modos por familia) | ✅ Construido | En las 3 rutas API |
| **Findings como overlay** | ✅ Construido | `lib/findings.js`, `components/FindingsConfig.jsx` |
| **Rúbrica de rating multidimensional** | ✅ Construido | `lib/rating-rubric.js` |
| **Editor TipTap** (Visual/Source, @-insert, autosave) | ✅ Construido | `app/reports/editor/` |
| **Regenerar por sección** | ✅ Construido | En las 3 páginas |
| **Lente ICP** | ✅ Construido | En las 3 rutas |

**Lo que falta es la capa de producto**: la IA de navegación del handoff, el documento editable de una sola pieza, y la capa de revisión (estados, comentarios).

---

## 2. Qué cambia en el flujo (handoff vs. hoy)

| | Hoy | Handoff |
|---|---|---|
| **IA** | `?tab=generate` \| `?tab=archive`, y **una ruta por informe** (`/reports/flagship`, `/social`, `/global`) | **Una vista** con N2 **Library / Generate** y estados `library → generate → configure → doc` |
| **Landing** | Generate (el catálogo) | **Library**: lo primero es tu trabajo, no el catálogo |
| **Configure** | UI propia y distinta en cada una de las 3 rutas | **Una sola** Configure compartida: pills scope/lens + cards (Time frame · Weighting · Brands · Intents · Sections · Custom instructions) |
| **Documento** | Se genera en modo lectura; ✎ Edit **navega a otra página** (`/reports/editor?id=`) | **Nace editable**, mismo lienzo. Sin salto de página |
| **Estados** | No existen | **In process / In review / Delivered**, editables desde el documento y visibles en Library |
| **Revisión** | No existe | Selección de texto → **Ask about this** / **Comment**, raíl de comentarios y subrayado ember en el cuerpo |
| **Salidas** | — | **Copy · Download ▾ (.md/.pdf) · Showcase** (publicar, en ink-800 para distinguirlo del primario ember) |
| **Archivo** | "Archive" = lista de guardados | **Active / Archived** con contadores + Restore |

Cambio conceptual: hoy Report es *"un generador con un archivo detrás"*; el handoff lo convierte en **una biblioteca de documentos vivos** que además sabe generar. Por eso Library es el landing.

---

## 3. Lo que hay que construir de verdad

### 3.1 Backend (bloqueante — sin esto no hay Library del handoff)
`saved_reports` hoy tiene: `title, content, template_type, project_id, created_by, created_at`. **No tiene estado, ni archivado, ni comentarios.**

Migración necesaria (`MIGRATION_report_review.sql`):
- `status text default 'in_process'` — `in_process | in_review | delivered`
- `archived boolean default false`
- `updated_at timestamptz`
- tabla **`report_comments`**: `id, report_id, project_id, author, author_initial, snippet, body, anchor, created_at, edited`

Nota del propio handoff (línea 96): **no anclar los comentarios por coincidencia de texto** como hace el prototipo. Guardar un ancla estable (id de nodo + offsets). Es la decisión técnica con más deuda futura si se hace mal.

### 3.2 Frontend nuevo
1. **Unificación de las 3 rutas en una vista** con selector de plantilla.
2. **Configure compartida** que sustituya las tres Configure actuales.
3. **Documento born-editable**: fusionar la vista de lectura con el editor TipTap en el mismo lienzo.
4. **Capa de revisión**: toolbar de selección, panel Ask, panel Comment, raíl y subrayado.
5. **Library**: filtros, orden, chips de estado, burbujas de comentario, menú ⋯.

---

## 4. El riesgo principal: "born editable"

Es el cambio con más superficie. Hoy el flujo es *generar → leer → ✎ Edit → **navegar** a `/reports/editor?id=` → TipTap*. El handoff quiere **un solo lienzo** donde el documento ya nace editable.

Dos caminos:

- **A — Fusionar (fiel al handoff).** Montar TipTap directamente en el documento y que `editing` sea un toggle de la misma vista. Fiel, pero toca el editor que hoy funciona y es compartido por las 3 rutas.
- **B — Conservar el editor como está y hacer que la vista del documento lo embeba** en lugar de navegar. Menos fiel en las tripas, idéntico para el usuario, y no se toca el guardado.

**Recomiendo B** para la primera pasada: el usuario percibe exactamente el handoff (no hay salto de página) y no arriesgamos el autosave. Si luego molesta la doble capa, se fusiona.

---

## 5. Fases

**R0 — Migración + inventario** *(bloqueante, sin UI)*
- `MIGRATION_report_review.sql` (status, archived, updated_at, `report_comments`).
- Backfill: todo guardado existente → `status='in_process'`, `archived=false`.
- *Riesgo bajo. Nada visible.*

**R1 — Shell + Library**
- Report al shell (Sidebar + `<main>`, contenedor 1180/34 como el resto), fuera `Nav` y `.section-bar`.
- N2 **Library / Generate**; Library como landing.
- Filas de informe: chip de estado, meta `fecha · hora · autor`, Open, menú ⋯ (Edit · Rename · Archive/Restore).
- Filtro Active/Archived con contadores + orden (Most recent · Oldest · By status).
- *Riesgo medio: cambia el landing del módulo.*

**R2 — Generate (catálogo)**
- Bloque **Suggested** (Flagship ink / Core ember-tint) + **All reports** en grid 2-col con chip de scope.
- Los 6 secundarios del handoff (Competitor Snapshot, Category Landscape, Opportunity, Creative Intelligence, Innovation, Agnostic Snapshot) **hoy no existen como motores**. Ver §6.
- *Riesgo bajo.*

**R3 — Configure unificada**
- Una Configure para todas las plantillas: pills scope/lens + cards Time frame · Weighting · Brands · Intents · Sections · Custom instructions.
- Preservar lo que ya funciona: overrides por sección, `customInstructions`, `FindingsConfig`, y el selector de modo de peso (que ya existe y encaja exactamente en la card **Weighting**).
- *Riesgo medio-alto: consolidar 3 UIs en 1 sin perder parámetros de ninguna.*

**R4 — Documento**
- Cabecera nueva (título aireado, fila con STATUS a la izquierda y toolbar a la derecha).
- Toolbars por estado: borrador (Save + Regenerate all) vs guardado (Edit · Copy · Download ▾ · Showcase).
- Documento embebiendo el editor (opción B), regenerar por bloque con campo de instrucción + pulso `gwpulse`.
- *Riesgo alto: es donde se guarda el trabajo.*

**R5 — Capa de revisión**
- Toolbar de selección → Ask about this / Comment.
- Panel del asistente (reusa `/api/ai`), panel de comentario, raíl derecho, subrayado ember anclado.
- *Riesgo medio, pero es la funcionalidad más nueva.*

**R6 — Salidas y cierre**
- Copy · Download ▾ (.md/.pdf) · Showcase publish.
- Barrido de paleta y retirada de las 3 rutas viejas.

---

## 6. Decisiones que necesito de ti

1. **Born editable: ¿A o B?** Recomiendo **B** (embeber, no fusionar) para no tocar el autosave en la primera pasada.

2. **Los 6 informes de "All reports" no existen.** El handoff lista Competitor Snapshot, Category Landscape, Opportunity, Creative Intelligence, Innovation y Agnostic Snapshot. Nuestro acuerdo de junio fue **consolidar en 3** precisamente para no fragmentar el producto. Opciones:
   - (a) Pintarlos como *coming soon* (fieles al diseño, honestos con el usuario).
   - (b) No pintarlos hasta que existan.
   - (c) Mapear algunos como **secciones extraíbles del flagship**, que era la idea original ("las secciones son extraíbles como sub-informes").
   **Recomiendo (c) + (a)**: los que son extraíbles del flagship se generan de verdad; el resto, coming soon.

3. **Showcase publish**: ¿publica el documento tal cual, o entra por el Magazine que dejamos en Phase 5? Afecta a qué hace el botón.

4. **Comentarios**: ¿solo K&D, o el cliente también comenta? Cambia el modelo de permisos y si `report_comments` necesita RLS por rol.

---

## 7. Lo que NO toco sin permiso

- Los **3 motores de generación** y su prompting: el rediseño es de la capa de producto, no de la inteligencia.
- El **motor de pesos** y la rúbrica de rating.
- El shape de `content` en `saved_reports` (los informes guardados deben seguir abriéndose).
