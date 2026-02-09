import { FastifyReply, FastifyRequest } from "fastify";
import { sendSuccess, sendError} from "../utils/respond.js";
import { User } from '../interfaces/user.js'
import speakeasy from "speakeasy";
import qrcode from "qrcode";
import db from '../db.js';
import authenticate from "../middleware/authenticate.js";


const faSetup =  async (req: FastifyRequest, reply : FastifyReply) => {
    
  try {
    const decoded = await authenticate(req, reply);
    if (!decoded)
       return;

    const rawUser: any = await db.raw("SELECT * FROM users WHERE username = ? LIMIT 1", [decoded.username]);
    const user: User | null = Array.isArray(rawUser[0]) ? rawUser[0][0] ?? null : rawUser[0] ?? null;
   
    if (!user) 
      return sendError(reply, "User not found", 404);

    const secret = speakeasy.generateSecret({ name: `FT Transcendence (${user.username})` });
    await db.raw("UPDATE users SET tempTwoFactorSecret = ? WHERE username = ?", [secret.base32, user.username]);

    const otpauthUrl = secret.otpauth_url ?? speakeasy.otpauthURL({
      secret: secret.base32,
      label: `FT Transcendence (${user.username})`,
      encoding: "base32",
    });

    const qr = await qrcode.toDataURL(otpauthUrl);

    return sendSuccess(reply, { qr, secret: secret.base32, message: "Scan this QR code with your authenticator app" });
  } catch (err: any) {
    return sendError(reply, "Internal server error", 500);
  }



}

export default faSetup;