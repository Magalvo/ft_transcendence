import { AbstractComponent } from '../../core/Component';

interface MatchNode {
  player1: string;
  player2: string;
  winner?: string | null; 
}

export class TournamentBracket extends AbstractComponent {
  private matches: MatchNode[];

  constructor(matches: MatchNode[]) {
    super('div', 'flex flex-col items-center justify-center space-y-8 w-full');
    this.matches = matches;
  }

  public render(): void {
    this.element.innerHTML = '';
    
    const title = document.createElement('h3');
    title.className = 'text-2xl font-bold mb-4 text-gray-200';
    title.textContent = 'Semi-Finals';
    this.element.appendChild(title);

    
    const bracketContainer = document.createElement('div');
    bracketContainer.className = 'flex flex-wrap justify-center gap-12';

    this.matches.forEach((match, index) => {
      const matchCard = document.createElement('div');
      matchCard.className = 'bg-gray-700 p-4 rounded-lg border border-gray-600 w-64 relative';

      
      matchCard.innerHTML = `
        <div class="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-gray-900 px-3 py-1 text-xs text-gray-400 rounded-full border border-gray-700">
            MATCH ${index + 1}
        </div>
        <div class="mt-2 space-y-2">
            <div class="flex justify-between items-center p-2 rounded ${match.winner === match.player1 ? 'bg-green-900/50 text-green-400' : 'bg-gray-800'}">
                <span>${match.player1}</span>
                ${match.winner === match.player1 ? '<span>🏆</span>' : ''}
            </div>
            <div class="text-center text-xs text-gray-500 font-bold">VS</div>
            <div class="flex justify-between items-center p-2 rounded ${match.winner === match.player2 ? 'bg-green-900/50 text-green-400' : 'bg-gray-800'}">
                <span>${match.player2}</span>
                ${match.winner === match.player2 ? '<span>🏆</span>' : ''}
            </div>
        </div>
      `;

      
      if (!match.winner) {
          const playBtn = document.createElement('button');
          playBtn.className = 'mt-3 w-full bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold py-1 rounded transition';
          playBtn.textContent = 'PLAY MATCH';
          playBtn.onclick = () => {
              console.log(`Starting match: ${match.player1} vs ${match.player2}`);
              
              
          };
          matchCard.appendChild(playBtn);
      }

      bracketContainer.appendChild(matchCard);
    });

    this.element.appendChild(bracketContainer);
  }
}