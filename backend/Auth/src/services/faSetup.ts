import { FastifyReply, FastifyRequest } from "fastify";
import { sendSuccess, sendError} from "../utils/respond.js";
import { User } from '../interfaces/user.js'
import speakeasy from "speakeasy";
import qrcode from "qrcode";
import db from '../db.js';


const faSetup =  async (req: FastifyRequest, reply : FastifyReply) => {
    
  try {
    const user = (req as any).user;
    
    if (!user || !user.id) 
      return sendError(reply, "Unauthorized", 401);

    const rawUser: any = await db.raw("SELECT * FROM users WHERE id = ? LIMIT 1", [user.id]);
    const userData: User | null = Array.isArray(rawUser[0]) ? rawUser[0][0] ?? null : rawUser[0] ?? null;
    if (!userData) 
      return sendError(reply, "User not found", 404);

    const secret = speakeasy.generateSecret({ name: `FT Transcendence (${userData.username})` });
    await db.raw("UPDATE users SET tempTwoFactorSecret = ? WHERE id = ?", [secret.base32, userData.id]);

    const otpauthUrl = secret.otpauth_url ?? speakeasy.otpauthURL({
      secret: secret.base32,
      label: `FT Transcendence (${userData.username})`,
      encoding: "base32",
    });

    const qr = await qrcode.toDataURL(otpauthUrl);

    return sendSuccess(reply, { qr, secret: secret.base32, message: "Scan this QR code with your authenticator app" });
  } catch (err: any) {
    return sendError(reply, "Internal server error", 500);
  }



}

export default faSetup;