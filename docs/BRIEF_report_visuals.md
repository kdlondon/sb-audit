# Brief para Claude Design — tratamiento visual de las secciones del reporte

**Fecha:** 2026-07-24 · **Producto:** Groundwork (Knots & Dots) · **Módulo:** Reportes v2

---

## 1. Qué es un reporte y cómo se lee

Un reporte es **el entregable del analista de K&D al cliente**. Se genera sección a sección
con IA sobre las piezas capturadas en Creative Source, se lee en pantalla y **se descarga en
PDF o Markdown** para trabajarlo en Drive. Todo lo que se diseñe tiene que sobrevivir a esa
descarga.

La lectura es larga: 4 a 7 secciones de prosa densa. El visual **no decora, rompe el muro**:
da al lector un punto de entrada por sección y le deja ver de un vistazo lo que el texto
tarda tres párrafos en decir.

**Regla:** un visual acompaña a la prosa que tiene al lado, y habla de lo mismo. Ya nos pasó
lo contrario —un gráfico de territorios junto a una sección que hablaba de espacios vacíos—
y el resultado fue peor que no poner nada.

---

## 2. Lo que ya existe (no rediseñar salvo que haga falta)

Seis bloques construidos y en uso, del handoff GW3:

| Bloque | Qué es | Dónde se usa |
|---|---|---|
| `kpi` | Fila de cifras grandes con etiqueta | Executive read, Snapshot |
| `bars` | Ranking horizontal, primera barra en ember | Territorios, What's working |
| `split` | Reparto apilado (formatos, plataformas) | Cadence |
| `heatmap` | Marca × dimensión, celda destacada | Personality & voice |
| `quadrant` | 2×2 con píldoras | Category landscape, White space |
| `pullquote` | Cita en Klamp | Transversal |

**Sistema:** paleta ember de acento único (`#FF4A1A`, deep `#DF5C29`, tint `#FFCFBC`), ink
cálido, papel `#F4EFE9`. Klamp 105 para display y cifras, IBM Plex Mono para etiquetas, IBM
Plex Sans para cuerpo. Para gráficos multi-serie hay paleta cálida: arcilla `#BE6B45`, ocre
`#C6A15B`, topo `#A89B88`. Ancho de contenedor 1180.

---

## 3. El principio que cualquier visual nuevo debe respetar

Cada visual declara **de dónde salen sus números**:

- **MEDIDO** — calculado de las piezas capturadas. Nunca se le pregunta a la IA. Ej.: cuántas
  piezas por territorio, engagement medio por pilar.
- **ANALÍTICO** — el motor lo devuelve como dato junto a la prosa, porque **el dato medible no
  existe**. Ej.: los espacios en blanco: si nadie ocupa un territorio, no hay piezas que
  contar.

Esto no es un tecnicismo: **un entregable de cliente no puede presentar un juicio como si
fuera una medición**. El cuadrante de white space ya lo resuelve —ejes en lenguaje
cualitativo y una nota que dice que es la lectura del analista— pero conviene que el sistema
tenga **una marca visual consistente** para distinguirlos. Eso es parte de lo que pedimos.

---

## 4. Revisión sección por sección

Estado: ✅ diseñado y construido · ⚠️ construido sin diseño propio · ❗ sin tratamiento

### 4.1 STRATEGIC POSITIONING REPORT (flagship, 6 secciones)

| # | Sección | Qué dice | Dato disponible | Visual | Estado |
|---|---|---|---|---|---|
| 01 | **Executive read** | Titular estratégico, con lente ICP | Piezas analizadas, nº marcas, nº territorios, piezas en rango | `kpi` | ✅ |
| 02 | **Category landscape** | Territorios ocupados y quién posee qué | Por territorio: nº piezas, nº marcas, rating medio | `bars` + `quadrant` (MEDIDO) | ✅ |
| 03 | **Positioning x-ray** | Lo que la marca **declara** (Brand DNA / web) frente a lo que **demuestra** (contenido), y la brecha | Perfil `brand_dna` por marca + piezas por marca (territorio, arquetipo, tono, eslogan) | **`compare` — NUEVO** | ❗ |
| 04 | **Hero & message consistency** | Si el mensaje principal se sostiene en el tiempo y entre canales | Por pieza: eslogan, año, canal, marca | **`timeline` / consistencia — NUEVO** | ❗ |
| 05 | **White space & opportunity** | Territorios que nadie ocupa → oportunidades | El motor devuelve sus huecos: nombre, cuán trabajado, cuánto tirón, marca más cercana | `quadrant` (ANALÍTICO) | ✅ |
| 06 | **Strategic recommendations** | Acciones concretas priorizadas | Prosa; el motor podría devolver prioridad/esfuerzo | Por decidir — ¿tarjetas priorizadas? | ❗ |

