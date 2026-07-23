# Report v2 — plan de implementación

_Handoff: `Report v2 Handoff` (README + `Report v2.dc.html`). Decisiones de diseño cerradas._
_Sustituye a `SPEC_report-redesign.md`. El flujo y el brief viven en `FLUJO_report_v2.md`._

---

## 1. Brecha real contra el código

Medida sobre el repo, no sobre el spec.

### Ya existe y se reutiliza
| Pieza | Dónde | Nota |
|---|---|---|
| 3 motores de informe | `app/api/reports/{flagship,social,global}` | Con lente ICP, findings y filtros |
| Motor de pesos | `lib/weights.js` | Ya tiene los 3 modos por familia |
| **Regeneración por sección** | `route.js` param `section: regenKey` | **Clave — ver §3** |
| Config por sección (on/off + prompt) | param `sections: cfgIn` | El prompt por sección ya está soportado |
| `maxDuration = 300` | flagship route | Margen para generación larga |
| Colecciones | `collections` + `collection_entries` | "By collection" es viable ya |
| Editor TipTap | `app/reports/editor` | Visual/Source, @-insert, autosave |
| Presentaciones | `app/showcase` (2.586 líneas) + `saved_showcases` | El motor se conserva |

### No existe — hay que construirlo
| Falta | Impacto |
|---|---|
| `status`, `archived`, `deleted_at`, `updated_at` en `saved_reports` | Bloquea Library |
| Tabla de comentarios con autor + rol | Bloquea P5 |
| **Contenido por bloques con id** | Bloquea comentarios anclados y regeneración fiable |
| `report_id` en `saved_showcases` | Bloquea presentación anidada |
| Objetivo social (8º) + selector en Settings | Bloquea Suggested |
| Motor **Innovation Report** | Objetivo 4 lo pide como Core — **no existe** |
| Los 4 de "Others" | Competitor Snapshot, Opportunity, Creative Intelligence, Agnostic Snapshot — **no existen** |

---

## 2. El modelo de contenido por bloques (F0 — lo más importante)

Hoy `saved_reports.content` es un blob. Pasa a:

```json
{
  "v": 2,
  "blocks": [
    { "id": "blk_a1b2c3", "type": "h2",   "sectionKey": "landscape", "text": "Category landscape" },
    { "id": "blk_d4e5f6", "type": "p",    "sectionKey": "landscape", "text": "…" }
  ]
}
```

- **`id` estable**: se genera una vez y **no cambia** al editar el texto. Es el ancla de los comentarios.
- **`sectionKey`**: permite regenerar una sección entera (sustituir todos sus bloques) sin tocar el resto.
- Un comentario guarda `block_id + start + end`, no la cadena de texto.

**Compatibilidad**: los informes guardados hoy no tienen bloques. El lector debe aceptar ambos: si `content` no es `{v:2}`, se trata como legacy y se muestra en solo lectura (o se migra al abrirlo, troceando por párrafos y asignando ids). *Decisión pendiente: migrar al abrir o dejar legacy en solo lectura. Recomiendo migrar al abrir — es una función pura y evita dos caminos de render para siempre.*

---

## 3. Hallazgo que ahorra una fase entera

El handoff pide **generación por secciones con guardado incremental**, y las rutas **ya aceptan `section: regenKey`** para generar una sola sección.

Es decir: **no hay que reescribir los motores.** El cliente orquesta —llama a la ruta una vez por sección, guarda cada resultado al llegar, y actualiza el progreso "3 de 6"— y el backend se queda como está.

Ventajas: progreso real gratis, fallo a mitad sin pérdida (lo generado ya está guardado), y ningún riesgo sobre el prompting que hoy funciona.

**Coste**: N llamadas en vez de 1 (más latencia total, mismo coste de tokens). Aceptable, y es exactamente lo que el diseño muestra.

> ⚠️ **Excepción**: `exec` y `recommendations` son de *síntesis* — necesitan las secciones analíticas ya escritas (la ruta ya recibe `priorSections`). Van al final, siempre, sin importar el orden que el analista dé a las demás.

---

## 4. Secciones extraíbles como informe

Cuatro de los ocho objetivos resuelven a una **sección** del flagship, no a un informe.

**No requiere motor nuevo.** Es un preset de configuración: llamar al flagship con esa única sección activa. La ruta ya lo soporta vía `sections: cfgIn`.

Queda por decidir: una sección extraída, **¿lleva su propio Executive read y recomendaciones?** Mi recomendación: **sí, versión corta**, o el entregable es un fragmento suelto sin apertura ni cierre.

---

## 5. Motores que sí hay que construir

