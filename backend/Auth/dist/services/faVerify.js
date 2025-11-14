import { sendSuccess, sendError } from "../utils/respond.js";
import speakeasy from "speakeasy";
import db from '../db.js';
import authenticate from "../middleware/authenticate.js";
const faVerify = async (req, reply) => {
    try {
        const decoded = await authenticate(req, reply);
        if (!decoded)
            return;
        const { code } = req.body;
        const rawUser = await db.raw("SELECT * FROM users WHERE username = ? LIMIT 1", [decoded.username]);
        const user = Array.isArray(rawUser[0]) ? rawUser[0][0] ?? null : rawUser[0] ?? null;
        if (!user || !user.tempTwoFactorSecret)
            return sendError(reply, "No 2FA setup in progress", 400);
        const verified = speakeasy.totp.verify({
            secret: user.tempTwoFactorSecret,
            encoding: "base32",
            token: code,
            window: 1,
        });
        if (!verified)
            return sendError(reply, "Invalid code", 401);
        await db.raw("UPDATE users SET twoFactorSecret = ?, tempTwoFactorSecret = NULL WHERE username = ?", [
            user.tempTwoFactorSecret,
            user.username,
        ]);
        sendSuccess(reply, { message: "2FA enabled successfully" });
    }
    catch (err) {
        sendError(reply, "Internal server error", 500);
    }
};
export default faVerify;