### 4.2 SOCIAL CONTENT BENCHMARK (core, 7 secciones)

| # | Sección | Qué dice | Dato disponible | Visual | Estado |
|---|---|---|---|---|---|
| 01 | **Snapshot** | Quién publica más, quién gana más, pilares y plataformas dominantes | Por marca: nº posts, engagement medio, top pilares, día más activo, mix formato/plataforma | `kpi` + `bars` | ⚠️ |
| 02 | **Territories & angles** | Pilares y el ángulo de cada marca dentro de ellos | Por pilar: posts, marcas, engagement medio | `bars` | ⚠️ |
| 03 | **Personality & voice** | Tono y arquetipo entre marcas | Tono top por marca | `heatmap` | ⚠️ |
| 04 | **Declared vs deployed** | Posicionamiento de web/perfil frente a lo que hace social | Perfil de marca + posts | **`compare` — NUEVO** (misma estructura que x-ray) | ❗ |
| 05 | **What's working** | Pilares, formatos y posts que ganan engagement | Engagement medio por pilar y formato | `bars` | ⚠️ |
| 06 | **Cadence, format & platform** | Ritmo de publicación y mix | Mix de formato y plataforma, día más activo | `split` | ⚠️ |
| 07 | **Takeaways** | Conclusiones con lente ICP | Prosa | Ninguno (cierre limpio) | — |

### 4.3 GLOBAL CREATIVE INSPIRATION (core, 4 secciones)

> **Actualizado 2026-07-24:** el motor ya está conectado. *Curation rationale* lleva `kpi` y
> *Patterns* lleva `bars`, ambos medidos. **La galería ya devuelve sus datos** (id del caso,
> qué es, por qué funciona, idea transferible) y se guardan en el informe: en cuanto exista el
> diseño, dibuja sin regenerar nada. Mientras tanto no se pierde — el `.md` descargado ya la
> exporta con enlace a cada caso.

| # | Sección | Qué dice | Dato disponible | Visual | Estado |
|---|---|---|---|---|---|
| 01 | **Curation rationale** | Qué hace que un caso merezca entrar | Criterios; nº casos, rating medio, países | ¿Franja de criterios + `kpi`? | ❗ |
| 02 | **The cases** | Galería curada: qué es, por qué funciona, idea transferible | Por pieza: miniatura/URL, marca, país, rating, eslogan, sinopsis, **enlace al caso** | **`cases` — NUEVO. La pieza más importante del brief** | ❗ |
| 03 | **Patterns** | Qué se repite entre los mejores casos | Recuento de territorios/recursos entre los seleccionados | `bars` o nube de recursos | ❗ |
| 04 | **Transferable plays** | Movimientos concretos para el cliente | Prosa; el motor puede devolver la lista | ¿Tarjetas de jugada? | ❗ |

### 4.4 INNOVATION REPORT (core, 5 secciones)

> **Actualizado 2026-07-24:** conectado. *Executive read* `kpi`, *Innovation map* y *Who's
> moving* `bars` (medidos), y **Gaps & open ground** reutiliza el cuadrante analítico del white
> space — ese ya se ve hoy. *Recommendations* devuelve sus acciones como datos, a la espera del
> bloque compartido de la prioridad 5.

