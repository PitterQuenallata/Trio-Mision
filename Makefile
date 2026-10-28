.DEFAULT_GOAL := help

# Migraciones: requiere goose (go install github.com/pressly/goose/v3/cmd/goose@v3.24.3)
GOOSE ?= goose

.PHONY: help up down check api-run api-build api-test db-migrate db-security db-status db-reset db-seed

help: ## Muestra esta ayuda
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2}'

up: ## Levanta los servicios de desarrollo (PostgreSQL + GoTrue)
	docker compose up -d

down: ## Detiene los servicios de desarrollo
	docker compose down

check: ## Verifica que la estructura del monorepo esté completa
	@for dir in apps/web apps/mobile apps/admin services/api services/worker \
		content/himnario/acordes-completos content/himnario/fiel-pdf \
		reverse-lab packages database infra docs scripts .github/workflows; do \
		if [ -d "$$dir" ]; then echo "OK      $$dir"; else echo "FALTA   $$dir"; exit 1; fi; \
	done
	@echo "Estructura completa."

api-run: ## Corre la API en desarrollo (requiere make up + .env)
	set -a && . ./.env && set +a && cd services/api && go run ./cmd/api

api-build: ## Compila la API
	cd services/api && go build ./...

api-test: ## Ejecuta los tests de la API
	cd services/api && go test ./...

api-token: ## Genera un JWT de desarrollo para probar endpoints protegidos (Bruno/curl)
	@./scripts/mint-dev-token.sh

db-migrate: ## Aplica las migraciones pendientes (goose up)
	@set -a && . ./.env && set +a && $(GOOSE) -dir database/migrations postgres "$$DB_ADMIN_URL" up

db-security: ## Crea/actualiza las cuentas PostgreSQL restringidas de API y GoTrue
	@./scripts/db-security.sh

db-status: ## Muestra el estado de las migraciones
	@set -a && . ./.env && set +a && $(GOOSE) -dir database/migrations postgres "$$DB_ADMIN_URL" status

db-reset: ## Revierte todas las migraciones y las vuelve a aplicar desde cero (reinicia GoTrue después)
	@set -a && . ./.env && set +a && $(GOOSE) -dir database/migrations postgres "$$DB_ADMIN_URL" reset \
		&& $(GOOSE) -dir database/migrations postgres "$$DB_ADMIN_URL" up
	@echo "Listo. Ejecuta make db-security y reinicia GoTrue: docker compose restart gotrue"

db-seed: ## Carga los datos de desarrollo (himnario completo + catálogo mínimo + demo de tienda)
	@set -a && . ./.env && set +a && cd services/api && go run ./cmd/seed

db-staff: ## Asigna un rol staff a un usuario GoTrue (EMAIL=... ROLE=vendedor|admin|editor)
	@./scripts/grant-staff.sh $(EMAIL) $(ROLE)

db-artist-role: ## Asigna una membresía por artista (EMAIL=... ROLE=member|manager ARTIST=trio-mision)
	@./scripts/grant-artist-role.sh $(EMAIL) $(ROLE) $(ARTIST)
