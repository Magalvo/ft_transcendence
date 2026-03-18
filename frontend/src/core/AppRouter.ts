import type { Router } from "./Router";

let appRouter: Router | null = null;

export function setAppRouter(router: Router): void {
  appRouter = router;
}

export function getAppRouter(): Router | null {
  return appRouter;
}

export function navigateTo(path: string): void {
  if (appRouter) {
    appRouter.navigate(path);
    return;
  }

  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function refreshCurrentRoute(): void {
  if (appRouter) {
    appRouter.refresh();
    return;
  }

  window.dispatchEvent(new PopStateEvent("popstate"));
}
