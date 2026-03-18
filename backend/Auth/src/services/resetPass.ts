
import { sendSuccess, sendError  } from "../utils/respond.js";
import { FastifyReply, FastifyRequest } from "fastify";
import db from '../db.js';
import { User } from '../interfaces/user.js';

import bcrypt from "bcrypt";
import { plainToInstance } from "class-transformer";
import  userResetPassDTO  from "../dto/userResetPass.dto.js"
import { validate, ValidationError } from "class-validator";

const resetPass = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const body = req.body ?? {};
    const user = plainToInstance(userResetPassDTO, body);

    const errors = await validate(user);

    if (errors.length > 0) {
      const messages = errors.map(e =>
        e.constraints ? Object.values(e.constraints)[0] : "Unknown error"
      );
      return sendError(reply, messages.join("; "), 400);
    }

    const rawUser: any = await db.raw(
      "SELECT id, resetToken, resetExpires FROM users WHERE resetToken = ? LIMIT 1",
      [user.resetToken]
    );

    const userData = Array.isArray(rawUser[0])
      ? rawUser[0][0]
      : rawUser[0];

    if (
      !userData ||
      !userData.resetExpires ||
      new Date(userData.resetExpires) < new Date()
    ) {
      return sendError(reply, "Invalid or expired reset token", 400);
    }

    const passwordHash = await bcrypt.hash(user.newPassword, 10);

    await db.raw(
      "UPDATE users SET passwordHash = ?, resetToken = NULL, resetExpires = NULL WHERE id = ?",
      [passwordHash, userData.id]
    );

    return sendSuccess(reply, {
      message: "Password has been reset successfully",
    });

  } catch (err: any) {
    console.error("ResetPass error:", err);
    return sendError(reply, err.message || "Internal server error", 500);
  }
};

export default resetPass;