| # | Sección | Qué dice | Dato disponible | Visual | Estado |
|---|---|---|---|---|---|
| 01 | **Executive read** | Titular | Cifras globales | `kpi` (reutilizar) | ❗ |
| 02 | **Innovation map** | Qué innovaciones comunican las marcas y en qué territorios | Piezas con intención/territorio | ¿`heatmap` marca × territorio de innovación? | ❗ |
| 03 | **Who's moving** | Qué marcas reclaman el espacio y con qué credibilidad | Piezas por marca; credibilidad es juicio → ANALÍTICO | ¿`bars` + marca de credibilidad? | ❗ |
| 04 | **Gaps & open ground** | Ángulos que nadie comunica todavía | Igual que white space: el motor devuelve sus huecos | `quadrant` ANALÍTICO (reutilizar) | ❗ |
| 05 | **Recommendations** | Dónde jugar | Prosa | Igual que flagship 06 | ❗ |

---

## 5. Lo que pedimos diseñar

Prioridad acordada — **alcance medio**: primero 1 y 2, luego el resto.

### PRIORIDAD 1 · `compare` — tabla comparativa "declara / demuestra / brecha"

Sirve a **dos** secciones con la misma estructura (Positioning x-ray y Declared vs deployed),
así que un solo diseño resuelve las dos.

- Una fila por marca, tres columnas: **lo que declara**, **lo que demuestra**, **la brecha**.
- La brecha es la conclusión: debe leerse como lo más importante de la fila.
- 3 a 7 marcas. Texto corto por celda (una frase), no párrafos.
- Origen: **ANALÍTICO** — es un juicio, no un recuento.
- Debe funcionar en PDF a 1180 y no romperse al partir página.

### PRIORIDAD 2 · `cases` — galería de casos

El corazón de Global Creative Inspiration, hoy prosa corrida.

- Por caso: **miniatura**, marca, país/año, rating, **qué es**, **por qué funciona**,
  **idea transferible**, y **enlace al caso** (abre la ficha en Groundwork).
- De 4 a 12 casos. Debe verse bien con 4 y con 12.
- La *idea transferible* es lo que el cliente se lleva: debe destacar.
- Las miniaturas pueden faltar — hace falta estado sin imagen.
- Origen: **MEDIDO** en la selección (rating), **ANALÍTICO** en el porqué.

### PRIORIDAD 3 · `timeline` — consistencia del mensaje

Para Hero & message consistency: ver de un vistazo si el mensaje principal se mantiene o
deriva, **por año y por canal**.

- Ejes: tiempo (año) y canal. Marca cuándo cambia el mensaje.
- Debe hacer evidente lo que la sección concluye: estable / deriva / fragmentado.
- Origen: **MEDIDO** (eslogan, año, canal por pieza).

### PRIORIDAD 4 · Marca de origen del dato

Una convención visual pequeña y consistente que distinga **MEDIDO** de **ANALÍTICO** en
cualquier bloque. Hoy el white space lo resuelve con una nota al pie, pero cada bloque lo
resuelve a su manera. Puede ser una etiqueta, un tratamiento de eje, un icono — lo que
funcione sin ensuciar.

### PRIORIDAD 5 · Recomendaciones y jugadas

Flagship 06, Global 04 e Innovation 05 son la misma forma: **una lista de acciones concretas
priorizadas**. Un solo bloque las resuelve las tres. Está por decidir si lleva prioridad
explícita (impacto / esfuerzo) o basta con el orden.

---

## 6. Restricciones

- **Todo se exporta.** El PDF se rasteriza del DOM: nada que dependa de hover, scroll interno
  o interacción. Si un bloque necesita scroll horizontal en pantalla, tiene que degradar.
- **Un solo acento.** Ember. La paleta cálida (arcilla/ocre/topo) solo para series múltiples.
- **Los bloques se guardan.** Un informe generado hoy se abre dentro de un año: el diseño
  debe tolerar campos ausentes en lugar de romperse.
- **Sin datos inventados.** Si un bloque necesita un dato que no tenemos, hay que decirlo en
  la respuesta al brief — es preferible a diseñar algo que no podamos alimentar.
- **Contenedor 1180**, márgenes 34. Tipografías ya definidas.

---

## 7. Qué esperamos de vuelta

Por cada bloque: **estados** (lleno, mínimo, vacío, dato ausente), **medidas**, **tokens
usados**, y **cómo se comporta en el PDF**. El mismo formato que el handoff GW3, que
funcionó bien.

Si al revisar una sección concluyes que **no necesita visual**, decirlo: una sección de
prosa limpia es mejor que un gráfico de relleno. Takeaways es probablemente uno de esos.
