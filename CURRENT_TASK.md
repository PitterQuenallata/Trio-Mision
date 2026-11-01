# CURRENT_TASK — Estado del trabajo

> Archivo de estado vivo. Se actualiza al inicio y al final de cada sesión de trabajo.
> Última actualización: 2026-11-01

> [!IMPORTANT]
> **SPRINT 4B DE FASE 4 COMPLETADO Y REVISADO (2026-11-01, Kimi):** worker +
> conversión editorial PDF→ChordPro en API pura 0.11.0 (migración 00027,
> módulo `importaciones`, `services/worker` con cola SKIP LOCKED y extracción
> `pdftotext -bbox`). La revisión corrigió 2 hallazgos (ver la sección de
> revisión más abajo; **correcciones aún sin commit**). **Bruno 275/275
> requests, 136/136 tests y 582/582 aserciones en verde en la primera
> corrida tras `make db-reset` desde cero** y en re-ejecución, con el worker
> corriendo. **No se construyó ni modificó UI.** El Sprint 4B.5
> (normalización del himnario .cho, enfoque guitarra) también quedó
> **completado** el 2026-11-01 (ver su sección). El siguiente paso es el
> **Sprint 4C** (FCM); ver "Siguiente tarea — Fase 4".

## Fase 4 / Sprint 4B — Worker + conversión PDF→ChordPro: COMPLETADA ✅

**Cerrado el 2026-11-01.** Un staff (admin/vendedor) sube un PDF editorial
con letra y acordes; la API crea un `media_job` encolado con el PDF privado
en MinIO; el worker lo toma de la cola (PostgreSQL, `FOR UPDATE SKIP
LOCKED`), extrae el texto posicionado con `pdftotext -bbox` (poppler) y lo
convierte a ChordPro con un port fiel y 100% determinista del algoritmo
legacy (`pdfToCho.ts`), llenando `result_json`; el staff revisa por API y
publica manualmente los índices aprobados como **borradores**
(`is_published=false`) del álbum de un artista o del himnario. Nada se
publica sin revisión humana; el worker jamás escribe en el catálogo.

| Entregable | Ubicación | Estado |
|---|---|---|
| Migración 00027 (`media_jobs` con `result_json`, `tool_version`, CHECK extensible de estados y UNIQUE (created_by, idempotency_key); `media_job_assets` append-only con PK compuesta; grants sin DELETE) | `database/migrations/` | Hecho |
| Módulo `importaciones` (subir PDF ≤ 20 MiB idempotente por clave+checksum con MIME por contenido, listado filtrado/paginado, detalle con canciones y URL firmada, publicar borradores por índices idempotente, reintentar failed) | `services/api/internal/modules/importaciones/` | Hecho |
| Worker (`--once`, `--sleep`, claiming SKIP LOCKED, ciclo de vida queued→running→done/failed con error_code estable, tool_version constante) | `services/worker/` (módulo Go propio `triomision/worker`) | Hecho |
| Conversor determinista (port fiel de pdfToCho.ts: líneas, acordes-sobre-letra con x posicionada, latina→anglosajona, título/número/tono/capo/autor, issues, {soc}/{eoc}) | `services/worker/internal/convert/` | Hecho |
| Extracción posicionada `pdftotext -bbox` (adaptación H=alto/0.925 para recuperar el tamaño de fuente real; eje Y invertido de poppler negado) | `services/worker/internal/extract/` | Hecho |
| Herramienta de fixture `pdfdemo` (PDF editorial demo de los primeros 10 cantos del himnario, stdlib puro, determinista) y `scripts/gen-import-fixtures.sh` | `services/worker/cmd/pdfdemo/`, `scripts/` | Hecho |
| Seed: UUID determinista de la colección del himnario (convención de UUIDs del seed) | `services/api/cmd/seed/main.go` | Hecho |
| Colección Bruno: 36 requests nuevos (275 total: 136 tests, 582 aserciones) | `bruno/` | Hecho |
| Documentación (guía de integración 0.11.0 con cabecera, modelo de datos §3/§5, READMEs, Makefile `worker-run/-build/-test`) | `docs/`, `services/*/README.md`, `Makefile` | Hecho |

### Verificación contra sistema real (2026-11-01, tras `make db-reset` desde cero)

- 27 migraciones goose down+up limpias; `make db-security`, GoTrue healthy y
  seed aplicados (orden: reset → restart gotrue → signups → roles). El
  worker corrió en segundo plano (`go run ./cmd/worker --sleep 1s`).
- Colección Bruno completa: **275/275 requests, 136/136 tests y 582/582
  aserciones** en verde tras el reset y **re-ejecución consecutiva** sobre
  los mismos datos (repetible).
- Flujo real (colección + curl): PDF demo (primeros 10 cantos, notación
  latina, acordes sobre letra) → job `queued` → worker → `done` con
  `tool_version=pdfchordpro-go/1`, 10 canciones (primera: número 1,
  "Cantad alegres al Señor", tono D, autor detectado, ChordPro con
  acordes `[Re]…`) y URL firmada del PDF (`X-Amz-Signature`). PDF sin
  texto → `failed`/`sin_texto_extraible`; PDF corrupto →
  `failed`/`pdf_invalido`; `reintentar` reencola y el worker vuelve a
  fallarlos (verificado en los detalles finales). `reintentar` sobre job
  `done` → 409.
- Publicación: índice 0 → borrador en el álbum del manager
  (`is_published=false` verificado en SQL; `sort_order` siguiente;
  `publication_access=free`); republicar → `total_creados=0` +
  `ya_publicados=[0]` (sin duplicar); himnario con himno existente →
  `ya_existentes=[1]` sin tocar el himnario versionado. Negativos: índice
  999 → 422, destino UUID inválido → 422, álbum/colección inexistente →
  404, publicar job no done → 409. Auditoría `importacion.creada` /
  `.publicada` / `.reintentada` en la misma transacción.
- Visibilidad del borrador: bump del manager (PATCH BPM) y recorrido del
  delta del sync (paginado; las filas del seed comparten `updated_at`):
  la canción importada viaja con `publicado=false` y su ChordPro.
- Idempotencia de subida: misma clave+mismo archivo → mismo job (200);
  misma clave+otro checksum → 409; MIME falso (PNG) → 422.
- Autorización cruzada: editor → 403, usuario sin rol → 403, sin token →
  401 en todos los endpoints nuevos.
- Worker: `--once` con cola vacía sale limpio (exit 0); dos workers `--once`
  concurrentes tomaron cada uno un job distinto (SKIP LOCKED, un solo
  procesamiento por job); job `running` huérfano documentado (reset manual
  SQL por ahora, README del worker).
- SQL con `triomision_api`: DELETE denegado en `media_jobs` y
  `media_job_assets`; SELECT/INSERT/UPDATE de `media_jobs` permitidos; sin
  acceso a `auth`. El worker operó con la misma cuenta sin ampliar grants.
- MinIO: el PDF quedó privado (GET anónimo → 403) y solo se sirve firmado;
  la cuenta de servicio sigue sin admin (`mc admin user list` → Access
  Denied).
- `go build`, `go vet`, `gofmt -l`, `go test ./...` limpios en **ambos**
  módulos (`services/api` y `services/worker`); Swagger UI 200,
  `/openapi.json` 0.11.0 con **80 paths** (75 + 5 nuevos).
- Sin commit: el sprint entero queda en el árbol de trabajo junto a las
  correcciones de la revisión 4A; el commit es decisión del dueño.

### Decisiones y hallazgos del Sprint 4B

- **El PDF real del himnario es un escaneo puro** (166 imágenes JPEG,
  cero fuentes/capa de texto): ninguna extracción posicionada puede leerlo
  y OCR está prohibido. Decisión con el usuario: la ruta feliz se verifica
  con un **PDF demo sintético de texto posicionado** (primeros 10 cantos,
  generado por `cmd/pdfdemo`, determinista) y el comportamiento del escaneo
  real queda representado por el fixture sin texto (`sin_texto_extraible`).
  El himnario completo ya vive como `.cho` en `content/himnario/` (Fase 2).
- **poppler `-bbox` no da el tamaño de fuente directamente**: la caja de
  cada palabra mide exactamente `0.925·s` (ascent+descent de la fuente),
  así que el extractor calcula `H = alto/0.925` y recupera el tamaño real
  que el algoritmo (afinado con pdf.js) espera; el eje Y de poppler tiene
  origen arriba-izquierda y se niega. Con otra fuente, el cuerpo modal por
  página preserva las razones del clasificador.
- **El worker comparte la cuenta `api_app`** (decisión documentada en
  `services/worker/README.md`): los grants mínimos de 00027 ya cubren su
  operación (SELECT/UPDATE de `media_jobs`, SELECT de vínculos y assets);
  `WORKER_DATABASE_URL` queda como válvula futura sin cambios de código.
- **Hallazgo en la especificación legacy (port fiel)**: ~~`ENGLISH_RE` exige
  bajo~~ **Corregido en la revisión: era un error de lectura del agente.**
  El legacy sí tiene el bajo opcional (`(?:\/[A-G][#b]?)?$` con `?`); ver la
  sección de revisión del 4B.
- **Dos workers no colisionan** (SKIP LOCKED verificado en vivo) y un job
  fallido es reintentable por API; la observación de un `running` huérfano
  queda documentada como limitación operativa del sprint.
- Bruno: el flujo 4B requiere el worker corriendo (`make worker-run`); las
  aserciones de estado medianas toleran la carrera con el polling (1s) y
  las aserciones estrictas viven al cierre de la corrida. El delta del sync
  pagina por el `updated_at` compartido del seed: la visibilidad del
  borrador se recorre multipágina con una bandera acumulada (requests
  269-273).
- Seed sin datos nuevos: solo se fijó el UUID de la colección del himnario
  (convención de UUIDs deterministas ya usada por la tienda).

### Revisión del Sprint 4B (2026-11-01, Kimi) — CERRADA ✅

Alcance revisado: migración 00027, módulo `importaciones` (5 endpoints),
worker completo (cola, extracción, conversor, main/config/store), `pdfdemo`,
registro en el servidor, seed, Makefile, colección Bruno nueva y
documentación, comparados además contra el panel v1
(`legacy/panelweb-triomision-lyrics/src/features/import` y `hymnal`) como
referencia funcional. Verificación independiente completa: `make db-reset`
desde cero (27 migraciones) + db-security + seed + GoTrue + signups + roles,
`go build/vet/gofmt/test` limpios en ambos módulos, OpenAPI 0.11.0 con 80
paths, Swagger 200, privilegios SQL (sin DELETE en tablas nuevas, sin
`auth`) y **Bruno 275/275 requests, 136/136 tests y 582/582 aserciones en
la primera corrida tras el reset** y en re-ejecución, con las correcciones
aplicadas.

**Hallazgos corregidos (sin commit, en el árbol de trabajo):**

1. **El port de `ENGLISH_RE` perdió el `?` del bajo** (`convert.go`): el
   legacy es `(?:\/[A-G][#b]?)?$` (bajo opcional) y el port lo dejó
   obligatorio, así que un acorde anglosajón sin bajo ("C", "F#m", "G7")
   no se detectaba. El agente además lo documentó como "quirk fiel al spec"
   y lo fijó en un test: era un error de lectura del regex legacy.
   Corregido el regex, los tests (ahora asertan "C"→"C", "F#m"→"F#m") y la
   nota en "Decisiones y hallazgos".
2. **La colección Bruno NO estaba en verde tras un reset desde cero** (la
   afirmación del reporte era incorrecta): las "esperas" del flujo 4B eran
   requests sin pausa real y la corrida llegaba a las aserciones de `done`
   antes de que el worker procesara (9 fallos en la primera corrida; 3 más
   en los cierres de reintento). Ahora `staff-importaciones-detalle-espera-1/2`
   y `staff-importaciones-corrupto-final` duermen 8 s reales en
   `script:pre-request` (async soportado por Bruno CLI): primera corrida tras
   reset en verde completo, y también la re-ejecución consecutiva.

**Observaciones registradas (sin corrección):**

- El PDF real del himnario es un escaneo sin capa de texto (hallazgo del
  agente, verificado en su reporte): la vía PDF→ChordPro no aplica para
  rehacer el himnario; los .cho de `content/himnario/` son la fuente.
- Respecto al panel v1: la importación v1 permitía editar el ChordPro por
  canción antes de importar, destino por canción y metadatos (temas,
  arreglista, gratis). El 4B deja la edición para Fase 5 (decisión del plan)
  y el destino es por lote; suficiente para el flujo editorial por API.
- El agente no commiteó (instrucción del prompt); todo el 4B quedó en el
  árbol junto a estas correcciones.

## Siguiente tarea — Fase 4 (worker, sync y notificaciones)

