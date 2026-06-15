# SPEC — Project Onboarding (rediseño)

> Estado: **definición lista para desarrollar**. Escrito 2026-06-15.
> Reemplaza el flujo conversacional actual de `app/onboarding/page.jsx`.

## Overview

El onboarding crea un **estudio** de inteligencia competitiva: captura el brief, el
perfil de la marca foco, el panorama competitivo (local + global) y siembra
contenido inicial. Hoy es un chat de 6 pasos: lento (hasta ~14 llamadas IA),
poco inteligente (extrae con regex), y escribe en tablas **legacy** que la app ya
no lee — por eso "no guarda".

**Principio rector:** el Onboarding **NO es un módulo aparte** — es el módulo
**Settings, pero guiado y la primera vez**. Misma información, mismos campos, mismas
tablas. Onboarding = crear el estudio; Settings = editarlo después.

## Decisiones de fundamento (cerradas)

- **Proyecto = Estudio = unidad de configuración.** Cada estudio se configura
  independiente. Sin plantillas de organización por ahora (mejora futura).
- **Escribe en las tablas vivas:** `brands` + `brand_frameworks` (NO en las legacy
  `project_frameworks` / `project_brands`). Es lo que leen Audit, Settings,
  Dashboard, Scout, Reports.
- **Perspectiva dual:** "Mi marca" (1ª persona) vs "Cliente que investigo" (3ª
  persona). Solo cambia el copy; el modelo de datos es el mismo.
- **Formato híbrido:** formularios para datos duros + IA como asistente fuerte
  (sugiere competidores/referencias, scoutea contenido).
- **Dimensiones de análisis:** las 4 *signature* del sistema cargan por default.
  Las **custom NO se configuran en el onboarding** — se hacen luego en Settings.
- **Objetivos:** lista predefinida (multi-select).

## Jerarquía de datos

```
organizations (cuenta: K&D / agencia / cliente)
   └── projects (= un estudio)              ← projects.organization_id
         └── brands (filas por marca)        ← brands.project_id
              ├── marca foco  proximity="own_brand"  → brand_frameworks (config del estudio)
              ├── competidor  proximity="direct"|"adjacent"
              └── referencia global  scope="global"
```

La **config del estudio vive en `brand_frameworks`** de la marca foco
(`proximity="own_brand"`). El framework-context lee `brand_frameworks` por
`brand_id` (ver `lib/framework-context.js`).

---

## User Stories

- **US1 — Crear estudio (analista/freelance):** Como analista quiero montar un
  estudio sobre un cliente en pocos pasos, para empezar a auditar rápido.
  - AC: completar P1–P4 crea el proyecto, la marca foco y los competidores, y deja
    el estudio seleccionado y listo en Audit.
  - AC: si algún guardado falla, veo el error real (no un "listo" falso).
- **US2 — Mi propia marca (cliente):** Como cliente quiero describir mi marca y
  ver quién compite conmigo.
  - AC: el toggle "Mi marca" cambia el copy a 1ª persona; el resto es idéntico.
- **US3 — Sugerencias inteligentes:** Como usuario quiero que la IA proponga
  competidores y referencias para no partir de cero.
  - AC: P3 y P4 muestran sugerencias en < 5 s; puedo activar/desactivar/añadir/editar.
- **US4 — Rápido:** Como usuario no quiero un proceso eterno.
  - AC: P2 hace **1 sola** llamada IA como máximo; el scout corre en paralelo.

---

## Flujo (4 pantallas + crear)

### P1 · Brief *(formulario)*
Campos:
- **Toggle** "Mi marca" / "Cliente que investigo" → guía el copy.
- **Marca foco** (texto).
- **Mercado principal** (country search — reusar `components/CountryInput.jsx`).
- **Categoría / industria** (texto o taxonomy).
- **Objetivos** (multi-select, lista predefinida — ver abajo).
- **Canales a evaluar** y **Ventana de tiempo (rango de años)**: *construir la UI
  pero OCULTA por ahora; no se guarda.* (Flag `SHOW_CHANNELS_TIMEWINDOW = false`.)

