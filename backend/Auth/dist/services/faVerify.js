import { sendSuccess, sendError } from "../utils/respond.js";
import speakeasy from "speakeasy";
import db from '../db.js';
import authenticate from "../middleware/authenticate.js";
const faVerify = async (req, reply) => {
    try {
        await authenticate(req, reply);
        const user = req.user;
        if (!user || !user.id)
            return sendError(reply, "Unauthorized", 401);
        const { code } = req.body;
        const rawUser = await db.raw("SELECT * FROM users WHERE id = ? LIMIT 1", [user.id]);
        const userData = Array.isArray(rawUser[0]) ? rawUser[0][0] ?? null : rawUser[0] ?? null;
        if (!userData || !userData.tempTwoFactorSecret)
            return sendError(reply, "No 2FA setup in progress", 400);
        const verified = speakeasy.totp.verify({
            secret: userData.tempTwoFactorSecret,
            encoding: "base32",
            token: code,
            window: 1,
        });
        if (!verified)
            return sendError(reply, "Invalid code", 401);
        await db.raw("UPDATE users SET twoFactorSecret = ?, tempTwoFactorSecret = NULL WHERE id = ?", [
            userData.tempTwoFactorSecret,
            userData.id,
        ]);
        sendSuccess(reply, { message: "2FA enabled successfully" });
    }
    catch (err) {
        sendError(reply, "Internal server error", 500);
    }
};
export default faVerify;
