ENV_FILE := backend/Auth/.env
SECRETS_DIR := .secrets
JWT_SECRET_FILE := $(SECRETS_DIR)/jwt_secret.txt
GOOGLE_SECRET_FILE := $(SECRETS_DIR)/google_client_secret.txt

COMPOSE_PROJECT_NAME ?= $(notdir $(subst \,/,$(CURDIR)))
COMPOSE := docker compose -p $(COMPOSE_PROJECT_NAME)
DB_VOLUME := $(COMPOSE_PROJECT_NAME)_auth_database

# Default target - runs 'up' command
all: up

# Setup environment:
# - create secrets directory
# - generate .env file if it doesn't exist
# - generate runtime secrets if they don't exist yet
ifeq ($(OS),Windows_NT)
setup:
	@powershell -NoProfile -ExecutionPolicy Bypass -Command "$$envFile = '$(ENV_FILE)'; if (-not (Test-Path $$envFile)) { @('GOOGLE_CLIENT_ID=596804197978-d726nn0a3smhs1ve3ha3h0sh2n690rij.apps.googleusercontent.com','GOOGLE_REDIRECT_URI=https://localhost:8443/api/auth/google/callback','FRONTEND_URL=https://localhost:8443','PORT=3000','DB_FILE=dev.sqlite','SMTP_HOST=mailpit','SMTP_PORT=1025','SMTP_USER=noreply@ft.local','SMTP_PASS=devpass') | Set-Content -Path $$envFile; Write-Host ('Generated ' + $$envFile) }"
	@powershell -NoProfile -ExecutionPolicy Bypass -Command "$$ErrorActionPreference = 'Stop'; $$secretsDir = '$(SECRETS_DIR)'; $$jwtFile = '$(JWT_SECRET_FILE)'; $$googleFile = '$(GOOGLE_SECRET_FILE)'; New-Item -ItemType Directory -Force -Path $$secretsDir | Out-Null; if (-not (Test-Path $$jwtFile) -or [string]::IsNullOrWhiteSpace((Get-Content $$jwtFile -Raw -ErrorAction SilentlyContinue))) { $$bytes = New-Object byte[] 48; $$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create(); $$rng.GetBytes($$bytes); $$rng.Dispose(); [Convert]::ToBase64String($$bytes) | Set-Content -Path $$jwtFile -NoNewline; Write-Host ('Generated ' + $$jwtFile) }; if (-not (Test-Path $$googleFile)) { '' | Set-Content -Path $$googleFile -NoNewline; Write-Host ('Created empty ' + $$googleFile) }"
else
setup:
	@mkdir -p "$(SECRETS_DIR)"
	@if [ ! -f "$(ENV_FILE)" ]; then \
		printf '%s\n' \
			'GOOGLE_CLIENT_ID=596804197978-d726nn0a3smhs1ve3ha3h0sh2n690rij.apps.googleusercontent.com' \
			'GOOGLE_REDIRECT_URI=https://localhost:8443/api/auth/google/callback' \
			'FRONTEND_URL=https://localhost:8443' \
			'PORT=3000' \
			'DB_FILE=dev.sqlite' \
			'SMTP_HOST=mailpit' \
			'SMTP_PORT=1025' \
			'SMTP_USER=noreply@ft.local' \
			'SMTP_PASS=devpass' \
			> "$(ENV_FILE)"; \
		echo "Generated $(ENV_FILE)"; \
	fi
	@if [ ! -s "$(JWT_SECRET_FILE)" ]; then \
		openssl rand -base64 48 > "$(JWT_SECRET_FILE)"; \
		chmod 600 "$(JWT_SECRET_FILE)" 2>/dev/null || true; \
		echo "Generated $(JWT_SECRET_FILE)"; \
	fi
	@if [ ! -f "$(GOOGLE_SECRET_FILE)" ]; then \
		: > "$(GOOGLE_SECRET_FILE)"; \
		chmod 600 "$(GOOGLE_SECRET_FILE)" 2>/dev/null || true; \
		echo "Created empty $(GOOGLE_SECRET_FILE)"; \
	fi
endif

# Start the application in detached mode with build
up: setup
	$(COMPOSE) up -d --build

# Stop and remove all running containers
down:
	$(COMPOSE) down

# Display logs from running containers
logs:
	$(COMPOSE) logs

# Clean environment: stop containers and remove .env file
clean: down
ifeq ($(OS),Windows_NT)
	@powershell -NoProfile -ExecutionPolicy Bypass -Command "Remove-Item -Force -ErrorAction SilentlyContinue '$(ENV_FILE)'"
else
	rm -f "$(ENV_FILE)"
endif

# Fully clean this project: stop containers and remove its volumes, images
# and networks. Scoped to the compose project, so other Docker projects on
# the machine are left alone.
fclean:
	$(COMPOSE) down -v --rmi all --remove-orphans

# Reset database: remove database volume and rebuild the application
# - Removes the auth_database volume
# - Rebuilds the entire application
dbre:
	$(COMPOSE) down
	-docker volume rm $(DB_VOLUME)
	$(MAKE) re

# Rebuild the application
# - Starts the application after cleaning
# - Prunes unused Docker images
re: up
	docker image prune -f

# Build Docker images without using cache
build:
	$(COMPOSE) build --no-cache

# Pull latest Docker images from registry
pull:
	$(COMPOSE) pull

# Display logs from running containers and follow new output
logs-f:
	$(COMPOSE) logs -f

# Show status of all running containers
status:
	$(COMPOSE) ps

# Declare phony targets (targets that are not files)
.PHONY: all setup up down logs clean fclean dbre re build pull logs-f status
