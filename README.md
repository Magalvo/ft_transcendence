# ft_transcendence 🏓

A real-time multiplayer Pong game featuring a microservices architecture, user authentication, live chat, and competitive matchmaking. 

## 🚀 Tech Stack

* **Frontend:** Vanilla TypeScript, Vite, Tailwind CSS (Custom SPA Router)
* **Backend:** Node.js, Fastify, Socket.IO
* **Database:** SQLite
* **Infrastructure:** Docker & Docker Compose

## 🛠️ Prerequisites

Make sure you have the following installed on your machine:
* [Docker](https://docs.docker.com/get-docker/)
* [Make](https://www.gnu.org/software/make/)

## ⚡ Quick Start

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
    * **Frontend (App):** [http://localhost:5173](http://localhost:5173)

## 🛑 Stopping the Application

To safely stop and remove the containers, run:
```bash
make down
```

To completely clean up (including volumes and database resets), run:
```bash
make fclean
```

## 📁 Project Structure

The project is divided into specialized microservices:
* `/frontend` - The Single Page Application (UI, Game Engine, Router).
* `/backend/Gateway` - API Gateway to route requests.
* `/backend/Auth` - Handles user registration, login, JWTs, and 2FA.
* `/backend/Game` - Dedicated Socket.IO server for real-time physics and game state.
* `/backend/Chat` - Dedicated server for real-time messaging.
