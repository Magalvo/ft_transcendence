
import { FastifyReply, FastifyRequest } from "fastify";
import { sendSuccess, sendError  } from "../utils/respond.js";
import { RefreshToken } from "../interfaces/token.js"
import db from "../db.js";
import jwt from "jsonwebtoken";

const refreshToken = async (req: FastifyRequest, reply : FastifyReply) =>{
     try {
            const JWT_SECRET = process.env.JWT_SECRET as string;

            
            const { refreshToken } = req.body as { refreshToken: string };
            const rawStored: any = await db.raw("SELECT * FROM refresh_tokens WHERE token = ? LIMIT 1", [refreshToken]);
            const stored: RefreshToken | undefined = Array.isArray(rawStored[0]) ? rawStored[0][0] : undefined;
    
            if (!stored || new Date(stored.expires_at) < new Date()) 
                return sendError(reply, "Invalid or expired token", 401);
    
            const newToken = jwt.sign({ username: stored.username }, JWT_SECRET, { expiresIn: "1h" });
            sendSuccess(reply, { token: newToken });
        } catch (err: any) {
            sendError(reply, "Internal server error", 500);
        }
}

export default refreshToken;