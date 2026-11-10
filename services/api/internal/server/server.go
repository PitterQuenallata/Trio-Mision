// Package server construye el router HTTP de la API.
package server

import (
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/adapters/humachi"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"triomision/api/internal/auth"
	"triomision/api/internal/config"
	"triomision/api/internal/database"
	"triomision/api/internal/gotrueadmin"
	"triomision/api/internal/modules/artists"
	"triomision/api/internal/modules/catalog"
	"triomision/api/internal/modules/devices"
	"triomision/api/internal/modules/health"
	"triomision/api/internal/modules/himnario"
	"triomision/api/internal/modules/importaciones"
	"triomision/api/internal/modules/licencias"
	"triomision/api/internal/modules/me"
	"triomision/api/internal/modules/push"
	"triomision/api/internal/modules/servicios"
	"triomision/api/internal/modules/soporte"
	"triomision/api/internal/modules/staff"
	"triomision/api/internal/modules/store"
	"triomision/api/internal/modules/sync"
	"triomision/api/internal/ratelimit"
	"triomision/api/internal/storage"
)

// Version es la versión del servicio reportada por /api/v1/health.
const Version = "0.21.0"

// New arma el handler raíz: middlewares chi, OpenAPI/Swagger de Huma y módulos.
// identifyClient devuelve el sub del JWT verificado (vacío si la petición es
// anónima o el token no valida: la firma se comprueba antes de confiar en él)
// y la IP del cliente. chi.RealIP deja la IP real en RemoteAddr: en producción
// solo debe confiarse detrás del proxy HTTPS del VPS.
func identifyClient(v *auth.Validator) ratelimit.Identify {
	return func(r *http.Request) (string, string) {
		ip := r.RemoteAddr
		if host, _, err := net.SplitHostPort(r.RemoteAddr); err == nil {
			ip = host
		}
		h := r.Header.Get("Authorization")
		if !strings.HasPrefix(h, "Bearer ") {
			return "", ip
		}
		claims, err := v.Parse(strings.TrimPrefix(h, "Bearer "))
		if err != nil || claims.Subject == "" {
			return "", ip
		}
		return claims.Subject, ip
	}
}

// isHealthProbe exime las sondas de liveness y readiness del límite.
func isHealthProbe(r *http.Request) bool {
	return r.URL.Path == "/api/v1/health" || r.URL.Path == "/api/v1/ready"
}

func New(cfg config.Config, db database.DB, validator *auth.Validator, objects storage.Client) http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(30 * time.Second))
	// Sin tasa configurada (solo pruebas unitarias: Load exige valores > 0)
	// el límite no se instala.
	if cfg.RateLimit.RPS > 0 {
		r.Use(ratelimit.Middleware(
			ratelimit.New(ratelimit.Config{RPS: cfg.RateLimit.RPS, Burst: cfg.RateLimit.Burst}),
			ratelimit.New(ratelimit.Config{RPS: cfg.RateLimit.IPRPS, Burst: cfg.RateLimit.IPBurst}),
			identifyClient(validator),
			isHealthProbe,
		))
	}

	humaCfg := huma.DefaultConfig("Trio Misión API", Version)
	humaCfg.Info.Description = "API central del ecosistema Trio Misión."
	humaCfg.Servers = []*huma.Server{{URL: "/"}}
	if humaCfg.Components == nil {
		humaCfg.Components = &huma.Components{}
	}
	if humaCfg.Components.SecuritySchemes == nil {
		humaCfg.Components.SecuritySchemes = map[string]*huma.SecurityScheme{}
	}
	humaCfg.Components.SecuritySchemes["bearer"] = &huma.SecurityScheme{
		Type:         "http",
		Scheme:       "bearer",
		BearerFormat: "JWT",
		Description:  "Token de acceso emitido por GoTrue",
	}

	api := humachi.New(r, humaCfg)
	api.UseMiddleware(validator.HumaMiddleware(api))

	health.Register(api, db, Version)
	me.Register(api, db)
	himnario.Register(api, db)
	catalog.Register(api, db)
	artists.Register(api, db, objects)
	artists.RegisterStaffGrupos(api, db, objects)
	artists.RegisterMiembrosGrupo(api, db)
	artists.RegisterDiscografia(api, db, objects)
	artists.RegisterPistasVenta(api, db)
	devices.Register(api, db)
	licencias.Register(api, db)
	servicios.Register(api, db, objects, cfg.S3.PresignTTL)
	soporte.Register(api, db, objects, cfg.S3.PresignTTL)
	sync.Register(api, db)
	importaciones.Register(api, db, objects, cfg.S3.PresignTTL)
	push.Register(api, db, push.NewSender(cfg.FCM.ProjectID, cfg.FCM.CredentialsFile))
	store.Register(api, db, objects, cfg.S3.PresignTTL)
	staff.Register(api, db, objects, cfg.S3.PresignTTL)
	staff.RegisterGestion(api, db, gotrueadmin.New(cfg.GoTrueURL, cfg.JWTSecret))
	staff.RegisterBuscarArtistas(api, db)

	return r
}
