import type { FastifyInstance } from "fastify";
import db from "../db.js";
import crypto from "crypto";
import fastifyOauth2 from "@fastify/oauth2";
import { sendError, sendSuccess } from "../utils/respond.js";
import registerUser from "../services/register.js";
import Login from "../services/login.js";
import refreshToken from "../services/refreshToken.js";
import forgotPass from "../services/forgotPass.js";
import resetPass from "../services/resetPass.js";
import faSetup from "../services/faSetup.js";
import { User } from "../interfaces/user.js";
import faVerify from "../services/faVerify.js";
import speakeasy from "speakeasy";
import { readConfigValue } from "../utils/env.js";
import authenticate from "../middleware/authenticate.js";
import { issueSession, revokeSessions } from "../services/session.js";
import {
  readBearerToken,
  signTwoFactorPendingToken,
  verifyAccessToken,
  verifyTwoFactorPendingToken,
} from "../utils/tokens.js";
import {
  createRateLimiter,
  rateLimitByIp,
  rejectIfLimited,
} from "../utils/rateLimit.js";
import { getFrontendBaseUrl } from "../utils/frontendUrl.js";

const authIpLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 20 });
const twoFactorLimiter = createRateLimiter({ windowMs: 5 * 60 * 1000, max: 5 });

function verifyTotp(secret: string, code: unknown): boolean {
  return speakeasy.totp.verify({
    secret,
    encoding: "base32",
    token: String(code ?? "").trim(),
    window: 1,
  });
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
              // Accounts are linked by email, so only trust addresses Google
              // has verified.
              if (!profile?.email || profile.verified_email !== true) {
                return sendError(reply, "Google account email is not verified", 403);
              }
              const rawUser: any = await db.raw(
                "SELECT * FROM users WHERE email = ? LIMIT 1",
                [profile.email],
              );
              let user: User | null = Array.isArray(rawUser[0])
                ? (rawUser[0][0] ?? null)
                : (rawUser[0] ?? null);
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
                    new Date().toISOString(),
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

              const frontendBaseUrl = getFrontendBaseUrl();
              // Tokens travel in the URL fragment so they never reach server
              // logs or Referer headers.
              const fragment = new URLSearchParams({ provider: "google" });

              if ((user as any).twoFactorSecret) {
                fragment.set("twoFactorToken", signTwoFactorPendingToken(user.id));
              } else {
                const session = await issueSession(user);
                fragment.set("token", session.token);
                fragment.set("refreshToken", session.refreshToken);
              }

              const redirectUrl = `${frontendBaseUrl}/login#${fragment.toString()}`;
              reply.redirect(redirectUrl);
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
  app.post("/register", { preHandler: rateLimitByIp(authIpLimiter, "register") }, async (req, reply) => {
    return await registerUser(req, reply);
  });

  // --- LOGIN ---
  app.post("/login", async (req, reply) => {
    return await Login(req, reply);
  });

  // --- LOGOUT ---
  app.post("/logout", async (req, reply) => {
    try {
      const token = readBearerToken(req.headers.authorization);
      if (!token) {
        // Even if we cannot identify the user, respond OK so client can clear state
        return sendSuccess(reply, { message: "Logged out" });
      }

      const { userId } = verifyAccessToken(token);

      if (userId) {
        await db("users").where({ id: userId }).update({ online: false });
        await revokeSessions(userId);
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
  app.post("/forgot", { preHandler: rateLimitByIp(authIpLimiter, "forgot") }, async (req, reply) => {
    return await forgotPass(req, reply);
  });

  app.post("/reset-password", { preHandler: rateLimitByIp(authIpLimiter, "reset") }, async (req, reply) => {
    return await resetPass(req, reply);
  });

  const limitTwoFactorByUser = async (req: any, reply: any) => {
    if (rejectIfLimited(twoFactorLimiter, `2fa:${req.user?.id}`, reply)) return reply;
  };

  // --- 2FA SETUP ---
  app.post("/2fa/setup", { preHandler: authenticate }, async (req, reply) => {
    return await faSetup(req, reply);
  });

  // --- 2FA VERIFY ---
  app.post(
    "/2fa/verify",
    { preHandler: [authenticate, limitTwoFactorByUser] },
    async (req, reply) => {
      return await faVerify(req, reply);
    },
  );

  // --- 2FA LOGIN (second step after Google OAuth) ---
  app.post("/2fa/login", async (req, reply) => {
    try {
      const { twoFactorToken, code } = (req.body ?? {}) as {
        twoFactorToken?: string;
        code?: string;
      };

      let userId: string;
      try {
        userId = verifyTwoFactorPendingToken(String(twoFactorToken ?? ""));
      } catch {
        return sendError(reply, "2FA session expired, please log in again", 401);
      }

      if (rejectIfLimited(twoFactorLimiter, `2fa:${userId}`, reply)) return;

      const user = await db("users")
        .select("id", "username", "email", "twoFactorSecret")
        .where({ id: userId })
        .first();
      if (!user || !user.twoFactorSecret) {
        return sendError(reply, "2FA session expired, please log in again", 401);
      }

      if (!verifyTotp(user.twoFactorSecret, code)) {
        return sendError(reply, "Invalid 2FA code", 401);
      }

      twoFactorLimiter.reset(`2fa:${userId}`);
      return sendSuccess(reply, await issueSession(user));
    } catch (err: any) {
      app.log.error(err);
      return sendError(reply, "Internal server error", 500);
    }
  });

  // --- 2FA DISABLE ---
  app.post(
    "/2fa/disable",
    { preHandler: [authenticate, limitTwoFactorByUser] },
    async (req, reply) => {
      try {
        const userId = String((req as any).user?.id ?? "");
        const { code } = (req.body ?? {}) as { code?: string };

        const user = await db("users")
          .select("twoFactorSecret")
          .where({ id: userId })
          .first();
        if (!user?.twoFactorSecret) {
          return sendError(reply, "2FA is not enabled", 400);
        }
        if (!verifyTotp(user.twoFactorSecret, code)) {
          return sendError(reply, "Invalid 2FA code", 401);
        }

        await db("users")
          .where({ id: userId })
          .update({ twoFactorSecret: null, tempTwoFactorSecret: null });

        return sendSuccess(reply, { message: "2FA disabled" });
      } catch (err: any) {
        app.log.error(err);
        return sendError(reply, "Failed to disable 2FA", 500);
      }
    },
  );
}
