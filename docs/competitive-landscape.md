# Módulo — Competitive Landscape

> Spec de módulo (PRD a nivel feature). Fuente de verdad de "qué marcas participan de un
> estudio". Documento vivo — última actualización 2026-07-15.

- **Ubicación UI:** `/settings` (tab *Landscape*)
- **Fuente de verdad (hoy):** `project_frameworks` (`brand_name`, `local_competitors[]`, `global_benchmarks[]`)
- **Fuente de verdad (objetivo):** tabla `brands` normalizada (ver §5)
- **Owner del dato:** analista K&D

---

## 1. Propósito
Definir y administrar el conjunto de marcas de un estudio, clasificadas por nivel de
relación con la marca principal. Es el **single source of truth** del que leen todos los
demás módulos (captura, scout, perfiles, reportes, showcase).

## 2. Modelo conceptual (niveles)

| Nivel | Definición | Estado en el módulo |
|---|---|---|
| **Marca principal** | Para quién hacemos el estudio | Existe como `brand_name` (string), **no** como ítem estructurado |
| **Direct competitors** | Misma categoría y mercado | ✅ `local_competitors`, `type:"direct"` |
| **Adjacent competitors** | Comparten segmento, no categoría exacta | ⚠️ El dato `type:"adjacent"` ya existe y la IA ya lo devuelve; **la UI no lo distingue** → *diferido* |
| **Global references** | Marcas internacionales, misma categoría | ✅ `global_benchmarks` |

## 3. Estado actual vs objetivo (gap analysis, anclado al código)

**Modelo de datos hoy** (`project_frameworks`):
- `brand_name` → string de la marca principal (sin url/redes/logo estructurados)
- `local_competitors[]` → `{ name, type: "direct"|"adjacent", category?, sub_category?, website?: string[] }`
- `global_benchmarks[]` → `{ name, country?, website?: string[] }`

**Gaps:**
1. **Redes sociales no se guardan.** Hay `website[]` (el form de settings lo captura) pero **no hay campos ig/tiktok/youtube**. Bloquea Scout y la captura multi-fuente.
2. **El onboarding descarta datos.** Guarda `local_competitors: {name, type}` — tira el website, no pide redes. Y aún corre la **búsqueda de contenido inicial en YouTube** (el "Antes" a reemplazar). Ref: `app/onboarding/page.jsx:172`.
3. **Adjacent no tiene UI** (dato + salida de `suggest-competitors` listos; falta exponerlo).
4. **Marca principal no estructurada** (solo `brand_name`), pese a que Brand DNA/Intelligence la necesitan con url/redes.
5. **URL de crawl hardcodeada:** `DEFAULT_BRAND_URL` en `app/intelligence/page.jsx` con las 5 aerolíneas a mano → debería venir del registro de marca.
6. **Doble backend (deuda técnica):** proyectos `project_id` usan `project_frameworks`; proyectos `brand_id` legacy usan `brand_competitors`. Settings maneja ambos con ids sintéticos (`pf_l_${i}`).
7. **Showcase no lee la fuente de verdad** (no referencia `localCompetitors/globalBenchmarks`); deriva marcas de los entries. → feeds-to sin cablear.

## 4. Feeds from

**A) Onboarding (asistente)** — comportamiento objetivo:
1. Identifica: (1) marca principal, (2) hasta **5 direct**, (3) hasta **3 adjacent** *(próximamente)*, (4) hasta **5 global**.
2. Usuario selecciona participantes; la **principal por default**.
3. **Cambio clave:** en lugar de buscar contenido inicial, el sistema **identifica y guarda** por marca: **website + handles de IG, TikTok y YouTube**.
4. Tras aprobar → **auto-genera Brand DNA** (crawl web con el método actual: `app/api/intelligence/brand-dna/route.js` = `fetchDirect` + fallback `r.jina.ai`) y presenta la v1 en `/intelligence/brands`.

**B) Manual** — `/settings` Landscape: alta/edición/baja de direct, adjacent y global.

## 5. Modelo de datos objetivo — tabla `project_brands` (decisión: normalizar)

Consolidar los arrays de `project_frameworks` (+ `brand_competitors` legacy) en una tabla
normalizada. Resuelve de una vez los gaps 1, 4, 5 y 6.

> **Naming:** se llama `project_brands` (no `brands`) porque ya existe una tabla `brands`
> legacy (workspace-scoped, usada por el camino `brand_id` + `brand_competitors`) — misma
> colisión que obligó al rename `brand_profiles`→`brand_dna`.

```sql
create table project_brands (
  id             uuid primary key default gen_random_uuid(),
  project_id     text not null,
  name           text not null,
  role           text not null check (role in ('principal','direct','adjacent','global')),
  country        text,                 -- sobre todo para global
  category       text,
  sub_category   text,
  website        text,
  social         jsonb default '{}'::jsonb,  -- { instagram, tiktok, youtube }
  logo_url       text,
  brand_dna_status text default 'pending',   -- pending | generated | failed
  archived       boolean default false,      -- soft-delete: sale de listas, conserva contenido
  sort_order     int default 0,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);
create index project_brands_project_idx on project_brands(project_id);
create unique index project_brands_project_name_uidx on project_brands(project_id, lower(name));
```

