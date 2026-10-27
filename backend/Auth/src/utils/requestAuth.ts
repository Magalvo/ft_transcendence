import { readBearerToken, verifyAccessToken } from "./tokens.js";

// Resolves the user id from the request's Bearer token. Throws (with a
// message the routes map to a 401) when the token is missing or invalid.
export function getAuthUserId(req: any): string {
  const token = readBearerToken(req.headers.authorization);
  if (!token) {
    throw new Error("Missing or invalid Authorization header");
  }
  try {
    return verifyAccessToken(token).userId;
  } catch {
    throw new Error("Missing or invalid Authorization header");
  }
}
