import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { Lobby } from "../game/Lobby.js";
import { attachChatRealtime } from "./chatRealtime.js";

const socketToUserMap = new Map<string, string>();

const lobbiesRegistry = new Map<string, { lobby: Lobby; code?: string; isPrivate: boolean; createdAt: number }>();
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

export function setupSocketIO(httpServer: any) {
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

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
        const playerDataBySocket = (lobbyState.playerData ?? {}) as Record<string, { userId: string; username: string }>;
        const leaderData = leaderSocketId ? playerDataBySocket[leaderSocketId] : undefined;

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
    
  
    const authUserId = (socket.handshake.auth?.userId as string | undefined) || (socket.data.userId as string | undefined);
    if (authUserId) {
      socketToUserMap.set(socket.id, authUserId);
      socket.data.userId = authUserId;
      console.log(`Mapped socket ${socket.id} to user ${authUserId} (handshake auth)`);
    }

    
    const authTokenRaw = socket.handshake.auth?.token || socket.handshake.headers.authorization;
    if (authTokenRaw && !socketToUserMap.has(socket.id)) {
      try {
        const token = String(authTokenRaw).replace(/^Bearer\s+/i, "").trim();
        const JWT_SECRET = process.env.JWT_SECRET as string;
        if (JWT_SECRET && token) {
          const decoded = jwt.verify(token, JWT_SECRET) as { userId?: string };
          if (decoded?.userId) {
            socketToUserMap.set(socket.id, decoded.userId);
            socket.data.userId = decoded.userId;
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
        console.log(`Mapped socket ${socket.id} to user ${data.userId}`);
       
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
      newLobby.setRemoveCallback(() => {
        // Remove lobby if empty after game ends
        if (newLobby.getClientCount() === 0) {
          lobbiesRegistry.delete(lobbyId);
          broadcastLobbyList();
        }
      });
      
      
      const modeMap: Record<string, 'one_for_one' | 'two_for_two' | 'three_for_three'> = {
        '1v1': 'one_for_one',
        '2v2': 'two_for_two',
        '3v3': 'three_for_three',
      };
      
      newLobby.setGameMode(socket.id, modeMap[data.mode] || 'one_for_one');
      
      const privateCode = data.isPrivate ? normalizeLobbyCode(data.code) : undefined;
      if (data.isPrivate && !privateCode) {
        socket.emit("joinLobbyError", { message: "Private lobby requires a valid code" });
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
        code: privateCode
      });

      socket.emit("joinLobbySuccess", { lobbyId });

      await newLobby.broadcastStatePublic();

      await broadcastLobbyList();
    });

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
        socket.emit("deleteLobbyError", { message: "Only the lobby leader can remove this lobby" });
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

    socket.on("joinLobbyById", async (data: { lobbyId: string; code?: string }) => {
      console.log(`🎮 Client ${socket.id} attempting to join lobby ${data.lobbyId}`);
      
      const entry = lobbiesRegistry.get(data.lobbyId);
      if (!entry) {
        socket.emit("joinLobbyError", { message: "Lobby not found" });
        return;
      }

      if (entry.isPrivate) {
        console.log(`Submitted Code: ${data.lobbyId}, Expected Code: ${entry.code}`);
        const submittedCode = normalizeLobbyCode(data.code);
        const expectedCode = normalizeLobbyCode(entry.code);
        if (!submittedCode || submittedCode !== expectedCode) {
          socket.emit("joinLobbyError", { message: "Invalid private lobby code" });
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
    });

    socket.on("joinLobby", async (data?: { inviteSession?: string }) => {
      console.log(`Lobby: Client ${socket.id} joining main lobby`, data?.inviteSession ? `(via invite: ${data.inviteSession})` : '');

      const inviteSession = normalizeInviteSession(data?.inviteSession);
      if (inviteSession) {
        const inviteLobbyId = ensureInviteLobby(inviteSession);
        if (!moveSocketToLobby(socket.id, inviteLobbyId)) {
          socket.emit("joinLobbyError", { message: "Could not join invited lobby" });
          return;
        }

        socket.emit("joinLobbySuccess", { lobbyId: inviteLobbyId, inviteSession });
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
