export interface TournamentMatch {
    id: number;
    p1: string;
    p2: string;
    winner: string | null;
    nextMatchId: number | null;
}

export class TournamentManager {
    private static instance: TournamentManager;
    private participants: string[] = [];
    private matches: TournamentMatch[] = [];
    private currentMatchIndex: number = 0;

    private constructor() {
        const saved = localStorage.getItem('pong_tournament');
        if (saved) {
            const data = JSON.parse(saved);
            this.participants = data.participants;
            this.matches = data.matches;
        }
    }

    public static getInstance(): TournamentManager {
        if (!TournamentManager.instance) {
            TournamentManager.instance = new TournamentManager();
        }
        return TournamentManager.instance;
    }

    public startTournament(aliases: string[]) {
        this.participants = aliases;
        
        this.matches = [
            { id: 1, p1: aliases[0], p2: aliases[1], winner: null, nextMatchId: 3 },
            { id: 2, p1: aliases[2], p2: aliases[3], winner: null, nextMatchId: 3 },
            { id: 3, p1: 'TBD', p2: 'TBD', winner: null, nextMatchId: null }
        ];
        
        this.saveState();
    }

    public getMatches(): TournamentMatch[] {
        return this.matches;
    }

    public submitResult(matchId: number, winnerAlias: string) {
        const match = this.matches.find(m => m.id === matchId);
        if (!match) return;

        match.winner = winnerAlias;

        if (match.nextMatchId) {
            const nextMatch = this.matches.find(m => m.id === match.nextMatchId);
            if (nextMatch) {
              
                if (nextMatch.p1 === 'TBD') nextMatch.p1 = winnerAlias;
                else nextMatch.p2 = winnerAlias;
            }
        }

        this.saveState();
    }

    private saveState() {
        localStorage.setItem('pong_tournament', JSON.stringify({
            participants: this.participants,
            matches: this.matches
        }));
    }

    public clear() {
        localStorage.removeItem('pong_tournament');
        this.matches = [];
        this.participants = [];
    }
}