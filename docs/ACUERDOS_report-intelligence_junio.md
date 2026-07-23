# Acuerdos de junio — Intelligence + Report

_Recopilación fiel de lo decidido contigo el **2026-06-17**, **2026-06-20** y **2026-06-24**._
_Punto de partida para rediseñar el flujo de Report. No incluye propuestas nuevas mías: lo que es interpretación va marcado._

---

## 0. La premisa que enmarca todo

> **Los informes SON el producto que se vende al cliente.** Intelligence + Report son el valor central de Groundwork. Usuario primario = **el analista de K&D**.

---

## 1. El modelo Pipeline (resolvió el solape Intelligence ↔ Report)

Los dos módulos se duplicaban: ambos tenían dashboard y "generar informe". Se decidió:

- **Intelligence = el taller de análisis.** Donde el analista piensa y explora. Vistas granulares y modulares: overview, explore (pilares/subpilares/territorios), Brand DNA, insights. *La pestaña "Generate" de Intelligence desaparece.*
- **Report = la capa de ensamblaje y entrega.** El producto que se vende. **Prediseñado, persistente, editable, exportable.**
- **Findings = el puente persistente** (nuevo). Sustituye los "Analyst Picks" efímeros de localStorage por una estantería en base de datos. Cualquier cosa de Intelligence se puede "guardar como finding".

> Lo granular vive en Intelligence; **el entregable sólido y consolidado vive en Report.**

---

## 2. Onboarding = el configurador

En la creación del proyecto se decide todo lo que adapta los módulos:

- **ICP** (Brand / Agency / VC-Startup) → preset de objetivos.
- **Objetivo(s)** → adaptan los widgets de Intelligence **y** el bloque "Suggested" de Report.
- **Marcas participantes + URLs → auto-crawl de Brand DNA al crear el proyecto** (el analista no genera perfiles a mano).
- Report muestra dos bloques: **"Suggested for your objective"** + **"All reports"**.

*Estado: NO construido. Sigue siendo el front pendiente.*

---

## 3. Catálogo consolidado — 3 informes, no 15 fragmentos

Decisión explícita: **consolidar hace el producto MÁS sólido.**

- **Core 1 — Strategic Positioning (flagship).** Consolida Positioning + Category + Hero consistency + White Space en UN arco. Tiene control de **scope (una marca ↔ categoría)** y **lente ICP**. Sus secciones son **extraíbles como sub-informes**.
- **Core 2 — Social Content Benchmark.** Exhaustivo, cross-ICP.
- **Core 3 — Global Creative Inspiration.** Casos globales destacados, cross-ICP, guiado por el modificador de calidad.
- **Add-ons / lentes** (nicho, no productos sueltos): Convention & Disruption, Challenger vs Incumbent.

### Arco del flagship — 6 secciones
1. **Executive read** (encuadrar) — titular estratégico, con lente ICP.
2. **Category landscape** (mapear) — territorios y propiedad. *Profundo en scope categoría.*
3. **Positioning x-ray** (diagnosticar) — expresado (Brand DNA) vs validado (comportamiento del contenido); la brecha. *Profundo en scope marca.*
4. **Hero & message consistency** (comprobar) — intención Hero + tagline web en el tiempo; deriva. *Profundo en scope marca.*
5. **White space & opportunity** (abrir) — huecos de cobertura.
6. **Strategic recommendations** (actuar) — con lente ICP.

### Lente ICP — NO son informes separados
Mismo análisis y mismos pesos base = una sola fuente de verdad. La lente solo cambia **el encuadre ejecutivo, el ángulo de las recomendaciones y el énfasis** (sobre todo secciones 1 y 6).
Brand: *"¿dónde me muevo o me protejo?"* · Agency: *"el territorio que vendo + el diagnóstico que justifica el encargo"* · VC/Startup: *"¿es defendible y distinto?"*.

---

## 4. El motor de pesos — el IP central

**Peso base = fuerza de la fuente (1–3) × tier de intención (1–3) → 0–9.**

- **Fuente 3**: spot TV/YouTube · posicionamiento web declarado · perfil Brand DNA.
- **Fuente 2**: post social Hero · OOH · formato largo.
- **Fuente 1**: post IG/TikTok estándar · stories.
- **Intención 3**: Brand Hero / posicionamiento. **2**: brand-tactical / innovación. **1**: producto / promo / testimonial.

Escalera resultante: film hero YouTube = 9 · posicionamiento web = 9 · post social hero = 6 · brand-tactical = 4 · producto/promo = 3 · táctico IG/TikTok = 2.

**Modificadores:** recencia (decae pasados ~3 años) · calidad (`rating`) · el Brand DNA web es fuente "expresada" de primer nivel.

