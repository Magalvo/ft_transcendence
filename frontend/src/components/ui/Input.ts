import { AbstractComponent } from '../../core/Component';

export class Input extends AbstractComponent {
  private inputElement: HTMLInputElement;

  constructor(
    placeholder: string,
    type: string = 'text',
    label?: string
  ) {
    super('div', 'flex flex-col mb-4');

    
    if (label) {
      const labelEl = document.createElement('label');
      labelEl.className = 'mb-1 text-sm text-gray-400';
      labelEl.textContent = label;
      this.element.appendChild(labelEl);
    }

    
    this.inputElement = document.createElement('input');
    this.inputElement.type = type;
    this.inputElement.placeholder = placeholder;
    this.inputElement.className = 'px-4 py-2 bg-gray-800 border border-gray-700 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none text-white';
    
    this.element.appendChild(this.inputElement);
  }

  public render(): void {
    
  }

  
  public getValue(): string {
    return this.inputElement.value;
  }

  
  public setError(hasError: boolean): void {
    if (hasError) {
      this.inputElement.classList.add('border-red-500', 'focus:ring-red-500');
    } else {
      this.inputElement.classList.remove('border-red-500', 'focus:ring-red-500');
    }
  }
}