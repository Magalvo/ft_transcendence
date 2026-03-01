import { sendSuccess, sendError } from "../utils/respond.js";
import speakeasy from "speakeasy";
import qrcode from "qrcode";
import db from '../db.js';
import authenticate from "../middleware/authenticate.js";
const faSetup = async (req, reply) => {
    try {
        await authenticate(req, reply);
        const user = req.user;
        if (!user || !user.id)
            return sendError(reply, "Unauthorized", 401);
        const rawUser = await db.raw("SELECT * FROM users WHERE id = ? LIMIT 1", [user.id]);
        const userData = Array.isArray(rawUser[0]) ? rawUser[0][0] ?? null : rawUser[0] ?? null;
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
    }
    catch (err) {
        return sendError(reply, "Internal server error", 500);
    }
};
export default faSetup;
