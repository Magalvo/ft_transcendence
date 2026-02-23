import Fastify from "fastify";
import cors from "@fastify/cors";
import dotenv from "dotenv";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import fastifyStatic from "@fastify/static";

import healthRoutes from "./routes/health.js";
import authRoutes from "./routes/auth.js";
import { sendSuccess } from "./utils/respond.js";
import "reflect-metadata";
import { setupSocketIO } from "./socket/index.js";
import gameRoutes from "./routes/games.js";
import chatRoutes from './routes/chat.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = Fastify({ logger: true });

app.get("/ok", (req, reply) => {
    sendSuccess(reply, { message: "It works!" });
});

app.register(cors, { origin: true });
app.register(fastifyStatic, { root: path.join(process.cwd(), "public"), prefix: "/" });

app.register(healthRoutes);

try {
  app.register(authRoutes, { prefix: "/api" });
} catch (err) {
  console.error("Failed to register authRoutes:", err);
  process.exit(1);
}

try {
  app.register(gameRoutes, { prefix: "/api" });
} catch (err) {
  console.error("Failed to register gameRoutes:", err);
  process.exit(1);
}

try {
  app.register(chatRoutes, { prefix: "/api" });
} catch (err) {
  console.error("Failed to register chatRoutes:", err);
  process.exit(1);
}

app.ready(err => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log("🛣️ Registered routes:");
  console.log(app.printRoutes());
});

app.get("/", async (request, reply) => {
  return { message: "Welcome to ft_transcendence API", status: "ok" };
});

app.get('/api/test', async () => {
  return { ok: true };
});


const start = async () => {
  try {
    const port = Number(process.env.PORT || 3000);

    await app.ready();

    // Get the underlying HTTP server from Fastify
    const httpServer = app.server;

    setupSocketIO(httpServer);

    // Use Fastify's listen method instead
    await app.listen({ port, host: "0.0.0.0" });

    console.log(`Server running on port ${port}`);

  } catch (err) {
    console.error("Server failed to start:", err);
    process.exit(1);
  }
};

start();
