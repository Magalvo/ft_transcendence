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
import db from "../db.js";
import { sendCaughtError } from "../utils/httpError.js";

const chatRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", authenticate);

  const emitGroupMembersUpdated = (
    groupId: number,
    reason: string,
    actorId?: string,
  ) => {
    void (async () => {
      const members = await db("chat_group_members")
        .select("user_id")
        .where({ id_group: groupId });
      const payload = { groupId, reason, actorId };
      for (const member of members) {
        app.io?.to(`user:${String(member.user_id)}`).emit(
          "chat_group_members_updated",
          payload,
        );
      }
    })();
  };

  const emitGroupRemovedForUser = (
    groupId: number,
    targetId: string,
    reason: string,
    actorId?: string,
  ) => {
    app.io?.to(`user:${targetId}`).emit("chat_group_removed", {
      groupId,
      reason,
      actorId,
      targetId,
    });
  };

  app.get("/groups", async (request, reply) => {
    try {
      const userId = (request as any).user.id as string;
      return await getGroupsForUser(userId);
    } catch (e: any) {
      return sendCaughtError(reply, e, "Failed to fetch groups");
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
      return sendCaughtError(reply, e, "Failed to create group");
    }
  });

  app.post("/groups/:groupId/join", async (request, reply) => {
    try {
      const userId = (request as any).user.id as string;
      const { groupId } = request.params as { groupId: string };
      const { password } = request.body as any;
      const numericGroupId = Number(groupId);
      const joined = await joinGroup(numericGroupId, userId, password);
      emitGroupMembersUpdated(numericGroupId, "join", userId);
      return joined;
    } catch (e: any) {
      return sendCaughtError(reply, e, "Failed to join group");
    }
  });

  app.post("/groups/:groupId/leave", async (request, reply) => {
    try {
      const userId = (request as any).user.id as string;
      const { groupId } = request.params as { groupId: string };
      const numericGroupId = Number(groupId);
      await leaveGroup(numericGroupId, userId);
      emitGroupMembersUpdated(numericGroupId, "leave", userId);
      return { ok: true };
    } catch (e: any) {
      return sendCaughtError(reply, e, "Failed to leave group");
    }
  });

  app.get("/groups/:groupId/messages", async (request, reply) => {
    try {
      const userId = (request as any).user.id as string;
      const { groupId } = request.params as { groupId: string };
      const limit = Number((request.query as any)?.limit ?? 50);
      return await getGroupMessages(Number(groupId), userId, limit);
    } catch (e: any) {
      return sendCaughtError(reply, e, "Failed to fetch group messages");
    }
  });

  app.get("/groups/:groupId/role", async (request, reply) => {
    try {
      const userId = (request as any).user.id as string;
      const { groupId } = request.params as { groupId: string };
      return { role: await getGroupRole(Number(groupId), userId) };
    } catch (e: any) {
      return sendCaughtError(reply, e, "Failed to fetch role");
    }
  });

  app.get("/groups/:groupId/members", async (request, reply) => {
    try {
      const userId = (request as any).user.id as string;
      const { groupId } = request.params as { groupId: string };
      return await getGroupMembers(Number(groupId), userId);
    } catch (e: any) {
      return sendCaughtError(reply, e, "Failed to fetch members");
    }
  });

  app.post("/groups/:groupId/invite", async (request, reply) => {
    try {
      const userId = (request as any).user.id as string;
      const { groupId } = request.params as { groupId: string };
      const { targetId, username, target } = request.body as any;
      const targetValue = String(target ?? username ?? targetId ?? "").trim();
      if (!targetValue) return sendError(reply, "Target username is required", 400);
      const numericGroupId = Number(groupId);
      const invited = await inviteMember(numericGroupId, userId, targetValue);
      emitGroupMembersUpdated(numericGroupId, "invite", userId);
      return invited;
    } catch (e: any) {
      return sendCaughtError(reply, e, "Failed to invite member");
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
      return sendCaughtError(reply, e, "Failed to send group message");
    }
  });

  app.post("/groups/:groupId/admins/:targetId", async (request, reply) => {
    try {
      const userId = (request as any).user.id as string;
      const { groupId, targetId } = request.params as { groupId: string; targetId: string };
      const numericGroupId = Number(groupId);
      const { enabled } = request.body as any;
      await setGroupAdmin(numericGroupId, userId, targetId, !!enabled);
      emitGroupMembersUpdated(numericGroupId, "set_admin", userId);
      return { ok: true };
    } catch (e: any) {
      return sendCaughtError(reply, e, "Failed to update admin role");
    }
  });

  app.post("/groups/:groupId/ban/:targetId", async (request, reply) => {
    try {
      const userId = (request as any).user.id as string;
      const { groupId, targetId } = request.params as { groupId: string; targetId: string };
      const numericGroupId = Number(groupId);
      await banMember(numericGroupId, userId, targetId);
      emitGroupMembersUpdated(numericGroupId, "ban", userId);
      emitGroupRemovedForUser(numericGroupId, targetId, "ban", userId);
      return { ok: true };
    } catch (e: any) {
      return sendCaughtError(reply, e, "Failed to ban user");
    }
  });

  app.delete("/groups/:groupId/ban/:targetId", async (request, reply) => {
    try {
      const userId = (request as any).user.id as string;
      const { groupId, targetId } = request.params as { groupId: string; targetId: string };
      const numericGroupId = Number(groupId);
      await unbanMember(numericGroupId, userId, targetId);
      emitGroupMembersUpdated(numericGroupId, "unban", userId);
      return { ok: true };
    } catch (e: any) {
      return sendCaughtError(reply, e, "Failed to unban user");
    }
  });

  // Compatibility route for environments where DELETE may fail due proxy/CORS restrictions.
  app.post("/groups/:groupId/unban/:targetId", async (request, reply) => {
    try {
      const userId = (request as any).user.id as string;
      const { groupId, targetId } = request.params as { groupId: string; targetId: string };
      const numericGroupId = Number(groupId);
      await unbanMember(numericGroupId, userId, targetId);
      emitGroupMembersUpdated(numericGroupId, "unban", userId);
      return { ok: true };
    } catch (e: any) {
      return sendCaughtError(reply, e, "Failed to unban user");
    }
  });

  app.post("/groups/:groupId/kick/:targetId", async (request, reply) => {
    try {
      const userId = (request as any).user.id as string;
      const { groupId, targetId } = request.params as { groupId: string; targetId: string };
      const numericGroupId = Number(groupId);
      await kickMember(numericGroupId, userId, targetId);
      emitGroupMembersUpdated(numericGroupId, "kick", userId);
      emitGroupRemovedForUser(numericGroupId, targetId, "kick", userId);
      return { ok: true };
    } catch (e: any) {
      return sendCaughtError(reply, e, "Failed to kick user");
    }
  });

  app.post("/groups/:groupId/mute/:targetId", async (request, reply) => {
    try {
      const userId = (request as any).user.id as string;
      const { groupId, targetId } = request.params as { groupId: string; targetId: string };
      const numericGroupId = Number(groupId);
      const { seconds } = request.body as any;
      await muteMember(numericGroupId, userId, targetId, Number(seconds));
      emitGroupMembersUpdated(numericGroupId, "mute", userId);
      return { ok: true };
    } catch (e: any) {
      return sendCaughtError(reply, e, "Failed to mute user");
    }
  });

  app.post("/groups/:groupId/unmute/:targetId", async (request, reply) => {
    try {
      const userId = (request as any).user.id as string;
      const { groupId, targetId } = request.params as { groupId: string; targetId: string };
      const numericGroupId = Number(groupId);
      await unmuteMember(numericGroupId, userId, targetId);
      emitGroupMembersUpdated(numericGroupId, "unmute", userId);
      return { ok: true };
    } catch (e: any) {
      return sendCaughtError(reply, e, "Failed to unmute user");
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
      return sendCaughtError(reply, e, "Failed to update channel settings");
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
      return sendCaughtError(reply, e, "Failed to update channel settings");
    }
  });

  app.get("/private", async (request, reply) => {
    try {
      const userId = (request as any).user.id as string;
      return await getPrivateChatsForUser(userId);
    } catch (e: any) {
      return sendCaughtError(reply, e, "Failed to fetch private chats");
    }
  });

  app.post("/private", async (request, reply) => {
    try {
      const userId = (request as any).user.id as string;
      const { targetId } = request.body as any;
      return await getOrCreatePrivateChat(userId, String(targetId));
    } catch (e: any) {
      return sendCaughtError(reply, e, "Failed to create private chat");
    }
  });

  app.get("/private/:chatId/messages", async (request, reply) => {
    try {
      const userId = (request as any).user.id as string;
      const { chatId } = request.params as { chatId: string };
      const limit = Number((request.query as any)?.limit ?? 50);
      return await getPrivateMessages(Number(chatId), userId, limit);
    } catch (e: any) {
      return sendCaughtError(reply, e, "Failed to fetch private messages");
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
      return sendCaughtError(reply, e, "Failed to send private message");
    }
  });

  app.get("/blocks", async (request, reply) => {
    try {
      const userId = (request as any).user.id as string;
      return await getBlockedUsers(userId);
    } catch (e: any) {
      return sendCaughtError(reply, e, "Failed to fetch block list");
    }
  });

  app.post("/blocks/:targetId", async (request, reply) => {
    try {
      const userId = (request as any).user.id as string;
      const { targetId } = request.params as { targetId: string };
      await blockUser(userId, targetId);
      return { ok: true };
    } catch (e: any) {
      return sendCaughtError(reply, e, "Failed to block user");
    }
  });

  app.delete("/blocks/:targetId", async (request, reply) => {
    try {
      const userId = (request as any).user.id as string;
      const { targetId } = request.params as { targetId: string };
      await unblockUser(userId, targetId);
      return { ok: true };
    } catch (e: any) {
      return sendCaughtError(reply, e, "Failed to unblock user");
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
      return sendCaughtError(reply, e, "Failed to unblock user");
    }
  });

  app.get("/users/:userId/profile", async (request, reply) => {
    try {
      const { userId } = request.params as { userId: string };
      return await getChatProfileByUserId(userId);
    } catch (e: any) {
      return sendCaughtError(reply, e, "Failed to fetch profile");
    }
  });

  app.get("/users", async (request, reply) => {
    try {
      const userId = (request as any).user.id as string;
      const { limit, search, offset } =
        (request.query as {
          limit?: string | number;
          search?: string;
          offset?: string | number;
        }) || {};
      return await getChatUsersList(
        userId,
        Number(limit),
        search,
        Number(offset),
      );
    } catch (e: any) {
      return sendCaughtError(reply, e, "Failed to fetch users");
    }
  });
};

export default chatRoutes;
