import { AbstractComponent } from '../core/Component';
import { Navbar } from '../components/layout/Navbar';
import { PongGame } from '../game/PongGame';

export class GamePage extends AbstractComponent {
  private gameInstance: PongGame | null = null;

  constructor() {

    super('div', 'h-screen w-full bg-black flex flex-col');
  }

  public render(): void {
    this.element.innerHTML = '';

    const navbar = new Navbar();
    navbar.render();
    this.element.appendChild(navbar.getElement());

    
    const gameContainer = document.createElement('div');
    gameContainer.className = 'flex-1 relative overflow-hidden'; 

 
    const canvas = document.createElement('canvas');
    canvas.id = 'renderCanvas';
    canvas.className = 'w-full h-full outline-none';
    
    gameContainer.appendChild(canvas);
    this.element.appendChild(gameContainer);


    const params = new URLSearchParams(window.location.search);
    const player1 = params.get('p1') || 'Player 1';
    const player2 = params.get('p2') || 'Player 2';

    setTimeout(() => {
      this.gameInstance = new PongGame(canvas);
    }, 0);
  }

 
  public onDestroy(): void {
    if (this.gameInstance) {
      console.log('Cleaning up Babylon Game...');
      this.gameInstance.dispose();
      this.gameInstance = null;
    }
  }
}