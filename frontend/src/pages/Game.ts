import { AbstractComponent } from '../core/Component';
import { Navbar } from '../components/layout/Navbar';
import { GameScene } from '../client/GameScene'; 
import { TournamentManager } from '../core/TournamentManager'; 

export class GamePage extends AbstractComponent {
    private gameScene: GameScene | null = null;

    constructor() {
        super('div', 'flex flex-col h-screen bg-black overflow-hidden');
    }

    public render(): void {
        this.element.innerHTML = '';

        const navbar = new Navbar();
        navbar.render();
        this.element.appendChild(navbar.getElement());

        const container = document.createElement('div');
        container.className = 'flex-1 relative w-full h-full';

        const canvas = document.createElement('canvas');
        canvas.id = 'renderCanvas';
        canvas.className = 'w-full h-full outline-none block';
        canvas.tabIndex = 1;

        container.appendChild(canvas);
        this.element.appendChild(container);

        const params = new URLSearchParams(window.location.search);
        const matchId = params.get('matchId');
        const p1 = params.get('p1');
        const p2 = params.get('p2');  
        setTimeout(() => {
            this.gameScene = new GameScene(canvas);

            this.gameScene.onGameOver = (winnerSide: string) => {
                if (matchId && p1 && p2) {
                  
                    const winnerName = (winnerSide === 'left') ? p1 : p2;
                    
                    if (winnerName) {
                        console.log(`Match ${matchId} Winner: ${winnerName}`);
                        
                        
                        TournamentManager.getInstance().submitResult(parseInt(matchId), winnerName);
                        
                        alert(`${winnerName} wins! Returning to bracket...`);
                        
                      
                        window.history.pushState({}, '', '/tournament');
                        window.dispatchEvent(new PopStateEvent("popstate"));
                    }
                } else {
                   
                    alert(`Game Over! Winner: ${winnerSide.toUpperCase()}`);
                }
            };

         
            this.gameScene.startGame();
            canvas.focus();
        }, 0);
    }

    public onDestroy(): void {
        if (this.gameScene) {
            this.gameScene.dispose();
            this.gameScene = null;
        }
    }
}