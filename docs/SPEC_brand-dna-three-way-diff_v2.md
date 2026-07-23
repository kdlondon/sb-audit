# SPEC v2 — Brand DNA: diff a tres bandas + persistencia del crawl crudo

**Prioridad:** Alta · **Módulo:** Intelligence → Brands (Brand DNA) · **Fecha:** 2026-07-16
**Versión:** 2 — incorpora el review de implementación (dual-shape, campos Intended reales, poll, honestidad de evidencia)

---

## 0. Cambios respecto a v1 (para trazabilidad del review)

| # | Punto del review | Resolución |
|---|---|---|
| 1 | Reportes leen keys planas v1 → v2 los rompería en silencio (evidencia vacía ×2 en flagship) | **Dual-shape**: v2 escribe también las keys planas legacy (§4.4) |
| 2 | `value_proposition` y `brand_archetype` no existen como el spec los nombraba; bug vivo: archetype/r2b se pierden al guardar | Intended acotado a columnas reales + **fix del bug de guardado** (§4.1, §4.5) |
| 3 | `source_pages` (~70KB/versión) arrastrado por el poll de 10s del tab Brands | Select con columnas explícitas + carga on-demand (§5.4) |
| 4 | El prompt recorta a 26k chars; `source_pages` puede contener más de lo analizado | Marcar chars analizados por página; UI distingue analizado vs capturado (§3.1, §5.3) |

---

## 1. Objetivo

Elevar el Brand DNA de una comparación a dos bandas (web vs contenido) a un **diagnóstico a tres bandas** para la marca principal:

| Capa | Fuente | Nombre nuevo |
|---|---|---|
| Lo que quiere ser | Campos de identidad en `project_frameworks` | **Intended** |
| Lo que dice públicamente | Crawl de su website | **Declared** (antes "Expressed") |
| Lo que hace de verdad | Entries clasificadas en `creative_source` | **Deployed** (antes "Validated") |

De la comparación salen **dos gaps nombrados**:

- **Articulation gap** — Intended vs Declared: la estrategia interna no llega a la web.
- **Execution gap** — Declared vs Deployed: la web promete una cosa, el contenido hace otra.

**Regla de asimetría:** el diff a tres bandas solo aplica a la marca con `role = 'principal'` en `project_brands`. Competidores (direct/adjacent/global): diff a dos bandas (Declared vs Deployed, Execution gap). No tenemos su identidad intencionada y eso es correcto.

Además, este spec corrige la evidencia de segundo orden: hoy el texto crudo del crawl se descarta tras generar el perfil, lo que hace la capa Declared inauditable. A partir de ahora las páginas crudas se persisten junto a cada versión del perfil, marcando qué porción entró realmente al análisis.

---

## 2. Alcance

**Incluye:**
1. Persistir las páginas crudas del crawl en `brand_dna`, con marcado de lo analizado.
2. Fix del bug de guardado del Profile: `brand_archetype` y `r2b` se pierden en proyectos project-centric.
3. Inyectar los campos de identidad del Profile como tercera fuente en `/api/intelligence/brand-dna` (solo principal).
4. Output v2 del perfil: `intended` / `declared` / `deployed` + `articulation_gap` / `execution_gap`, **manteniendo las keys planas legacy (dual-shape)**.
5. UI en Intelligence → Brands: tres columnas para la principal, dos para el resto; labels renombrados; panel de evidencia; poll optimizado.

**NO incluye (explícitamente fuera):**
- Cambios en el weight engine (`lib/weights.js`) — verificado que solo mira `piece.source === "brand_dna"`, nunca el interior del perfil. Nada que tocar.
- Cambios en las rutas de reportes (`/api/reports/*`, `/api/intelligence/report`). El dual-shape garantiza que sigan leyendo lo mismo. El accessor compartido `declaredOf(profile)` y el consumo del schema v2 por los reportes van en el spec siguiente.
- Category context / brand_metrics (specs separados).
- Re-crawlear o migrar perfiles existentes (v1 se mapea solo en render).
- Añadir columna nueva de `value_proposition`: el formulario funde VP y positioning en `brand_positioning` y para el diff eso es aceptable como una sola afirmación de posicionamiento. Documentado, no cambiado.

---

## 3. Cambios de base de datos

### 3.1 Migración `MIGRATION_brand_dna_v2.sql`

