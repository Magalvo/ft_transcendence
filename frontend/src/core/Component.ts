export abstract class AbstractComponent {
  protected element: HTMLElement;

  constructor(tagName: string = 'div', className: string = '') {
    this.element = document.createElement(tagName);
    if (className) {
      this.element.className = className;
    }
  }

  public getElement(): HTMLElement {
    return this.element;
  }

  public abstract render(): void;

  public onDestroy(): void {}
}