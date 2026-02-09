import { sendError } from "../utils/respond.js";
import jwt from "jsonwebtoken";
// --- Middleware ---
const authenticate = async (req, reply) => {
    const JWT_SECRET = process.env.JWT_SECRET;
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        sendError(reply, "Missing Authorization header", 401);
        return null;
    }
    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
        sendError(reply, "Malformed Authorization header", 401);
        return null;
    }
    const token = parts[1];
    if (!token) {
        sendError(reply, "Token not provided", 401);
        return null;
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (!decoded.username) {
            sendError(reply, "Invalid token payload", 401);
            return null;
        }
        return decoded;
    }
    catch (err) {
        console.error("JWT verification failed:", err.message);
        sendError(reply, "Invalid or expired token", 401);
        return null;
    }
};
export default authenticate;