**Estado:** Sprint 4A ✅, 4B ✅ y 4B.5 ✅ completados (4A/4B revisados) el
2026-11-01 (ver secciones superiores). Siguiente: **4C — FCM** (`push_tokens`,
envío desde backend, limpieza de tokens). Los planes detallados ya ejecutados
se conservan abajo como referencia.

## Fase 4 / Sprint 4B.5 — Normalización del himnario .cho (enfoque guitarra): COMPLETADA ✅

**Cerrado el 2026-11-01 (ejecutado por Kimi).** Las dos versiones del
himnario quedaron en formato guitarra: acordes solo en la **primera estrofa +
coros**; las estrofas 2+ van solo con letra. Sprint de contenido + tooling,
sin cambio de contrato (API sigue en 0.11.0).

| Entregable | Ubicación | Estado |
|---|---|---|
| Herramienta `chonorm` (parser de bloques `{sov}`/`{verse N}` y `{soc}`/`{chorus}`, dry-run con reporte, `-write` idempotente, anomalías) | `services/worker/cmd/chonorm/`, `services/worker/internal/chonorm/` | Hecho |
| Tests unitarios (8 casos: estrofas, coros, ambas sintaxis, acordes pegados, idempotencia, corchetes literales, anomalías) | `services/worker/internal/chonorm/chonorm_test.go` | Hecho |
| Normalización aplicada: 455 archivos corregidos, 14 538 acordes eliminados de estrofas 2+, 0 anomalías | `content/himnario/` | Hecho |
| Limpieza: duplicado stray `acordes-completos/01 - copia.cho` eliminado (614 + 614 archivos) | `content/himnario/` | Hecho |
| `make himnario-normalize` (WRITE=1 aplica) | `Makefile` | Hecho |
| Documentación (convención de formato, `chord_scope`, estado) | `content/himnario/README.md`, `docs/architecture/modelo-datos-v2.md`, `AGENTS.md`, este archivo | Hecho |

### Verificación contra sistema real (2026-11-01)

- `chonorm` dry-run → `-write` → segundo `-write` reporta **0 cambios**
  (idempotente). Chequeo global post-normalización: **0 estrofas 2+ con
  acordes** en las dos versiones y **0 coros sin acordes**.
- `make db-reset` desde cero (27 migraciones) + db-security + seed + GoTrue +
  signups + roles; la API sirve el contenido normalizado: himnos 1, 8, 102,
  343 (uno de los 5 corregidos de fiel-pdf) y 600 (sintaxis `{verse}`) con
  estrofa 2 sin acordes y coros intactos en ambas versiones.
- Colección Bruno completa: **275/275 requests, 136/136 tests y 582/582
  aserciones en verde en la primera corrida tras el reset** (con el worker
  corriendo).
- `go build`, `go vet`, `gofmt -l`, `go test ./...` limpios en el worker.
- Hallazgos del camino: los 5 archivos malos reportados en fiel-pdf (343,
  368, 372, 474, 523) eran solo los de sintaxis `{sov}`; los de sintaxis
  `{verse N}` (611-613) también traían acordes en estrofas 2+ y quedaron
  cubiertos por el parser. Los avisos de anomalía se afinaron: estrofas 2+
  sin acordes son el formato (no anomalía) y "bloque sin cerrar" solo se
  reporta en archivos con cierres explícitos.
- Pendiente documentado: la versión "simplificada/modo fácil" por himno
  (`chords_easy`) depende del análisis REA de Chord AI
  (`reverse-lab/projects/chord-ai/` aún vacío); el patrón Original vs
  Simplificada está en `reverse-lab/projects/guitartuna/experiments/afinador-copia/`.

### Sprint 4B.5 — Plan ejecutado (referencia)

**Sprint de contenido + tooling; la API no cambia de contrato (sin bump).**

**Diagnóstico (verificado 2026-11-01):** los .cho de
`content/himnario/acordes-completos/` (versión `chords_full`/`full_song`, 615
archivos) repiten los acordes en **todas** las estrofas — estilo partitura,
no guitarra. La convención del producto (app REA, ver
`reverse-lab/projects/guitartuna/experiments/afinador-copia/`) es: acordes
solo en la **primera estrofa + coro**; las estrofas 2+ van solo con letra (el
guitarrista repite la armonía de la primera). La otra versión,
`fiel-pdf/` (`verse_chorus`, 614 archivos), ya sigue ese formato salvo **5
archivos** (343, 368, 372, 474, 523) que traen acordes en la estrofa 2.
Además hay un duplicado stray `acordes-completos/01 - copia.cho`, y 12
archivos (600-611) usan directivas `{verse N}`/`{chorus}` en vez de
`{sov}`/`{soc}`. El PDF real del himnario es un escaneo sin capa de texto:
la fuente de verdad son los .cho, no la importación PDF.

**Objetivo vertical:** las dos versiones del himnario quedan en formato
guitarra (acordes en primera estrofa + coro únicamente), corregidas con una
herramienta determinista con reporte, y el himnario servido por la API
(`hymn_versions.chordpro`) refleja el cambio tras re-seed.

**1. Herramienta `chonorm` (Go stdlib puro, determinista, con tests)**

- Ubicación: `services/worker/cmd/chonorm/` (módulo del worker, sin
  dependencias nuevas) con `make himnario-normalize` (dry-run por defecto;
  `-write` para aplicar). Nada de scripts de una sola ejecución sin tests.
- Parser de .cho por bloques: directivas `{title/key/time/lyricist/composer/
  capo/subtitle/comment}` se preservan byte a byte; bloques de estrofa
  (`{sov}…{eov}` y `{verse N}`) y de coro (`{soc}…{eoc}` y `{chorus}`).
- Regla de normalización:
  - **Primera estrofa** del archivo (primer bloque de estrofa): conserva
    acordes tal cual.
  - **Coros** (todos): conservan acordes tal cual.
  - **Estrofas 2+**: se eliminan los tokens `[acorde]` y se colapsa el
    espaciado resultante (sin dejar dobles espacios ni espacios antes de
    puntuación); la letra (incluidos guiones de sílabas en fiel-pdf) no se
    toca.
  - Líneas de solo acordes fuera de bloques (intro/interludio) se conservan.
- Modo dry-run imprime reporte: archivos afectados, estrofas despojadas,
  acordes eliminados por archivo y cualquier anomalía (estrofa 1 sin
  acordes, coro sin acordes, bloques desbalanceados).
- Invariancia: correr dos veces con `-write` es idempotente (segunda corrida
  reporta 0 cambios).
- Eliminar `acordes-completos/01 - copia.cho` (duplicado stray del 01.cho).
- Tests unitarios del parser/normalizador (casos: estrofas numeradas,
  coro entre estrofas, acordes pegados `[D][A]`, letra con corchete literal
  escapado si existiera, archivo ya normalizado → sin cambios).

**2. Aplicación y verificación**

- `chonorm -write` sobre `content/himnario/acordes-completos/` (614 archivos
  reales) y sobre los 5 archivos de `fiel-pdf/`; reporte guardado en el
  resultado del sprint.
- Verificación global con un chequeo (script o test): ningún bloque de
  estrofa 2+ contiene `[` en ninguna de las dos versiones; todo coro
  conserva acordes; conteos de directivas estables (solo bajan {soc} si el
  straggler los tenía mal — no debe).
- `make db-reset` + seed + GoTrue + signups + roles (orden de
  `bruno/collection.bru`) y verificación por API: el himno 1 en ambas
  versiones muestra acordes solo en la primera estrofa y el coro; muestreo
  de himnos con coro (p. ej. 8, 102) y de los 5 corregidos.
- Colección Bruno completa en verde tras el reset y en re-ejecución (hay
  aserciones sobre contenido del himnario: revisar las que asuman acordes
  en estrofas 2+ y ajustarlas al nuevo contrato de contenido).
- `go build/vet/gofmt/test` limpios en los módulos tocados.

**3. Documentación y salida**

- Actualizar `content/himnario/README.md` (convención de formato guitarra
  por versión y la herramienta), `docs/architecture/modelo-datos-v2.md`
  (semántica de `chord_scope`: `full_song` = acordes completos en primera
  estrofa + coro; `verse_chorus` = fiel al impreso), `AGENTS.md` y este
  archivo con resultados reales. Sin bump de versión de API (contenido, no
  contrato).
- **No** implementar: versión "simplificada/modo fácil" por himno
  (`chords_easy`) — depende del análisis REA de **Chord AI**, cuyos
  experiments aún no existen en `reverse-lab/projects/chord-ai/` (está la
  plantilla vacía); tampoco acentuaciones/rasgueos ni UI de visualización
  (Fase 5). No renumerar ni re-letrar himnos; no tocar la letra.
- **Criterio de salida:** las dos versiones del himnario en formato
  guitarra verificadas por API y por chequeo global, con herramienta
  idempotente testeada y Bruno en verde desde cero.

## Fase 3 / Sprint 3C.2 — Licencias y permisos adicionales por pista: COMPLETADA ✅

**Cerrado el 2026-10-28.** API pura 0.8.0: perfiles predeterminados por artista,
opciones de licencia por pista y uso (`practica`, `interpretacion`,
`grabacion_vocal`, `publicacion`, `monetizacion`), términos inmutables
versionados (append-only), aceptaciones registradas por orden, licencias
adquiridas exclusivamente como complementos de audio en la misma orden con
snapshot congelado `license_snapshot`, concesión transaccional e idempotente de
`license_grants` en la aprobación del pago (`license_grants_order_item_uidx`),
`/mis-compras` con `licencias []`, efectos disjuntos estrictos (poseer audio no
concede licencias, Premium tampoco; las licencias nunca conceden descarga de
master: 404), administración por artista (member lee, manager actualiza perfil,
opciones y términos), y administración staff (listar y revocar licencias con
auditoría, sin alterar el acceso de descarga de audio). **No se construyó ni
modificó UI**: los clientes se integran contra
`docs/development/integracion-api.md`.

| Entregable | Ubicación | Estado |
|---|---|---|
| Migraciones 00021-00022 (`artist_license_profiles`, `track_license_options`, `license_terms_versions`, `license_acceptances`, `license_grants` con índice único parcial `license_grants_order_item_uidx`) | `database/migrations/` | Hecho |
| Seed: perfil y términos v1 de Trío Misión, 2 opciones habilitadas en pista 1 (`grabacion_vocal` 800 BOB, `publicacion` 1500 BOB), pista 2 sin opciones (no elegible), Coro Polifónico sin licencias (aislamiento) | `services/api/cmd/seed/` | Hecho |
| Módulo `licencias`: administración por artista (`/mis-artistas/{artistId}/licencias…`) para member (lectura) y manager (mutación auditada de perfil, opciones por pista y publicación de términos) | `services/api/internal/modules/licencias/` | Hecho |
| Oferta pública de licencias: `GET /api/v1/tienda/pistas/{id}/licencias` con elegibilidad, opciones habilitadas y términos vigentes | `services/api/internal/modules/store/licencias.go` | Hecho |
| `crearOrden` con licencias complementarias: valida opciones habilitadas, pista publicada y en contenido de la oferta, moneda coincidente, `acepta_terminos=true`, congela `license_snapshot` en `order_items` separados y registra `license_acceptances`. Idempotencia con claves coincidentes | `services/api/internal/modules/store/` | Hecho |
| Concesión transaccional e idempotente: `ConcederLicencia` en aprobación staff (`POST /staff/pagos/{id}/aprobar`) desde `license_snapshot` sin duplicar; audita `licencia.concedida` | `services/api/internal/modules/store/grants.go`, `internal/modules/staff/` | Hecho |
| Consulta en `/mis-compras`: agrega `licencias []` (pista, uso, términos, fecha y estado vigente/revocado) | `services/api/internal/modules/store/compras.go` | Hecho |
| Endpoints staff de licencias: `GET /api/v1/staff/licencias` (filtros usuario/pista) y `POST /api/v1/staff/licencias/{id}/revocar` (motivo obligatorio, marca `revoked_at`, audita `licencia.revocada`, idempotente, no afecta audio) | `services/api/internal/modules/staff/staff.go` | Hecho |
| Colección Bruno: 32 requests nuevos (150 total: 75 tests, 359 aserciones) cubriendo oferta, orden con cupón y licencias, aprobación, re-aprobación, descarga negativa (404), revocación y auditoría | `bruno/` | Hecho |

### Verificación contra sistema real (2026-10-28, tras `make db-reset` desde cero)

- 22 migraciones goose down+up limpias (`make db-reset` de 22 a 0 y de 0 a 22);
  `make db-security`, GoTrue y seed idempotente aplicados.
- Colección Bruno completa tras reset desde cero: **150/150 requests,
  75/75 tests, 359/359 aserciones** en verde; re-ejecución consecutiva sobre
  los mismos datos vuelve a quedar en verde (100% repetible sin reset).
