import { AbstractComponent } from '../core/Component';
import { Navbar } from '../components/layout/Navbar';
import { TournamentForm, type TournamentParticipant } from '../components/tournament/TournamentForm';
import { TournamentBracket } from '../components/tournament/TournamentBracket';
import { TournamentManager } from '../core/TournamentManager';

export class TournamentPage extends AbstractComponent {
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

    const manager = TournamentManager.getInstance();
    const currentTournament = manager.getCurrentTournament();

    if (!currentTournament) {
      // Show form to create new tournament
      const form = new TournamentForm((participants: TournamentParticipant[]) => {
        manager.startLocalTournament(participants);
        this.render(); 
      });
      form.render();
      container.appendChild(form.getElement());
    } else {
      // Show bracket
      const bracket = new TournamentBracket(currentTournament.matches);
      bracket.render();
      container.appendChild(bracket.getElement());

     
      const resetBtn = document.createElement('button');
      resetBtn.className = 'mt-12 text-gray-500 hover:text-red-500 text-sm underline';
      resetBtn.textContent = 'Reset Tournament Data';
      resetBtn.onclick = () => {
          if(confirm('Are you sure? This will delete the current tournament.')) {
            manager.clear();
            this.render();
          }
      };
      container.appendChild(resetBtn);
    }

    this.element.appendChild(container);
  }
}