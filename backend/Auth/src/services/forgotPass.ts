import { FastifyReply, FastifyRequest } from "fastify";
import { sendSuccess, sendError} from "../utils/respond.js";
import { User } from "../interfaces/user.js";
import crypto from "crypto";
import { sendMail } from "../utils/email.js";
import db from '../db.js';

function getHeaderValue(value: unknown): string {
  if (Array.isArray(value)) return value[0] ?? "";
  if (typeof value === "string") return value;
  return "";
}

function getFrontendBaseUrl(headers: Record<string, unknown>): string {
  const forwardedProto = getHeaderValue(headers["x-forwarded-proto"]).trim();
  const forwardedHost = getHeaderValue(headers["x-forwarded-host"]).trim();
  const origin = getHeaderValue(headers["origin"]).trim();

  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  if (origin) {
    return origin.replace(/\/+$/g, "");
  }

  return (process.env.FRONTEND_URL || "https://localhost:8443").replace(/\/+$/g, "");
}

const forgotPass = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const body = req.body as { email?: string };

    if (!body?.email) {
      return sendError(reply, "Email is required", 400);
    }

    const { email } = body;

    const rawUser: any = await db.raw(
      "SELECT * FROM users WHERE email = ? LIMIT 1",
      [email]
    );

    console.log("rawUser:", rawUser);

    const user = Array.isArray(rawUser[0])
      ? rawUser[0][0]
      : rawUser[0];

    if (!user) {
      return sendError(reply, "User not found", 404);
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    await db.raw(
      "UPDATE users SET resetToken = ?, resetExpires = ? WHERE email = ?",
      [token, expires, email]
    );

    const frontendBaseUrl = getFrontendBaseUrl(
      req.headers as Record<string, unknown>
    );

    const link = `https://localhost:8443/reset-password?token=${token}`;

    await sendMail(
      email,
      "Password Reset",
      `<p>Click here to reset your password:</p><a href="${link}">${link}</a>`
    );

    return sendSuccess(reply, { message: "Password reset email sent" });

  } catch (err: any) {
    console.error("ForgotPass error:", err);
    return sendError(reply, err.message || "Internal server error", 500);
  }
};

export default forgotPass;
