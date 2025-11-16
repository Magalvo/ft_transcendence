
import { sendSuccess, sendError  } from "../utils/respond.js";
import { FastifyReply, FastifyRequest } from "fastify";
import db from '../db.js';

import bcrypt from "bcrypt";
import { plainToInstance } from "class-transformer";
import  userResetPassDTO  from "../dto/userResetPass.dto.js"
import { validate, ValidationError } from "class-validator";


const resetPass =  async (req: FastifyRequest, reply : FastifyReply) =>{
    try {
      const acessInfo : string | undefined = req.cookies['refreshToken'];

      if(!acessInfo)
        return sendError(reply, "Token is required", 400);

      const user : userResetPassDTO = plainToInstance(userResetPassDTO,req.body);
      const erros : ValidationError[] = await validate(user);

      if (erros.length > 0) { 
         const erroMsg = erros.map(erro => {
                return erro.constraints ? Object.values(erro.constraints)[0] : 'Unknow Error'; 
            });
            const finalMsg = erroMsg.join('; ');
            return sendError(reply, `: ${finalMsg}`, 400);
      }

      const passwordHash = await bcrypt.hash(user.newPassword, 10);
      await db.raw("UPDATE users SET passwordHash = ? WHERE id = ?", [passwordHash, user.userId]);

      sendSuccess(reply, { message: "Password has been reset successfully" });
    } catch (err: any) {
      sendError(reply, "Internal server error", 500);
    }
}

export default resetPass;