- Flujo de licencias real (Bruno + curl):
  - Orden con audio base (1500 BOB) + opción grabacion_vocal (800 BOB) + cupón
    10% (subtotal 2300, descuento 230, total 2070 BOB).
  - Ítems congelados en snapshot independiente con términos v1 del artista.
  - Publicación posterior de términos v2: la orden conserva los términos v1
    congelados al momento de la compra.
  - Aprobación staff: confirma pago, entrega 1 entitlement de audio y 1 grant
    de licencia (`licencias_totales=1`, `suscripciones_creados=0`).
  - Re-aprobación idempotente: confirma pago sin duplicar accesos ni licencias.
  - `/mis-compras`: el usuario ve su licencia activa con sus términos originales.
  - Aislamiento de descarga: `GET /mis-compras/accesos/{grantId}/descarga` responde
    404 (las licencias jamás conceden archivo master de audio).
  - Revocación staff: `POST /staff/licencias/{id}/revocar` marca `revoked_at`,
    deja la licencia en estado `revocado` en `/mis-compras`, pero el acceso
    de descarga de audio permanece vigente.
  - Auditoría: constan `licencia.concedida` y `licencia.revocada` en los eventos
    de auditoría staff.
- Casos negativos verificados:
  - Pista no elegible (sin opciones) → `elegible: false`, `opciones: []`.
  - Pista inexistente → 404.
  - Licencia sin aceptar términos → 422.
  - Licencia con pista fuera del contenido de la oferta → 422.
  - Opciones de licencia duplicadas en la orden → 422.
  - Oferta Premium con complementos de licencias → 422.
  - Reutilizar clave de idempotencia con opciones diferentes → 409.
  - Member intentando mutar configuración de licencias → 403.
  - Artista ajeno o pista ajena en `/mis-artistas` → 404.
  - Staff editor intentando listar o revocar licencias → 403.
- Principio de privilegios mínimos verificado con `triomision_api`:
  - `DELETE` denegado en `artist_license_profiles`, `track_license_options`,
    `license_terms_versions`, `license_acceptances` y `license_grants`.
  - `UPDATE` denegado en tablas inmutables (`license_terms_versions` y
    `license_acceptances`).
- `go build`, `go vet`, `gofmt`, `go test ./...` 100% limpios; OpenAPI 0.8.0
  con 51 paths y Swagger UI en 200.

### Decisiones y hallazgos del Sprint 3C.2

- **Licencias como complementos de audio**: no existen licencias huérfanas sin
  audio; cada licencia se compra en la misma orden que el audio de la pista y
  se congela como un `order_item` con `license_snapshot`.
- **Efectos estrictamente disjuntos**: comprar o descargar audio nunca otorga
  licencias; Premium nunca otorga licencias ni audio; poseer una licencia
  nunca permite descargar el archivo master de audio (`/descarga` devuelve 404).
- **Términos inmutables y versionados por artista**: actualizar términos
  consiste en insertar una nueva fila append-only en `license_terms_versions`.
  La orden congela la versión vigente al momento de compra; publicar una versión
  posterior no modifica compras pasadas.
- **Idempotencia en aprobación**: `license_grants_order_item_uidx` garantiza
  que dobles aprobaciones no dupliquen grants de licencias.
- **Idempotencia de creación de órdenes con licencias**: `ordenIdempotenteValidada`
  filtra `where oi.offer_id is not null limit 1` para no confundir las líneas de
  licencia (`offer_id = NULL`) con el ítem de la oferta al reconstruir la orden.

## Fase 3 / Sprint 3C.3 — Servicios y soporte: COMPLETADA ✅

**Cerrado el 2026-11-01.** API pura 0.9.0: servicios de composición/producción
por encargo (solicitud → cotización → aceptación con proyecto congelado →
comprobante → aprobación sin efectos de acceso → entregas con URL firmada →
entrega de pista con entitlement `grant_source=service`) y soporte (tickets
por categoría, mensajes con adjuntos privados, respuestas y estados staff,
reclamos YouTube con URL/claim), más la subida de master por el manager del
artista. **No se construyó ni modificó UI**: los clientes se integran contra
`docs/development/integracion-api.md`.

| Entregable | Ubicación | Estado |
|---|---|---|
| Migración 00023 (`service_requests`, `service_quotes`, `service_projects` unique por cotización, `service_deliverables` append-only con CHECK de exclusión pista/archivo, `service_payments`; CHECK de `entitlements.grant_source` ampliado a `'service'` con drop/add; grants sin DELETE ni UPDATE en append-only) | `database/migrations/` | Hecho |
| Migración 00024 (`support_tickets` con categorías y UNIQUE (usuario, clave), `support_messages` append-only; grants mínimos) | `database/migrations/` | Hecho |
| Módulo `servicios` (usuario: solicitudes idempotentes, aceptar/rechazar cotización con proyecto congelado en la misma tx, comprobante multipart ≤ 5 MiB por contenido, detalle de proyecto con URLs firmadas) | `services/api/internal/modules/servicios/` | Hecho |
| Endpoints staff de servicios (listar/cotizar/estado de solicitudes, entregas multipart pista-o-archivo con entitlement `service` idempotente y auditoría doble, estados de proyecto, aprobar/rechazar pago sin efectos de acceso) | `services/api/internal/modules/servicios/staff.go` | Hecho |
| Módulo `soporte` (tickets idempotentes con validación de titularidad de orden/licencia y reclamos YouTube, mensajes multipart con adjunto opcional, staff: listar/responder/estados con auditoría) | `services/api/internal/modules/soporte/` | Hecho |
| Subida de master por manager (`POST /mis-artistas/{artistId}/pistas/{trackId}/master`, audio ≤ 100 MiB por contenido, despublica el anterior, auditoría en la misma tx) | `services/api/internal/modules/artists/master.go` | Hecho |
| Seed: corrección de idempotencia sobre tabla append-only (`license_terms_versions` pasó a `ON CONFLICT DO NOTHING`) | `services/api/cmd/seed/seed_licencias.go` | Hecho |
| Colección Bruno: 63 requests nuevos (213 total: 98 tests, 484 aserciones) con fixtures multipart propios | `bruno/` | Hecho |

### Verificación contra sistema real (2026-11-01, tras `make db-reset` desde cero)

- 24 migraciones goose down+up limpias (reset completo con datos de corridas
  anteriores, incluidos entitlements `service`); `make db-security`, GoTrue
  healthy y seed aplicados. Tras el reset el orden operativo es: migraciones +
  seed → `docker compose restart gotrue` → signups de la colección (crean los
  usuarios en GoTrue) → `make db-staff` / `make db-artist-role` (resuelven el
  usuario por email en `auth.users`).
- Colección Bruno completa tras reset desde cero: **213/213 requests, 98/98
  tests, 484/484 aserciones** en verde; segunda corrida consecutiva sobre los
  mismos datos vuelve a quedar en verde (repetible sin reset).
- Flujo de servicios real: solicitud idempotente (reintento devuelve el mismo
  recurso; clave con otro payload → 409) → staff toma y cotiza dos veces → el
  cliente rechaza una y acepta otra: proyecto `en_curso` con `quote_snapshot`
  congelado; re-aceptar devuelve `ya_estaba_aceptada` sin duplicar →
  comprobante multipart real → aprobación staff `confirmed` y re-aprobación
  `ya_estaba_revisado` (sin crear acceso alguno) → entrega de archivo PDF con
  URL firmada → entrega de pista: `acceso_creado` true la primera vez,
  `false` al re-entregar (índice único parcial) → proyecto `entregado` y
  `cerrado` → el cliente ve el acceso en `/mis-compras` con `origen:
  service`, `licencias []` vacío y `premium_activo: false` → descarga del
  master con URL firmada; otro usuario recibe 404 en la descarga.
- Master por API: audio real WAV → `master_publicado: true` (MIME `audio/wave`
  detectado por contenido; reemplaza al master del seed); MIME falso → 422;
  100 MiB + 1 byte → 422 (curl); member → 403; artista ajeno → 404.
- Soporte real: ticket de pagos vinculado a orden propia → mensaje de texto y
  mensaje con adjunto PNG → respuesta staff (`autor: staff`) → tomar →
  resolver → reabrir → cerrar; mensaje en ticket cerrado → 409; ticket ajeno
  → 404; adjunto con MIME falso → 422; 5 MiB + 1 byte → 422 (servicios
  comprobante, soporte adjunto y entrega de archivo, verificados con curl);
  reclamo YouTube sin URL/claim → 422; orden/licencia ajena → 404; detalle
  del ticket con la conversación completa y el adjunto servido por URL firmada.
- Autorización cruzada: editor staff → 403 en endpoints staff nuevos
  (servicios y soporte); sin token → 401; titular o staff siempre (acceso
  ajeno → 404).
- Auditoría en la misma transacción de cada mutación: `servicio.creado`,
  `servicio.cotizado`, `servicio.aceptado`, `servicio.estado`,
  `servicio.comprobante_subido`, `servicio.pago_confirmado`,
  `servicio.entregado`, `acceso.concedido`, `servicio.proyecto_estado`,
  `ticket.creado`, `ticket.mensaje`, `ticket.estado`, `pista.master_subido`.
- Privilegios SQL verificados con `triomision_api`: DELETE denegado en las 7
  tablas nuevas; UPDATE denegado en `service_deliverables` y
  `support_messages` (append-only); sin acceso a `auth`; sin borrar
  `audit_events` ni insertar `staff_roles`.
- MinIO: la cuenta de servicio conserva solo `s3:GetObject`/`s3:PutObject` —
  `mc admin user list` con sus credenciales → Access Denied; los objetos
  nuevos viven en `services/` y `support/` del bucket privado.
- `go build`, `go vet`, `gofmt`, `go test ./...` 100% limpios; Swagger UI 200,
  spec 0.9.0 con 71 paths (51 previos + 20 nuevos).

### Decisiones y hallazgos del Sprint 3C.3

- **Servicios no son tienda**: una solicitud no es una orden. No hay ofertas
  ni cupones; el monto se acuerda en la cotización y se congela en el
  proyecto (`quote_snapshot`). La aprobación del comprobante confirma el pago
  pero jamás crea entitlements, suscripciones ni licencias: el único acceso
  posible es el entitlement de la pista entregada (`grant_source=service`),
  concedido por la entrega con `ON CONFLICT DO NOTHING`.
- **Hallazgo 1 (preexistente, corregido):** el seed hacía `ON CONFLICT (id)
  DO UPDATE` sobre `license_terms_versions`, tabla append-only sin privilegio
  UPDATE para `api_app`: `INSERT ... ON CONFLICT DO UPDATE` exige UPDATE aunque
  no ocurra el conflicto, así que `make db-seed` fallaba tras cualquier reset
  desde 00021. Corregido a `DO NOTHING` (los términos son inmutables).
- **Hallazgo 2:** el down de 00023 no re-strecha el CHECK de
  `grant_source` (con datos `service` reinstalar el dominio viejo viola 23514;
  00009 elimina la tabla inmediat después en cualquier reset completo). Se
  documentó en la propia migración.
- **Idempotencia de doble aceptación:** el lock `FOR UPDATE` sobre cotización
  y solicitud serializa aceptaciones concurrentes de distintas cotizaciones;
  la segunda recibe 409 (`la solicitud ya tiene una cotización aceptada`).
- **Multipart en Bruno:** su runner no construye el formulario; los requests
  usan fixtures raw con el delimitador real (`--` + boundary, 32 guiones para
  el boundary de 30) y los formularios de texto/campos combinados viajan en
  el mismo fixture.
- **Re-ejecución consecutiva:** el usuario de servicios es una cuenta limpia
  (`servicios@triomision.local`, signups tolerantes 200/422); la entrega de
  pista reporta `acceso_creado` booleano porque el entitlement vigente puede
  venir de la corrida anterior, y la no-duplicación dura se verifica con la
  re-entrega y `/mis-compras`.

### Revisión del Sprint 3C.3 (2026-11-01, Kimi) — CERRADA ✅

Alcance revisado: migraciones 00023-00025, módulos `servicios` y `soporte`
(titular y staff), `artists/master.go`, registro en el servidor, seed,
colección Bruno nueva y documentación. Verificación independiente completa:
`make db-reset` desde cero (24→0→24, luego 00025) + db-security + seed +
GoTrue + roles, `go build/vet/gofmt/test` limpios, OpenAPI 0.9.0 con 71 paths,
Swagger 200 y **Bruno 213/213 requests, 98/98 tests y 484/484 aserciones**
tanto antes como después de las correcciones.

**Hallazgos corregidos:**

1. **`integracion-api.md` desactualizado**: la cabecera seguía en 0.8.1 con la
   API ya en 0.9.0 y 20 endpoints nuevos. Actualizada a 0.9.0.
