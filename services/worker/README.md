# Worker — Trio Misión

Procesos en segundo plano del ecosistema. Sprint 4B: conversión editorial
PDF→ChordPro con cola de trabajos sobre PostgreSQL.

## Prerequisitos

- **poppler** (binario `pdftotext` en el PATH): `brew install poppler`. El
  worker arranca con un error claro si falta. La extracción usa
  `pdftotext -bbox` (texto posicionado x/y, requisito de la alineación
  acorde-sobre-letra).
- El mismo `.env` de la raíz que la API (`make worker-run` lo carga):
  `API_DATABASE_URL` (o `WORKER_DATABASE_URL`), `S3_ENDPOINT`, `S3_BUCKET`,
  `S3_ACCESS_KEY`, `S3_SECRET_KEY`.
- Infraestructura arriba (`make up`): PostgreSQL y MinIO.

## Uso

```bash
make worker-run                          # polling cada WORKER_POLL_INTERVAL (5s)
(cd services/worker && go run ./cmd/worker --once)    # procesa y sale (verificación)
(cd services/worker && go run ./cmd/worker --sleep 1s)
```

Flags: `--once` (procesa todos los jobs pendientes y sale; con cola vacía
sale limpio por el mismo camino) y `--sleep` (sobreescribe el intervalo de
polling). El apagado por SIGTERM/SIGINT cancela el contexto y termina limpio.

## Cuenta PostgreSQL

El worker comparte la cuenta `api_app` con la API (decisión del Sprint 4B):
los grants mínimos de `media_jobs` (SELECT/INSERT/UPDATE) y
`media_job_assets`/`media_assets` (SELECT) ya cubren todo lo que el worker
necesita, y no se añade superficie operativa (una cuenta menos que rotar,
misma política de privilegios mínimos; `scripts/db-security.sh` sigue siendo
la única fuente de cuentas). Para separarla en el futuro basta definir
`WORKER_DATABASE_URL` y crear la cuenta.

## Cola y ciclo de vida del job

La cola es la tabla `media_jobs` (sin infraestructura nueva). El claiming es
atómico con `FOR UPDATE SKIP LOCKED`: dos workers nunca toman el mismo job.

```
queued → running (started_at) → done   (progress=100, result_json, completed_at)
                             ↘ failed  (error_code estable, completed_at)
```

- El worker descarga el PDF del `media_assets` de entrada (privado en MinIO,
  prefijo `imports/`) a un archivo temporal, corre `pdftotext -bbox`, parsea
  las palabras posicionadas y las convierte con el port fiel del algoritmo
  legacy (`internal/convert`, especificación:
  `legacy/panelweb-triomision-lyrics/src/lib/pdfToCho.ts`). 100% determinista:
  sin azar, sin OCR ni IA.
- `result_json`: `{tool_version, total_canciones, canciones[] (indice, titulo,
  numero, tono, capo, autor, chordpro, status ok|revisar, issues[]),
  publicados[]}`. `tool_version` identifica la versión del conversor
  (constante `job.ToolVersion`).
- Códigos de error estables (`error_code`): `pdf_invalido` (pdftotext falla),
  `sin_texto_extraible` (PDF escaneado sin capa de texto; OCR fuera de
  alcance), `entrada_faltante`, `error_interno`. Un job fallido se reencola
  con `POST /api/v1/staff/importaciones/{id}/reintentar` (solo la API; el
  worker jamás publica en el catálogo).
- **Job running huérfano** (worker muerto a mitad): por ahora se reseta a mano
  con SQL (`update media_jobs set status='queued', started_at=null where
  id=... and status='running'`); la API solo reintenta jobs `failed`.

## Adaptación del extractor (pdftotext vs pdf.js)

El algoritmo legacy se afinó con pdf.js, cuyo `item.height` ES el tamaño de
fuente y cuyo `y` es la línea base con origen abajo-izquierda. poppler
`-bbox` da cajas a nivel de fuente (alto = 0.925·tamaño exactamente) y eje Y
con origen arriba-izquierda, así que el extractor (`internal/extract`)
convierte `H = alto/0.925` (tamaño de fuente real) y niega `Y`. Las razones
que usa el clasificador (0.78/0.95/1.3) quedan entonces idénticas a las de la
especificación; para fuentes con ascent/descent distintos, el cuerpo modal se
calcula por página y las razones se preservan.

## Herramienta de desarrollo: pdfdemo

`cmd/pdfdemo` genera un PDF editorial de demostración con texto posicionado
(acordes sobre letra, notación latina) a partir de los primeros N `.cho` del
himnario — 100% determinista, stdlib puro (métricas AFM de Helvetica). Es la
fuente del fixture del E2E (`scripts/gen-import-fixtures.sh`). El PDF real
`content/himnario/source/…pdf` es un escaneo sin capa de texto: el pipeline
lo rechaza con `sin_texto_extraible` por diseño (sin OCR).

```bash
(cd services/worker && go run ./cmd/pdfdemo -dir ../../content/himnario/acordes-completos -n 10 -out demo.pdf)
(cd services/worker && go run ./cmd/pdfdemo -kind vacio -out vacio.pdf)  # PDF válido sin texto
```

## Verificación

`go build ./...`, `go vet ./...`, `gofmt -l .` y `go test ./...` limpios.
Los tests del conversor (`internal/convert`) cubren la conversión
latina→anglosajona, el clustering de renglones, la fusión acorde-letra, la
detección de estructura y el determinismo; los del extractor
(`internal/extract`) cubren el parser bbox, el rechazo de PDF sin texto y el
E2E completo sobre el PDF demo (extracción + conversión con canciones y
ChordPro no vacío).
