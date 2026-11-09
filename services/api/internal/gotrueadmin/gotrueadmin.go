// Package gotrueadmin crea cuentas en GoTrue mediante su API de administración.
// La API firma un token de rol service_role con el secreto JWT compartido, de
// vida muy corta, y lo usa solo en esta llamada: nunca se devuelve al cliente.
// Los errores no incluyen el cuerpo de la respuesta de GoTrue (podría contener
// datos personales), solo un código.
package gotrueadmin

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// ErrAlreadyExists indica que GoTrue ya tiene una cuenta con ese correo.
var ErrAlreadyExists = errors.New("ya existe una cuenta con ese correo")

// ErrRejected indica que GoTrue rechazó la cuenta (p. ej. contraseña débil).
var ErrRejected = errors.New("GoTrue rechazó la cuenta")

// Client llama a la API de administración de GoTrue.
type Client struct {
	baseURL    string
	secret     []byte
	httpClient *http.Client
	now        func() time.Time
}

// New crea un cliente. baseURL es la URL de GoTrue (sin barra final).
func New(baseURL, jwtSecret string) *Client {
	return &Client{
		baseURL:    strings.TrimRight(baseURL, "/"),
		secret:     []byte(jwtSecret),
		httpClient: &http.Client{Timeout: 10 * time.Second},
		now:        time.Now,
	}
}

// serviceToken firma un JWT service_role de 2 minutos.
func (c *Client) serviceToken() (string, error) {
	now := c.now()
	claims := jwt.MapClaims{
		"role": "service_role",
		"aud":  "authenticated",
		"iat":  now.Unix(),
		"exp":  now.Add(2 * time.Minute).Unix(),
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(c.secret)
}

// CreateUser crea una cuenta con correo confirmado y devuelve su ID (sub).
func (c *Client) CreateUser(ctx context.Context, email, password string) (string, error) {
	token, err := c.serviceToken()
	if err != nil {
		return "", fmt.Errorf("firmando token de servicio: %w", err)
	}
	payload, err := json.Marshal(map[string]any{
		"email":         email,
		"password":      password,
		"email_confirm": true,
	})
	if err != nil {
		return "", err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/admin/users", bytes.NewReader(payload))
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("llamando a GoTrue: %w", err)
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(resp.Body, 64<<10))
	if err != nil {
		return "", fmt.Errorf("leyendo respuesta de GoTrue: %w", err)
	}

	switch {
	case resp.StatusCode == http.StatusOK || resp.StatusCode == http.StatusCreated:
		var user struct {
			ID string `json:"id"`
		}
		if err := json.Unmarshal(raw, &user); err != nil || user.ID == "" {
			return "", errors.New("respuesta inesperada de GoTrue al crear la cuenta")
		}
		return user.ID, nil
	case resp.StatusCode == http.StatusUnprocessableEntity && bytes.Contains(bytes.ToLower(raw), []byte("already")):
		return "", ErrAlreadyExists
	case resp.StatusCode == http.StatusBadRequest || resp.StatusCode == http.StatusUnprocessableEntity:
		return "", ErrRejected
	default:
		return "", fmt.Errorf("GoTrue respondió %d al crear la cuenta", resp.StatusCode)
	}
}
