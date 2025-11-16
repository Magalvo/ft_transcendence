import { FastifyReply, FastifyRequest } from "fastify";
import { sendSuccess, sendError  } from "../utils/respond.js";
import db from '../db.js';
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import crypto from "crypto";
import speakeasy from "speakeasy";
import userDTO from "../dto/user.dto.js";
import { plainToInstance } from "class-transformer";
import { validate, ValidationError } from "class-validator";
import userDBDTO from "../dto/userDB.dto.js";





const Login = async (req: FastifyRequest, reply : FastifyReply) => {

  try {
        const JWT_SECRET = process.env.JWT_SECRET as string;
        const user : userDTO = plainToInstance(userDTO,req.body);

        // Isto pode se tornar uma funcao utilitaria verifica no register que tem uma igual
        const erros: ValidationError[] = await validate(user);
        if(erros.length > 0){
            const erroMsg = erros.map(erro => {
                return erro.constraints ? Object.values(erro.constraints)[0] : 'Unknow Error'; 
            });
            const finalMsg = erroMsg.join('; ');
            return sendError(reply, `: ${finalMsg}`, 401);
        }
       
       
        const rawUser: any = await db.raw("SELECT id,username ,passwordHash ,twoFactorSecret  FROM users WHERE username = ? LIMIT 1", [user.username]);
        const userDB : userDBDTO | null = Array.isArray(rawUser[0]) ? rawUser[0][0] ?? null : rawUser[0] ?? null;

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
   
        const token = jwt.sign({ userId : userId }, JWT_SECRET, { expiresIn: "1h" });
        const refreshToken = crypto.randomBytes(64).toString("hex");
        const expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        const last_update = new Date().toISOString();



        await db.raw("UPDATE refresh_tokens SET token = ?, expires_at = ?, last_update = ? WHERE userId = ?", [refreshToken, expires_at,last_update, userId])

      
        // Maybe we don`t will user online
        await db.raw("UPDATE users SET online = ? , last_request = ? WHERE id = ?", [true, userId, last_update]);

        sendSuccess(reply, { token, refreshToken });
    } catch (err: any) {
        console.log(err )
        sendError(reply, "Internal server error", 500);
    }
}

export default Login;