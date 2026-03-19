type AvatarLike = {
  avatarUrl?: string | null;
  username?: string | null;
};

const GENERATED_AVATAR_HOST = "ui-avatars.com/api/";

function normalizeAvatarUrl(rawAvatarUrl?: string | null): string | null {
  const value = String(rawAvatarUrl ?? "").trim();
  if (!value) return null;

  if (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("data:")
  ) {
    return value;
  }

  if (value.startsWith("/")) {
    return new URL(value, window.location.origin).toString();
  }

  return new URL(`/${value.replace(/^\/+/, "")}`, window.location.origin).toString();
}

export function getGeneratedAvatarUrl(username?: string | null): string {
  const normalizedUsername = String(username ?? "").trim() || "User";
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(normalizedUsername)}&background=0D8ABC&color=fff`;
}

export function isGeneratedAvatarUrl(avatarUrl?: string | null): boolean {
  return String(avatarUrl ?? "").includes(GENERATED_AVATAR_HOST);
}

export function getUserAvatarUrl(user?: AvatarLike | null): string {
  return normalizeAvatarUrl(user?.avatarUrl) ?? getGeneratedAvatarUrl(user?.username);
}

export function normalizeStoredAvatarUrl(
  avatarUrl?: string | null,
): string | undefined {
  return normalizeAvatarUrl(avatarUrl) ?? undefined;
}
