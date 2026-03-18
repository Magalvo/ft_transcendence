import { AbstractComponent } from "../../core/Component";
import { navigateTo } from "../../core/AppRouter";
import { TournamentMatch } from "../../core/TournamentManager";

export class TournamentBracket extends AbstractComponent {
  private matches: TournamentMatch[];

  constructor(matches: TournamentMatch[]) {
    super("div", "flex flex-col items-center justify-center space-y-8 w-full");
    this.matches = matches;
  }

  public render(): void {
    this.element.innerHTML = "";

    const title = document.createElement("h3");
    title.className = "text-2xl font-bold mb-4 text-gray-200";
    title.textContent = "Tabela de classificação";
    this.element.appendChild(title);

    const bracketContainer = document.createElement("div");
    bracketContainer.className = "flex flex-wrap justify-center gap-12";

    this.matches.forEach((match) => {
      const matchCard = document.createElement("div");
      matchCard.className =
        "bg-gray-700 p-4 rounded-lg border border-gray-600 w-64 relative";

      const p1Display = match.p1 === 'TBD' ? '?' : match.p1;
      const p2Display = match.p2 === 'TBD' ? '?' : match.p2;

      matchCard.innerHTML = `
        <div class="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-gray-900 px-3 py-1 text-xs text-gray-400 rounded-full border border-gray-700">
            MATCH ${match.id}
        </div>
        <div class="mt-2 space-y-2">
            <div class="flex justify-between items-center p-2 rounded ${match.winner === match.p1 ? "bg-green-900/50 text-green-400" : "bg-gray-800"}">
                <span>${p1Display}</span>
                ${match.winner === match.p1 && match.winner !== null ? "<span>🏆</span>" : ""}
            </div>
            <div class="text-center text-xs text-gray-500 font-bold">VS</div>
            <div class="flex justify-between items-center p-2 rounded ${match.winner === match.p2 ? "bg-green-900/50 text-green-400" : "bg-gray-800"}">
                <span>${p2Display}</span>
                ${match.winner === match.p2 && match.winner !== null ? "<span>🏆</span>" : ""}
            </div>
        </div>
      `;


      if (!match.winner && match.p1 !== "TBD" && match.p2 !== "TBD") {
        const playBtn = document.createElement("button");
        playBtn.className = "mt-4 w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded transition";
        playBtn.textContent = "JOGAR PARTIDA";
        playBtn.onclick = () => {
          navigateTo(`/game?matchId=${match.id}&p1=${match.p1}&p2=${match.p2}`);
        };
        matchCard.appendChild(playBtn);
      }

      bracketContainer.appendChild(matchCard);
    });

    this.element.appendChild(bracketContainer);
  }
}
