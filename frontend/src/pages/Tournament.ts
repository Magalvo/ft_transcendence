import { AbstractComponent } from '../core/Component';
import { Navbar } from '../components/layout/Navbar';
import { TournamentForm, type TournamentParticipant } from '../components/tournament/TournamentForm';
import { TournamentBracket } from '../components/tournament/TournamentBracket';
import { TournamentManager } from '../core/TournamentManager';
import { UserService } from '../services/UserService';

export class TournamentPage extends AbstractComponent {
  private navbar: Navbar | null = null;
  private bootstrapToken = 0;
  private destroyed = false;

  constructor() {
    super('div', 'min-h-screen bg-gray-900 text-white');
  }

  public render(): void {
    this.destroyed = false;
    this.destroyOwnedUi();
    this.element.innerHTML = '';

    this.navbar = new Navbar();
    this.navbar.render();
    this.element.appendChild(this.navbar.getElement());

    const container = document.createElement('div');
    container.className = 'container mx-auto p-6 mt-10 flex flex-col items-center';
    container.innerHTML = '<div class="text-gray-300">Loading tournament data...</div>';
    this.element.appendChild(container);

    const token = ++this.bootstrapToken;
    void this.bootstrap(container, token);
  }

  private async bootstrap(container: HTMLElement, token: number): Promise<void> {
    try {
      await UserService.getProfile();
    } catch (error) {
      console.warn('Tournament page profile hydration failed:', error);
    }

    if (this.destroyed || token !== this.bootstrapToken) {
      return;
    }

    container.innerHTML = '';

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
  }

  public onDestroy(): void {
    this.destroyed = true;
    this.bootstrapToken += 1;
    this.destroyOwnedUi();
  }

  private destroyOwnedUi(): void {
    this.navbar?.onDestroy();
    this.navbar = null;
  }
}
