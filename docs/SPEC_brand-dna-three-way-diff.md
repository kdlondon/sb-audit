# SPEC — Brand DNA: diff a tres bandas + persistencia del crawl crudo

**Prioridad:** Alta · **Módulo:** Intelligence → Brands (Brand DNA) · **Fecha:** 2026-07-16

---

## 1. Objetivo

Elevar el Brand DNA de una comparación a dos bandas (web vs contenido) a un **diagnóstico a tres bandas** para la marca principal:

| Capa | Fuente | Nombre nuevo |
|---|---|---|
| Lo que quiere ser | Campos del Profile en `project_frameworks` | **Intended** |
| Lo que dice públicamente | Crawl de su website | **Declared** (antes "Expressed") |
| Lo que hace de verdad | Entries clasificadas en `creative_source` | **Deployed** (antes "Validated") |

Y de esa comparación salen **dos gaps nombrados** (en vez del gap único actual):

- **Articulation gap** — Intended vs Declared: la estrategia interna no llega a la web.
- **Execution gap** — Declared vs Deployed: la web promete una cosa, el contenido hace otra.

**Regla de asimetría:** el diff a tres bandas solo aplica a la marca con `role = 'principal'` en `project_brands`. Los competidores (direct/adjacent/global) mantienen el diff a dos bandas (Declared vs Deployed, con el Execution gap). No tenemos su identidad intencionada y eso es correcto.

Además, este spec corrige un problema de evidencia: hoy el texto crudo del crawl (`siteContent`, ~26k chars) **se descarta** tras generar el perfil. Eso hace que la capa Declared sea inauditable ("¿dónde dice eso en su web?" → no podemos enseñarlo). A partir de ahora, las páginas crudas se persisten junto a cada versión del perfil.

---

## 2. Alcance

**Incluye:**
1. Persistir las páginas crudas del crawl en `brand_dna`.
2. Inyectar los campos del Profile como tercera fuente en el prompt de `/api/intelligence/brand-dna` (solo marca principal).
3. Nuevo schema de output del perfil: `intended` / `declared` / `deployed` + `articulation_gap` / `execution_gap`.
4. UI del perfil en Intelligence → Brands: tres columnas para la principal, dos para el resto. Renombrar labels.
5. Migración de vocabulario: "Expressed/Validated" → "Declared/Deployed" en UI y en el output nuevo.

**NO incluye (explícitamente fuera):**
- Cambios en el weight engine (`lib/weights.js`). El weight engine sigue tratando el Brand DNA como fuente de alto peso; internamente puede seguir usando la key legacy `expressed` — NO renombrar nada dentro de weights.js en este spec.
- Category context / brand_metrics (specs separados, más adelante).
- Cambios en los 3 reportes core (consumirán el nuevo perfil en un spec posterior).
- Re-crawlear perfiles existentes. Los perfiles viejos siguen siendo válidos con su schema legacy.

---

## 3. Cambios de base de datos

### 3.1 Migración `MIGRATION_brand_dna_v2.sql`

```sql
-- Páginas crudas del crawl, versionadas junto al perfil
ALTER TABLE brand_dna
  ADD COLUMN IF NOT EXISTS source_pages jsonb DEFAULT NULL;

-- Snapshot de los campos del Profile usados en la generación (solo principal)
ALTER TABLE brand_dna
  ADD COLUMN IF NOT EXISTS intended_snapshot jsonb DEFAULT NULL;

-- Versión de schema del perfil para distinguir legacy (2 bandas) de v2 (3 bandas)
ALTER TABLE brand_dna
  ADD COLUMN IF NOT EXISTS schema_version int NOT NULL DEFAULT 1;
```

**Formato de `source_pages`:**
```json
[
  { "url": "https://grupoinsur.com/", "label": "home", "chars": 6890, "text": "..." },
  { "url": "https://grupoinsur.com/nosotros", "label": "about", "chars": 5420, "text": "..." }
]
```

