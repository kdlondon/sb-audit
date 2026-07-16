# Groundwork — Product Sheet

_Actualizado 2026-07-16. Refleja la arquitectura vigente tras la introducción del
Competitive Landscape registry, Brand DNA, el weight engine, el catálogo de reportes
consolidado, Findings y el engagement rate._

## Platform Overview

**Groundwork** es una plataforma de inteligencia competitiva impulsada por AI, desarrollada por **Knots & Dots (K&D)**. Analistas capturan comunicaciones competitivas ("entries"), las enriquecen con AI, y producen reportes, dashboards, perfiles de marca y presentaciones cinematográficas. Nació para Scotiabank ("SB Audit") y hoy es un motor multi-tenant genérico impulsado por frameworks por proyecto.

| | |
|---|---|
| **Stack** | Next.js 14 (App Router) · React 18 · Tailwind 3.4 · Supabase (Postgres/Auth/Storage/RLS, EU) · Anthropic Claude · YouTube Data API · Apify (social) · Jina (crawl) |
| **URL** | [groundwork.kad.london](https://groundwork.kad.london) — Vercel, auto-deploy desde `main` |
| **Sin** | TypeScript · suite de tests (JSX plano) |

### Modelo conceptual — el Pipeline
Groundwork se organiza como un **pipeline de inteligencia** de cuatro capas, que resuelve el solapamiento histórico entre módulos:

1. **Capturar** — *Creative Source* (biblioteca) + *Scout* (descubrimiento) → contenido competitivo clasificado.
2. **Configurar** — *Competitive Landscape* (marcas del estudio) + *Framework* (dimensiones de análisis) + *Brand DNA* (posicionamiento declarado vs desplegado).
3. **Analizar** — *Intelligence* (workspace analítico: dashboards, insights, exploración, perfiles) donde el analista piensa y guarda **Findings**.
4. **Entregar** — *Report* (el producto vendido) + *Showcase* (presentación). Los reportes son prediseñados, persistentes, editables y exportables.

**Findings** son el puente persistente entre Analizar y Entregar: cualquier conclusión en Intelligence se guarda como finding (en DB) y se superpone a los reportes.

---

## Architecture: Multi-Tenant SaaS

### Tier System

| Tier | Nombre | Descripción |
|---|---|---|
| **Tier 1** | Essential | Auditoría estándar. Dimensiones genéricas (archetype, tone, execution, funnel, rating). Sin frameworks propietarios. |
| **Tier 2** | Enhanced | Tier 1 + dimensiones custom del cliente (hasta 6). |
| **Tier 3** | Specialist | Tier 2 + framework propietario con reglas de clasificación, cross-references, lifecycle. Ejemplo: Scotiabank (4 Portraits, Entry Doors, Journey Phases, Moments That Matter). |

### Organization Model
- **K&D Platform Super Admin** — gestiona Clients, Admins internos y Projects.
- **Client (Agency/Brand)** — gestiona sus Admins y Projects.
- **Roles:** `platform_admin` · `org_admin` · `analyst` · `viewer`
- **Plans:** `trial` · `basic` · `standard` · `premium` *(informativo)*

### Per-Project Framework
Cada proyecto tiene su `project_frameworks`: brand profile, industry, market, **language**, objectives, tier, dimensions, communication intents, competitors y benchmarks. **Todos los prompts AI se construyen dinámicamente desde el framework** y se escriben en el idioma del proyecto (definido en el onboarding). Fuentes en otro idioma se traducen al del proyecto.

### Competitive Landscape Registry — fuente de verdad de marcas
`project_brands` es el **registro normalizado** de las marcas de cada estudio, clasificadas en 4 niveles. Todos los módulos que ofrecen marcas (captura, filtros, scout, reportes, perfiles) leen de aquí.

| Nivel | Significado |
|---|---|
| **principal** | La marca objeto del estudio |
| **direct** | Competidores de misma categoría y mercado |
| **adjacent** | Marcas cercanas por segmento (dato ya fluye; UI dedicada pendiente) |
| **global** | Referencias internacionales de la misma categoría |

Cada marca guarda `website`, `social` (IG/TikTok/YouTube), `brand_dna_status` y `archived` (soft-delete: remover archiva, conserva el contenido capturado, restaurable). El registro se alimenta desde el **Onboarding** (auto) y desde **Settings → Competitive Landscape** (manual). Los loaders de framework prefieren el registro y hacen fallback a los arrays legacy durante la transición.

---

## Modules

### 1. CREATIVE SOURCE — Captura y clasificación
> La biblioteca: capturar, clasificar, filtrar y organizar piezas de comunicación. (Antes "Audit".)

- **Doble scope:** Local (competidores) + Global (benchmarks). Vistas: entries, Collections, Map.
- Soporta imágenes (URL + upload + crop), videos YouTube (embed + frame capture), PDFs, y **posts sociales** (IG/TikTok).
- Multi-select fields (coma-separados), URLs compartibles, mover entries Local↔Global, country autocomplete.
- **AI Analysis:** *"Analyze with AI"* → Claude auto-clasifica todos los campos del framework.
- **Rating rubric multidimensional:** el AI puntúa dimensiones definidas por el **tipo de pieza** (hero/social/positioning/product), cada una 1–5 con justificación; el rating = promedio; panel de desglose visible; el analista puede sobrescribir.
- La marca **principal** aparece en el formulario y en el filtro (no solo competidores).

#### Secciones del formulario
| Sección | Campos |
|---|---|
| **A. Identification** | competitor/brand, category, year, type, communication intent, funnel, rating, URL, image, slogan, transcript |
| **B. Creative Evaluation** | synopsis, insight, idea, territories, execution style, analyst comment |
| **C. Entrepreneur Identity** *(Tier 3)* | entry door, experience, portrait, richness |
| **D. Business Journey** *(Tier 3)* | journey phase, lifecycle, moments |
| **E. Brand & Communication** | bank role, pain points, language register, VP, attributes, benefits, R2B |
| **F. Execution** | channel, CTA, tone, representation, industry, size, archetype, differentiation |
| **Social** *(posts)* | content_pillar, platform, format, post_objective + `_meta` (likes, comments, views, **followers**, posted_at, caption) |

> Las secciones C y D se ocultan en Essential/Enhanced.

---

### 2. SCOUT — Descubrimiento de contenido
> Descubrir y capturar contenido competitivo.

- **YouTube:** búsqueda por marca/categoría/keywords, AI relevance ranking, filtros (región 50+ países, timeframe, duración, oficial vs todo), accept/skip → entries.
- **Social (Apify):** feed de Instagram/TikTok de un perfil → selección múltiple → import como entries, con métricas (likes, comments, views, **followers** para engagement rate).
- Marquesina de sugerencias y AI assistant. La lista de marcas incluye la **principal** + todos los niveles del registro.

---

### 3. INTELLIGENCE — Workspace analítico
> Donde el analista piensa, explora, perfila y decide. (Absorbe el antiguo Dashboard.)

Tabs: **Dashboard · Insights · Explore · Brands · Generate**.

- **Dashboard:** filtros por competidor, KPI tiles estilo KD, volumen por marca, mix de pilares, cadencia por día, heatmap Marca × intent con drill, y el **Journey/Campaign Map** como widget.
- **Engagement = ENGAGEMENT RATE (%)** en toda la sección — `interacciones ÷ seguidores` (fallback a `÷ views`), fórmula única compartida con los reportes. Comparable entre marcas de cualquier tamaño (se acabó el conteo absoluto).
- **Insights:** el AI genera insights accionables (white space, differential, engagement, timing, creative) sobre el landscape de pilares y engagement.
- **Explore:** drill pilar → subpilares (clustering AI) → posts.
- **Brands (Brand DNA):** perfiles por marca agrupados por los 4 niveles, en **acordeón**, con estado (Queued/Generating/Failed/✓). Cada perfil contrasta **Expressed** (lo que la web dice) vs **Validated** (lo que el contenido hace) + el gap. La generación corre en una **cola background reanudable** (píldora de progreso en toda la app). Export **PDF + Excel**.
- **Findings:** marcar un insight lo guarda como **finding en DB** (reemplaza los "Analyst Picks" en localStorage). Sobreviven sesiones/dispositivos y se superponen a los reportes.

---

### 4. REPORT — Generación de reportes AI
> El producto vendido. Catálogo consolidado de 3 reportes core + templates legacy.

#### Catálogo core (destacados)
| Reporte | Familia de peso | Secciones |
|---|---|---|
| **Strategic Positioning** (flagship) | brand-signal (intent × source) | Executive read · Category landscape · Positioning x-ray (expressed vs validated) · Hero & message consistency · White space · Recommendations |
| **Social Content Benchmark** | performance (engagement rate) | Snapshot · Territories & angles · Personality & voice · Declared vs deployed · What's working · Cadence/format/platform · Takeaways |
| **Global Creative Inspiration** | quality (rating) | Curation rationale · The cases (galería what/why/transferable) · Patterns · Transferable plays |

Todos con **scope** (una marca ↔ categoría) y **ICP lens** (Brand / Agency / VC) que cambia el framing sin duplicar el análisis.

#### El Weight Engine (el IP core)
`lib/weights.js` re-pondera la evidencia por sección. **Peso base = fuerza de la fuente (1–3) × tier de intent (1–3)** → 0–9, con modificadores de recencia y calidad. Tres **modos** según la familia del reporte: brand-signal (intent×source), performance (engagement rate), quality (rating). La marca DNA (web declarada) es una fuente "expressed" de alto peso.

#### Funcionalidades
- **Configure global** antes de generar: filtros (marcas / intents-pilares-plataformas / rango de años / min-rating), reordenar/incluir/excluir secciones, dirección por sección, instrucciones globales, y selección de **Findings** a superponer.
- **Regeneración por sección** (~10s) sin rehacer el reporte completo.
- **Edición:** botón *Edit* abre el **editor TipTap compartido** (`/reports/editor`) — Visual/Source, toolbar, insertar casos con `@`, autosave. El reporte se guarda como `saved_report`.
- **Anti-hallucination:** solo usa evidencia provista; citas `cite:ENTRY_ID` → clickeables al entry (con imagen). Nunca menciona pesos/metodología.
- Export PDF, generación de Showcase desde un reporte, templates legacy (Competitor Snapshot, Category Landscape, Opportunity, Creative Intelligence, Innovation, Agnostic).

---

### 5. SHOWCASE — Presentaciones creativas
> Presentaciones cinematográficas con branding K&D.

- Slide types (Title, Key Findings, Finding, Takeaways, Closing) + Competitor Snapshot slides.
- Themes con detección light/dark, editor de slides (contenido, reorden, content blocks), PDF export (html2pdf), links públicos compartibles.
- Generado desde datos de Creative Source o desde reportes existentes.
- *Roadmap:* **Magazine** — edición editorial auto-generada/semanal ("qué cambió esta semana"). *Pendiente: cablear los filtros de marca al registro.*

---

### 6. CHAT — Análisis conversacional
> Conversar con los datos para obtener insights.

- Acceso a Local + Global. Citas `[ENTRY:id]` → panel lateral con el detalle del entry (video/imagen/metadata/insight/notas).
- Markdown rendering, suggested questions por tier, historial de contexto, system prompt dinámico (brand/industry/market/competitors del framework).

---

### 7. SETTINGS — Configuración del proyecto

| Tab | Contenido |
|---|---|
| **Project Info** | Nombre, cliente, descripción, objetivos, fechas |
| **Profile** | Brand profile (nombre, mercado, categoría, VP, diferenciador, audiencia, tono) + **Language** (idioma que usan todas las llamadas AI) |
| **Competitive Landscape** | **CRUD del registro `project_brands`**: Principal destacada · Direct · Global (Adjacent con badge). Web + IG/TikTok/YouTube por marca. Remover = archivar (restaurable). AI-suggest. Reverse-sync a los consumidores. |
| **Framework** | Vista del framework: tier, dimensiones, intents, categorías, dimensiones custom/specialist |

> Brand DNA (perfiles de marca) vive ahora en **Intelligence → Brands**, no en Settings. Las Communication Intents son parte del **Framework**, no del profile.

---

### 8. ONBOARDING — Setup conversacional
> Configurar un proyecto de forma guiada. El asistente escribe directamente el registro y dispara los perfiles.

| Step | Descripción |
|---|---|
| **0. Idioma** | **Primera pregunta siempre.** El chat cambia al idioma elegido; será el de todo el análisis y los reportes. |
| **1. Brand Profile (Chat)** | El AI extrae marca, mercado, categoría, VP, diferenciador, tono, audiencia, objetivos. |
| **2. Competidores** | AI propone hasta 5 direct + 3 adjacent (misma categoría/mercado) + 5 global (misma categoría, líderes, prioridad UK/US/EU/LATAM). El usuario selecciona; la principal por default. |
| **3. Digital presence** | En lugar de buscar contenido inicial, el sistema **identifica y VERIFICA** el website (juez AI sobre contenido real + fallback dominio↔nombre) y el canal de YouTube (Data API) de cada marca; IG/TikTok manuales. Los links son editables. |
| **4. Finalize** | Crea `projects`, `project_frameworks`, escribe el registro `project_brands` (con web/redes), y **encola la generación de Brand DNA** por cada marca con web (cola background reanudable, loader en vivo). |

**Saves to:** `projects` · `project_access` · `project_frameworks` · `project_brands` · `dropdown_options`
**Pendiente clave:** los **objetivos** se guardan pero aún no configuran la plataforma (→ *onboarding configurator*: objetivo → widgets de Intelligence + reportes sugeridos).

---

### 9. ADMIN — Platform Super Admin *(K&D)*
Clients (crear/editar, stats), Client Detail (activity log, proyectos, usuarios), K&D Admins, Platform Analytics (projects/entries/reports/showcases, intent & rating distribution, drill-down).

### 10. USER MANAGEMENT
Crear usuarios por rol (platform_admin/analyst para K&D; org_admin/analyst/viewer para el cliente) vía Supabase Auth + `organization_members`. Asignación a proyectos. MFA por email.

### 11. CHROME EXTENSION
Capturar frames de video, imágenes y texto desde el navegador → `/api/extension` → crea entry.

---

## AI Integration — Anthropic Claude

### Models
| Model | Uso |
|---|---|
| **`claude-sonnet-4-6`** | Prácticamente todo: análisis de entries, chat, reportes (los 3 core), insights, Brand DNA, sugerencias, verificación de links |
| **`claude-opus-4-8`** | Ranking puntual de scout (heredado) |

> Nota: los reportes ya **no** usan Opus — corren en Sonnet 4.6 con el weight engine + prompts por sección.

### Dynamic Prompt Injection
Todos los prompts se construyen desde `project_frameworks` (`buildPromptContext`): Tier 1 → perfil genérico; Tier 2 → + custom dimensions; Tier 3 → + `framework_text`. Incluye instrucción de **idioma del proyecto** y solo pide los campos que el framework define.

### API Routes (selección)
| Ruta | Función |
|---|---|
| `/api/analyze` | Clasificación de entries (imagen/video/PDF) + rating rubric |
| `/api/ai`, `/api/ai/copilot` | Chat / copiloto del editor |
| `/api/suggest-competitors` | Sugerencias de competidores (categoría-consciente) |
| `/api/brand-links` | Identificar + verificar web/YouTube de cada marca (onboarding) |
| `/api/intelligence/brand-dna` | Crawl web + cruce con contenido → perfil Brand DNA (fallback Jina) |
| `/api/intelligence/insights` · `/report` · `/subpillars` | Insights, reporte social, clustering de subpilares |
| `/api/reports/flagship` · `/social` · `/global` | Los 3 reportes core |
| `/api/social/feed` | Feed de IG/TikTok vía Apify (con followers) |
| `/api/youtube-scout` · `/youtube` · `/youtube-frames` | Scout y proxy YouTube |
| `/api/save-report` · `/create-user` · `/extension` | Persistencia, usuarios, extensión |

**Env:** `ANTHROPIC_API_KEY`, `YOUTUBE_API_KEY`, `APIFY_TOKEN`, `JINA_API_KEY` (crawl de sitios que bloquean IPs de datacenter), Supabase keys.

---

## Database Schema — Supabase PostgreSQL

### Core
| Tabla | Descripción |
|---|---|
| `organizations` · `organization_members` · `clients` | Tenants, membresías, CRM |
| `projects` · `project_access` | Proyectos y acceso granular |
| `project_frameworks` | Config por proyecto (tier, brand profile, language, dimensions, intents, arrays legacy de competidores) |
| **`project_brands`** | **Registro normalizado de marcas** (role principal/direct/adjacent/global, website, social jsonb, brand_dna_status, archived). Fuente de verdad del Competitive Landscape. |
| `folders` | Organización futura |

### Contenido
| Tabla | Descripción |
|---|---|
| **`creative_source`** | **Tabla principal de entries** (local + global vía columna `scope`; `project_brand_id` FK en transición). Reemplaza a los antiguos `audit_entries`/`audit_global`. |
| `brand_dna` | Perfiles Brand DNA versionados (expressed vs validated). Antes `brand_profiles`. |
| `findings` | Shelf de conclusiones del analista (Intelligence → Report) |
| `saved_reports` | Reportes generados |
| `saved_showcases` | Presentaciones (slides JSONB) |
| `dropdown_options` · `taxonomy_terms` | Vocabularios por proyecto |

### Auth / Admin
`user_roles` (legacy), `client_activity_log`, tablas MFA.

> **Migraciones:** `MIGRATION_project_brands.sql` (registro + backfill), `MIGRATION_findings.sql`. Correr en el SQL editor de Supabase.

---

## Design System — KD Design System

Tokens `--kd-*` en `globals.css`:

| Token | Valor | Uso |
|---|---|---|
| `--kd-cream` | `#FFF7F0` | Fondo cálido |
| `--kd-blue` | `#011EFF` | Ultramarine eléctrico — acento/CTA |
| `--kd-ember` | `#FF4A1A` | Spark/alerta (raro) |
| `--kd-black` | `#000` | Nav flotante, texto |
| Data ramp | `--kd-data-1..6` | Categóricos por **rango** (no identidad de marca) |

- **Fonts:** IBM Plex (Sans/Serif/Mono).
- **Nav:** isla negra flotante con nivel-2 segmentado (pill centrado + herramientas circulares).
- **Data-viz KD:** estilos Signal / Capsule (pills y anillos redondeados) / Field.
- **Charts:** Recharts + SVG a mano para el estilo Capsule. **PDF:** html2pdf. **Rich text:** TipTap.

---

## Environments
| Entorno | Config |
|---|---|
| **Production** | [groundwork.kad.london](https://groundwork.kad.london) — Vercel, auto-deploy desde `main` |
| **Local** | `npm run dev` (requiere `.env.local`) |

_Ver [`docs/status.md`](status.md) para el detalle de features completados/pendientes por módulo, y [`docs/competitive-landscape.md`](competitive-landscape.md) para la spec del registro de marcas._
