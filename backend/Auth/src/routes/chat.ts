import { FastifyPluginAsync } from "fastify";
import authenticate from "../middleware/authenticate.js";
import {
  banMember,
  blockUser,
  createGroup,
  createGroupMessage,
  createPrivateMessage,
  getBlockedUsers,
  getChatProfileByUserId,
  getChatUsersList,
  getGroupMembers,
  getGroupMessages,
  getGroupRole,
  getGroupsForUser,
  inviteMember,
  getOrCreatePrivateChat,
  getPrivateChatsForUser,
  getPrivateMessages,
  joinGroup,
  kickMember,
  leaveGroup,
  muteMember,
  setGroupAdmin,
  setGroupPassword,
  unbanMember,
  unmuteMember,
  unblockUser,
} from "../services/chat.js";
import { sendError } from "../utils/respond.js";

const chatRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", authenticate);

  app.get("/groups", async (request, reply) => {
    try {
      const userId = (request as any).user.id as string;
      return await getGroupsForUser(userId);
    } catch (e: any) {
      return sendError(reply, e.message || "Failed to fetch groups", 400);
    }
  });

  app.post("/groups", async (request, reply) => {
    try {
      const userId = (request as any).user.id as string;
      const { name, visibility, password } = request.body as any;
      const group = await createGroup(userId, name, visibility, password);
      reply.code(201);
      return group;
    } catch (e: any) {
      return sendError(reply, e.message || "Failed to create group", 400);
    }
  });

  app.post("/groups/:groupId/join", async (request, reply) => {
    try {
      const userId = (request as any).user.id as string;
      const { groupId } = request.params as { groupId: string };
      const { password } = request.body as any;
      return await joinGroup(Number(groupId), userId, password);
    } catch (e: any) {
      return sendError(reply, e.message || "Failed to join group", 400);
    }
  });

  app.post("/groups/:groupId/leave", async (request, reply) => {
    try {
      const userId = (request as any).user.id as string;
      const { groupId } = request.params as { groupId: string };
      await leaveGroup(Number(groupId), userId);
      return { ok: true };
    } catch (e: any) {
      return sendError(reply, e.message || "Failed to leave group", 400);
    }
  });

  app.get("/groups/:groupId/messages", async (request, reply) => {
    try {
      const userId = (request as any).user.id as string;
      const { groupId } = request.params as { groupId: string };
      const limit = Number((request.query as any)?.limit ?? 50);
      return await getGroupMessages(Number(groupId), userId, limit);
    } catch (e: any) {
      return sendError(reply, e.message || "Failed to fetch group messages", 400);
    }
  });

  app.get("/groups/:groupId/role", async (request, reply) => {
    try {
      const userId = (request as any).user.id as string;
      const { groupId } = request.params as { groupId: string };
      return { role: await getGroupRole(Number(groupId), userId) };
    } catch (e: any) {
      return sendError(reply, e.message || "Failed to fetch role", 400);
    }
  });

  app.get("/groups/:groupId/members", async (request, reply) => {
    try {
      const userId = (request as any).user.id as string;
      const { groupId } = request.params as { groupId: string };
      return await getGroupMembers(Number(groupId), userId);
    } catch (e: any) {
      return sendError(reply, e.message || "Failed to fetch members", 400);
    }
  });

  app.post("/groups/:groupId/invite", async (request, reply) => {
    try {
      const userId = (request as any).user.id as string;
      const { groupId } = request.params as { groupId: string };
      const { targetId, username, target } = request.body as any;
      const targetValue = String(target ?? username ?? targetId ?? "").trim();
      if (!targetValue) return sendError(reply, "Target username is required", 400);
      return await inviteMember(Number(groupId), userId, targetValue);
    } catch (e: any) {
      return sendError(reply, e.message || "Failed to invite member", 400);
    }
  });

  app.post("/groups/:groupId/messages", async (request, reply) => {
    try {
      const userId = (request as any).user.id as string;
      const { groupId } = request.params as { groupId: string };
      const { messagem } = request.body as any;
      const msg = await createGroupMessage(Number(groupId), userId, messagem);
      reply.code(201);
      return msg;
    } catch (e: any) {
      return sendError(reply, e.message || "Failed to send group message", 400);
    }
  });

  app.post("/groups/:groupId/admins/:targetId", async (request, reply) => {
    try {
      const userId = (request as any).user.id as string;
      const { groupId, targetId } = request.params as { groupId: string; targetId: string };
      const { enabled } = request.body as any;
      await setGroupAdmin(Number(groupId), userId, targetId, !!enabled);
      return { ok: true };
    } catch (e: any) {
      return sendError(reply, e.message || "Failed to update admin role", 400);
    }
  });

  app.post("/groups/:groupId/ban/:targetId", async (request, reply) => {
    try {
      const userId = (request as any).user.id as string;
      const { groupId, targetId } = request.params as { groupId: string; targetId: string };
      await banMember(Number(groupId), userId, targetId);
      return { ok: true };
    } catch (e: any) {
      return sendError(reply, e.message || "Failed to ban user", 400);
    }
  });

  app.delete("/groups/:groupId/ban/:targetId", async (request, reply) => {
    try {
      const userId = (request as any).user.id as string;
      const { groupId, targetId } = request.params as { groupId: string; targetId: string };
      await unbanMember(Number(groupId), userId, targetId);
      return { ok: true };
    } catch (e: any) {
      return sendError(reply, e.message || "Failed to unban user", 400);
    }
  });

  // Compatibility route for environments where DELETE may fail due proxy/CORS restrictions.
  app.post("/groups/:groupId/unban/:targetId", async (request, reply) => {
    try {
      const userId = (request as any).user.id as string;
      const { groupId, targetId } = request.params as { groupId: string; targetId: string };
      await unbanMember(Number(groupId), userId, targetId);
      return { ok: true };
    } catch (e: any) {
      return sendError(reply, e.message || "Failed to unban user", 400);
    }
  });

  app.post("/groups/:groupId/kick/:targetId", async (request, reply) => {
    try {
      const userId = (request as any).user.id as string;
      const { groupId, targetId } = request.params as { groupId: string; targetId: string };
      await kickMember(Number(groupId), userId, targetId);
      return { ok: true };
    } catch (e: any) {
      return sendError(reply, e.message || "Failed to kick user", 400);
    }
  });

  app.post("/groups/:groupId/mute/:targetId", async (request, reply) => {
    try {
      const userId = (request as any).user.id as string;
      const { groupId, targetId } = request.params as { groupId: string; targetId: string };
      const { seconds } = request.body as any;
      await muteMember(Number(groupId), userId, targetId, Number(seconds));
      return { ok: true };
    } catch (e: any) {
      return sendError(reply, e.message || "Failed to mute user", 400);
    }
  });

  app.post("/groups/:groupId/unmute/:targetId", async (request, reply) => {
    try {
      const userId = (request as any).user.id as string;
      const { groupId, targetId } = request.params as { groupId: string; targetId: string };
      await unmuteMember(Number(groupId), userId, targetId);
      return { ok: true };
    } catch (e: any) {
      return sendError(reply, e.message || "Failed to unmute user", 400);
    }
  });

  app.patch("/groups/:groupId/password", async (request, reply) => {
    try {
      const userId = (request as any).user.id as string;
      const { groupId } = request.params as { groupId: string };
      const { visibility, password } = request.body as any;
      await setGroupPassword(Number(groupId), userId, visibility, password);
      return { ok: true };
    } catch (e: any) {
      return sendError(reply, e.message || "Failed to update channel settings", 400);
    }
  });

  // Compatibility route for environments where PATCH may fail due proxy/CORS restrictions.
  app.post("/groups/:groupId/settings", async (request, reply) => {
    try {
      const userId = (request as any).user.id as string;
      const { groupId } = request.params as { groupId: string };
      const { visibility, password } = request.body as any;
      await setGroupPassword(Number(groupId), userId, visibility, password);
      return { ok: true };
    } catch (e: any) {
      return sendError(reply, e.message || "Failed to update channel settings", 400);
    }
  });

  app.get("/private", async (request, reply) => {
    try {
      const userId = (request as any).user.id as string;
      return await getPrivateChatsForUser(userId);
    } catch (e: any) {
      return sendError(reply, e.message || "Failed to fetch private chats", 400);
    }
  });

  app.post("/private", async (request, reply) => {
    try {
      const userId = (request as any).user.id as string;
      const { targetId } = request.body as any;
      return await getOrCreatePrivateChat(userId, String(targetId));
    } catch (e: any) {
      return sendError(reply, e.message || "Failed to create private chat", 400);
    }
  });

  app.get("/private/:chatId/messages", async (request, reply) => {
    try {
      const userId = (request as any).user.id as string;
      const { chatId } = request.params as { chatId: string };
      const limit = Number((request.query as any)?.limit ?? 50);
      return await getPrivateMessages(Number(chatId), userId, limit);
    } catch (e: any) {
      return sendError(reply, e.message || "Failed to fetch private messages", 400);
    }
  });

  app.post("/private/:chatId/messages", async (request, reply) => {
    try {
      const userId = (request as any).user.id as string;
      const { chatId } = request.params as { chatId: string };
      const { messagem } = request.body as any;
      const msg = await createPrivateMessage(Number(chatId), userId, messagem);
      reply.code(201);
      return msg;
    } catch (e: any) {
      return sendError(reply, e.message || "Failed to send private message", 400);
    }
  });

  app.get("/blocks", async (request, reply) => {
    try {
      const userId = (request as any).user.id as string;
      return await getBlockedUsers(userId);
    } catch (e: any) {
      return sendError(reply, e.message || "Failed to fetch block list", 400);
    }
  });

  app.post("/blocks/:targetId", async (request, reply) => {
    try {
      const userId = (request as any).user.id as string;
      const { targetId } = request.params as { targetId: string };
      await blockUser(userId, targetId);
      return { ok: true };
    } catch (e: any) {
      return sendError(reply, e.message || "Failed to block user", 400);
    }
  });

  app.delete("/blocks/:targetId", async (request, reply) => {
    try {
      const userId = (request as any).user.id as string;
      const { targetId } = request.params as { targetId: string };
      await unblockUser(userId, targetId);
      return { ok: true };
    } catch (e: any) {
      return sendError(reply, e.message || "Failed to unblock user", 400);
    }
  });

  // Compatibility route for environments where DELETE may fail due proxy/CORS restrictions.
  app.post("/blocks/unblock/:targetId", async (request, reply) => {
    try {
      const userId = (request as any).user.id as string;
      const { targetId } = request.params as { targetId: string };
      await unblockUser(userId, targetId);
      return { ok: true };
    } catch (e: any) {
      return sendError(reply, e.message || "Failed to unblock user", 400);
    }
  });

  app.get("/users/:userId/profile", async (request, reply) => {
    try {
      const { userId } = request.params as { userId: string };
      return await getChatProfileByUserId(userId);
    } catch (e: any) {
      return sendError(reply, e.message || "Failed to fetch profile", 400);
    }
  });

  app.get("/users", async (request, reply) => {
    try {
      const userId = (request as any).user.id as string;
      return await getChatUsersList(userId);
    } catch (e: any) {
      return sendError(reply, e.message || "Failed to fetch users", 400);
    }
  });
};

export default chatRoutes;