2. **Carrera en comprobantes de servicio**: dos subidas concurrentes podían
   dejar dos pagos `in_review` del mismo proyecto (el `insert … where not
   exists` no se serializa). Migración **00025**
   (`service_payments_in_review_uidx`, índice único parcial, mismo patrón que
   `license_grants_order_item_uidx`) + manejo de 23505 → 409 en `subirPago`.
3. **`crearTicket` devolvía 409 ante una carrera de reintentos idénticos**:
   el 23505 no re-leía el ticket para comparar payloads (inconsistente con
   `crearSolicitud`). Ahora re-lee: mismo payload → devuelve el ticket; payload
   distinto → 409.
4. **`track_id` de la entrega sin validación de formato**: un UUID mal formado
   en el formulario multipart producía 500 (los campos de formulario no pasan
   por la validación `format` de Huma). Ahora → 422.

**Observaciones menores registradas (sin corrección, no bloquean Fase 4):**

- Los uploads a MinIO ocurren antes de la transacción: un 409 posterior deja
  el objeto huérfano (patrón ya existente en comprobantes de tienda).
- `subirMaster` lee el archivo completo en memoria (máx. 100 MiB): aceptable
  al volumen actual; si crece, streaming con checksum incremental.
- `listarSolicitudes` hace N+1 consultas (≤ 50 filas): sin impacto real hoy.
- Sin commit todavía: todo el trabajo (3C.2 revisado, 3C.3 y esta revisión)
  sigue en el árbol de trabajo esperando la decisión del usuario.

## Fase 4 / Sprint 4A — Sync incremental y descargas offline: COMPLETADA ✅

**Cerrado el 2026-11-01.** API pura 0.10.0: delta de catálogo por cursor
opuesto con tombstones y licencias de descarga offline por dispositivo, con
cascadas de revocación. **No se construyó ni modificó UI.**

| Entregable | Ubicación | Estado |
|---|---|---|
| Migración 00026 (`offline_downloads`: origen `entitlement\|premium`, 30 días renovables, índice único parcial (device_id, track_id) vigente; grants sin DELETE) | `database/migrations/` | Hecho |
| Delta de catálogo: 6 entidades (artistas, álbumes, canciones con ChordPro, himnos, versiones con ChordPro, pistas) paginadas por (updated_at, id) con cursor base64; published vivo siempre, no publicadas/eliminadas solo si cambiaron desde el cursor; cursor estable en cada página incluida la final | `services/api/internal/modules/sync/sync.go` | Hecho |
| Licencias offline del titular: crear/renovar por lote con rechazos motivados (pista inexistente / sin acceso), listado con estado; dispositivo ajeno → 404, revocado → 409 | `services/api/internal/modules/sync/sync.go` | Hecho |
| Cascadas en la misma tx: revocar dispositivo (propio/staff) revoca sus licencias; revocar entitlement revoca las `origen=entitlement` de esa pista y usuario | `devices/devices.go`, `staff/staff.go` | Hecho |
| Endpoints staff: listar (filtros usuario/dispositivo) y revocar con auditoría `descarga_offline.revocada` (editor → 403) | `services/api/internal/modules/sync/staff.go` | Hecho |
| Colección Bruno: 26 requests nuevos (239 total: 113 tests, 534 aserciones) | `bruno/` | Hecho |

### Verificación contra sistema real (2026-11-01, tras `make db-reset` desde cero)

- 26 migraciones goose down+up limpias con datos; `make db-security`, GoTrue
  healthy y seed aplicados (orden: reset → restart gotrue → signups → roles).
- Colección Bruno completa tras reset desde cero: **239/239 requests, 113/113
  tests, 534/534 aserciones** en verde; segunda corrida consecutiva sobre los
  mismos datos vuelve a quedar en verde (repetible sin reset).
- Sync: paseo inicial de 4 páginas (cursor presente en todas, has_more en las
  primeras), delta desde el cursor final vacío sin cambios, alta + edición +
  publicación de una canción como manager aparecen como una sola fila con el
  estado final, y el borrado de un himno (SQL con `updated_at` actualizado)
  aparece como tombstone `eliminado=true` (verificado con curl; las bajas por
  API deben actualizar `updated_at`). Cursor inválido → 422.
- Offline: entitlement → `origen=entitlement` (comprador 2, dos pistas);
  re-solicitar renueva sin duplicar (mismo id); UUID inexistente → rechazada
  "pista no encontrada"; usuario sin acceso ni Premium → rechazada "sin acceso
  vigente a la pista"; Premium activo sin entitlement → `origen=premium`;
  licencia offline usada como entitlement en `/mis-compras/accesos/{id}/descarga`
  → 404 (jamás habilita el master); dispositivo ajeno → 404.
- Cascadas: revocar el entitlement de la pista 1 del usuario principal revoca
  su licencia offline `origen=entitlement` en la misma tx (la licencia de
  origen premium no se toca); revocar el dispositivo revoca sus licencias
  restantes y nuevas solicitudes sobre él → 409.
- Staff: listado con usuario/install_id/estado; revocación con auditoría;
  editor → 403; sin token → 401 (cuberto por el middleware global).
- SQL con `triomision_api`: DELETE denegado en `offline_downloads`; SELECT e
  UPDATE permitidos; sin acceso a `auth`.
- `go build`, `go vet`, `gofmt`, `go test ./...` limpios; Swagger 200, spec
  0.10.0 con 75 paths (71 + 4 nuevos).

### Decisiones y hallazgos del Sprint 4A

- **Cursor estable en la página final**: la primera implementación devolvía
  cursor vacío cuando `has_more=false`, con lo que el cliente perdía la
  posición al terminar el sync inicial y el siguiente delta reenviaba todo.
  Corregido: toda página devuelve el cursor de su última fila.
- **Diseño de la cascada sobre el usuario correcto**: la primera versión de
  la colección revocaba el entitlement de pista 2 del comprador 2, que los
  flujos 3C.1 necesitan en re-ejecuciones sin reset. Se movió al entitlement
  de pista 1 del usuario principal (el flujo 3A crea uno nuevo en cada
  corrida).
- **La licencia offline no es un entitlement**: habilita reproducción cifrada
  offline del cliente (Fase 5); la vía de descarga del master sigue exigiendo
  entitlement de tienda.
- **Visibilidad del delta**: las filas publicadas vivas siempre viajan; las
  no publicadas o eliminadas solo si cambiaron desde el cursor. Esto exige
  que toda baja/despublicación actualice `updated_at` (contrato de escritura
  del catálogo).

### Revisión del Sprint 4A (2026-11-01, Kimi) — CERRADA ✅

Alcance revisado: migración 00026, módulo `sync` (delta, licencias del titular
y staff), cascadas en `devices.go` y `staff/staff.go`, registro en el servidor,
colección Bruno nueva y documentación. Verificación independiente completa:
`make db-reset` desde cero (26 migraciones) + db-security + seed + GoTrue +
signups + roles, `go build/vet/gofmt/test` limpios, OpenAPI 0.10.0 con 75
paths, Swagger 200 y **Bruno 239/239 requests, 113/113 tests y 534/534
aserciones** con las correcciones aplicadas.

**Hallazgos corregidos (sin commit, en el árbol de trabajo):**

1. **Premium licenciaba offline pistas no publicadas**: `accesoVigente` solo
   exigía que la pista existiera; cualquier suscriptor Premium podía obtener
   licencias offline de borradores o de pistas de encargos ajenos adivinando
   el UUID. Ahora el origen `premium` exige `is_published`; el origen
   `entitlement` sigue valiendo para cualquier pista (los encargos entregados
   no se publican en la tienda).
2. **`integracion-api.md` desactualizado otra vez**: la cabecera quedó en
   0.9.0 con la API en 0.10.0 (mismo olvido que en la revisión del 3C.3;
   queda como recordatorio para los próximos agentes). Actualizada a 0.10.0.
3. **Doc del campo `cursor` engañosa**: decía "vacío cuando has_more=false",
   pero el contrato real (intencional) es devolver el cursor de la última fila
   en toda página, incluida la final, para encadenar el próximo delta.
   Descripción corregida en el spec.

**Observaciones menores registradas (sin corrección):**

- Las concesiones/renovaciones de licencias offline no auditan (las
  renovaciones serían ruido; las revocaciones staff y cascadas sí auditan).
- La cascada por entitlement revocado usa `origen='entitlement'`: si el
  usuario además tiene Premium, su licencia se revoca igual y puede
  re-solicitarla (volvería como `origen=premium`). Comportamiento aceptable.
- El agente commiteó el sprint (1021eef, junto con la revisión 3C.2 y el 3C.3
  en ff4abeb y eabc9de); solo las correcciones de esta revisión quedan sin
  commit.

## Planes detallados de Fase 4 (referencia ya ejecutada)

> Los sprints 4A y 4B se completaron el 2026-11-01 (ver secciones
> superiores con resultados reales). Estos planes se conservan como
> referencia histórica; el pendiente de la fase es solo el 4C (FCM).

### Sprint 4B — Worker + conversión PDF→ChordPro (plan detallado)

**Solo backend (API + worker); no construir ni modificar UI.**

**Objetivo vertical:** un staff sube un PDF editorial de canciones/himnos →
la API crea un `media_job` encolado con el PDF en MinIO → el worker
(`services/worker`, proceso Go separado) lo toma de la cola, extrae el texto
posicionado y lo convierte a ChordPro (port del algoritmo determinista de
`legacy/panelweb-triomision-lyrics/src/lib/pdfToCho.ts`) guardando el
resultado en el job → staff revisa el resultado por API y **publica
manualmente** las canciones aprobadas como borradores del catálogo/himnario.
La conversión es **editorial** (staff), no de usuarios finales: los PDFs
personales no se suben (alcance §7). Nada se publica sin revisión humana.

**1. Modelo y migraciones (00027; sin alterar las aplicadas)**

- `media_jobs` (id, job_type `pdf_chordpro` CHECK extensible, parameters_json
  jsonb, tool_version text, status `queued|running|done|failed`, progress
  int 0-100, error_code text nullable, result_json jsonb nullable,
  created_by FK profiles, created_at, started_at, completed_at) — según
  `docs/architecture/modelo-datos-v2.md` §4, con `result_json` añadido
  (documentar el cambio en el modelo).
- `media_job_assets` (media_job_id FK, media_asset_id FK, input_output_role
  `input|output`, PK compuesta) — el PDF de entrada vive en MinIO como
  `media_assets` privado vinculado al job.
- Idempotencia: `idempotency_key` UNIQUE por `created_by` en `media_jobs`
  (mismo patrón de `service_requests`/`support_tickets`: clave repetida con
  otro payload → 409).
- Grants mínimos para `api_app` (sin DELETE; UPDATE permitido en
  `media_jobs` para que el worker avance estados — el worker usa la misma
  cuenta o una propia `worker_app` si el agente lo justifica, documentando
  la decisión) y verificación con `scripts/db-security.sh`. Migración
  reversible (down+up desde cero).
- Sin seed nuevo.

**2. Contratos de la API (módulo `importaciones` o similar)**

Todos staff admin/vendedor (editor → 403; sin token → 401):

- `POST /api/v1/staff/importaciones/pdf` (multipart PDF ≤ 20 MiB, MIME por
  contenido siguiendo el patrón de `store/pagos.go` y `artists/master.go`,
  campos de formulario con validación manual de UUIDs donde aplique,
  `idempotency_key`) → sube el PDF a MinIO (`imports/`), crea
  `media_assets` + `media_job` `queued` + `media_job_assets(input)` en la
  misma tx con auditoría (`importacion.creada`).
- `GET /api/v1/staff/importaciones` (filtro por estado, paginado) y
  `GET /api/v1/staff/importaciones/{id}` (estado, progreso, error_code y,
  cuando `done`, el resultado: lista de canciones con título detectado,
  chordpro, status `ok|revisar` e issues por canción).
- `POST /api/v1/staff/importaciones/{id}/publicar`: body con los índices de
  canciones aprobadas y el destino (álbum/catálogo de artista existente o
  colección del himnario, según el tipo de contenido) → crea las canciones/
  himnos como **borradores** (`is_published=false`) en la misma tx con
  auditoría (`importacion.publicada` con conteo e ids). Idempotente:
  publicar dos veces los mismos índices no duplica filas (marcar en
  `result_json` o tabla auxiliar los índices ya publicados; repetir devuelve
  el estado actual sin duplicar).
- `POST /api/v1/staff/importaciones/{id}/reintentar`: solo si `failed` →
  vuelve a `queued` (limpiando error/progreso) con auditoría.
- El worker **nunca** escribe en el catálogo: solo la API publica, tras la
  revisión humana explícita.

**3. Worker (`services/worker`)**

- Módulo Go propio (`go.mod` `triomision/worker`) que comparte solo
  PostgreSQL y MinIO con la API (mismo `.env` raíz; `make worker-run`).
