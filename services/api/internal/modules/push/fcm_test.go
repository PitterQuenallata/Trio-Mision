package push

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"sync/atomic"
	"testing"

	"github.com/golang-jwt/jwt/v5"
)

// fixture levanta un servidor OAuth falso (verifica la aserción RS256) y un
// servidor FCM falso que responde según el token recibido.
func fixture(t *testing.T) (*fcmClient, *atomic.Int32) {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	der, err := x509.MarshalPKCS8PrivateKey(key)
	if err != nil {
		t.Fatal(err)
	}
	pemKey := pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: der})

	var tokenCalls atomic.Int32
	oauth := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tokenCalls.Add(1)
		if err := r.ParseForm(); err != nil {
			http.Error(w, "bad form", http.StatusBadRequest)
			return
		}
		if r.Form.Get("grant_type") != "urn:ietf:params:oauth:grant-type:jwt-bearer" {
			http.Error(w, "grant", http.StatusBadRequest)
			return
		}
		parsed, err := jwt.Parse(r.Form.Get("assertion"), func(*jwt.Token) (any, error) {
			return &key.PublicKey, nil
		}, jwt.WithValidMethods([]string{"RS256"}))
		if err != nil || !parsed.Valid {
			http.Error(w, "assertion inválida", http.StatusUnauthorized)
			return
		}
		claims := parsed.Claims.(jwt.MapClaims)
		if claims["iss"] != "svc@test.iam" || claims["scope"] != fcmScope {
			http.Error(w, "claims", http.StatusUnauthorized)
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"access_token": "ya29.test", "expires_in": 3600})
	}))
	t.Cleanup(oauth.Close)

	fcm := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/projects/trio-test/messages:send" {
			http.NotFound(w, r)
			return
		}
		if r.Header.Get("Authorization") != "Bearer ya29.test" {
			http.Error(w, "auth", http.StatusUnauthorized)
			return
		}
		body, _ := io.ReadAll(r.Body)
		var payload struct {
			Message struct {
				Token string `json:"token"`
			} `json:"message"`
		}
		_ = json.Unmarshal(body, &payload)
		switch payload.Message.Token {
		case "tok-ok":
			_, _ = w.Write([]byte(`{"name":"projects/trio-test/messages/1"}`))
		case "tok-dead":
			w.WriteHeader(http.StatusNotFound)
			_, _ = w.Write([]byte(`{"error":{"status":"NOT_FOUND","details":[{"errorCode":"UNREGISTERED"}]}}`))
		case "tok-malformado":
			w.WriteHeader(http.StatusBadRequest)
			_, _ = w.Write([]byte(`{"error":{"status":"INVALID_ARGUMENT"}}`))
		default:
			w.WriteHeader(http.StatusInternalServerError)
			_, _ = w.Write([]byte(`{"error":{"status":"INTERNAL"}}`))
		}
	}))
	t.Cleanup(fcm.Close)

	creds := map[string]string{
		"client_email": "svc@test.iam",
		"private_key":  string(pemKey),
		"token_uri":    oauth.URL,
	}
	raw, _ := json.Marshal(creds)
	path := filepath.Join(t.TempDir(), "sa.json")
	if err := os.WriteFile(path, raw, 0o600); err != nil {
		t.Fatal(err)
	}

	s := NewSender("trio-test", path).(*fcmClient)
	s.baseURL = fcm.URL
	return s, &tokenCalls
}

func TestSendOKYCachesAccessToken(t *testing.T) {
	c, tokenCalls := fixture(t)
	ctx := context.Background()
	for i := 0; i < 2; i++ {
		if err := c.Send(ctx, "tok-ok", Message{Title: "t", Body: "b"}); err != nil {
			t.Fatalf("envío %d: %v", i, err)
		}
	}
	if n := tokenCalls.Load(); n != 1 {
		t.Fatalf("el access token debe cachearse: se pidió %d veces", n)
	}
}

func TestSendClassifiesInvalidToken(t *testing.T) {
	c, _ := fixture(t)
	for _, tok := range []string{"tok-dead", "tok-malformado"} {
		err := c.Send(context.Background(), tok, Message{})
		if !errors.Is(err, ErrTokenInvalid) {
			t.Fatalf("%s: esperado ErrTokenInvalid, obtenido %v", tok, err)
		}
	}
}

func TestSendTransientErrorIsNotInvalid(t *testing.T) {
	c, _ := fixture(t)
	err := c.Send(context.Background(), "tok-otro", Message{})
	if err == nil || errors.Is(err, ErrTokenInvalid) {
		t.Fatalf("un 500 de FCM es transitorio, no token inválido: %v", err)
	}
}

func TestNotConfigured(t *testing.T) {
	s := NewSender("", "")
	if s.Configured() {
		t.Fatal("sin proyecto/credenciales no debe estar configurado")
	}
	if err := s.Send(context.Background(), "tok", Message{}); !errors.Is(err, ErrNotConfigured) {
		t.Fatalf("esperado ErrNotConfigured, obtenido %v", err)
	}
}

func TestBadCredentialsFileFailsOnSend(t *testing.T) {
	s := NewSender("trio-test", filepath.Join(t.TempDir(), "no-existe.json"))
	if !s.Configured() {
		t.Fatal("con proyecto y ruta declarados debe reportarse configurado")
	}
	if err := s.Send(context.Background(), "tok", Message{}); err == nil || errors.Is(err, ErrTokenInvalid) {
		t.Fatalf("credenciales ausentes deben fallar como error de configuración: %v", err)
	}
}
