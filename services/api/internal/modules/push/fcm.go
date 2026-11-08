package push

import (
	"bytes"
	"context"
	"crypto/rsa"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// ErrNotConfigured indica que FCM no tiene proyecto o credenciales.
var ErrNotConfigured = errors.New("FCM no configurado")

// ErrTokenInvalid indica que FCM rechazó el token del dispositivo (ya no
// existe la instalación o el token está mal formado). Debe revocarse.
var ErrTokenInvalid = errors.New("token push inválido")

// Message es la notificación visible que se envía a un dispositivo.
type Message struct {
	Title string
	Body  string
	Data  map[string]string
}

// Sender envía una notificación a un token push concreto.
type Sender interface {
	// Configured indica si el emisor puede enviar realmente.
	Configured() bool
	Send(ctx context.Context, token string, msg Message) error
}

const (
	fcmBaseURL   = "https://fcm.googleapis.com"
	fcmScope     = "https://www.googleapis.com/auth/firebase.messaging"
	fcmAssertTTL = time.Hour
)

// notConfigured es el emisor usado cuando FCM no está configurado.
type notConfigured struct{}

func (notConfigured) Configured() bool { return false }

func (notConfigured) Send(context.Context, string, Message) error { return ErrNotConfigured }

// NewSender devuelve el emisor FCM configurado, o uno que responde
// ErrNotConfigured cuando faltan proyecto o credenciales. Las credenciales se
// leen en el primer envío: un archivo mal configurado falla ahí, no al arrancar.
func NewSender(projectID, credentialsFile string) Sender {
	if projectID == "" || credentialsFile == "" {
		return notConfigured{}
	}
	c := &fcmClient{
		projectID: projectID,
		baseURL:   fcmBaseURL,
		http:      &http.Client{Timeout: 15 * time.Second},
		credsPath: credentialsFile,
		now:       time.Now,
	}
	return c
}

// fcmClient implementa Sender contra FCM HTTP v1 con una cuenta de servicio.
type fcmClient struct {
	projectID string
	baseURL   string // sobreescribible en pruebas
	http      *http.Client
	credsPath string
	now       func() time.Time

	mu      sync.Mutex
	creds   *serviceAccount
	access  string
	expires time.Time
}

type serviceAccount struct {
	ClientEmail string `json:"client_email"`
	PrivateKey  string `json:"private_key"`
	TokenURI    string `json:"token_uri"`
}

// loadCreds lee la cuenta de servicio la primera vez (no se guarda en memoria
// en claro más de lo necesario y nunca se registra en logs).
func (c *fcmClient) loadCreds() (*serviceAccount, error) {
	if c.creds != nil {
		return c.creds, nil
	}
	raw, err := os.ReadFile(c.credsPath)
	if err != nil {
		return nil, fmt.Errorf("leyendo credenciales FCM: %w", err)
	}
	var sa serviceAccount
	if err := json.Unmarshal(raw, &sa); err != nil {
		return nil, fmt.Errorf("credenciales FCM inválidas: %w", err)
	}
	if sa.ClientEmail == "" || sa.PrivateKey == "" {
		return nil, errors.New("credenciales FCM incompletas")
	}
	if sa.TokenURI == "" {
		sa.TokenURI = "https://oauth2.googleapis.com/token"
	}
	c.creds = &sa
	return c.creds, nil
}

func parsePrivateKey(pemData string) (*rsa.PrivateKey, error) {
	block, _ := pem.Decode([]byte(pemData))
	if block == nil {
		return nil, errors.New("clave privada PEM inválida")
	}
	if key, err := x509.ParsePKCS8PrivateKey(block.Bytes); err == nil {
		rk, ok := key.(*rsa.PrivateKey)
		if !ok {
			return nil, errors.New("la clave privada no es RSA")
		}
		return rk, nil
	}
	return x509.ParsePKCS1PrivateKey(block.Bytes)
}

// accessToken devuelve un access token vigente, obteniéndolo de Google con
// una aserción JWT firmada (RS256) cuando no hay uno en caché.
func (c *fcmClient) accessToken(ctx context.Context) (string, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	now := c.now()
	if c.access != "" && now.Before(c.expires.Add(-time.Minute)) {
		return c.access, nil
	}
	sa, err := c.loadCreds()
	if err != nil {
		return "", err
	}
	key, err := parsePrivateKey(sa.PrivateKey)
	if err != nil {
		return "", err
	}
	claims := jwt.MapClaims{
		"iss":   sa.ClientEmail,
		"scope": fcmScope,
		"aud":   sa.TokenURI,
		"iat":   now.Unix(),
		"exp":   now.Add(fcmAssertTTL).Unix(),
	}
	assertion, err := jwt.NewWithClaims(jwt.SigningMethodRS256, claims).SignedString(key)
	if err != nil {
		return "", fmt.Errorf("firmando aserción FCM: %w", err)
	}

	form := url.Values{
		"grant_type": {"urn:ietf:params:oauth:grant-type:jwt-bearer"},
		"assertion":  {assertion},
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, sa.TokenURI, strings.NewReader(form.Encode()))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	resp, err := c.http.Do(req)
	if err != nil {
		return "", fmt.Errorf("obteniendo access token FCM: %w", err)
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("access token FCM: HTTP %d", resp.StatusCode)
	}
	var tok struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int64  `json:"expires_in"`
	}
	if err := json.Unmarshal(body, &tok); err != nil || tok.AccessToken == "" {
		return "", errors.New("respuesta de access token FCM inválida")
	}
	c.access = tok.AccessToken
	c.expires = now.Add(time.Duration(tok.ExpiresIn) * time.Second)
	return c.access, nil
}

type fcmErrorBody struct {
	Error struct {
		Status  string `json:"status"`
		Details []struct {
			ErrorCode string `json:"errorCode"`
		} `json:"details"`
	} `json:"error"`
}

// Configured es true: el cliente tiene proyecto y credenciales declarados.
func (c *fcmClient) Configured() bool { return true }

// Send envía el mensaje a un token. Clasifica como ErrTokenInvalid los
// rechazos definitivos del token (UNREGISTERED o INVALID_ARGUMENT/404).
func (c *fcmClient) Send(ctx context.Context, token string, msg Message) error {
	access, err := c.accessToken(ctx)
	if err != nil {
		return err
	}

	payload := map[string]any{
		"message": map[string]any{
			"token":        token,
			"notification": map[string]string{"title": msg.Title, "body": msg.Body},
			"data":         msg.Data,
		},
	}
	raw, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	endpoint := fmt.Sprintf("%s/v1/projects/%s/messages:send", c.baseURL, url.PathEscape(c.projectID))
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(raw))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+access)
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("enviando a FCM: %w", err)
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if resp.StatusCode == http.StatusOK {
		return nil
	}

	var fe fcmErrorBody
	_ = json.Unmarshal(body, &fe)
	for _, d := range fe.Error.Details {
		if d.ErrorCode == "UNREGISTERED" {
			return ErrTokenInvalid
		}
	}
	if fe.Error.Status == "INVALID_ARGUMENT" || resp.StatusCode == http.StatusNotFound {
		return ErrTokenInvalid
	}
	return fmt.Errorf("FCM respondió HTTP %d (%s)", resp.StatusCode, fe.Error.Status)
}
