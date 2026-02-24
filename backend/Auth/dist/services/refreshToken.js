import { sendSuccess, sendError } from "../utils/respond.js";
import db from "../db.js";
import jwt from "jsonwebtoken";
const refreshToken = async (req, reply) => {
    try {
        const accesstoken = req.cookies['token'];
        if (!accesstoken)
            return sendError(reply, 'Invalid or expired token', 401);
        const JWT_SECRET = process.env.JWT_SECRET;
        const decoded = jwt.verify(accesstoken, JWT_SECRET);
        const userId = decoded.userId;
        const refreshtoken = req.cookies['refreshToken'];
        if (!refreshtoken)
            return sendError(reply, 'Invalid or expired token', 401);
        const rawStored = await db.raw("SELECT token, expires_at FROM refresh_tokens WHERE userID = ? LIMIT 1", [userId]);
        const stored = Array.isArray(rawStored[0]) ? rawStored[0][0] : undefined;
        if (!stored || new Date(stored.expires_at) < new Date())
            return sendError(reply, "Invalid or expired token", 401);
        const newToken = jwt.sign({ userId: userId }, JWT_SECRET, { expiresIn: "1h" });
        sendSuccess(reply, { token: newToken });
    }
    catch (err) {
        sendError(reply, "Internal server error", 500);
    }
};
export default refreshToken;
