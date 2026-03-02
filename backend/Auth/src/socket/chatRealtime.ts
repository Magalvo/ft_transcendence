import type { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import {
  createGroupMessage,
  createPrivateMessage,
  getOrCreatePrivateChat,
  isBlocked,
  joinGroup,
} from "../services/chat.js";

const socketUsers = new Map<string, string>();

function readTokenFromCookieHeader(cookieHeader?: string): string | null {
  if (!cookieHeader) return null;
  const pairs = cookieHeader.split(";").map((p) => p.trim());
  for (const pair of pairs) {
    const idx = pair.indexOf("=");
    if (idx === -1) continue;
    const key = pair.slice(0, idx);
    const value = pair.slice(idx + 1);
    if (key === "token") return decodeURIComponent(value);
  }
  return null;
}

function getSocketsForUser(io: Server, userId: string): string[] {
  const ids: string[] = [];
  for (const [sid, uid] of socketUsers.entries()) {
    if (uid === userId && io.sockets.sockets.get(sid)) ids.push(sid);
  }
  return ids;
}

const PONG_INVITE_PREFIX = "__PONG_INVITE__|";

export function attachChatRealtime(io: Server, socket: Socket) {
  socket.on("chat_auth", (data: { token?: string }) => {
    try {
      const token =
        data?.token ||
        (socket.handshake.auth?.token as string | undefined) ||
        readTokenFromCookieHeader(socket.handshake.headers.cookie);
      if (!token) return socket.emit("chat_error", { message: "Missing chat auth token" });
      const JWT_SECRET = process.env.JWT_SECRET as string;
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
      socketUsers.set(socket.id, decoded.userId);
      socket.join(`user:${decoded.userId}`);
      socket.emit("chat_auth_ok", { userId: decoded.userId });
    } catch {
      socket.emit("chat_error", { message: "Invalid chat auth token" });
    }
  });

  socket.on("chat_join_group", async (data: { groupId: number; password?: string }) => {
    try {
      const userId = socketUsers.get(socket.id);
      if (!userId) return socket.emit("chat_error", { message: "Not authenticated for chat socket" });
      await joinGroup(Number(data.groupId), userId, data.password);
      socket.join(`group:${data.groupId}`);
      socket.emit("chat_joined_group", { groupId: Number(data.groupId) });
    } catch (e: any) {
      socket.emit("chat_error", { message: e.message || "Failed to join group" });
    }
  });

  socket.on("chat_send_group", async (data: { groupId: number; messagem: string }) => {
    try {
      const userId = socketUsers.get(socket.id);
      if (!userId) return socket.emit("chat_error", { message: "Not authenticated for chat socket" });
      const msg = await createGroupMessage(Number(data.groupId), userId, data.messagem);

      const roomName = `group:${data.groupId}`;
      const clientIds = await io.in(roomName).allSockets();
      for (const sid of clientIds) {
        const viewerId = socketUsers.get(sid);
        if (!viewerId) continue;
        if (await isBlocked(viewerId, userId)) continue;
        io.to(sid).emit("chat_group_message", msg);
      }
    } catch (e: any) {
      socket.emit("chat_error", { message: e.message || "Failed to send group message" });
    }
  });

  socket.on("chat_send_dm", async (data: { targetId: string; messagem: string }) => {
    try {
      const userId = socketUsers.get(socket.id);
      if (!userId) return socket.emit("chat_error", { message: "Not authenticated for chat socket" });

      const chat = await getOrCreatePrivateChat(userId, data.targetId);
      const msg = await createPrivateMessage(Number(chat.id_privatechat), userId, data.messagem);

      const targets = new Set<string>([
        ...getSocketsForUser(io, userId),
        ...getSocketsForUser(io, data.targetId),
      ]);
      for (const sid of targets) {
        const viewerId = socketUsers.get(sid);
        if (!viewerId) continue;
        if (await isBlocked(viewerId, userId)) continue;
        io.to(sid).emit("chat_private_message", msg);
      }
    } catch (e: any) {
      socket.emit("chat_error", { message: e.message || "Failed to send private message" });
    }
  });

  socket.on("chat_invite_game", async (data: { targetId: string; url: string; id_session?: string }) => {
    try {
      const senderId = socketUsers.get(socket.id);
      if (!senderId || !data?.targetId || !data?.url) return;

      const chat = await getOrCreatePrivateChat(senderId, data.targetId);
      const encodedUrl = encodeURIComponent(data.url);
      const encodedSession = encodeURIComponent(data.id_session || "");
      const inviteMessage = `${PONG_INVITE_PREFIX}${encodedUrl}|${encodedSession}`;
      const msg = await createPrivateMessage(Number(chat.id_privatechat), senderId, inviteMessage);

      const targets = new Set<string>([
        ...getSocketsForUser(io, senderId),
        ...getSocketsForUser(io, data.targetId),
      ]);
      for (const sid of targets) {
        const viewerId = socketUsers.get(sid);
        if (!viewerId) continue;
        if (await isBlocked(viewerId, senderId)) continue;
        io.to(sid).emit("chat_private_message", msg);
      }
    } catch (e: any) {
      socket.emit("chat_error", { message: e.message || "Failed to send game invite" });
    }
  });

  socket.on("disconnect", () => {
    socketUsers.delete(socket.id);
  });
}