```sql
-- Páginas crudas del crawl, versionadas junto al perfil
ALTER TABLE brand_dna
  ADD COLUMN IF NOT EXISTS source_pages jsonb DEFAULT NULL;

-- Snapshot de los campos de identidad usados en la generación (solo principal)
ALTER TABLE brand_dna
  ADD COLUMN IF NOT EXISTS intended_snapshot jsonb DEFAULT NULL;

-- Versión de schema para distinguir legacy (2 bandas) de v2 (3 bandas)
ALTER TABLE brand_dna
  ADD COLUMN IF NOT EXISTS schema_version int NOT NULL DEFAULT 1;
```

**Formato de `source_pages`** — cada página marca cuántos de sus chars entraron al prompt (el crawl trunca a 7.000/página y el total del prompt a ~26.000; por tanto puede haber páginas capturadas que el modelo no vio, total o parcialmente):

```json
[
  { "url": "https://grupoinsur.com/", "label": "home", "chars": 6890, "chars_analyzed": 6890, "text": "..." },
  { "url": "https://grupoinsur.com/nosotros", "label": "about", "chars": 5420, "chars_analyzed": 5420, "text": "..." },
  { "url": "https://grupoinsur.com/sostenibilidad", "label": "sustainability", "chars": 6100, "chars_analyzed": 0, "text": "..." }
]
```

- `chars_analyzed` = porción de esa página que efectivamente entró al prompt (0 si quedó fuera del recorte de 26k). Calcularlo en el mismo punto donde se ensambla `siteContent` — no estimarlo después.
- Guardar el texto ya truncado a los 7.000 chars/página del crawl actual (no re-truncar distinto).
- Fallback Jina → entrada única con `label: "jina-fallback"`.
- Perfiles nuevos: `schema_version = 2`. Los existentes quedan en 1, intactos.

**Formato de `intended_snapshot`** (copia literal de los valores del Profile al momento de generar — el diff sigue siendo auditable aunque el Profile cambie después). **Solo columnas que existen en `project_frameworks`:**

```json
{
  "brand_positioning": "...",
  "brand_differentiator": "...",
  "brand_audience": "...",
  "brand_tone": "...",
  "brand_archetype": "...",
  "r2b": "..."
}
```

> `brand_positioning` contiene el posicionamiento/VP fundidos (el formulario los guarda en la misma columna; decisión documentada, no se separa en este spec).

---

## 4. Cambios en backend

### 4.1 Campos Intended (los reales)

La capa Intended se construye desde `project_frameworks` con exactamente estas 6 columnas:

| Campo | Columna | Estado |
|---|---|---|
| Positioning / VP | `brand_positioning` | Existe ✓ |
| Diferenciador | `brand_differentiator` | Existe ✓ |
| Audiencia | `brand_audience` | Existe ✓ |
| Tono | `brand_tone` | Existe ✓ |
| Arquetipo | `brand_archetype` | **Existe la columna pero el guardado project-centric la pierde → fix en §4.5** |
| R2B | `r2b` | **Ídem → fix en §4.5** |

**Solo campos de identidad.** NO incluir mercado, categoría, idioma ni objetivos.

### 4.2 Carga de la tercera fuente en `/api/intelligence/brand-dna`

Tras resolver la marca, comprobar su `role` en `project_brands`:

- `role = 'principal'` → leer las 6 columnas de §4.1.
- `role != 'principal'` → comportamiento actual (dos fuentes), output renombrado (§4.4).
- Principal con Profile vacío o casi vacío (**menos de 2 de las 6 columnas con contenido**) → degradar a dos bandas, `intended: null`, `intended_available: false`. NO inventar identidad intencionada.

### 4.3 Prompt (marca principal)

Tercer bloque de fuente antes de las instrucciones de output:

```
=== SOURCE 1: INTENDED IDENTITY (what the brand's own team states internally) ===
This is what the client has declared as their strategy. Treat it as a claim to
be tested, not as ground truth. Fields not provided are marked [not provided] —
do not infer or invent them.

Positioning / value proposition: {brand_positioning}
Key differentiator: {brand_differentiator}
Target audience: {brand_audience}
Tone: {brand_tone}
Archetype: {brand_archetype}
Reason to believe: {r2b}

=== SOURCE 2: DECLARED IDENTITY (what the website says) ===
{siteContent}

=== SOURCE 3: DEPLOYED IDENTITY (what the classified content actually does) ===
{entriesDigest}
```

Instrucciones de análisis (en el idioma del proyecto, como todo lo demás):

