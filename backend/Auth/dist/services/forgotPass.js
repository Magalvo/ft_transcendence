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
        const normalizedEmail = String(email || "").trim();
        if (!normalizedEmail) {
            return sendError(reply, "Email is required", 400);
        }
        const rawUser = await db.raw("SELECT id, email FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1", [normalizedEmail]);
        const user = Array.isArray(rawUser[0]) ? rawUser[0][0] ?? null : rawUser[0] ?? null;
        // Return a generic success message even when the email does not exist.
        // This avoids account enumeration and keeps the UX consistent.
        if (!user)
            return sendSuccess(reply, { message: "If the account exists, a password reset email has been sent" });
        const token = crypto.randomBytes(32).toString("hex");
        const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        await db.raw("UPDATE users SET resetToken = ?, resetExpires = ? WHERE id = ?", [token, expires, user.id]);
        const frontendBaseUrl = getFrontendBaseUrl(req.headers);
        const link = `${frontendBaseUrl}/reset-password?token=${token}`;
        try {
            const recipientEmail = String(user.email || normalizedEmail).trim();
            await sendMail(recipientEmail, "Password Reset", `<p>Click here to reset your password:</p><a href="${link}">${link}</a>`);
        }
        catch (mailErr) {
            // Dev-friendly fallback when SMTP isn't configured or temporarily fails.
            console.warn("[forgotPass] Could not send reset email; generated link:", link);
            console.warn("[forgotPass] Mail error:", mailErr);
        }
        return sendSuccess(reply, { message: "If the account exists, a password reset email has been sent" });
    }
    catch (err) {
        console.error("[forgotPass] Unexpected error:", err);
        return sendError(reply, "Internal server error", 500);
    }
};
export default forgotPass;
