import { sendSuccess, sendError } from "../utils/respond.js";
import db from '../db.js';
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import crypto from "crypto";
import speakeasy from "speakeasy";
const Login = async (req, reply) => {
    try {
        const JWT_SECRET = process.env.JWT_SECRET;
        const { username, password, twoFactorCode } = req.body;
        const rawUser = await db.raw("SELECT * FROM users WHERE username = ? LIMIT 1", [username]);
        const user = Array.isArray(rawUser[0]) ? rawUser[0][0] ?? null : rawUser[0] ?? null;
        if (!user || !user.passwordHash)
            return sendError(reply, "Invalid credentials", 401);
        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid)
            return;
        sendError(reply, "Invalid credentials", 401);
        if (user.twoFactorSecret) {
            if (!twoFactorCode)
                return sendError(reply, "2FA code required", 400);
            const verified = speakeasy.totp.verify({ secret: user.twoFactorSecret, encoding: "base32", token: twoFactorCode });
            if (!verified)
                return sendError(reply, "Invalid 2FA code", 401);
        }
        const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: "1h" });
        const refreshToken = crypto.randomBytes(64).toString("hex");
        const expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        await db.raw("INSERT INTO refresh_tokens (username, token, expires_at) VALUES (?, ?, ?)", [username, refreshToken, expires_at]);
        await db.raw("UPDATE users SET online = ? WHERE username = ?", [true, username]);
        sendSuccess(reply, { token, refreshToken });
    }
    catch (err) {
        sendError(reply, "Internal server error", 500);
    }
};
export default Login;
