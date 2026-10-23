import { Server } from "socket.io";
import { readBearerToken, verifyAccessToken } from "../utils/tokens.js";
import { Lobby } from "../game/Lobby.js";
import { Game, GameConfiguration, GamePlayer } from "../game/index.js";
import { attachChatRealtime } from "./chatRealtime.js";
import { getOrCreatePrivateChat, createPrivateMessage } from "../services/chat.js";
import db from "../db.js";
import { createTournamentMatchInvites } from "../services/tournamentInviteService.js";
import { tryRegisterGameUsers } from "../game/ActiveGameRegistry.js";

const socketToUserMap = new Map<string, string>();
const userToSocketsMap = new Map<string, Set<string>>();

type LocalTournamentSnapshot = {
  id: string;
  name: string;
  status: "active" | "completed";
  winner_id: string | null;
  player_count: number;
  participants: Array<{
    id: string;
    username: string;
    isAI?: boolean;
  }>;
  matches: Array<{
    id: string;
    tournament_id: string;
    player1_id: string;
    player2_id: string;
    winner_id: string | null;
    player1_score: number;
    player2_score: number;
    status: "pending" | "in_progress" | "completed";
    round: number;
    match_number: number;
  }>;
};

const lobbiesRegistry = new Map<
  string,
  { lobby: Lobby; code?: string; isPrivate: boolean; createdAt: number }
>();
const inviteLobbies = new Map<string, Lobby>();
const inviteSessionToLobbyId = new Map<string, string>();
const inviteLobbyIdToSession = new Map<string, string>();
const activeLobbyBySocket = new Map<string, string>();

async function setUserOnlineStatus(userId: string, online: boolean): Promise<void> {
  try {
    if (!userId) return;
    if (online) {
      await db("users")
        .where({ id: userId })
        .update({ online: true, last_request: new Date().toISOString() });
      return;
    }
    await db("users").where({ id: userId }).update({ online: false });
  } catch (error) {
    console.warn("Failed to update user online status:", error);
  }
}

function getSocketCorsOrigin() {
  const configuredOrigin = String(
    process.env.SOCKET_CORS_ORIGIN || process.env.FRONTEND_URL || "",
  ).trim();

  if (!configuredOrigin || configuredOrigin === "*") {
    return true;
  }

  const origins = configuredOrigin
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (origins.length === 0) return true;
  if (origins.length === 1) return origins[0];
  return origins;
}
function normalizeLobbyCode(raw?: string): string {
  return (raw || "").trim().toUpperCase();
}

function generateLobbyId(): string {
  return Math.random().toString(36).substring(2, 15);
}

function isLocalTournamentSnapshot(value: unknown): value is LocalTournamentSnapshot {
  if (!value || typeof value !== "object") return false;
  const data = value as Partial<LocalTournamentSnapshot>;
  if (!data.id || typeof data.id !== "string") return false;
  if (!Array.isArray(data.participants) || !Array.isArray(data.matches)) return false;
  return true;
}

function encodeTournamentSnapshot(snapshot: LocalTournamentSnapshot | undefined): string {
  if (!snapshot) return "";
  try {
    return Buffer.from(JSON.stringify(snapshot), "utf8").toString("base64url");
  } catch (error) {
    console.warn("Failed to encode local tournament snapshot:", error);
    return "";
  }
}

async function startTournamentGame(
  matchKey: string,
  matchId: string,
  pendingMatch: any,
  io: Server,
  pendingTournamentMatches: Map<
    string,
    {
      tournamentId: string;
      matchId: string;
      expiresAt: number;
      slots: Array<{
        side: "left" | "right";
        userId: string;
        socketId: string;
        username: string;
      }>;
    }
  >
) {
  try {
    console.log(`🏆 Starting tournament game for match: ${matchId}`);
    
    // Create a temporary game room for the tournament match
    const roomId = `tournament:${pendingMatch.tournamentId}:${matchId}`;
    
    // Create game configuration for 1v1
    const gameConfig = new GameConfiguration("normal", "one_for_one");
    
    // Create players from the slots, sorted by side (left first, then right)
    const sortedSlots = pendingMatch.slots.sort(
      (
        a: { side: "left" | "right" },
        b: { side: "left" | "right" },
      ) => (a.side === b.side ? 0 : a.side === "left" ? -1 : 1),
    );
    const players: GamePlayer[] = sortedSlots.map((slot: any) => 
      new GamePlayer('human', slot.socketId, slot.side, slot.username, slot.userId)
    );

    const game = new Game(io, gameConfig, players, roomId, () => {
      console.log(`🏆 Tournament match game ended: ${matchId}`);
    });

    // Join sockets to the game room
    for (const slot of pendingMatch.slots) {
      const socket = io.sockets.sockets.get(slot.socketId);
      if (socket) {
        socket.join(roomId);
      }
    }
    
    // Mark as tournament match for special handling
    (game as any).isTournamentMatch = true;

    // Start the game (initializes engine and binds socket events)
    game.start();

    // Send init events to both players
    for (const slot of pendingMatch.slots) {
      const socket = io.sockets.sockets.get(slot.socketId);
      if (socket) {
        const playerIndex = players.findIndex((p) => p.user_id === slot.userId);
        socket.emit('init', {
          side: slot.side,
          index: playerIndex,
          configs: gameConfig,
          isTournamentMatch: true,
          players: pendingMatch.slots.map((s: any) => s.userId)
        });
      }
    }

    // Remove from pending matches
    pendingTournamentMatches.delete(matchKey);
    
    console.log(`✅ Tournament match game started: ${matchId}`);
  } catch (error: any) {
    console.error("❌ Error starting tournament game:", error);
    // Notify both players of the error
    for (const slot of pendingMatch.slots) {
      const socket = io.sockets.sockets.get(slot.socketId);
      if (socket) {
        socket.emit("error", { message: error.message || "Failed to start tournament match" });
      }
    }
    pendingTournamentMatches.delete(matchKey);
  }
}

