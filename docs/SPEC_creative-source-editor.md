# Editor de Creative Source (view 09) — plan de desarrollo

_Handoff: `design_handoff_navigation/views/09 Content - Editor.dc.html`._
_Estado: pendiente. Es la última pieza grande de Creative Source, junto a Collections, Columns dropdown y Map._

---

## 1. Corrección a lo que te dije antes

Te avisé de que el editor era "la pieza más compleja y quirúrgica". Tras leer el diseño y el código: **la parte quirúrgica sigue siéndolo, pero la compleja no.**

El motivo: **la arquitectura del diseño ya existe en el código.** Lo comprobé pieza por pieza:

| Pieza del diseño | ¿Existe hoy? |
|---|---|
| Dos columnas (fuente izq. / secciones der.) | ✅ `flex` con panel derecho `w-[380px]` |
| Acordeón de secciones, una abierta | ✅ estado `sec`, `allDimensions.map` |
| Secciones dirigidas por el framework | ✅ config-driven (system + custom dimensions) |
| Selector de tipo de material (6 tipos) | ✅ `materialType`: video · videoFile · web · social · image · document |
| Sub-modo social (Single post / Profile feed) | ✅ `["single","Single post"],["feed","Profile feed"]` |
| TRANSCRIPT / COPY + ANALYST NOTES | ✅ |
| "Analyze with AI" | ✅ `analyzeWithAI()` |
| Clear · Cancel · Save en cabecera | ✅ |
| 9 tipos de campo | ✅ url · textarea · single_choice · multichoice · taxonomy · toggle · rating · country_search · brand_selector |

**No hay que reconstruir nada: hay que re-vestirlo.** Eso baja el riesgo de golpe.

Lo que **sí** queda de riesgo es que son ~540 líneas de JSX densísimo con Tailwind inline, y es **el único camino para editar datos**. Si se rompe, se rompe la captura. De ahí que el plan sea por bloques pequeños y verificables, no un rewrite.

---

## 2. Brecha real (lo que hay que cambiar)

1. **Proporción de columnas.** Hoy el panel derecho es fijo `w-[380px]`; el diseño le da mucho más peso (≈40–45%). Los campos van apretados en 380px.
2. **Cabecera.** Hoy `h2` "Edit entry" + barra propia. Debe ser el chrome estándar: eyebrow `CREATIVE SOURCE · EDIT ENTRY`, título Klamp, acciones Clear · Cancel · Save a la derecha.
3. **Contador por sección.** El diseño muestra `{{ cN }}` en cada cabecera de sección — un chip **campos rellenos / total**. **No existe**: hay que calcularlo.
4. **Colores fuera de paleta.** Las secciones custom usan `bg-purple-50 text-purple-700 border-purple-300` (violeta) y las system `bg-accent-soft text-accent`. Clear usa rojo. Todo a ember/ink.
5. **Estilo de campos.** Labels e inputs con clases viejas (`bg-surface2`, `text-[10px] text-muted`) → tokens del sistema (mono uppercase + input paper con hairline), como ya hice en Scout.
6. **Numeración.** El diseño titula `1 · Identification`; hoy solo las custom llevan número.
7. **Selector de material.** Hoy pills `bg-surface text-accent`; debe ser el pill blanco segmentado con activo ink-800.

---

## 3. Plan por fases

Cada fase = un commit, build verde, y **el editor sigue guardando** al terminar.

### Fase E0 — Red de seguridad (antes de tocar nada)
- Anotar el contrato de datos: qué escribe `save()`, qué campos toca `setCur`, cómo `custom_dimensions` guarda las custom.
- **Prueba manual de referencia** (la haces tú, 5 min): crear una entrada nueva, rellenar un campo de cada tipo (texto, select, multi, rating, país, marca), guardar, reabrir y confirmar que persisten. Ese es el criterio de "no he roto nada" para todas las fases siguientes.
- *Sin cambios de código.*

### Fase E1 — Cabecera + shell
- Montar el editor en el shell (ya lo está vía `?edit=`, con la sidebar colapsada) y sustituir su barra propia por el chrome estándar: eyebrow, título Klamp, acciones a la derecha.
- Clear pasa de rojo a botón hairline discreto (es destructivo pero no debe gritar; la confirmación ya existe).
- *Riesgo bajo. No toca campos.*

### Fase E2 — Proporción de columnas
- Panel derecho de `w-[380px]` fijo a proporcional (≈42%, con `minWidth` para que no colapse).
- Ajustar el scroll independiente de cada columna.
- *Riesgo bajo-medio: es layout, pero afecta a cómo respiran todos los campos.*

### Fase E3 — Cabeceras de sección + contador
- Numeración `N · Nombre` para todas las secciones (no solo custom).
- **Contador de completitud**: por sección, campos con valor / campos totales. Se calcula sobre `dim.fields` y `cur`, respetando `skipKeys` (los que se pintan en la columna izquierda) para no contar de más.
- Activo ember, custom marcada sin violeta.
- *Riesgo bajo. Es lectura, no escritura.*

### Fase E4 — Campos (la fase quirúrgica)
Un tipo por commit, en orden de menor a mayor riesgo:
1. `textarea` + `url` (texto plano)
2. `single_choice` + `taxonomy` (selects)
3. `toggle`
4. `multichoice` (chips — más lógica)
5. `rating` (`StarRating`)
6. `country_search` (`CountryInput`)
7. `brand_selector` (**el más delicado**: escribe `brand_name`, `competitor`, `brand`, `brand_id`, `country`, `category`, `sub_category` y depende de `formScope`)

Regla: **solo se tocan clases y envoltorios, nunca `value`/`onChange`/`setVal`.**

### Fase E5 — Columna izquierda
- Selector de material a pill blanco segmentado.
- Transcript / Analyst notes con los estilos del sistema.
- "Analyze with AI" a botón ember.
- Ojo: aquí viven crop, captura de stills, multi-imagen y el filmstrip — **no se tocan funcionalmente**, solo su piel.

### Fase E6 — Cierre
- Barrido de azules/violetas/rojos restantes.
- Repetir la prueba de la Fase E0.

---

## 4. Lo que NO voy a hacer sin que me lo digas

- **Cambiar el orden o el agrupado de campos.** Vienen del framework por proyecto; reordenarlos en el editor los desalinearía del resto de la app.
- **Tocar `save()` ni el shape de `custom_dimensions`.** Es re-skin, no migración.
- **Unificar el editor con la Full view.** Son pantallas distintas a propósito (una lee, otra escribe).

---

## 5. Pendientes hermanos (mismo módulo)

| Pieza | Estado | Nota |
|---|---|---|
| **Editor (view 09)** | este plan | Re-skin, 6 fases |
| **Collections (view 06)** | bloqueado | Cover mosaico 2×2, badge `AI CURATED`/`BY YOU`, chips "why it's here" → **necesita backend**, no es re-skin |
| **Columns dropdown** (view 05) | pendiente | Toggle de columnas en la lista + ocultar por defecto para evitar scroll horizontal. Autocontenido, riesgo bajo |
| **Map** | pendiente | Re-skin dentro del shell |

**Orden que propongo:** Columns dropdown (rápido y visible) → Editor (E0–E6) → Map → Collections cuando definamos el backend.