- **Innovation Report** (Core, objetivo 4). Es un informe nuevo. Según el acuerdo de junio, cada informe nuevo solo necesita su "report card": estructura de secciones + perfil de peso + fuentes.
- **Los 4 de "Others"**. El handoff los lista pero no existen.

> **Propuesta de alcance:** F1–F6 construyen **la maquinaria** con los 3 motores actuales + las secciones extraíbles. **Innovation y los Others quedan fuera de este bloque** y se pintan deshabilitados con su etiqueta. Añadirlos después es una "report card" cada uno, no tocar la arquitectura. Si se meten ahora, F2 se dobla en tamaño.

---

## 6. Migraciones (F0)

`MIGRATION_report_v2.sql`:

```sql
-- saved_reports
alter table saved_reports add column if not exists status text default 'in_process';
alter table saved_reports add column if not exists archived boolean default false;
alter table saved_reports add column if not exists deleted_at timestamptz;
alter table saved_reports add column if not exists updated_at timestamptz default now();

-- comentarios anclados por bloque
create table if not exists report_comments (
  id uuid primary key default gen_random_uuid(),
  report_id text not null,
  project_id text not null,
  block_id text not null,
  sel_start int, sel_end int,
  snippet text,
  body text not null,
  author text not null,
  author_role text not null default 'kd',   -- 'kd' | 'client'
  created_at timestamptz default now(),
  edited_at timestamptz,
  deleted_at timestamptz
);

-- presentación anidada
alter table saved_showcases add column if not exists report_id text;
alter table saved_showcases add column if not exists archived boolean default false;
```

Backfill: reportes existentes → `status='in_process'`, `archived=false`. Showcases existentes → `archived=true` (decisión tomada).

*Nota: `report_id` va como `text` porque `saved_reports.id` hoy se genera en cliente como string, no uuid.*

---

## 7. Fases

| Fase | Qué | Riesgo |
|---|---|---|
| **F0** | Migraciones + modelo de bloques + lectura de legacy | Medio — toca el shape de datos |
| **F1** | Library sobre el shell: N2, filtros, orden, chips de estado, indicador de presentación, ⋯ con Rename/Delete/Archive, modales | Bajo |
| **F2** | Generate 1 (tipo, 8 objetivos, chips Flagship/Core/Section) + 2 (Source con contador de casos, Lens, Configure) + selector de objetivos en Settings | Medio |
| **F3** | Generación por secciones orquestada en cliente + progreso real + guardado incremental + fallo a mitad | Medio |
| **F4** | Documento: autosave, banner de concurrencia, las 4 herramientas, raíl de comentarios con rol | **Alto** — es donde se guarda el trabajo |
| **F5** | Download pdf · md · doc | Bajo |
| **F6** | Presentación anidada + Showcase fuera del sidebar + aviso | Medio |

**F4 es la fase crítica.** Autosave + comentarios anclados + regeneración conviven sobre el mismo documento. Se construye después de F0 justamente para que los bloques ya existan.

---

## 8. Riesgos y cómo los acoto

1. **Perder trabajo del analista en F4.** El autosave sobre un documento con comentarios anclados es la zona de mayor daño potencial. → Guardar siempre versión nueva, nunca sobrescribir a ciegas; `updated_at` como testigo de concurrencia.
2. **Comentarios huérfanos** si un bloque se regenera. → Al regenerar una sección, sus comentarios quedan marcados como "sobre una versión anterior" en vez de borrarse en silencio. **Decisión de producto pendiente.**
3. **Informes legacy que dejan de abrirse.** → Criterio: ningún informe guardado hoy puede dejar de abrirse. Se verifica antes de cerrar F0.
4. **Showcase fuera del sidebar** afecta a la navegación de todos los módulos. → Va el último (F6), cuando todo lo demás está estable.

---

## 9. Lo que NO toco sin permiso

- El **prompting** de los 3 motores y el motor de pesos.
- La rúbrica de rating y los findings.
- El editor TipTap: se **embebe**, no se reescribe.
- El motor de presentaciones: cambia de dónde cuelga, no cómo funciona.

---

## 10. Decisiones que necesito antes de F0

1. **Legacy**: ¿migrar al abrir o dejar en solo lectura? *(Recomiendo migrar.)*
2. **Sección extraída**: ¿lleva exec + recomendaciones cortas? *(Recomiendo sí.)*
3. **Innovation + los 4 Others**: ¿fuera de este bloque, deshabilitados con etiqueta? *(Recomiendo sí.)*
4. **Comentarios al regenerar**: ¿marcar como versión anterior, o borrar?
5. **Modelo**: el handoff pide "el más avanzado disponible"; hoy las rutas usan `claude-sonnet-4-6` fijo. ¿Lo subo y lo centralizo en una constante compartida?
