
import { sendSuccess, sendError  } from "../utils/respond.js";
import { FastifyReply, FastifyRequest } from "fastify";
import db from '../db.js';
import { User } from '../interfaces/user.js'
import bcrypt from "bcrypt";

const resetPass =  async (req: FastifyRequest, reply : FastifyReply) =>{
    try {
      const { token, newPassword } = req.body as { token: string; newPassword: string };
      if (!token || !newPassword) 
        return sendError(reply, "Token and new password are required", 400);

      const rawUser: any = await db.raw("SELECT * FROM users WHERE resetToken = ? LIMIT 1", [token]);
      const user: User | null = Array.isArray(rawUser[0]) ? rawUser[0][0] ?? null : rawUser[0] ?? null;

      if (!user) return sendError(reply, "Invalid token", 400);
      if (!user.resetExpires || new Date(user.resetExpires) < new Date()) 
        return sendError(reply, "Token expired", 400);

      const passwordHash = await bcrypt.hash(newPassword, 10);
      await db.raw("UPDATE users SET passwordHash = ?, resetToken = NULL, resetExpires = NULL WHERE id = ?", [passwordHash, user.id]);

      sendSuccess(reply, { message: "Password has been reset successfully" });
    } catch (err: any) {
      sendError(reply, "Internal server error", 500);
    }
}

export default resetPass;