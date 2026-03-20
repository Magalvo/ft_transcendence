import type { FastifyInstance } from "fastify";
import jwt from "jsonwebtoken";
import db from "../db.js";
import crypto from "crypto";
import fastifyOauth2 from "@fastify/oauth2";
import { access, mkdir, unlink, writeFile } from "fs/promises";
import { basename, extname, join } from "path";
import { sendError, sendSuccess } from "../utils/respond.js";
import registerUser from "../services/register.js";
import Login from "../services/login.js";
import refreshToken from "../services/refreshToken.js";
import forgotPass from "../services/forgotPass.js";
import resetPass from "../services/resetPass.js";
import faSetup from "../services/faSetup.js";
import { User } from "../interfaces/user.js";
import faVerify from "../services/faVerify.js";
import {
  recordMatch,
  getPlayerStats,
  getPlayerMatches,
  getMatchDetails,
} from "../services/matchService.js";
import UserProfileResponseDTO from "../dto/userProfile.response.dto.js";
import UserStatsDTO from "../dto/userStats.dto.js";
import { readConfigValue } from "../utils/env.js";
import authenticate from "../middleware/authenticate.js";

const AVATARS_PATH =
  process.env.AVATARS_PATH || join(process.cwd(), "public/avatars");
const ALLOWED_AVATAR_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function getFrontendBaseUrl(headers: Record<string, unknown>): string {
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

  return (process.env.FRONTEND_URL || "https://localhost:8443").replace(
    /\/+$/g,
    "",
  );
}

function normalizeGoogleUsername(profile: any): string {
  const fromName = String(profile?.name || "").trim();
  const fromEmail = String(profile?.email || "").split("@")[0] || "player";
  const base = (fromName || fromEmail)
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 20);

  if (!base) return "player";
  return base.length < 3 ? `${base}_user`.slice(0, 20) : base;
}

function normalizeGoogleAvatarUrl(profile: any): string | null {
  const rawAvatar = String(profile?.picture || "").trim();
  const avatar = rawAvatar.startsWith("//")
    ? `https:${rawAvatar}`
    : rawAvatar;
  if (!avatar) return null;
  if (!avatar.startsWith("http://") && !avatar.startsWith("https://")) {
    return null;
  }
  return avatar;
}

async function reserveUniqueUsername(baseUsername: string): Promise<string> {
  let candidate = baseUsername;
  let attempt = 0;

  while (attempt < 20) {
    const raw: any = await db.raw(
      "SELECT id FROM users WHERE username = ? LIMIT 1",
      [candidate],
    );
    const exists = Array.isArray(raw[0]) ? raw[0][0] : raw[0];
    if (!exists) return candidate;

    attempt += 1;
    const suffix = `_${Math.floor(1000 + Math.random() * 9000)}`;
    const maxBaseLength = Math.max(3, 20 - suffix.length);
    candidate = `${baseUsername.slice(0, maxBaseLength)}${suffix}`;
  }

  return `${baseUsername.slice(0, 8)}_${Date.now().toString().slice(-6)}`.slice(
    0,
    20,
  );
}

