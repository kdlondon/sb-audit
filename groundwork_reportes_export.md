# Groundwork — Documentación de Reportes (export)

> Documento generado leyendo el proyecto `sb-audit` (Groundwork). No modifica código ni diseño:
> solo consolida lo que está **definido** en el repositorio y en las notas de arquitectura, y marca
> explícitamente lo que **no está definido todavía**.
>
> Regla aplicada: nada se inventa. Donde un dato no existe en el proyecto, se escribe literalmente
> "pendiente" o "no definido".

---

## 1. Visión general

### Qué es Groundwork

Plataforma SaaS multi-cliente de inteligencia competitiva de Knots & Dots: los analistas capturan
"entradas" de marketing de competidores (anuncios, páginas, vídeos), las enriquecen con IA y producen
reportes, dashboards, mapas de journey y presentaciones cinemáticas. Originalmente construida para
Scotiabank ("SB Audit"), hoy es un motor multi-tenant genérico dirigido por frameworks por proyecto.

> **Nota:** en las notas de diseño internas se afirma además que "los reportes SON el producto que se
> vende a los clientes" — es decir, los reportes son el núcleo de valor de Groundwork. Esto es una
> definición de producto, no una frase de marketing pulida.

### Dos capas distintas que conviven hoy

Hay que separar dos cosas, porque el proyecto está a medio camino entre un sistema antiguo y un rediseño:

- **A) Reportes implementados y funcionando** — viven en `app/reports/page.jsx` (catálogo de plantillas)
  más el reporte flagship en `app/reports/flagship/`. Esto es lo que existe y corre hoy.
- **B) Catálogo consolidado rediseñado (visión de producto)** — definido en la nota de arquitectura
  `project_intelligence_report_architecture.md` (decidido 2026-06-20). Es el modelo objetivo: consolidar
  ~15 fragmentos en 3 reportes "core" + lentes/add-ons. Algunas piezas están construidas, otras solo
  diseñadas, otras solo esbozadas.

Ambas capas se documentan abajo y se marca el estado de cada una.

### Lista completa de reportes definidos

**Capa A — Plantillas implementadas (en `app/reports/page.jsx`):**

1. Competitor Snapshot
2. Category Landscape
3. Opportunity Report
4. Creative Intelligence
5. Innovation Report
6. Agnostic Competitor Snapshot
7. Strategic Positioning Report (flagship) — implementado aparte, en `app/reports/flagship/`

**Capa B — Catálogo consolidado (visión rediseñada):**

8. Core 1 — Strategic Positioning Report (flagship) — *es el mismo nº7, ya parcialmente construido*
9. Core 2 — Social Content Benchmark
10. Core 3 — Global Creative Inspiration
11. Add-on / lente — Convention & Disruption
12. Add-on / lente — Challenger vs Incumbent

**Módulo Intelligence (relacionado, no es "reporte" pero genera uno):**

13. Social Media Benchmark — reporte generado desde la pestaña "Generate" de `app/intelligence/`

### Agrupación por ICP — aclaración importante (hueco real)

El usuario pidió agrupar por ICP (agencia / founder / marca). **Eso no se puede hacer limpiamente con
lo definido**, y conviene marcarlo como hueco:

- En el catálogo rediseñado, **el ICP es una LENTE, no un eje que separe reportes**. La misma análisis
  + los mismos pesos base = una sola fuente de verdad; la lente solo cambia el encuadre ejecutivo, el
  ángulo de las recomendaciones y el énfasis. Por tanto los reportes core son **cross-ICP**, no
  "reportes de agencia" vs "reportes de marca".
- Además, **la lista de ICPs es inconsistente entre fuentes** del propio proyecto:
  - Código del flagship (`app/reports/flagship/page.jsx`): **brand / agency / vc**.
  - Nota de arquitectura (2026-06-20): **Brand / Agency / VC-Startup**.
  - Nota de spec más antigua: **Agency / Founder / Brand**.
  - El término "founder" que mencionó el usuario aparece solo en la nota antigua; en el código vigente
    es "vc". **Cuál es la taxonomía oficial de ICP está pendiente de decidir.**

Por eso, en lugar de agrupar por ICP (lo cual obligaría a inventar asignaciones), abajo se documenta
cada reporte con su campo "ICP / comprador al que sirve" usando solo lo que cada fuente dice
explícitamente, y donde no hay dato se marca "no definido".

---

## 2. Fichas por reporte

