import jwt from "jsonwebtoken";
import { FastifyReply, FastifyRequest } from "fastify";
import db from "../db.js";
import { sendError } from "../utils/respond.js";
import { readBearerToken, verifyAccessToken } from "../utils/tokens.js";

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

    await db.raw(
      "UPDATE users SET last_request = ?, online = ? WHERE id = ?",
      [new Date().toISOString(), true, userId]
    );

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
