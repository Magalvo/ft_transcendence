import { FastifyReply, FastifyRequest } from "fastify";
import { User } from '../interfaces/user.js'
import { sendSuccess, sendError  } from "../utils/respond.js";
import db from '../db.js';
import bcrypt from "bcrypt";
import crypto from "crypto";
import UserRegisterDTO from "../dto/userRegister.dto.js";
import { validate, ValidationError } from "class-validator";
import { plainToInstance } from "class-transformer";
import { issueSession } from "./session.js";



const registerUser = async (req : FastifyRequest, reply: FastifyReply) =>{
    try {
        const user : UserRegisterDTO = plainToInstance(UserRegisterDTO,req.body);

        const erros: ValidationError[] = await validate(user);

       if(erros.length > 0){
            const erroMsg = erros.map(erro => {
                return erro.constraints ? Object.values(erro.constraints)[0] : 'Unknow Error';
            });
            const finalMsg = erroMsg.join('; ');
            return sendError(reply, finalMsg, 400);
        }



        if (!user.username || !user.password || !user.email)
            return sendError(reply, "Username, password and email are required", 400);

        if (user.acceptTerms !== true)
            return sendError(reply, "You must accept the terms and conditions", 400);

        const rawUser: any = await db.raw("SELECT * FROM users WHERE username = ? OR email = ? LIMIT 1", [user.username, user.email]);

        const existingUser: User | null = Array.isArray(rawUser[0]) ? rawUser[0][0] ?? null : rawUser[0] ?? null;

        if (existingUser)
            return sendError(reply, `Username or email already exists`, 409);

        const passwordHash = await bcrypt.hash(user.password, 10);
        const id = crypto.randomUUID();
        const last_update = new Date().toISOString();

        await db.raw("INSERT INTO users (id, username, passwordHash, email, online, last_request, accepted_terms) VALUES (?, ?, ?, ?, ?,?,?)", [ id, user.username, passwordHash, user.email, true, last_update, user.acceptTerms]);

        const { token, refreshToken } = await issueSession({ id, username: user.username, email: user.email });

        // Return token + QR in same response
        sendSuccess(reply, { token, refreshToken, message: "User registered successfully. Scan the QR for 2FA." }, 201);
  } catch (err: any) {
        console.error("REGISTER ERROR:", err);
        sendError(reply, "Internal server error", 500);
  }
}

export default registerUser;
