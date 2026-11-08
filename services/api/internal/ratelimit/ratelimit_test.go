package ratelimit

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func limiterWithClock(cfg Config) (*Limiter, *time.Time) {
	clock := time.Date(2026, 11, 8, 12, 0, 0, 0, time.UTC)
	l := New(cfg)
	l.now = func() time.Time { return clock }
	return l, &clock
}

func TestBurstThenRejectThenRefill(t *testing.T) {
	l, clock := limiterWithClock(Config{RPS: 2, Burst: 3})

	for i := 0; i < 3; i++ {
		if ok, _ := l.Allow("ip"); !ok {
			t.Fatalf("la ráfaga de 3 debe permitirse (petición %d)", i+1)
		}
	}
	ok, wait := l.Allow("ip")
	if ok {
		t.Fatal("la 4ª petición sin tiempo de recarga debe rechazarse")
	}
	if wait <= 0 || wait > time.Second {
		t.Fatalf("espera esperada en (0, 1s] con 2 rps, obtenida %v", wait)
	}

	*clock = clock.Add(500 * time.Millisecond) // 1 token a 2 rps
	if ok, _ := l.Allow("ip"); !ok {
		t.Fatal("tras 500 ms debe haber un token nuevo")
	}
}

func TestClientsAreIndependent(t *testing.T) {
	l, _ := limiterWithClock(Config{RPS: 1, Burst: 1})
	if ok, _ := l.Allow("a"); !ok {
		t.Fatal("cliente a: primera petición")
	}
	if ok, _ := l.Allow("a"); ok {
		t.Fatal("cliente a: segunda petición debe rechazarse")
	}
	if ok, _ := l.Allow("b"); !ok {
		t.Fatal("cliente b no debe verse afectado por a")
	}
}

func TestMiddlewareReturns429WithRetryAfter(t *testing.T) {
	strict, _ := limiterWithClock(Config{RPS: 1, Burst: 1})
	ceiling, _ := limiterWithClock(Config{RPS: 100, Burst: 100})
	h := Middleware(strict, ceiling,
		func(*http.Request) (string, string) { return "", "1.2.3.4" },
		func(r *http.Request) bool { return r.URL.Path == "/api/v1/health" },
	)(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusOK) }))

	do := func(path string) *httptest.ResponseRecorder {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path, nil))
		return rec
	}

	if rec := do("/api/v1/me"); rec.Code != http.StatusOK {
		t.Fatalf("primera petición: %d", rec.Code)
	}
	rec := do("/api/v1/me")
	if rec.Code != http.StatusTooManyRequests {
		t.Fatalf("segunda petición debe ser 429, fue %d", rec.Code)
	}
	if rec.Header().Get("Retry-After") == "" {
		t.Fatal("el 429 debe incluir Retry-After")
	}
	if ct := rec.Header().Get("Content-Type"); ct != "application/problem+json" {
		t.Fatalf("content-type del 429: %q", ct)
	}
	if rec := do("/api/v1/health"); rec.Code != http.StatusOK {
		t.Fatalf("health debe quedar exento, fue %d", rec.Code)
	}
}

// Dos usuarios detrás de la misma IP tienen cupos independientes.
func TestUsuariosEnMismaIPTienenCupoPropio(t *testing.T) {
	strict, _ := limiterWithClock(Config{RPS: 1, Burst: 1})
	ceiling, _ := limiterWithClock(Config{RPS: 100, Burst: 100})
	sub := ""
	h := Middleware(strict, ceiling,
		func(*http.Request) (string, string) { return sub, "10.0.0.7" },
		nil,
	)(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusOK) }))

	call := func(u string) int {
		sub = u
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/x", nil))
		return rec.Code
	}
	if call("ana") != http.StatusOK {
		t.Fatal("ana: primera petición")
	}
	if call("ana") != http.StatusTooManyRequests {
		t.Fatal("ana: segunda petición debe limitarse")
	}
	if call("luis") != http.StatusOK {
		t.Fatal("luis comparte IP con ana pero no debe heredar su límite")
	}
}

// El techo por IP frena a una IP que cambia de cuenta sin parar.
func TestTechoPorIPFrenaCuentasRotadas(t *testing.T) {
	strict, _ := limiterWithClock(Config{RPS: 100, Burst: 100})
	ceiling, _ := limiterWithClock(Config{RPS: 1, Burst: 2})
	n := 0
	h := Middleware(strict, ceiling,
		func(*http.Request) (string, string) { n++; return "u" + string(rune('a'+n)), "9.9.9.9" },
		nil,
	)(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusOK) }))

	codes := []int{}
	for i := 0; i < 4; i++ {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/x", nil))
		codes = append(codes, rec.Code)
	}
	if codes[0] != 200 || codes[1] != 200 || codes[2] != 429 {
		t.Fatalf("el techo por IP debe agotarse tras la ráfaga: %v", codes)
	}
}
