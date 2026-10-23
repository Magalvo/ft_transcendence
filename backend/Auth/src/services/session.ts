import crypto from "crypto";
import db from "../db.js";
import { hashToken, signAccessToken } from "../utils/tokens.js";

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function issueSession(user: {
  id: string;
  username: string;
  email?: string | null;
}): Promise<{ token: string; refreshToken: string }> {
  const token = signAccessToken(user.id, user.email ?? undefined);
  const refreshToken = crypto.randomBytes(64).toString("hex");
  const nowIso = new Date().toISOString();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS).toISOString();

  const existing = await db("refresh_tokens")
    .select("id")
    .where({ userId: user.id })
    .first();

  if (existing) {
    await db("refresh_tokens")
      .where({ userId: user.id })
      .update({
        token: hashToken(refreshToken),
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

export async function revokeSessions(userId: string): Promise<void> {
  await db("refresh_tokens").where({ userId }).delete();
}
