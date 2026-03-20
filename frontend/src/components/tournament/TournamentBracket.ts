import { AbstractComponent } from "../../core/Component";
import { navigateTo } from "../../core/AppRouter";
import { TournamentMatch } from "../../core/TournamentManager";
import { TournamentManager } from "../../core/TournamentManager";
import { UserStore } from "../../core/UserStore";
import { TokenManager } from "../../services/TokenManager";

export class TournamentBracket extends AbstractComponent {
  private matches: TournamentMatch[];
  private tournamentManager: TournamentManager;

  constructor(matches: TournamentMatch[]) {
    super("div", "flex flex-col items-center justify-center space-y-8 w-full");
    this.matches = matches;
    this.tournamentManager = TournamentManager.getInstance();
  }

  public render(): void {
    this.element.innerHTML = "";
    const currentUserId =
      UserStore.getUser()?.id || TokenManager.getUser()?.id || null;

    const title = document.createElement("h3");
    title.className = "text-2xl font-bold mb-4 text-gray-200";
    title.textContent = "Tournament Bracket";
    this.element.appendChild(title);

    const bracketContainer = document.createElement("div");
    bracketContainer.className = "flex flex-wrap justify-center gap-8";

    // Group matches by round
    const matchesByRound = new Map<number, TournamentMatch[]>();
    this.matches.forEach((match) => {
      const round = match.round || 1;
      if (!matchesByRound.has(round)) {
        matchesByRound.set(round, []);
      }
      matchesByRound.get(round)!.push(match);
    });

    // Render matches round by round
    Array.from(matchesByRound.entries())
      .sort(([a], [b]) => a - b)
      .forEach(([round, roundMatches]) => {
        const roundContainer = document.createElement("div");
        roundContainer.className = "flex flex-col space-y-4";

        const roundLabel = document.createElement("div");
        roundLabel.className = "text-center text-gray-400 text-sm font-bold mb-2";
        roundLabel.textContent = `Round ${round}`;
        roundContainer.appendChild(roundLabel);

        roundMatches.forEach((match) => {
          const matchCard = document.createElement("div");
          matchCard.className =
            "bg-gray-700 p-4 rounded-lg border border-gray-600 w-72 relative";

          const p1Name = match.player1_id && match.player1_id.trim() ? this.tournamentManager.getParticipantName(match.player1_id) : "?";
          const p2Name = match.player2_id && match.player2_id.trim() ? this.tournamentManager.getParticipantName(match.player2_id) : "?";
          const p1Display = match.player1_id && match.player1_id.trim() ? p1Name : "TBD";
          const p2Display = match.player2_id && match.player2_id.trim() ? p2Name : "TBD";

          matchCard.innerHTML = `
            <div class="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-gray-900 px-3 py-1 text-xs text-gray-400 rounded-full border border-gray-700">
                MATCH ${match.match_number}
            </div>
            <div class="mt-2 space-y-2">
                <div class="flex justify-between items-center p-2 rounded ${match.winner_id === match.player1_id ? "bg-green-900/50 text-green-400" : "bg-gray-800"}">
                    <span>${p1Display}</span>
                    ${match.winner_id === match.player1_id && match.winner_id !== null ? "<span class='text-yellow-400'>🏆</span>" : ""}
                </div>
                <div class="text-center text-xs text-gray-500 font-bold">VS</div>
                <div class="flex justify-between items-center p-2 rounded ${match.winner_id === match.player2_id ? "bg-green-900/50 text-green-400" : "bg-gray-800"}">
                    <span>${p2Display}</span>
                    ${match.winner_id === match.player2_id && match.winner_id !== null ? "<span class='text-yellow-400'>🏆</span>" : ""}
                </div>
                ${match.status === "completed" ? `
                  <div class="text-center text-xs text-gray-400 mt-2">
                    Score: ${match.player1_score} - ${match.player2_score}
                  </div>
                ` : ""}
            </div>
          `;


      const isPendingMatch = !match.winner_id && Boolean(match.player1_id) && Boolean(match.player2_id);
      const isCurrentUserInMatch =
        Boolean(currentUserId) &&
        (match.player1_id === currentUserId || match.player2_id === currentUserId);

      if (isPendingMatch && isCurrentUserInMatch) {
        const playBtn = document.createElement("button");
        playBtn.className = "mt-4 w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded transition";
        playBtn.textContent = "PLAY";
        playBtn.onclick = () => {
          navigateTo(`/game?matchId=${match.id}&p1=${match.player1_id}&p2=${match.player2_id}&tournamentId=${match.tournament_id}`);
        };
        matchCard.appendChild(playBtn);
      }

          roundContainer.appendChild(matchCard);
        });

        bracketContainer.appendChild(roundContainer);
      });

    this.element.appendChild(bracketContainer);

    // Show tournament status
    const tournament = this.tournamentManager.getCurrentTournament();
    if (tournament?.status === "completed" && tournament.winner_id) {
      const winnerName = this.tournamentManager.getTournamentWinner();
      const statusDiv = document.createElement("div");
      statusDiv.className =
        "mt-8 p-6 bg-gradient-to-r from-yellow-900 to-yellow-800 rounded-lg border border-yellow-600 text-center";
      statusDiv.innerHTML = `
        <div class="text-yellow-400 text-sm font-bold mb-2">TOURNAMENT COMPLETE</div>
        <div class="text-2xl font-bold text-white">🏆 ${winnerName} wins! 🏆</div>
      `;
      this.element.appendChild(statusDiv);
    }
  }
}
