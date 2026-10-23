import crypto from "crypto";
import db from "../db.js";
import { hashToken, signAccessToken } from "../utils/tokens.js";

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
// How long the previous refresh token keeps working after a rotation, so two
// tabs refreshing at the same time do not log each other out.
export const REFRESH_ROTATION_GRACE_MS = 60 * 1000;

function newRefreshToken() {
  const refreshToken = crypto.randomBytes(64).toString("hex");
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS).toISOString();
  return { refreshToken, expiresAt };
}

export async function issueSession(user: {
  id: string;
  username: string;
  email?: string | null;
}): Promise<{ token: string; refreshToken: string }> {
  const token = signAccessToken(user.id, user.email ?? undefined);
  const { refreshToken, expiresAt } = newRefreshToken();
  const nowIso = new Date().toISOString();

  const existing = await db("refresh_tokens")
    .select("id")
    .where({ userId: user.id })
    .first();

  if (existing) {
    await db("refresh_tokens")
      .where({ userId: user.id })
      .update({
        token: hashToken(refreshToken),
        previous_token: null,
        rotated_at: null,
        expires_at: expiresAt,
        last_update: nowIso,
      });
  } else {
    await db("refresh_tokens").insert({
      username: user.username,
      userId: user.id,
      token: hashToken(refreshToken),
      expires_at: expiresAt,
      last_update: nowIso,
    });
  }

  await db("users")
    .where({ id: user.id })
    .update({ online: true, last_request: nowIso });

  return { token, refreshToken };
}

export type RotateResult =
  | { status: "rotated"; token: string; refreshToken: string }
  | { status: "grace"; token: string }
  | { status: "invalid" };

// Exchanges a refresh token for a new access token and a new refresh token.
// The previous token stays valid for a short grace period (concurrent tabs);
// presenting it after that is treated as theft and revokes the session.
export async function rotateSession(presented: string): Promise<RotateResult> {
  const presentedHash = hashToken(presented);
  const now = Date.now();

  const current = await db("refresh_tokens")
    .select("userId", "expires_at")
    .where({ token: presentedHash })
    .first();

  if (current) {
    if (new Date(current.expires_at).getTime() < now) {
      return { status: "invalid" };
    }

    const { refreshToken, expiresAt } = newRefreshToken();
    const nowIso = new Date(now).toISOString();
    const updated = await db("refresh_tokens")
      .where({ userId: current.userId, token: presentedHash })
      .update({
        token: hashToken(refreshToken),
        previous_token: presentedHash,
        rotated_at: nowIso,
        expires_at: expiresAt,
        last_update: nowIso,
      });

    // Another request rotated this token first: fall through to the grace path.
    if (updated === 1) {
      return {
        status: "rotated",
        token: signAccessToken(current.userId),
        refreshToken,
      };
    }
  }

  const previous = await db("refresh_tokens")
    .select("userId", "rotated_at", "expires_at")
    .where({ previous_token: presentedHash })
    .first();

  if (!previous) {
    return { status: "invalid" };
  }

  const rotatedAt = new Date(previous.rotated_at).getTime();
  const withinGrace =
    Number.isFinite(rotatedAt) && now - rotatedAt <= REFRESH_ROTATION_GRACE_MS;

  if (!withinGrace || new Date(previous.expires_at).getTime() < now) {
    await revokeSessions(previous.userId);
    return { status: "invalid" };
  }

  return { status: "grace", token: signAccessToken(previous.userId) };
}

export async function revokeSessions(userId: string): Promise<void> {
  await db("refresh_tokens").where({ userId }).delete();
}
