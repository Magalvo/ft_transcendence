import { AbstractComponent } from '../core/Component';
import { GameScene } from '../client/GameScene';
import { socketService } from '../client/SocketService';
import { navigateTo } from '../core/AppRouter';
import { UserStore } from '../core/UserStore';
import type { Socket } from 'socket.io-client';

export class GamePage extends AbstractComponent {
  private gameScene: GameScene | null = null;
  private returnToMenuHandler: ((event: Event) => void) | null = null;

  constructor() {
    super('div', 'flex flex-col h-screen bg-black overflow-hidden');
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

  private setupReturnToMenuListener(): void {
    const statsUpdateHandler = (_event: Event) => {
      console.log('Match stats updated, invalidating cache');
      UserStore.invalidateCache();
    };

    const recordErrorHandler = (event: Event) => {
      const customEvent = event as CustomEvent;
      console.warn('Encountered error recording match:', customEvent.detail?.message);
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

      navigateTo('/dashboard');
    };

    window.addEventListener('game-return-to-menu', this.returnToMenuHandler);
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
