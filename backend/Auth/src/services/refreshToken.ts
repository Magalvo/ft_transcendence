import { FastifyReply, FastifyRequest } from "fastify";
import { sendSuccess, sendError  } from "../utils/respond.js";
import { rotateSession } from "./session.js";

const refreshToken = async (req: FastifyRequest, reply : FastifyReply) =>{

    try {
            const body = (req.body as any) || {};
            const refreshTokenFromBody: string | undefined = body.refreshToken;
            const refreshTokenFromCookie: string | undefined = req.cookies['refreshToken'];
            const refreshTokenValue = refreshTokenFromCookie || refreshTokenFromBody;

            if (!refreshTokenValue) {
                return sendError(reply,'Invalid or expired token',401);
            }

            const result = await rotateSession(String(refreshTokenValue));

            if (result.status === "invalid") {
                return sendError(reply, "Invalid or expired token", 401);
            }

            // In the grace case no new refresh token is returned: the client
            // keeps the one another tab already stored.
            sendSuccess(reply, result.status === "rotated"
                ? { token: result.token, refreshToken: result.refreshToken }
                : { token: result.token });
        } catch (err: any) {
            sendError(reply, "Internal server error", 500);
        }
}

export default refreshToken;
