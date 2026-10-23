
import { FastifyReply, FastifyRequest } from "fastify";
import { sendSuccess, sendError  } from "../utils/respond.js";
import { RefreshToken } from "../interfaces/token.js"
import db from "../db.js";
import { hashToken, signAccessToken } from "../utils/tokens.js";

const refreshToken = async (req: FastifyRequest, reply : FastifyReply) =>{
    
    try {
            const body = (req.body as any) || {};
            const refreshTokenFromBody: string | undefined = body.refreshToken;
            const refreshTokenFromCookie: string | undefined = req.cookies['refreshToken'];
            const refreshTokenValue = refreshTokenFromCookie || refreshTokenFromBody;

            if (!refreshTokenValue) {
                return sendError(reply,'Invalid or expired token',401);
            }

            const stored = await db("refresh_tokens")
                .select("userId", "token", "expires_at")
                .where({ token: hashToken(String(refreshTokenValue)) })
                .first() as (RefreshToken & { userId: string }) | undefined;

            if (!stored || new Date(stored.expires_at) < new Date()) {
                return sendError(reply, "Invalid or expired token", 401);
            }

            const newToken = signAccessToken(stored.userId);
            sendSuccess(reply, { token: newToken });
        } catch (err: any) {
            sendError(reply, "Internal server error", 500);
        }
}

export default refreshToken;
