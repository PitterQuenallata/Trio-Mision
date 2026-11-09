package gotrueadmin

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
)

const secreto = "secreto-de-prueba-gotrue"

func servidor(t *testing.T, status int, body string, verifica func(*http.Request, map[string]any)) *Client {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/admin/users" || r.Method != http.MethodPost {
			t.Errorf("ruta inesperada: %s %s", r.Method, r.URL.Path)
		}
		raw, _ := io.ReadAll(r.Body)
		var payload map[string]any
		_ = json.Unmarshal(raw, &payload)
		if verifica != nil {
			verifica(r, payload)
		}
		w.WriteHeader(status)
		_, _ = w.Write([]byte(body))
	}))
	t.Cleanup(srv.Close)
	return New(srv.URL, secreto)
}

func TestCreateUserEnviaTokenServiceRoleFirmado(t *testing.T) {
	c := servidor(t, http.StatusOK, `{"id":"11111111-2222-4333-8444-555555555555"}`, func(r *http.Request, p map[string]any) {
		auth := r.Header.Get("Authorization")
		tok, err := jwt.Parse(auth[len("Bearer "):], func(*jwt.Token) (any, error) { return []byte(secreto), nil })
		if err != nil || !tok.Valid {
			t.Fatalf("token inválido: %v", err)
		}
		claims := tok.Claims.(jwt.MapClaims)
		if claims["role"] != "service_role" {
			t.Errorf("role = %v, se esperaba service_role", claims["role"])
		}
		if p["email"] != "nuevo@ejemplo.test" || p["email_confirm"] != true {
			t.Errorf("payload inesperado: %v", p)
		}
	})
	id, err := c.CreateUser(context.Background(), "nuevo@ejemplo.test", "contraseña-larga-123")
	if err != nil {
		t.Fatalf("CreateUser: %v", err)
	}
	if id != "11111111-2222-4333-8444-555555555555" {
		t.Errorf("id = %s", id)
	}
}

func TestCreateUserMapeaErrores(t *testing.T) {
	casos := []struct {
		nombre string
		status int
		body   string
		want   error
	}{
		{"duplicado", http.StatusUnprocessableEntity, `{"msg":"A user with this email address has already been registered"}`, ErrAlreadyExists},
		{"contraseña débil", http.StatusBadRequest, `{"msg":"Password should be at least 6 characters"}`, ErrRejected},
	}
	for _, tc := range casos {
		t.Run(tc.nombre, func(t *testing.T) {
			c := servidor(t, tc.status, tc.body, nil)
			_, err := c.CreateUser(context.Background(), "x@ejemplo.test", "x")
			if !errors.Is(err, tc.want) {
				t.Fatalf("err = %v, se esperaba %v", err, tc.want)
			}
		})
	}
}

func TestCreateUserNoFiltraCuerpoDeGoTrue(t *testing.T) {
	c := servidor(t, http.StatusInternalServerError, `{"msg":"dato-sensible@correo.test"}`, nil)
	_, err := c.CreateUser(context.Background(), "x@ejemplo.test", "x")
	if err == nil {
		t.Fatal("se esperaba error")
	}
	if strings.Contains(err.Error(), "dato-sensible") {
		t.Errorf("el error filtra el cuerpo de GoTrue: %v", err)
	}
}

func TestServiceTokenCaduca(t *testing.T) {
	c := New("http://x", secreto)
	base := time.Date(2026, 11, 8, 12, 0, 0, 0, time.UTC)
	c.now = func() time.Time { return base }
	raw, err := c.serviceToken()
	if err != nil {
		t.Fatal(err)
	}
	tok, _, err := jwt.NewParser().ParseUnverified(raw, jwt.MapClaims{})
	if err != nil {
		t.Fatal(err)
	}
	exp := tok.Claims.(jwt.MapClaims)["exp"].(float64)
	if int64(exp) != base.Add(2*time.Minute).Unix() {
		t.Errorf("exp = %v, se esperaba base+2min", exp)
	}
}
