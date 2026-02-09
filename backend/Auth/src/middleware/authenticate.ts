
import jwt from "jsonwebtoken";
import { FastifyReply, FastifyRequest } from "fastify";
import { DecodedToken} from "../interfaces/token.js"
import db from "../db.js";
import { sendSuccess , sendError} from "../utils/respond.js";


 // --- Middleware ---
const authenticate = async (req: FastifyRequest,reply: FastifyReply): Promise<DecodedToken | any> => {
    
   const accestoken : string | undefined = req.cookies['token'];
    
    if(!accestoken)
        return sendError(reply,'Invalid or expired token',401);
   
    try{
        const JWT_SECRET = process.env.JWT_SECRET as string;
        const decoded: any = jwt.verify(accestoken, JWT_SECRET);
     
        const userID : string = decoded.userId;
        
        const timenow = new Date().toISOString();
        
        await db.raw("UPDATE users SET last_request = ? WHERE id = ?", [timenow, userID]);

        return sendSuccess(reply, { 
                tokenOk: true, 
                message: "Token is valid" 
            }, 200);
    }
    catch(jwtError: any){
        if (jwtError.name === 'TokenExpiredError') {
                return sendSuccess(reply, { 
                    tokenOk: false, 
                    message: "Token expired, please refresh" 
                }, 401);
            }

            if (jwtError.name === 'JsonWebTokenError') {
                return sendError(reply, 'Invalid token signature', 401);
            }

            throw jwtError;
    }   
};


export default authenticate;