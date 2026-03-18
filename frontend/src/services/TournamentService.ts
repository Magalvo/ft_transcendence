import { ApiClient } from "./ApiClient";

export interface AcceptedTournamentInvitePayload {
  tournamentId: string;
  matchId: string;
  player1_id: string;
  player2_id: string;
  player1_name: string;
  player2_name: string;
  expiresAt: number;
}

export class TournamentService {
  static async acceptInvite(token: string): Promise<AcceptedTournamentInvitePayload> {
    const response = await ApiClient.post("/api/tournaments/invites/accept", { token });
    return response.data?.data as AcceptedTournamentInvitePayload;
  }
}
