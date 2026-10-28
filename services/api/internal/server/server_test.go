package server

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"triomision/api/internal/auth"
	"triomision/api/internal/config"
	"triomision/api/internal/database"
	"triomision/api/internal/storage"
)

const testSecret = "secreto-de-prueba"

type fakeRow struct {
	displayName string
	authorized  bool
	err         error
}

func (r fakeRow) Scan(dest ...any) error {
	if r.err != nil {
		return r.err
	}
	for _, d := range dest {
		switch p := d.(type) {
		case *string:
			*p = r.displayName
		case **string:
			s := r.displayName
			*p = &s
		case *bool:
			*p = r.authorized
		}
	}
	return nil
}

type fakeDB struct {
	err   error
	rows  []fakeRow
	calls int
}

func (f *fakeDB) Ping(context.Context) error { return f.err }

func (f *fakeDB) Query(context.Context, string, ...any) (pgx.Rows, error) {
	return nil, f.err
}

func (f *fakeDB) QueryRow(_ context.Context, _ string, _ ...any) pgx.Row {
	if f.calls >= len(f.rows) {
		return fakeRow{err: errors.New("fakeDB: QueryRow sin filas programadas")}
	}
	row := f.rows[f.calls]
	f.calls++
	return row
}

func (f *fakeDB) Exec(context.Context, string, ...any) (pgconn.CommandTag, error) {
	return pgconn.CommandTag{}, f.err
}

func (f *fakeDB) Begin(context.Context) (pgx.Tx, error) {
	return nil, errors.New("fakeDB: sin transacciones")
}

// fakeStorage satisface storage.Client sin tocar la red.
type fakeStorage struct{}

func (fakeStorage) PresignGet(context.Context, string, time.Duration) (string, error) {
	return "https://example.test/signed", nil
}
func (fakeStorage) PresignPost(context.Context, string, string, int64, time.Duration) (storage.PostUpload, error) {
	return storage.PostUpload{URL: "https://example.test/upload", Fields: map[string]string{"key": "evidence/test"}}, nil
}
func (fakeStorage) PublicURL(key string) string { return "https://cdn.example.test/" + key }
func (fakeStorage) Head(context.Context, string) (int64, string, error) {
	return 10, "image/png", nil
}
func (fakeStorage) PutObject(context.Context, string, string, io.Reader) error { return nil }

func newTestServer(t *testing.T, db database.DB) *httptest.Server {
	t.Helper()
	handler := New(config.Config{}, db, auth.NewValidator(testSecret, "authenticated"), fakeStorage{})
	srv := httptest.NewServer(handler)
	t.Cleanup(srv.Close)
	return srv
}

func bearerToken(t *testing.T) string {
	t.Helper()
	claims := auth.Claims{
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   "c0765b83-bb44-4ea8-8420-340b8ded7eaf",
			Audience:  jwt.ClaimStrings{"authenticated"},
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
		},
		Role:  "authenticated",
		Email: "user@example.com",
	}
	signed, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(testSecret))
	if err != nil {
		t.Fatalf("firmar token: %v", err)
	}
	return signed
}

func TestHealth(t *testing.T) {
	srv := newTestServer(t, &fakeDB{})
	resp, err := http.Get(srv.URL + "/api/v1/health")
	if err != nil {
		t.Fatalf("GET /health: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, se esperaba 200", resp.StatusCode)
	}
	var body struct {
		Status  string `json:"status"`
		Version string `json:"version"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("decodificar body: %v", err)
	}
	if body.Status != "ok" || body.Version != Version {
		t.Errorf("body inesperado: %+v", body)
	}
}

func TestReady(t *testing.T) {
	t.Run("base de datos arriba", func(t *testing.T) {
		srv := newTestServer(t, &fakeDB{})
		resp, err := http.Get(srv.URL + "/api/v1/ready")
		if err != nil {
			t.Fatalf("GET /ready: %v", err)
		}
		defer resp.Body.Close()
		if resp.StatusCode != http.StatusOK {
			t.Errorf("status = %d, se esperaba 200", resp.StatusCode)
		}
	})

	t.Run("base de datos caída devuelve 503", func(t *testing.T) {
		srv := newTestServer(t, &fakeDB{err: errors.New("sin conexión")})
		resp, err := http.Get(srv.URL + "/api/v1/ready")
		if err != nil {
			t.Fatalf("GET /ready: %v", err)
		}
		defer resp.Body.Close()
		if resp.StatusCode != http.StatusServiceUnavailable {
			t.Errorf("status = %d, se esperaba 503", resp.StatusCode)
		}
	})
}

func TestMe(t *testing.T) {
	newMeServer := func(t *testing.T, rows ...fakeRow) *httptest.Server {
		t.Helper()
		return newTestServer(t, &fakeDB{rows: rows})
	}

	t.Run("sin token devuelve 401", func(t *testing.T) {
		srv := newMeServer(t)
		resp, err := http.Get(srv.URL + "/api/v1/me")
		if err != nil {
			t.Fatalf("GET /me: %v", err)
		}
		defer resp.Body.Close()
		if resp.StatusCode != http.StatusUnauthorized {
			t.Errorf("status = %d, se esperaba 401", resp.StatusCode)
		}
	})

	t.Run("primer login crea el perfil y devuelve la identidad", func(t *testing.T) {
		// INSERT ... ON CONFLICT DO NOTHING no retorna fila (perfil nuevo →
		// el insert devuelve display_name); aquí se simula el camino de
		// lectura tras conflicto, seguido del select.
		srv := newMeServer(t,
			fakeRow{err: pgx.ErrNoRows},
			fakeRow{displayName: "user"},
		)
		req, err := http.NewRequest(http.MethodGet, srv.URL+"/api/v1/me", nil)
		if err != nil {
			t.Fatal(err)
		}
		req.Header.Set("Authorization", "Bearer "+bearerToken(t))
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatalf("GET /me: %v", err)
		}
		defer resp.Body.Close()
		if resp.StatusCode != http.StatusOK {
			body, _ := io.ReadAll(resp.Body)
			t.Fatalf("status = %d, se esperaba 200; body: %s", resp.StatusCode, body)
		}
		var body struct {
			UserID      string `json:"user_id"`
			Email       string `json:"email"`
			Role        string `json:"role"`
			DisplayName string `json:"display_name"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
			t.Fatalf("decodificar body: %v", err)
		}
		if body.UserID != "c0765b83-bb44-4ea8-8420-340b8ded7eaf" ||
			body.Email != "user@example.com" ||
			body.Role != "authenticated" ||
			body.DisplayName != "user" {
			t.Errorf("body inesperado: %+v", body)
		}
	})

	t.Run("error de base de datos devuelve 500", func(t *testing.T) {
		srv := newMeServer(t, fakeRow{err: errors.New("sin conexión")})
		req, err := http.NewRequest(http.MethodGet, srv.URL+"/api/v1/me", nil)
		if err != nil {
			t.Fatal(err)
		}
		req.Header.Set("Authorization", "Bearer "+bearerToken(t))
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatalf("GET /me: %v", err)
		}
		defer resp.Body.Close()
		if resp.StatusCode != http.StatusInternalServerError {
			t.Errorf("status = %d, se esperaba 500", resp.StatusCode)
		}
	})
}

