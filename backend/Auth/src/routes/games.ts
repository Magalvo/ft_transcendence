import type { FastifyInstance } from "fastify";
import jwt from "jsonwebtoken";
import db from "../db.js";
import createGame from "../services/createGame.js";
import auth from "../middleware/authenticate.js";
import getMyGames from "../services/getMyGames.js";
import { sendError } from "../utils/respond.js";

export default async function gameRoutes(app: FastifyInstance) {
  app.post("/games", async (req, reply) => {
    return await createGame(req, reply);
  });

  app.get(
    "/games/me",
    { preHandler: auth },
    async (req, reply) => {
      return await getMyGames(req, reply);
    },
  );

  app.get(
    "/games/spacedout/session",
    { preHandler: auth },
    async (req, reply) => {
      try {
        const userId = (req as any).user?.id as string | undefined;
        if (!userId) {
          return sendError(reply, "Unauthorized", 401);
        }

        const user = await db("users")
          .select("id", "username", "email")
          .where({ id: userId })
          .first();

        if (!user) {
          return sendError(reply, "User not found", 404);
        }

        const JWT_SECRET = process.env.JWT_SECRET;
        if (!JWT_SECRET) {
          return sendError(reply, "JWT secret is not configured", 500);
        }

        const expiresInSeconds = 15 * 60;
        const token = jwt.sign(
          {
            userId: user.id,
            username: user.username,
            email: user.email,
            purpose: "spacedout-session",
          },
          JWT_SECRET,
          { expiresIn: expiresInSeconds },
        );

        return {
          token,
          expiresInSeconds,
          wsUrl: process.env.SPACEDOUT_WS_URL || "ws://localhost:3030",
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
          },
        };
      } catch (err: any) {
        app.log.error(err);
        return sendError(reply, err.message || "Failed to create SpacedOut session", 500);
      }
    },
  );
}
