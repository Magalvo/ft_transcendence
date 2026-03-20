import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyCookie from "@fastify/cookie";
import dotenv from "dotenv";
import path from "path";
import fastifyStatic from "@fastify/static";

import healthRoutes from "./routes/health.js";
import authRoutes from "./routes/auth.js";
import { sendSuccess } from "./utils/respond.js";
import { readConfigValue } from "./utils/env.js";
import "reflect-metadata";
import { setupSocketIO } from "./socket/index.js";
import gameRoutes from "./routes/games.js";
import chatRoutes from "./routes/chat.js";
import tournamentRoutes from "./routes/tournament.js";
import { CONFIG } from "./game/config.js";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const JWT_SECRET = readConfigValue("JWT_SECRET");
if (!JWT_SECRET) {
  console.error("FATAL: JWT_SECRET is not defined. Authentication will not work.");
  process.exit(1);
}
process.env.JWT_SECRET = JWT_SECRET;

const app = Fastify({ logger: true });
app.hasMultipart = false;

app.get("/ok", (_req, reply) => {
  sendSuccess(reply, { message: "It works!" });
});

app.register(cors, { origin: true });
app.register(fastifyCookie);
app.register(fastifyStatic, {
  root: path.join(process.cwd(), "public"),
  prefix: "/",
});

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

try {
  app.register(tournamentRoutes, { prefix: "/api" });
} catch (err) {
  console.error("Failed to register tournamentRoutes:", err);
  process.exit(1);
}

app.get("/", async () => {
  return { message: "Welcome to ft_transcendence API", status: "ok" };
});

app.get("/api/test", async () => {
  return { ok: true };
});

async function importOptionalModule<T>(specifier: string): Promise<T | null> {
  try {
    return (await import(specifier)) as T;
  } catch (error: any) {
    if (
      error?.code === "ERR_MODULE_NOT_FOUND" ||
      error?.code === "MODULE_NOT_FOUND"
    ) {
      return null;
    }

    throw error;
  }
}

async function registerOptionalMultipartPlugin() {
  const multipartModule = await importOptionalModule<{ default?: unknown }>(
    "@fastify/multipart",
  );

  if (!multipartModule?.default) {
    app.log.warn(
      "Skipping multipart plugin registration because @fastify/multipart is not installed in this workspace.",
    );
    return;
  }

  app.register(multipartModule.default as any, {
    limits: { fileSize: 10 * 1024 * 1024 },
  });
  app.hasMultipart = true;
}

const start = async () => {
  try {
    const port = Number(process.env.PORT ?? CONFIG.PORT);

    await registerOptionalMultipartPlugin();
    await app.ready();
    console.log("Registered routes:");
    console.log(app.printRoutes());

    const httpServer = app.server;
    const { io, getRuntimeMetrics } = setupSocketIO(httpServer);
    app.io = io;
    app.getRealtimeMetrics = getRuntimeMetrics;

    await app.listen({ port, host: "0.0.0.0" });

    console.log(`Server running on port ${port}`);
  } catch (err) {
    console.error("Server failed to start:", err);
    process.exit(1);
  }
};

start();
