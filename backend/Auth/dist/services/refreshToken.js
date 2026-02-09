import { sendSuccess, sendError } from "../utils/respond.js";
import db from "../db.js";
import jwt from "jsonwebtoken";
const refreshToken = async (req, reply) => {
    try {
        const JWT_SECRET = process.env.JWT_SECRET;
        const { refreshToken } = req.body;
        const rawStored = await db.raw("SELECT * FROM refresh_tokens WHERE token = ? LIMIT 1", [refreshToken]);
        const stored = Array.isArray(rawStored[0]) ? rawStored[0][0] : undefined;
        if (!stored || new Date(stored.expires_at) < new Date())
            return sendError(reply, "Invalid or expired token", 401);
        const newToken = jwt.sign({ username: stored.username }, JWT_SECRET, { expiresIn: "1h" });
        sendSuccess(reply, { token: newToken });
    }
    catch (err) {
        sendError(reply, "Internal server error", 500);
    }
};
export default refreshToken;
