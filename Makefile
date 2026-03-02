ENV_FILE = ./backend/Auth/.env

all: up

up:
	@if [ ! -f $(ENV_FILE) ]; then \
		echo "Generating .env file..."; \
		echo "JWT_SECRET=$$(openssl rand -base64 48)" > $(ENV_FILE); \
		echo "PORT=3000" >> $(ENV_FILE); \
		echo "DB_FILE=dev.sqlite" >> $(ENV_FILE); \
	fi
	docker compose up -d --build

down:
	docker compose down

logs:
	docker compose logs

clean: down
	rm -f $(ENV_FILE)

eval:
	docker compose down -v --rmi all --remove-orphans
	docker volume prune -f
	docker network prune -f

dbre:
	docker volume rm transcendence_auth_database || true
	$(MAKE) re

re: clean up

build:
	docker compose build --no-cache

pull:
	docker compose pull

logs-f:
	docker compose logs -f

status:
	docker compose ps
