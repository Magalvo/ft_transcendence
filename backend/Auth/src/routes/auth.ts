import type { FastifyInstance } from "fastify";
import jwt from "jsonwebtoken";
import db from "../db.js";
import crypto from "crypto";
import fastifyOauth2 from "@fastify/oauth2";
import { access, mkdir, writeFile } from "fs/promises";
import { extname, join } from "path";
import {sendError } from "../utils/respond.js";
import registerUser from "../services/register.js";
import Login from "../services/login.js"
import refreshToken from "../services/refreshToken.js";
import forgotPass from "../services/forgotPass.js";
import resetPass from "../services/resetPass.js";
import faSetup from "../services/faSetup.js";
import { User } from "../interfaces/user.js";
import faVerify from "../services/faVerify.js";
import { recordMatch, recordTeamMatch, getPlayerStats, getPlayerMatches, getMatchDetails } from "../services/matchService.js";
import UserProfileResponseDTO from "../dto/userProfile.response.dto.js";
import UserStatsDTO from "../dto/userStats.dto.js";

const AVATARS_PATH = process.env.AVATARS_PATH || join(process.cwd(), "public/avatars");

function getFrontendBaseUrl(headers: Record<string, unknown>): string {
  const forwardedProto = String(headers["x-forwarded-proto"] || "").trim();
  const forwardedHost = String(headers["x-forwarded-host"] || "").trim();
  const origin = String(headers.origin || "").trim();

  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }
  if (origin) {
    return origin.replace(/\/+$/g, "");
  }

  return (process.env.FRONTEND_URL || "https://localhost:8443").replace(
    /\/+$/g,
    "",
  );
}

export default async function authRoutes(app: FastifyInstance) {
  const JWT_SECRET = process.env.JWT_SECRET!;
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
            const client = (app as any).googleOAuth2;
            const token = await client.getAccessTokenFromAuthorizationCodeFlow(req);

            const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
              headers: { Authorization: `Bearer ${token.token.access_token}` },
            });

            if (!userInfoRes.ok) {
              const body = await userInfoRes.text();
              app.log.error(`Failed to fetch Google profile: ${body}`);
              return sendError(reply, "Failed to fetch Google profile", 500);
            }

            const profile = await userInfoRes.json() as any;
            const rawUser: any = await db.raw("SELECT * FROM users WHERE email = ? LIMIT 1", [profile.email]);
            let user: User | null = Array.isArray(rawUser[0]) ? rawUser[0][0] ?? null : rawUser[0] ?? null;

            if (!user) {
              const id = crypto.randomUUID();
              await db.raw("INSERT INTO users (id, username, email, online) VALUES (?, ?, ?, ?)", [
                id, profile.name ?? profile.email, profile.email, true,
              ]);
              user = { id, username: profile.name ?? profile.email, email: profile.email, online: true };
            }

            const jwtToken = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: "1h" });
            const frontendBaseUrl = getFrontendBaseUrl(
              req.headers as Record<string, unknown>,
            );
            reply.redirect(`${frontendBaseUrl}/?token=${jwtToken}`);
          } catch (err: any) {
            app.log.error("Google OAuth error:", err);
            sendError(reply, "Google login failed", 500);
          }
        });
      });
    } catch (err: any) {
      app.log.error("Failed to register google OAuth plugin:", err);
    }
  }

  // --- REGISTER ---
app.post("/register", async (req, reply) => {
    return await registerUser(req,reply);
});

 // --- LOGIN ---
