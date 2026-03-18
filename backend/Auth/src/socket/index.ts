import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { Lobby } from "../game/Lobby.js";
import { Game, GameConfiguration, GamePlayer } from "../game/index.js";
import { attachChatRealtime } from "./chatRealtime.js";
import { getOrCreatePrivateChat, createPrivateMessage } from "../services/chat.js";

const socketToUserMap = new Map<string, string>();
const userToSocketsMap = new Map<string, Set<string>>();

const lobbiesRegistry = new Map<
  string,
  { lobby: Lobby; code?: string; isPrivate: boolean; createdAt: number }
>();
const inviteLobbies = new Map<string, Lobby>();
const inviteSessionToLobbyId = new Map<string, string>();
const inviteLobbyIdToSession = new Map<string, string>();
const activeLobbyBySocket = new Map<string, string>();

function normalizeLobbyCode(raw?: string): string {
  return (raw || "").trim().toUpperCase();
}

function generateLobbyId(): string {
  return Math.random().toString(36).substring(2, 15);
}

async function startTournamentGame(matchKey: string, matchId: string, pendingMatch: any, io: Server) {
  try {
    console.log(`🏆 Starting tournament game for match: ${matchId}`);
    
    // Create a temporary game room for the tournament match
    const roomId = `tournament:${pendingMatch.tournamentId}:${matchId}`;
    
    // Create game configuration for 1v1
    const gameConfig = new GameConfiguration("normal", "one_for_one");
    
    // Create players from the slots, sorted by side (left first, then right)
    const sortedSlots = pendingMatch.slots.sort((a, b) => a.side === 'left' ? -1 : 1);
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
        const playerIndex = players.findIndex(p => p.userId === slot.userId);
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
    pendingTournamentMatches.delete(matchId);
  }
}