- Guardar el texto **ya truncado** a los 7.000 chars/página que el crawl usa hoy (no re-truncar distinto).
- Si el crawl cayó al fallback de Jina, guardar una sola entrada con `label: "jina-fallback"`.
- Los perfiles nuevos escriben `schema_version = 2`. Los existentes quedan en 1 y no se tocan.

**Formato de `intended_snapshot`** (copia literal de lo que había en el Profile al momento de generar — para que el diff sea auditable aunque el Profile cambie después):
```json
{
  "positioning": "...",
  "value_proposition": "...",
  "key_differentiator": "...",
  "target_audience": "...",
  "brand_tone": "...",
  "brand_archetype": "..."
}
```

---

## 4. Cambios en `/api/intelligence/brand-dna`

### 4.1 Carga de la tercera fuente

Tras resolver la marca, comprobar su `role` en `project_brands`:

- Si `role = 'principal'` → leer de `project_frameworks` los campos de identidad del brand profile: `positioning`, `value_proposition` (VP), `key_differentiator`, `target_audience`, `brand_tone`, `brand_archetype`.
- **Solo campos de identidad.** NO incluir mercado, categoría, idioma ni objetivos — son configuración operativa, no afirmaciones de identidad.
- Si `role != 'principal'` → comportamiento actual (dos fuentes), pero con el output renombrado (ver 4.3).
- Si la marca es principal pero el Profile está vacío o casi vacío (menos de 2 campos de identidad rellenos) → degradar a dos bandas y marcar `intended: null` en el output, con un flag `intended_available: false`. NO inventar una identidad intencionada a partir de nada.

### 4.2 Prompt (marca principal)

Añadir un tercer bloque de fuente al prompt existente, antes de las instrucciones de output:

```
=== SOURCE 1: INTENDED IDENTITY (what the brand's own team states internally) ===
This is what the client has declared as their strategy. Treat it as a claim to
be tested, not as ground truth.

Positioning: {positioning}
Value proposition: {value_proposition}
Key differentiator: {key_differentiator}
Target audience: {target_audience}
Tone: {brand_tone}
Archetype: {brand_archetype}

=== SOURCE 2: DECLARED IDENTITY (what the website says) ===
{siteContent}

=== SOURCE 3: DEPLOYED IDENTITY (what the classified content actually does) ===
{entriesDigest}
```

Instrucciones de análisis a añadir (en el idioma del proyecto, como todo lo demás):

```
Compare the three sources and produce:

1. "intended": a faithful, compressed restatement of Source 1 (do not embellish).
2. "declared": the profile of what the website expresses (same fields as today's
   "expressed": purpose, hero_claim, positioning, segments, discourse, expressed_role).
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
- Do not invent intended identity: if a field of Source 1 is empty, do not infer it.
- Audience check: explicitly compare the intended target_audience against who the
  deployed content actually addresses. If they diverge, say it in execution_gap
  or articulation_gap, wherever the break occurs.
```

### 4.3 Output schema v2

```json
{
  "schema_version": 2,
  "intended": { "...": "restatement de los campos del profile" } ,
  "declared": { "purpose": "", "hero_claim": "", "seasonal": "", "positioning": "", "segments": "", "discourse": "", "expressed_role": "" },
  "deployed": { "tone": "", "personality": "", "archetype": "", "validated_role": "" },
  "articulation_gap": "",
  "execution_gap": "",
  "semantic_cloud": ["..."],
  "intended_available": true
}
```

Para competidores: mismo schema con `intended: null`, `articulation_gap: null`, `intended_available: false`. El `execution_gap` sustituye 1:1 al `gap` actual.

**Compatibilidad:** el frontend debe seguir renderizando perfiles con `schema_version = 1` (o sin el campo) con el layout actual de dos columnas y labels nuevos (mapear `expressed → declared`, `validated → deployed`, `gap → execution_gap` solo a nivel de render, sin migrar datos).

