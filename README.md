# ft_transcendence 🏓

A real-time multiplayer Pong game featuring a microservices architecture, user authentication, live chat, and competitive matchmaking. 

## Tech Stack

* **Frontend:** Vanilla TypeScript, Vite, Tailwind CSS (Custom SPA Router)
* **Backend:** Node.js, Fastify, Socket.IO
* **Database:** SQLite
* **Infrastructure:** Docker & Docker Compose

## Prerequisites

Make sure you have the following installed on your machine:
* [Docker](https://docs.docker.com/get-docker/)
* [Make](https://www.gnu.org/software/make/)

## Quick Start

1.  **Clone the repository:**
    ```bash
    git clone <your-repository-url>
    cd ft_transcendence
    ```

2.  **Start the application:**
    The provided `Makefile` will automatically generate the required `.env` files and build the Docker containers.
    ```bash
    make
    ```

3.  **Access the application:**
    * **Frontend (App):** [https://localhost:8443](https://localhost:8443) (self-signed certificate; `http://localhost:8080` redirects there)
    * **Mailpit (dev inbox for password-reset emails):** [http://localhost:8025](http://localhost:8025), reachable from this machine only

## Stopping the Application

To safely stop and remove the containers, run:
```bash
make down
```

To completely clean up (including volumes and database resets), run:
```bash
make fclean
```

## Database Migrations

The Auth service's SQLite schema is managed with Knex migrations in `backend/Auth/src/migrations/`. Pending migrations run automatically every time the Auth container starts (`node dist/initDb.js`), and each one runs only once (they are recorded in the `knex_migrations` table).

To change the schema:

1. Add `backend/Auth/src/migrations/<YYYYMMDDHHMMSS>_<what>.ts` exporting `up(knex)` (and `down(knex)`).
2. Append it to the list in `backend/Auth/src/migrations/index.ts`.
3. Never edit or rename a migration that has already been merged; add a new one instead.

To run them locally without Docker: `cd backend/Auth && npm run init-db`.

## Project Structure

The project is divided into specialized microservices:
* `/frontend` - The Single Page Application (UI, Game Engine, Router).
* `/backend/Gateway` - API Gateway to route requests.
* `/backend/Auth` - Handles user registration, login, JWTs, and 2FA.
* `/backend/Game` - Dedicated Socket.IO server for real-time physics and game state.
* `/backend/Chat` - Dedicated server for real-time messaging.
