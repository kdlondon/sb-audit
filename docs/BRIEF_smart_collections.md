# Brief para Claude Design — Colecciones inteligentes (Creative Source)

**Fecha:** 2026-08-05 · **Producto:** Groundwork (Knots & Dots) · **Módulo:** Creative Source → Collections

---

## 1. Qué es y por qué

Las **Collections** ya existen: el analista agrupa piezas del Creative Source por tema y, dentro de una, puede montar una presentación con narrativa asistida por IA. Viven en Creative Source (pestaña Collections) y ahora son por proyecto.

**Lo nuevo:** que Groundwork **detecte patrones por sí mismo** en las piezas capturadas y **sugiera** colecciones — nunca las crea solo; sugiere, el analista aprueba o descarta. Convierte el Creative Source de un archivo pasivo en algo que señala lo que merece mirarse.

**Regla de oro:** sugerir, no imponer. Y no generar ruido: mejor tres sugerencias buenas que treinta.

---

## 2. El flujo (acordado)

1. La IA revisa el Creative Source del proyecto y **agrupa piezas por patrón semántico**.
2. Un patrón válido = **≥4 piezas** conectadas por territorio, IP/concepto, o eslogan/mensaje recurrente.
3. Las sugerencias aparecen en el panel de Collections, en un **bloque aparte: "Suggested Collections by Groundwork"**, separado de las oficiales.
4. Al entrar a una sugerencia hay una **"evidencia"** de intro: la IA explica por qué esto merece una colección y cuáles son los aprendizajes clave.
5. El analista **aprueba** o **descarta**.
6. Aprobada → pasa a la lista oficial con un sello **"AI suggested"** en el thumbnail. Descartada → esa sugerencia no se vuelve a proponer.

---

## 3. Dos realidades que el diseño debe asumir

**a. La detección es semántica, no por coincidencia exacta.** Comprobado con datos reales: agrupar por valor literal de campo (mismo territorio, mismo eslogan) encuentra **cero** grupos, porque territorios y eslóganes son texto casi único por pieza (un proyecto de 172 piezas tiene 159 territorios distintos). Así que el patrón lo encuentra la IA leyendo el *significado*, no un `GROUP BY`. Para el diseño esto importa en un punto: **cada escaneo es una operación con coste y latencia** (una pasada de IA sobre el corpus), así que necesita un **disparador explícito** y un **estado de "escaneando…"**, no un refresco instantáneo.

**b. Una pieza puede estar en varias sugerencias a la vez.** Las mismas 4-8 piezas pueden pertenecer a más de un cluster (una campaña puede leerse por territorio *y* por IP). El diseño **no debe dar la sensación de que una pieza "se consume"** al entrar en una sugerencia. Descartar una sugerencia no retira sus piezas de las demás.

---

## 4. Tipos de sugerencia (mixto)

Dos formas, marcadas distinto en la tarjeta:

- **De marca** — una sola marca repitiendo un concepto en el tiempo (ej.: *"Iberia × Harry Potter"* corriendo meses). La tarjeta muestra **una marca**.
- **Transversal** — varias marcas convergiendo en un mismo territorio/recurso (ej.: *"Cinco marcas apostando por la nostalgia este año"*). La tarjeta muestra **varias marcas**.

Ambas conviven en el mismo bloque de sugerencias; el diseño debe distinguirlas de un vistazo.

---

## 5. Pantallas a diseñar

### 5.1 Panel de Collections — con el bloque de sugerencias
El listado actual de Collections, más:
- Un bloque **"Suggested Collections by Groundwork"** encima o al lado de las oficiales, claramente separado (es una zona "propuesta", no confirmada).
- El disparador **"Scan for collections"** (botón push del analista) y su estado **escaneando…**. Definir dónde vive (cabecera del panel).
- Estados del bloque: **sin sugerencias todavía** (antes del primer escaneo / nada encontrado), **con sugerencias**, **escaneando**.

### 5.2 Tarjeta de sugerencia
En el bloque de sugerencias. Debe comunicar de un vistazo:
- Título propuesto por la IA.
- Si es **de marca** (una) o **transversal** (varias) — con sus logos/nombres.
- Nº de piezas (≥4) y un rango temporal si aplica.
- Un thumbnail o mosaico de las piezas.
- Marca visual de que es **sugerida por IA** (distinta del sello "AI suggested" de las ya aprobadas).

### 5.3 Detalle de una sugerencia
Al entrar:
- La **"evidencia"** como intro — texto de la IA explicando *por qué* esto es un patrón y los *aprendizajes clave*. Es el corazón de la pantalla.
- Las piezas del cluster (reutilizar el grid/preview de Collections que ya existe).
- Acciones claras: **Aprobar** (ember, primaria) y **Descartar**.
- Al aprobar: se convierte en colección oficial y el analista sigue trabajándola como cualquier otra (reordenar, presentación, export).

### 5.4 El sello "AI suggested"
En el thumbnail de una colección **ya aprobada** que nació de una sugerencia — un símbolo pequeño y discreto en el listado oficial. Distinto del tratamiento de la tarjeta de sugerencia sin aprobar.

---

## 6. La "evidencia" es transversal

El campo de **evidencia/rationale** (por qué merece ser colección + aprendizajes) no es solo de las sugeridas: **también estará disponible en las colecciones manuales** como un campo opcional que el analista puede rellenar o pedir a la IA. Diséñalo como una sección reutilizable, no atada a la sugerencia.

---

## 7. Fuera de alcance del diseño (lo construyo yo después)

- El motor de detección semántica (la pasada de IA que agrupa).
- El modelo de estado en `collections` (`suggested` / `active` / `dismissed`) + la firma de cluster que recuerda lo descartado.
- El campo `rationale`.
- La lógica del disparador (push manual; más adelante, quizá auto-agrupado tras N piezas nuevas — nunca por-subida).

El diseño define **cómo se ve y se navega**; el backend, **cómo se detecta y se recuerda**.

---

## 8. Sistema visual

El de siempre: acento único ember (`#FF4A1A`, deep `#DF5C29`, tint `#FFCFBC`), ink cálido, papel `#F4EFE9`, Klamp display + IBM Plex Mono etiquetas + IBM Plex Sans cuerpo. La zona de sugerencias debe **leerse como "propuesta de Groundwork"** — un tratamiento que la distinga de lo que el analista ya confirmó, sin gritar.
