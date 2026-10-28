// Package auth verifica los tokens JWT emitidos por GoTrue y expone
// la identidad del usuario al resto de la API.
package auth

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/danielgtaylor/huma/v2"
	"github.com/golang-jwt/jwt/v5"
)

type claimsContextKey struct{}

// Claims representa los claims relevantes de un token de GoTrue.
type Claims struct {
	jwt.RegisteredClaims
	Role  string `json:"role"`
	Email string `json:"email"`
}

// Validator valida tokens JWT firmados con HS256 por GoTrue.
type Validator struct {
	secret   []byte
	audience string
}

// NewValidator crea un validador. Si audience está vacía no se valida `aud`.
func NewValidator(secret, audience string) *Validator {
	return &Validator{secret: []byte(secret), audience: audience}
}

// Parse verifica firma, expiración y audiencia, y devuelve los claims.
func (v *Validator) Parse(tokenString string) (*Claims, error) {
	claims := &Claims{}
	opts := []jwt.ParserOption{jwt.WithExpirationRequired()}
	if v.audience != "" {
		opts = append(opts, jwt.WithAudience(v.audience))
	}
	_, err := jwt.ParseWithClaims(tokenString, claims, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("método de firma no soportado: %v", t.Header["alg"])
		}
		return v.secret, nil
	}, opts...)
	if err != nil {
		return nil, fmt.Errorf("token inválido: %w", err)
	}
	if claims.Subject == "" {
		return nil, errors.New("token sin subject")
	}
	return claims, nil
}

// HumaMiddleware valida el token Bearer únicamente en las operaciones
// que declaran seguridad "bearer" en su definición OpenAPI.
func (v *Validator) HumaMiddleware(api huma.API) func(huma.Context, func(huma.Context)) {
	return func(ctx huma.Context, next func(huma.Context)) {
		required := false
		for _, scheme := range ctx.Operation().Security {
			if _, ok := scheme["bearer"]; ok {
				required = true
				break
			}
		}
		if !required {
			next(ctx)
			return
		}

		tokenString, ok := strings.CutPrefix(ctx.Header("Authorization"), "Bearer ")
		if !ok || strings.TrimSpace(tokenString) == "" {
			huma.WriteErr(api, ctx, http.StatusUnauthorized, "falta el token de autorización")
			return
		}

		claims, err := v.Parse(tokenString)
		if err != nil {
			huma.WriteErr(api, ctx, http.StatusUnauthorized, "token inválido o expirado")
			return
		}
		next(huma.WithValue(ctx, claimsContextKey{}, claims))
	}
}

// ClaimsFromContext devuelve los claims del usuario autenticado, si existen.
func ClaimsFromContext(ctx context.Context) (*Claims, bool) {
	claims, ok := ctx.Value(claimsContextKey{}).(*Claims)
	return claims, ok
}