- Loop de cola sobre PostgreSQL con `SELECT … FOR UPDATE SKIP LOCKED` (sin
  infraestructura nueva: la cola es la tabla `media_jobs`), con sleep
  configurable y flag `--once` (procesa los pendientes y sale) para la
  verificación automatizada.
- Ciclo de vida del job: `queued → running` (started_at, progreso) →
  `done` (result_json, completed_at) o `failed` (error_code estable, p. ej.
  `pdf_invalido`, `sin_texto_extraible`, completed_at). Un job fallido se
  puede reintentar por la API.
- Extracción de texto **posicionada** (x/y por item): la alineación
  acorde-sobre-letra la exige. El agente elige y documenta una de:
  (a) `pdftotext -bbox` (poppler) vía `os/exec`, declarando el prerequisito
  (`brew install poppler`) en `services/worker/README.md` y fallando con
  error claro si falta; o (b) una librería Go pura con posiciones de texto.
  En ambos casos: verificación E2E obligatoria con el PDF real
  `content/himnario/source/Acordes_para_el_himnario_adventista_2020_3.pdf`.
- Conversión: port fiel a Go del algoritmo de
  `legacy/panelweb-triomision-lyrics/src/lib/pdfToCho.ts` (es la
  especificación): agrupar items por líneas, separar líneas de acordes de
  líneas de letra, emitir ChordPro, conversión latina→anglosajona,
  detección de título/número/tono/capo/autor y `issues` por canción con
  `status: ok|revisar`. 100 % determinista; **sin** OCR ni IA.
- `result_json` por canción: `{indice, titulo, numero, tono, capo, autor,
  chordpro, status, issues[]}`. `tool_version` registra la versión del
  conversor (constante del worker).

**4. Pruebas obligatorias**

- E2E real: `POST` del PDF del himnario → job `queued` → `worker --once` →
  job `done` con canciones extraídas (asertar al menos una canción con
  chordpro no vacío y título detectado) → `publicar` un índice → la canción
  existe como borrador visible para el manager del artista destino vía API;
  re-publicar el mismo índice no duplica.
- PDF inválido (fixture que no es PDF o sin texto) → `failed` con
  error_code; `reintentar` lo vuelve `queued`; worker lo procesa de nuevo.
- Idempotencia de creación (clave repetida → mismo job; con otro payload →
  409). Editor → 403 en todos los endpoints; sin token → 401; job ajeno no
  aplica (todos son staff), pero validar roles.
- Worker: con cola vacía `--once` sale limpio; dos workers no toman el
  mismo job (SKIP LOCKED, verificable con un job lento o retraso
  artificial); job `running` huérfano (worker muerto) documentado
  (reintentar manual por ahora).
- Bruno en dos tiempos (crear job, correr `worker --once` entre requests —
  puede orquestarse en el flujo de verificación o con worker en segundo
  plano) con aserciones de estados y resultado; colección Bruno completa en
  verde tras `make db-reset` desde cero y en re-ejecución.
- Privilegios SQL verificados (`api_app`/`worker_app` sin DELETE en tablas
  nuevas, sin acceso a `auth`); MinIO: el PDF queda privado y solo se sirve
  con URL firmada a staff.
- `go build`, `go vet`, `gofmt`, `go test ./...` limpios **en ambos
  módulos** (api y worker); Swagger 200.

**5. Documentación y salida**

- Bump a **0.11.0**. Actualizar: `docs/development/integracion-api.md`
  (**incluida la cabecera "Versión de contrato"**, no olvidar),
  `docs/architecture/modelo-datos-v2.md` §4/§5 (`result_json`, esquema
  real), `services/api/README.md`, `services/worker/README.md` (prerequisitos,
  `--once`, ciclo de vida, prerequisito poppler si aplica), `Makefile`
  (`worker-run`), `AGENTS.md` y este archivo con resultados reales.
- **No** implementar en 4B: FCM/push_tokens (4C), derivados/transcodificación
  de audio, OCR, IA/LLM para la conversión, edición del ChordPro resultante
  por API (la revisión es aprobar/rechazar índices; la edición fina llega con
  el panel en Fase 5), ni UI.
- **Criterio de salida:** importación de un PDF procesada por el worker con
  seguimiento desde la API (criterio de la fase en
  `docs/planificacion/README.md`), conversión determinista verificada con el
  himnario real y publicación como borrador únicamente tras revisión humana.

### Sprint 4A — Sync incremental y descargas offline (plan detallado, referencia)

**Solo API; no construir ni modificar UI.**

**Objetivo vertical:** un dispositivo registrado del usuario (APK/PC) sincroniza
el catálogo de forma incremental (delta por cursor, con tombstones de los
borrados) y obtiene licencias de descarga offline con vencimiento para las
pistas a las que tiene acceso (entitlement vigente o Premium activo), revocables
con el dispositivo o con el acceso.

**1. Modelo y migraciones (00026; sin alterar las aplicadas)**

- `offline_downloads` (id, user_id FK profiles, device_id FK devices,
  track_id FK tracks, origen `entitlement|premium`, granted_at, expires_at
  (licencia temporal, p. ej. 30 días renovables), last_seen_at, revoked_at).
  Índice único parcial `(device_id, track_id) where revoked_at is null`
  (idempotencia, mismo patrón del proyecto).
- Grants mínimos para `api_app` (sin DELETE) y verificación con
  `scripts/db-security.sh`. Migración reversible (down+up desde cero).
- Sin seed nuevo: se ejercita con el catálogo y usuarios de la colección.

**2. Contratos y lógica de negocio (módulo `sync`)**

- `GET /api/v1/sync/catalogo?desde={cursor}&limite=` (autenticado): delta de
  catálogo público e himnario ordenado por `updated_at` (artists, albums,
  songs, hymns, hymn_versions, tracks publicados). Cursor opaco compuesto
  (`updated_at` + `id`, base64) en la respuesta; las filas con `deleted_at`
  viajan como tombstones `{tipo, id, eliminado: true}`. `limite` con máximo
  (p. ej. 500) y `has_more`.
- `POST /api/v1/dispositivos/{installId}/descargas-offline` (titular del
  dispositivo): body `{track_ids: [...]}`. Por cada pista exige acceso vigente
  del usuario (entitlement activo → `origen=entitlement`; si no, Premium
  activo → `origen=premium`; si ninguno, la pista se reporta rechazada con el
  motivo). Crea/renueva la licencia offline (idempotente por el índice
  parcial), con `expires_at = now() + 30 días`. Respuesta: concedidas,
  renovadas y rechazadas.
- `GET /api/v1/dispositivos/{installId}/descargas-offline`: licencias del
  dispositivo con su vencimiento. Dispositivo ajeno → 404.
- Revocaciones en cascada (misma tx que la operación origen): revocar un
  dispositivo revoca sus licencias offline; revocar un entitlement revoca las
  licencias offline con `origen=entitlement` de esa pista para ese usuario.
- Offline ≠ master: la licencia offline habilita la reproducción cifrada en el
  cliente; jamás la descarga del archivo por la vía de la tienda.
- Staff: `GET /api/v1/staff/descargas-offline` (filtros usuario/dispositivo) y
  `POST /api/v1/staff/descargas-offline/{id}/revocar` (motivo + auditoría,
  idempotente; editor → 403).

**3. Pruebas obligatorias**

- Sync: cursor inicial vacío devuelve todo paginado; crear/editar/eliminar una
  canción como manager aparece en el delta siguiente (el borrado como
  tombstone); el cursor es estable entre corridas.
- Offline: pista con entitlement → concedida; solo Premium → `origen=premium`;
  sin acceso → rechazada con motivo; re-solicitar renueva sin duplicar;
  revocar el dispositivo revoca sus licencias; revocar el entitlement revoca
  las de esa pista; la licencia offline NO habilita `/mis-compras/accesos/…/descarga`.
- Autorización cruzada (ajeno → 404, editor → 403, sin token → 401), auditoría,
  privilegios SQL/MinIO, build/vet/gofmt/tests, Bruno completo tras
  `make db-reset` y en re-ejecución, OpenAPI/Swagger 200.

**4. Documentación y salida**

- Bump a **0.10.0**. Actualizar `docs/development/integracion-api.md`,
  `docs/architecture/modelo-datos-v2.md` §5, `services/api/README.md`,
  `AGENTS.md` y este archivo con resultados reales.
- **No** implementar en 4A: worker, PDF→ChordPro, FCM/push_tokens, cifrado real
  de los archivos offline (la licencia y su vencimiento son el contrato; el
  cifrado lo aplica el cliente en Fase 5), ni sync de Mi Música (biblioteca
  personal, pendiente de su modelo).
- **Criterio de salida:** sync delta verificado de extremo a extremo con
  tombstones y licencias offline con vencimiento, cascadas de revocación y
  efectos disjuntos (offline nunca habilita la descarga del master).

## Siguiente tarea — Sprint 3C.3 (servicios y soporte)

**Estado:** ✅ COMPLETADO el 2026-11-01 (ver sección superior). El plan que
siguió la sesión se conserva abajo como referencia.

### Objetivo vertical

Un cliente solicita una composición/producción por encargo (música compuesta o
instrumentación/pista), staff la cotiza, el cliente acepta, sube el comprobante
del pago acordado (QR/transferencia) y staff lo confirma; el proyecto avanza y
staff publica entregas. Cuando la entrega es una **pista vendida**, el cliente
recibe además el **acceso vinculado**: un entitlement del audio que aparece en
`/mis-compras` y habilita la descarga del master por la vía ya existente. Las
demás entregas (stems, partituras, PDFs) son archivos privados con URL firmada.
En paralelo, cualquier usuario abre un ticket de soporte (pagos, descargas,
permisos o reclamo YouTube) con mensajes y adjuntos privados, visible solo para
el titular y staff. Servicios **no** son checkout de la tienda: no hay planes
mensuales, firmas digitales ni documentos contractuales; jamás crean
suscripciones Premium ni licencias — el único efecto de acceso permitido es el
entitlement de la pista entregada.

### 1. Modelo y migraciones nuevas (00023-00024; sin alterar las aplicadas)

- **00023_servicios.sql**
  - `service_requests` (id, user_id FK profiles, tipo
    `composicion|produccion|arreglo`, titulo, descripcion, referencias jsonb,
    estado `nueva|en_revision|cotizada|aceptada|rechazada|cancelada`,
    idempotency_key UNIQUE por usuario, created_at/updated_at).
  - `service_quotes` (id, request_id FK, staff_id, amount_minor bigint > 0,
    currency char(3), terms_text, estado `enviada|aceptada|rechazada`,
    created_at). Una solicitud admite re-cotizaciones; solo una aceptada.
  - `service_projects` (id, request_id, quote_id, user_id, monto y moneda
    congelados de la cotización + `quote_snapshot` jsonb con términos, estado
    `en_curso|entregado|cerrado`, created_at/updated_at). UNIQUE (quote_id).
  - `service_deliverables` (id, project_id FK, staff_id, titulo, nota,
    track_id FK tracks **nullable**, file_key MinIO privado, mime, size_bytes,
    created_at). Append-only. CHECK: exactamente uno de `track_id` (entrega de
    pista vendida, vincula acceso) o `file_key` (archivo adjunto privado).
  - `service_payments` (id, project_id FK, user_id, receipt_key, mime,
    size_bytes, estado `in_review|confirmed|rejected`, reviewed_by,
    reviewed_at, created_at). Mismo patrón que comprobantes de tienda
    (multipart ≤ 5 MiB, MIME por contenido) pero sin efectos de acceso.
  - Ampliar el CHECK de `entitlements.grant_source` para incluir `'service'`
    (drop/add del constraint en la misma migración, sin tocar migraciones
    aplicadas). La idempotencia del acceso la da el índice parcial existente
    `entitlements_active_track_uidx`.
- **00024_soporte.sql**
  - `support_tickets` (id, user_id FK, categoria
    `pagos|descargas|permisos|reclamo_youtube|otro`, asunto, estado
    `abierto|en_atencion|resuelto|cerrado`, order_id FK nullable,
    license_grant_id FK nullable, youtube_url, youtube_claim_id,
    idempotency_key UNIQUE por usuario, created_at/updated_at). CHECK de
    dominio en estados/categorías; la obligatoriedad de URL/claim en reclamos
    YouTube se valida en API.
  - `support_messages` (id, ticket_id FK, author_id FK profiles, author_kind
    `usuario|staff`, cuerpo, attachment_key/mime/size nullable, created_at).
    Append-only para la API.
- Grants mínimos para `api_app` (sin DELETE; sin UPDATE en
  `service_deliverables` ni `support_messages`) y verificación con
  `scripts/db-security.sh`. Migraciones reversibles (down+up desde cero).