export default async function authRoutes(app: FastifyInstance) {
  const JWT_SECRET = readConfigValue("JWT_SECRET");
  const GOOGLE_CLIENT_ID = readConfigValue("GOOGLE_CLIENT_ID");
  const GOOGLE_CLIENT_SECRET = readConfigValue("GOOGLE_CLIENT_SECRET");
  const GOOGLE_REDIRECT_URI = readConfigValue("GOOGLE_REDIRECT_URI");

  // --- Google OAuth2 ---
  if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && GOOGLE_REDIRECT_URI) {
    try {
      app
        .register(fastifyOauth2, {
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
          startRedirectPath: "/google/login",
          callbackUri: GOOGLE_REDIRECT_URI,
        })
        .after(() => {
          app.get("/google/callback", async (req, reply) => {
            try {
              const client = (app as any).googleOAuth2;
              const token =
                await client.getAccessTokenFromAuthorizationCodeFlow(req);

              const userInfoRes = await fetch(
                "https://www.googleapis.com/oauth2/v2/userinfo",
                {
                  headers: {
                    Authorization: `Bearer ${token.token.access_token}`,
                  },
                },
              );

              if (!userInfoRes.ok) {
                const body = await userInfoRes.text();
                app.log.error(`Failed to fetch Google profile: ${body}`);
                return sendError(reply, "Failed to fetch Google profile", 500);
              }

              const profile = (await userInfoRes.json()) as any;
              const rawUser: any = await db.raw(
                "SELECT * FROM users WHERE email = ? LIMIT 1",
                [profile.email],
              );
              let user: User | null = Array.isArray(rawUser[0])
                ? (rawUser[0][0] ?? null)
                : (rawUser[0] ?? null);
              const nowIso = new Date().toISOString();
              const googleAvatarUrl = normalizeGoogleAvatarUrl(profile);

              if (!user) {
                const id = crypto.randomUUID();
                const username = await reserveUniqueUsername(
                  normalizeGoogleUsername(profile),
                );
                await db.raw(
                  "INSERT INTO users (id, username, email, avatarUrl, online, last_request, accepted_terms) VALUES (?, ?, ?, ?, ?, ?, ?)",
                  [
                    id,
                    username,
                    profile.email,
                    googleAvatarUrl,
                    true,
                    nowIso,
                    true,
                  ],
                );
                user = {
                  id,
                  username,
                  email: profile.email,
                  online: true,
                  avatarUrl: googleAvatarUrl,
                };
              } else {
                const existingAvatar = String(
                  (user as any).avatarUrl || "",
                ).trim();
                const hasCustomLocalAvatar =
                  existingAvatar.startsWith("/avatars/");

                if (
                  googleAvatarUrl &&
                  !hasCustomLocalAvatar &&
                  existingAvatar !== googleAvatarUrl
                ) {
                  await db.raw("UPDATE users SET avatarUrl = ? WHERE id = ?", [
                    googleAvatarUrl,
                    user.id,
                  ]);
                  (user as any).avatarUrl = googleAvatarUrl;
                }
              }

              await db.raw(
                "UPDATE users SET online = ?, last_request = ? WHERE id = ?",
                [true, nowIso, user.id],
              );

              const jwtToken = jwt.sign(
                { userId: user.id, email: user.email },
                JWT_SECRET,
                { expiresIn: "1h" },
              );
              const refreshToken = crypto.randomBytes(64).toString("hex");
              const refreshExpiresAt = new Date(
                Date.now() + 7 * 24 * 60 * 60 * 1000,
              ).toISOString();

              const existingRefreshToken: any = await db.raw(
                "SELECT id FROM refresh_tokens WHERE userId = ? LIMIT 1",
                [user.id],
              );

              if (
                Array.isArray(existingRefreshToken[0]) &&
                existingRefreshToken[0][0]
              ) {
                await db.raw(
                  "UPDATE refresh_tokens SET token = ?, expires_at = ?, last_update = ? WHERE userId = ?",
                  [refreshToken, refreshExpiresAt, nowIso, user.id],
                );
              } else {
                await db.raw(
                  "INSERT INTO refresh_tokens (username, userId, token, expires_at, last_update) VALUES (?, ?, ?, ?, ?)",
                  [
                    user.username,
                    user.id,
                    refreshToken,
                    refreshExpiresAt,
                    nowIso,
                  ],
                );
              }

              const frontendBaseUrl = getFrontendBaseUrl(
                req.headers as Record<string, unknown>,
              );
              const redirectUrl = new URL(`${frontendBaseUrl}/login`);
              redirectUrl.searchParams.set("token", jwtToken);
              redirectUrl.searchParams.set("refreshToken", refreshToken);
              redirectUrl.searchParams.set("provider", "google");
              reply.redirect(redirectUrl.toString());
            } catch (err: any) {
              app.log.error("Google OAuth error:", err);
              sendError(reply, "Google login failed", 500);
            }
          });
        });
    } catch (err: any) {
      app.log.error("Failed to register google OAuth plugin:", err);
    }
  } else {
    const missing = [
      !GOOGLE_CLIENT_ID ? "GOOGLE_CLIENT_ID" : null,
      !GOOGLE_CLIENT_SECRET ? "GOOGLE_CLIENT_SECRET" : null,
      !GOOGLE_REDIRECT_URI ? "GOOGLE_REDIRECT_URI" : null,
    ].filter(Boolean);

    app.log.warn(
      `Google OAuth disabled. Missing configuration: ${missing.join(", ")}`
    );
  }

  // --- REGISTER ---
  app.post("/register", async (req, reply) => {
    return await registerUser(req, reply);
  });

  // --- LOGIN ---
  app.post("/login", async (req, reply) => {
    return await Login(req, reply);
  });

  // --- LOGOUT ---
  app.post("/logout", async (req, reply) => {
    try {
      const authHeader = req.headers.authorization;
      const JWT_SECRET = process.env.JWT_SECRET;
      if (!authHeader || !JWT_SECRET) {
        // Even if we cannot identify the user, respond OK so client can clear state
        return sendSuccess(reply, { message: "Logged out" });
      }

      const token = String(authHeader)
        .replace(/^Bearer\s+/i, "")
        .trim();
      if (!token) {
        return sendSuccess(reply, { message: "Logged out" });
      }

      const decoded = jwt.verify(token, JWT_SECRET) as { userId?: string };
      const userId = decoded?.userId;

      if (userId) {
        await db("users").where({ id: userId }).update({ online: false });
      }

      // Broadcast a best-effort logout hint to the Socket.IO layer so that
      // any active sockets for this user can leave lobbies / games.
      if (userId && app.io) {
        app.io.to(`user:${userId}`).emit("forceLogout");
      }

      return sendSuccess(reply, { message: "Logged out" });
    } catch (err) {
      app.log.error(err);
      // Still respond success – the frontend will clear tokens regardless
      return sendSuccess(reply, { message: "Logged out" });
    }
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

  // --- 2FA DISABLE ---
  app.post("/2fa/disable", async (req, reply) => {
    try {
      const userId = getAuthUserId(req as any);

      await db("users")
        .where({ id: userId })
        .update({ twoFactorSecret: null, tempTwoFactorSecret: null });

      return sendSuccess(reply, { message: "2FA disabled" });
    } catch (err: any) {
      app.log.error(err);
      if (err.message === "Missing or invalid Authorization header") {
        return sendError(reply, err.message, 401);
      }
      return sendError(reply, err.message || "Failed to disable 2FA", 500);
    }
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
        "SELECT id, username, email, avatarUrl, online, twoFactorSecret FROM users WHERE id = ? LIMIT 1",
        [decoded.userId],
      );

      const user = Array.isArray(rawUser[0]) ? rawUser[0][0] : rawUser[0];

      if (!user) {
        return sendError(reply, "User not found", 404);
      }

      // Map to response DTO with computed status
      const profile: UserProfileResponseDTO = {
        id: user.id,
        username: user.username,
        email: user.email,
        avatarUrl:
          user.avatarUrl ||
          `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username)}&background=0D8ABC&color=fff`,
        online: user.online,
        status: user.online ? "online" : "offline",
        twoFactorEnabled: !!user.twoFactorSecret,
        wins: 0,
        losses: 0,
        rank: "Unranked",
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
      if (!app.hasMultipart) {
        return sendError(
          reply,
          "Avatar uploads are unavailable because the multipart plugin is not installed in this workspace",
          503,
        );
      }

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

      if (!ALLOWED_AVATAR_MIME_TYPES.has(String(data.mimetype || "").toLowerCase())) {
        return sendError(reply, "Only JPEG, PNG, WEBP, and GIF avatars are allowed", 400);
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

      const existingUser = await db("users")
        .select("avatarUrl")
        .where({ id: decoded.userId })
        .first();

      // Update user avatar URL in database
      await db("users")
        .where({ id: decoded.userId })
        .update({ avatarUrl: publicUrl });

      const previousAvatar = String(existingUser?.avatarUrl || "").trim();
      if (previousAvatar.startsWith("/avatars/") && previousAvatar !== publicUrl) {
        const previousFilename = basename(previousAvatar);
        const previousPath = join(AVATARS_PATH, previousFilename);
        try {
          await unlink(previousPath);
        } catch {
          // Ignore cleanup failures for old avatar files.
        }
      }

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
        return sendError(
          reply,
          "Username must be between 3 and 20 characters",
          400,
        );
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

  const isOnlineByLastRequest = (
    lastRequest?: string | number | null,
  ): boolean => {
    if (!lastRequest) return false;
    const ts =
      typeof lastRequest === "number"
        ? lastRequest
        : new Date(String(lastRequest)).getTime();
    if (!Number.isFinite(ts)) return false;
    return Date.now() - ts <= 60_000;
  };

  const getValidatedDate = (rawValue: unknown, fieldName: string): Date => {
    const parsed = new Date(String(rawValue ?? ""));
    if (!Number.isFinite(parsed.getTime())) {
      throw new Error(`Invalid ${fieldName}`);
    }
    return parsed;
  };

  const getValidatedScore = (rawValue: unknown, fieldName: string): number => {
    const score = Number(rawValue);
    if (!Number.isInteger(score) || score < 0) {
      throw new Error(`${fieldName} must be a non-negative integer`);
    }
    return score;
  };

  const readAuthenticatedUserId = (req: any): string => {
    return String(req?.user?.id ?? "").trim();
  };

  const ensureActorIsMatchParticipant = (
    actorUserId: string,
    participantIds: string[],
  ): void => {
    if (!actorUserId) {
      throw new Error("Unauthorized");
    }
    if (!participantIds.includes(actorUserId)) {
      throw new Error("Authenticated user must be a participant in the recorded match");
    }
  };

  const getMatchRecordingErrorStatus = (errorMessage: string): number => {
    if (errorMessage === "Unauthorized") return 401;
    if (
      errorMessage ===
      "Authenticated user must be a participant in the recorded match"
    ) {
      return 403;
    }
    if (
      errorMessage.startsWith("Invalid ") ||
      errorMessage.includes("non-negative integer") ||
      errorMessage.includes("Missing required") ||
      errorMessage.includes("distinct participants") ||
      errorMessage.includes("must include at least one player") ||
      errorMessage.includes("ended_at must") ||
      errorMessage.includes("Duplicate players")
    ) {
      return 400;
    }
    return 500;
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
          this.where({
            requester_id: requesterId,
            target_id: targetUser.id,
          }).orWhere({ requester_id: targetUser.id, target_id: requesterId });
        })
        .first();

      if (existing) {
        if (
          String(existing.requester_id) === String(targetUser.id) &&
          String(existing.target_id) === String(requesterId)
        ) {
          await db("friendships")
            .insert({
              user_a: userA,
              user_b: userB,
              created_at: Date.now(),
            })
            .onConflict(["user_a", "user_b"])
            .ignore();

          await db("friend_requests")
            .where({ id: existing.id })
            .delete();

          return {
            success: true,
            autoAccepted: true,
            friend: {
              id: targetUser.id,
              username: targetUser.username,
            },
          };
        }

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
      return sendError(
        reply,
        err.message || "Failed to send friend request",
        500,
      );
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
      return sendError(
        reply,
        err.message || "Failed to fetch incoming requests",
        500,
      );
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
            this.on("f.user_a", "=", db.raw("?", [userId])).andOn(
              "u.id",
              "=",
              "f.user_b",
            );
          }).orOn(function () {
            this.on("f.user_b", "=", db.raw("?", [userId])).andOn(
              "u.id",
              "=",
              "f.user_a",
            );
          });
        })
        .select("u.id", "u.username", "u.last_request", "u.online")
        .orderBy("u.username", "asc");

      return friends.map((f: any) => ({
        id: f.id,
        username: f.username,
        status:
          Boolean(f.online) || isOnlineByLastRequest(f.last_request)
            ? "online"
            : "offline",
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
      await db("friendships").where({ user_a: userA, user_b: userB }).delete();

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
  app.post("/matches", { preHandler: authenticate }, async (req, reply) => {
    try {
      const actorUserId = readAuthenticatedUserId(req);
      const {
        player1_id,
        player2_id,
        player1_score,
        player2_score,
        game_mode,
        status,
        started_at,
        ended_at,
      } = req.body as any;

      const normalizedPlayer1Id = String(player1_id ?? "").trim();
      const normalizedPlayer2Id = String(player2_id ?? "").trim();

      if (!normalizedPlayer1Id || !normalizedPlayer2Id) {
        return sendError(reply, "Missing required match fields", 400);
      }
      if (normalizedPlayer1Id === normalizedPlayer2Id) {
        return sendError(reply, "Match requires two distinct participants", 400);
      }

      const validatedPlayer1Score = getValidatedScore(
        player1_score,
        "player1_score",
      );
      const validatedPlayer2Score = getValidatedScore(
        player2_score,
        "player2_score",
      );
      const validatedStartedAt = getValidatedDate(started_at, "started_at");
      const validatedEndedAt = getValidatedDate(ended_at, "ended_at");
      if (validatedEndedAt.getTime() < validatedStartedAt.getTime()) {
        return sendError(reply, "ended_at must be greater than or equal to started_at", 400);
      }

      ensureActorIsMatchParticipant(actorUserId, [
        normalizedPlayer1Id,
        normalizedPlayer2Id,
      ]);

      const matchId = await recordMatch({
        player1_id: normalizedPlayer1Id,
        player2_id: normalizedPlayer2Id,
        player1_score: validatedPlayer1Score,
        player2_score: validatedPlayer2Score,
        game_mode: game_mode || "1v1",
        status: status || "completed",
        started_at: validatedStartedAt,
        ended_at: validatedEndedAt,
      });

      return { success: true, matchId };
    } catch (err: any) {
      app.log.error(err);
      const message = err?.message || "Match recording failed";
      return sendError(reply, message, getMatchRecordingErrorStatus(message));
    }
  });

  // --- RECORD TEAM GAME ---
  app.post("/team-games", { preHandler: authenticate }, async (req, reply) => {
    try {
      const actorUserId = readAuthenticatedUserId(req);
      const {
        leftTeamPlayers,
        rightTeamPlayers,
        leftTeamScore,
        rightTeamScore,
        duration,
        powerups,
        gameMode,
        started_at,
        ended_at,
      } = req.body as any;

      if (
        !leftTeamPlayers ||
        !rightTeamPlayers ||
        leftTeamScore === undefined ||
        rightTeamScore === undefined
      ) {
        return sendError(reply, "Missing required team game fields", 400);
      }

      if (!Array.isArray(leftTeamPlayers) || !Array.isArray(rightTeamPlayers)) {
        return sendError(reply, "Team players must be arrays", 400);
      }

      const normalizedLeftTeamPlayers = leftTeamPlayers
        .map((player: any) => ({
          ...player,
          user_id: String(player?.user_id ?? "").trim(),
        }))
        .filter((player: any) => player.user_id);
      const normalizedRightTeamPlayers = rightTeamPlayers
        .map((player: any) => ({
          ...player,
          user_id: String(player?.user_id ?? "").trim(),
        }))
        .filter((player: any) => player.user_id);

      if (
        normalizedLeftTeamPlayers.length === 0 ||
        normalizedRightTeamPlayers.length === 0
      ) {
        return sendError(reply, "Each team must include at least one player", 400);
      }

      const participantIds = [
        ...normalizedLeftTeamPlayers.map((player: any) => player.user_id),
        ...normalizedRightTeamPlayers.map((player: any) => player.user_id),
      ];
      if (new Set(participantIds).size !== participantIds.length) {
        return sendError(reply, "Duplicate players are not allowed in team games", 400);
      }
      ensureActorIsMatchParticipant(actorUserId, participantIds);

      const validatedLeftTeamScore = getValidatedScore(
        leftTeamScore,
        "leftTeamScore",
      );
      const validatedRightTeamScore = getValidatedScore(
        rightTeamScore,
        "rightTeamScore",
      );
      const validatedStartedAt = getValidatedDate(started_at, "started_at");
      const validatedEndedAt = getValidatedDate(ended_at, "ended_at");
      if (validatedEndedAt.getTime() < validatedStartedAt.getTime()) {
        return sendError(reply, "ended_at must be greater than or equal to started_at", 400);
      }

      const primaryLeftPlayer = normalizedLeftTeamPlayers[0]?.user_id;
      const primaryRightPlayer = normalizedRightTeamPlayers[0]?.user_id;
      if (!primaryLeftPlayer || !primaryRightPlayer) {
        return sendError(reply, "Each team must include at least one tracked player", 400);
      }

      const gameId = await recordMatch({
        player1_id: primaryLeftPlayer,
        player2_id: primaryRightPlayer,
        player1_score: validatedLeftTeamScore,
        player2_score: validatedRightTeamScore,
        game_mode: gameMode || "1v1",
        status: "completed",
        started_at: validatedStartedAt,
        ended_at: validatedEndedAt,
        teamGameData: {
          leftTeamPlayers: normalizedLeftTeamPlayers,
          rightTeamPlayers: normalizedRightTeamPlayers,
          duration: duration || "normal",
          powerups: powerups || false,
          gameMode: gameMode || "1v1",
        },
      });

      return { success: true, gameId };
    } catch (err: any) {
      app.log.error(err);
      const message = err?.message || "Team game recording failed";
      return sendError(reply, message, getMatchRecordingErrorStatus(message));
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
        updated_at: stats.updated_at,
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

      const matches = await getPlayerMatches(
        userId,
        limit ? parseInt(limit) : 10,
      );
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
