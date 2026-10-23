import { FastifyReply, FastifyRequest } from "fastify";
import { sendSuccess, sendError} from "../utils/respond.js";
import { User } from "../interfaces/user.js";
import crypto from "crypto";
import { sendMail } from "../utils/email.js";
import db from '../db.js';
import { hashToken } from "../utils/tokens.js";
import { getFrontendBaseUrl } from "../utils/frontendUrl.js";

const forgotPass = async (req: FastifyRequest, reply : FastifyReply) => {

     try {
      const { email } = req.body as { email: string };
      const normalizedEmail = String(email || "").trim();
      if (!normalizedEmail) {
        return sendError(reply, "Email is required", 400);
      }

      const rawUser: any = await db.raw(
        "SELECT id, email FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1",
        [normalizedEmail],
      );
      const user: User | null = Array.isArray(rawUser[0]) ? rawUser[0][0] ?? null : rawUser[0] ?? null;

      // Return a generic success message even when the email does not exist.
      // This avoids account enumeration and keeps the UX consistent.
      if (!user)
        return sendSuccess(reply, { message: "If the account exists, a password reset email has been sent" });

      const token = crypto.randomBytes(32).toString("hex");
      const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();

      await db.raw("UPDATE users SET resetToken = ?, resetExpires = ? WHERE id = ?", [hashToken(token), expires, user.id]);
      
      const frontendBaseUrl = getFrontendBaseUrl();
      const link = `${frontendBaseUrl}/reset-password?token=${token}`;
      try {
        const recipientEmail = String((user as any).email || normalizedEmail).trim();
        await sendMail(recipientEmail, "Password Reset", `<p>Click here to reset your password:</p><a href="${link}">${link}</a>`);
      } catch (mailErr) {
        // Dev-friendly fallback when SMTP isn't configured or temporarily fails.
        console.warn("[forgotPass] Could not send reset email; generated link:", link);
        console.warn("[forgotPass] Mail error:", mailErr);
      }

      return sendSuccess(reply, { message: "If the account exists, a password reset email has been sent" });
    } catch (err: any) {
      console.error("[forgotPass] Unexpected error:", err);
      return sendError(reply, "Internal server error", 500);
    }
}

export default forgotPass;
