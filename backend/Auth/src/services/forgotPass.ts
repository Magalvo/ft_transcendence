import { FastifyReply, FastifyRequest } from "fastify";
import { sendSuccess, sendError} from "../utils/respond.js";
import { User } from "../interfaces/user.js";
import crypto from "crypto";
import { sendMail } from "../utils/email.js";
import db from '../db.js';

const forgotPass = async (req: FastifyRequest, reply : FastifyReply) => {

     try {
      const { email } = req.body as { email: string };
      const rawUser: any = await db.raw("SELECT * FROM users WHERE email = ? LIMIT 1", [email]);
      const user: User | null = Array.isArray(rawUser[0]) ? rawUser[0][0] ?? null : rawUser[0] ?? null;

      if (!user) 
        return sendError(reply, "User not found", 404);

      const token = crypto.randomBytes(32).toString("hex");
      const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();

      await db.raw("UPDATE users SET resetToken = ?, resetExpires = ? WHERE email = ?", [token, expires, email]);
     // Dont make sense we see the local host , wee need put this in env, anywhere if use localhost we need change to a .env variable
      const link = `http://localhost:3000/reset-password.html?token=${token}`;
      await sendMail(email, "Password Reset", `<p>Click here to reset your password:</p><a href="${link}">${link}</a>`);

      sendSuccess(reply, { message: "Password reset email sent" });
    } catch (err: any) {
      sendError(reply, "Internal server error", 500);
    }


}

export default forgotPass;