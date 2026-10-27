import { FastifyReply, FastifyRequest } from "fastify";
import { sendSuccess, sendError  } from "../utils/respond.js";
import db from '../db.js';
import bcrypt from "bcrypt";
import UserLoginDTO from "../dto/user.dto.js";
import { plainToInstance } from "class-transformer";
import { validate, ValidationError } from "class-validator";
import UserDBDTO from "../dto/userDB.dto.js";
import { issueSession } from "./session.js";
import { createRateLimiter, rejectIfLimited } from "../utils/rateLimit.js";
import { consumeTotp } from "../utils/totp.js";

// Compared against when the account does not exist (or has no password, e.g.
// Google-only), so every failed login costs one bcrypt comparison and response
// times do not reveal which usernames exist. Same cost factor as real hashes.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync("timing-equalizer-not-a-password", 10);

const loginIpLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 30 });
const loginAccountLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 10 });

const Login = async (req: FastifyRequest, reply : FastifyReply) => {

  try {
        const user : UserLoginDTO = plainToInstance(UserLoginDTO, req.body);

        // Isto pode se tornar uma funcao utilitaria verifica no register que tem uma igual
        const erros: ValidationError[] = await validate(user);
        if(erros.length > 0){
            const erroMsg = erros.map(erro => {
                return erro.constraints ? Object.values(erro.constraints)[0] : 'Unknow Error';
            });
            const finalMsg = erroMsg.join('; ');
            return sendError(reply, finalMsg, 400);
        }

        const accountKey = `login:${String(user.username).toLowerCase()}`;
        if (rejectIfLimited(loginIpLimiter, `login:${req.ip}`, reply)) return;
        if (rejectIfLimited(loginAccountLimiter, accountKey, reply)) return;

        const rawUser: any = await db.raw("SELECT id, username, email, passwordHash, twoFactorSecret FROM users WHERE username = ? LIMIT 1", [user.username]);
        const userDB : UserDBDTO | null = Array.isArray(rawUser[0]) ? rawUser[0][0] ?? null : rawUser[0] ?? null;

        if (!userDB || !userDB.passwordHash) {
            await bcrypt.compare(user.password, DUMMY_PASSWORD_HASH);
            return sendError(reply, "Invalid credentials", 401);
        }

        const valid = await bcrypt.compare(user.password, userDB.passwordHash);

        if (!valid)
            return sendError(reply, "Invalid credentials", 401);

        if (userDB.twoFactorSecret) {
            if (!user.twoFactorCode)
                return sendError(reply, "2FA code required", 400);

            const verified = await consumeTotp(userDB.id, userDB.twoFactorSecret, user.twoFactorCode);
            if (!verified)
                return sendError(reply, "Invalid 2FA code", 401);
        }

        loginAccountLimiter.reset(accountKey);

        const { token, refreshToken } = await issueSession(userDB);

        sendSuccess(reply, { token, refreshToken });
    } catch (err: any) {
        console.log(err )
        sendError(reply, "Internal server error", 500);
    }
}

export default Login;