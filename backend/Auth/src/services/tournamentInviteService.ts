import crypto from "crypto";
import db from "../db.js";

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

  if (!match) throw new Error("Tournament match not found");

  const tournament = await db("tournaments")
    .where({ id: tournamentId })
    .first();

  if (!tournament) throw new Error("Tournament not found");
  if (tournament.status !== "active") throw new Error("Tournament is not active");

  if (match.status === "completed") {
    throw new Error("Tournament match is already completed");
  }

  if (!match.player1_id || !match.player2_id) {
    throw new Error("Tournament match is not ready yet");
  }

  return { match, tournament };
}

async function ensureUserCanTriggerInvite(tournamentId: string, userId: string): Promise<void> {
  const participant = await db("tournament_participants")
    .where({ tournament_id: tournamentId, user_id: userId })
    .first();
  if (!participant) throw new Error("Only tournament participants can send invites");
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
    throw new Error("Only match participants can send invites");
  }
  const expiresAt = now + INVITE_TTL_MS;

  // Replace active pending invites so each request has fresh tokens.
  await db("tournament_match_invites")
    .where({ tournament_id: tournamentId, match_id: matchId, status: "pending" })
    .update({ status: "expired" });

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

  await db("tournament_match_invites").insert(invites);
  const names = await getPlayerNames(players[0], players[1]);

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
  };
}

export async function acceptTournamentInvite(token: string, userId: string): Promise<AcceptedTournamentInvite> {
  if (!token) throw new Error("Invite token is required");

  const invite = await db("tournament_match_invites")
    .where({ invite_token: token })
    .first();

  if (!invite) throw new Error("Invite not found");
  if (String(invite.to_user_id) !== userId) throw new Error("Invite does not belong to this user");

  const now = Date.now();
  if (invite.status !== "pending") throw new Error("Invite is no longer valid");
  if (Number(invite.expires_at) <= now) {
    await db("tournament_match_invites")
      .where({ id: invite.id, status: "pending" })
      .update({ status: "expired" });
    throw new Error("Invite has expired");
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
