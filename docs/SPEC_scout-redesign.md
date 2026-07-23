# Scout — plan de implementación (rediseño Iteración 2)

_Handoff: `design_handoff_scout` (README + `Scout.dc.html` hi-fi). Wireframes = solo racional, no implementar._
_Contexto: Phase 4 del rediseño de navegación. Scout es el primer módulo del roll-out._

---

## 1. Qué cambia en el flujo (diseño nuevo vs. hoy)

| | Hoy | Diseño nuevo |
|---|---|---|
| Canales | Toggle **YouTube / Social**; dentro de Social, sub-picker IG/TikTok | **3 segmentos al mismo nivel**: YouTube · Instagram · TikTok |
| Vista | Página con estado disperso + pestaña "Saved" | **Vista única state-driven**: `idle → results → importing` |
| Scope / Brand / Country | Dentro de la consola (y duplicados en `SocialFeedPicker`) | **Movidos a la barra de import** (abajo, oscura). Idénticos para ambas ramas |
| Selección | Set por rama, UI distinta | Unificada: card social entera togglea; en YouTube el checkbox togglea y **no** expande |
| Import | Botón dentro del listado | **Barra fija inferior** que aparece con ≥1 seleccionado: contador ember + SCOPE + BRAND + COUNTRY + "Import as entries" |
| Progreso | Texto/contador | **Overlay** sobre `<main>` con spinner ember, título, sub y barra de progreso |
| Opciones por vídeo | scope + intent + notas + transcript | **SEGMENT (mm:ss ×2) · TRANSCRIPT (auto-pull) · NOTES** |
| Navegación | `Nav` superior antiguo | **Sidebar del shell**, sin sub-tabs N2 |

Cambio conceptual clave: **la jerarquía de control pasa a OPTION → ACTION → FILTER.** Configurar la extracción (consola) va arriba; la acción ember la dispara; los filtros solo estrechan resultados; y las opciones de destino (scope/brand/country) se deciden **al importar**, no al buscar. Eso es lo que justifica mover esos tres campos abajo.

---

## 2. Lo que ya existe y se reutiliza (buena noticia)

`components/SocialFeedPicker.jsx` ya implementa **casi toda la rama social** del diseño:
- toggle de plataforma, input de handle, `limit` (= POSTS TO FETCH)
- `fetchFeed()` → `/api/social/feed`
- grid de posts con `selected` (Set) y `filterKind` all/reel/carousel/post (= el FILTER de tipo del diseño)
- `importSelected()` → `/api/social/import` + insert en `creative_source`, con `progress {done,total}` (= el overlay)
- `pScope` / `pBrand` / `pCountry` (los tres campos que ahora suben a la barra de import)

`app/scout/page.jsx` (1551 líneas) ya tiene la rama YouTube: búsqueda `/api/youtube-scout`, filtros avanzados, selección, transcripts, notas por vídeo, e import masivo.

**Estrategia:** no reescribir desde cero. Extraer la lógica de datos de ambas ramas a un contenedor único y volver a montar la UI según el diseño.

---

## 3. Lo que hay que construir nuevo

1. **`ScoutShell`** — vista única con `channel` / `phase` y reset al cambiar de canal.
2. **Channel toggle de 3 vías** con glifos monoline (hoy son 2 + sub-picker).
3. **Consola** por rama: YouTube (SEARCH QUERY + "Advanced filters ▾" en grid 4-col) / Social (@handle + POSTS TO FETCH).
4. **Import bar** oscura fija al fondo de `<main>`, compartida por ambas ramas.
5. **Overlay de importing** con spinner + barra de progreso.
6. **SEGMENT (mm:ss inicio/fin)** en el panel expandido de YouTube → **es funcionalidad nueva, no existe en backend**.
7. Re-skin completo a tokens ember + Klamp (hoy hay `#0019FF` y `#0a0f3c` hardcodeados en Scout).

---

## 4. Decisiones que necesito de ti (el diseño no las cubre)

El diseño describe un Scout más simple que el actual. Hay funcionalidad **viva hoy** que no aparece en el handoff. No la voy a borrar por mi cuenta:

