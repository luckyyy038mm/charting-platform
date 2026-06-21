.PHONY: help install dev infra-up infra-down infra-logs clean build lint test format check

# =============================================================================
# Charting Platform - Development Makefile
# =============================================================================

help: ## Show this help message
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# =============================================================================
# Installation
# =============================================================================

install: ## Install all dependencies (requires pnpm)
	@if ! command -v pnpm &> /dev/null; then \
		echo "Installing pnpm..."; \
		npm install -g pnpm; \
	fi
	pnpm install

# =============================================================================
# Infrastructure (Docker)
# =============================================================================

infra-up: ## Start all infrastructure services (Valkey, PostgreSQL)
	docker compose up -d valkey postgres

infra-down: ## Stop all infrastructure services
	docker compose down

infra-logs: ## View infrastructure logs
	docker compose logs -f valkey postgres

infra-status: ## Check infrastructure health
	@echo "Checking Valkey..."; \
	docker compose exec -T valkey valkey-cli ping || echo "Valkey is not healthy"; \
	@echo "Checking PostgreSQL..."; \
	docker compose exec -T postgres pg_isready -U charting_user -d charting_platform || echo "PostgreSQL is not healthy"

# =============================================================================
# Development
# =============================================================================

dev: ## Start all services in development mode
	docker compose up -d valkey
	pnpm --parallel -r run dev

dev-web: ## Start only the web frontend
	pnpm --filter @charting-platform/web dev

dev-api: ## Start only the Go API
	docker compose up -d valkey
	cd apps/platform-api && go run cmd/server/main.go

dev-rust: ## Start Rust services (requires Rust toolchain)
	cd services/connector-binance && cargo run
	# In another terminal: cd services/market-core && cargo run

# =============================================================================
# Build
# =============================================================================

build: ## Build all packages and apps
	pnpm -r run build

build-web: ## Build the web application
	pnpm --filter @charting-platform/web build

build-api: ## Build the Go API
	cd apps/platform-api && go build -o bin/server ./cmd/server

build-rust: ## Build Rust services
	cd services/connector-binance && cargo build
	cd services/market-core && cargo build

# =============================================================================
# Code Quality
# =============================================================================

lint: ## Run linters
	pnpm -r run lint

lint-web: ## Lint the web application
	pnpm --filter @charting-platform/web lint

lint-rust: ## Lint Rust services
	cd services/connector-binance && cargo clippy
	cd services/market-core && cargo clippy

format: ## Format all code
	pnpm -r run format
	cd apps/platform-api && go fmt ./...
	cd services/connector-binance && cargo fmt
	cd services/market-core && cargo fmt

check: ## Run all checks (types, lint, etc.)
	pnpm -r run typecheck
	pnpm -r run lint

# =============================================================================
# Testing
# =============================================================================

test: ## Run all tests
	pnpm -r run test

test-web: ## Run web tests
	pnpm --filter @charting-platform/web test

test-api: ## Run Go tests
	cd apps/platform-api && go test ./...

test-rust: ## Run Rust tests
	cd services/connector-binance && cargo test
	cd services/market-core && cargo test

# =============================================================================
# Cleanup
# =============================================================================

clean: ## Clean build artifacts
	pnpm -r run clean
	cd apps/platform-api && rm -rf bin
	cd services/connector-binance && cargo clean
	cd services/market-core && cargo clean

clean-all: ## Clean everything including Docker volumes
	docker compose down -v --remove-orphans
	rm -rf node_modules
	rm -rf apps/*/node_modules
	rm -rf packages/*/node_modules
	rm -rf apps/*/.next
	rm -rf apps/*/dist
	rm -rf packages/*/dist