> Sobre el campo **Tier (READ / RADAR / COMMAND)**: ver sección 3. Adelanto: **ningún reporte tiene un
> tier asignado** en el proyecto. READ/RADAR/COMMAND aparece una sola vez en las notas, descrito como
> "cadence", marcado como algo que "informará el encuadre más adelante; no es parte del primer build".
> Por eso en todas las fichas el tier figura como **"no asignado"**.

---

### 2.1 Competitor Snapshot

- **Nombre del reporte:** Competitor Snapshot
- **ICP / comprador:** no definido (la plantilla no declara ICP).
- **Tier (READ/RADAR/COMMAND):** no asignado.
- **Qué pregunta responde:** "¿cómo es a fondo esta marca competidora en todas las dimensiones del framework?" (deep dive de una sola marca).
- **Qué contiene (secciones):**
  - Brand positioning (territorios, arquetipo, VP, insight, idea)
  - Entrepreneur identity (entry door, experiencia, portrait, richness)
  - Business journey (fase, lifecycle, momentos que importan)
  - Communication audit (rol del banco, pain points, registro de lenguaje, R2B)
  - Execution (canales, CTA, tono, representación, tamaño)
  - Campaign map (piezas organizadas por etapa de funnel y año)
  - Brand consistency (coherencia de tono, territorio, VP y arquetipo en todas las piezas)
  - K&D strategic read (síntesis editorial y señal de white space)
  - Website vs Communication (posicionamiento web oficial vs ejecución publicitaria real; gaps)
- **Qué entrega:** documento Markdown generado por IA, persistible en `saved_reports`; exportable a MD y PDF (vía print/`html2pdf`); con comentarios/resaltados y asistente contextual sobre el texto.
- **Inputs que necesita:** datos del propio proyecto — entradas de `creative_source` con `scope="local"` (una sola marca, `singleBrand`). Filtros de marca, rango de años y país. No requiere input directo del cliente más allá de los datos ya capturados. Usa `/api/ai`.
- **Tiempo estimado de entrega:** no definido.
- **Estado actual:** funcionando (plantilla activa en el catálogo `/reports`).

---

### 2.2 Category Landscape

- **Nombre del reporte:** Category Landscape
- **ICP / comprador:** no definido.
- **Tier (READ/RADAR/COMMAND):** no asignado.
- **Qué pregunta responde:** "¿cómo es toda la categoría — patrones, white spaces y mapa de posicionamiento?"
- **Qué contiene (secciones):**
  - Category overview (conteo de entradas, cobertura de marcas, rango de años)
  - Positioning landscape (mapa de territorios, autoridad producto vs humano)
  - Framework mapping (distribución de portrait, door, phase, lifecycle)
  - Moment ownership (momentos de adquisición, profundización, inesperados por marca)
  - Audience targeting (tamaño de negocio, industria, portrait — cruzados)
  - Communication patterns (tono, registro, estilo de ejecución, mix de canales)
  - Human tensions (control vs caos, crecimiento vs riesgo, apoyo vs aislamiento)
  - Driver map (defensivo, performativo, transformacional por marca)
  - White space & gaps (portraits sin reclamar, puertas vacantes, fases ignoradas)
- **Qué entrega:** documento Markdown generado por IA, con tablas comparativas cross-brand; persistible y exportable (MD/PDF).
- **Inputs que necesita:** datos del proyecto — entradas `scope="local"`, multi-marca. Filtros de marca/año/país. Solo señales ya capturadas.
- **Tiempo estimado de entrega:** no definido.
- **Estado actual:** funcionando.

---

### 2.3 Opportunity Report

- **Nombre del reporte:** Opportunity Report
- **ICP / comprador:** no definido.
- **Tier (READ/RADAR/COMMAND):** no asignado.
- **Qué pregunta responde:** "¿dónde están los gaps estratégicos — qué NO está haciendo la categoría?"
- **Qué contiene (secciones):**
  - White space map (territorio saturado vs vacante)
  - Portrait gaps (portraits de emprendedor desatendidos)
  - Door gaps (entry doors sin reclamar o débilmente ocupadas)
  - Phase gaps (fases ignoradas — especialmente complejidad y consolidación)
  - Moment gaps (momentos que aparecen en 0–1 entradas en toda la categoría)
  - Emotional & register gaps (territorio emocional y registro de lenguaje ausentes)
  - Opportunity territories (3–5 oportunidades estratégicas nombradas para la marca cliente)