```
Compare the three sources and produce:

1. "intended": a faithful, compressed restatement of Source 1 (do not embellish;
   omit fields marked [not provided]).
2. "declared": the profile of what the website expresses (same fields as today's
   "expressed": purpose, hero_claim, seasonal, positioning, segments, discourse,
   expressed_role).
3. "deployed": the profile of what the content does (same fields as today's
   "validated": tone, personality, archetype, validated_role).
4. "articulation_gap": 2-4 sentences. Where does the website fail to carry the
   intended strategy? Name the specific intended claims that are absent, diluted
   or contradicted on the website. If intended and declared are coherent, say so
   explicitly — a clean bill is a valid finding.
5. "execution_gap": 2-4 sentences. Where does the deployed content diverge from
   what the website declares? (This is today's "gap", renamed.)

Rules:
- Every gap statement must reference which source contradicts which.
- Do not invent intended identity: if a field of Source 1 is [not provided], do
  not infer it.
- Audience check: explicitly compare the intended target audience against who the
  deployed content actually addresses. If they diverge, say it in execution_gap
  or articulation_gap, wherever the break occurs.
- Archetype check: if an intended archetype is provided, compare it against the
  archetype you derive from deployed content and name any mismatch.
```

### 4.4 Output v2 — **dual-shape obligatorio**

El perfil v2 escribe las keys nuevas **y además** las keys planas legacy que los reportes leen hoy (`p.claim.hero`, `p.positioning`, `p.role.expressed`, `p.voice.tone`, `p.archetype`, etc.). Motivo verificado: flagship (route.js:69) y social (route.js:81) leen rutas planas v1 e inyectan esas piezas como evidencia con `brandDnaMult = 2` en Positioning x-ray — un schema-only v2 les haría leer vacío en silencio, degradando justo la sección que más depende del Brand DNA.

```json
{
  "schema_version": 2,

  "intended": { "positioning": "", "differentiator": "", "audience": "", "tone": "", "archetype": "", "r2b": "" },
  "declared": { "purpose": "", "hero_claim": "", "seasonal": "", "positioning": "", "segments": "", "discourse": "", "expressed_role": "" },
  "deployed": { "tone": "", "personality": "", "archetype": "", "validated_role": "" },
  "articulation_gap": "",
  "execution_gap": "",
  "semantic_cloud": ["..."],
  "intended_available": true,

  "claim": { "hero": "<espejo de declared.hero_claim>" },
  "positioning": "<espejo de declared.positioning>",
  "role": { "expressed": "<espejo de declared.expressed_role>" },
  "voice": { "tone": "<espejo de deployed.tone>" },
  "archetype": "<espejo de deployed.archetype>",
  "gap": "<espejo de execution_gap>"
}
```

- Las keys espejo se rellenan **por código tras el parse de la respuesta AI** (no pedirle a la AI que duplique — una sola fuente de verdad, el espejo es mecánico).
- Replicar el resto de keys planas v1 que los routes de reportes consuman (verificar contra route.js de flagship/social/global antes de cerrar la lista).
- Competidores: mismo dual-shape con `intended: null`, `articulation_gap: null`, `intended_available: false`.
- **Compatibilidad de render:** perfiles `schema_version = 1` (o sin el campo) se renderizan con el layout de dos columnas y labels nuevos, mapeando en render (`expressed → declared`, `validated → deployed`, `gap → execution_gap`). Sin migración de datos.

### 4.5 Fix del bug de guardado del Profile (settings/page.jsx:260-288)

Bug vivo, independiente del diff pero prerequisito de la capa Intended: en proyectos project-centric, los campos **Brand archetype** y **R2B** del formulario se escriben en UI pero no se persisten (solo la rama legacy `brands` los guarda). El usuario los rellena y desaparecen.

- Añadir `brand_archetype` y `r2b` al payload de guardado de la rama project-centric, hacia sus columnas en `project_frameworks`.
- Verificar que la carga del formulario los lee de vuelta (round-trip completo).
- Si alguna de las dos columnas no existiera en `project_frameworks`, crearla en la migración de §3.1 (`ADD COLUMN IF NOT EXISTS brand_archetype text`, `... r2b text`).

---

## 5. Cambios de UI — Intelligence → Brands

### 5.1 Marca principal (tres columnas)

Tres columnas (o tarjetas apiladas en viewport estrecho), en este orden:

| Columna | Header | Subheader |
|---|---|---|
| 1 | **INTENDED** | What it wants to be |
| 2 | **DECLARED** | What it says |
| 3 | **DEPLOYED** | What it does |

Debajo, **dos cajas de gap** (mismo estilo que la caja "Gap" actual):
- `Articulation gap:` asociada a 1→2.
- `Execution gap:` asociada a 2→3.

Si `intended_available = false` → solo columnas 2-3 y empty state en el lugar de la 1: *"Complete the brand profile in Settings to unlock the intended vs declared analysis"* (link a Settings → Profile).

