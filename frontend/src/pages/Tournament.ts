import { AbstractComponent } from '../core/Component';
import { TournamentForm } from '../components/tournament/TournamentForm';
import { TournamentBracket } from '../components/tournament/TournamentBracket';
import { Navbar } from '../components/layout/Navbar';

export class TournamentPage extends AbstractComponent {
  private isStarted = false;
  private matches: any[] = [];

  constructor() {
    super('div', 'min-h-screen bg-gray-900 text-white');
  }

  public render(): void {
    this.element.innerHTML = '';

    const navbar = new Navbar();
    navbar.render();
    this.element.appendChild(navbar.getElement());

    const container = document.createElement('div');
    container.className = 'container mx-auto p-6 mt-10 flex flex-col items-center';

    if (!this.isStarted) {
      
      const form = new TournamentForm((aliases) => {
        this.generateBracket(aliases);
      });
      form.render();
      container.appendChild(form.getElement());
    } else {
     
      const bracket = new TournamentBracket(this.matches);
      bracket.render();
      container.appendChild(bracket.getElement());
    }

    this.element.appendChild(container);
  }

  private generateBracket(aliases: string[]) {
   
    this.matches = [
      { player1: aliases[0], player2: aliases[1], winner: null },
      { player1: aliases[2], player2: aliases[3], winner: null }
    ];
    
    this.isStarted = true;
    this.render(); 
  }
}