- **Qué entrega:** documento Markdown; persistible y exportable (MD/PDF).
- **Inputs que necesita:** datos del proyecto, `scope="local"`, multi-marca. Regla de recencia: solo entradas de los últimos 2 años.
- **Tiempo estimado de entrega:** no definido.
- **Estado actual:** funcionando.

---

### 2.4 Creative Intelligence

- **Nombre del reporte:** Creative Intelligence
- **ICP / comprador:** no definido.
- **Tier (READ/RADAR/COMMAND):** no asignado.
- **Qué pregunta responde:** "¿qué inspiración creativa global puedo extraer — territorios, ejecución, ideas transferibles?"
- **Qué contiene (secciones):**
  - Creative landscape (territorio emocional y estratégico a nivel global)
  - Execution styles & patterns (cómo ejecutan su posicionamiento las marcas globales)
  - Archetypes & roles (qué arquetipos y roles dominan globalmente)
  - Insights & human truths (las verdades humanas detrás de la creatividad global)
  - Portrait & door intelligence (qué identidades de emprendedor abordan las marcas globales)
  - Transferable inspiration (qué puede aprender la marca cliente de los ejemplos globales)
- **Qué entrega:** documento Markdown; persistible y exportable (MD/PDF).
- **Inputs que necesita:** datos del proyecto con `scope="global"`. Enfoque de calidad: prioriza entradas con rating 4–5 estrellas.
- **Tiempo estimado de entrega:** no definido.
- **Estado actual:** funcionando.

---

### 2.5 Innovation Report

- **Nombre del reporte:** Innovation Report
- **ICP / comprador:** no definido.
- **Tier (READ/RADAR/COMMAND):** no asignado.
- **Qué pregunta responde:** "¿qué rompe la convención — qué están haciendo distinto las marcas globales?"
- **Qué contiene (secciones):**
  - Category convention (la norma global dominante — la línea base)
  - Convention breakers (entradas con mayor puntuación en diferenciación)
  - Emerging patterns (señales en 2–3 marcas, aún no mainstream)
  - Emotional frontier (el territorio emocional más valiente del set global)
  - Format & channel innovation (elecciones inusuales de formato o canal)
  - Strategic implications (3–5 señales destiladas en implicaciones accionables)
- **Qué entrega:** documento Markdown; persistible y exportable (MD/PDF).
- **Inputs que necesita:** datos del proyecto con `scope="global"`.
- **Tiempo estimado de entrega:** no definido.
- **Estado actual:** funcionando.

---

### 2.6 Agnostic Competitor Snapshot

- **Nombre del reporte:** Agnostic Competitor Snapshot
- **ICP / comprador:** no definido.
- **Tier (READ/RADAR/COMMAND):** no asignado.
- **Qué pregunta responde:** "auditoría de comunicación competitiva independiente del framework — análisis puro de marca y producto" (una sola marca, sirve para proyectos sin framework especialista).
- **Qué contiene (secciones):**
  - Understanding the Audience (demográfico, psicográfico, tensión, insight humano)
  - The Brand Response (propuesta, arquetipo, rol, posicionamiento, territorio, diferenciadores)
  - Proof Points & Communication Strategy (proof principal, puntos de apoyo, foco, tono y voz)
  - Product Communication (enfoque, mensajes clave, canales, gaps)
  - Beyond Banking & Innovation (lifestyle, comunidad, innovación, white space)
  - Brand Assessment (fortalezas y debilidades de la marca)
  - Communication Assessment (fortalezas y debilidades en comunicación)
  - Website vs Communication (posicionamiento web vs ejecución; gaps de consistencia)
- **Qué entrega:** documento Markdown; persistible y exportable (MD/PDF).
- **Inputs que necesita:** una sola marca; `scopeAny` (usa entradas local + global). Es "framework-agnostic", pensado para no depender del framework especialista del proyecto.
- **Tiempo estimado de entrega:** no definido.
- **Estado actual:** funcionando.

---

### 2.7 Strategic Positioning Report (flagship)

