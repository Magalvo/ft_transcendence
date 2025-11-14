import jwt from "jsonwebtoken";
import db from "../db.js";
import crypto from "crypto";
import fastifyOauth2 from "@fastify/oauth2";
import { sendError } from "../utils/respond.js";
import registerUser from "../services/register.js";
import Login from "../services/login.js";
import refreshToken from "../services/refreshToken.js";
import forgotPass from "../services/forgotPass.js";
import resetPass from "../services/resetPass.js";
import faSetup from "../services/faSetup.js";
import faVerify from "../services/faVerify.js";
export default async function authRoutes(app) {
    const JWT_SECRET = process.env.JWT_SECRET;
    const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
    const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
    const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || "";
    // --- Google OAuth2 ---
    if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && GOOGLE_REDIRECT_URI) {
        try {
            app.register(fastifyOauth2, {
                name: "googleOAuth2",
                scope: ["profile", "email"],
                credentials: {
                    client: { id: GOOGLE_CLIENT_ID, secret: GOOGLE_CLIENT_SECRET },
                    auth: {
                        authorizeHost: "https://accounts.google.com",
                        authorizePath: "/o/oauth2/v2/auth",
                        tokenHost: "https://oauth2.googleapis.com",
                        tokenPath: "/token",
                    },
                },
                startRedirectPath: "/auth/google/login",
                callbackUri: GOOGLE_REDIRECT_URI,
            }).after(() => {
                app.get("/auth/google/callback", async (req, reply) => {
                    try {
                        const client = app.googleOAuth2;
                        const token = await client.getAccessTokenFromAuthorizationCodeFlow(req);
                        const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
                            headers: { Authorization: `Bearer ${token.token.access_token}` },
                        });
                        if (!userInfoRes.ok) {
                            const body = await userInfoRes.text();
                            app.log.error(`Failed to fetch Google profile: ${body}`);
                            return sendError(reply, "Failed to fetch Google profile", 500);
                        }
                        const profile = await userInfoRes.json();
                        const rawUser = await db.raw("SELECT * FROM users WHERE email = ? LIMIT 1", [profile.email]);
                        let user = Array.isArray(rawUser[0]) ? rawUser[0][0] ?? null : rawUser[0] ?? null;
                        if (!user) {
                            const id = crypto.randomUUID();
                            await db.raw("INSERT INTO users (id, username, email, online) VALUES (?, ?, ?, ?)", [
                                id, profile.name ?? profile.email, profile.email, true,
                            ]);
                            user = { id, username: profile.name ?? profile.email, email: profile.email, online: true };
                        }
                        const jwtToken = jwt.sign({ username: user.username, email: user.email }, JWT_SECRET, { expiresIn: "1h" });
                        reply.redirect(`http://localhost:3000/?token=${jwtToken}`);
                    }
                    catch (err) {
                        app.log.error("Google OAuth error:", err);
                        sendError(reply, "Google login failed", 500);
                    }
                });
            });
        }
        catch (err) {
            app.log.error("Failed to register google OAuth plugin:", err);
        }
    }
    // --- REGISTER ---
    app.post("/register", async (req, reply) => {
        return await registerUser(req, reply);
    });
    // --- LOGIN ---
    app.post("/login", async (req, reply) => {
        return await Login(req, reply);
    });
    // --- REFRESH TOKEN ---
    app.post("/token/refresh", async (req, reply) => {
        return await refreshToken(req, reply);
    });
    // --- FORGOT / RESET PASSWORD ---
    app.post("/forgot", async (req, reply) => {
        return await forgotPass(req, reply);
    });
    app.post("/reset-password", async (req, reply) => {
        return await resetPass(req, reply);
    });
    // --- 2FA SETUP ---
    app.post("/2fa/setup", async (req, reply) => {
        return await faSetup(req, reply);
    });
    // --- 2FA VERIFY ---
    app.post("/2fa/verify", async (req, reply) => {
        return await faVerify(req, reply);
    });
}
