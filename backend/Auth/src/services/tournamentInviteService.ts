import crypto from "crypto";
import db from "../db.js";
import { HttpError } from "../utils/httpError.js";

const INVITE_TTL_MS = 15 * 60 * 1000;

export interface TournamentInviteDispatchResult {
  tournamentId: string;
  matchId: string;
  player1_id: string;
  player2_id: string;
  player1_name: string;
  player2_name: string;
  invites: Array<{
    toUserId: string;
    token: string;
    expiresAt: number;
  }>;
  invalidatedInvites: Array<{
    toUserId: string;
    token: string;
    invalidatedAt: number;
    reason: "superseded";
    supersededByToken: string;
  }>;
}

export interface AcceptedTournamentInvite {
  tournamentId: string;
  matchId: string;
  player1_id: string;
  player2_id: string;
  player1_name: string;
  player2_name: string;
  expiresAt: number;
}

async function getMatchWithTournament(tournamentId: string, matchId: string) {
  const match = await db("tournament_matches")
    .where({ id: matchId, tournament_id: tournamentId })
    .first();

  if (!match) throw new HttpError("Tournament match not found");

  const tournament = await db("tournaments")
    .where({ id: tournamentId })
    .first();

  if (!tournament) throw new HttpError("Tournament not found");
  if (tournament.status !== "active") throw new HttpError("Tournament is not active");

  if (match.status === "completed") {
    throw new HttpError("Tournament match is already completed");
  }

  if (!match.player1_id || !match.player2_id) {
    throw new HttpError("Tournament match is not ready yet");
  }

  return { match, tournament };
}

async function ensureUserCanTriggerInvite(tournamentId: string, userId: string): Promise<void> {
  const participant = await db("tournament_participants")
    .where({ tournament_id: tournamentId, user_id: userId })
    .first();
  if (!participant) throw new HttpError("Only tournament participants can send invites");
}

async function getPlayerNames(player1Id: string, player2Id: string) {
  const users = await db("users")
    .whereIn("id", [player1Id, player2Id])
    .select("id", "username");
  const byId = new Map<string, string>(users.map((u: any) => [String(u.id), String(u.username)]));
  return {
    player1_name: byId.get(player1Id) || player1Id,
    player2_name: byId.get(player2Id) || player2Id,
  };
}

export async function createTournamentMatchInvites(
  tournamentId: string,
  matchId: string,
  requestedBy: string
): Promise<TournamentInviteDispatchResult> {
  await ensureUserCanTriggerInvite(tournamentId, requestedBy);
  const { match } = await getMatchWithTournament(tournamentId, matchId);

  const now = Date.now();
  await db("tournament_match_invites")
    .where({ tournament_id: tournamentId, match_id: matchId, status: "pending" })
    .andWhere("expires_at", "<=", now)
    .update({ status: "expired" });

  const players = [String(match.player1_id), String(match.player2_id)];
  if (!players.includes(requestedBy)) {
    throw new HttpError("Only match participants can send invites");
  }
  const expiresAt = now + INVITE_TTL_MS;

  const priorPendingInvites = await db("tournament_match_invites")
    .where({ tournament_id: tournamentId, match_id: matchId, status: "pending" })
    .whereIn("to_user_id", players)
    .select("id", "to_user_id", "invite_token");

  const invites = players.map((toUserId) => ({
    id: crypto.randomUUID(),
    tournament_id: tournamentId,
    match_id: matchId,
    to_user_id: toUserId,
    requested_by: requestedBy,
    invite_token: crypto.randomUUID(),
    status: "pending",
    sent_at: now,
    expires_at: expiresAt,
    accepted_at: null,
  }));

  // Replace active pending invites so each target user has a single active token per match.
  if (priorPendingInvites.length > 0) {
    const priorIds = priorPendingInvites.map((invite: any) => invite.id);
    await db("tournament_match_invites")
      .whereIn("id", priorIds)
      .where({ status: "pending" })
      .update({ status: "superseded" });
  }

  await db("tournament_match_invites").insert(invites);
  const names = await getPlayerNames(players[0], players[1]);

  const latestTokenByUser = new Map<string, string>(
    invites.map((invite) => [invite.to_user_id, invite.invite_token]),
  );
  const invalidatedInvites = priorPendingInvites
    .map((invite: any) => {
      const toUserId = String(invite.to_user_id);
      const supersededByToken = latestTokenByUser.get(toUserId);
      if (!supersededByToken) return null;
      return {
        toUserId,
        token: String(invite.invite_token),
        invalidatedAt: now,
        reason: "superseded" as const,
        supersededByToken,
      };
    })
    .filter(Boolean) as TournamentInviteDispatchResult["invalidatedInvites"];

  return {
    tournamentId,
    matchId,
    player1_id: players[0],
    player2_id: players[1],
    player1_name: names.player1_name,
    player2_name: names.player2_name,
    invites: invites.map((i) => ({
      toUserId: i.to_user_id,
      token: i.invite_token,
      expiresAt: i.expires_at,
    })),
    invalidatedInvites,
  };
}

export async function acceptTournamentInvite(token: string, userId: string): Promise<AcceptedTournamentInvite> {
  if (!token) throw new HttpError("Invite token is required");

  const invite = await db("tournament_match_invites")
    .where({ invite_token: token })
    .first();

  if (!invite) throw new HttpError("Invite not found");
  if (String(invite.to_user_id) !== userId) throw new HttpError("Invite does not belong to this user");

  const now = Date.now();
  if (invite.status === "superseded") {
    throw new HttpError("Invite has been superseded by a newer token");
  }
  if (invite.status !== "pending") throw new HttpError("Invite is no longer valid");
  if (Number(invite.expires_at) <= now) {
    await db("tournament_match_invites")
      .where({ id: invite.id, status: "pending" })
      .update({ status: "expired" });
    throw new HttpError("Invite has expired");
  }

  const { match } = await getMatchWithTournament(String(invite.tournament_id), String(invite.match_id));
  const names = await getPlayerNames(String(match.player1_id), String(match.player2_id));

  await db("tournament_match_invites")
    .where({ id: invite.id, status: "pending" })
    .update({
      status: "accepted",
      accepted_at: now,
    });

  return {
    tournamentId: String(invite.tournament_id),
    matchId: String(invite.match_id),
    player1_id: String(match.player1_id),
    player2_id: String(match.player2_id),
    player1_name: names.player1_name,
    player2_name: names.player2_name,
    expiresAt: Number(invite.expires_at),
  };
}
