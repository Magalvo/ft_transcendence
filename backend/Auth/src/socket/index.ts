import { Server } from "socket.io";
import { Lobby } from "../game/Lobby.js";
import { attachChatRealtime } from "./chatRealtime.js";

// Map socket IDs to user IDs for game tracking
const socketToUserMap = new Map<string, string>();

// Lobbies registry - maps lobby ID to Lobby instance
// In production, this should be persisted to a database
const lobbiesRegistry = new Map<string, { lobby: Lobby; code?: string; isPrivate: boolean; createdAt: number }>();
const activeLobbyBySocket = new Map<string, string>();

// Generate a random lobby ID
function generateLobbyId(): string {
  return Math.random().toString(36).substring(2, 15);
}

export function setupSocketIO(httpServer: any) {
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  const mainLobby = new Lobby(io, socketToUserMap, "lobby:main");

  const getLobbyById = (lobbyId: string): Lobby | null => {
    if (lobbyId === "main") return mainLobby;
    return lobbiesRegistry.get(lobbyId)?.lobby ?? null;
  };

  const getActiveLobby = (socketId: string): Lobby => {
    const activeLobbyId = activeLobbyBySocket.get(socketId) ?? "main";
    return getLobbyById(activeLobbyId) ?? mainLobby;
  };

  const moveSocketToLobby = (socketId: string, targetLobbyId: string): boolean => {
    const targetLobby = getLobbyById(targetLobbyId);
    if (!targetLobby) {
      return false;
    }

    const currentLobbyId = activeLobbyBySocket.get(socketId) ?? "main";
    if (currentLobbyId !== targetLobbyId) {
      const currentLobby = getLobbyById(currentLobbyId);
      if (currentLobby?.hasClient(socketId)) {
        currentLobby.removeClient(socketId);
      }
    }

    if (!targetLobby.hasClient(socketId)) {
      targetLobby.addClient(socketId);
    }

    activeLobbyBySocket.set(socketId, targetLobbyId);
    return true;
  };

  const leaveActiveLobby = (socketId: string): void => {
    const currentLobby = getActiveLobby(socketId);
    if (currentLobby.hasClient(socketId)) {
      currentLobby.removeClient(socketId);
    }
    activeLobbyBySocket.delete(socketId);
  };

  const buildAvailableLobbies = async () => {
    return Promise.all(
      Array.from(lobbiesRegistry.entries()).map(async ([lobbyId, entry]) => {
        const lobbyState = await entry.lobby.getStatePublic();

        const playerCount = [lobbyState.slots.left, lobbyState.slots.right]
          .flat()
          .filter((slot) => slot.content === "human").length;

        const playerData = Object.values(lobbyState.playerData ?? {}) as Array<{ userId: string; username: string }>;
        const leaderUsername =
          playerData.find((player) => player.userId === lobbyState.leader)?.username ?? "Player";

        return {
          id: lobbyId,
          leader: {
            id: lobbyState.leader || "unknown",
            username: leaderUsername,
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
          code: entry.isPrivate ? entry.code : undefined,
          createdAt: entry.createdAt,
          status: "waiting" as const,
        };
      })
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
    
    // Try to get user ID from auth token in socket data
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization;
    if (token) {
      try {
        // Extract user ID from JWT if available
        // For now, we'll look it up via a custom event
        socket.emit("requestUserAuth");
      } catch (error) {
        console.log("Could not extract user info from token");
      }
    }
    
    // Listen for user authentication
    socket.on("userAuth", (data: { userId: string }) => {
      if (data.userId) {
        socketToUserMap.set(socket.id, data.userId);
        socket.data.userId = data.userId;  // Also store in socket.data
        console.log(`Mapped socket ${socket.id} to user ${data.userId}`);
        
        // Broadcast updated state after user is authenticated
        getActiveLobby(socket.id).broadcastStatePublic();
      }
    });

    mainLobby.addClient(socket.id);
    activeLobbyBySocket.set(socket.id, "main");
    attachChatRealtime(io, socket);

    // ===== Find Game / Lobbies =====
    socket.on("requestAvailableLobbies", async () => {
      console.log(`🔍 Client ${socket.id} requesting available lobbies`);

      const lobbies = await buildAvailableLobbies();
      socket.emit("availableLobbies", lobbies);
    });

    socket.on("createLobby", async (data: { mode: string; isPrivate: boolean; code?: string }) => {
      console.log(`📋 Client ${socket.id} creating lobby: ${data.mode} (${data.isPrivate ? "private" : "public"})`);
      
      const lobbyId = generateLobbyId();
      const newLobby = new Lobby(io, socketToUserMap, `lobby:${lobbyId}`);
      
      // Set initial game mode based on request
      const modeMap: Record<string, 'one_for_one' | 'two_for_two' | 'three_for_three'> = {
        '1v1': 'one_for_one',
        '2v2': 'two_for_two',
        '3v3': 'three_for_three',
      };
      
      newLobby.setGameMode(socket.id, modeMap[data.mode] || 'one_for_one');
      
      lobbiesRegistry.set(lobbyId, {
        lobby: newLobby,
        code: data.isPrivate ? data.code : undefined,
        isPrivate: data.isPrivate,
        createdAt: Date.now(),
      });
      
      // Notify creator
      socket.emit("lobbyCreated", { 
        lobbyId, 
        code: data.isPrivate ? data.code : undefined 
      });

      await broadcastLobbyList();
    });

    socket.on("joinLobbyById", async (data: { lobbyId: string }) => {
      console.log(`🎮 Client ${socket.id} attempting to join lobby ${data.lobbyId}`);
      
      const entry = lobbiesRegistry.get(data.lobbyId);
      if (!entry) {
        socket.emit("joinLobbyError", { message: "Lobby not found" });
        return;
      }
      
      if (!moveSocketToLobby(socket.id, data.lobbyId)) {
        socket.emit("joinLobbyError", { message: "Could not join lobby" });
        return;
      }

      socket.emit("joinLobbySuccess", { lobbyId: data.lobbyId });
      
      await entry.lobby.broadcastStatePublic();
      await broadcastLobbyList();
    });

    socket.on("joinLobby", async (data?: { inviteSession?: string }) => {
      console.log(`Lobby: Client ${socket.id} joining main lobby`, data?.inviteSession ? `(via invite: ${data.inviteSession})` : '');

      if (!moveSocketToLobby(socket.id, "main")) {
        return;
      }

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

      await broadcastLobbyList();
    });

    socket.on("requestLobbyState", async () => {
      console.log(`Lobby: Client ${socket.id} requested lobby state`);
      await getActiveLobby(socket.id).broadcastStatePublic();
    });

    socket.on("lobby_setMode", (mode: "one_for_one" | "two_for_two" | "three_for_three") =>
      getActiveLobby(socket.id).setGameMode(socket.id, mode)
    );

    socket.on("lobby_setDuration", (duration: "fast" | "normal" | "long") =>
      getActiveLobby(socket.id).setGameDuration(socket.id, duration)
    );

    socket.on("lobby_setPowerUps", (enabled: boolean) =>
      getActiveLobby(socket.id).setPowerUps(socket.id, enabled)
    );

    socket.on("lobby_movePlayer", (data: { targetId: string; side: "left" | "right"; slotIndex: number }) =>
      getActiveLobby(socket.id).movePlayerToSlot(
        socket.id,
        data.targetId,
        data.side,
        data.slotIndex
      )
    );

    socket.on("lobby_addBot", (data: { side: "left" | "right"; slotIndex: number }) =>
      getActiveLobby(socket.id).addBot(socket.id, data.side, data.slotIndex)
    );

    socket.on("lobby_moveToBench", (targetId: string) =>
      getActiveLobby(socket.id).movePlayerToBench(socket.id, targetId)
    );

    socket.on("lobby_removeBot", (data: { side: "left" | "right"; slotIndex: number }) =>
      getActiveLobby(socket.id).removeBot(socket.id, data.side, data.slotIndex)
    );

    socket.on("lobby_botLevel", (data: { side: "left" | "right"; slotIndex: number; delta: number }) =>
      getActiveLobby(socket.id).changeBotLevel(
        socket.id,
        data.side,
        data.slotIndex,
        data.delta
      )
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
      getActiveLobby(socket.id).startGame(socket.id)
    );

    socket.on("disconnect", async () => {
      socketToUserMap.delete(socket.id);
      leaveActiveLobby(socket.id);
      await broadcastLobbyList();
      console.log("User disconnected:", socket.id);
    });
  });

  return { io, socketToUserMap };
}
