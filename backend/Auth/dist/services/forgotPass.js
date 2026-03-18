import { sendSuccess, sendError } from "../utils/respond.js";
import crypto from "crypto";
import { sendMail } from "../utils/email.js";
import db from '../db.js';
function getFrontendBaseUrl(headers) {
    const configuredFrontendUrl = String(process.env.FRONTEND_URL || "").trim();
    if (configuredFrontendUrl) {
        return configuredFrontendUrl.replace(/\/+$/g, "");
    }
    const forwardedProto = String(headers["x-forwarded-proto"] || "").trim();
    const forwardedHost = String(headers["x-forwarded-host"] || "").trim();
    const forwardedPort = String(headers["x-forwarded-port"] || "").trim();
    const origin = String(headers.origin || "").trim();
    if (forwardedProto && forwardedHost) {
        if (forwardedPort && !forwardedHost.includes(":")) {
            return `${forwardedProto}://${forwardedHost}:${forwardedPort}`;
        }
        return `${forwardedProto}://${forwardedHost}`;
    }
    if (origin) {
        return origin.replace(/\/+$/g, "");
    }
    return (process.env.FRONTEND_URL || "https://localhost:8443").replace(/\/+$/g, "");
}
const forgotPass = async (req, reply) => {
    try {
        const { email } = req.body;
        const rawUser = await db.raw("SELECT * FROM users WHERE email = ? LIMIT 1", [email]);
        const user = Array.isArray(rawUser[0]) ? rawUser[0][0] ?? null : rawUser[0] ?? null;
        if (!user)
            return sendError(reply, "User not found", 404);
        const token = crypto.randomBytes(32).toString("hex");
        const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        await db.raw("UPDATE users SET resetToken = ?, resetExpires = ? WHERE email = ?", [token, expires, email]);
        const frontendBaseUrl = getFrontendBaseUrl(req.headers);
        const link = `${frontendBaseUrl}/reset-password?token=${token}`;
        await sendMail(email, "Password Reset", `<p>Click here to reset your password:</p><a href="${link}">${link}</a>`);
        return sendSuccess(reply, { message: "Password reset email sent" });
    }
    catch (err) {
        sendError(reply, "Internal server error", 500);
    }
};
export default forgotPass;
