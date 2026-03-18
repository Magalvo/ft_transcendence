import { AbstractComponent } from '../core/Component';
import { GameScene } from '../client/GameScene';
import { socketService } from '../client/SocketService';
import { navigateTo } from '../core/AppRouter';
import { UserStore } from '../core/UserStore';
import { TournamentManager } from '../core/TournamentManager';
import type { Socket } from 'socket.io-client';

export class GamePage extends AbstractComponent {
  private gameScene: GameScene | null = null;
  private returnToMenuHandler: ((event: Event) => void) | null = null;
  private tournamentId: string | null;
  private matchId: string | null;
  private p1Id: string | null;
  private p2Id: string | null;

  constructor() {
    super('div', 'flex flex-col h-screen bg-black overflow-hidden');
    const params = new URLSearchParams(window.location.search);
    this.tournamentId = params.get('tournamentId');
    this.matchId = params.get('matchId');
    this.p1Id = params.get('p1');
    this.p2Id = params.get('p2');
  }

  public render(): void {
    this.element.innerHTML = '';

    const container = document.createElement('div');
    container.className = 'flex-1 w-full h-full overflow-hidden bg-neutral-900 text-white';
    container.innerHTML = `
      <div id="game-view" class="h-full w-full">
        <canvas id="renderCanvas" class="h-full w-full outline-none"></canvas>
      </div>
    `;

    this.element.appendChild(container);

    this.gameScene = new GameScene();
    const currentUser = UserStore.getUser();
    const userId = currentUser?.id;
    const socket: Socket =
      socketService.getSocket() ?? socketService.init(undefined, userId);

    this.gameScene.startConnection(socket);
    socket.emit('requestGameInit');

    this.setupReturnToMenuListener();
  }

    /**
     * Setup listener for when user returns to main menu from game
     */
    private setupReturnToMenuListener(): void {
        
        const statsUpdateHandler = async (event: Event) => {
            console.log('📊 Match stats updated, invalidating cache');
            UserStore.invalidateCache();

            // If this is a tournament match, submit the result
            if (this.tournamentId && this.matchId) {
                await this.submitTournamentResult(event);
            }
        };
        
        
        const recordErrorHandler = (event: Event) => {
            const customEvent = event as CustomEvent;
            console.warn('⚠️ Encountered error recording match:', customEvent.detail?.message);
            
        };
        
        window.addEventListener('match-stats-updated', statsUpdateHandler);
        window.addEventListener('match-recording-error', recordErrorHandler);

        this.returnToMenuHandler = (_event: Event) => {
            console.log('Game page received return to menu event');
            
            window.removeEventListener('match-stats-updated', statsUpdateHandler);
            window.removeEventListener('match-recording-error', recordErrorHandler);
            
            
            if (this.gameScene) {
              this.gameScene.dispose();
              this.gameScene = null;
            }

            console.log('🚀 Navigating to tournament/dashboard from game');

            // Return to tournament if it exists, otherwise dashboard
            if (this.tournamentId) {
              navigateTo('/tournament');
            } else {
              navigateTo('/dashboard');
            }
        };

        window.addEventListener('game-return-to-menu', this.returnToMenuHandler);
    }

    private async submitTournamentResult(event: Event): Promise<void> {
        if (!this.tournamentId || !this.matchId) return;

        const customEvent = event as CustomEvent;
        const { matchId: gameId, winner } = customEvent.detail || {};

        if (!gameId || !winner) {
            console.warn('⚠️ Missing match result data');
            return;
        }

        try {
            const tournamentManager = TournamentManager.getInstance();
            const match = tournamentManager.getMatch(this.matchId);

            if (!match) {
                console.warn('⚠️ Tournament match not found locally');
                return;
            }

            // Determine winner ID based on the winner returned (A or B)
            const winnerId = winner === 'A' ? this.p1Id : this.p2Id;
            const player1Score = winner === 'A' ? 1 : 0;
            const player2Score = winner === 'B' ? 1 : 0;

            // Update local tournament state
            tournamentManager.submitResult(
                this.matchId,
                winnerId || '',
                player1Score,
                player2Score
            );

            console.log('✅ Tournament match result submitted');
        } catch (error) {
            console.error('❌ Error submitting tournament result:', error);
        }
    }

  public onDestroy(): void {
    if (this.returnToMenuHandler) {
      window.removeEventListener('game-return-to-menu', this.returnToMenuHandler);
      this.returnToMenuHandler = null;
    }

    if (this.gameScene) {
      this.gameScene.dispose();
      this.gameScene = null;
    }
  }
}