- **Nombre del reporte:** Strategic Positioning Report (flagship). En el catálogo rediseñado es **"Core 1"**.
- **ICP / comprador:** sirve a las tres lentes ICP definidas en código — **Brand / Agency / VC** (seleccionable en la UI). En la nota de arquitectura se sugiere para todos los ICP, con énfasis según la lente. (La lente cambia encuadre y recomendaciones, no la análisis base.)
- **Tier (READ/RADAR/COMMAND):** no asignado.
- **Qué pregunta responde:** consolida en un solo arco: posicionamiento + categoría + consistencia del hero + white space. Pregunta núcleo: "¿dónde está saturada la categoría, dónde está abierta, y cuál es el mayor movimiento estratégico?" Con un control de scope (una marca ↔ categoría) y una lente ICP.
- **Qué contiene (6 secciones — arco narrativo):**
  1. Executive read (el titular estratégico, con lente ICP)
  2. Category landscape (mapa de territorios y ownership cross-brand)
  3. Positioning x-ray (expresado [Brand DNA] vs validado [comportamiento del contenido]; el gap)
  4. Hero & message consistency (consistencia del mensaje hero en el tiempo y entre canales; drift)
  5. White space & opportunity (gaps de cobertura; nombra 3–5 territorios de oportunidad)
  6. Strategic recommendations (4–6 acciones priorizadas, con lente ICP)
- **Qué entrega:** documento estructurado en secciones, renderizado en `/reports/flagship` con citas clicables a las piezas (`cite:ID`); guardable en `saved_reports` (`template_type: "flagship_positioning"`); exportable a PDF vía print CSS. Meta incluye nº de marcas, nº de piezas analizadas y nº de perfiles Brand DNA.
- **Inputs que necesita:** datos del proyecto (`creative_source`) + perfiles **Brand DNA** (`brand_dna`) como fuente "expresada". No requiere input manual del cliente. Aplica el **motor de pesos** (`lib/weights`, modo `brand_signal`): cada sección re-pondera la evidencia por fuerza de señal (intent × source) + recencia. Modelo IA: `claude-sonnet-4-6`. `maxDuration` 300s; en la UI se anuncia "~60s".
- **Tiempo estimado de entrega:** ~60 segundos de generación (anunciado en la UI). No hay un SLA de "entrega al cliente" definido.
- **Estado actual:** funcionando (página + API `/api/reports/flagship` implementadas). Dentro de la visión rediseñada se considera la pieza "más difícil", ya parcialmente construida; pendientes: las secciones como sub-reportes extraíbles y la superposición de findings (ver sección 3).

---

### 2.8 Core 2 — Social Content Benchmark

- **Nombre del reporte:** Social Content Benchmark (Core 2 del catálogo consolidado).
- **ICP / comprador:** sugerido para todos los ICP, **especialmente Marcas + Agencias** (según nota de arquitectura).
- **Tier (READ/RADAR/COMMAND):** no asignado.
- **Qué pregunta responde:** "¿cómo están usando las redes sociales los competidores y qué funciona?" Exhaustivo, cross-ICP. Scope: categoría (filtrable a 1 marca).
- **Qué contiene (secciones — refinadas 2026-06-20):**
  1. Snapshot
  2. Territories & angles (el núcleo vital): no solo pilares sino los subtemas/ángulos que usa cada competidor dentro de un territorio compartido → dónde tenemos un rol por defecto → la oportunidad de re-angular
  3. Personality & voice (comparación de `tone_of_voice` + `brand_archetype` entre marcas)
  4. Declared vs deployed (slogan/VP del Brand DNA vs comunicación social real; consistencia/gap, en versión ligera y acotada a social)
  5. What's working (engagement)
  6. Cadence, format & platform
  7. Takeaways (con lente ICP)
- **Qué entrega:** no definido como artefacto final formal en el catálogo rediseñado. *Nota:* existe un MVP relacionado en el módulo Intelligence (ver 2.13) que produce un reporte social editorial.
- **Inputs que necesita:** posts sociales y sus campos (`_social`: pillar/format/platform/objective; `_meta`: engagement, posted_at), `rating`, y Brand DNA. Solo señales ya capturadas. Depende del clustering de subpilares guardado (sección 2).
- **Tiempo estimado de entrega:** no definido.
- **Estado actual:** **report card diseñado** (2026-06-20). Marcado como "factible ahora" porque mucho ya existe como widgets en Intelligence, pero el reporte consolidado como tal **no está construido** (lo más cercano es el MVP de Intelligence, 2.13).

---

### 2.9 Core 3 — Global Creative Inspiration

- **Nombre del reporte:** Global Creative Inspiration (Core 3 del catálogo consolidado).
- **ICP / comprador:** sugerido para todos, **especialmente Agencias + Marcas**.
- **Tier (READ/RADAR/COMMAND):** no asignado.
- **Qué pregunta responde:** "¿cuáles son los mejores/más distintivos casos globales como inspiración para lo nuestro?"
- **Qué contiene (secciones):**
  - Curation rationale (criterio de curaduría)
  - The cases (galería: qué es / por qué funciona / idea transferible)
  - Patterns
  - Transferable plays for client
