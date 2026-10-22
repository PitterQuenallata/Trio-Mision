.DEFAULT_GOAL := help

.PHONY: help up down check

help: ## Muestra esta ayuda
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2}'

up: ## Levanta los servicios de desarrollo (PostgreSQL)
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
