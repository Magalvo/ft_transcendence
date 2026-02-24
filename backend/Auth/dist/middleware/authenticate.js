import jwt from "jsonwebtoken";
import db from "../db.js";
import { sendError } from "../utils/respond.js";
const authenticate = async (req, reply) => {
    const accessToken = req.cookies["token"];
    if (!accessToken) {
        return sendError(reply, "Invalid or expired token", 401);
    }
    try {
        const JWT_SECRET = process.env.JWT_SECRET;
        const decoded = jwt.verify(accessToken, JWT_SECRET);
        const userId = decoded.userId;
        // atualizar last_request (ok 👍)
        await db.raw("UPDATE users SET last_request = ? WHERE id = ?", [new Date().toISOString(), userId]);
        // 🔑 MUITO IMPORTANTE
        req.user = {
            id: userId,
            email: decoded.email,
        };
        // ⛔ NÃO devolver resposta
        return;
    }
    catch (jwtError) {
        if (jwtError.name === "TokenExpiredError") {
            return sendError(reply, "Token expired, please refresh", 401);
        }
        if (jwtError.name === "JsonWebTokenError") {
            return sendError(reply, "Invalid token signature", 401);
        }
        throw jwtError;
    }
};
export default authenticate;
