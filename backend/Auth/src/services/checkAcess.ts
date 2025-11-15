
import { FastifyReply, FastifyRequest } from "fastify";
import { sendSuccess, sendError  } from "../utils/respond.js";
import db from "../db.js";


const checkAcess = async (req: FastifyRequest, reply : FastifyReply) =>{
    try{
        const acessInfo : string | undefined = req.cookies['refreshToken'];
        const userId : string | undefined = req.cookies['userId'];
        const timenow = new Date().toISOString();
        const tokenValid = {
                tokenOk : true,
                message: "Token is valid"
        }

        if(!acessInfo)
            return sendError(reply,'Invalid or expired token',401);

        const infoDb = await db.raw("SELECT expires_at FROM refresh_tokens WHERE userId = ? ", [userId])
        
        if(!infoDb)
            return sendError(reply,'Invalid or expired token',401);

        const expiresAtString = infoDb[0].expires_at; 
        const expires_at = new Date(expiresAtString).toISOString();
      
        if(new Date(expires_at) > new Date(timenow)){
           return sendSuccess(reply,tokenValid,200);
        }   

        tokenValid.tokenOk = false;
        tokenValid.message = "Token need to be refreshed";
        return sendSuccess(reply,tokenValid , 200);
    }
    catch(err:any){
        sendError(reply,'Internal server error',500);
    }   

}



export default checkAcess;