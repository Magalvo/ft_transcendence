ENV_FILE = ./backend/Auth/.env

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
	docker compose up -d --build

# Stop and remove all running containers
down:
	docker compose down

# Display logs from running containers
logs:
	docker compose logs

# Clean environment: stop containers and remove .env file
clean: down
	rm -f $(ENV_FILE)

# Fully clean the environment: stop containers, remove volumes, images, networks
# - Removes all Docker volumes, images, containers, and networks
fclean:
	docker compose down -v --rmi all
	docker container prune -f
	docker image prune -f
	docker volume prune -f
	docker network prune -f

# Reset database: remove database volume and rebuild the application
# - Removes the auth_database volume
# - Rebuilds the entire application
dbre:
	docker volume rm transcendence_auth_database || true
	$(MAKE) re

# Rebuild the application
# - Starts the application after cleaning
# - Prunes unused Docker images
re: up
	docker image prune -f

# Build Docker images without using cache
build:
	docker compose build --no-cache

# Pull latest Docker images from registry
pull:
	docker compose pull

# Display logs from running containers and follow new output
logs-f:
	docker compose logs -f

# Show status of all running containers
status:
	docker compose ps

# Declare phony targets (targets that are not files)
.PHONY: all up down logs clean fclean dbre re build pull logs-f status
