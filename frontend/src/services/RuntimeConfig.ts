export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3333";
export const WS_URL = import.meta.env.VITE_WS_URL || "http://localhost:3000";

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

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${value.replace(/^\/+/, "")}`;
}

export const SPACEDOUT_WS_URL = normalizeWebSocketUrl(
  import.meta.env.VITE_SPACEDOUT_WS_URL,
  "ws://localhost:3030",
);