**El peso es POR SECCIÓN** — esto es lo que concentra cada informe:
- Landscape: base, todas las intenciones.
- Positioning x-ray: Brand DNA ×2, Hero ×1.5, táctico ×0.5.
- Hero consistency: SOLO Hero + tagline web; producto/táctico ×0.
- White space: cuenta cobertura, no peso.
- Exec/Recs: síntesis + lente ICP.

### Tres modos por familia de informe
- **Brand-signal** (flagship): intención × fuente — *"lo más definitorio de marca"*.
- **Performance** (Social Benchmark): engagement — *"qué funciona"*. **No penaliza lo táctico.**
- **Quality** (Global Inspiration): rating / distintividad — *"lo mejor y transferible"*.

---

## 5. Todo informe es configurable ANTES de generar

Flujo para TODOS: elegir tipo → **Configure** (por sección: reordenar · incluir/excluir · prompt específico de sección · ajustar scope y lente ICP) → Generar → editar/exportar.
Las dimensiones de curación y peso se eligen **aquí, antes de generar**.

---

## 6. Rúbrica de rating — multidimensional y POR TIPO DE PIEZA

La IA puntúa dimensiones según el tipo de pieza (cada una 1–5 + una línea de justificación); el rating global es la media; **el analista puede sobrescribir**.
- **Hero / spot:** distintividad · craft · claridad estratégica · resonancia.
- **Social:** hook · craft nativo de plataforma · encaje de marca · tracción.
- **Posicionamiento / web:** claridad · distintividad · credibilidad.
- **Producto / promo:** claridad de oferta · persuasión · construcción de marca.

Hace el rating defendible y alimenta el modo *quality*.

---

## 7. Findings = overlay inteligente, NO el esqueleto

Los informes son **prediseñados** (estructura + casos + pesos). Los findings del analista se **colocan en la estructura existente por afinidad**, o se recogen en un slot "Analyst findings".

> **El rigor lo da la plantilla y los pesos; el analista enriquece.**

---

## 8. IA por módulo — cada uno con su trabajo y su audiencia

- **Creative Source** = la BIBLIOTECA. Ver todo, filtrar, reproducir, colecciones. Audiencia: todos.
- **Scout** = ENCONTRAR material nuevo.
- **Intelligence** = el TALLER analítico. Audiencia: estrategas.
- **Showcase** = el mundo de INSPIRACIÓN. Muy visual. Audiencia: creativos + cliente.

> Este reparto de audiencia por módulo es la estrella polar que evita que se solapen.

---

## 9. Coste de cada informe nuevo

La base estratégica (valor, catálogo, motor de pesos, lente ICP, findings, scope) se define **una vez y se reutiliza**. Cada informe nuevo solo necesita una **"report card"** ligera: (a) estructura de secciones, (b) perfil de peso, (c) para qué ICPs se sugiere y de qué datos vive.

---

## 10. Ideas aparcadas (con fecha y fase)

- **Magazine View** — revista editorial con scroll/parallax, autogenerada, **edición semanal recurrente** ("qué cambió esta semana"). Vive en **Showcase**, no en Report. Roadmap: **Phase 5**.
- **Colecciones temáticas autogeneradas** (Creative Source) — el sistema detecta campañas sostenidas y **sugiere** una colección; nunca la crea sola.
- Tres capas que no se deben mezclar: **Collections** = agrupar MATERIAL · **Findings** = guardar CONCLUSIONES · **Showcase** = PRESENTAR.

---

## 11. Estado de construcción (a 2026-06-24)

**Construido y en producción:** los 3 informes core, el motor de pesos con sus 3 modos, la lente ICP, los findings con su tabla, la rúbrica de rating, el editor TipTap compartido, y regenerar por sección.

**Pendiente desde junio:** el **onboarding configurador** (ICP → objetivo → informes/widgets sugeridos + auto-crawl de Brand DNA), Intelligence D2/D3, y el Magazine.

---

## 12. Dónde el handoff de IT 3 se sale de estos acuerdos

*(Esto es observación mía al cruzar ambos documentos, no un acuerdo de junio.)*

| Handoff IT 3 pide | Vs. junio |
|---|---|
| Documento **editable** en la app | ✅ **Sí estaba**: "prediseñado, persistente, **editable**, exportable" |
| **Exportar** (.md / .pdf) | ✅ **Sí estaba**: "exportable" |
| **Estados** (In process / In review / Delivered) | ⚠️ **Nuevo.** No aparece en junio |
| **Comentarios** + raíl + subrayado anclado | ⚠️ **Nuevo.** No aparece en junio |
| **Ask about this** (asistente sobre selección) | ⚠️ **Nuevo.** No aparece en junio |
| **6 informes extra** en "All reports" | ❌ **Contradice** la consolidación en 3 |
| Library como landing | ⚠️ Nuevo, pero coherente con "persistente" |

Tu intuición encaja con esto: **"editable + exportable" sí se acordó; toda la capa de revisión (comentar, estados, preguntar sobre la selección) es alcance nuevo que aparece por primera vez en este handoff.**
