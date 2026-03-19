import { AbstractComponent } from '../core/Component';
import { GameScene } from '../client/GameScene';
import { socketService } from '../client/SocketService';
import { navigateTo } from '../core/AppRouter';
import { UserStore } from '../core/UserStore';
import { TournamentManager, type Tournament } from '../core/TournamentManager';
import { TournamentService } from '../services/TournamentService';
import type { Socket } from 'socket.io-client';

export class GamePage extends AbstractComponent {
  private gameScene: GameScene | null = null;
  private gameStartHandler: (() => void) | null = null;
  private returnToMenuHandler: ((event: Event) => void) | null = null;
  private statsUpdateHandler: ((event: Event) => void) | null = null;
  private recordErrorHandler: ((event: Event) => void) | null = null;
  private tournamentWaitingHandler: ((payload: { matchId: string; message: string }) => void) | null = null;
  private tournamentErrorHandler: ((payload: { message?: string }) => void) | null = null;
  private tournamentId: string | null;
  private matchId: string | null;
  private p1Id: string | null;
  private p2Id: string | null;
  private tournamentInviteToken: string | null;
  private isTokenBasedTournamentJoin = false;
  private hasSubmittedTournamentResult = false;
  private lastReportedWinnerSide: "A" | "B" | null = null;
  private tournamentStatusEl: HTMLDivElement | null = null;

  constructor() {
    super('div', 'flex flex-col h-screen bg-black overflow-hidden');
    const params = new URLSearchParams(window.location.search);
    this.tournamentId = params.get('tournamentId');
    this.matchId = params.get('matchId');
    this.p1Id = params.get('p1');
    this.p2Id = params.get('p2');
    this.tournamentInviteToken = params.get('tournamentInviteToken');
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

    if ((this.tournamentId && this.matchId) || this.tournamentInviteToken) {
      this.tournamentStatusEl = document.createElement('div');
      this.tournamentStatusEl.className = 'absolute top-4 left-1/2 -translate-x-1/2 z-20 rounded bg-black/70 border border-neutral-700 px-4 py-2 text-sm text-neutral-200';
      this.tournamentStatusEl.textContent = 'Setting up tournament match...';
      container.classList.add('relative');
      container.appendChild(this.tournamentStatusEl);
      this.gameStartHandler = () => {
        this.tournamentStatusEl?.remove();
        this.tournamentStatusEl = null;
        if (this.gameStartHandler) {
          window.removeEventListener('game-start', this.gameStartHandler);
          this.gameStartHandler = null;
        }
      };
      window.addEventListener('game-start', this.gameStartHandler);
    }

    this.element.appendChild(container);

    void this.initializeGameFlow();
  }

  private async initializeGameFlow(): Promise<void> {
    const inviteResolved = await this.resolveTournamentInviteToken();
    if (!inviteResolved) {
      return;
    }
    this.hydrateLocalTournamentStateFromUrl();

    this.gameScene = new GameScene();
    const currentUser = UserStore.getUser();
    const userId = currentUser?.id;
    const socket: Socket =
      socketService.getSocket() ?? socketService.init(undefined, userId);

    this.gameScene.startConnection(socket);
    socket.emit('requestGameInit');
    this.setupTournamentSocketFlow(socket);
    this.setupReturnToMenuListener();
  }

    /**
     * Resolve secure tournament invite token into concrete tournament match context.
     */
    private async resolveTournamentInviteToken(): Promise<boolean> {
        if (!this.tournamentInviteToken) {
            return true;
        }

        if (this.tournamentStatusEl) {
            this.tournamentStatusEl.textContent = 'Validating tournament invite...';
        }

        try {
            const invite = await TournamentService.acceptInvite(this.tournamentInviteToken);
            this.tournamentId = invite.tournamentId;
            this.matchId = invite.matchId;
            this.p1Id = invite.player1_id;
            this.p2Id = invite.player2_id;
            this.isTokenBasedTournamentJoin = true;
            return true;
        } catch (error: any) {
            const message = error?.response?.data?.error || error?.message || 'Failed to validate invite token.';
            if (this.tournamentStatusEl) {
                this.tournamentStatusEl.textContent = message;
            }
            window.alert(message);
            navigateTo('/tournament');
            return false;
        }
    }

