import { ApiClient } from "./ApiClient";
import type { Tournament } from "../core/TournamentManager";
import type { TournamentParticipant } from "../components/tournament/TournamentForm";

export interface AcceptedTournamentInvitePayload {
  tournamentId: string;
  matchId: string;
  player1_id: string;
  player2_id: string;
  player1_name: string;
  player2_name: string;
  expiresAt: number;
}

interface TournamentApiParticipant {
  id?: string;
  user_id?: string;
  username?: string;
  isAI?: boolean;
}

interface TournamentApiMatch {
  id: string;
  tournament_id: string;
  player1_id: string;
  player2_id: string;
  winner_id: string | null;
  player1_score: number;
  player2_score: number;
  status: "pending" | "in_progress" | "pending_confirmation" | "review_required" | "completed";
  round: number;
  match_number: number;
}

interface TournamentApiPayload {
  id: string;
  name: string;
  status: "active" | "completed";
  winner_id: string | null;
  player_count: number;
  participants: Array<string | TournamentApiParticipant>;
  matches: TournamentApiMatch[];
}

export interface SubmitTournamentMatchResultPayload {
  tournamentId: string;
  matchId: string;
  gameId: string;
  winnerId: string;
  player1Score: number;
  player2Score: number;
  reviewOverride?: boolean;
}

function normalizeParticipant(
  participant: string | TournamentApiParticipant,
): TournamentParticipant {
  if (typeof participant === "string") {
    return {
      id: participant,
      username: participant,
      isAI: false,
    };
  }

  const id = String(participant.id ?? participant.user_id ?? "").trim();
  return {
    id,
    username: String(participant.username ?? id).trim() || id,
    isAI: Boolean(participant.isAI),
  };
}

function normalizeTournament(payload: TournamentApiPayload): Tournament {
  return {
    id: String(payload.id),
    name: String(payload.name),
    status: payload.status === "completed" ? "completed" : "active",
    winner_id: payload.winner_id ? String(payload.winner_id) : null,
    player_count: Number(payload.player_count) || 0,
    participants: Array.isArray(payload.participants)
      ? payload.participants.map(normalizeParticipant)
      : [],
    matches: Array.isArray(payload.matches)
      ? payload.matches.map((match) => ({
          id: String(match.id),
          tournament_id: String(match.tournament_id),
          player1_id: String(match.player1_id ?? ""),
          player2_id: String(match.player2_id ?? ""),
          winner_id: match.winner_id ? String(match.winner_id) : null,
          player1_score: Number(match.player1_score) || 0,
          player2_score: Number(match.player2_score) || 0,
          status: match.status,
          round: Number(match.round) || 0,
          match_number: Number(match.match_number) || 0,
        }))
      : [],
  };
}

export class TournamentService {
  static async acceptInvite(token: string): Promise<AcceptedTournamentInvitePayload> {
    const response = await ApiClient.post("/api/auth/tournaments/invites/accept", { token });
    return response.data?.data as AcceptedTournamentInvitePayload;
  }

  static async getTournament(tournamentId: string): Promise<Tournament> {
    const response = await ApiClient.get(`/api/auth/tournaments/${encodeURIComponent(tournamentId)}`);
    return normalizeTournament(response.data?.data as TournamentApiPayload);
  }

  static async submitMatchResult(
    payload: SubmitTournamentMatchResultPayload,
  ): Promise<any> {
    const response = await ApiClient.post(
      `/api/auth/tournaments/${encodeURIComponent(payload.tournamentId)}/matches/${encodeURIComponent(payload.matchId)}/result`,
      {
        gameId: payload.gameId,
        winnerId: payload.winnerId,
        player1Score: payload.player1Score,
        player2Score: payload.player2Score,
        reviewOverride: Boolean(payload.reviewOverride),
      },
    );
    return response.data?.data;
  }
}
