import { AbstractComponent } from '../../core/Component';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';

export class TournamentForm extends AbstractComponent {
  private playerInputs: Input[] = [];
  private onSubmit: (aliases: string[]) => void;

  constructor(onSubmit: (aliases: string[]) => void) {
    super('div', 'bg-gray-800 p-8 rounded-xl shadow-2xl max-w-lg w-full mx-auto');
    this.onSubmit = onSubmit;
  }

  public render(): void {
    this.element.innerHTML = ''; 

    
    const title = document.createElement('h2');
    title.className = 'text-3xl font-bold text-center mb-6 text-blue-400 tracking-wider';
    title.textContent = 'TOURNAMENT REGISTRATION';
    this.element.appendChild(title);

    
    const subtitle = document.createElement('p');
    subtitle.className = 'text-gray-400 text-center mb-8 text-sm';
    subtitle.textContent = 'Enter unique aliases for all 4 participants.';
    this.element.appendChild(subtitle);

    
    const formContainer = document.createElement('div');
    formContainer.className = 'space-y-4 mb-8';

    for (let i = 1; i <= 4; i++) {
      const input = new Input(`Player ${i} Alias`, 'text');
      
      input.render(); 
      this.playerInputs.push(input);
      formContainer.appendChild(input.getElement());
    }
    this.element.appendChild(formContainer);

    
    const startBtn = new Button('GENERATE BRACKET', () => this.handleStart(), 'primary');
    
    startBtn.getElement().classList.add('w-full', 'py-3', 'text-lg'); 
    startBtn.render();
    
    this.element.appendChild(startBtn.getElement());
  }

  private handleStart(): void {
    const aliases: string[] = [];
    let hasError = false;

    
    this.playerInputs.forEach(input => {
      const val = input.getValue().trim();
      
      if (!val) {
        input.setError(true);
        hasError = true;
      } 
      
      else if (aliases.includes(val)) {
        alert(`Duplicate alias found: ${val}`);
        input.setError(true);
        hasError = true;
      } 
      else {
        input.setError(false);
        aliases.push(val);
      }
    });

    if (!hasError) {
      this.onSubmit(aliases);
    }
  }
}