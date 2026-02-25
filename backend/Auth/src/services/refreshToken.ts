
import { FastifyReply, FastifyRequest } from "fastify";
import { sendSuccess, sendError  } from "../utils/respond.js";
import { RefreshToken } from "../interfaces/token.js"
import db from "../db.js";
import jwt from "jsonwebtoken";

const refreshToken = async (req: FastifyRequest, reply : FastifyReply) =>{
    
    try {
            const accesstoken : string | undefined = req.cookies['token'];
    
            if(!accesstoken)
                return sendError(reply,'Invalid or expired token',401);
            
            const JWT_SECRET = process.env.JWT_SECRET as string;
            const decoded: any = jwt.verify(accesstoken, JWT_SECRET);

            const userId : string = decoded.userId;
            
            const refreshtoken : string | undefined = req.cookies['refreshToken'];
            if(!refreshtoken)
                return sendError(reply,'Invalid or expired token',401);
            
            const rawStored: any = await db.raw("SELECT token, expires_at FROM refresh_tokens WHERE userId = ? LIMIT 1", [userId]);
            const stored: RefreshToken | undefined = Array.isArray(rawStored[0]) ? rawStored[0][0] : undefined;
    
            if (!stored || new Date(stored.expires_at) < new Date()) 
                return sendError(reply, "Invalid or expired token", 401);
    
            const newToken = jwt.sign({ userId: userId }, JWT_SECRET, { expiresIn: "1h" });
            sendSuccess(reply, { token: newToken });
        } catch (err: any) {
            sendError(reply, "Internal server error", 500);
        }
}

export default refreshToken;