| Función actual | Estado en el diseño | Propuesta |
|---|---|---|
| **Saved items** (pestaña + tabla `scout_saved`) | No aparece | **Conservar**. Tiene tabla propia y trabajo del analista guardado. Sugiero moverlo a un acceso secundario, no a un tab N2 |
| **Ranking con IA** (`ScoreBadge`, `minScore`) | No aparece | **Preguntar**: ¿se retira o vuelve como orden/filtro de resultados? |
| **Captura de frames** (`/api/youtube-frames`) | No aparece | Sugiero **moverlo al editor** de Creative Source (donde ya viven las herramientas de edición), no a Scout |
| **Asistente** (`askAssistant`) | No aparece | **Preguntar**: ¿se retira o pasa a Messages? |
| **`autoAnalyze`** (analizar con IA al importar) | Implícito en "running AI read" | **Conservar**, siempre activo según el copy del overlay |
| **Intent por vídeo** (`videoIntents`) | Sustituido por SEGMENT/TRANSCRIPT/NOTES | **Preguntar**: ¿se retira? |
| **SEGMENT (mm:ss)** | Nuevo en el diseño | **Necesita backend**. Ver punto 6 |

**Pregunta abierta del propio handoff (línea 89):** las opciones por vídeo de YouTube se expanden *inline*, pero la regla general de navegación dice "drill-down = panel/modal". El handoff pide confirmar. **Mi recomendación: mantener el inline expand** — son 3 campos, y abrir un panel para eso rompe el ritmo de revisar una lista larga.

---

## 5. Bug encontrado (aparte del rediseño)

En `app/scout/page.jsx` líneas **581** y **790**:

```js
await supabase.from(table).update(updates).eq("id", entry.id);
```

`table` **no está declarado en el módulo** (los inserts usan `"creative_source"` literal en 550 y 751). Es una `ReferenceError` que queda **tragada por el `catch { /* ignore */ }`** de alrededor. Efecto real: al importar con auto-analyze, el análisis de IA se calcula, se paga la llamada… y **nunca se guarda**. Silencioso.

Se arregla cambiando `table` → `"creative_source"`. Lo incluyo en la Fase 1 porque toca el mismo camino de import.

---

## 6. SEGMENT: necesita backend

El diseño añade recorte por tiempo (mm:ss inicio/fin) por vídeo. Hoy no existe: ni columnas en `creative_source`, ni uso en el import. Opciones:

- **A (mínima):** guardar `segment_start` / `segment_end` como metadato + recortar el transcript a esa ventana antes de mandarlo a la IA. Sin tocar vídeo. **Recomendada.**
- **B (completa):** procesar el clip. Coste alto, fuera del alcance de un re-skin.

Voy con **A** salvo que digas lo contrario. Requiere una migración con dos columnas.

---

## 7. Fases

**Fase 0 — Preparación (sin cambio visible)**
- Extraer la lógica de datos de la rama social de `SocialFeedPicker` a un hook `useSocialFeed` (fetch, selección, filtro, import+progreso).
- Extraer la de YouTube de `page.jsx` a `useYoutubeScout`.
- Arreglar el bug de `table`.
- *Riesgo bajo. Build verde, comportamiento idéntico.*

**Fase 1 — Chrome del shell**
- Montar Scout en el shell (`Sidebar` + `<main>`), retirar `Nav`, contenedor `1180 / 34px` como Creative Source e Intelligence.
- Bloque de título: eyebrow `SCOUT /` + H1 "Find the field" + subtítulo.
- Channel toggle de 3 vías con reset.
- *Aquí ya se ve el cambio. Riesgo bajo.*

**Fase 2 — Consola**
- Card blanca por rama: YouTube (query + advanced 4-col) / Social (@handle + posts to fetch).
- Botón ACTION ember.
- Quitar scope/brand/country de la consola.
- *Riesgo medio: hay que no romper los filtros avanzados existentes.*

**Fase 3 — Resultados**
- Toolbar (avatar/título + meta, filtro de tipo, Select all / Clear).
- Grid social 4-col con cards de selección ember.
- Lista YouTube con filas expandibles (checkbox con `stopPropagation`).
- *Riesgo medio-alto: es el grueso de la UI.*

**Fase 4 — Import bar + overlay**
- Barra oscura fija con contador, SCOPE/BRAND/COUNTRY y "Import as entries".
- Overlay de progreso cableado al progreso real del job.
- Unificar el import de ambas ramas contra `creative_source`.
- *Riesgo alto: es el punto donde se escriben datos. Verificar con import real de 1–2 piezas antes de soltar.*

**Fase 5 — Cierre**
- SEGMENT (opción A) + migración.
- Reubicar lo que se decida en el punto 4.
- Limpiar `#0019FF` / `#0a0f3c` restantes.

---

## 8. Notas

- Copy del sistema en **inglés**; solo el contenido de cliente (captions, títulos) en español.
- Un solo acento: ember. Scout tiene hoy azules hardcodeados (`#0019FF`, `#0a0f3c`) que se van.
- Los tokens del bundle `_ds/` coinciden con los que ya tenemos en `.gw-shell` (redesign.css). No hace falta añadir tokens nuevos.
- Las fuentes Klamp del bundle ya están instaladas en `public/fonts/klamp`.
