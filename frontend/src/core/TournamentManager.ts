import type { TournamentParticipant } from '../components/tournament/TournamentForm';

export interface TournamentMatch {
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

export interface Tournament {
    id: string;
    name: string;
    status: "active" | "completed";
    winner_id: string | null;
    player_count: number;
    participants: TournamentParticipant[];
    matches: TournamentMatch[];
}

export class TournamentManager {
    private static instance: TournamentManager;
    private currentTournament: Tournament | null = null;

    private constructor() {
        try {
            const saved = localStorage.getItem('pong_tournament');
            if (saved) {
                const data = JSON.parse(saved);
                this.currentTournament = data.tournament || null;
                this.resolveAutoAiMatchesIfLocal();
                this.updateTournamentCompletion();
                this.saveState();
            }
        } catch (error) {
            console.warn('Failed to load local tournament state:', error);
            this.currentTournament = null;
        }
    }

    public static getInstance(): TournamentManager {
        if (!TournamentManager.instance) {
            TournamentManager.instance = new TournamentManager();
        }
        return TournamentManager.instance;
    }

    /**
     * Start a new local tournament with real users or AI
     */
    public startLocalTournament(participants: TournamentParticipant[], tournamentId?: string) {
        const tid = tournamentId || `local-${Date.now()}`;
        
        // Create matches
        const matches: TournamentMatch[] = [];
        let matchNumber = 1;

        // Semi-finals (Round 1)
        for (let i = 0; i < participants.length; i += 2) {
            if (i + 1 < participants.length) {
                matches.push({
                    id: `match-${matchNumber}`,
                    tournament_id: tid,
                    player1_id: participants[i].id,
                    player2_id: participants[i + 1].id,
                    winner_id: null,
                    player1_score: 0,
                    player2_score: 0,
                    status: "pending",
                    round: 1,
                    match_number: matchNumber++,
                });
            }
        }

        // Finals (Round 2)
        matches.push({
            id: `match-${matchNumber}`,
            tournament_id: tid,
            player1_id: "",
            player2_id: "",
            winner_id: null,
            player1_score: 0,
            player2_score: 0,
            status: "pending",
            round: 2,
            match_number: 1,
        });

        this.currentTournament = {
            id: tid,
            name: `Local Tournament ${new Date().toLocaleDateString()}`,
            status: "active",
            winner_id: null,
            player_count: participants.length,
            participants,
            matches,
        };

        this.resolveAutoAiMatchesIfLocal();
        this.updateTournamentCompletion();
        this.saveState();
    }

    /**
     * Set a backend tournament as current
     */
    public setCurrentTournament(tournament: Tournament) {
        this.currentTournament = tournament;
        this.saveState();
    }

    public getCurrentTournament(): Tournament | null {
        return this.currentTournament;
    }

    public getMatches(): TournamentMatch[] {
        return this.currentTournament?.matches || [];
    }

    public getMatch(matchId: string): TournamentMatch | undefined {
        return this.currentTournament?.matches.find(m => m.id === matchId);
    }

    /**
     * Get participant name by id
     */
    public getParticipantName(id: string): string {
        const participant = this.currentTournament?.participants.find(p => p.id === id);
        return participant?.username || id;
    }

    /**
     * Update match result (local state)
     */
    public submitResult(
        matchId: string,
        winnerId: string,
        player1Score: number,
        player2Score: number
    ) {
        if (!this.currentTournament) return;
        if (!winnerId) return;

        const match = this.currentTournament.matches.find(m => m.id === matchId);
        if (!match) return;
        if (match.status === "completed") return;
        if (winnerId !== match.player1_id && winnerId !== match.player2_id) return;

        this.completeMatch(match, winnerId, player1Score, player2Score);
        this.resolveAutoAiMatchesIfLocal();
        this.updateTournamentCompletion();
        this.saveState();
    }

    private completeMatch(
        match: TournamentMatch,
        winnerId: string,
        player1Score: number,
        player2Score: number
    ): void {
        if (!this.currentTournament) return;

        match.winner_id = winnerId;
        match.player1_score = player1Score;
        match.player2_score = player2Score;
        match.status = "completed";

        // Update next round match with winner
        const nextRoundMatches = this.currentTournament.matches.filter(m => m.round === match.round + 1);
        if (nextRoundMatches.length > 0) {
            const nextMatch = nextRoundMatches[0];
            if (!nextMatch.player1_id) {
                nextMatch.player1_id = winnerId;
            } else if (!nextMatch.player2_id) {
                nextMatch.player2_id = winnerId;
            }
            if (nextMatch.player1_id && nextMatch.player2_id) {
                nextMatch.status = "pending";
            }
        }
    }

    private resolveAutoAiMatchesIfLocal(): void {
        if (!this.currentTournament) return;
        if (!this.currentTournament.id.startsWith('local-')) return;

        let resolvedAny = true;
        while (resolvedAny) {
            resolvedAny = false;

            for (const match of this.currentTournament.matches) {
                if (match.status !== "pending") continue;
                if (!match.player1_id || !match.player2_id) continue;

                const p1 = this.currentTournament.participants.find(p => p.id === match.player1_id);
                const p2 = this.currentTournament.participants.find(p => p.id === match.player2_id);

                if (!p1?.isAI || !p2?.isAI) continue;

                const winnerId = Math.random() < 0.5 ? match.player1_id : match.player2_id;
                const player1Score = winnerId === match.player1_id ? 1 : 0;
                const player2Score = winnerId === match.player2_id ? 1 : 0;

                this.completeMatch(match, winnerId, player1Score, player2Score);
                resolvedAny = true;
                break;
            }
        }
    }

    private updateTournamentCompletion(): void {
        if (!this.currentTournament) return;

        // Check if tournament is complete
        const allMatches = this.currentTournament.matches;
        const finalMatch = allMatches[allMatches.length - 1];
        if (finalMatch.status === "completed") {
            this.currentTournament.status = "completed";
            this.currentTournament.winner_id = finalMatch.winner_id;
        } else {
            this.currentTournament.status = "active";
            this.currentTournament.winner_id = null;
        }
    }

    /**
     * Get tournament winner name
     */
    public getTournamentWinner(): string | null {
        if (!this.currentTournament?.winner_id) return null;
        return this.getParticipantName(this.currentTournament.winner_id);
    }

    public clear() {
        this.currentTournament = null;
        localStorage.removeItem('pong_tournament');
    }

    private saveState() {
        if (this.currentTournament) {
            localStorage.setItem('pong_tournament', JSON.stringify({
                tournament: this.currentTournament
            }));
        }
    }
}
