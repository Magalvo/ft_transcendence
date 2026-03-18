
import { sendSuccess, sendError  } from "../utils/respond.js";
import { FastifyReply, FastifyRequest } from "fastify";
import db from '../db.js';
import { User } from '../interfaces/user.js';

import bcrypt from "bcrypt";
import { plainToInstance } from "class-transformer";
import  userResetPassDTO  from "../dto/userResetPass.dto.js"
import { validate, ValidationError } from "class-validator";


const resetPass =  async (req: FastifyRequest, reply : FastifyReply) =>{
    try {
      const user : userResetPassDTO = plainToInstance(userResetPassDTO, req.body);
      const erros : ValidationError[] = await validate(user);

      if (erros.length > 0) { 
         const erroMsg = erros.map(erro => {
                return erro.constraints ? Object.values(erro.constraints)[0] : 'Unknown error'; 
            });
            const finalMsg = erroMsg.join('; ');
            return sendError(reply, finalMsg, 400);
      }

      const resetToken = String(user.resetToken || '').trim();
      if (!resetToken) {
        return sendError(reply, 'Reset token is required', 400);
      }

      // Find user by reset token
      const rawUser: any = await db.raw(
        "SELECT id, resetToken, resetExpires FROM users WHERE resetToken = ? LIMIT 1",
        [resetToken]
      );
      const userData: User | null = Array.isArray(rawUser[0]) ? rawUser[0][0] ?? null : rawUser[0] ?? null;

      if (!userData) 
        return sendError(reply, "Invalid or expired reset token", 400);

      // Check if token has expired and clear stale token.
      if (!userData.resetExpires || new Date(userData.resetExpires) < new Date()) {
        await db.raw(
          "UPDATE users SET resetToken = NULL, resetExpires = NULL WHERE id = ?",
          [userData.id],
        );
        return sendError(reply, "Reset token has expired", 400);
      }

      // Hash new password and update user
      const passwordHash = await bcrypt.hash(user.newPassword, 10);
      await db.raw(
        "UPDATE users SET passwordHash = ?, resetToken = NULL, resetExpires = NULL WHERE id = ?",
        [passwordHash, userData.id]
      );

      return sendSuccess(reply, { message: "Password has been reset successfully" });
    } catch (err: any) {
      console.error('[resetPass] Unexpected error:', err);
      return sendError(reply, "Internal server error", 500);
    }
}

export default resetPass;