app.post("/login", async (req, reply) => {
    return await Login(req,reply);
});

  // --- REFRESH TOKEN ---
  app.post("/token/refresh", async (req, reply) => {
    return await refreshToken(req,reply);
  });

  // --- FORGOT / RESET PASSWORD ---
  app.post("/forgot",async (req, reply) => {
    return await forgotPass(req,reply);
  });

  app.post("/reset-password",async (req, reply) => {
    return await resetPass(req,reply);
  });

  // --- 2FA SETUP ---
  app.post("/2fa/setup", async (req, reply) => {
    return await faSetup(req,reply);
});

  // --- 2FA VERIFY ---
  app.post("/2fa/verify", async (req, reply) => {
    return await faVerify(req,reply);
  });

  // --- GET CURRENT USER ---
  app.get("/me", async (req, reply) => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return sendError(reply, "Missing or invalid Authorization header", 401);
      }

      const token = authHeader.split(" ")[1];

      const decoded = jwt.verify(token, JWT_SECRET) as {
        userId: string;
        email: string;
      };

      const rawUser: any = await db.raw(
        "SELECT id, username, email, avatarUrl, online FROM users WHERE id = ? LIMIT 1",
        [decoded.userId]
      );

      const user =
        Array.isArray(rawUser[0]) ? rawUser[0][0] : rawUser[0];

      if (!user) {
        return sendError(reply, "User not found", 404);
      }

      // Map to response DTO with computed status
      const profile: UserProfileResponseDTO = {
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
    } catch (err) {
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
      const decoded = jwt.verify(token, JWT_SECRET) as {
        userId: string;
        email: string;
      };

      const data = await (req as any).file();

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
      } catch {
        await mkdir(AVATARS_PATH, { recursive: true });
      }

      // Save file
      await writeFile(uploadPath, buffer);

      // Update user avatar URL in database
      await db("users")
        .where({ id: decoded.userId })
        .update({ avatarUrl: publicUrl });

      return { success: true, url: publicUrl };
    } catch (err: any) {
      app.log.error(err);
      return sendError(reply, err.message || "Avatar upload failed", 500);
    }
  });

  // --- UPDATE USERNAME ---
  const updateUsernameHandler = async (req: any, reply: any) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return sendError(reply, "Missing or invalid Authorization header", 401);
      }

      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, JWT_SECRET) as {
        userId: string;
      };

      const { username } = (req.body ?? {}) as { username?: string };
      const normalized = String(username ?? "").trim();

      if (!normalized) {
        return sendError(reply, "Username is required", 400);
      }
      if (normalized.length < 3 || normalized.length > 20) {
        return sendError(reply, "Username must be between 3 and 20 characters", 400);
      }

      const existing = await db("users")
        .select("id")
        .whereRaw("LOWER(username) = LOWER(?)", [normalized])
        .first();

      if (existing && existing.id !== decoded.userId) {
        return sendError(reply, "Username is already taken", 409);
      }

      await db("users")
        .where({ id: decoded.userId })
        .update({ username: normalized });

      return { success: true, username: normalized };
    } catch (err: any) {
      app.log.error(err);
      return sendError(reply, err.message || "Failed to update username", 500);
    }
  };
  app.patch("/users/username", updateUsernameHandler);
  // Compatibility route for environments where PATCH is blocked by proxy/CORS.
  app.post("/users/username", updateUsernameHandler);

  const getAuthUserId = (req: any): string => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new Error("Missing or invalid Authorization header");
    }
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    return decoded.userId;
  };

  const isOnlineByLastRequest = (lastRequest?: string | number | null): boolean => {
    if (!lastRequest) return false;
    const ts =
      typeof lastRequest === "number"
        ? lastRequest
        : new Date(String(lastRequest)).getTime();
    if (!Number.isFinite(ts)) return false;
    return Date.now() - ts <= 60_000;
  };

  // --- SEND FRIEND REQUEST ---
  const sendFriendRequestHandler = async (req: any, reply: any) => {
    try {
      const requesterId = getAuthUserId(req);
      const body = (req.body ?? {}) as { username?: string; userId?: string };
      const targetValue = String(body.username ?? body.userId ?? "").trim();
      if (!targetValue) {
        return sendError(reply, "Target username is required", 400);
      }

      const targetUser = await db("users")
        .select("id", "username")
        .whereRaw("LOWER(username) = LOWER(?)", [targetValue])
        .orWhere("id", targetValue)
        .first();

      if (!targetUser) {
        return sendError(reply, "User not found", 404);
      }
      if (targetUser.id === requesterId) {
        return sendError(reply, "You cannot add yourself", 400);
      }

      const [userA, userB] = [requesterId, targetUser.id].sort();
      const alreadyFriends = await db("friendships")
        .where({ user_a: userA, user_b: userB })
        .first();
      if (alreadyFriends) {
        return sendError(reply, "Already friends", 409);
      }

      const existing = await db("friend_requests")
        .where(function () {
          this.where({ requester_id: requesterId, target_id: targetUser.id })
            .orWhere({ requester_id: targetUser.id, target_id: requesterId });
        })
        .first();

      if (existing) {
        return sendError(reply, "Friend request already exists", 409);
      }

      const [id] = await db("friend_requests").insert({
        requester_id: requesterId,
        target_id: targetUser.id,
        created_at: Date.now(),
      });

      return {
        success: true,
        request: {
          id,
          requester_id: requesterId,
          target_id: targetUser.id,
          username: targetUser.username,
        },
      };
    } catch (err: any) {
      app.log.error(err);
      if (err.message === "Missing or invalid Authorization header") {
        return sendError(reply, err.message, 401);
      }
      return sendError(reply, err.message || "Failed to send friend request", 500);
    }
  };

  app.post("/friends/requests", sendFriendRequestHandler);
  // Backward compatibility (old frontend path)
  app.post("/friends", sendFriendRequestHandler);

  // --- LIST INCOMING FRIEND REQUESTS ---
  app.get("/friends/requests/incoming", async (req, reply) => {
    try {
      const myUserId = getAuthUserId(req);
      const requests = await db("friend_requests as fr")
        .join("users as u", "u.id", "fr.requester_id")
        .select("fr.id", "fr.requester_id", "u.username", "fr.created_at")
        .where("fr.target_id", myUserId)
        .orderBy("fr.created_at", "desc");

      return requests.map((r: any) => ({
        id: r.id,
        requesterId: r.requester_id,
        username: r.username,
        createdAt: r.created_at,
      }));
    } catch (err: any) {
      app.log.error(err);
      if (err.message === "Missing or invalid Authorization header") {
        return sendError(reply, err.message, 401);
      }
      return sendError(reply, err.message || "Failed to fetch incoming requests", 500);
    }
  });

  // --- ACCEPT FRIEND REQUEST ---
  app.post("/friends/requests/:requestId/accept", async (req, reply) => {
    try {
      const myUserId = getAuthUserId(req);
      const { requestId } = req.params as { requestId: string };
      const request = await db("friend_requests")
        .where({ id: Number(requestId), target_id: myUserId })
        .first();

      if (!request) {
        return sendError(reply, "Friend request not found", 404);
      }

      const [userA, userB] = [request.requester_id, request.target_id].sort();
      await db("friendships")
        .insert({
          user_a: userA,
          user_b: userB,
          created_at: Date.now(),
        })
        .onConflict(["user_a", "user_b"])
        .ignore();

      await db("friend_requests")
        .where({ id: Number(requestId) })
        .delete();

      return { success: true };
    } catch (err: any) {
      app.log.error(err);
      if (err.message === "Missing or invalid Authorization header") {
        return sendError(reply, err.message, 401);
      }
      return sendError(reply, err.message || "Failed to accept request", 500);
    }
  });

  // --- DECLINE FRIEND REQUEST ---
  app.post("/friends/requests/:requestId/decline", async (req, reply) => {
    try {
      const myUserId = getAuthUserId(req);
      const { requestId } = req.params as { requestId: string };
      const deleted = await db("friend_requests")
        .where({ id: Number(requestId), target_id: myUserId })
        .delete();

      if (!deleted) {
        return sendError(reply, "Friend request not found", 404);
      }

      return { success: true };
    } catch (err: any) {
      app.log.error(err);
      if (err.message === "Missing or invalid Authorization header") {
        return sendError(reply, err.message, 401);
      }
      return sendError(reply, err.message || "Failed to decline request", 500);
    }
  });

  // --- GET USER FRIENDS ---
  app.get("/users/:userId/friends", async (req, reply) => {
    try {
      const { userId } = req.params as { userId: string };
      if (!userId) {
        return sendError(reply, "User ID is required", 400);
      }

      const friends = await db("friendships as f")
        .join("users as u", function () {
          this.on(function () {
            this.on("f.user_a", "=", db.raw("?", [userId])).andOn("u.id", "=", "f.user_b");
          }).orOn(function () {
            this.on("f.user_b", "=", db.raw("?", [userId])).andOn("u.id", "=", "f.user_a");
          });
        })
        .select("u.id", "u.username", "u.last_request")
        .orderBy("u.username", "asc");

      return friends.map((f: any) => ({
        id: f.id,
        username: f.username,
        status: isOnlineByLastRequest(f.last_request) ? "online" : "offline",
      }));
    } catch (err: any) {
      app.log.error(err);
      return sendError(reply, err.message || "Failed to fetch friends", 500);
    }
  });

  // --- REMOVE FRIEND ---
  app.post("/friends/remove", async (req, reply) => {
    try {
      const myUserId = getAuthUserId(req);
      const body = (req.body ?? {}) as { friendId?: string };
      const friendId = String(body.friendId ?? "").trim();

      if (!friendId) {
        return sendError(reply, "Friend ID is required", 400);
      }
      if (friendId === myUserId) {
        return sendError(reply, "Invalid friend ID", 400);
      }

      const [userA, userB] = [myUserId, friendId].sort();
      await db("friendships")
        .where({ user_a: userA, user_b: userB })
        .delete();

      return { success: true };
    } catch (err: any) {
      app.log.error(err);
      if (err.message === "Missing or invalid Authorization header") {
        return sendError(reply, err.message, 401);
      }
      return sendError(reply, err.message || "Failed to remove friend", 500);
    }
  });

  // --- RECORD MATCH ---
  app.post("/matches", async (req, reply) => {
    try {
      const { player1_id, player2_id, player1_score, player2_score, game_mode, status, started_at, ended_at } = req.body as any;

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
    } catch (err: any) {
      app.log.error(err);
      return sendError(reply, err.message || "Match recording failed", 500);
    }
  });

  // --- RECORD TEAM GAME ---
  app.post("/team-games", async (req, reply) => {
    try {
      const { leftTeamPlayers, rightTeamPlayers, leftTeamScore, rightTeamScore, duration, powerups, gameMode, started_at, ended_at } = req.body as any;

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
    } catch (err: any) {
      app.log.error(err);
      return sendError(reply, err.message || "Team game recording failed", 500);
    }
  });

  // --- GET PLAYER STATS ---
  app.get("/users/:userId/stats", async (req, reply) => {
    try {
      const { userId } = req.params as { userId: string };

      if (!userId) {
        return sendError(reply, "User ID is required", 400);
      }

      const stats = await getPlayerStats(userId);
      const statsResponse: UserStatsDTO = {
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
    } catch (err: any) {
      app.log.error(err);
      return sendError(reply, err.message || "Failed to fetch stats", 500);
    }
  });

  // --- GET PLAYER MATCHES ---
  app.get("/users/:userId/matches", async (req, reply) => {
    try {
      const { userId } = req.params as { userId: string };
      const { limit } = req.query as { limit?: string };

      if (!userId) {
        return sendError(reply, "User ID is required", 400);
      }

      const matches = await getPlayerMatches(userId, limit ? parseInt(limit) : 10);
      return matches;
    } catch (err: any) {
      app.log.error(err);
      return sendError(reply, err.message || "Failed to fetch matches", 500);
    }
  });

  // --- GET MATCH DETAILS ---
  app.get("/matches/:matchId", async (req, reply) => {
    try {
      const { matchId } = req.params as { matchId: string };

      if (!matchId) {
        return sendError(reply, "Match ID is required", 400);
      }

      const match = await getMatchDetails(matchId);
      if (!match) {
        return sendError(reply, "Match not found", 404);
      }

      return match;
    } catch (err: any) {
      app.log.error(err);
      return sendError(reply, err.message || "Failed to fetch match", 500);
    }
  });
}
