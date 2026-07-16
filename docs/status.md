# Groundwork — Estado por módulo

_Snapshot tras la iteración de 2026-07-16. ✅ completado · ⏳ pendiente._

## 🚀 Onboarding
✅ Idioma como PRIMERA pregunta (el chat cambia al idioma elegido; español completo, otros → inglés) · sugerencia IA de competidores (locales direct/adjacent, globales misma-categoría con prioridad UK/US/EU/LATAM, contexto de posicionamiento) · identificación + **verificación** de webs (juez IA sobre contenido real + fallback dominio↔nombre para sitios blindados) y YouTube (Data API); variantes `grupoX.com` para nombres cortos · escribe el registro `project_brands` · Brand DNA en cola background reanudable + loader en vivo · fix: "Continuar" ya no descarta una marca escrita sin añadir.
⏳ **Objetivos: se guardan pero NO se usan** (→ onboarding configurator, el gran pendiente) · verificación IG/TikTok (manuales).

## 🗺️ Competitive Landscape (Settings)
✅ Tabla normalizada `project_brands` (migración + backfill) como fuente de verdad · 4 niveles Principal (destacada) / Direct / Adjacent (dato fluye) / Global · CRUD con web + IG/TikTok/YouTube · remover = archivar (conserva contenido, estante restaurable) · dropdowns de taxonomía · reverse-sync a arrays legacy · editar web re-encola Brand DNA.
⏳ UI dedicada de Adjacent (diferida) · vincular contenido por ID (`project_brand_id`, hoy por nombre) · cablear Showcase al registro · consolidar camino legacy Scotiabank.

## 🔎 Selectores de marca (barrido transversal)
✅ La marca principal ya aparece en: formulario de alta de Creative Source + su filtro, Scout + form Social, scope de reportes, tab Brands. (Raíz del bug recurrente, cerrada.)

## 🧠 Intelligence
✅ Perfiles Brand DNA agrupados por los 4 niveles, acordeón (cerrado por defecto), chips de estado, web desde el registro (no hardcodeada), auto-refresh, export PDF + Excel · tab Brands ya no depende de tener contenido · cola Brand DNA global (píldora de progreso, reanudable) · **engagement = engagement RATE (%)** en todo (helper único, captura de seguidores) · Findings overlay (shelf en DB).
⏳ Dashboard D2/D3 (widgets por objetivo / por prompt) · el rate solo se puebla con capturas nuevas.

## 📄 Reports
✅ Catálogo core completo: Strategic Positioning (flagship), Social Content Benchmark, Global Creative Inspiration · filtros globales + regen por sección + Edit en editor TipTap compartido + citas · Findings overlay en los 3 · rating rubric alimentando el modo quality.
⏳ Colocación de findings por afinidad es a nivel prompt, no slots estructurados.

## ⭐ Rating rubric
✅ Dimensiones por tipo de pieza en analyze, desglose guardado + panel en Audit. ⏳ Override por dimensión (hoy solo el overall).

## 🎨 Creative Source · Scout · Showcase
✅ Principal en formularios/filtros; captura social (IG/TikTok vía Apify) con seguidores. ⏳ Showcase→registro, Magazine (Phase 5), auto-colecciones.

## ⚙️ Deuda técnica / acciones pendientes del usuario
- `JINA_API_KEY` en Vercel (crawls de sitios blindados)
- Idioma de proyectos pre-selector → cambiar a Español manualmente
- Dos backends de marcas a consolidar · contenido por nombre → por ID

---
**Mayor valor dormido:** activar los **objetivos del onboarding** (configurator: objetivo → widgets + reportes sugeridos). Todo lo demás son cierres/pulidos.
