const INVALIDATED_EVENT = 'tournament-invite-invalidated';

export interface TournamentInviteInvalidatedPayload {
  version: number;
  tournamentId: string;
  matchId: string;
  invalidatedToken: string;
  supersededByToken: string;
  reason: 'superseded';
  requestedBy: string;
  invalidatedAt: number;
}

class TournamentInviteState {
  private static invalidatedTokens = new Set<string>();

  public static markInvalidated(payload: TournamentInviteInvalidatedPayload): void {
    const token = String(payload?.invalidatedToken || '').trim();
    if (!token) return;

    this.invalidatedTokens.add(token);
    window.dispatchEvent(
      new CustomEvent<TournamentInviteInvalidatedPayload>(INVALIDATED_EVENT, {
        detail: payload,
      }),
    );
  }

  public static isTokenInvalidated(token: string | null | undefined): boolean {
    if (!token) return false;
    return this.invalidatedTokens.has(token);
  }

  public static getInvalidatedEventName(): string {
    return INVALIDATED_EVENT;
  }
}

export { TournamentInviteState };
