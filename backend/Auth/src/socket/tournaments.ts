import type { Server, Socket } from "socket.io";
import { Game, GameConfiguration, GamePlayer } from "../game/index.js";
import { getOrCreatePrivateChat, createPrivateMessage } from "../services/chat.js";
import db from "../db.js";
import { createTournamentMatchInvites } from "../services/tournamentInviteService.js";
import { tryRegisterGameUsers } from "../game/ActiveGameRegistry.js";
import { clientErrorMessage } from "../utils/httpError.js";
import {
  socketToUserMap,
  userToSocketsMap,
  isLocalTournamentSnapshot,
  encodeTournamentSnapshot,
} from "./state.js";
import type { LocalTournamentSnapshot } from "./state.js";

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
        socket.emit("error", { message: clientErrorMessage(error, "Failed to start tournament match") });
      }
    }
    pendingTournamentMatches.delete(matchKey);
  }
}

// Pending online/local tournament matches and the helpers that fill them.
export function createTournamentManager(io: Server) {
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

  // unref: housekeeping must not keep the process alive on its own.
  const pendingCleanup = setInterval(() => {
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
  pendingCleanup.unref();

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

  return {
    pendingTournamentMatches,
    localTournamentGames,
    pendingLocalTournamentMatches,
    PENDING_MATCH_TTL_MS,
    emitLocalTournamentInvite,
    resolveTournamentMatchContext,
    addUserToPendingTournamentMatch,
    emitTournamentInviteToUser,
    emitTournamentInviteInvalidatedToUser,
  };
}

export type TournamentManager = ReturnType<typeof createTournamentManager>;

export function registerTournamentHandlers(
  io: Server,
  socket: Socket,
  tournaments: TournamentManager,
) {
  const {
    localTournamentGames,
    pendingLocalTournamentMatches,
    PENDING_MATCH_TTL_MS,
    emitLocalTournamentInvite,
    addUserToPendingTournamentMatch,
    emitTournamentInviteToUser,
    emitTournamentInviteInvalidatedToUser,
  } = tournaments;

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
      socket.emit("error", { message: clientErrorMessage(error, "Failed to start local tournament match") });
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
      socket.emit("error", { message: clientErrorMessage(error, "Failed to setup tournament match") });
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
      socket.emit("error", { message: clientErrorMessage(error, "Failed to join tournament match") });
    }
  });

}
