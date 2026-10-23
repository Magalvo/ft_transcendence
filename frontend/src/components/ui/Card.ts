import { AbstractComponent } from '../../core/Component';

export class Card extends AbstractComponent {
  constructor(className: string = '') {
    
    const defaultStyles = 'bg-gray-800 p-6 rounded-xl shadow-xl border border-gray-700';
    super('div', `${defaultStyles} ${className}`);
  }

  
  public addChildren(...components: AbstractComponent[]): void {
    components.forEach(comp => {
      comp.render();
      this.element.appendChild(comp.getElement());
    });
  }

  public render(): void {}
}