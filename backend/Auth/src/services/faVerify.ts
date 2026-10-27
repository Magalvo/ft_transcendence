import { FastifyReply, FastifyRequest } from "fastify";
import { sendSuccess, sendError} from "../utils/respond.js";
import { User } from '../interfaces/user.js'
import db from '../db.js';
import { consumeTotp } from "../utils/totp.js";



const faVerify = async (req: FastifyRequest, reply : FastifyReply) => {
    try {
        const user = (req as any).user;
      
      if (!user || !user.id)
        return sendError(reply, "Unauthorized", 401);

      const { code } = req.body as { code: string };
      
      const rawUser: any = await db.raw("SELECT * FROM users WHERE id = ? LIMIT 1", [user.id]);
      const userData: User | null = Array.isArray(rawUser[0]) ? rawUser[0][0] ?? null : rawUser[0] ?? null;

      if (!userData || !userData.tempTwoFactorSecret) 
        return sendError(reply, "No 2FA setup in progress", 400);

      const verified = await consumeTotp(userData.id, userData.tempTwoFactorSecret, code);

      if (!verified) 
        return sendError(reply, "Invalid code", 401);

      await db.raw("UPDATE users SET twoFactorSecret = ?, tempTwoFactorSecret = NULL WHERE id = ?", [
        userData.tempTwoFactorSecret,
        userData.id,
      ]);

      sendSuccess(reply, { message: "2FA enabled successfully" });
    } catch (err: any) {
      sendError(reply, "Internal server error", 500);
    }
}

export default faVerify;