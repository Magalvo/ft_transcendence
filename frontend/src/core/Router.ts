import { AbstractComponent } from './Component';


interface Route {
  path: string;
  component: new () => AbstractComponent;
}

export class Router {
  private routes: Route[] = [];
  private rootElement: HTMLElement;
  private currentComponent: AbstractComponent | null = null;

  constructor(rootSelector: string) {
    const el = document.querySelector(rootSelector);
    if (!el) throw new Error('Root element not found');
    this.rootElement = el as HTMLElement;

    
    window.addEventListener('popstate', () => {
      this.handleRoute();
    });
  }

  
  public addRoute(path: string, component: new () => AbstractComponent): void {
    this.routes.push({ path, component });
  }

  
  public navigate(path: string): void {
    window.history.pushState({}, '', path);
    this.handleRoute();
  }

  
  private handleRoute(): void {
    const path = window.location.pathname;
    const route = this.routes.find((r) => r.path === path);

    if (this.currentComponent) {
      this.currentComponent.onDestroy();
    }

    this.rootElement.innerHTML = ''; 

    if (route) {
      const pageInstance = new route.component();
      // Attach element to DOM first so page `render()` can query document elements
      this.rootElement.appendChild(pageInstance.getElement());
      pageInstance.render();
      this.currentComponent = pageInstance;
    } else {
      
      this.rootElement.innerHTML = '<h1>404 - Page Not Found</h1>';
    }
  }

  
  public init(): void {
    this.handleRoute();
  }
}