### 4.4 Persistencia

Al guardar la fila en `brand_dna`:
- `source_pages` = array de páginas crudas (4.1 de este spec, sección 3.1).
- `intended_snapshot` = copia de los campos leídos del Profile (solo principal; NULL si no aplica).
- `schema_version` = 2.

---

## 5. Cambios de UI — Intelligence → Brands

### 5.1 Marca principal (tres columnas)

Layout de tres columnas (o tres tarjetas apiladas en viewport estrecho), en este orden:

| Columna | Header | Subheader |
|---|---|---|
| 1 | **INTENDED** | What it wants to be |
| 2 | **DECLARED** | What it says |
| 3 | **DEPLOYED** | What it does |

Debajo, **dos cajas de gap** (mismo estilo visual que la caja "Gap" actual):
- `Articulation gap:` entre las columnas 1→2 (o debajo, etiquetada).
- `Execution gap:` entre las columnas 2→3.

Si `intended_available = false` → mostrar solo columnas 2-3 y un empty state en el lugar de la columna 1: *"Complete the brand profile in Settings to unlock the intended vs declared analysis"* (link a Settings → Profile).

### 5.2 Competidores (dos columnas)

- Headers renombrados: `EXPRESSED → DECLARED · What it says` y `VALIDATED → DEPLOYED · What it does`.
- La caja de gap pasa a llamarse `Execution gap`.

### 5.3 Evidencia del crawl

En el header del perfil (donde hoy está "Latest / URL / Update"), añadir un enlace discreto **"Source pages (N)"** que abre un panel/modal listando las páginas crudas guardadas (`source_pages`): label + URL + primer párrafo, con opción de expandir el texto completo. Solo para perfiles `schema_version = 2`.

Propósito: cuando un cliente pregunte "¿dónde dice eso?", se enseña la fuente.

---

## 6. Migración de vocabulario

- **UI:** todos los usos visibles de "Expressed" → "Declared" y "Validated" → "Deployed" (Intelligence → Brands, exports PDF/Excel del Brand DNA).
- **Código:** NO renombrar keys internas de datos legacy ni el weight engine. Los perfiles v1 se mapean en render. Las keys nuevas (`declared`, `deployed`) solo en schema v2.
- **Exports PDF/Excel:** usar los labels nuevos; para la principal incluir la columna Intended y ambos gaps.

---

## 7. QA checklist

1. Generar Brand DNA de la marca principal con Profile completo → perfil de 3 columnas, ambos gaps presentes, cada gap referencia qué fuente contradice a cuál.
2. Generar Brand DNA de un competidor → 2 columnas con labels nuevos, solo Execution gap.
3. Marca principal con Profile vacío → 2 columnas + empty state con link a Settings; `intended_available = false`; sin identidad inventada.
4. `brand_dna.source_pages` contiene las páginas crawleadas (verificar en Supabase: labels coinciden con `meta.pagesCrawled`).
5. `intended_snapshot` guarda los valores del Profile al momento de generar; editar el Profile después NO altera el perfil ya generado.
6. Perfiles antiguos (v1) siguen renderizando sin errores, con labels nuevos mapeados.
7. Crawl con fallback Jina → `source_pages` con entrada única `jina-fallback`.
8. "Source pages (N)" abre el panel y muestra el texto crudo.
9. Los 3 reportes core siguen generando sin cambios (no consumen el schema nuevo todavía).
10. Export PDF/Excel de la principal incluye Intended + ambos gaps.

---

## 8. No tocar

- `lib/weights.js` (weight engine) — nada.
- Las rutas de reportes (`/api/reports/*`, `/api/intelligence/report`) — nada.
- La lógica de crawl (patrones, tope de páginas, deadline) — solo añadir la persistencia, no cambiar el descubrimiento.
- La cola background de generación — el flujo de encolado no cambia.
- Nada que haya pasado QA en Brand Profile / Entry Form.
