import jwt from "jsonwebtoken";
import crypto from "crypto";

export type AccessTokenPayload = {
  userId: string;
  email?: string;
};

const TWO_FACTOR_PENDING_PURPOSE = "2fa-pending";

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT secret is not configured");
  return secret;
}

export function readBearerToken(header?: string): string | undefined {
  if (!header) return undefined;
  const token = String(header).replace(/^Bearer\s+/i, "").trim();
  return token || undefined;
}

export function signAccessToken(userId: string, email?: string): string {
  return jwt.sign({ userId, email }, getJwtSecret(), {
    algorithm: "HS256",
    expiresIn: "1h",
  });
}

// Access tokens carry no `purpose` claim. Tokens minted for other uses
// (SpacedOut sessions, pending 2FA logins) must never authenticate API calls.
export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, getJwtSecret(), {
    algorithms: ["HS256"],
  }) as jwt.JwtPayload;

  if (decoded.purpose !== undefined || typeof decoded.userId !== "string") {
    throw new jwt.JsonWebTokenError("invalid token");
  }

  return { userId: decoded.userId, email: decoded.email };
}

export function signTwoFactorPendingToken(userId: string): string {
  return jwt.sign(
    { userId, purpose: TWO_FACTOR_PENDING_PURPOSE },
    getJwtSecret(),
    { algorithm: "HS256", expiresIn: "5m" },
  );
}

export function verifyTwoFactorPendingToken(token: string): string {
  const decoded = jwt.verify(token, getJwtSecret(), {
    algorithms: ["HS256"],
  }) as jwt.JwtPayload;

  if (
    decoded.purpose !== TWO_FACTOR_PENDING_PURPOSE ||
    typeof decoded.userId !== "string"
  ) {
    throw new jwt.JsonWebTokenError("invalid token");
  }

  return decoded.userId;
}

// Refresh and password-reset tokens are stored hashed so a DB leak does not
// hand out usable credentials.
export function hashToken(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}