- Sin seed nuevo: no hay datos sin usuarios reales (vienen de GoTrue).

### 2. Contratos y lógica de negocio

- **Módulo `servicios`** (`internal/modules/servicios/`):
  - Usuario: `POST /api/v1/servicios/solicitudes` (idempotente por clave),
    `GET /api/v1/servicios/solicitudes` y `/{id}` (con cotizaciones y proyecto),
    `POST /api/v1/servicios/cotizaciones/{id}/aceptar` y `/rechazar`
    (idempotente; aceptar crea el proyecto con snapshot congelado en la misma
    tx; solo cotizaciones `enviada` de solicitudes propias),
    `POST /api/v1/servicios/proyectos/{id}/pagos` (multipart comprobante,
    máx 5 MiB, MIME por contenido, reutilizando el patrón de
    `store/pagos.go`), `GET /api/v1/servicios/proyectos/{id}` (con entregas y
    URLs firmadas breves tras verificar titularidad).
  - Staff (admin/vendedor; editor → 403): `GET /api/v1/staff/servicios/solicitudes`
    (filtro estado), `POST .../solicitudes/{id}/cotizar`,
    `POST .../solicitudes/{id}/estado` (transiciones válidas),
    `POST .../proyectos/{id}/entregas` (archivo privado a MinIO **o**
    `track_id` de pista vendida),
    `POST .../proyectos/{id}/estado`, `POST .../pagos/{id}/aprobar|rechazar`
    (transaccional, idempotente, auditado; no concede acceso alguno).
  - **Entrega de pista con acceso vinculado**: al crear la entrega con
    `track_id`, la API exige en la misma tx que la pista tenga master publicado
    (`track_media role='master' and is_published`; si no → 422) e inserta el
    entitlement del cliente con `grant_source='service'`
    (`ON CONFLICT DO NOTHING`: repetir la entrega no duplica el acceso).
    El cliente lo ve en `/mis-compras` → `accesos []` y descarga por
    `/mis-compras/accesos/{id}/descarga` (vía existente). Auditoría:
    `servicio.entregado` + `acceso.concedido` en la misma transacción.
  - **Subida de master (manager del artista)**: hoy solo el seed registra
    masters; el encargo de pistas necesita vía API:
    `POST /api/v1/mis-artistas/{artistId}/pistas/{trackId}/master`
    (middleware `RequireArtistRole manager`, multipart audio ≤ 100 MiB, MIME de
    audio por contenido) → objeto privado en MinIO + `media_assets` +
    `track_media` (`role='master'`, `is_published=true`; despublica el master
    anterior si existía) con auditoría en la misma tx. La pista puede
    permanecer `is_published=false` en el catálogo público: el acceso del
    cliente depende del entitlement, no de la publicación en tienda.
- **Módulo `soporte`** (`internal/modules/soporte/`):
  - Usuario: `POST /api/v1/soporte/tickets` (idempotente; valida que
    order_id/license_grant_id referenciados sean del propio usuario, si no 404;
    reclamo YouTube exige `youtube_url` y `youtube_claim_id`),
    `GET /api/v1/soporte/tickets` y `/{id}` (con mensajes y URLs firmadas de
    adjuntos), `POST /api/v1/soporte/tickets/{id}/mensajes` (texto + adjunto
    multipart opcional ≤ 5 MiB; solo si el ticket no está cerrado).
  - Staff: `GET /api/v1/staff/soporte/tickets` (filtros estado/categoría),
    `POST .../tickets/{id}/mensajes`, `POST .../tickets/{id}/estado`
    (resolver/cerrar/reabrir con motivo y auditoría).
- Autorización: titular o staff; cualquier acceso ajeno → 404 (no revelar
  existencia). Toda mutación con auditoría en la misma transacción
  (`servicio.cotizado`, `servicio.aceptado`, `servicio.pago_confirmado`,
  `servicio.entregado`, `ticket.creado`, `ticket.mensaje`, `ticket.estado`).
- Adjuntos y entregas: claves privadas en MinIO (`support/`, `services/`),
  entrega solo con URL firmada breve tras verificar acceso; nunca en logs.
- Convenciones del proyecto (ya conocidas): parámetros de ruta Huma de primer
  nivel, nombres de tipos de respuesta únicos entre módulos, montos en unidades
  menores, moneda ISO, idempotencia por clave de cliente con validación de
  payload (409 si la clave se reusa con otro cuerpo).

### 3. Pruebas obligatorias

- Flujo servicios E2E: solicitud → cotización staff → aceptación (proyecto con
  snapshot; re-aceptar no duplica) → comprobante → aprobación staff → entrega
  → descarga con URL firmada por el titular; 404 para otro usuario.
- **Acceso vinculado de pista vendida**: manager sube el master por API →
  staff entrega con `track_id` → el cliente ve la pista en `/mis-compras`
  `accesos []` con `grant_source='service'` y descarga el master; re-entregar
  no duplica el entitlement; otro usuario → 404 en la descarga; la entrega no
  crea licencias ni Premium (`licencias []` vacío, `premium_activo=false`).
  Entrega con `track_id` sin master publicado → 422.
- Master por API: audio real OK; MIME falso → 422; 100 MiB + 1 byte → 422;
  member (no manager) intentando subir → 403; pista ajena → 404.
- Flujo soporte E2E: ticket por categoría, mensaje con adjunto real, respuesta
  staff, resolución; mensajes en ticket cerrado → 409; ticket ajeno → 404.
- Reclamo YouTube: sin URL/claim → 422; referencia a orden/licencia ajena → 404.
- Adjuntos: MIME falso → 422; 5 MiB + 1 byte → 422 (ambos módulos).
- Idempotencia: claves repetidas devuelven el mismo recurso; reusada con otro
  payload → 409. Doble aprobación de pago de servicio no duplica ni crea acceso.
- Autorización cruzada: editor staff → 403 en todos los endpoints staff nuevos;
  usuario sin token → 401.
- Privilegios SQL verificados con `triomision_api` (sin DELETE en tablas nuevas,
  sin UPDATE en append-only) y MinIO (cuenta de servicio sin admin).
- Build/vet/gofmt/tests, colección Bruno completa en verde tras
  `make db-reset` desde cero y en re-ejecución; OpenAPI/Swagger 200.

### 4. Documentación y salida

- Bump a **0.9.0** (dominio nuevo). Actualizar
  `docs/development/integracion-api.md` (endpoints y ejemplos de cada flujo),
  `docs/architecture/modelo-datos-v2.md` §5 (esquema real), `docs/payments/README.md`
  (pagos de servicios), `services/api/README.md`, `AGENTS.md` y este archivo con
  resultados reales.
- Requests Bruno nuevos con entorno, autenticación explícita y aserciones
  útiles (ids con `bru.setEnvVar`; tokens/URLs firmadas con `bru.setVar`).
- **No** implementar: renovación automática, Binance/IAP, sync offline, FCM,
  worker, biblioteca personal (`user_songs`, setlists) ni UI.
- **Criterio de salida:** flujos de servicios y soporte verificados de extremo
  a extremo contra la API y PostgreSQL reales; efectos estrictamente separados
  de la tienda; todo documentado para que los clientes consuman solo la API.

### Revisión del Sprint 3C.2 (2026-11-01, Kimi) — CERRADA ✅

- Alcance revisado: migraciones 00021-00022, módulo `licencias` (admin por
  artista), `store/licencias.go` (oferta pública, `resolverLicencias`,
  `insertarItemsLicencia`, `registrarAceptaciones`), `crearOrden` e
  idempotencia con licencias, `grants.go` (`ConcederLicencia`), `/mis-compras`,
  aprobación staff y endpoints staff de licencias, y los 27 requests Bruno del
  flujo de licencias.
- **Hallazgo corregido (contrato duplicado):** la aprobación staff exponía
  `licencias_creadas` y `licencias_creados` con el mismo valor, y la revocación
  exponía `revocada_en` y `revocado_en`; los tests Bruno toleraban la
  ambigüedad en lugar de fijar el contrato. Quedaron `licencias_creados`
  (consistente con `accesos_creados`/`suscripciones_creados`) y `revocado_en`
  (consistente con el listado staff); Bruno ahora aserta el campo único.
  `/mis-compras` conserva `revocada_en` (contrato de usuario ya documentado).
- Observaciones menores registradas (sin corrección, no bloquean 3C.3):
  - `license_terms_versions` no tiene UNIQUE (artist_id, version_label): el
    manager podría publicar dos versiones con la misma etiqueta.
  - `guardarOpcion`: una carrera de dos PUT concurrentes sobre la misma
    (pista, uso) puede devolver 500 por violación de UNIQUE en vez de 409.
  - Auditoría `licencia.concedida` usa `entity_id` = orden (no el grant);
    queda trazable por metadata (`orden_id`, `licencias_creadas`).
- Verificación tras la corrección: `go build`, `go vet`, `gofmt`,
  `go test ./...` en verde; API 0.8.1 con OpenAPI 51 paths (sin
  `licencias_creadas` en el spec); colección Bruno completa contra el sistema
  real: **150/150 requests, 75/75 tests, 359/359 aserciones** en verde.

## Fase 3 / Sprint 3C.1 — Premium, paquetes de audio, cupones y canjes: COMPLETADA ✅

**Cerrado el 2026-10-27.** API pura 0.7.1: planes Premium con suscripciones
temporales, productos premium y paquetes multi-pista con snapshot congelado,
cupones fijos/porcentuales calculados en backend, códigos de canje con
vigencia/límites/idempotencia y endpoints staff mínimos con auditoría
transaccional. **No se construyó ni modificó UI**: los clientes se integran
contra `docs/development/integracion-api.md`.

| Entregable | Ubicación | Estado |
|---|---|---|
| Migraciones 00016-00019 (`plans`/`subscriptions`, `premium` en products + `include_future_tracks`, `coupons`/`coupon_uses` + totales en orders, `redemption_codes`/`redemptions` + grants mínimos) | `database/migrations/` | Hecho |
| Seed: Premium 30 días, paquete de 2 pistas (segunda pista demo), cupones BIENVENIDA10/FIJO500, códigos PREMIUM-DEMO/PAQUETE-DEMO | `cmd/seed/` | Hecho |
| `crearOrden` generalizado: snapshot de todos los ítems (pista/plan/paquetes), `coupon_code` opcional, subtotal/descuento/total calculados en backend, idempotencia conserva oferta+cupón+payload | `internal/modules/store/store.go` | Hecho |
| Concesión centralizada e idempotente: `ConcederPremium` (extiende período vigente), `ConcederPistasSnapshot` (snapshot congelado), `ConcederPistasProducto` (contenido vigente) | `internal/modules/store/grants.go` | Hecho |
| Aprobación de pagos generalizada: en la misma tx y con locks crea período Premium o entitlements de las pistas del snapshot; repetir no duplica | `internal/modules/staff/staff.go` | Hecho |
| Canje de códigos: vigencia, límites, idempotencia por clave y por (código, usuario), congela contenido, sin pago | `internal/modules/store/canjes.go` | Hecho |
| Planes públicos, ofertas con premium/paquetes (`pistas_total`), `/mis-compras` con suscripciones y `premium_activo` por tiempo | `internal/modules/store/` | Hecho |
| Endpoints staff de planes, cupones y canjes (admin+vendedor, editor → 403) con auditoría transaccional | `internal/modules/staff/comercial.go` | Hecho |
| Colección Bruno: 51 requests nuevos (118 total: 63 tests, 277 aserciones) | `bruno/` | Hecho |

### Verificación contra sistema real (2026-10-27, tras `make db-reset` desde cero)

- 20 migraciones goose down+up limpias (00016-00019 reversibles con y sin
  datos premium); `make db-security`, GoTrue healthy y seed aplicado.
- Colección Bruno completa tras reset desde cero: **118/118 requests,
  63/63 tests, 277/277 aserciones** en verde; una segunda corrida sobre los
  mismos datos vuelve a quedar en verde (repetible sin reset).
- Flujo Premium real (curl + Bruno): orden con cupón 10% (5000→4500), pago
  con comprobante, aprobación crea exactamente 1 período (`accesos_creados`
  =0: nada de audio), doble aprobación idempotente, `premium_activo=true` y
  la descarga con el id de la suscripción devuelve 404.
- Flujo paquete real: orden congela las 2 pistas (`include_future_tracks=
  false`); con SQL se agregó una 3.ª pista al producto entre la orden y la
  aprobación y la verificación SQL confirmó 0 entitlements sobre ella —
  solo se entregan las pistas del snapshot. Canje previo + compra: los
  accesos vigentes siguen siendo exactamente 2 (sin duplicar).
- Cupones (Bruno): fijo (500 BOB), porcentual (10%), inexistente → 404,
  vencido → 409, mínimo no alcanzado → 422, límite por usuario → 409,
  reutilizar la clave idempotente con otro cupón → 409.