- `creative_source` gana `project_brand_id uuid` (FK a `project_brands`, nullable en transición); se mantiene el string de marca para retro-compat y para contenido de marcas archivadas. **Ojo:** `creative_source.brand_id` ya existe y apunta al workspace legacy (`brands`) — significado distinto, no reutilizar.
- **Colisión adicional detectada (2026-07-15):** en la DB vive una `project_brands` huérfana de un diseño anterior (referida en `MIGRATION_frameworks.sql`, esquema distinto, sin uso en código). La migración la renombra a `project_brands_legacy` antes de crear la nuestra.
- **Migración/backfill:** `MIGRATION_project_brands.sql` puebla desde `project_frameworks.local_competitors` (role=`direct`/`adjacent` según `type`), `global_benchmarks` (role=`global`), `brand_name` (role=`principal`) y, best-effort, el camino legacy `brand_competitors`+`brands` (cuando el own-brand tiene `project_id`). Idempotente.

**Estrategia de transición (paso 1 — IMPLEMENTADO 2026-07-15):**
- `lib/project-brands.js`: `listProjectBrands` · `deriveFrameworkLists` (deriva las shapes legacy desde filas) · `syncProjectBrands` (upsert por nombre normalizado + **archive-on-delete**).
- Los dos loaders (`lib/framework-loader.js` server y `lib/framework-context.js` client) **prefieren `project_brands`** cuando tiene filas de competidores y caen a los arrays si no; además exponen `projectBrands[]` y `principalBrand`.
- **Dual-write:** `persistFw()` en settings sigue escribiendo los arrays y sincroniza el registro tras cada escritura — cero divergencia mientras la UI siga sobre los arrays. El paso 2 mueve el CRUD de settings a `project_brands` directamente.

## 6. Feeds to (con cómo leen hoy)

| Consumidor | Cómo lee hoy | Estado |
|---|---|---|
| **Creative Source** (form nuevo caso + filtros) | `framework.localCompetitors/globalBenchmarks` (`audit/page.jsx:400`) | ✅ cableado |
| **Scout** (forms + marquesina) | une nombres de ambas listas (`scout/page.jsx:169`) | ✅ |
| **Intelligence** (brand profiles) | por marca; crawl con URL del caller | ⚠️ URL hardcodeada |
| **Report** (form de generación) | une `localCompetitors + globalBenchmarks` (3 reportes core) | ✅ |
| **Showcase** (form de generación) | deriva de entries | ❌ no cableado a la fuente de verdad |

## 7. Requisitos funcionales (user stories + criterios de aceptación)

- **Ver** marcas agrupadas por nivel (Principal · Direct · Adjacent · Global).
  - AC: principal fija/destacada; cada grupo lista sus ítems con conteo de contenidos.
- **Añadir** marca con: nombre, país (global), categoría, **website** y **handles IG/TikTok/YouTube**.
  - AC: persiste en `brands`; aparece de inmediato en Creative Source, Scout y Report sin recargar (`refreshFramework()`).
- **Editar** cualquier campo (incl. redes) → se refleja en todos los consumidores.
- **Mover** una marca entre niveles (direct↔adjacent) — *cuando se active adjacent*.
- **Onboarding** produce el mismo esquema que el alta manual (paridad, incl. redes) y dispara Brand DNA.

## 8. Comportamiento de borrado — **decisión: archivar**
Remover una marca hace **soft-delete** (`archived = true`):
- Sale de listas, dropdowns y filtros de todos los consumidores.
- **Sus contenidos en Creative Source se conservan** (la marca queda como "archivada/oculta").
- Reversible (des-archivar la reincorpora con su contenido).
- Rationale: es el caso de uso más común (limpiar el estudio sin perder capturas ya hechas) y no es destructivo.

## 9. Casos borde / preguntas abiertas
- Marca que es **direct en un proyecto y global en otro** (el rol depende del proyecto → el rol vive en `brands`, no en la marca global).
- **Dedupe** por nombre normalizado (`norm()` en settings) — extender a handles.
- **Handles inválidos/privados** al crawl → `brand_dna_status = failed`, permitir reintento.
- Consolidar el **doble backend** (`brand_competitors` → `brands`).
- Cablear **Showcase** a la fuente de verdad.

## 10. Fuera de alcance (por ahora)
- Distinción/identificación de **Adjacent** en la UI (dato listo; UI diferida).
- Auto-detección de campañas/colecciones (otro módulo).

## 11. Métricas de éxito
- % de marcas con website + ≥1 red social completos.
- % de proyectos donde el Brand DNA se autogeneró en onboarding sin intervención manual.
- 0 lecturas hardcodeadas de URLs de marca (todas desde `brands`).

---

## Anexo — referencias de código (estado a 2026-07-15)
- Settings Landscape: `app/settings/page.jsx` (~L500+, `persistFw`, `pf_l_/pf_g_`, `newComp.proximity`)
- Fuente de verdad actual: `lib/framework-loader.js:73-74` (`localCompetitors`, `globalBenchmarks`)
- Onboarding save: `app/onboarding/page.jsx:172` (descarta website/redes; corre YouTube inicial)
- Sugeridor IA: `app/api/suggest-competitors/route.js` (ya devuelve `type: direct|adjacent`)
- Crawl Brand DNA: `app/api/intelligence/brand-dna/route.js` (`fetchDirect` + `r.jina.ai`)
- Consumidores: `app/audit/page.jsx:400`, `app/scout/page.jsx:169`, reportes `app/reports/{flagship,social,global}`
