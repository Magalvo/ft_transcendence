import jwt from "jsonwebtoken";
import db from "../db.js";
import crypto from "crypto";
import fastifyOauth2 from "@fastify/oauth2";
import { access, mkdir, writeFile } from "fs/promises";
import { extname, join } from "path";
import { sendError } from "../utils/respond.js";
import registerUser from "../services/register.js";
import Login from "../services/login.js";
import refreshToken from "../services/refreshToken.js";
import forgotPass from "../services/forgotPass.js";
import resetPass from "../services/resetPass.js";
import faSetup from "../services/faSetup.js";
import faVerify from "../services/faVerify.js";
import { recordMatch, recordTeamMatch, getPlayerStats, getPlayerMatches, getMatchDetails } from "../services/matchService.js";
const AVATARS_PATH = process.env.AVATARS_PATH || join(process.cwd(), "public/avatars");
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
                        const jwtToken = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: "1h" });
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
    // --- GET CURRENT USER ---
    app.get("/me", async (req, reply) => {
        try {
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith("Bearer ")) {
                return sendError(reply, "Missing or invalid Authorization header", 401);
            }
            const token = authHeader.split(" ")[1];
            const decoded = jwt.verify(token, JWT_SECRET);
            const rawUser = await db.raw("SELECT id, username, email, avatarUrl, online FROM users WHERE id = ? LIMIT 1", [decoded.userId]);
            const user = Array.isArray(rawUser[0]) ? rawUser[0][0] : rawUser[0];
            if (!user) {
                return sendError(reply, "User not found", 404);
            }
            // Map to response DTO with computed status
            const profile = {
                id: user.id,
                username: user.username,
                email: user.email,
                avatarUrl: user.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username)}&background=0D8ABC&color=fff`,
                online: user.online,
                status: user.online ? 'online' : 'offline',
                wins: 0,
                losses: 0,
                rank: 'Unranked'
            };
            return profile;
        }
        catch (err) {
            app.log.error(err);
            return sendError(reply, "Invalid or expired token", 401);
        }
    });
    // --- UPLOAD AVATAR ---
    app.post("/users/avatar", async (req, reply) => {
        try {
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith("Bearer ")) {
                return sendError(reply, "Missing or invalid Authorization header", 401);
            }
            const token = authHeader.split(" ")[1];
            const decoded = jwt.verify(token, JWT_SECRET);
            const data = await req.file();
            if (!data) {
                return sendError(reply, "No file uploaded", 400);
            }
            const buffer = await data.toBuffer();
            const ext = extname(data.filename).replace(".", "") || "jpg";
            const filename = `${decoded.userId}_${Date.now()}.${ext}`;
            const uploadPath = join(AVATARS_PATH, filename);
            const publicUrl = `/avatars/${filename}`;
            // Create avatars directory if it doesn't exist
            try {
                await access(AVATARS_PATH);
            }
            catch {
                await mkdir(AVATARS_PATH, { recursive: true });
            }
            // Save file
            await writeFile(uploadPath, buffer);
            // Update user avatar URL in database
            await db("users")
                .where({ id: decoded.userId })
                .update({ avatarUrl: publicUrl });
            return { success: true, url: publicUrl };
        }
        catch (err) {
            app.log.error(err);
            return sendError(reply, err.message || "Avatar upload failed", 500);
        }
    });
    // --- RECORD MATCH ---
    app.post("/matches", async (req, reply) => {
        try {
            const { player1_id, player2_id, player1_score, player2_score, game_mode, status, started_at, ended_at } = req.body;
            if (!player1_id || !player2_id || player1_score === undefined || player2_score === undefined) {
                return sendError(reply, "Missing required match fields", 400);
            }
            const matchId = await recordMatch({
                player1_id,
                player2_id,
                player1_score,
                player2_score,
                game_mode: game_mode || "1v1",
                status: status || "completed",
                started_at: new Date(started_at),
                ended_at: new Date(ended_at),
            });
            return { success: true, matchId };
        }
        catch (err) {
            app.log.error(err);
            return sendError(reply, err.message || "Match recording failed", 500);
        }
    });
    // --- RECORD TEAM GAME ---
    app.post("/team-games", async (req, reply) => {
        try {
            const { leftTeamPlayers, rightTeamPlayers, leftTeamScore, rightTeamScore, duration, powerups, gameMode, started_at, ended_at } = req.body;
            if (!leftTeamPlayers || !rightTeamPlayers || leftTeamScore === undefined || rightTeamScore === undefined) {
                return sendError(reply, "Missing required team game fields", 400);
            }
            if (!Array.isArray(leftTeamPlayers) || !Array.isArray(rightTeamPlayers)) {
                return sendError(reply, "Team players must be arrays", 400);
            }
            const gameId = await recordTeamMatch({
                leftTeamPlayers,
                rightTeamPlayers,
                leftTeamScore,
                rightTeamScore,
                duration: duration || "normal",
                powerups: powerups || false,
                gameMode: gameMode || "1v1",
                started_at: new Date(started_at),
                ended_at: new Date(ended_at),
            });
            return { success: true, gameId };
        }
        catch (err) {
            app.log.error(err);
            return sendError(reply, err.message || "Team game recording failed", 500);
        }
    });
    // --- GET PLAYER STATS ---
    app.get("/users/:userId/stats", async (req, reply) => {
        try {
            const { userId } = req.params;
            if (!userId) {
                return sendError(reply, "User ID is required", 400);
            }
            const stats = await getPlayerStats(userId);
            const statsResponse = {
                user_id: stats.user_id,
                total_matches: stats.total_matches,
                wins: stats.wins,
                losses: stats.losses,
                total_goals_scored: stats.total_goals_scored,
                total_goals_conceded: stats.total_goals_conceded,
                win_percentage: stats.win_percentage,
                avg_goals_per_match: stats.avg_goals_per_match,
                current_win_streak: stats.current_win_streak,
                longest_win_streak: stats.longest_win_streak,
                last_match_at: stats.last_match_at,
                updated_at: stats.updated_at
            };
            return statsResponse;
        }
        catch (err) {
            app.log.error(err);
            return sendError(reply, err.message || "Failed to fetch stats", 500);
        }
    });
    // --- GET PLAYER MATCHES ---
    app.get("/users/:userId/matches", async (req, reply) => {
        try {
            const { userId } = req.params;
            const { limit } = req.query;
            if (!userId) {
                return sendError(reply, "User ID is required", 400);
            }
            const matches = await getPlayerMatches(userId, limit ? parseInt(limit) : 10);
            return matches;
        }
        catch (err) {
            app.log.error(err);
            return sendError(reply, err.message || "Failed to fetch matches", 500);
        }
    });
    // --- GET MATCH DETAILS ---
    app.get("/matches/:matchId", async (req, reply) => {
        try {
            const { matchId } = req.params;
            if (!matchId) {
                return sendError(reply, "Match ID is required", 400);
            }
            const match = await getMatchDetails(matchId);
            if (!match) {
                return sendError(reply, "Match not found", 404);
            }
            return match;
        }
        catch (err) {
            app.log.error(err);
            return sendError(reply, err.message || "Failed to fetch match", 500);
        }
    });
}
