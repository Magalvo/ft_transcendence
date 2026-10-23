function browserOrigin(): string {
  return window.location.origin;
}

function normalizeHttpUrl(rawValue: string | undefined, fallback: string): string {
  const value = rawValue?.trim();
  if (!value) return fallback;

  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }

  if (value.startsWith("/")) {
    return value;
  }

  return `${window.location.protocol}//${value.replace(/^\/+/, "")}`;
}

function normalizeWebSocketUrl(rawValue: string | undefined, fallback: string): string {
  const value = rawValue?.trim();
  if (!value) return fallback;

  if (value.startsWith("ws://") || value.startsWith("wss://")) {
    return value;
  }

  if (value.startsWith("http://")) {
    return `ws://${value.slice("http://".length)}`;
  }

  if (value.startsWith("https://")) {
    return `wss://${value.slice("https://".length)}`;
  }

  if (value.startsWith("/")) {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${window.location.host}${value}`;
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${value.replace(/^\/+/, "")}`;
}

export const API_URL = normalizeHttpUrl(
  import.meta.env.VITE_API_URL,
  browserOrigin(),
);

export const WS_URL = normalizeHttpUrl(
  import.meta.env.VITE_WS_URL,
  browserOrigin(),
);

export const SPACEDOUT_WS_URL = normalizeWebSocketUrl(
  import.meta.env.VITE_SPACEDOUT_WS_URL,
  "/spacedout-ws",
);