func TestOpenAPI(t *testing.T) {
	srv := newTestServer(t, &fakeDB{})
	resp, err := http.Get(srv.URL + "/openapi.json")
	if err != nil {
		t.Fatalf("GET /openapi.json: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, se esperaba 200", resp.StatusCode)
	}
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatal(err)
	}
	for _, fragmento := range []string{
		"/api/v1/health", "/api/v1/ready", "/api/v1/me", "bearer",
		"/api/v1/tienda/ofertas", "/api/v1/tienda/ordenes",
		"/api/v1/mis-compras", "/api/v1/staff/pagos", "/api/v1/staff/auditoria",
		"/api/v1/tienda/pistas/{id}/licencias", "/api/v1/mis-artistas/{artistId}/licencias",
		"/api/v1/staff/licencias",
	} {
		if !json.Valid(body) || !strings.Contains(string(body), fragmento) {
			t.Errorf("el spec OpenAPI no contiene %q", fragmento)
		}
	}
}

func TestTiendaOfertasPublico(t *testing.T) {
	t.Run("sin token no exige auth: llega a la consulta y falla 500 con la base caída", func(t *testing.T) {
		srv := newTestServer(t, &fakeDB{err: errors.New("sin conexión")})
		resp, err := http.Get(srv.URL + "/api/v1/tienda/ofertas")
		if err != nil {
			t.Fatalf("GET /tienda/ofertas: %v", err)
		}
		defer resp.Body.Close()
		// Un endpoint protegido respondería 401; el 500 confirma que el
		// request superó el middleware de auth y cayó en la consulta.
		if resp.StatusCode != http.StatusInternalServerError {
			t.Errorf("status = %d, se esperaba 500", resp.StatusCode)
		}
	})
}

func TestMisComprasRequiereAuth(t *testing.T) {
	srv := newTestServer(t, &fakeDB{})
	resp, err := http.Get(srv.URL + "/api/v1/mis-compras")
	if err != nil {
		t.Fatalf("GET /mis-compras: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("status = %d, se esperaba 401", resp.StatusCode)
	}
}

func TestStaffRequiereRol(t *testing.T) {
	do := func(t *testing.T, rows ...fakeRow) int {
		t.Helper()
		srv := newTestServer(t, &fakeDB{rows: rows})
		req, err := http.NewRequest(http.MethodGet, srv.URL+"/api/v1/staff/pagos", nil)
		if err != nil {
			t.Fatal(err)
		}
		req.Header.Set("Authorization", "Bearer "+bearerToken(t))
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatalf("GET /staff/pagos: %v", err)
		}
		defer resp.Body.Close()
		return resp.StatusCode
	}

	t.Run("usuario sin rol staff recibe 403", func(t *testing.T) {
		if status := do(t, fakeRow{authorized: false}); status != http.StatusForbidden {
			t.Errorf("status = %d, se esperaba 403", status)
		}
	})

	t.Run("usuario con rol staff avanza a la consulta (500 con base caída)", func(t *testing.T) {
		rows := []fakeRow{{authorized: true}}
		srv := newTestServer(t, &fakeDB{rows: rows, err: errors.New("sin conexión")})
		req, err := http.NewRequest(http.MethodGet, srv.URL+"/api/v1/staff/pagos", nil)
		if err != nil {
			t.Fatal(err)
		}
		req.Header.Set("Authorization", "Bearer "+bearerToken(t))
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatalf("GET /staff/pagos: %v", err)
		}
		defer resp.Body.Close()
		if resp.StatusCode != http.StatusInternalServerError {
			t.Errorf("status = %d, se esperaba 500 con la base caída", resp.StatusCode)
		}
	})

	t.Run("sin token recibe 401", func(t *testing.T) {
		srv := newTestServer(t, &fakeDB{})
		resp, err := http.Get(srv.URL + "/api/v1/staff/pagos")
		if err != nil {
			t.Fatalf("GET /staff/pagos: %v", err)
		}
		defer resp.Body.Close()
		if resp.StatusCode != http.StatusUnauthorized {
			t.Errorf("status = %d, se esperaba 401", resp.StatusCode)
		}
	})
}
