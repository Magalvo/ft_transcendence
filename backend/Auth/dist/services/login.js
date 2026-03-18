import { sendSuccess, sendError } from "../utils/respond.js";
import db from '../db.js';
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import crypto from "crypto";
import speakeasy from "speakeasy";
import UserLoginDTO from "../dto/user.dto.js";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
const Login = async (req, reply) => {
    try {
        const JWT_SECRET = process.env.JWT_SECRET;
        const user = plainToInstance(UserLoginDTO, req.body);
        // Isto pode se tornar uma funcao utilitaria verifica no register que tem uma igual
        const erros = await validate(user);
        if (erros.length > 0) {
            const erroMsg = erros.map(erro => {
                return erro.constraints ? Object.values(erro.constraints)[0] : 'Unknow Error';
            });
            const finalMsg = erroMsg.join('; ');
            return sendError(reply, `: ${finalMsg}`, 401);
        }
        const rawUser = await db.raw("SELECT id, username, email, passwordHash, twoFactorSecret FROM users WHERE username = ? LIMIT 1", [user.username]);
        const userDB = Array.isArray(rawUser[0]) ? rawUser[0][0] ?? null : rawUser[0] ?? null;
        if (!userDB || !userDB.passwordHash)
            return sendError(reply, "Invalid credentials", 401);
        const valid = await bcrypt.compare(user.password, userDB.passwordHash);
        if (!valid)
            return sendError(reply, "Invalid credentials", 401);
        if (userDB.twoFactorSecret) {
            if (!user.twoFactorCode)
                return sendError(reply, "2FA code required", 400);
            const verified = speakeasy.totp.verify({ secret: userDB.twoFactorSecret, encoding: "base32", token: user.twoFactorCode });
            if (!verified)
                return sendError(reply, "Invalid 2FA code", 401);
        }
        const userId = userDB.id;
        const userEmail = userDB.email;
        const token = jwt.sign({ userId: userId, email: userEmail }, JWT_SECRET, { expiresIn: "1h" });
        const refreshToken = crypto.randomBytes(64).toString("hex");
        const expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        const last_update = new Date().toISOString();
        // Try to update existing refresh token, or insert if not exists
        const existingToken = await db.raw("SELECT id FROM refresh_tokens WHERE userId = ? LIMIT 1", [userId]);
        if (Array.isArray(existingToken[0]) && existingToken[0][0]) {
            await db.raw("UPDATE refresh_tokens SET token = ?, expires_at = ?, last_update = ? WHERE userId = ?", [refreshToken, expires_at, last_update, userId]);
        }
        else {
            const username = userDB.username;
            await db.raw("INSERT INTO refresh_tokens (username, userId, token, expires_at, last_update) VALUES (?, ?, ?, ?, ?)", [username, userId, refreshToken, expires_at, last_update]);
        }
        // Update user status
        await db.raw("UPDATE users SET online = ?, last_request = ? WHERE id = ?", [true, last_update, userId]);
        sendSuccess(reply, { token, refreshToken });
    }
    catch (err) {
        console.log(err);
        sendError(reply, "Internal server error", 500);
    }
};
export default Login;