- **Qué entrega:** no definido formalmente. **Decisión pendiente:** ¿es un Reporte que exporta a Showcase, o algo separado? (Se solapa con el módulo Showcase.) Los findings / curaduría del analista son lo más importante aquí.
- **Inputs que necesita:** el pool de **benchmark global** (`scope="global"`), no los competidores locales. `rating` (selector primario), `execution_style`/`territory`/`archetype`, imagen/vídeo, `analyst_comment`.
- **Tiempo estimado de entrega:** no definido.
- **Estado actual:** **report card diseñado**, pero requiere que el benchmark global esté poblado. No construido. Decisión Reporte-vs-Showcase pendiente.

---

### 2.10 Add-on / lente — Convention & Disruption

- **Nombre:** Convention & Disruption
- **ICP / comprador:** no definido.
- **Tier (READ/RADAR/COMMAND):** no asignado.
- **Qué pregunta responde:** no detallado. Concebido como una **sección / lente**, no como producto independiente.
- **Qué contiene:** no detallado.
- **Qué entrega:** no es un reporte standalone — es una lente/sección dentro de otros reportes.
- **Inputs que necesita:** no definido.
- **Tiempo estimado:** no definido.
- **Estado actual:** **esbozado** (mencionado como add-on/lente niche; sin report card).

> Nota: existe una plantilla implementada relacionada — "Innovation Report" (2.5) — que aborda
> ruptura de convención. Si "Convention & Disruption" es lo mismo, una evolución, o una lente
> distinta, **no está definido**.

---

### 2.11 Add-on / lente — Challenger vs Incumbent

- **Nombre:** Challenger vs Incumbent
- **ICP / comprador:** no definido.
- **Tier (READ/RADAR/COMMAND):** no asignado.
- **Qué pregunta responde:** no detallado. Es una **lente sobre el Landscape**.
- **Qué contiene:** no detallado.
- **Qué entrega:** no es standalone — lente sobre otros reportes.
- **Inputs que necesita:** requiere **tagging de incumbente/challenger** que aún no existe.
- **Tiempo estimado:** no definido.
- **Estado actual:** **esbozado** (necesita el tagging previo; sin report card).

---

### 2.12 Social Media Benchmark (módulo Intelligence — "Generate")

> No es un "reporte" del catálogo `/reports`, pero genera un documento entregable y conviene incluirlo
> porque es la implementación más avanzada de la idea "Social Content Benchmark".

- **Nombre del reporte:** Social Media Benchmark (pestaña "Generate" de `app/intelligence/`)
- **ICP / comprador:** no asignado en este build (las notas dicen que ICP y cadence "informan más adelante; no son parte del primer build").
- **Tier (READ/RADAR/COMMAND):** no asignado.
- **Qué pregunta responde:** benchmark de redes sociales — qué publican y qué funciona entre competidores; white space, diferencial, mejor momento para postear, qué genera engagement.
- **Qué contiene:** documento editorial compuesto por `/api/intelligence/report` — título + resumen ejecutivo + recomendaciones, construido alrededor de los "Analyst Picks" y los datos; incluye header, summary, mosaico, picks y recomendaciones.
- **Qué entrega:** documento editorial en pantalla + "Descargar PDF" (print CSS aislando `#intel-report`). Persistido por proyecto.
- **Inputs que necesita:** entradas sociales del proyecto ya analizadas con IA (pilares/tono/territorio) + los "Analyst Picks" (bookmarks, hoy en localStorage). Algunos widgets funcionan ya con señales crudas (engagement, cadencia, formato, plataforma) sin análisis IA.
- **Tiempo estimado de entrega:** no definido.
- **Estado actual:** funcionando (MVP A→E completo para Social Media Benchmark, según notas del 2026-06-17), construido sobre datos de Plus Ultra (aerolíneas).

---

## 3. Lo que NO está definido todavía

Lista explícita de huecos, decisiones pendientes y reportes esbozados pero no detallados.

### Tiers READ / RADAR / COMMAND — el hueco más grande

- **Ningún reporte tiene un tier asignado.** READ/RADAR/COMMAND no aparece en el código de reportes ni
  en las fichas de diseño. Solo se menciona **una vez**, en una nota antigua, descrito como una
  "cadence" que, junto con los ICP, "informarán el encuadre y el output más adelante; no son parte del
  primer build".
