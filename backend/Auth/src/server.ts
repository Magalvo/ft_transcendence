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
import { create } from "domain";
import { setupSocketIO } from "./socket/index.js";
import { createServer } from "http";
import gameRoutes from "./routes/games.js";

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

app.ready(err => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log("🛣️ Registered routes:");
  console.log(app.printRoutes());
});

app.get("/", async (request, reply) => {
  return reply.sendFile("index.html");
});


const start = async () => {
  try {
    const port = Number(process.env.PORT || 3000);

    await app.ready();

    const httpServer = createServer(app.server);

    setupSocketIO(httpServer);

    httpServer.listen(port, "0.0.0.0", () => {
      console.log(`Server running on port ${port}`);
    });

  } catch (err) {
    console.error("Server failed to start:", err);
    process.exit(1);
  }
};

start();
