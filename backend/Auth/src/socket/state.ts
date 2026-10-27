import { randomBytes } from "crypto";
import { Lobby } from "../game/Lobby.js";
import db from "../db.js";
import { getAllowedOrigins } from "../utils/frontendUrl.js";

// Socket state shared by the connection, lobby and tournament handlers.
export const socketToUserMap = new Map<string, string>();
export const userToSocketsMap = new Map<string, Set<string>>();

export type LocalTournamentSnapshot = {
  id: string;
  name: string;
  status: "active" | "completed";
  winner_id: string | null;
  player_count: number;
  participants: Array<{
    id: string;
    username: string;
    isAI?: boolean;
  }>;
  matches: Array<{
    id: string;
    tournament_id: string;
    player1_id: string;
    player2_id: string;
    winner_id: string | null;
    player1_score: number;
    player2_score: number;
    status: "pending" | "in_progress" | "completed";
    round: number;
    match_number: number;
  }>;
};

export const lobbiesRegistry = new Map<
  string,
  { lobby: Lobby; code?: string; isPrivate: boolean; createdAt: number }
>();
export const inviteLobbies = new Map<string, Lobby>();
export const inviteSessionToLobbyId = new Map<string, string>();
export const inviteLobbyIdToSession = new Map<string, string>();
export const activeLobbyBySocket = new Map<string, string>();

export async function setUserOnlineStatus(userId: string, online: boolean): Promise<void> {
  try {
    if (!userId) return;
    if (online) {
      await db("users")
        .where({ id: userId })
        .update({ online: true, last_request: new Date().toISOString() });
      return;
    }
    await db("users").where({ id: userId }).update({ online: false });
  } catch (error) {
    console.warn("Failed to update user online status:", error);
  }
}

export function getSocketCorsOrigin(): true | string[] {
  const override = String(process.env.SOCKET_CORS_ORIGIN || "").trim();
  // "*" stays available as an explicit opt-in for local debugging.
  if (override === "*") return true;
  return getAllowedOrigins(override);
}
export function normalizeLobbyCode(raw?: string): string {
  return (raw || "").trim().toUpperCase();
}

export function generateLobbyId(): string {
  return randomBytes(9).toString("base64url");
}

export function isLocalTournamentSnapshot(value: unknown): value is LocalTournamentSnapshot {
  if (!value || typeof value !== "object") return false;
  const data = value as Partial<LocalTournamentSnapshot>;
  if (!data.id || typeof data.id !== "string") return false;
  if (!Array.isArray(data.participants) || !Array.isArray(data.matches)) return false;
  return true;
}

export function encodeTournamentSnapshot(snapshot: LocalTournamentSnapshot | undefined): string {
  if (!snapshot) return "";
  try {
    return Buffer.from(JSON.stringify(snapshot), "utf8").toString("base64url");
  } catch (error) {
    console.warn("Failed to encode local tournament snapshot:", error);
    return "";
  }
}
