import { AbstractComponent } from '../../core/Component';

type ButtonVariant = 'primary' | 'secondary' | 'danger';

export class Button extends AbstractComponent {
  private onClick: () => void;

  constructor(
    label: string,
    onClick: () => void,
    variant: ButtonVariant = 'primary'
  ) {
    super('button', ''); 
    this.onClick = onClick;
    
    
    const baseClasses = 'px-6 py-2 rounded-lg font-bold transition duration-200 focus:outline-none';
    const variants = {
      primary: 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/50',
      secondary: 'bg-gray-700 hover:bg-gray-600 text-gray-200 border border-gray-600',
      danger: 'bg-red-600 hover:bg-red-700 text-white'
    };

    this.element.className = `${baseClasses} ${variants[variant]}`;
    this.element.textContent = label;
  }

  public render(): void {
    
    this.element.addEventListener('click', (e) => {
      e.preventDefault();
      this.onClick();
    });
  }
}