### 5.2 Competidores (dos columnas)

- Headers renombrados: `EXPRESSED → DECLARED · What it says`, `VALIDATED → DEPLOYED · What it does`.
- La caja de gap pasa a llamarse `Execution gap`.

### 5.3 Panel de evidencia del crawl

En el header del perfil, enlace discreto **"Source pages (N)"** que abre un panel listando `source_pages`: label + URL + primer párrafo, expandible al texto completo. Solo perfiles `schema_version = 2`.

**Distinguir analizado de capturado:** páginas con `chars_analyzed > 0` se listan como *Analyzed*; páginas con `chars_analyzed = 0` bajo un separador *Captured, not analyzed* (con nota corta: "exceeded the analysis window"). Si una página entró parcial (`chars_analyzed < chars`), indicarlo ("first N chars analyzed"). Propósito: cuando el cliente pregunte "¿dónde dice eso?", lo que se enseña como evidencia es exactamente lo que el modelo vio.

### 5.4 Poll del tab Brands — obligatorio

`loadDna()` hace hoy `select("*")` cada 10s. Con `source_pages` (~70KB/versión × versiones × marcas) eso arrastra megas por poll.

- Cambiar el select del listado a **columnas explícitas excluyendo `source_pages`** (incluir `schema_version`, `intended_snapshot` es pequeño y puede entrar o excluirse también — decidir por tamaño real).
- `source_pages` se carga **on-demand** con un select puntual al abrir el panel de §5.3.
- Verificar que ningún otro consumidor de `brand_dna` haga `select("*")` (exports PDF/Excel: cargar `source_pages` solo si el export lo necesita — no lo necesita).

---

## 6. Migración de vocabulario

- **UI:** todos los usos visibles de "Expressed" → "Declared" y "Validated" → "Deployed" (Intelligence → Brands, exports PDF/Excel del Brand DNA).
- **Código:** NO renombrar keys internas legacy ni nada en weights.js ni en los routes de reportes. Los perfiles v1 se mapean en render. Las keys nuevas solo en el bloque v2 del dual-shape.
- **Exports PDF/Excel:** labels nuevos; para la principal, incluir la columna Intended y ambos gaps.

---

## 7. QA checklist

1. Generar Brand DNA de la marca principal con Profile completo → 3 columnas, ambos gaps, cada gap referencia qué fuente contradice a cuál.
2. Generar Brand DNA de un competidor → 2 columnas con labels nuevos, solo Execution gap.
3. Principal con Profile vacío → 2 columnas + empty state con link a Settings; `intended_available = false`; sin identidad inventada.
4. **Dual-shape:** generar un perfil v2 y regenerar el reporte flagship → la sección Positioning x-ray sigue recibiendo hero claim / positioning / expressed role (verificar que no llegan vacíos). Ídem social report con tone/archetype.
5. **Bug fix:** rellenar Brand archetype y R2B en Settings → guardar → recargar → los valores persisten y se releen. Verificar en Supabase que las columnas se escriben.
6. El arquetipo intencionado aparece comparado contra el deployed en los gaps cuando hay mismatch.
7. `brand_dna.source_pages` contiene las páginas con `chars` y `chars_analyzed` correctos; una página fuera del recorte de 26k figura con `chars_analyzed = 0`.
8. Panel "Source pages (N)": separa Analyzed de Captured-not-analyzed; el parcial indica cuántos chars entraron.
9. **Poll:** con el tab Brands abierto, el request de polling NO incluye `source_pages` (verificar en Network); el panel de evidencia dispara la carga puntual.
10. `intended_snapshot` congela los valores del Profile al generar; editar el Profile después no altera el perfil generado.
11. Perfiles v1 renderizan sin errores con labels nuevos mapeados.
12. Fallback Jina → `source_pages` con entrada única `jina-fallback`.
13. Export PDF/Excel de la principal incluye Intended + ambos gaps; el export no descarga `source_pages`.

---

## 8. No tocar

- `lib/weights.js` — nada (verificado: solo mira `piece.source`, impacto cero).
- Los routes de reportes (`/api/reports/*`, `/api/intelligence/report`) — nada; el dual-shape los aísla. El accessor `declaredOf(profile)` y el consumo del schema v2 son el spec siguiente.
- La lógica de crawl (patrones, tope de páginas, deadline) — solo añadir persistencia y el conteo `chars_analyzed` en el punto de ensamblado del prompt.
- La cola background de generación — el flujo de encolado no cambia.
- Nada que haya pasado QA en Brand Profile / Entry Form.
