# SPEC — YouTube Transcript automático (server-side)

> Estado: **definición lista para desarrollar**. Escrito 2026-06-15.
> Primera pieza de la iniciativa más amplia de **captura multi-fuente** (ver
> "Contexto" al final). Resuelve el dolor #1: dejar de copiar/pegar transcripts.

## Overview

Hoy el transcript de YouTube se ingresa **a mano** (la ruta `/api/youtube` solo trae
metadata, no transcript). Este feature lo trae **automático desde el servidor** vía
una **API de transcripts de terceros**, con el proveedor **abstraído** (intercambiable)
y **caché por video** para no pagar dos veces. La extensión NO interviene aquí.

**Por qué server-side y no extensión:** la API oficial de YouTube solo da captions de
videos propios (403 para competidores); leer el DOM falla porque YouTube **virtualiza**
la lista del transcript (no carga todas las líneas). Una API dedicada maneja el bloqueo
de IP y devuelve el transcript completo.

## Decisión de fundamento (cerrada)

- **Backend = API de terceros** (recomendado por confiabilidad y bajo mantenimiento).
- **Proveedor abstraído** detrás de un solo módulo → se cambia sin tocar el resto.
- **Caché por `video_id`** para no re-pagar en re-análisis.
- **Fallback manual** siempre disponible (pegar transcript) si el video no tiene
  captions o la API falla.

## User Stories

- **US1 — Auto-transcript:** Como analista, al pegar una URL de YouTube quiero que el
  transcript se llene solo.
  - AC: pegar URL válida con captions → el campo `transcript` se llena en < 5 s.
  - AC: indicador de carga mientras se trae; toast de éxito/fallo.
