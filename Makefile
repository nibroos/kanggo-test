# Shortcuts for the Docker workflows. Everything here is a plain docker compose
# command — run them by hand if you prefer.

DEV  := docker compose -f docker-compose.dev.yml
PROD := docker compose

.DEFAULT_GOAL := help
.PHONY: help dev dev-deps dev-logs dev-down prod prod-down migrate seed reset test test-backend test-frontend shell-backend shell-frontend db screenshots ps

help: ## Show this help
	@grep -hE '^[a-z-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

## --- Development (live reload) ---------------------------------------------

dev: ## Start the dev stack: Vite HMR on :5173, auto-restarting API on :4088
	$(DEV) up -d --build
	@echo ""
	@echo "  Frontend  http://localhost:5173   (hot reload)"
	@echo "  API       http://localhost:4088/api"
	@echo "  API docs  http://localhost:4088/api/docs"
	@echo ""
	@echo "  Logs:  make dev-logs      Demo data:  make seed"

dev-deps: ## Reinstall node_modules in the containers (run after changing package.json)
	$(DEV) up -d --build --renew-anon-volumes

dev-logs: ## Tail the dev backend and frontend logs
	$(DEV) logs -f backend frontend

dev-down: ## Stop the dev stack (the database volume is kept)
	$(DEV) down

## --- Production-like stack --------------------------------------------------

prod: ## Start the built stack: nginx on :4089, API on :4088
	$(PROD) up -d --build
	@echo "  Frontend  http://localhost:4089"

prod-down: ## Stop the production-like stack
	$(PROD) down

## --- Database ---------------------------------------------------------------

migrate: ## Apply pending migrations
	$(DEV) exec backend npm run migrate

seed: ## Load demo data (12 users, 20-30 tasks each)
	$(DEV) exec backend npm run seed

reset: ## Drop the database volume and start clean
	$(DEV) down -v
	$(DEV) up -d --build
	@echo "Waiting for migrations ..." && sleep 12
	$(DEV) exec backend npm run seed

db: ## Open a MySQL shell
	$(DEV) exec mysql mysql -utask_user -ptask_password task_management

## --- Tests and tooling ------------------------------------------------------

test: test-backend test-frontend ## Run both test suites

test-backend: ## Run the backend suite inside the container
	$(DEV) exec backend npm test

test-frontend: ## Run the frontend suite inside the container
	$(DEV) exec frontend npm test

screenshots: ## Regenerate the README screenshots from the running stack
	node scripts/screenshots.mjs

shell-backend: ## Shell into the backend container
	$(DEV) exec backend sh

shell-frontend: ## Shell into the frontend container
	$(DEV) exec frontend sh

ps: ## Show container status
	$(DEV) ps
