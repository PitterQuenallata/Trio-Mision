// Prueba de carga de lecturas de la API (k6).
//
// Uso (con la API y la infraestructura arriba):
//   k6 run loadtest/lectura.js
// Variables opcionales:
//   BASE_URL   (por defecto http://127.0.0.1:8080)
//   GOTRUE_URL (por defecto http://127.0.0.1:9999)
//   VUS        (usuarios virtuales en meseta, por defecto 50)
//   THINK      (pausa en s entre peticiones por VU; 0 = carga máxima)
//   EMAIL / PASSWORD  usuario GoTrue para endpoints autenticados
//                     (por defecto el usuario de desarrollo)
//
// Nota: el límite de tasa por IP (API_RATE_LIMIT_RPS/BURST) aplica a todos los
// VUs porque salen de la misma IP. Para medir capacidad real, arranca la API
// con un límite alto (p. ej. API_RATE_LIMIT_RPS=100000 API_RATE_LIMIT_BURST=100000)
// y para medir el comportamiento con límite, usa el valor por defecto.

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Counter } from 'k6/metrics';

const BASE = __ENV.BASE_URL || 'http://127.0.0.1:8080';
const GOTRUE = __ENV.GOTRUE_URL || 'http://127.0.0.1:9999';
const VUS = parseInt(__ENV.VUS || '50', 10);
// Pausa entre peticiones de cada VU (s). 0 = carga máxima; por defecto simula un cliente.
const THINK = parseFloat(__ENV.THINK || '0.2');
const EMAIL = __ENV.EMAIL || 'dev@triomision.local';
const PASSWORD = __ENV.PASSWORD || 'DevPass123!';

const rejected429 = new Counter('respuestas_429');
const serverErrors = new Rate('errores_5xx');

export const options = {
  scenarios: {
    lectura_publica: {
      executor: 'ramping-vus',
      exec: 'publica',
      startVUs: 0,
      stages: [
        { duration: '30s', target: VUS },
        { duration: '1m', target: VUS },
        { duration: '15s', target: 0 },
      ],
      gracefulRampDown: '5s',
    },
    lectura_autenticada: {
      executor: 'ramping-vus',
      exec: 'autenticada',
      startVUs: 0,
      stages: [
        { duration: '30s', target: Math.max(1, Math.floor(VUS / 5)) },
        { duration: '1m', target: Math.max(1, Math.floor(VUS / 5)) },
        { duration: '15s', target: 0 },
      ],
      gracefulRampDown: '5s',
    },
  },
  thresholds: {
    // Metas de referencia para una instancia de desarrollo; ajustar tras medir.
    'http_req_duration{grupo:publica}': ['p(95)<300'],
    'http_req_duration{grupo:autenticada}': ['p(95)<500'],
    errores_5xx: ['rate<0.01'],
    // http_req_failed no se usa: cuenta los 429 (límite de tasa) como fallo.
    // El fallo real del servidor es errores_5xx.
  },
};

export function setup() {
  const res = http.post(
    `${GOTRUE}/token?grant_type=password`,
    JSON.stringify({ email: EMAIL, password: PASSWORD }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  check(res, { 'login GoTrue 200': (r) => r.status === 200 });
  return { token: res.status === 200 ? res.json('access_token') : '' };
}

function track(res) {
  if (res.status === 429) rejected429.add(1);
  serverErrors.add(res.status >= 500);
}

export function publica() {
  group('publica', () => {
    const pubs = [
      `${BASE}/api/v1/catalogo/artistas`,
      `${BASE}/api/v1/himnario/himnos?limite=20`,
      `${BASE}/api/v1/himnario/himnos/${1 + Math.floor(Math.random() * 50)}`,
      `${BASE}/api/v1/tienda/ofertas`,
      `${BASE}/api/v1/tienda/planes`,
    ];
    const url = pubs[Math.floor(Math.random() * pubs.length)];
    const res = http.get(url, { tags: { grupo: 'publica', endpoint: url.replace(BASE, '') } });
    track(res);
    check(res, { 'publica 200 o 429': (r) => r.status === 200 || r.status === 429 });
  });
  if (THINK > 0) sleep(THINK);
}

export function autenticada(data) {
  group('autenticada', () => {
    const params = {
      headers: { Authorization: `Bearer ${data.token}` },
      tags: { grupo: 'autenticada' },
    };
    const endpoints = ['/api/v1/me', '/api/v1/mis-compras', '/api/v1/dispositivos'];
    const res = http.get(`${BASE}${endpoints[Math.floor(Math.random() * endpoints.length)]}`, params);
    track(res);
    check(res, { 'autenticada 200 o 429': (r) => r.status === 200 || r.status === 429 });
  });
  if (THINK > 0) sleep(THINK * 2);
}