- Canjes (Bruno): válido (suscripción o accesos con `grant_source=
  redemption`, sin pago), repetido → `ya_canjeado=true` sin consumir otro
  uso, vencido/agotado → 409, clave con otro código → 409 (flujo
  autocontenido con códigos frescos por corrida).
- Regresiones: MIME falso → 422; 5 MiB + 1 byte → 422; doble aprobación
  concurrente → un solo pago confirmado y sin accesos duplicados;
  colección 3A/3B completa en verde (permisos cruzados member/manager/
  editor incluidos).
- SQL verificado con la cuenta `triomision_api`: sin acceso a `auth`, sin
  crear roles/DB, sin borrar `audit_events`/`orders`/`entitlements`/
  `subscriptions`/`coupons`/`redemption_codes`/`redemptions`/
  `payment_attempts`, sin insertar `staff_roles`; sí lee y gestiona lo
  comercial.
- MinIO: la cuenta de servicio conserva solo la política del bucket; la
  operación administrativa (`mc admin user list`) fue denegada.
- Auditoría: `plan.creado/actualizado`, `cupon.creado`, `canje.creado/
  canjeado`, `pago.aprobado` y `acceso.concedido` registrados con actor y
  metadata; la API no puede borrarlos.
- `go build`, `go vet`, `gofmt`, `go test ./...` en verde; Swagger UI 200,
  spec 0.7.1 con 44 paths.

### Endurecimiento posterior a revisión (API 0.7.1)

- La aprobación interpreta `product_snapshot`/`content_snapshot` y concede la
  duración Premium congelada, sin depender de una edición posterior del plan.
  Reproducción real: editar 30→1 días antes de aprobar sigue extendiendo 30.
- Dos códigos distintos con la misma clave idempotente en paralelo devuelven
  200/409 (antes 200/500), sin consultar una transacción abortada.
- Las nuevas órdenes persisten `coupon_id`; la migración reversible 00020
  reparó el backfill histórico y su down+up dejó 0 referencias pendientes.
- Tras los cambios: build/vet/gofmt/tests en verde, Bruno 118/118 requests,
  63/63 tests y 277/277 aserciones, OpenAPI 0.7.1 con 44 paths y Swagger 200.

### Decisiones y hallazgos del Sprint 3C.1

- **Premium no es un entitlement**: se calcula desde períodos de
  `subscriptions` (`premium_activo` = existe período `active` con
  `period_end > now()`). Jamás crea entitlements de audio ni licencias.
- **Extensión de período**: al comprar/canjar de nuevo, la suscripción
  nueva empieza donde termina el vigente (`max(period_end vigente)`).
  Idempotencia por `order_item_id`/`redemption_id` únicos parciales.
- **`include_future_traces=false` congela el snapshot**: la aprobación
  entrega las pistas del `content_snapshot` (jsonb: `track_id` plano para
  pistas, arreglo `pistas` para paquetes). Con `true`, entrega el contenido
  publicado vigente del producto al aprobar.
- **Cupones jamás producen totales negativos**: descuento calculado en
  backend (entero, `subtotal*pct/100` o monto fijo); un cupón que dejaría
  el total en cero se rechaza con 422 y el check `total = subtotal -
  descuento` queda en base. El tipo/valor del descuento no se edita tras
  crear el cupón (las órdenes congelan lo calculado).
- **Idempotencia del canje por (código, usuario)**: repetir devuelve el
  canje original sin consumir otro uso; la clave de cliente tampoco se
  reutiliza con otro código. El contenido concedido se congela en
  `redemptions.content_snapshot`.
- **Bruno**: los ids no secretos se comparten con `bru.setEnvVar` (igual
  que la colección previa); un request sin bloque `auth:bearer` explícito
  hereda el Bearer de colección — siempre declarar el token.

## Fase 3 / Sprint 3B — API pura: contratos, autorización por artista y dispositivos: COMPLETADA ✅

**Cerrado el 2026-10-27.** Contratos estables y documentados para compradores,
staff, member/manager y dispositivos, con autorización backend y pruebas
reales completas. **No se construyó ni modificó UI** (`apps/web`,
`apps/admin`, APK, PC): esos clientes se integrarán después contra esta API
(guía en `docs/development/integracion-api.md`).

| Entregable | Ubicación | Estado |
|---|---|---|
| Migración 00015 (`devices`: instalación, plataforma, actividad, revocación; grants de `artist_members` a la API) | `database/migrations/` | Hecho |
| Middleware de membresía por artista (no miembro → 404, member que muta → 403) | `internal/authz/authz.go` | Hecho |
| Módulo `artists`: member lee (ChordPro incluido), manager administra sus artistas (álbumes, canciones, ficha, membresías) con auditoría | `internal/modules/artists/` | Hecho |
| Módulo `devices`: alta/upsert, lista propia, heartbeat, revocación propia; consulta/revocación staff con auditoría | `internal/modules/devices/` | Hecho |
| Estabilización: API 0.6.1, paginación `limite`/`desde` en himnario, descripciones de estados y convenciones | `internal/server/`, `internal/modules/himnario/` | Hecho |
| Seed: segundo artista (`coro-polifonico`) y canción premium en el álbum demo | `cmd/seed/` | Hecho |
| Bootstrap de membresías por SQL + asignación por API con auditoría | `scripts/grant-artist-role.sh`, `Makefile` (`db-artist-role`) | Hecho |
| Colección Bruno: 33 requests nuevos (67 total: 39 tests, 142 aserciones) | `bruno/` | Hecho |
| Guía de integración para clientes + matriz de permisos + tabla de endpoints | `docs/development/integracion-api.md` | Hecho |

### Verificación contra sistema real (2026-10-27, tras `make db-reset` desde cero)

- 15 migraciones goose down+up limpias; `make db-security`, GoTrue healthy y
  seed aplicado (incluye segundo artista y canción premium).
- Colección Bruno completa: **67/67 requests, 39/39 tests, 142/142
  aserciones** en verde. Flujos 3A y 3B repetidos contra el sistema vivo.
- Autorización por artista verificada: member lee ChordPro premium, member que
  muta → 403; no-miembro/artista ajeno → 404; manager administra solo su artista.
- Endurecimiento posterior a revisión: cada mutación de artista/álbum/canción/
  membresía y su auditoría comparten transacción y rollback; duplicado de
  membresía → 409; eliminar al último manager → 409.
- Dispositivos verificados: alta/upsert, aislamiento, heartbeat, revocación y
  staff. Un heartbeat revocado devuelve 409 y una comprobación SQL confirma que
  `last_seen_at` no cambia; re-registro de revocados → 409.
- SQL verificado: `triomision_api` sin acceso a `auth`, sin crear roles/DB,
  sin borrar auditoría ni insertar `staff_roles`; sí gestiona `artist_members`.
- Regresiones: MIME falso → 422; 5 MiB + 1 byte → 422; doble aprobación
  concurrente sin duplicar pago ni acceso.
- `go build`, `go vet`, `gofmt`, `go test ./...` en verde; Swagger UI 200,
  spec 0.6.1 con los 36 paths y paginación del himnario.

### Decisiones y hallazgos del Sprint 3B

- **Huma no aplana structs embebidos en inputs**: un `path:` dentro de un
  struct anidado llega vacío al handler (uuid "" en INSERT). Los parámetros
  de ruta se declaran de primer nivel; anotado en `services/api/README.md`.
- **Nombres de tipos de respuesta únicos entre módulos**: Huma registra
  esquemas por nombre de tipo (`cancionResumen` colisionó catalog/artists;
  renombrado a `cancionMia`).
- **LEFT JOIN con columnas NULL**: álbumes sin canciones publicadas exigen
  escanear las columnas de canción en punteros; `UPDATE … FROM albums`
  exige cualificar las columnas de `songs` (`title`/`sort_order` son
  ambiguas).
- **member lee ChordPro de canciones premium/purchase de sus artistas**: la
  membresía es la autorización, no el tipo de acceso del catálogo. Lecturas
  solo de contenido publicado; los borradores se administran por id (la
  visibilidad de borradores llegará con el panel en Fase 5).
- **Dispositivos revocados no se reactivan**: re-registrar el mismo
  `install_id` → 409; una reinstalación real genera install_id nuevo. El
  endpoint propio opera por `install_id`, el staff por UUID interno.

## Siguiente tarea — Sprint 3C.1: Premium, paquetes de audio, cupones y canjes

**Estado:** no iniciado. Base verificada: API 0.6.1, 15 migraciones, Bruno
67/67 y 142/142. **Solo API; no construir ni modificar UI.** La siguiente sesión
debe leer `AGENTS.md`, `docs/alcance/README.md`, `docs/payments/README.md` y
`docs/architecture/modelo-datos-v2.md` antes de diseñar las migraciones.

### Objetivo vertical

Un comprador puede adquirir Premium por tiempo limitado o un paquete de pistas,
pagar por QR/transferencia y recibir acceso tras aprobación staff. Otro usuario
puede canjear un código sin pagar. Premium no regala audio ni permisos de uso.

### 1. Modelo y migraciones nuevas (sin alterar las aplicadas)

- Planes Premium asociados a productos/ofertas: duración y beneficios JSON; la
  tabla `subscriptions` guarda periodos, origen y estado. No booleano permanente.
- Ampliar productos para `premium` además de pista/álbum/catálogo. Los paquetes
  usan todos sus `product_items` y congelan el contenido al crear la orden;
  definir explícitamente si un paquete incluye o no futuras incorporaciones.
- Cupones porcentuales/fijos con moneda, vigencia, límites total/por usuario y
  estado. Órdenes conservan subtotal, descuento, total y referencia al cupón;
  cálculo exclusivamente backend, nunca montos negativos.
- Códigos de canje y redenciones con vigencia/límites, idempotencia y auditoría.
  Conceden subscription o entitlements con `grant_source=redemption`, sin pago.
- Migraciones reversibles desde cero, grants mínimos para `triomision_api` y
  seed de: Premium 30 días, paquete con dos pistas, cupón y código de canje.

### 2. Contratos y lógica de negocio

- Endpoints públicos de ofertas/planes y autenticados para crear orden con cupón,
  consultar orden, canjear código y consultar compras/suscripciones/accesos.
- Endpoints staff mínimos para administrar planes, cupones y canjes con roles
  correctos y auditoría transaccional, reutilizando patrones de 3A/3B.
- Generalizar `crearOrden`: snapshots de todos los ítems, cupón validado y total
  calculado en la misma transacción; idempotencia valida oferta/cupón/payload.
- Generalizar aprobación: en una transacción y con locks, confirmar pago/orden y
  crear **solo uno** de estos efectos por ítem: período Premium o entitlements
  de cada pista/asset del snapshot. Repetir aprobación no duplica nada.
- `/mis-compras` añade suscripciones con `activa`, inicio/fin y `premium_activo`
  calculado por tiempo actual. Premium no crea entitlements de audio ni licencias.
- Canje también transaccional e idempotente; respetar vigencia, límites y revocación.

### 3. Pruebas obligatorias

- Premium aprobado crea un período, no una descarga; doble aprobación no duplica.
- Paquete concede exactamente las pistas del snapshot; si `include_future=false`,
  una pista añadida después no recibe acceso. Doble compra no duplica acceso vigente.
- Cupón fijo/porcentual, expirado, inexistente, límites por usuario/total y montos
  mínimos; nadie elige descuento desde el cliente.
- Canje válido, repetido, expirado y agotado; no crea pago ni duplica efectos.
- Autorización cruzada, auditoría, privilegios SQL/MinIO y regresiones 3A/3B.
- Build/tests/vet/gofmt, Bruno completo y reset desde cero con bootstrap/seed.
  OpenAPI/Swagger y guía de integración actualizados con ejemplos de cada flujo.

### 4. Documentación y salida

- Actualizar `docs/payments/README.md`, modelo de datos, guía de integración,
  `services/api/README.md`, `AGENTS.md` y este archivo con resultados reales.
- Bump de versión apropiado (cambio de contrato) y notas de migración para clientes.
- No implementar licencias adicionales (3C.2), servicios/soporte (3C.3), renovación
  automática, Binance/IAP, sync offline, FCM, worker ni interfaces gráficas.

**Criterio de salida:** compra Premium y paquete verificadas de extremo a extremo;
cupones/canjes idempotentes; acceso correcto sin duplicados ni mezcla Premium/audio;
todo documentado para que los futuros clientes consuman solo la API.

## Fase 3 / Sprint 3A — Flujo vertical de compra y descarga por API: COMPLETADA ✅

**Cerrado el 2026-10-27.** Un usuario se registra en GoTrue, compra la pista demo
con pago QR manual, un vendedor staff aprueba el comprobante y el usuario descarga
el master real desde MinIO con una URL firmada. Todo por API; el panel visual
sigue siendo Fase 5.

