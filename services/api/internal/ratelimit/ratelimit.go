// Package ratelimit limita la tasa de peticiones por cliente (IP real) con un
// token bucket en memoria. Protege la API frente a abuso y fuerza bruta sobre
// endpoints públicos o de escritura (alcance: "rate limiting").
//
// Límite por instancia: con varias réplicas detrás de un balanceador habría
// que moverlo a un almacén compartido. En el despliegue de un solo VPS basta.
package ratelimit

import (
	"encoding/json"
	"math"
	"net/http"
	"strconv"
	"sync"
	"time"
)

// Config define la tasa sostenida (peticiones por segundo) y la ráfaga máxima.
type Config struct {
	RPS   float64
	Burst int
}

// Limiter es un conjunto de token buckets indexados por cliente.
type Limiter struct {
	cfg   Config
	now   func() time.Time
	mu    sync.Mutex
	items map[string]*bucket
	calls int
}

type bucket struct {
	tokens float64
	last   time.Time
}

const (
	sweepEvery   = 1024             // cada cuántas llamadas se purgan buckets inactivos
	idleEviction = 10 * time.Minute // un bucket sin uso este tiempo se descarta
)

// New crea un limitador. RPS y Burst deben ser > 0.
func New(cfg Config) *Limiter {
	return &Limiter{cfg: cfg, now: time.Now, items: map[string]*bucket{}}
}

// Allow consume un token para key. Si no hay tokens, devuelve false y el
// tiempo a esperar hasta el siguiente token.
func (l *Limiter) Allow(key string) (bool, time.Duration) {
	l.mu.Lock()
	defer l.mu.Unlock()

	now := l.now()
	l.calls++
	if l.calls%sweepEvery == 0 {
		l.sweep(now)
	}

	b, ok := l.items[key]
	if !ok {
		b = &bucket{tokens: float64(l.cfg.Burst), last: now}
		l.items[key] = b
	}
	elapsed := now.Sub(b.last).Seconds()
	b.tokens = math.Min(float64(l.cfg.Burst), b.tokens+elapsed*l.cfg.RPS)
	b.last = now

	if b.tokens >= 1 {
		b.tokens--
		return true, 0
	}
	wait := time.Duration((1 - b.tokens) / l.cfg.RPS * float64(time.Second))
	return false, wait
}

func (l *Limiter) sweep(now time.Time) {
	for k, b := range l.items {
		if now.Sub(b.last) > idleEviction {
			delete(l.items, k)
		}
	}
}

// Middleware aplica el límite por IP. Responde 429 en formato problem+json con
// Retry-After (segundos, redondeado hacia arriba). Las sondas de salud quedan
// fuera para que el monitoreo no provoque falsos bloqueos.
func Middleware(l *Limiter, clientKey func(*http.Request) string, exempt func(*http.Request) bool) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if exempt != nil && exempt(r) {
				next.ServeHTTP(w, r)
				return
			}
			ok, wait := l.Allow(clientKey(r))
			if ok {
				next.ServeHTTP(w, r)
				return
			}
			secs := int(math.Ceil(wait.Seconds()))
			if secs < 1 {
				secs = 1
			}
			w.Header().Set("Retry-After", strconv.Itoa(secs))
			w.Header().Set("Content-Type", "application/problem+json")
			w.WriteHeader(http.StatusTooManyRequests)
			_ = json.NewEncoder(w).Encode(map[string]any{
				"title":  "Too Many Requests",
				"status": http.StatusTooManyRequests,
				"detail": "demasiadas peticiones; reintenta en unos segundos",
			})
		})
	}
}
