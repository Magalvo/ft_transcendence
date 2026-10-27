import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyCookie from "@fastify/cookie";
import path from "path";
import fastifyStatic from "@fastify/static";
import "reflect-metadata";

import healthRoutes from "./routes/health.js";
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import friendRoutes from "./routes/friends.js";
import gameRoutes from "./routes/games.js";
import chatRoutes from "./routes/chat.js";
import tournamentRoutes from "./routes/tournament.js";
import { sendSuccess } from "./utils/respond.js";
import { getAllowedOrigins } from "./utils/frontendUrl.js";

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

// Builds the HTTP app with every route registered but without listening or
// attaching Socket.IO, so tests can drive it with app.inject().
export function buildApp(options: { logger?: boolean } = {}) {
  // nginx overwrites X-Forwarded-For with the real client address, so req.ip
  // is trustworthy for rate limiting.
  const app = Fastify({ logger: options.logger ?? true, trustProxy: true });
  app.hasMultipart = false;

  app.get("/ok", (_req, reply) => {
    sendSuccess(reply, { message: "It works!" });
  });

  app.register(cors, { origin: getAllowedOrigins() });
  app.register(fastifyCookie);
  app.register(fastifyStatic, {
    root: path.join(process.cwd(), "public"),
    prefix: "/",
    // public/ only holds uploaded avatars: never serve anything but images.
    allowedPath: (pathName) => /^\/avatars\/[\w.-]+\.(png|jpe?g|gif|webp)$/i.test(pathName),
    setHeaders: (res) => {
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
    },
  });

  app.register(healthRoutes);
  app.register(gameRoutes, { prefix: "/api" });
  app.register(chatRoutes, { prefix: "/api" });
  app.register(tournamentRoutes, { prefix: "/api" });

  app.get("/", async () => {
    return { message: "Welcome to ft_transcendence API", status: "ok" };
  });

  app.get("/api/test", async () => {
    return { ok: true };
  });

  app.register(async (authScope) => {
    authScope.hasMultipart = false;

    const multipartModule = await importOptionalModule<{ default?: unknown }>(
      "@fastify/multipart",
    );

    if (!multipartModule?.default) {
      authScope.log.warn(
        "Skipping multipart plugin registration because @fastify/multipart is not installed in this workspace.",
      );
    } else {
      authScope.register(multipartModule.default as any, {
        limits: { fileSize: 10 * 1024 * 1024 },
      });
      authScope.hasMultipart = true;
    }

    authScope.register(authRoutes, { prefix: "/api" });
    authScope.register(userRoutes, { prefix: "/api" });
    authScope.register(friendRoutes, { prefix: "/api" });
  });

  return app;
}