- **No está definido:** qué significa cada tier (READ vs RADAR vs COMMAND), qué reportes caen en cada
  uno, si es una cadencia (frecuencia de entrega) o un nivel de profundidad/precio, ni cómo se relaciona
  con los tiers de proyecto existentes (Essential / Enhanced / Specialist, que son otra cosa).

### Segmentación de ICP — inconsistente y sin cerrar

- Tres taxonomías distintas conviven en el proyecto: **brand/agency/vc** (código del flagship),
  **Brand/Agency/VC-Startup** (arquitectura) y **Agency/Founder/Brand** (spec antigua). "Founder" solo
  existe en la nota antigua.
- **Pendiente:** decidir la taxonomía oficial de ICP.
- **Pendiente:** el mapa ICP → objetivos, y el mapa objetivo → {widgets de Intelligence, reportes
  sugeridos}. Ambos figuran explícitamente como "pendientes de diseño" en las notas.
- Importante: el catálogo rediseñado **no segmenta reportes por ICP** — el ICP es una lente. Si el
  objetivo de negocio es vender "paquetes por ICP", esa estructura de empaquetado **no está definida**.

### Reportes esbozados pero no detallados

- **Convention & Disruption** (2.10): sin secciones, sin pregunta, sin inputs. Solo nombrado como lente.
  Relación con el "Innovation Report" ya implementado: sin definir.
- **Challenger vs Incumbent** (2.11): sin detalle; además depende de un tagging incumbente/challenger
  que no existe.
- **Global Creative Inspiration** (2.9): report card diseñado, pero (a) necesita el pool global poblado
  y (b) tiene una decisión abierta — ¿Reporte que exporta a Showcase o módulo separado?
- **Social Content Benchmark** (2.8): report card diseñado; el reporte consolidado como tal no está
  construido (solo el MVP de Intelligence, que es afín pero no idéntico).

### Output tangible / entrega — parcialmente definido

- Para las plantillas implementadas (2.1–2.7) el output es claro: Markdown + export MD/PDF, persistido en
  `saved_reports`.
- Para los reportes solo diseñados (Core 2, Core 3, lentes) el **artefacto final concreto no está
  definido** (¿doc?, ¿set de slides?, ¿dashboard?, ¿export a Showcase?).
- **Tiempo de entrega al cliente:** no definido para ningún reporte (solo existe el "~60s" de generación
  técnica del flagship). No hay SLA ni cadencia de entrega documentada.

### Piezas de diseño pendientes (declaradas como tales en las notas)

- Modelo de datos de **Findings** + el affordance "save as finding" (hoy los "Analyst Picks" viven en
  localStorage; el rediseño quiere una "estantería" persistente en DB).
- **Trigger de auto-crawl** de Brand DNA en el onboarding.
- **Configurador previo a generar** ("Configure": reordenar / incluir-excluir secciones, prompt por
  sección, ajustar scope y lente ICP). Existe parcialmente en `/reports` (overrides de sección +
  `customInstructions`); el resto es evolución pendiente.
- **Rúbrica de rating** multi-dimensional por tipo de pieza: definida en concepto (dimensiones por tipo,
  1–5 + override del analista), pero **no implementada** (hoy el rating es un simple 1–5).
- **Motor de pesos**: implementado para el flagship (`lib/weights`, modo `brand_signal`). Los otros dos
  modos descritos —**performance mode** (Social Benchmark, dirigido por engagement) y **quality mode**
  (Global Inspiration, dirigido por rating)— están **diseñados pero no confirmados como implementados**
  fuera del flagship.
- **Magazine View** (formato editorial recurrente auto-generado en Showcase): idea documentada,
  roadmap Fase 5; no construido.

### Decisiones de catálogo aún abiertas

- ¿El flagship (Core 1) expone sus secciones como **sub-reportes extraíbles**? Diseñado, no construido.
- ¿Cómo se colocan los **findings del analista** dentro de la estructura de cada reporte (por afinidad
  de tema, o en un slot dedicado "Analyst findings")? Definido en concepto, no implementado.
- Relación entre las **plantillas viejas** (2.1–2.6) y el **catálogo consolidado** (Core 1–3): el plan
  es consolidar ~15 fragmentos en 3 core + lentes, pero **la migración / deprecación de las plantillas
  viejas no está definida**. Hoy ambas capas coexisten.

---

*Fin del export. Generado a partir de `app/reports/page.jsx`, `app/reports/flagship/page.jsx`,
`app/api/reports/flagship/route.js` y las notas de arquitectura del proyecto. Los huecos se han marcado
literalmente; no se ha rellenado nada por suposición.*
