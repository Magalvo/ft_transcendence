ENV_FILE = ./backend/Auth/.env
COMPOSE_PROJECT_NAME ?= $(notdir $(CURDIR))
COMPOSE = COMPOSE_PROJECT_NAME=$(COMPOSE_PROJECT_NAME) docker compose
DB_VOLUME = $(COMPOSE_PROJECT_NAME)_auth_database

# Default target - runs 'up' command
all: up

# Start the application in detached mode with build
# - Generates .env file if it doesn't exist
# - Builds and starts Docker containers
up:
	@if [ ! -f $(ENV_FILE) ]; then \
		echo "Generating .env file..."; \
		echo "JWT_SECRET=$$(openssl rand -base64 48)" > $(ENV_FILE); \
		echo "PORT=3000" >> $(ENV_FILE); \
		echo "DB_FILE=dev.sqlite" >> $(ENV_FILE); \
	fi
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
