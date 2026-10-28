// Package server construye el router HTTP de la API.
package server

import (
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/adapters/humachi"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"triomision/api/internal/auth"
	"triomision/api/internal/config"
	"triomision/api/internal/database"
	"triomision/api/internal/modules/artists"
	"triomision/api/internal/modules/catalog"
	"triomision/api/internal/modules/devices"
	"triomision/api/internal/modules/health"
	"triomision/api/internal/modules/himnario"
	"triomision/api/internal/modules/me"
	"triomision/api/internal/modules/staff"
	"triomision/api/internal/modules/store"
	"triomision/api/internal/storage"
)

// Version es la versión del servicio reportada por /api/v1/health.
const Version = "0.7.1"

// New arma el handler raíz: middlewares chi, OpenAPI/Swagger de Huma y módulos.
func New(cfg config.Config, db database.DB, validator *auth.Validator, objects storage.Client) http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(30 * time.Second))

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
	artists.Register(api, db)
	devices.Register(api, db)
	store.Register(api, db, objects, cfg.S3.PresignTTL)
	staff.Register(api, db, objects, cfg.S3.PresignTTL)

	return r
}