Acción "Siguiente" → **no guarda aún**; mantiene el estado en memoria. Todo el
guardado (proyecto + marca foco + framework + competidores + entries) ocurre al
final en "Crear", en una sola operación reintentable.

**Lista predefinida de objetivos (final):**
`Posicionamiento competitivo y mensajes` · `Identificar white spaces / oportunidades`
· `Inspiración creativa y benchmarking` · `Scan de innovación` ·
`Auditoría de consistencia de marca` · `Mapa de la categoría` ·
`Análisis de tono y territorios` · **`Otro` (texto libre)**.
→ Guardar como `brand_frameworks.objectives[]`; el valor "Otro" se guarda como el
texto que escriba el usuario.

### P2 · Perfil mínimo de la marca foco *(formulario)*
Solo 3 campos (lo demás se configura luego en Settings):
- **Propuesta de valor / posicionamiento** → `brand_frameworks.brand_positioning`
- **Diferenciador clave** → `brand_frameworks.brand_differentiator`
- **Resumen de audiencia** → `brand_frameworks.brand_audience`

La IA **no inventa** estos campos. *(Post-MVP, decidido "después": botón "Ayúdame a
investigar" en modo "Cliente que investigo" → la IA propone borradores editables. NO
en la primera versión.)*

### P3 · Panorama competitivo **local** *(IA sugiere → experto confirma)*
- Al entrar, **1 llamada IA** sugiere N competidores locales (N = "cantidad objetivo
  de marcas", input que vive **aquí**). Reusar `/api/suggest-competitors`.
- Chips activables + input para añadir manualmente.
- Por competidor: nombre, país (default = mercado del brief), **proximidad**
  (`direct` / `adjacent` / `target proximity`).
- → cada marca confirmada = fila en `brands` (`scope="local"`, su `proximity`).

### P4 · Panorama competitivo **global** *(IA sugiere → experto confirma)*
- **1 llamada IA** sugiere referencias globales **en la misma categoría** (por ahora;
  cross-category queda como mejora). Reusar `/api/suggest-competitors` con flag global.
- Chips + añadir manual. Por referencia: nombre, país.
- → cada una = fila en `brands` (`scope="global"`).

### Crear *(acción final, scout SÍNCRONO)*
1. **Scout en paralelo** (`Promise.all`, NO loop secuencial): 1 pieza por marca
   seleccionada vía `/api/youtube-scout`. Mostrar progreso. El usuario espera (~10–15 s).
2. Aceptar/saltar piezas.
3. **Guardar todo** con verificación de error por insert (ya implementado en el
   `finalize()` actual — portar esa lógica): `brands`, `brand_frameworks`,
   `dropdown_options`, `creative_source` (entries). Cargar **4 dimensiones signature
   por default** (no escribir custom_dimensions).
4. `selectBrand(focusBrandId, name, projectId)` y navegar a Audit.
5. Mensaje final honesto: piezas importadas + *"Personaliza dimensiones y completa el
   perfil en Settings del proyecto."*

---

## Data Model — qué escribe cada pantalla

| Pantalla | Tabla | Campos clave |
|---|---|---|
| P1 | `projects` | id, name, organization_id, created_by |
| P1 | `brands` (foco) | name, project_id, organization_id, proximity="own_brand", scope="local", country, category |
| P1/P2 | `brand_frameworks` (foco) | brand_id, project_id, tier="essential", objectives[], brand_positioning, brand_differentiator, brand_audience, communication_intents (default), standard_dimensions (default), language="English" |
| P3 | `brands` (competidores) | name, project_id, scope="local", proximity, country |
| P4 | `brands` (referencias) | name, project_id, scope="global", country |
| Crear | `dropdown_options` | defaults + competidores (category="competitor") |
| Crear | `creative_source` | entries de video aceptados (project_id, brand_name, scope, url, image_url, description, type="Video") |

> **Dimensiones signature por default** = `SYSTEM_DIMENSIONS` de
> `lib/system-dimensions.js` (Identification · Creative evaluation · Brand &
> communication · Execution). Son `is_system`, siempre presentes; no se persisten.
> `custom_dimensions` queda vacío hasta que el usuario las añada en Settings.

## API / Interface Contract (reusar lo existente)

- `POST /api/suggest-competitors` — sugerencias P3/P4. Input: `{ brand, market,
  category, scope: "local"|"global", count }`. Output: `{ competitors: [{name,
  country}] }`. (Hoy usa `claude-sonnet-4-20250514` — actualizar modelo.)
- `POST /api/youtube-scout` — scout P-final. Ya existe; llamar en paralelo por marca.
- `POST /api/ai` — solo para el "ayúdame a investigar" de P2 (post-MVP).
- **Modelo (decidido):** `claude-sonnet-4-6` por defecto; **`claude-opus-4-8` en las
  sugerencias de P3/P4** (competidores/referencias más astutas).

## UX/UI Recommendations

- Barra de progreso de 4 pasos (ya existe el patrón en el onboarding actual).
- Estados vacíos/carga/error explícitos en P3/P4 (la IA puede fallar → permitir
  añadir manual siempre).
- Botón "Atrás" entre pantallas sin perder lo capturado (estado en memoria, guardar
  al final).
- Reusar componentes: `CountryInput`, chips de competidor del onboarding actual y de
  la pestaña Landscape de Settings (`app/settings/page.jsx`) — **no duplicar**.

## Technical Notes

- **Robustez de guardado:** portar el patrón ya implementado (chequear `{ error }` en
  cada insert; críticos abortan con el mensaje real; no-críticos → warnings honestos).
- **Performance:** P2 = 1 llamada IA máx; scout = `Promise.all`, no secuencial.
- **RLS / service role:** los inserts del onboarding corren client-side (RLS). Verificar
  que las políticas de `brands`/`brand_frameworks`/`creative_source` permiten al
  usuario autenticado insertar (las de `project_frameworks` son permisivas; replicar).
- **Limpieza de deuda (recomendado, no bloqueante):** el modelo brand/project está
  enredado (`lib/brand-context.js` trata brandId≈projectId con muchos fallbacks).
  A futuro: una marca foco por proyecto, sin ambigüedad.

## Product Context & Integration Map

- **Upstream (debe existir antes):** una organización activa (`organizations` /
  `organization_members`) y acceso del usuario. El `organization_id` viene de
  `useRole().activeOrg`.
- **Downstream (esto habilita):** Audit (lee `brands` + `brand_frameworks` vía
  `framework-context`), Settings (edita los mismos), Scout (sigue descubriendo
  contenido), Dashboard/Reports (consumen `creative_source`).
- **Recursos compartidos:** `/api/suggest-competitors`, `/api/youtube-scout`,
  `CountryInput`, `SYSTEM_DIMENSIONS`. La pestaña Landscape de Settings hace casi lo
  mismo que P3/P4 → idealmente comparten componente de "gestión de marcas del estudio".
- **Acceso:** al crear el proyecto, otorgar `project_access` al creador (P0 pendiente:
  unificar legacy `project_access` vs nuevo `organization_members`).

## Decisiones cerradas (ronda 2)

1. **Modelo:** Sonnet 4.6 por defecto; Opus 4.8 en las sugerencias de P3/P4.
2. **Guardado:** TODO al final, en una sola operación reintentable (nada parcial en
   P1–P4). El estado se mantiene en memoria hasta "Crear".
3. **Botón "ayúdame a investigar" (P2):** post-MVP, NO en la primera versión.
4. **Objetivos:** lista predefinida + opción **"Otro"** (texto libre).
5. **Logo/marca del cliente en el brief:** no (por ahora).

## Build Order

1. **Esqueleto de 4 pantallas** + estado en memoria + navegación (sin guardar).
2. **P1 Brief** con objetivos (lista) y toggle de perspectiva. Canales/ventana ocultos.
3. **P2 Perfil mínimo** (3 campos).
4. **P3 Local** con `/api/suggest-competitors` (modelo actualizado).
5. **P4 Global** (misma categoría).
6. **Crear:** scout en paralelo + guardado robusto en `brands`/`brand_frameworks`/
   `creative_source` + `selectBrand` + navegación.
7. Verificar el ciclo completo: crear estudio → aparece en Audit/Settings con su
   framework y marcas. (Aquí se valida que ya NO usamos las tablas legacy.)
