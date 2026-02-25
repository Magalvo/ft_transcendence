import { AbstractComponent } from '../core/Component';
import { Navbar } from '../components/layout/Navbar';
import { GameScene } from '../client/GameScene';
import { socketService } from '../client/SocketService';
import type { Socket } from 'socket.io-client';

// GamePage no longer contains lobby UI/types; lobby moved to LobbyPage

export class GamePage extends AbstractComponent {
    private gameScene: GameScene | null = null;
    private gameView: HTMLElement | null = null;

    constructor() {
        super('div', 'flex flex-col h-screen bg-black overflow-hidden');
    }

    public render(): void {
        this.element.innerHTML = '';

        const navbar = new Navbar();
        navbar.render();
        this.element.appendChild(navbar.getElement());

        const container = document.createElement('div');
        container.className = 'flex-1 w-full h-full overflow-hidden bg-neutral-900 text-white';
        container.innerHTML = `
            <div id="game-view" class="h-full w-full">
                <canvas id="renderCanvas" class="h-full w-full outline-none"></canvas>
            </div>
        `;

        this.gameView = container.querySelector('#game-view');

        this.element.appendChild(container);

        // Lazy create game scene and reuse shared socket if available
        this.gameScene = new GameScene();
        const s: Socket = socketService.getSocket() ?? socketService.init('http://localhost:3000');
        this.gameScene.startConnection(s);
        s.emit('requestGameInit');
    }
    public onDestroy(): void {
        if (this.gameScene) {
            this.gameScene.dispose();
            this.gameScene = null;
        }
    }
}