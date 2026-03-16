COMPOSE := docker compose

.PHONY: help build up start down restart logs ps clean

help:
	@echo "Available targets:"
	@echo "  make build    - Build backend/frontend images (includes native addon compile)"
	@echo "  make up       - Build and start the full game stack in background"
	@echo "  make start    - Alias for 'make up'"
	@echo "  make down     - Stop and remove containers"
	@echo "  make restart  - Rebuild and restart everything"
	@echo "  make logs     - Follow compose logs"
	@echo "  make ps       - Show running services"
	@echo "  make clean    - Stop stack and remove volumes/orphans"

build:
	$(COMPOSE) build

up:
	$(COMPOSE) up --build -d

start: up

down:
	$(COMPOSE) down

restart: down up

logs:
	$(COMPOSE) logs -f --tail=200

ps:
	$(COMPOSE) ps

clean:
	$(COMPOSE) down --volumes --remove-orphans