- **US2 — Sin captions:** Como analista quiero saber cuándo un video no tiene captions.
  - AC: si no hay transcript, mensaje claro ("Este video no tiene subtítulos
    disponibles") y el campo manual queda editable.
- **US3 — No pagar dos veces:** Como dueño no quiero pagar la API en cada re-análisis.
  - AC: el segundo fetch del mismo `video_id` viene de caché (sin llamada externa).

## Flujo

1. En la captura (audit) el usuario pega una URL de YouTube. Ya se dispara
   `/api/youtube` (metadata). **Añadir** una llamada a `/api/youtube-transcript`
   (o fusionarla en `/api/youtube` para una sola ida y vuelta).
2. El backend:
   - Extrae `video_id`.
   - **Caché:** busca en tabla `youtube_transcripts` por `video_id`. Si existe → la
     devuelve sin llamar a la API.
   - Si no, llama al proveedor vía `lib/transcript-provider.js`.
   - Guarda el resultado en caché y lo devuelve.
3. El frontend hace `autoFill({ transcript })`. Si viene vacío/falla → deja el campo
   manual y muestra el mensaje.

## API / Interface Contract

### `POST /api/youtube-transcript`
```jsonc
// request
{ "url": "https://youtube.com/watch?v=...", "lang": "en" }   // lang opcional
// response OK
{ "videoId": "...", "transcript": "texto plano completo...",
  "language": "es", "source": "provider|cache", "segments": [ /* opcional [{start,dur,text}] */ ] }
// response sin captions
{ "videoId": "...", "transcript": "", "error": "no_captions" }
```
- Auth: **re-activar `requireAuth`** (no dejarlo abierto como las otras rutas).
- Errores: `no_captions`, `provider_error`, `rate_limited` → mensajes claros al front.

### `lib/transcript-provider.js` (adaptador, proveedor-agnóstico)
```js
// Una sola función; el proveedor se elige por env.
export async function fetchTranscript(videoId, { lang } = {}) {
  // lee process.env.TRANSCRIPT_PROVIDER + TRANSCRIPT_API_KEY
  // → { transcript, language, segments } | throws
}
```
- Env nuevos: `TRANSCRIPT_PROVIDER` (ej. "supadata"), `TRANSCRIPT_API_KEY`.
- Mantener un `switch (provider)` con 1 implementación al inicio; añadir más sin tocar
  el resto del código.

## Data Model

### Tabla nueva `youtube_transcripts` (caché)
| columna | tipo | nota |
|---|---|---|
| video_id | text PK | id de YouTube |
| transcript | text | texto plano completo |
| language | text | idioma detectado |
| segments | jsonb | opcional, [{start,dur,text}] para timestamps |
| fetched_at | timestamptz | para TTL si se quiere refrescar |
| provider | text | qué API lo trajo |

- El transcript también se persiste en el campo `transcript` de la entrada
  (`creative_source`) como hoy — la tabla es solo caché para no re-pagar.

## UX/UI

- Al pegar URL: spinner pequeño junto al campo transcript ("Trayendo transcript…").
- Éxito: campo lleno + toast "Transcript importado".
- Sin captions / error: campo vacío editable + nota gris bajo el campo.
- Botón "↻ Reintentar / Volver a traer" (ignora caché) por si el primer intento falló.

## Technical Notes

- **Proveedor:** candidato principal **Supadata** (API de transcripts de YouTube con
  free tier). Alternativas: Tactiq API, YouTubeTranscript.io, Kome. *(Confirmar precio
  y free tier vigentes al construir — ver Open Questions.)* Todo detrás del adaptador.
- **Idioma:** traer el **original** (no traducir en el fetch). El `/api/analyze` ya
  traduce la salida a inglés. Guardar `language` para referencia.
- **Costo:** llamar **solo cuando hace falta** (al pegar URL o al "Analizar con IA"),
  nunca en bucle. La caché por `video_id` es la principal defensa de costo.
- **Transcripts largos:** son texto → sin problema de tamaño de imagen; se mandan tal
  cual a Claude en el análisis (mejora insight, slogan, VP, idea).
- **Seguridad:** `TRANSCRIPT_API_KEY` solo server-side. Re-activar auth en la ruta.

## Product Context & Integration Map

- **Upstream:** requiere config de env `TRANSCRIPT_PROVIDER` + `TRANSCRIPT_API_KEY`
  (paso de setup, como el service-role key pendiente).
- **Downstream:** llena `transcript` → mejora `/api/analyze` (clasificación), chat y
  reports. Mejor materia prima = mejor IA.
- **Se conecta con `/api/youtube`** (metadata): idealmente una sola llamada devuelve
  metadata + transcript. Reusar el `autoFill` existente del audit.
- **Reutilizable** desde el scout del onboarding y `/api/youtube-scout` (traer
  transcript al aceptar una pieza) — pero por costo, **solo bajo demanda**, no masivo.

## Open Questions

1. **Proveedor exacto** y su pricing/free-tier vigente (confirmar al construir).
2. ¿Cuándo se dispara el fetch: al **pegar la URL** (más mágico) o al **"Analizar con
   IA"** (más controlado en costo)? — recomiendo al pegar la URL, con caché.
3. ¿TTL de caché? — recomiendo **sin expiración** (los transcripts no cambian); refresco
   solo manual con el botón ↻.
4. ¿Guardar `segments` con timestamps ahora o solo texto plano? — texto plano para MVP.

## Build Order

1. **Migración** `youtube_transcripts` (caché).
2. **`lib/transcript-provider.js`** con 1 proveedor + envs.
3. **`/api/youtube-transcript`** (auth + caché + adaptador + manejo de errores).
4. **Wire en audit:** tras la metadata, traer transcript y `autoFill`. Spinner + toast.
5. **Fallback UX** (sin captions / error) + botón ↻.
6. (Opcional) Enriquecer scout/onboarding con transcript **bajo demanda**.
7. Verificar: pegar URL real → transcript completo; segundo intento → viene de caché.

---

## Contexto: la iniciativa mayor de captura multi-fuente

Esto es la **pieza 1**. Las otras (conversadas, aún sin spec):
- **Capturas largas (tiling):** la extensión ya genera la imagen larga; falta que
  `/api/analyze` la corte en franjas en vez de reducir a 800px.
- **Meta/Google Ads y redes:** requieren **rediseño de la extensión** (hoy Chrome-only,
  UX floja, captura solo lo visible). Decisión pendiente: re-pensar UX/UI de la extensión
  vs. apoyarse en APIs/terceros donde existan (Meta Ad Library API).
- **Modelo de análisis:** subir de `claude-sonnet-4-20250514` a uno actual.
- **Deuda transversal:** re-activar auth en `/api/analyze`, `/api/youtube*` (hoy abierto).
