# Revisión de seguridad y carga — API 0.12.0 (2026-11-08)

Alcance: endurecimiento previo al despliegue (Fase 5). Se revisó la API tal
como corre en desarrollo. No cubre clientes, despliegue ni infraestructura de
producción.

## Hallazgos y correcciones

| # | Hallazgo | Riesgo | Corrección |
|---|---|---|---|
| 1 | Los 500 incluían el texto del error interno (`errors[].message`): 469 llamadas en 23 módulos pasaban el error de la base a Huma. | Alto: exponía tablas, restricciones y SQL al cliente. | `internal/apierr.Internal` registra el error completo en el log del servidor y responde solo el mensaje genérico. Prueba que verifica que el detalle no aparece en la respuesta. |
| 2 | No había límite de tasa. | Medio: abuso y fuerza bruta. | Token bucket por IP (`internal/ratelimit`), 429 con `Retry-After`. Ver CURRENT_TASK. |

## Verificado sin cambios

- **Autorización de staff:** las 39 combinaciones método×ruta de `/api/v1/staff/*`
  responden 401 sin token y 403 con token de un member.
- **JWT:** solo se aceptan firmas HMAC; no hay ruta para `alg: none` ni para
  cambio de algoritmo.
- **SQL:** no hay consultas armadas por concatenación o `Sprintf`; se usan
  parámetros.
- **Logs:** no registran tokens ni contraseñas. Los identificadores que se
  registran son IDs internos y claves de objetos del seed de desarrollo.
- **Rutas públicas:** solo catálogo, himnario, ofertas, planes y sondas de salud.

## Pendientes (antes de producción)

- Límite de tasa por IP: en redes compartidas (oficina, colegio, datos móviles
  con NAT) todos los usuarios comparten el mismo cupo. Valorar limitar por
  usuario autenticado y subir el valor por defecto.
- `X-Forwarded-For`: solo confiar en la cabecera cuando la petición llega del
  proxy HTTPS del VPS.
- Revisar cabeceras de seguridad y CORS cuando existan los clientes web.

Verificación: Bruno 288/288 requests, 136/136 tests, 604/604 aserciones tras los
cambios; `go test ./...` en verde.
