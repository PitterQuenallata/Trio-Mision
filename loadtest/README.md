# Pruebas de carga

Escenario de lecturas (`lectura.js`, k6). Requiere la API y la infraestructura arriba.

```bash
brew install k6
k6 run loadtest/lectura.js                       # límite por defecto (20 rps/IP)
API_RATE_LIMIT_RPS=100000 API_RATE_LIMIT_BURST=100000 make api-run   # medir capacidad
k6 run -e VUS=100 -e THINK=0 loadtest/lectura.js   # saturación
```

Variables: `VUS` (usuarios virtuales), `THINK` (pausa en s entre peticiones; 0 = máxima carga), `BASE_URL`, `GOTRUE_URL`, `EMAIL`, `PASSWORD`.

Todos los VUs salen de la misma IP: con el límite por defecto la prueba mide el
límite, no la capacidad. Para capacidad, sube el límite como arriba.
