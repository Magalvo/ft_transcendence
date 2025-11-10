import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import db from "../db.js";
import speakeasy from "speakeasy";
import qrcode from "qrcode";
import crypto from "crypto";
import { sendMail } from "../utils/email.js";
import fastifyOauth2 from "@fastify/oauth2";
import { sendSuccess, sendError } from "../utils/respond.js";

// Interfaces
interface User {
  id: string;
  username: string;
  passwordHash?: string | null;
  twoFactorSecret?: string | null;
  tempTwoFactorSecret?: string | null;
  email?: string | null;
  online: boolean;
  resetToken?: string | null;
  resetExpires?: string | null;
}

interface RefreshToken {
  id: number;
  username: string;
  token: string;
  expires_at: string;
}

interface DecodedToken {
  username: string;
  email?: string;
}

export default async function authRoutes(app: FastifyInstance) {
  const JWT_SECRET = process.env.JWT_SECRET!;
  const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
  const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
  const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || "";

  // --- Middleware ---
  const authenticate = async (
  req: FastifyRequest,
  reply: FastifyReply
): Promise<DecodedToken | null> => {
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
    const decoded = jwt.verify(token, JWT_SECRET) as DecodedToken;

    if (!decoded.username) {
      sendError(reply, "Invalid token payload", 401);
      return null;
    }

    return decoded;
  } catch (err: any) {
    console.error("JWT verification failed:", err.message);
    sendError(reply, "Invalid or expired token", 401);
    return null;
  }
};


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

            const profile = await userInfoRes.json();
            const rawUser: any = await db.raw("SELECT * FROM users WHERE email = ? LIMIT 1", [profile.email]);
            let user: User | null = Array.isArray(rawUser[0]) ? rawUser[0][0] ?? null : rawUser[0] ?? null;

            if (!user) {
              const id = crypto.randomUUID();
              await db.raw("INSERT INTO users (id, username, email, online) VALUES (?, ?, ?, ?)", [
                id, profile.name ?? profile.email, profile.email, true,
              ]);
              user = { id, username: profile.name ?? profile.email, email: profile.email, online: true };
            }

            const jwtToken = jwt.sign({ username: user.username, email: user.email }, JWT_SECRET, { expiresIn: "1h" });
            reply.redirect(`http://localhost:3000/?token=${jwtToken}`);
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
  try {
    const { username, password, email } = req.body as { username: string; password: string; email: string };
    if (!username || !password || !email) return sendError(reply, "Username, password and email are required", 400);

    const rawUser: any = await db.raw("SELECT * FROM users WHERE username = ? OR email = ? LIMIT 1", [username, email]);
    const existingUser: User | null = Array.isArray(rawUser[0]) ? rawUser[0][0] ?? null : rawUser[0] ?? null;
    if (existingUser) return sendError(reply, "Username or email already exists", 409);

    const passwordHash = await bcrypt.hash(password, 10);
    const id = crypto.randomUUID();
    await db.raw("INSERT INTO users (id, username, passwordHash, email, online) VALUES (?, ?, ?, ?, ?)", [
      id, username, passwordHash, email, false,
    ]);

    // JWT & Refresh token
    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: "1h" });
    const refreshToken = crypto.randomBytes(64).toString("hex");
    const expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await db.raw("INSERT INTO refresh_tokens (username, token, expires_at) VALUES (?, ?, ?)", [username, refreshToken, expires_at]);

    // Return token + QR in same response
    sendSuccess(reply, { token, refreshToken, message: "User registered successfully. Scan the QR for 2FA." }, 201);
  } catch (err: any) {
    app.log.error(err);
    sendError(reply, "Internal server error", 500);
  }
});

  // --- LOGIN ---
  app.post("/login", async (req, reply) => {
    try {
      const { username, password, twoFactorCode } = req.body as { username: string; password: string; twoFactorCode?: string };
      const rawUser: any = await db.raw("SELECT * FROM users WHERE username = ? LIMIT 1", [username]);
      const user: User | null = Array.isArray(rawUser[0]) ? rawUser[0][0] ?? null : rawUser[0] ?? null;

      if (!user || !user.passwordHash) return sendError(reply, "Invalid credentials", 401);

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) return sendError(reply, "Invalid credentials", 401);

      if (user.twoFactorSecret) {
        if (!twoFactorCode) return sendError(reply, "2FA code required", 400);

        const verified = speakeasy.totp.verify({ secret: user.twoFactorSecret, encoding: "base32", token: twoFactorCode });
        if (!verified) return sendError(reply, "Invalid 2FA code", 401);
      }

      const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: "1h" });
      const refreshToken = crypto.randomBytes(64).toString("hex");
      const expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      await db.raw("INSERT INTO refresh_tokens (username, token, expires_at) VALUES (?, ?, ?)", [username, refreshToken, expires_at]);
      await db.raw("UPDATE users SET online = ? WHERE username = ?", [true, username]);

      sendSuccess(reply, { token, refreshToken });
    } catch (err: any) {
      app.log.error(err);
      sendError(reply, "Internal server error", 500);
    }
  });

  // --- REFRESH TOKEN ---
  app.post("/token/refresh", async (req, reply) => {
    try {
      const { refreshToken } = req.body as { refreshToken: string };
      const rawStored: any = await db.raw("SELECT * FROM refresh_tokens WHERE token = ? LIMIT 1", [refreshToken]);
      const stored: RefreshToken | undefined = Array.isArray(rawStored[0]) ? rawStored[0][0] : undefined;

      if (!stored || new Date(stored.expires_at) < new Date()) return sendError(reply, "Invalid or expired token", 401);

      const newToken = jwt.sign({ username: stored.username }, JWT_SECRET, { expiresIn: "1h" });
      sendSuccess(reply, { token: newToken });
    } catch (err: any) {
      app.log.error(err);
      sendError(reply, "Internal server error", 500);
    }
  });

  // --- FORGOT / RESET PASSWORD ---
  app.post("/forgot", async (req, reply) => {
    try {
      const { email } = req.body as { email: string };
      const rawUser: any = await db.raw("SELECT * FROM users WHERE email = ? LIMIT 1", [email]);
      const user: User | null = Array.isArray(rawUser[0]) ? rawUser[0][0] ?? null : rawUser[0] ?? null;

      if (!user) return sendError(reply, "User not found", 404);

      const token = crypto.randomBytes(32).toString("hex");
      const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();

      await db.raw("UPDATE users SET resetToken = ?, resetExpires = ? WHERE email = ?", [token, expires, email]);
      const link = `http://localhost:3000/reset-password.html?token=${token}`;
      await sendMail(email, "Password Reset", `<p>Click here to reset your password:</p><a href="${link}">${link}</a>`);

      sendSuccess(reply, { message: "Password reset email sent" });
    } catch (err: any) {
      app.log.error(err);
      sendError(reply, "Internal server error", 500);
    }
  });

  app.post("/reset-password", async (req, reply) => {
    try {
      const { token, newPassword } = req.body as { token: string; newPassword: string };
      if (!token || !newPassword) return sendError(reply, "Token and new password are required", 400);

      const rawUser: any = await db.raw("SELECT * FROM users WHERE resetToken = ? LIMIT 1", [token]);
      const user: User | null = Array.isArray(rawUser[0]) ? rawUser[0][0] ?? null : rawUser[0] ?? null;

      if (!user) return sendError(reply, "Invalid token", 400);
      if (!user.resetExpires || new Date(user.resetExpires) < new Date()) return sendError(reply, "Token expired", 400);

      const passwordHash = await bcrypt.hash(newPassword, 10);
      await db.raw("UPDATE users SET passwordHash = ?, resetToken = NULL, resetExpires = NULL WHERE id = ?", [passwordHash, user.id]);

      sendSuccess(reply, { message: "Password has been reset successfully" });
    } catch (err: any) {
      app.log.error(err);
      sendError(reply, "Internal server error", 500);
    }
  });

  // --- 2FA SETUP ---
  app.post("/2fa/setup", async (req, reply) => {
  try {
    const decoded = await authenticate(req, reply);
    if (!decoded) return;

    const rawUser: any = await db.raw("SELECT * FROM users WHERE username = ? LIMIT 1", [decoded.username]);
    const user: User | null = Array.isArray(rawUser[0]) ? rawUser[0][0] ?? null : rawUser[0] ?? null;
    if (!user) return sendError(reply, "User not found", 404);

    const secret = speakeasy.generateSecret({ name: `FT Transcendence (${user.username})` });
    await db.raw("UPDATE users SET tempTwoFactorSecret = ? WHERE username = ?", [secret.base32, user.username]);

    const otpauthUrl = secret.otpauth_url ?? speakeasy.otpauthURL({
      secret: secret.base32,
      label: `FT Transcendence (${user.username})`,
      encoding: "base32",
    });

    const qr = await qrcode.toDataURL(otpauthUrl);

    sendSuccess(reply, { qr, secret: secret.base32, message: "Scan this QR code with your authenticator app" });
  } catch (err: any) {
    app.log.error(err);
    sendError(reply, "Internal server error", 500);
  }
});


  // --- 2FA VERIFY ---
  app.post("/2fa/verify", async (req, reply) => {
    try {
      const decoded = await authenticate(req, reply);
      if (!decoded) return;

      const { code } = req.body as { code: string };
      const rawUser: any = await db.raw("SELECT * FROM users WHERE username = ? LIMIT 1", [decoded.username]);
      const user: User | null = Array.isArray(rawUser[0]) ? rawUser[0][0] ?? null : rawUser[0] ?? null;

      if (!user || !user.tempTwoFactorSecret) return sendError(reply, "No 2FA setup in progress", 400);

      const verified = speakeasy.totp.verify({
        secret: user.tempTwoFactorSecret,
        encoding: "base32",
        token: code,
        window: 1,
      });

      if (!verified) return sendError(reply, "Invalid code", 401);

      await db.raw("UPDATE users SET twoFactorSecret = ?, tempTwoFactorSecret = NULL WHERE username = ?", [
        user.tempTwoFactorSecret,
        user.username,
      ]);

      sendSuccess(reply, { message: "2FA enabled successfully" });
    } catch (err: any) {
      app.log.error(err);
      sendError(reply, "Internal server error", 500);
    }
  });
}