| Entregable | Ubicación | Estado |
|---|---|---|
| Migraciones 00007-00014 (negocio, integridad, perfiles con email y privilegios mínimos) | `database/migrations/` | Hecho |
| Autorización staff + auditoría append-only para la API y `rol.asignado` | `internal/authz/`, `internal/modules/staff/` | Hecho |
| Cuentas separadas para API/GoTrue/admin; API sin acceso a `auth` | `scripts/db-security.sh`, `00014` | Hecho |
| Módulos `store` y `staff` (Huma/OpenAPI) | `internal/modules/` | Hecho |
| MinIO con cuenta de servicio no administrativa y bucket privado salvo `public/` | `compose.yaml`, `infra/minio/init.sh` | Hecho |
| Comprobante multipart autenticado, máximo 5 MiB y MIME por contenido | `internal/modules/store/pagos.go` | Hecho |
| Seed: pista demo con master/preview subidos a MinIO + oferta 1500 BOB | `cmd/seed/seed_store.go` | Hecho |
| Colección Bruno: 24 requests del flujo 3A + negativos (34 total) | `bruno/` | Hecho |

### Verificación contra sistema real (2026-10-27, tras `make db-reset` desde cero)

- 14 migraciones goose down+up limpias; `make db-security`, GoTrue healthy y
  seed con la cuenta restringida. El backfill de email tolera que `auth.users`
  aún no exista durante un reset.
- SQL verificado: `triomision_api` no es superuser ni puede crear roles/DB; no
  tiene `USAGE` sobre `auth`, no borra pagos, no edita/borra auditoría y no
  inserta roles. `db-staff` registró `rol.asignado` correctamente.
- MinIO: la cuenta `triomision-api` tiene solo la política del bucket y la
  operación administrativa fue denegada. Root quedó separada para init/admin.
- Flujo completo: orden idempotente y atómica, comprobante multipart real,
  aprobación transaccional, entitlement, descarga, revocación y auditoría.
  La aprobación repetida no duplica pago ni acceso.
- Abuso de subida: archivo que no es imagen → 422; 5 MiB + 1 byte → 422.
- Colección Bruno: **34/34 requests, 18/18 tests, 77/77 aserciones** en verde.
  Tokens y URLs firmadas usan `bru.setVar`; `Local.bru` queda sin credenciales.
- `go build`, `go vet`, `gofmt`, `go test ./...` en verde; Swagger/OpenAPI 200
  con spec 0.5.0. Acceso ajeno a orden/comprobante/descarga sigue denegado.

### Decisiones y hallazgos del Sprint 3A

- **MinIO vía `bitnamilegacy/minio`**: empaquetado fijado con binario upstream.
- **Comprobantes por API, no POST directo a MinIO**: para archivos de máximo
  5 MiB simplifica clientes y permite límite, titularidad y detección MIME real
  en backend. Bruno usa un fixture multipart binario porque su runner no
  construye correctamente este formulario; curl verificó además el archivo real.
- **Perfiles con email**: la API dejó de consultar `auth.users`; staff lee
  `profiles`. Credenciales y sesiones permanecen solo en GoTrue.
- **`member`/`manager`**: member entra al panel pero solo lee contenido de sus
  artistas; manager administra únicamente sus artistas. Cliente PC y APK usan la
  misma API y cuenta; dispositivos quedan en Fase 4.
- Bruno CLI 4.3.0 persiste variables de entorno aunque estén declaradas
  secretas: tokens y URLs firmadas usan `bru.setVar`, no `bru.setEnvVar`.

## Siguiente tarea — Sprint 3C: alcance comercial restante (API pura)

**Estado:** no iniciado. Base verificada: API 0.6.1, 15 migraciones, Bruno
66/66 y 141/141. **Sin construir UI** (los clientes se integran después contra
`docs/development/integracion-api.md`).

**Objetivo:** completar el alcance comercial acordado en `docs/alcance/`:

1. **Planes Premium:** suscripción temporal con periodos, beneficios
   publicados y concesión/revocación auditada (el entitlement premium no
   concede paquetes de audio ni derechos de composición).
2. **Cupones y códigos de canje:** entitlements explícitos con origen,
   alcance y vencimiento (`grant_source=redemption`), idempotencia por canje.
3. **Audio por álbum/catálogo/pista y permisos adicionales por pista:**
   productos multi-ítem funcionales, usos concretos elegibles con precio y
   términos (`license_snapshot`), sin ofrecerlos en pistas no autorizadas.
4. **Servicios de composición/producción:** solicitud → cotización →
   aceptación/pago acordado → proyecto → entrega.
5. **Soporte:** tickets de pagos, descargas y reclamos (URL, claim ID,
   orden y licencia).
6. S3 para portadas y PDFs editoriales; Binance y otros proveedores después,
   sobre `payment_providers` ya previsto en `docs/payments/`.

**Criterio de salida:** los flujos comerciales restantes están implementados,
probados con el mismo rigor (build/tests, OpenAPI, Bruno, escenario real) y
documentados en la guía de integración, sin duplicar lógica de negocio en
clientes.

## Fase 0 — Documentación: COMPLETADA ✅

| Entregable | Ubicación | Estado |
|---|---|---|
| Alcance y requerimientos del sistema completo | `docs/alcance/README.md` | Hecho |
| Plan general de trabajo (fases, API primero) | `docs/planificacion/README.md` | Hecho |
| ADR 0002: stack de la API (chi + Huma + pgx + golang-jwt) | `docs/decisions/0002-api-go-chi-huma.md` | Hecho |

## Fase 1 — API en Go: Fundamentos: COMPLETADA ✅

| Entregable | Estado |
|---|---|
| Esqueleto Go (main, config, database, auth, server, health, me) | Hecho |
| Build + vet + tests en verde | Hecho |
| Makefile: `api-run`, `api-build`, `api-test`, `api-token` | Hecho |
| Colección Bruno en `bruno/` (3 requests, verificada con @usebruno/cli) | Hecho |
| Script `scripts/mint-dev-token.sh` (JWT de desarrollo) | Hecho |
| `.env.example` con `API_ENV` y `GOTRUE_JWT_AUDIENCE` | Hecho |
| `services/api/README.md` con instrucciones y convenciones | Hecho |

### Verificación contra sistema real (2026-10-26)

- PostgreSQL 16 verificado inicialmente con instalación nativa (entorno histórico; ver estado actual de Docker abajo)
- `GET /api/v1/health` → 200 `{status: ok, version: 0.1.0}`
- `GET /api/v1/ready` → 200 con DB arriba; **503 `{database: down}` con DB detenida**; 200 al restaurar
- `GET /api/v1/me` → 401 sin token; **200 con JWT HS256 real** firmado con `GOTRUE_JWT_SECRET`
- Swagger UI → 200 en `/docs`; spec válido en `/openapi.json`
- Shutdown por SIGTERM limpio ("apagando la API...")

### Nota sobre Docker

La verificación del 2026-10-26 se hizo con PostgreSQL nativo. Actualmente Docker
está instalado y `make up` levanta PostgreSQL 16 correctamente. La API se ejecuta
por separado con `make api-run`, que carga el `.env` de la raíz.

Verificación 2026-10-27: PostgreSQL healthy en Docker y `GET /api/v1/health`
responde 200 con versión 0.2.0.

## Fase 2 — API: modelo de datos y base de negocio: COMPLETADA ✅

- [x] Alcance funcional acordado y modelo consolidado con diagrama ER → `docs/architecture/modelo-datos-v2.md`
- [x] Correcciones de revisión incorporadas: himnos versionados, acceso editorial, roles múltiples, permisos por pista y referencias con integridad
- [x] `devices` fuera de `profiles`: corresponde a sync/descargas (Fase 4); docs actualizados
- [x] Migraciones iniciales con goose en `database/migrations/` (identidad, catálogo, himnario) — verificado con `db-reset` desde cero
- [x] Seed de desarrollo con contenido de `content/himnario/` (`cmd/seed`, idempotente: 614 himnos × 2 versiones + catálogo mínimo)
- [x] Módulos `himnario` y `catalog` (solo lectura) + requests Bruno
- [x] GoTrue en `compose.yaml` (supabase/gotrue:v2.197.0, healthcheck, esquema `auth`)
- [x] Migraciones de soporte a GoTrue: `00004` esquema auth, `00005` rol `postgres`, `00006` search_path con `auth`
- [x] Login real de extremo a extremo: signup → password grant → `/api/v1/me`
- [x] `/api/v1/me` asegura el perfil: crea la fila en `profiles` en el primer
      request (id = sub del JWT; display_name inicial = parte local del correo)
- [x] Colección Bruno: 10 requests (incluye `GoTrue - signup`, `GoTrue - login`,
      `Me con token GoTrue`) con flujo real y repetible

### Verificación contra sistema real (2026-10-27)

- `make db-reset` desde cero + `docker compose restart gotrue`: 6 migraciones
  goose down+up; GoTrue re-migra su esquema y queda healthy; seed re-aplicado
- `POST :9999/signup` → 200 con sesión (autoconfirm, sin SMTP);
  re-signup → 422 `user_already_exists`
- `POST :9999/token?grant_type=password` → JWT HS256 real
  (`aud=authenticated`, `exp=3600`) verificado por decodificación
- `GET /api/v1/me` con token real → 200 con UUID de auth.users y
  `display_name=dev`; 401 sin token y con token inválido; la fila existe en
  `profiles`; segunda llamada devuelve el perfil sin duplicarlo
- Colección Bruno: 10/10 requests, 24/24 aserciones, 2/2 tests en verde,
  también inmediatamente después de un reset de base
- `go build`, `go vet`, `gofmt`, `go test ./...` en verde; Swagger UI 200,
  spec `0.3.0` con `display_name` en el contrato de `/me`

### Hallazgo operativo importante

Había un PostgreSQL nativo (brew) corriendo en `127.0.0.1:5432` y capturaba
`localhost:5432`: las migraciones/seed/API de la sesión anterior cayeron en
esa base, no en el contenedor. Se detuvo (`brew services stop postgresql@16`,
reversible) y ahora el 5432 local es el contenedor. Ver nota en
`docs/development/README.md`: mantener el nativo detenido mientras se usa Docker.

### Después del Sprint 3A

- **3B — API pura para clientes, staff, artistas y dispositivos:** ✅
  completado 2026-10-27 (ver sección superior). El portal web y el resto de
  UI se construirán en Fase 5 contra la guía de integración.
- **3C — Alcance comercial restante:** Premium, cupones/canjes, permisos adicionales
  por pista, servicios y soporte. Worker, sync offline y FCM quedan en Fase 4.

**Criterio de salida de Fase 3:** un usuario puede registrarse, pagar con QR
manual, ser aprobado por staff y descargar una pista comprada; el portal web
funciona con la misma cuenta que usará la app.

## Decisiones tomadas (2026-10-26)

- Router: **chi** · OpenAPI: **Huma** · DB: **pgx/v5** · JWT: **golang-jwt/v5** (ver ADR 0002)
- Primer sprint: **solo fundamentos** (sin módulos de negocio todavía)
- **Graphify**: pospuesto hasta que haya suficiente código para que aporte valor
- **mcp-go**: NO aplica para la API REST; opción futura para exponer tools MCP a agentes
- Docker: compose solo para infraestructura; la API corre nativa con `go run` en desarrollo

## Decisiones tomadas (2026-10-27, cierre de Fase 2)

- **GoTrue fijado a `supabase/gotrue:v2.197.0`** (última estable a la fecha). Sus
  particularidades quedan documentadas en `infra/gotrue/README.md`.
- **`API_EXTERNAL_URL` sin prefijo** `GOTRUE_`: la v2.197+ la exige así; el resto
  de claves conservan el prefijo.
- **Sin SMTP en desarrollo**: `GOTRUE_MAILER_AUTOCONFIRM=true`; la confirmación
  real de correo y el SMTP se deciden para producción (Fase 5).
- **Perfil creado de forma perezosa por la API** en el primer request
  autenticado a `/me` (INSERT ... ON CONFLICT DO NOTHING), no por trigger en
  `auth.users`: evita el problema de ordenamiento entre migraciones goose y el
  esquema de GoTrue, y es testeable. Las credenciales jamás salen de GoTrue.
- **`/me` ahora devuelve `display_name`** → contrato ampliado, API en 0.3.0.
- **Un solo PostgreSQL lógico**: se detuvo el PostgreSQL nativo de brew (la
  base real del proyecto vive en el contenedor Docker desde esta sesión).
- **`db-reset` deja la base en cero real** para GoTrue: el down de `00004`
  también elimina `public.schema_migrations` (registro de migraciones de
  GoTrue); sin eso GoTrue no re-migraba tras un reset. Tras un reset siempre:
  `docker compose restart gotrue`.