    /**
     * Setup listener for when user returns to main menu from game
     */
    private setupReturnToMenuListener(): void {
        
        this.removeMatchResultListeners();

        this.statsUpdateHandler = async (event: Event) => {
            console.log('📊 Match stats updated, invalidating cache');
            UserStore.invalidateCache();

            // If this is a tournament match, submit the result
            if (this.tournamentId && this.matchId) {
                await this.submitTournamentResult(event);
            }
        };
        
        
        this.recordErrorHandler = (event: Event) => {
            const customEvent = event as CustomEvent;
            console.warn('⚠️ Encountered error recording match:', customEvent.detail?.message);
            
        };
        
        window.addEventListener('match-stats-updated', this.statsUpdateHandler);
        window.addEventListener('match-recording-error', this.recordErrorHandler);

        this.returnToMenuHandler = (_event: Event) => {
            void (async () => {
              console.log('Game page received return to menu event');
              if (this.returnToMenuHandler) {
                window.removeEventListener('game-return-to-menu', this.returnToMenuHandler);
                this.returnToMenuHandler = null;
              }

              // Give async match-recording events a short window to arrive before teardown.
              if (this.tournamentId && this.matchId && !this.hasSubmittedTournamentResult) {
                await this.wait(500);
                if (!this.hasSubmittedTournamentResult) {
                  await this.submitTournamentResultFromFallback();
                }
              }

              this.removeMatchResultListeners();

              if (this.gameScene) {
                if (this.tournamentWaitingHandler) {
                  this.gameScene.socket?.off('tournamentMatchWaiting', this.tournamentWaitingHandler);
                  this.tournamentWaitingHandler = null;
                }
                if (this.tournamentErrorHandler) {
                  this.gameScene.socket?.off('error', this.tournamentErrorHandler);
                  this.tournamentErrorHandler = null;
                }
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
            })();
        };

        window.addEventListener('game-return-to-menu', this.returnToMenuHandler);
    }

    private async submitTournamentResult(event: Event): Promise<void> {
        if (!this.tournamentId || !this.matchId) return;
        if (this.hasSubmittedTournamentResult) return;

        const customEvent = event as CustomEvent;
        const { winner } = customEvent.detail || {};

        if (winner !== 'A' && winner !== 'B') {
            console.warn('⚠️ Missing match result data');
            return;
        }
        this.lastReportedWinnerSide = winner;
        await this.submitTournamentResultByWinner(winner);
    }

    private async submitTournamentResultByWinner(winner: "A" | "B"): Promise<void> {
        if (!this.tournamentId || !this.matchId) return;
        if (this.hasSubmittedTournamentResult) return;
        try {
            const tournamentManager = TournamentManager.getInstance();
            const match = tournamentManager.getMatch(this.matchId);

            if (!match) {
                console.warn('⚠️ Tournament match not found locally');
                return;
            }

            // Determine winner ID based on the winner returned (A or B)
            const winnerId = winner === 'A' ? match.player1_id : match.player2_id;
            if (!winnerId) {
                console.warn('⚠️ Missing winner player id for tournament match');
                return;
            }
            const player1Score = winner === 'A' ? 1 : 0;
            const player2Score = winner === 'B' ? 1 : 0;

            // Update local tournament state
            tournamentManager.submitResult(
                this.matchId,
                winnerId,
                player1Score,
                player2Score
            );
            this.emitLocalTournamentStateUpdate(tournamentManager);
            this.hasSubmittedTournamentResult = true;

            console.log('✅ Tournament match result submitted');
        } catch (error) {
            console.error('❌ Error submitting tournament result:', error);
        }
    }

    private async submitTournamentResultFromFallback(): Promise<void> {
        const winner = this.lastReportedWinnerSide ?? this.gameScene?.getTournamentWinnerSide() ?? null;
        if (!winner) {
            console.warn('⚠️ Could not infer tournament winner on return-to-menu fallback');
            return;
        }
        await this.submitTournamentResultByWinner(winner);
    }

    private wait(ms: number): Promise<void> {
      return new Promise((resolve) => window.setTimeout(resolve, ms));
    }

    private emitLocalTournamentStateUpdate(tournamentManager: TournamentManager): void {
      if (!this.tournamentId || !this.tournamentId.startsWith('local-')) return;
      const snapshot = tournamentManager.getCurrentTournament();
      if (!snapshot || snapshot.id !== this.tournamentId) return;
      this.gameScene?.socket?.emit('localTournamentStateUpdate', {
        tournamentId: this.tournamentId,
        tournament_snapshot: snapshot,
      });
    }

    private hydrateLocalTournamentStateFromUrl(): void {
      if (!this.tournamentId || !this.tournamentId.startsWith('local-')) return;

      const manager = TournamentManager.getInstance();
      const current = manager.getCurrentTournament();
      const hasMatchingTournament = current?.id === this.tournamentId;
      const hasMatch =
        Boolean(this.matchId) &&
        Boolean(this.matchId && manager.getMatch(this.matchId));
      if (hasMatchingTournament && hasMatch) {
        return;
      }

      const params = new URLSearchParams(window.location.search);
      const encodedState = params.get('tState');
      if (!encodedState) return;

      const snapshot = this.decodeTournamentSnapshot(encodedState);
      if (!snapshot) return;
      if (snapshot.id !== this.tournamentId) return;

      manager.setCurrentTournament(snapshot);
    }

    private decodeTournamentSnapshot(encodedState: string): Tournament | null {
      try {
        const normalized = encodedState.replace(/-/g, '+').replace(/_/g, '/');
        const padLength = (4 - (normalized.length % 4)) % 4;
        const padded = normalized + '='.repeat(padLength);
        const binary = window.atob(padded);
        const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
        const decoded = new TextDecoder().decode(bytes);
        const parsed = JSON.parse(decoded) as Tournament;
        if (!this.isValidTournamentSnapshot(parsed)) return null;
        return parsed;
      } catch (error) {
        console.warn('Failed to decode tournament snapshot from URL:', error);
        return null;
      }
    }

    private isValidTournamentSnapshot(snapshot: unknown): snapshot is Tournament {
      if (!snapshot || typeof snapshot !== 'object') return false;
      const value = snapshot as Tournament;
      if (!value.id || !Array.isArray(value.participants) || !Array.isArray(value.matches)) {
        return false;
      }
      return true;
    }

  private setupTournamentSocketFlow(socket: Socket): void {
    if (!this.tournamentId || !this.matchId || !this.p1Id || !this.p2Id) return;
    if (this.tournamentId.startsWith('local-')) {
      const manager = TournamentManager.getInstance();
      const p1Name = manager.getParticipantName(this.p1Id);
      const p2Name = manager.getParticipantName(this.p2Id);
      const currentTournament = manager.getCurrentTournament();

      this.tournamentWaitingHandler = (payload: { matchId: string; message: string }) => {
        if (payload.matchId !== this.matchId) return;
        if (this.tournamentStatusEl) {
          this.tournamentStatusEl.textContent = payload.message || 'Waiting for opponent to join...';
        }
      };
      this.tournamentErrorHandler = (payload: { message?: string }) => {
        if (this.tournamentStatusEl) {
          this.tournamentStatusEl.textContent = payload?.message || 'Failed to start local tournament match.';
        }
      };

      socket.on('tournamentMatchWaiting', this.tournamentWaitingHandler);
      socket.on('error', this.tournamentErrorHandler);
      if (this.tournamentStatusEl) {
        this.tournamentStatusEl.textContent = 'Starting local tournament match...';
      }

      socket.emit('requestLocalTournamentMatch', {
        tournamentId: this.tournamentId,
        matchId: this.matchId,
        player1_id: this.p1Id,
        player2_id: this.p2Id,
        player1_name: p1Name,
        player2_name: p2Name,
        tournament_snapshot:
          currentTournament?.id === this.tournamentId
            ? currentTournament
            : undefined,
      });
      return;
    }

    const manager = TournamentManager.getInstance();
    const tournament = manager.getCurrentTournament();
    const p1Participant = tournament?.participants.find(p => p.id === this.p1Id);
    const p2Participant = tournament?.participants.find(p => p.id === this.p2Id);

    // Backend tournament socket flow supports authenticated human users only.
    if (p1Participant?.isAI || p2Participant?.isAI) {
      if (this.tournamentStatusEl) {
        this.tournamentStatusEl.textContent = 'AI tournament matches are not wired to online game rooms yet.';
      }
      return;
    }

    this.tournamentWaitingHandler = (payload: { matchId: string; message: string }) => {
      if (payload.matchId !== this.matchId) return;
      if (this.tournamentStatusEl) {
        this.tournamentStatusEl.textContent = payload.message || 'Waiting for opponent to join...';
      }
    };

    this.tournamentErrorHandler = (payload: { message?: string }) => {
      if (this.tournamentStatusEl) {
        this.tournamentStatusEl.textContent = payload?.message || 'Failed to setup tournament match.';
      }
    };

    socket.on('tournamentMatchWaiting', this.tournamentWaitingHandler);
    socket.on('error', this.tournamentErrorHandler);

    const eventName = this.isTokenBasedTournamentJoin ? 'joinTournamentMatch' : 'requestTournamentMatch';
    socket.emit(eventName, {
      tournamentId: this.tournamentId,
      matchId: this.matchId,
    });
  }

  public onDestroy(): void {
    if (this.gameStartHandler) {
      window.removeEventListener('game-start', this.gameStartHandler);
      this.gameStartHandler = null;
    }

    this.removeMatchResultListeners();

    if (this.returnToMenuHandler) {
      window.removeEventListener('game-return-to-menu', this.returnToMenuHandler);
      this.returnToMenuHandler = null;
    }

    if (this.gameScene) {
      if (this.tournamentWaitingHandler) {
        this.gameScene.socket?.off('tournamentMatchWaiting', this.tournamentWaitingHandler);
        this.tournamentWaitingHandler = null;
      }
      if (this.tournamentErrorHandler) {
        this.gameScene.socket?.off('error', this.tournamentErrorHandler);
        this.tournamentErrorHandler = null;
      }
      this.gameScene.dispose();
      this.gameScene = null;
    }
  }

  private removeMatchResultListeners(): void {
    if (this.statsUpdateHandler) {
      window.removeEventListener('match-stats-updated', this.statsUpdateHandler);
      this.statsUpdateHandler = null;
    }
    if (this.recordErrorHandler) {
      window.removeEventListener('match-recording-error', this.recordErrorHandler);
      this.recordErrorHandler = null;
    }
  }
}
