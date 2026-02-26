import jwt from "jsonwebtoken";
import { FastifyReply, FastifyRequest } from "fastify";
import db from "../db.js";
import { sendError } from "../utils/respond.js";

const authenticate = async (
  req: FastifyRequest,
  reply: FastifyReply
) => {
  const accessToken: string | undefined = req.cookies["token"];

  if (!accessToken) {
    return sendError(reply, "Invalid or expired token", 401);
  }

  try {
    const JWT_SECRET = process.env.JWT_SECRET as string;
    const decoded: any = jwt.verify(accessToken, JWT_SECRET);

    const userId: string = decoded.userId;

    // atualizar last_request (ok 👍)
    await db.raw(
      "UPDATE users SET last_request = ? WHERE id = ?",
      [new Date().toISOString(), userId]
    );

    // 🔑 MUITO IMPORTANTE
    (req as any).user = {
      id: userId,
      email: decoded.email,
    };

    // ⛔ NÃO devolver resposta
    return;
  } catch (jwtError: any) {
    if (jwtError.name === "TokenExpiredError") {
      return sendError(reply, "Token expired, please refresh", 401);
    }

    if (jwtError.name === "JsonWebTokenError") {
      return sendError(reply, "Invalid token signature", 401);
    }

    throw jwtError;
  }
};

export default authenticate;
