# Resultados de carga — API 0.12.0 (2026-11-08)

Máquina de desarrollo (macOS, Apple Silicon), con k6, la API, PostgreSQL y
GoTrue en el mismo equipo. Son referencia de la máquina, no de producción.

Mezcla: 80 % lecturas públicas (catálogo, himnario, tienda) y 20 % lecturas
autenticadas (`/me`, `/mis-compras`, `/dispositivos`).

| Escenario | Peticiones | Throughput | p95 | 5xx |
|---|---|---|---|---|
| 50 VUs con pausa de 0,2 s (límite subido) | 21 592 | ~204 req/s | 17 ms | 0 |
| 100 VUs sin pausa (límite subido, saturación) | 353 489 | ~3 363 req/s | 51 ms | 0 |
| 50 VUs sin pausa, límite por defecto 20 rps/IP | 5 694 835 | — (99,96 % 429) | 2 ms (los 429) | 0 |

Conclusiones:
- La API no produjo errores 5xx en ninguna corrida.
- Sin límite, la API sostiene miles de req/s en lecturas sobre datos de seed.
- Con el límite por defecto, los excedentes se rechazan en ~2 ms y no tumban el servicio.
- Las lecturas pesadas (sync completo del catálogo, listados grandes) no están en
  esta mezcla. Hay que medirlas antes de producción.
