import { AbstractComponent } from "./Component";
import { TokenManager } from "../services/TokenManager";
import { t } from "../services/I18nService";

type ComponentClass = new () => AbstractComponent;
type RouteLoader = () => Promise<ComponentClass>;

interface Route {
  path: string;
  component?: ComponentClass;
  loader?: RouteLoader;
}

export class Router {
  private routes: Route[] = [];
  private rootElement: HTMLElement;
  private currentComponent: AbstractComponent | null = null;
  private readonly publicRoutes = ["/login", "/404", "/terms", "/privacy", "/reset-password"];
  private navigationRequestId = 0;

  constructor(rootSelector: string) {
    const el = document.querySelector(rootSelector);
    if (!el) throw new Error("Root element not found");
    this.rootElement = el as HTMLElement;

    window.addEventListener("popstate", () => {
      void this.handleRoute();
    });
  }

  public addRoute(path: string, component: ComponentClass): void {
    this.routes.push({ path, component });
  }

  public addLazyRoute(path: string, loader: RouteLoader): void {
    this.routes.push({ path, loader });
  }

  public navigate(path: string): void {
    window.history.pushState({}, "", path);
    void this.handleRoute();
  }

  public refresh(): void {
    void this.handleRoute();
  }

  private renderRouteStatus(message: string): void {
    const wrapper = document.createElement("div");
    wrapper.className = "min-h-screen flex items-center justify-center px-6 text-center";

    const text = document.createElement("div");
    text.className = "max-w-md text-sm text-gray-400";
    text.textContent = message;

    wrapper.appendChild(text);
    this.rootElement.replaceChildren(wrapper);
  }

  private async handleRoute(): Promise<void> {
    const requestId = ++this.navigationRequestId;
    const path = window.location.pathname;

    let targetPath = path;
    const isAuthenticated = TokenManager.isAuthenticated();

    if (!isAuthenticated && !this.publicRoutes.includes(path)) {
      targetPath = "/login";
      window.history.replaceState({}, "", targetPath);
    } else if (isAuthenticated && path === "/login") {
      targetPath = "/";
      window.history.replaceState({}, "", targetPath);
    }

    const route = this.routes.find((entry) => entry.path === targetPath);

    if (this.currentComponent) {
      this.currentComponent.onDestroy();
      this.currentComponent = null;
    }

    this.rootElement.replaceChildren();

    if (!route) {
      this.renderRouteStatus(t("router.notFound"));
      return;
    }

    let Component: ComponentClass | undefined;
    try {
      Component = route.component ?? (await route.loader?.());
    } catch (error) {
      console.error(`Failed to load route ${targetPath}:`, error);
    }

    if (!Component || requestId !== this.navigationRequestId) {
      if (!Component) {
        this.renderRouteStatus(t("router.notFound"));
      }
      return;
    }

    const pageInstance = new Component();
    this.rootElement.appendChild(pageInstance.getElement());
    this.currentComponent = pageInstance;

    try {
      await pageInstance.render();
    } catch (error) {
      console.error(`Failed to render route ${targetPath}:`, error);

      if (this.currentComponent === pageInstance) {
        pageInstance.onDestroy();
        this.currentComponent = null;
      }

      if (requestId === this.navigationRequestId) {
        this.renderRouteStatus("Something went wrong loading this page.");
      }
      return;
    }

    if (requestId !== this.navigationRequestId || this.currentComponent !== pageInstance) {
      pageInstance.onDestroy();
      if (this.currentComponent === pageInstance) {
        this.currentComponent = null;
      }
    }
  }

  public init(): void {
    void this.handleRoute();
  }
}
