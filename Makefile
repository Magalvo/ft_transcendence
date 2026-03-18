ENV_FILE = ./backend/Auth/.env
SECRETS_DIR = .secrets
JWT_SECRET_FILE = $(SECRETS_DIR)/jwt_secret.txt
GOOGLE_SECRET_FILE = $(SECRETS_DIR)/google_client_secret.txt

COMPOSE_PROJECT_NAME ?= $(notdir $(CURDIR))
COMPOSE = COMPOSE_PROJECT_NAME=$(COMPOSE_PROJECT_NAME) docker compose
DB_VOLUME = $(COMPOSE_PROJECT_NAME)_auth_database

# Default target - runs 'up' command
all: up

# Setup environment:
# - create secrets directory
# - generate .env file
# - generate secrets if they don't exist
setup:
	@mkdir -p $(SECRETS_DIR)
	@chmod 700 $(SECRETS_DIR)

	@if [ ! -f $(ENV_FILE) ]; then \
		echo "Generating .env file..."; \
		echo "GOOGLE_CLIENT_ID=596804197978-d726nn0a3smhs1ve3ha3h0sh2n690rij.apps.googleusercontent.com" > $(ENV_FILE); \
		echo "GOOGLE_REDIRECT_URI=https://localhost:8443/api/auth/google/callback" >> $(ENV_FILE); \
		echo "FRONTEND_URL=https://localhost:8443" >> $(ENV_FILE); \
		echo "PORT=3000" >> $(ENV_FILE); \
		echo "DB_FILE=dev.sqlite" >> $(ENV_FILE); \
		echo ".env file generated"; \
	fi

	@if [ ! -f $(JWT_SECRET_FILE) ]; then \
		openssl rand -base64 48 > $(JWT_SECRET_FILE); \
		chmod 600 $(JWT_SECRET_FILE); \
		echo "JWT Secret generated"; \
	fi

	@if [ ! -f $(GOOGLE_SECRET_FILE) ]; then \
		printf "Enter GOOGLE_CLIENT_SECRET: "; \
		read -s GSEC; echo $$GSEC > $(GOOGLE_SECRET_FILE); \
		chmod 600 $(GOOGLE_SECRET_FILE); \
		echo "Google Client Secret saved"; \
	fi

	@JWT_SECRET_VALUE="$$(tr -d '\r\n' < $(JWT_SECRET_FILE))"; \
	if grep -q '^JWT_SECRET=' $(ENV_FILE); then \
		sed -i.bak "s|^JWT_SECRET=.*|JWT_SECRET=$$JWT_SECRET_VALUE|" $(ENV_FILE); \
	else \
		echo "JWT_SECRET=$$JWT_SECRET_VALUE" >> $(ENV_FILE); \
	fi; \
	rm -f $(ENV_FILE).bak

	@GOOGLE_SECRET_VALUE="$$(tr -d '\r\n' < $(GOOGLE_SECRET_FILE))"; \
	if grep -q '^GOOGLE_CLIENT_SECRET=' $(ENV_FILE); then \
		sed -i.bak "s|^GOOGLE_CLIENT_SECRET=.*|GOOGLE_CLIENT_SECRET=$$GOOGLE_SECRET_VALUE|" $(ENV_FILE); \
	else \
		echo "GOOGLE_CLIENT_SECRET=$$GOOGLE_SECRET_VALUE" >> $(ENV_FILE); \
	fi; \
	rm -f $(ENV_FILE).bak

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
	rm -f $(ENV_FILE)

# Fully clean the environment: stop containers, remove volumes, images, networks
# - Removes all Docker volumes, images, containers, and networks
fclean:
	$(COMPOSE) down -v --rmi all
	docker container prune -f
	docker image prune -f
	docker volume prune -f
	docker network prune -f

# Reset database: remove database volume and rebuild the application
# - Removes the auth_database volume
# - Rebuilds the entire application
dbre:
	$(COMPOSE) down
	docker volume rm $(DB_VOLUME) || true
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
.PHONY: all up down logs clean fclean dbre re build pull logs-f status
