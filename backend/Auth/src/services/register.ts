import { FastifyReply, FastifyRequest } from "fastify";
import { User } from '../interfaces/user.js'
import { sendSuccess, sendError  } from "../utils/respond.js";
import db from '../db.js';
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import crypto from "crypto";
import UserDTO from "../dto/user.dto.js";
import { validate, ValidationError } from "class-validator";



const registerUser = async (req : FastifyRequest, reply: FastifyReply) =>{
    try {
        const JWT_SECRET = process.env.JWT_SECRET as string;

        const user : UserDTO = req.body as any;

        const erros: ValidationError[] = await validate(user);
        console.log(erros);
        if(erros.length > 0){
            
            const erroMsg = erros.map(erro => {
                return Object.values(erro.constraints as any)[0]; 
            })

            const finalMsg = erroMsg.join('; ');
            // I NEED FIX THIS

            return sendError(reply, `Erro de validação: ${erros}`, 400);
        }


        
        if (!user.username || !user.password || !user.email) 
            return sendError(reply, "Username, password and email are required", 400);
        
        const rawUser: any = await db.raw("SELECT * FROM users WHERE username = ? OR email = ? LIMIT 1", [user.username, user.email]);
       
        const existingUser: User | null = Array.isArray(rawUser[0]) ? rawUser[0][0] ?? null : rawUser[0] ?? null;
       
        if (existingUser) 
            return sendError(reply, `Username or email already exists`, 409);

        const passwordHash = await bcrypt.hash(user.password, 10);
        const id = crypto.randomUUID();
        
        await db.raw("INSERT INTO users (id, username, passwordHash, email, online) VALUES (?, ?, ?, ?, ?)", [ id, user.username, passwordHash, user.email, false,]);
        const username = user.username
        // JWT & Refresh token
        const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: "1h" });
        const refreshToken = crypto.randomBytes(64).toString("hex");
        const expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        await db.raw("INSERT INTO refresh_tokens (username, token, expires_at) VALUES (?, ?, ?)", [username, refreshToken, expires_at]);

        // Return token + QR in same response
        sendSuccess(reply, { token, refreshToken, message: "User registered successfully. Scan the QR for 2FA." }, 201);
  } catch (err: any) {
        sendError(reply, "Internal server error", 500);
  }
}

export default registerUser;