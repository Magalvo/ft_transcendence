const userToGame = new Map<string, string>();
const gameToUsers = new Map<string, Set<string>>();

export function tryRegisterGameUsers(
  userIds: string[],
  gameId: string,
): { ok: boolean; conflicts: string[] } {
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
  const conflicts = uniqueIds.filter((id) => userToGame.has(id));

  if (conflicts.length > 0) {
    return { ok: false, conflicts };
  }

  if (!gameToUsers.has(gameId)) {
    gameToUsers.set(gameId, new Set());
  }
  const set = gameToUsers.get(gameId)!;

  for (const id of uniqueIds) {
    userToGame.set(id, gameId);
    set.add(id);
  }

  return { ok: true, conflicts: [] };
}

export function releaseGameUsers(gameId: string): void {
  const set = gameToUsers.get(gameId);
  if (!set) return;

  for (const id of set) {
    const mapped = userToGame.get(id);
    if (mapped === gameId) {
      userToGame.delete(id);
    }
  }

  gameToUsers.delete(gameId);
}
