import { Server } from "socket.io";
import { readBearerToken, verifyAccessToken } from "../utils/tokens.js";
import { attachChatRealtime } from "./chatRealtime.js";
import { createLobbyManager, registerLobbyHandlers } from "./lobbies.js";
import { createTournamentManager, registerTournamentHandlers } from "./tournaments.js";
import {
  socketToUserMap,
  userToSocketsMap,
  lobbiesRegistry,
  inviteLobbies,
  activeLobbyBySocket,
  setUserOnlineStatus,
  getSocketCorsOrigin,
} from "./state.js";

export function setupSocketIO(httpServer: any) {
  const io = new Server(httpServer, {
    cors: {
      origin: getSocketCorsOrigin(),
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  const tournaments = createTournamentManager(io);
  const lobbies = createLobbyManager(io);
  const {
    pendingTournamentMatches,
    localTournamentGames,
    pendingLocalTournamentMatches,
  } = tournaments;
  const { mainLobby, getActiveLobby, leaveActiveLobby, broadcastLobbyList } = lobbies;

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

    registerLobbyHandlers(io, socket, lobbies);
    registerTournamentHandlers(io, socket, tournaments);

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
