const DEFAULT_FRONTEND_URL = "https://localhost:8443";

function stripTrailingSlashes(url: string): string {
  return url.replace(/\/+$/g, "");
}

// Links sent to users (password reset, OAuth redirects) are built only from
// configuration, never from request headers such as Host or X-Forwarded-Host,
// which a client could forge to point the link at another site.
export function getFrontendBaseUrl(): string {
  const configured = String(process.env.FRONTEND_URL || "").trim();
  return stripTrailingSlashes(configured || DEFAULT_FRONTEND_URL);
}

export function getAllowedOrigins(override?: string): string[] {
  const raw = String(override || process.env.CORS_ORIGINS || "").trim();
  const origins = (raw || getFrontendBaseUrl())
    .split(",")
    .map((origin) => stripTrailingSlashes(origin.trim()))
    .filter(Boolean);
  return origins.length > 0 ? origins : [getFrontendBaseUrl()];
}