export function setupSocketIO(httpServer: any) {
  const io = new Server(httpServer, {
    cors: {
      origin: "http://localhost:5173",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  const pendingTournamentMatches = new Map<
    string,
    {
      tournamentId: string;
      matchId: string;
      slots: Array<{
        side: "left" | "right";
        userId: string;
        socketId: string;
        username: string;
      }>;
    }
  >();

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
  };

  const buildAvailableLobbies = async () => {
    return Promise.all(
      Array.from(lobbiesRegistry.entries()).map(async ([lobbyId, entry]) => {
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

    const authUserId =
      (socket.handshake.auth?.userId as string | undefined) ||
      (socket.data.userId as string | undefined);
    if (authUserId) {
      socketToUserMap.set(socket.id, authUserId);
      socket.data.userId = authUserId;
      if (!userToSocketsMap.has(authUserId)) userToSocketsMap.set(authUserId, new Set());
      userToSocketsMap.get(authUserId)!.add(socket.id);
      console.log(`Mapped socket ${socket.id} to user ${authUserId} (handshake auth)`);
    }

    const authTokenRaw =
      socket.handshake.auth?.token || socket.handshake.headers.authorization;
    if (authTokenRaw && !socketToUserMap.has(socket.id)) {
      try {
        const token = String(authTokenRaw)
          .replace(/^Bearer\s+/i, "")
          .trim();
        const JWT_SECRET = process.env.JWT_SECRET as string;
        if (JWT_SECRET && token) {
          const decoded = jwt.verify(token, JWT_SECRET) as { userId?: string };
          if (decoded?.userId) {
            socketToUserMap.set(socket.id, decoded.userId);
            socket.data.userId = decoded.userId;
            if (!userToSocketsMap.has(decoded.userId)) userToSocketsMap.set(decoded.userId, new Set());
            userToSocketsMap.get(decoded.userId)!.add(socket.id);
            console.log(`Mapped socket ${socket.id} to user ${decoded.userId} (jwt)`);
          }
        }
      } catch (error) {
        console.log("Could not extract user info from token");
      }
    }

    if (!socketToUserMap.has(socket.id)) {
      socket.emit("requestUserAuth");
    }

    socket.on("userAuth", (data: { userId: string }) => {
      if (data.userId) {
        socketToUserMap.set(socket.id, data.userId);
        socket.data.userId = data.userId;
      if (!userToSocketsMap.has(data.userId)) userToSocketsMap.set(data.userId, new Set());
      userToSocketsMap.get(data.userId)!.add(socket.id);
        getActiveLobby(socket.id).broadcastStatePublic();
      }
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

    // Tournament match handler
    socket.on("requestTournamentMatch", async (data: {
      tournamentId: string;
      matchId: string;
      player1_id: string;
      player2_id: string;
      player1_name?: string;
      player2_name?: string;

    }) => {
      try {
        console.log(`🏆 Tournament match requested: ${data.matchId}`);
        
        const { tournamentId, matchId, player1_id, player2_id, player1_name, player2_name } = data;
        const matchKey = `${tournamentId}:${matchId}`;
        const userId = socketToUserMap.get(socket.id);

        if (!userId) {
          socket.emit("error", { message: "User not authenticated" });
          return;
        }

        // When requesting a tournament match, any user (host or participant)
        // can trigger the invite. The match starts once both players connect.

        const isPlayer1 = userId === player1_id;
        const isPlayer2 = userId === player2_id;
        const requesterSide = isPlayer1 ? "left" : "right";
        const requesterName = isPlayer1 ? player1_name : player2_name;

        // Check if match is already pending
        const existingMatch = pendingTournamentMatches.get(matchKey);
        if (existingMatch) {
          // If this player already joined, ignore and keep waiting
          const existingSlot = existingMatch.slots.find(s => s.userId === userId);
          if (existingSlot) {
            socket.emit("tournamentMatchWaiting", { matchId, message: "Waiting for opponent to join..." });
            return;
          }

          // Add this player to the pending match
          const side = userId === player1_id ? "left" : "right";
          existingMatch.slots.push({
            side,
            userId: userId,
            socketId: socket.id,
            username: requesterName || userId,
          });

          // Start when both players have joined
          if (existingMatch.slots.length >= 2) {
            await startTournamentGame(matchKey, matchId, existingMatch, io);
          } else {
            socket.emit("tournamentMatchWaiting", { matchId, message: "Waiting for opponent to join..." });
          }
          return;
        }

        // Create new pending tournament match (empty until players join)
        const pendingMatch: any = {
          tournamentId,
          matchId,
          slots: [],
        };

        // If the requester is one of the players, add them immediately
        if (isPlayer1 || isPlayer2) {
          pendingMatch.slots.push({
            side: requesterSide,
            userId: userId,
            socketId: socket.id,
            username: requesterName || userId,
          });
        }

        pendingTournamentMatches.set(matchKey, pendingMatch);

        // Send chat invite to opponent
        const inviteUrl = `/game?tournamentId=${tournamentId}&matchId=${matchId}&p1=${player1_id}&p2=${player2_id}`;
        const inviteSession = `tournament_${tournamentId}_${matchId}`;
        
        // Use the same invite format as regular game invites
        const encodedUrl = encodeURIComponent(inviteUrl);
        const encodedSession = encodeURIComponent(inviteSession);
        const inviteMessage = `__PONG_INVITE__|${encodedUrl}|${encodedSession}`;

        // Send private message invite to both players (and to requester for confirmation)
        try {
          // Use the requester as the sender for invite messages
          const targets = new Set([player1_id, player2_id, userId]);

          // Send invite to each target by creating/using the private chat with the requester
          for (const targetId of targets) {
            if (!targetId) continue;
            const chat = await getOrCreatePrivateChat(userId, targetId);
            const msg = await createPrivateMessage(Number(chat.id_privatechat), userId, inviteMessage);

            const targetSockets = userToSocketsMap.get(targetId);
            if (!targetSockets) continue;

            for (const targetSocketId of targetSockets) {
              const targetSocket = io.sockets.sockets.get(targetSocketId);
              if (targetSocket) {
                targetSocket.emit("chat_private_message", msg);
              }
            }
          }
        } catch (chatError) {
          console.error("Failed to send tournament invite via chat:", chatError);
          socket.emit("error", { message: "Failed to send tournament invitation" });
          pendingTournamentMatches.delete(matchId);
          return;
        }

        socket.emit("tournamentMatchWaiting", { matchId, message: "Waiting for opponent to join..." });
        console.log(`✅ Tournament invite sent for match: ${matchId}`);
      } catch (error: any) {
        console.error("❌ Error setting up tournament match:", error);
        socket.emit("error", { message: error.message || "Failed to setup tournament match" });
      }
    });

    socket.on("disconnect", async () => {
      const userId = socketToUserMap.get(socket.id);
      socketToUserMap.delete(socket.id);
      if (userId) {
        const set = userToSocketsMap.get(userId);
        set?.delete(socket.id);
        if (set && set.size === 0) userToSocketsMap.delete(userId);
        
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
            break;
          }
        }
      }
      leaveActiveLobby(socket.id);
      await broadcastLobbyList();
      console.log("User disconnected:", socket.id);
    });
  });

  return { io, socketToUserMap };
}
