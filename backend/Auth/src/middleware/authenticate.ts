import jwt from "jsonwebtoken";
import { FastifyReply, FastifyRequest } from "fastify";
import db from "../db.js";
import { sendError } from "../utils/respond.js";
import { readBearerToken, verifyAccessToken } from "../utils/tokens.js";

// Presence is derived from last_request with a 60s window, so refreshing it
// at most every 30s per user keeps it accurate without a DB write per request.
const PRESENCE_WRITE_INTERVAL_MS = 30_000;
const lastPresenceWrite = new Map<string, number>();

async function touchPresence(userId: string): Promise<void> {
  const now = Date.now();
  const last = lastPresenceWrite.get(userId) ?? 0;
  if (now - last < PRESENCE_WRITE_INTERVAL_MS) return;
  lastPresenceWrite.set(userId, now);

  await db.raw(
    "UPDATE users SET last_request = ?, online = ? WHERE id = ?",
    [new Date(now).toISOString(), true, userId]
  );
}

const authenticate = async (
  req: FastifyRequest,
  reply: FastifyReply
) => {
  const cookieToken: string | undefined = req.cookies["token"];
  const accessToken = cookieToken || readBearerToken(req.headers.authorization);

  if (!accessToken) {
    return sendError(reply, "Invalid or expired token", 401);
  }

  try {
    const { userId, email } = verifyAccessToken(accessToken);

    await touchPresence(userId);

    (req as any).user = {
      id: userId,
      email,
    };

    return;
  } catch (jwtError: any) {
    if (jwtError instanceof jwt.TokenExpiredError) {
      return sendError(reply, "Token expired, please refresh", 401);
    }

    if (jwtError instanceof jwt.JsonWebTokenError) {
      return sendError(reply, "Invalid token signature", 401);
    }

    throw jwtError;
  }
};

export default authenticate;