export function setupSocketIO(httpServer: any) {
  const io = new Server(httpServer, {
    cors: {
      origin: getSocketCorsOrigin(),
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  const pendingTournamentMatches = new Map<
    string,
    {
      tournamentId: string;
      matchId: string;
      expiresAt: number;
      slots: Array<{
        side: "left" | "right";
        userId: string;
        socketId: string;
        username: string;
      }>;
    }
  >();
  const localTournamentGames = new Map<string, Game>();
  const pendingLocalTournamentMatches = new Map<
    string,
    {
      tournamentId: string;
      matchId: string;
      expiresAt: number;
      player1_id: string;
      player2_id: string;
      player1_name: string;
      player2_name: string;
      tournament_snapshot?: LocalTournamentSnapshot;
      slots: Array<{
        side: "left" | "right";
        userId: string;
        socketId: string;
        username: string;
      }>;
    }
  >();
  const PENDING_MATCH_TTL_MS = 15 * 60 * 1000;
  const PENDING_MATCH_CLEANUP_MS = 60 * 1000;

  const getRuntimeMetrics = () => {
    const pendingTournamentSlots = Array.from(pendingTournamentMatches.values()).reduce(
      (acc, match) => acc + match.slots.length,
      0,
    );
    const pendingLocalTournamentSlots = Array.from(pendingLocalTournamentMatches.values()).reduce(
      (acc, match) => acc + match.slots.length,
      0,
    );
    const userSocketBindings = Array.from(userToSocketsMap.values()).reduce(
      (acc, sockets) => acc + sockets.size,
      0,
    );

    return {
      timestamp: Date.now(),
      connectedSockets: io.sockets.sockets.size,
      socketToUserEntries: socketToUserMap.size,
      authenticatedUsers: userToSocketsMap.size,
      userSocketBindings,
      activeLobbyBindings: activeLobbyBySocket.size,
      publicLobbies: lobbiesRegistry.size,
      privateInviteLobbies: inviteLobbies.size,
      pendingTournamentMatches: pendingTournamentMatches.size,
      pendingTournamentSlots,
      pendingLocalTournamentMatches: pendingLocalTournamentMatches.size,
      pendingLocalTournamentSlots,
      activeLocalTournamentGames: localTournamentGames.size,
    };
  };

  setInterval(() => {
    const now = Date.now();

    for (const [matchKey, match] of pendingTournamentMatches.entries()) {
      if (match.expiresAt <= now) {
        pendingTournamentMatches.delete(matchKey);
      }
    }

    for (const [matchKey, match] of pendingLocalTournamentMatches.entries()) {
      if (match.expiresAt <= now) {
        pendingLocalTournamentMatches.delete(matchKey);
      }
    }
  }, PENDING_MATCH_CLEANUP_MS);

  const emitLocalTournamentInvite = async (
    requesterId: string,
    opponentId: string,
    payload: {
      tournamentId: string;
      matchId: string;
      player1_id: string;
      player2_id: string;
      player1_name: string;
      player2_name: string;
      tournament_snapshot?: LocalTournamentSnapshot;
    }
  ) => {
    const encodedSnapshot = encodeTournamentSnapshot(payload.tournament_snapshot);
    const snapshotQuery = encodedSnapshot ? `&tState=${encodeURIComponent(encodedSnapshot)}` : "";
    const inviteUrl = `/game?tournamentId=${payload.tournamentId}&matchId=${payload.matchId}&p1=${payload.player1_id}&p2=${payload.player2_id}${snapshotQuery}`;

    const targetSockets = userToSocketsMap.get(opponentId);
    if (targetSockets) {
      for (const sid of targetSockets) {
        const targetSocket = io.sockets.sockets.get(sid);
        if (targetSocket) {
          targetSocket.emit("tournamentInvite", {
            tournamentId: payload.tournamentId,
            matchId: payload.matchId,
            inviteToken: `local-${payload.tournamentId}-${payload.matchId}`,
            inviteUrl,
            expiresAt: Date.now() + 15 * 60 * 1000,
            player1_id: payload.player1_id,
            player2_id: payload.player2_id,
            player1_name: payload.player1_name,
            player2_name: payload.player2_name,
            tournament_snapshot: payload.tournament_snapshot,
          });
        }
      }
    }

    try {
      if (requesterId === opponentId) return;
      const chat = await getOrCreatePrivateChat(requesterId, opponentId);
      const encodedUrl = encodeURIComponent(inviteUrl);
      const inviteMessage = `__PONG_INVITE__|${encodedUrl}|`;
      const msg = await createPrivateMessage(Number(chat.id_privatechat), requesterId, inviteMessage);

      if (targetSockets) {
        for (const sid of targetSockets) {
          const targetSocket = io.sockets.sockets.get(sid);
          if (targetSocket) {
            targetSocket.emit("chat_private_message", msg);
          }
        }
      }

      const requesterSockets = userToSocketsMap.get(requesterId);
      if (requesterSockets) {
        for (const sid of requesterSockets) {
          const requesterSocket = io.sockets.sockets.get(sid);
          if (requesterSocket) {
            requesterSocket.emit("chat_private_message", msg);
          }
        }
      }
    } catch (error) {
      console.warn("Failed to send local tournament invite via chat:", error);
    }
  };

  const resolveTournamentMatchContext = async (tournamentId: string, matchId: string) => {
    const match = await db("tournament_matches")
      .where({ id: matchId, tournament_id: tournamentId })
      .first();

    if (!match) throw new Error("Tournament match not found");
    if (!match.player1_id || !match.player2_id) {
      throw new Error("Tournament match is not ready yet");
    }

    const users = await db("users")
      .whereIn("id", [match.player1_id, match.player2_id])
      .select("id", "username");
    const names = new Map<string, string>(users.map((u: any) => [String(u.id), String(u.username)]));

    return {
      player1_id: String(match.player1_id),
      player2_id: String(match.player2_id),
      player1_name: names.get(String(match.player1_id)) || String(match.player1_id),
      player2_name: names.get(String(match.player2_id)) || String(match.player2_id),
    };
  };

  const addUserToPendingTournamentMatch = async (
    socketId: string,
    tournamentId: string,
    matchId: string
  ) => {
    const userId = socketToUserMap.get(socketId);
    if (!userId) throw new Error("User not authenticated");

    const matchKey = `${tournamentId}:${matchId}`;
  const now = Date.now();
    const context = await resolveTournamentMatchContext(tournamentId, matchId);
    const isPlayer1 = userId === context.player1_id;
    const isPlayer2 = userId === context.player2_id;

    if (!isPlayer1 && !isPlayer2) {
      throw new Error("User is not a participant in this match");
    }

    const existingPendingMatch = pendingTournamentMatches.get(matchKey);
    if (existingPendingMatch && existingPendingMatch.expiresAt <= now) {
      pendingTournamentMatches.delete(matchKey);
    }

    const existingMatch =
      existingPendingMatch && existingPendingMatch.expiresAt > now
        ? existingPendingMatch
        : {
      tournamentId,
      matchId,
      expiresAt: now + PENDING_MATCH_TTL_MS,
      slots: [] as Array<{
        side: "left" | "right";
        userId: string;
        socketId: string;
        username: string;
      }>,
    };

    const existingSlot = existingMatch.slots.find((s) => s.userId === userId);
    if (!existingSlot) {
      existingMatch.slots.push({
        side: isPlayer1 ? "left" : "right",
        userId,
        socketId,
        username: isPlayer1 ? context.player1_name : context.player2_name,
      });
    } else {
      existingSlot.socketId = socketId;
    }

    existingMatch.expiresAt = Date.now() + PENDING_MATCH_TTL_MS;

    pendingTournamentMatches.set(matchKey, existingMatch);

    if (existingMatch.slots.length >= 2) {
      await startTournamentGame(matchKey, matchId, existingMatch, io, pendingTournamentMatches);
      return { started: true };
    }

    return { started: false };
  };

  const emitTournamentInviteToUser = async (
    fromUserId: string,
    toUserId: string,
    payload: {
      tournamentId: string;
      matchId: string;
      token: string;
      expiresAt: number;
      player1_id: string;
      player2_id: string;
      player1_name: string;
      player2_name: string;
    }
  ) => {
    const inviteUrl = `/game?tournamentInviteToken=${encodeURIComponent(payload.token)}`;

    const targetSockets = userToSocketsMap.get(toUserId);
    if (targetSockets) {
      for (const sid of targetSockets) {
        const targetSocket = io.sockets.sockets.get(sid);
        if (targetSocket) {
          targetSocket.emit("tournamentInvite", {
            tournamentId: payload.tournamentId,
            matchId: payload.matchId,
            inviteToken: payload.token,
            inviteUrl,
            expiresAt: payload.expiresAt,
            player1_id: payload.player1_id,
            player2_id: payload.player2_id,
            player1_name: payload.player1_name,
            player2_name: payload.player2_name,
          });
        }
      }
    }

    if (fromUserId !== toUserId) {
      const chat = await getOrCreatePrivateChat(fromUserId, toUserId);
      const encodedUrl = encodeURIComponent(inviteUrl);
      const inviteMessage = `__PONG_INVITE__|${encodedUrl}|`;
      const msg = await createPrivateMessage(Number(chat.id_privatechat), fromUserId, inviteMessage);

      if (targetSockets) {
        for (const sid of targetSockets) {
          const targetSocket = io.sockets.sockets.get(sid);
          if (targetSocket) {
            targetSocket.emit("chat_private_message", msg);
          }
        }
      }

      const fromSockets = userToSocketsMap.get(fromUserId);
      if (fromSockets) {
        for (const sid of fromSockets) {
          const fromSocket = io.sockets.sockets.get(sid);
          if (fromSocket) {
            fromSocket.emit("chat_private_message", msg);
          }
        }
      }
    }
  };

  const emitTournamentInviteInvalidatedToUser = async (
    toUserId: string,
    payload: {
      tournamentId: string;
      matchId: string;
      invalidatedToken: string;
      supersededByToken: string;
      requestedBy: string;
      reason: "superseded";
      invalidatedAt: number;
    },
  ) => {
    const targetSockets = userToSocketsMap.get(toUserId);
    if (!targetSockets) return;

    for (const sid of targetSockets) {
      const targetSocket = io.sockets.sockets.get(sid);
      if (!targetSocket) continue;

      targetSocket.emit("tournamentInviteInvalidated", {
        version: 1,
        tournamentId: payload.tournamentId,
        matchId: payload.matchId,
        invalidatedToken: payload.invalidatedToken,
        supersededByToken: payload.supersededByToken,
        reason: payload.reason,
        requestedBy: payload.requestedBy,
        invalidatedAt: payload.invalidatedAt,
      });
    }
  };

  const mainLobby = new Lobby(io, socketToUserMap, "lobby:main");

  const normalizeInviteSession = (raw?: string): string | null => {
    if (!raw) return null;
    const normalized = raw.trim();
    if (!normalized || normalized.length > 120) return null;
    return normalized;
  };

  const ensureInviteLobby = (inviteSession: string): string => {
    const existingLobbyId = inviteSessionToLobbyId.get(inviteSession);
    if (existingLobbyId && inviteLobbies.has(existingLobbyId)) {
      return existingLobbyId;
    }

    const lobbyId = `invite:${inviteSession}`;
    const lobby = new Lobby(io, socketToUserMap, `lobby:${lobbyId}`);
    inviteLobbies.set(lobbyId, lobby);
    inviteSessionToLobbyId.set(inviteSession, lobbyId);
    inviteLobbyIdToSession.set(lobbyId, inviteSession);
    return lobbyId;
  };

  const cleanupInviteLobbyIfEmpty = (lobbyId: string): void => {
    const lobby = inviteLobbies.get(lobbyId);
    if (!lobby) return;
    if (lobby.getClientCount() > 0) return;

    inviteLobbies.delete(lobbyId);
    const inviteSession = inviteLobbyIdToSession.get(lobbyId);
    if (inviteSession) {
      inviteSessionToLobbyId.delete(inviteSession);
      inviteLobbyIdToSession.delete(lobbyId);
    }
  };

  const cleanupPublicLobbyIfEmpty = (lobbyId: string): void => {
    if (!lobbyId || lobbyId === "main" || lobbyId.startsWith("invite:")) return;

    const entry = lobbiesRegistry.get(lobbyId);
    if (!entry) return;
    if (entry.lobby.getClientCount() > 0) return;

    lobbiesRegistry.delete(lobbyId);
  };

  const getLobbyById = (lobbyId: string): Lobby | null => {
    if (lobbyId === "main") return mainLobby;
    if (inviteLobbies.has(lobbyId)) return inviteLobbies.get(lobbyId) ?? null;
    return lobbiesRegistry.get(lobbyId)?.lobby ?? null;
  };

  const getActiveLobby = (socketId: string): Lobby => {
    const activeLobbyId = activeLobbyBySocket.get(socketId) ?? "main";
    return getLobbyById(activeLobbyId) ?? mainLobby;
  };

  const moveSocketToLobby = (
    socketId: string,
    targetLobbyId: string,
  ): boolean => {
    const targetLobby = getLobbyById(targetLobbyId);
    if (!targetLobby) {
      return false;
    }

    const currentLobbyId = activeLobbyBySocket.get(socketId) ?? "main";
    if (currentLobbyId !== targetLobbyId) {
      const currentLobby = getLobbyById(currentLobbyId);
      if (currentLobby?.hasClient(socketId)) {
        currentLobby.removeClient(socketId);
        cleanupInviteLobbyIfEmpty(currentLobbyId);
        cleanupPublicLobbyIfEmpty(currentLobbyId);
      }
    }

    if (!targetLobby.hasClient(socketId)) {
      targetLobby.addClient(socketId);
    }

    activeLobbyBySocket.set(socketId, targetLobbyId);
    return true;
  };

  const leaveActiveLobby = (socketId: string): void => {
    const currentLobbyId = activeLobbyBySocket.get(socketId) ?? "main";
    const currentLobby = getLobbyById(currentLobbyId) ?? mainLobby;
    if (currentLobby.hasClient(socketId)) {
      currentLobby.removeClient(socketId);
    }
    activeLobbyBySocket.delete(socketId);
    cleanupInviteLobbyIfEmpty(currentLobbyId);
    cleanupPublicLobbyIfEmpty(currentLobbyId);
  };

  const buildAvailableLobbies = async () => {
    return Promise.all(
      Array.from(lobbiesRegistry.entries())
        .filter(
          ([, entry]) =>
            entry.lobby.getClientCount() > 0 && !entry.lobby.gameInstance,
        )
        .map(async ([lobbyId, entry]) => {
        const lobbyState = await entry.lobby.getStatePublic();

        const playerCount = [lobbyState.slots.left, lobbyState.slots.right]
          .flat()
          .filter((slot) => slot.content === "human").length;

        const leaderSocketId = lobbyState.leader;
        const playerDataBySocket = (lobbyState.playerData ?? {}) as Record<
          string,
          { userId: string; username: string }
        >;
        const leaderData = leaderSocketId
          ? playerDataBySocket[leaderSocketId]
          : undefined;

        return {
          id: lobbyId,
          leader: {
            id: leaderData?.userId || "unknown",
            username: leaderData?.username || "Player",
          },
          players: playerCount,
          maxPlayers: (lobbyState.config.players_per_side || 1) * 2,
          mode:
            lobbyState.config.players_per_side === 1
              ? "1v1"
              : lobbyState.config.players_per_side === 2
                ? "2v2"
                : "3v3",
          isPrivate: entry.isPrivate,
          createdAt: entry.createdAt,
          status: "waiting" as const,
        };
        }),
    );
  };

  const broadcastLobbyList = async () => {
    const lobbies = await buildAvailableLobbies();
    io.emit("availableLobbies", lobbies);
    io.emit("lobbyListChanged");
  };

  console.log("🎮 Lobby Socket.IO started");

  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    const bindSocketIdentity = (userId: string, source: string): void => {
      socketToUserMap.set(socket.id, userId);
      socket.data.userId = userId;
      if (!userToSocketsMap.has(userId)) userToSocketsMap.set(userId, new Set());
      userToSocketsMap.get(userId)!.add(socket.id);
      socket.join(`user:${userId}`);
      void setUserOnlineStatus(userId, true);
      console.log(`Mapped socket ${socket.id} to user ${userId} (${source})`);
    };

    const authTokenRaw =
      socket.handshake.auth?.token || socket.handshake.headers.authorization;
    let authenticatedUserId: string | undefined;

    if (authTokenRaw) {
      try {
        const token = readBearerToken(String(authTokenRaw));
        if (token) {
          authenticatedUserId = verifyAccessToken(token).userId;
        }
      } catch (error) {
        console.warn(`Socket ${socket.id} failed JWT auth:`, error);
      }
    }

    if (!authenticatedUserId) {
      socket.emit("authRejected", {
        reason: "missing_or_invalid_token",
        message: "Socket authentication requires a valid access token",
      });
      socket.disconnect(true);
      return;
    }

    bindSocketIdentity(authenticatedUserId, "jwt");

    socket.on("userAuth", (data: { userId: string }) => {
      const boundUserId = socketToUserMap.get(socket.id);
      if (!boundUserId || !data?.userId || data.userId !== boundUserId) {
        console.warn(
          `Socket ${socket.id} attempted identity override via userAuth`,
          { claimedUserId: data?.userId, boundUserId },
        );
        socket.emit("authRejected", {
          reason: "identity_mismatch",
          message: "Socket identity is bound to JWT and cannot be overridden",
        });
        socket.disconnect(true);
        return;
      }

      getActiveLobby(socket.id).broadcastStatePublic();
    });

    mainLobby.addClient(socket.id);
    activeLobbyBySocket.set(socket.id, "main");
    attachChatRealtime(io, socket);

    // Explicit logout from a client tab: ensure the socket leaves any active
    // lobby and is no longer associated with a user to avoid stale game
    // participation or duplicate sessions for the same player.
    socket.on("userLogout", () => {
      const userId = socketToUserMap.get(socket.id);
      console.log(
        `🔌 Explicit userLogout from socket ${socket.id}${userId ? ` (user ${userId})` : ""}`,
      );

      leaveActiveLobby(socket.id);
      if (userId) {
        const sockets = userToSocketsMap.get(userId);
        sockets?.delete(socket.id);
        if (sockets && sockets.size === 0) {
          userToSocketsMap.delete(userId);
          void setUserOnlineStatus(userId, false);
        }
        socket.leave(`user:${userId}`);
      }
      socketToUserMap.delete(socket.id);
      socket.data.userId = undefined;
    });

    // ===== Find Game / Lobbies =====
    socket.on("requestAvailableLobbies", async () => {
      console.log(`🔍 Client ${socket.id} requesting available lobbies`);

      const lobbies = await buildAvailableLobbies();
      socket.emit("availableLobbies", lobbies);
    });

    socket.on(
      "createLobby",
      async (data: { mode: string; isPrivate: boolean; code?: string }) => {
        console.log(
          `📋 Client ${socket.id} creating lobby: ${data.mode} (${data.isPrivate ? "private" : "public"})`,
        );

        const lobbyId = generateLobbyId();
        const newLobby = new Lobby(io, socketToUserMap, `lobby:${lobbyId}`);
        newLobby.setRemoveCallback(() => {
          // Remove lobby if empty after game ends
          if (newLobby.getClientCount() === 0) {
            lobbiesRegistry.delete(lobbyId);
            broadcastLobbyList();
          }
        });

        const modeMap: Record<
          string,
          "one_for_one" | "two_for_two" | "three_for_three"
        > = {
          "1v1": "one_for_one",
          "2v2": "two_for_two",
          "3v3": "three_for_three",
        };

        newLobby.setGameMode(socket.id, modeMap[data.mode] || "one_for_one");

        const privateCode = data.isPrivate
          ? normalizeLobbyCode(data.code)
          : undefined;
        if (data.isPrivate && !privateCode) {
          socket.emit("joinLobbyError", {
            message: "Private lobby requires a valid code",
          });
          return;
        }

        lobbiesRegistry.set(lobbyId, {
          lobby: newLobby,
          code: privateCode,
          isPrivate: data.isPrivate,
          createdAt: Date.now(),
        });

        moveSocketToLobby(socket.id, lobbyId);

        socket.emit("lobbyCreated", {
          lobbyId,
          code: privateCode,
        });

        socket.emit("joinLobbySuccess", { lobbyId });

        await newLobby.broadcastStatePublic();

        await broadcastLobbyList();
      },
    );

    socket.on("deleteLobby", async (data: { lobbyId: string }) => {
      const lobbyId = data?.lobbyId;
      if (!lobbyId) {
        socket.emit("deleteLobbyError", { message: "Lobby id is required" });
        return;
      }

      const entry = lobbiesRegistry.get(lobbyId);
      if (!entry) {
        socket.emit("deleteLobbyError", { message: "Lobby not found" });
        return;
      }

      const state = await entry.lobby.getStatePublic();
      if (state.leader !== socket.id) {
        socket.emit("deleteLobbyError", {
          message: "Only the lobby leader can remove this lobby",
        });
        return;
      }

      const affectedSocketIds = Array.from(activeLobbyBySocket.entries())
        .filter(([, activeLobbyId]) => activeLobbyId === lobbyId)
        .map(([socketId]) => socketId);

      for (const socketId of affectedSocketIds) {
        moveSocketToLobby(socketId, "main");
        io.to(socketId).emit("joinLobbySuccess", { lobbyId: "main" });
      }

      lobbiesRegistry.delete(lobbyId);

      io.emit("lobbyDeleted", { lobbyId });
      await broadcastLobbyList();
    });

    socket.on(
      "joinLobbyById",
      async (data: { lobbyId: string; code?: string }) => {
        console.log(
          `🎮 Client ${socket.id} attempting to join lobby ${data.lobbyId}`,
        );

        const entry = lobbiesRegistry.get(data.lobbyId);
        if (!entry) {
          socket.emit("joinLobbyError", { message: "Lobby not found" });
          return;
        }

        if (entry.isPrivate) {
          console.log(
            `Submitted Code: ${data.lobbyId}, Expected Code: ${entry.code}`,
          );
          const submittedCode = normalizeLobbyCode(data.code);
          const expectedCode = normalizeLobbyCode(entry.code);
          if (!submittedCode || submittedCode !== expectedCode) {
            socket.emit("joinLobbyError", {
              message: "Invalid private lobby code",
            });
            return;
          }
        }

        if (!moveSocketToLobby(socket.id, data.lobbyId)) {
          socket.emit("joinLobbyError", { message: "Could not join lobby" });
          return;
        }

        socket.emit("joinLobbySuccess", { lobbyId: data.lobbyId });

        await entry.lobby.broadcastStatePublic();
        await broadcastLobbyList();
      },
    );

    socket.on("joinLobby", async (data?: { inviteSession?: string }) => {
      console.log(
        `Lobby: Client ${socket.id} joining main lobby`,
        data?.inviteSession ? `(via invite: ${data.inviteSession})` : "",
      );

      const inviteSession = normalizeInviteSession(data?.inviteSession);
      if (inviteSession) {
        const inviteLobbyId = ensureInviteLobby(inviteSession);
        if (!moveSocketToLobby(socket.id, inviteLobbyId)) {
          socket.emit("joinLobbyError", {
            message: "Could not join invited lobby",
          });
          return;
        }

        socket.emit("joinLobbySuccess", {
          lobbyId: inviteLobbyId,
          inviteSession,
        });
        await (getLobbyById(inviteLobbyId) ?? mainLobby).broadcastStatePublic();
        return;
      }

      if (!moveSocketToLobby(socket.id, "main")) {
        socket.emit("joinLobbyError", { message: "Could not join lobby" });
        return;
      }

      socket.emit("joinLobbySuccess", { lobbyId: "main" });
      await mainLobby.broadcastStatePublic();
    });

    socket.on("leaveLobbyPage", () => {
      console.log(`Lobby: Client ${socket.id} leaving lobby page`);
      leaveActiveLobby(socket.id);
    });

    socket.on("leaveLobbyById", async (data: { lobbyId: string }) => {
      const entry = lobbiesRegistry.get(data.lobbyId);
      if (!entry) return;

      console.log(`Lobby: Client ${socket.id} leaving lobby ${data.lobbyId}`);
      if (entry.lobby.hasClient(socket.id)) {
        entry.lobby.removeClient(socket.id);
      }

      if (activeLobbyBySocket.get(socket.id) === data.lobbyId) {
        activeLobbyBySocket.delete(socket.id);
      }

      cleanupInviteLobbyIfEmpty(data.lobbyId);
      cleanupPublicLobbyIfEmpty(data.lobbyId);

      await broadcastLobbyList();
    });

    socket.on("requestLobbyState", async () => {
      console.log(`Lobby: Client ${socket.id} requested lobby state`);
      await getActiveLobby(socket.id).broadcastStatePublic();
    });

    socket.on(
      "lobby_setMode",
      (mode: "one_for_one" | "two_for_two" | "three_for_three") =>
        getActiveLobby(socket.id).setGameMode(socket.id, mode),
    );

    socket.on("lobby_setDuration", (duration: "fast" | "normal" | "long") =>
      getActiveLobby(socket.id).setGameDuration(socket.id, duration),
    );

    socket.on("lobby_setPowerUps", (enabled: boolean) =>
      getActiveLobby(socket.id).setPowerUps(socket.id, enabled),
    );

    socket.on(
      "lobby_movePlayer",
      (data: { targetId: string; side: "left" | "right"; slotIndex: number }) =>
        getActiveLobby(socket.id).movePlayerToSlot(
          socket.id,
          data.targetId,
          data.side,
          data.slotIndex,
        ),
    );

    socket.on(
      "lobby_addBot",
      (data: { side: "left" | "right"; slotIndex: number }) =>
        getActiveLobby(socket.id).addBot(socket.id, data.side, data.slotIndex),
    );

    socket.on("lobby_moveToBench", (targetId: string) =>
      getActiveLobby(socket.id).movePlayerToBench(socket.id, targetId),
    );

    socket.on(
      "lobby_removeBot",
      (data: { side: "left" | "right"; slotIndex: number }) =>
        getActiveLobby(socket.id).removeBot(
          socket.id,
          data.side,
          data.slotIndex,
        ),
    );

    socket.on(
      "lobby_botLevel",
      (data: { side: "left" | "right"; slotIndex: number; delta: number }) =>
        getActiveLobby(socket.id).changeBotLevel(
          socket.id,
          data.side,
          data.slotIndex,
          data.delta,
        ),
    );

    socket.on("lobby_leave", async () => {
      console.log(`Player ${socket.id} is leaving lobby`);
      leaveActiveLobby(socket.id);
      await broadcastLobbyList();
    });

    socket.on("lobby_kick", (data: { socketId: string }) => {
      console.log(`Leader ${socket.id} is kicking ${data.socketId}`);
      getActiveLobby(socket.id).kickPlayer(socket.id, data.socketId);
    });

    socket.on("lobby_start", () =>
      getActiveLobby(socket.id).startGame(socket.id),
    );

    socket.on("requestLocalTournamentMatch", async (data: {
      tournamentId: string;
      matchId: string;
      player1_id: string;
      player2_id: string;
      player1_name?: string;
      player2_name?: string;
      tournament_snapshot?: LocalTournamentSnapshot;
    }) => {
      const cleanupPendingLocalMatch = () => {
        const tournamentId = String(data?.tournamentId || "");
        const matchId = String(data?.matchId || "");
        if (!tournamentId || !matchId) return;
        pendingLocalTournamentMatches.delete(`${tournamentId}:${matchId}`);
      };

      try {
        const userId = socketToUserMap.get(socket.id);
        if (!userId) {
          socket.emit("error", { message: "User not authenticated" });
          return;
        }

        const tournamentId = String(data?.tournamentId || "");
        const matchId = String(data?.matchId || "");
        const player1Id = String(data?.player1_id || "");
        const player2Id = String(data?.player2_id || "");

        if (!tournamentId || !matchId || !player1Id || !player2Id) {
          socket.emit("error", { message: "Missing local tournament match context" });
          return;
        }

        const userIsP1 = userId === player1Id;
        const userIsP2 = userId === player2Id;
        if (!userIsP1 && !userIsP2) {
          socket.emit("error", { message: "You are not a participant in this match" });
          return;
        }

        const player1Name = String(data?.player1_name || player1Id);
        const player2Name = String(data?.player2_name || player2Id);
        const providedSnapshot = isLocalTournamentSnapshot(data?.tournament_snapshot)
          ? data.tournament_snapshot
          : undefined;
        const roomId = `local-tournament:${tournamentId}:${matchId}`;
        const matchKey = `${tournamentId}:${matchId}`;
        const now = Date.now();

        if (localTournamentGames.has(roomId)) {
          socket.emit("error", { message: "This local tournament match is already in progress" });
          return;
        }

        const opponentId = userIsP1 ? player2Id : player1Id;
        const userSide: "left" | "right" = userIsP1 ? "left" : "right";
        const opponentSide: "left" | "right" = userIsP1 ? "right" : "left";

        // Human vs AI starts immediately for the requesting user.
        if (opponentId.startsWith("ai-")) {
          const humanName = userIsP1 ? player1Name : player2Name;
          const botName = userIsP1 ? player2Name : player1Name;

          const registryResult = tryRegisterGameUsers([userId], roomId);
          if (!registryResult.ok) {
            socket.emit("error", {
              message: "You are already in another active game.",
              conflicts: registryResult.conflicts,
            });
            return;
          }

          socket.join(roomId);

          const gameConfig = new GameConfiguration("normal", "one_for_one");
          const players: GamePlayer[] = [
            new GamePlayer("human", socket.id, userSide, humanName, userId),
            new GamePlayer("bot", 5, opponentSide, botName),
          ];

          const game = new Game(io, gameConfig, players, roomId, () => {
            localTournamentGames.delete(roomId);
            console.log(`🏁 Local tournament match ended: ${matchId}`);
          });

          (game as any).isTournamentMatch = true;
          localTournamentGames.set(roomId, game);
          game.start();

          socket.emit("localTournamentMatchStarted", { matchId });
          socket.emit("init", {
            side: userSide,
            index: 0,
            configs: gameConfig,
            isTournamentMatch: true,
            isLocalTournament: true,
            players: [player1Id, player2Id],
          });
          return;
        }

        // Human vs Human local match: queue players and start when both are connected.
        const existingPendingMatch = pendingLocalTournamentMatches.get(matchKey);
        if (existingPendingMatch && existingPendingMatch.expiresAt <= now) {
          pendingLocalTournamentMatches.delete(matchKey);
        }

        const pending =
          existingPendingMatch && existingPendingMatch.expiresAt > now
            ? existingPendingMatch
            : {
          tournamentId,
          matchId,
          expiresAt: now + PENDING_MATCH_TTL_MS,
          player1_id: player1Id,
          player2_id: player2Id,
          player1_name: player1Name,
          player2_name: player2Name,
          tournament_snapshot: providedSnapshot,
          slots: [] as Array<{
            side: "left" | "right";
            userId: string;
            socketId: string;
            username: string;
          }>,
        };

        pending.expiresAt = Date.now() + PENDING_MATCH_TTL_MS;

        if (!pending.tournament_snapshot && providedSnapshot) {
          pending.tournament_snapshot = providedSnapshot;
        }

        const existingSlot = pending.slots.find((s) => s.userId === userId);
        if (existingSlot) {
          existingSlot.socketId = socket.id;
        } else {
          pending.slots.push({
            side: userSide,
            userId,
            socketId: socket.id,
            username: userIsP1 ? pending.player1_name : pending.player2_name,
          });
        }

        pendingLocalTournamentMatches.set(matchKey, pending);

        if (pending.slots.length < 2) {
          socket.emit("tournamentMatchWaiting", {
            matchId,
            message: "Waiting for opponent to join...",
          });
          await emitLocalTournamentInvite(userId, opponentId, {
            tournamentId,
            matchId,
            player1_id: player1Id,
            player2_id: player2Id,
            player1_name: pending.player1_name,
            player2_name: pending.player2_name,
            tournament_snapshot: pending.tournament_snapshot,
          });
          return;
        }

        const leftSlot = pending.slots.find((s) => s.side === "left");
        const rightSlot = pending.slots.find((s) => s.side === "right");
        if (!leftSlot || !rightSlot) {
          cleanupPendingLocalMatch();
          socket.emit("error", { message: "Both players must join before starting the match" });
          return;
        }

        const registryResult = tryRegisterGameUsers(
          [pending.player1_id, pending.player2_id],
          roomId
        );
        if (!registryResult.ok) {
          cleanupPendingLocalMatch();
          for (const slot of pending.slots) {
            const target = io.sockets.sockets.get(slot.socketId);
            target?.emit("error", {
              message: "One of the players is already in another active game.",
              conflicts: registryResult.conflicts,
            });
          }
          return;
        }

        const gameConfig = new GameConfiguration("normal", "one_for_one");
        const players: GamePlayer[] = [
          new GamePlayer("human", leftSlot.socketId, "left", pending.player1_name, leftSlot.userId),
          new GamePlayer("human", rightSlot.socketId, "right", pending.player2_name, rightSlot.userId),
        ];

        for (const slot of pending.slots) {
          const target = io.sockets.sockets.get(slot.socketId);
          target?.join(roomId);
        }

        const game = new Game(io, gameConfig, players, roomId, () => {
          localTournamentGames.delete(roomId);
          console.log(`🏁 Local tournament H2H match ended: ${matchId}`);
        });

        (game as any).isTournamentMatch = true;
        localTournamentGames.set(roomId, game);
        pendingLocalTournamentMatches.delete(matchKey);
        game.start();

        for (const slot of pending.slots) {
          const target = io.sockets.sockets.get(slot.socketId);
          if (!target) continue;
          target.emit("localTournamentMatchStarted", { matchId });
          target.emit("init", {
            side: slot.side,
            index: 0,
            configs: gameConfig,
            isTournamentMatch: true,
            isLocalTournament: true,
            players: [player1Id, player2Id],
          });
        }
      } catch (error: any) {
        cleanupPendingLocalMatch();
        console.error("❌ Error starting local tournament match:", error);
        socket.emit("error", { message: error.message || "Failed to start local tournament match" });
      }
    });

    socket.on("localTournamentStateUpdate", (data: {
      tournamentId: string;
      tournament_snapshot?: LocalTournamentSnapshot;
    }) => {
      const userId = socketToUserMap.get(socket.id);
      if (!userId) return;

      const tournamentId = String(data?.tournamentId || "");
      if (!tournamentId || !tournamentId.startsWith("local-")) return;

      const snapshot = isLocalTournamentSnapshot(data?.tournament_snapshot)
        ? data.tournament_snapshot
        : undefined;
      if (!snapshot || snapshot.id !== tournamentId) return;

      const participantIds = snapshot.participants
        .filter((p) => !p.isAI && p.id)
        .map((p) => p.id);
      if (!participantIds.includes(userId)) return;

      const uniqueParticipantIds = [...new Set(participantIds)];
      for (const pid of uniqueParticipantIds) {
        const sockets = userToSocketsMap.get(pid);
        if (!sockets) continue;
        for (const sid of sockets) {
          const target = io.sockets.sockets.get(sid);
          target?.emit("localTournamentStateUpdated", {
            tournamentId,
            tournament_snapshot: snapshot,
          });
        }
      }
    });

    socket.on("requestTournamentMatch", async (data: {
      tournamentId: string;
      matchId: string;
    }) => {
      try {
        const userId = socketToUserMap.get(socket.id);
        if (!userId) {
          socket.emit("error", { message: "User not authenticated" });
          return;
        }

        const tournamentId = String(data?.tournamentId || "");
        const matchId = String(data?.matchId || "");
        if (!tournamentId || !matchId) {
          socket.emit("error", { message: "Missing tournament match context" });
          return;
        }

        const inviteDispatch = await createTournamentMatchInvites(tournamentId, matchId, userId);

        for (const invalidated of inviteDispatch.invalidatedInvites) {
          await emitTournamentInviteInvalidatedToUser(invalidated.toUserId, {
            tournamentId,
            matchId,
            invalidatedToken: invalidated.token,
            supersededByToken: invalidated.supersededByToken,
            requestedBy: userId,
            reason: invalidated.reason,
            invalidatedAt: invalidated.invalidatedAt,
          });
        }

        for (const invite of inviteDispatch.invites) {
          await emitTournamentInviteToUser(userId, invite.toUserId, {
            tournamentId,
            matchId,
            token: invite.token,
            expiresAt: invite.expiresAt,
            player1_id: inviteDispatch.player1_id,
            player2_id: inviteDispatch.player2_id,
            player1_name: inviteDispatch.player1_name,
            player2_name: inviteDispatch.player2_name,
          });
        }

        const joinResult = await addUserToPendingTournamentMatch(socket.id, tournamentId, matchId);
        if (!joinResult.started) {
          socket.emit("tournamentMatchWaiting", {
            matchId,
            message: "Waiting for opponent to join...",
          });
        }
      } catch (error: any) {
        console.error("❌ Error setting up tournament match:", error);
        socket.emit("error", { message: error.message || "Failed to setup tournament match" });
      }
    });

    socket.on("joinTournamentMatch", async (data: {
      tournamentId: string;
      matchId: string;
    }) => {
      try {
        const tournamentId = String(data?.tournamentId || "");
        const matchId = String(data?.matchId || "");
        if (!tournamentId || !matchId) {
          socket.emit("error", { message: "Missing tournament match context" });
          return;
        }

        const joinResult = await addUserToPendingTournamentMatch(socket.id, tournamentId, matchId);
        if (!joinResult.started) {
          socket.emit("tournamentMatchWaiting", {
            matchId,
            message: "Waiting for opponent to join...",
          });
        }
      } catch (error: any) {
        console.error("❌ Error joining tournament match:", error);
        socket.emit("error", { message: error.message || "Failed to join tournament match" });
      }
    });

    socket.on("disconnect", async () => {
      const userId = socketToUserMap.get(socket.id);
      socketToUserMap.delete(socket.id);
      if (userId) {
        const set = userToSocketsMap.get(userId);
        set?.delete(socket.id);
        if (set && set.size === 0) {
          userToSocketsMap.delete(userId);
          void setUserOnlineStatus(userId, false);
        }
        
        // Clean up pending tournament matches for this user
        for (const [matchId, match] of pendingTournamentMatches.entries()) {
          const userSlot = match.slots.find(s => s.userId === userId);
          if (userSlot) {
            // Remove the user's slot from the match
            match.slots = match.slots.filter(s => s.userId !== userId);
            // If no slots left, remove the entire match
            if (match.slots.length === 0) {
              pendingTournamentMatches.delete(matchId);
            }
          }
        }

        for (const [matchKey, match] of pendingLocalTournamentMatches.entries()) {
          const userSlot = match.slots.find(s => s.userId === userId);
          if (userSlot) {
            match.slots = match.slots.filter(s => s.userId !== userId);
            if (match.slots.length === 0) {
              pendingLocalTournamentMatches.delete(matchKey);
            }
          }
        }
      }
      leaveActiveLobby(socket.id);
      await broadcastLobbyList();
      console.log("User disconnected:", socket.id);
    });
  });

  return { io, socketToUserMap, getRuntimeMetrics };
}
