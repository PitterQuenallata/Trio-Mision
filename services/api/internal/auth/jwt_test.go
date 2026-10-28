package auth

import (
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const testSecret = "secreto-de-prueba"
const testAudience = "authenticated"

func signToken(t *testing.T, secret string, claims Claims) string {
	t.Helper()
	signed, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(secret))
	if err != nil {
		t.Fatalf("firmar token: %v", err)
	}
	return signed
}

func validClaims() Claims {
	return Claims{
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   "user-123",
			Audience:  jwt.ClaimStrings{testAudience},
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
		Role:  "authenticated",
		Email: "user@example.com",
	}
}

func TestParseValido(t *testing.T) {
	v := NewValidator(testSecret, testAudience)
	claims, err := v.Parse(signToken(t, testSecret, validClaims()))
	if err != nil {
		t.Fatalf("Parse() error = %v", err)
	}
	if claims.Subject != "user-123" {
		t.Errorf("Subject = %q, se esperaba user-123", claims.Subject)
	}
	if claims.Role != "authenticated" || claims.Email != "user@example.com" {
		t.Errorf("claims inesperados: %+v", claims)
	}
}

func TestParseRechaza(t *testing.T) {
	v := NewValidator(testSecret, testAudience)

	cases := map[string]func() string{
		"firma incorrecta": func() string {
			return signToken(t, "otro-secreto", validClaims())
		},
		"token expirado": func() string {
			c := validClaims()
			c.ExpiresAt = jwt.NewNumericDate(time.Now().Add(-time.Hour))
			return signToken(t, testSecret, c)
		},
		"audiencia incorrecta": func() string {
			c := validClaims()
			c.Audience = jwt.ClaimStrings{"otra"}
			return signToken(t, testSecret, c)
		},
		"sin expiración": func() string {
			c := validClaims()
			c.ExpiresAt = nil
			return signToken(t, testSecret, c)
		},
		"sin subject": func() string {
			c := validClaims()
			c.Subject = ""
			return signToken(t, testSecret, c)
		},
		"texto que no es JWT": func() string {
			return "no-es-un-token"
		},
	}

	for nombre, tokenFn := range cases {
		t.Run(nombre, func(t *testing.T) {
			if _, err := v.Parse(tokenFn()); err == nil {
				t.Error("Parse() debería rechazar el token")
			}
		})
	}
}

func TestParseAlgoritmoIncorrecto(t *testing.T) {
	v := NewValidator(testSecret, testAudience)
	// "none" no debe aceptarse aunque el token sea estructuralmente válido.
	token := jwt.NewWithClaims(jwt.SigningMethodNone, validClaims())
	signed, err := token.SignedString(jwt.UnsafeAllowNoneSignatureType)
	if err != nil {
		t.Fatalf("firmar token none: %v", err)
	}
	if _, err := v.Parse(signed); err == nil {
		t.Error("Parse() debería rechazar alg=none")
	}
}
