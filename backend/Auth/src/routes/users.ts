import type { FastifyInstance } from "fastify";
import { access, mkdir, unlink, writeFile } from "fs/promises";
import { basename, join } from "path";
import db from "../db.js";
import { sendError } from "../utils/respond.js";
import { getAuthUserId } from "../utils/requestAuth.js";
import { detectImageExtension } from "../utils/image.js";
import {
  getPlayerStats,
  getPlayerMatches,
  getMatchDetails,
} from "../services/matchService.js";
import UserProfileResponseDTO from "../dto/userProfile.response.dto.js";
import UserStatsDTO from "../dto/userStats.dto.js";
import {
  USERNAME_PATTERN,
  USERNAME_PATTERN_MESSAGE,
} from "../dto/userRegister.dto.js";

const AVATARS_PATH =
  process.env.AVATARS_PATH || join(process.cwd(), "public/avatars");

// Profile, avatar, username, stats and match history. Registered in the same
// scope as the auth routes because avatar uploads need the multipart plugin.
export default async function userRoutes(app: FastifyInstance) {
  // --- GET CURRENT USER ---
  app.get("/me", async (req, reply) => {
    try {
      const decoded = { userId: getAuthUserId(req) };

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

      let decoded: { userId: string };
      try {
        decoded = { userId: getAuthUserId(req) };
      } catch {
        return sendError(reply, "Missing or invalid Authorization header", 401);
      }

      const data = await (req as any).file();

      if (!data) {
        return sendError(reply, "No file uploaded", 400);
      }

      const buffer = await data.toBuffer();
      const ext = detectImageExtension(buffer);
      if (!ext) {
        return sendError(reply, "Only JPEG, PNG, WEBP, and GIF avatars are allowed", 400);
      }
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
      return sendError(reply, "Avatar upload failed", 500);
    }
  });

  // --- UPDATE USERNAME ---
  const updateUsernameHandler = async (req: any, reply: any) => {
    try {
      let decoded: { userId: string };
      try {
        decoded = { userId: getAuthUserId(req) };
      } catch {
        return sendError(reply, "Missing or invalid Authorization header", 401);
      }

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
      if (!USERNAME_PATTERN.test(normalized)) {
        return sendError(reply, USERNAME_PATTERN_MESSAGE, 400);
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
      return sendError(reply, "Failed to update username", 500);
    }
  };
  app.patch("/users/username", updateUsernameHandler);
  // Compatibility route for environments where PATCH is blocked by proxy/CORS.
  app.post("/users/username", updateUsernameHandler);

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
      return sendError(reply, "Failed to fetch stats", 500);
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
      return sendError(reply, "Failed to fetch matches", 500);
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
      return sendError(reply, "Failed to fetch match", 500);
    }
  });
}
