import bcrypt from "bcrypt";
import db from "../db.js";
import { HttpError } from "../utils/httpError.js";

export type GroupVisibility = "public" | "private" | "protected";
export type GroupRole = "owner" | "admin" | "member";

const MAX_MESSAGE_LENGTH = 2000;
const ONLINE_WINDOW_MS = 60_000;

function isUserOnlineByLastRequest(lastRequest?: string | number | null): boolean {
  if (!lastRequest) return false;
  const ts =
    typeof lastRequest === "number"
      ? lastRequest
      : new Date(String(lastRequest)).getTime();
  if (!Number.isFinite(ts)) return false;
  return Date.now() - ts <= ONLINE_WINDOW_MS;
}

// Messages are stored as plain text; the frontend renders them with
// textContent, so escaping here would only corrupt what users typed.
function normalizeMessage(input: string): string {
  return String(input ?? "").trim().slice(0, MAX_MESSAGE_LENGTH);
}

function normalizePair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export async function isGroupMember(groupId: number, userId: string): Promise<boolean> {
  const row = await db("chat_group_members").where({ id_group: groupId, user_id: userId }).first();
  return !!row;
}

async function getGroup(groupId: number) {
  return db("chat_groups").where({ id_group: groupId }).first();
}

async function ensureGroupRole(groupId: number, userId: string): Promise<GroupRole> {
  const group = await getGroup(groupId);
  if (!group) throw new HttpError("Group not found");

  if (group.owner_id === userId) return "owner";
  const admin = await db("chat_group_admins").where({ id_group: groupId, user_id: userId }).first();
  return admin ? "admin" : "member";
}

export async function getGroupRole(groupId: number, userId: string): Promise<GroupRole> {
  if (!(await isGroupMember(groupId, userId))) throw new HttpError("Not a group member");
  return ensureGroupRole(groupId, userId);
}

async function assertNotBanned(groupId: number, userId: string): Promise<void> {
  const ban = await db("chat_group_bans").where({ id_group: groupId, user_id: userId }).first();
  if (ban) throw new HttpError("User is banned from this channel");
}

async function assertNotMuted(groupId: number, userId: string): Promise<void> {
  const mute = await db("chat_group_mutes").where({ id_group: groupId, user_id: userId }).first();
  if (!mute) return;
  if (mute.expires_at > Date.now()) throw new HttpError("User is muted in this channel");
  await db("chat_group_mutes").where({ id_group: groupId, user_id: userId }).del();
}

export async function isBlocked(viewerId: string, senderId: string): Promise<boolean> {
  const row = await db("blocked_users").where({ blocker_id: viewerId, blocked_id: senderId }).first();
  return !!row;
}

export async function getGroupsForUser(userId: string) {
  return db("chat_groups as g")
    .leftJoin("chat_group_members as m", function () {
      this.on("m.id_group", "=", "g.id_group").andOnVal("m.user_id", "=", userId);
    })
    .leftJoin("chat_group_bans as b", function () {
      this.on("b.id_group", "=", "g.id_group").andOnVal("b.user_id", "=", userId);
    })
    .select(
      "g.id_group",
      "g.name",
      "g.visibility",
      "g.owner_id",
      db.raw("CASE WHEN m.user_id IS NOT NULL THEN 1 ELSE 0 END as is_member")
    )
    .whereNull("b.user_id")
    .where((qb) =>
      qb
        .whereIn("g.visibility", ["public", "protected"])
        .orWhereNotNull("m.user_id")
    )
    .orderBy("g.id_group", "asc");
}

export async function createGroup(
  ownerId: string,
  name: string,
  visibility: GroupVisibility,
  password?: string
) {
  const now = Date.now();
  const channelName = (name || "").trim().slice(0, 120);
  if (!channelName) throw new HttpError("Channel name is required");

  const existing = await db("chat_groups")
    .select("id_group")
    .whereRaw("LOWER(name) = LOWER(?)", [channelName])
    .first();
  if (existing) throw new HttpError("Channel with this name already exists");

  const passHash =
    visibility === "protected" && password ? await bcrypt.hash(password, 10) : null;

  const inserted = await db("chat_groups").insert({
    admin_id: ownerId,
    owner_id: ownerId,
    name: channelName,
    visibility,
    password_hash: passHash,
    created_at: now,
  });

  const id_group = Array.isArray(inserted) ? Number(inserted[0]) : Number(inserted);
  await db("chat_group_members").insert({ id_group, user_id: ownerId });
  await db("chat_group_admins").insert({ id_group, user_id: ownerId, created_at: now });

  return (await getGroup(id_group))!;
}

export async function joinGroup(groupId: number, userId: string, password?: string) {
  const group = await getGroup(groupId);
  if (!group) throw new HttpError("Group not found");
  await assertNotBanned(groupId, userId);

  const exists = await isGroupMember(groupId, userId);
  if (exists) return { id_group: groupId, user_id: userId };

  if (group.visibility === "private") {
    throw new HttpError("Private channel requires an invitation");
  }
  if (group.visibility === "protected") {
    const ok = !!password && !!group.password_hash && (await bcrypt.compare(password, group.password_hash));
    if (!ok) throw new HttpError("Invalid channel password");
  }

  await db("chat_group_members").insert({ id_group: groupId, user_id: userId });
  return { id_group: groupId, user_id: userId };
}

export async function leaveGroup(groupId: number, userId: string) {
  const group = await getGroup(groupId);
  if (!group) throw new HttpError("Group not found");
  if (group.owner_id === userId) throw new HttpError("Owner cannot leave channel. Transfer ownership first.");
  await db("chat_group_members").where({ id_group: groupId, user_id: userId }).del();
  await db("chat_group_admins").where({ id_group: groupId, user_id: userId }).del();
}

export async function getGroupMembers(groupId: number, requesterId: string) {
  if (!(await isGroupMember(groupId, requesterId))) throw new HttpError("Not a group member");

  const activeMembers = await db("chat_group_members as m")
    .join("users as u", "u.id", "m.user_id")
    .leftJoin("chat_group_admins as a", function () {
      this.on("a.id_group", "=", "m.id_group").andOn("a.user_id", "=", "m.user_id");
    })
    .leftJoin("chat_group_mutes as mu", function () {
      this.on("mu.id_group", "=", "m.id_group").andOn("mu.user_id", "=", "m.user_id");
    })
    .join("chat_groups as g", "g.id_group", "m.id_group")
    .select(
      "u.id",
      "u.username",
      "u.online",
      "u.last_request",
      "g.owner_id",
      db.raw("CASE WHEN a.user_id IS NOT NULL THEN 1 ELSE 0 END as is_admin"),
      db.raw("0 as is_banned"),
      "mu.expires_at as muted_until"
    )
    .where("m.id_group", groupId)
    .orderBy("u.username", "asc");

  const bannedMembers = await db("chat_group_bans as b")
    .join("users as u", "u.id", "b.user_id")
    .join("chat_groups as g", "g.id_group", "b.id_group")
    .select(
      "u.id",
      "u.username",
      "u.online",
      "u.last_request",
      "g.owner_id",
      db.raw("0 as is_admin"),
      db.raw("1 as is_banned"),
      db.raw("NULL as muted_until")
    )
    .where("b.id_group", groupId)
    .orderBy("u.username", "asc");

  const merged = new Map<string, any>();
  [...activeMembers, ...bannedMembers].forEach((row) => {
    const existing = merged.get(row.id);
    if (!existing || Number(row.is_banned) === 1) merged.set(row.id, row);
  });

  return Array.from(merged.values()).map((row) => ({
    id: row.id,
    username: row.username,
    role: row.owner_id === row.id ? "owner" : row.is_admin ? "admin" : "member",
    is_banned: Number(row.is_banned) === 1,
    online: Boolean(row.online) || isUserOnlineByLastRequest(row.last_request),
    muted_until: row.muted_until || null,
  })).sort((a, b) => a.username.localeCompare(b.username));
}

export async function inviteMember(groupId: number, actorId: string, targetId: string) {
  const role = await ensureGroupRole(groupId, actorId);
  if (role === "member") throw new HttpError("Only owner/admin can invite");
  const group = await getGroup(groupId);
  if (!group) throw new HttpError("Group not found");
  if (group.visibility !== "private") throw new HttpError("Invites are available only for private channels");
  const byId = await db("users").select("id").where({ id: targetId }).first();
  const byUsername = byId
    ? null
    : await db("users")
        .select("id")
        .whereRaw("LOWER(username) = LOWER(?)", [targetId])
        .first();
  const resolvedUserId = String(byId?.id || byUsername?.id || "");
  if (!resolvedUserId) throw new HttpError("Target user not found");

  await assertNotBanned(groupId, resolvedUserId);

  const exists = await isGroupMember(groupId, resolvedUserId);
  if (!exists) await db("chat_group_members").insert({ id_group: groupId, user_id: resolvedUserId });
  return { id_group: groupId, user_id: resolvedUserId };
}

export async function getGroupMessages(groupId: number, viewerId: string, limit = 50) {
  if (!(await isGroupMember(groupId, viewerId))) throw new HttpError("Not a group member");

  const query = db("chat_group_messages as m")
    .join("users as u", "u.id", "m.id_usersender")
    .select(
      "m.id_message",
      "m.id_usersender",
      db.raw("u.username as sender_name"),
      "m.messagem",
      "m.timestamp"
    )
    .where("m.id_group", groupId)
    .whereNotExists(
      db("blocked_users as b")
        .select(db.raw("1"))
        .whereRaw("b.blocker_id = ?", [viewerId])
        .andWhereRaw("b.blocked_id = m.id_usersender")
    )
    .orderBy("m.timestamp", "asc")
    .limit(Math.max(1, Math.min(limit, 200)));
  return query;
}

export async function createGroupMessage(groupId: number, userId: string, content: string) {
  if (!(await isGroupMember(groupId, userId))) throw new HttpError("Not a group member");
  await assertNotBanned(groupId, userId);
  await assertNotMuted(groupId, userId);

  const msg = normalizeMessage(content);
  if (!msg) throw new HttpError("Message is empty");
  const timestamp = Date.now();

  const inserted = await db("chat_group_messages").insert({
    id_group: groupId,
    id_usersender: userId,
    messagem: msg,
    timestamp,
  });
  const id_message = Array.isArray(inserted) ? inserted[0] : inserted;

  const sender = await db("users").select("username").where({ id: userId }).first();
  return {
    id_message,
    id_group: groupId,
    id_usersender: userId,
    sender_name: sender?.username || "User",
    messagem: msg,
    timestamp,
  };
}

export async function setGroupAdmin(groupId: number, ownerId: string, targetId: string, enabled: boolean) {
  const group = await getGroup(groupId);
  if (!group) throw new HttpError("Group not found");
  if (group.owner_id !== ownerId) throw new HttpError("Only owner can assign admins");
  if (!(await isGroupMember(groupId, targetId))) throw new HttpError("Target user is not in channel");

  if (enabled) {
    await db("chat_group_admins")
      .insert({ id_group: groupId, user_id: targetId, created_at: Date.now() })
      .onConflict(["id_group", "user_id"])
      .ignore();
  } else {
    if (targetId === ownerId) throw new HttpError("Owner admin role cannot be removed");
    await db("chat_group_admins").where({ id_group: groupId, user_id: targetId }).del();
  }
}

export async function banMember(groupId: number, actorId: string, targetId: string) {
  const role = await ensureGroupRole(groupId, actorId);
  if (role === "member") throw new HttpError("Only owner/admin can ban");
  if (actorId === targetId) throw new HttpError("Cannot ban yourself");

  await db("chat_group_bans")
    .insert({ id_group: groupId, user_id: targetId, banned_by: actorId, created_at: Date.now() })
    .onConflict(["id_group", "user_id"])
    .ignore();

  await db("chat_group_members").where({ id_group: groupId, user_id: targetId }).del();
  await db("chat_group_admins").where({ id_group: groupId, user_id: targetId }).del();
}

export async function unbanMember(groupId: number, actorId: string, targetId: string) {
  const role = await ensureGroupRole(groupId, actorId);
  if (role === "member") throw new HttpError("Only owner/admin can unban");
  await db("chat_group_bans").where({ id_group: groupId, user_id: targetId }).del();
}

export async function kickMember(groupId: number, actorId: string, targetId: string) {
  const role = await ensureGroupRole(groupId, actorId);
  if (role === "member") throw new HttpError("Only owner/admin can kick");
  if (actorId === targetId) throw new HttpError("Cannot kick yourself");

  const group = await getGroup(groupId);
  if (group?.owner_id === targetId) throw new HttpError("Cannot kick channel owner");
  await db("chat_group_members").where({ id_group: groupId, user_id: targetId }).del();
  await db("chat_group_admins").where({ id_group: groupId, user_id: targetId }).del();
}

export async function muteMember(groupId: number, actorId: string, targetId: string, seconds: number) {
  const role = await ensureGroupRole(groupId, actorId);
  if (role === "member") throw new HttpError("Only owner/admin can mute");
  if (seconds <= 0) throw new HttpError("Mute duration must be positive");
  if (!(await isGroupMember(groupId, targetId))) throw new HttpError("Target user is not in channel");

  const now = Date.now();
  await db("chat_group_mutes")
    .insert({
      id_group: groupId,
      user_id: targetId,
      muted_by: actorId,
      expires_at: now + seconds * 1000,
      created_at: now,
    })
    .onConflict(["id_group", "user_id"])
    .merge({
      muted_by: actorId,
      expires_at: now + seconds * 1000,
      created_at: now,
    });
}

export async function unmuteMember(groupId: number, actorId: string, targetId: string) {
  const role = await ensureGroupRole(groupId, actorId);
  if (role === "member") throw new HttpError("Only owner/admin can unmute");
  await db("chat_group_mutes").where({ id_group: groupId, user_id: targetId }).del();
}

export async function setGroupPassword(
  groupId: number,
  ownerId: string,
  visibility: GroupVisibility,
  password?: string
) {
  const group = await getGroup(groupId);
  if (!group) throw new HttpError("Group not found");
  if (group.owner_id !== ownerId) throw new HttpError("Only owner can change channel password");

  const passHash =
    visibility === "protected" && password ? await bcrypt.hash(password, 10) : null;

  await db("chat_groups").where({ id_group: groupId }).update({
    visibility,
    password_hash: passHash,
  });
}

export async function getOrCreatePrivateChat(userA: string, userB: string) {
  if (userA === userB) throw new HttpError("Cannot create chat with yourself");
  const [id_user1, id_user2] = normalizePair(userA, userB);

  let row = await db("private_chats").where({ id_user1, id_user2 }).first();
  if (!row) {
    const inserted = await db("private_chats").insert({ id_user1, id_user2 });
    const id_privatechat = Array.isArray(inserted) ? Number(inserted[0]) : Number(inserted);
    row = await db("private_chats").where({ id_privatechat }).first();
  }
  return row;
}

export async function getPrivateChatsForUser(userId: string) {
  return db("private_chats")
    .where("id_user1", userId)
    .orWhere("id_user2", userId)
    .orderBy("id_privatechat", "desc");
}

async function assertPrivateChatAccess(chatId: number, userId: string) {
  const chat = await db("private_chats").where({ id_privatechat: chatId }).first();
  if (!chat) throw new HttpError("Private chat not found");
  if (chat.id_user1 !== userId && chat.id_user2 !== userId) throw new HttpError("No access to private chat");
  return chat;
}

export async function getPrivateMessages(chatId: number, viewerId: string, limit = 50) {
  await assertPrivateChatAccess(chatId, viewerId);

  const query = db("private_messages as m")
    .join("users as u", "u.id", "m.id_usersender")
    .select(
      "m.id_message",
      "m.id_usersender",
      db.raw("u.username as sender_name"),
      "m.messagem",
      "m.timestamp"
    )
    .where("m.id_privatechat", chatId)
    .whereNotExists(
      db("blocked_users as b")
        .select(db.raw("1"))
        .whereRaw("b.blocker_id = ?", [viewerId])
        .andWhereRaw("b.blocked_id = m.id_usersender")
    )
    .orderBy("m.timestamp", "asc")
    .limit(Math.max(1, Math.min(limit, 200)));
  return query;
}

export async function createPrivateMessage(chatId: number, userId: string, content: string) {
  await assertPrivateChatAccess(chatId, userId);

  const msg = normalizeMessage(content);
  if (!msg) throw new HttpError("Message is empty");
  const timestamp = Date.now();
  const inserted = await db("private_messages").insert({
    id_privatechat: chatId,
    id_usersender: userId,
    messagem: msg,
    timestamp,
  });
  const id_message = Array.isArray(inserted) ? inserted[0] : inserted;
  const sender = await db("users").select("username").where({ id: userId }).first();
  return {
    id_message,
    id_privatechat: chatId,
    id_usersender: userId,
    sender_name: sender?.username || "User",
    messagem: msg,
    timestamp,
  };
}

export async function blockUser(blockerId: string, blockedId: string) {
  if (blockerId === blockedId) throw new HttpError("Cannot block yourself");
  await db("blocked_users")
    .insert({ blocker_id: blockerId, blocked_id: blockedId, created_at: Date.now() })
    .onConflict(["blocker_id", "blocked_id"])
    .ignore();
}

export async function unblockUser(blockerId: string, blockedId: string) {
  await db("blocked_users").where({ blocker_id: blockerId, blocked_id: blockedId }).del();
}

export async function getBlockedUsers(blockerId: string) {
  return db("blocked_users as b")
    .join("users as u", "u.id", "b.blocked_id")
    .select("u.id", "u.username")
    .where("b.blocker_id", blockerId);
}

export async function getChatProfileByUserId(userId: string) {
  const user = await db("users")
    .select("id", "username", "email", "avatarUrl", "online", "last_request")
    .where({ id: userId })
    .first();
  if (!user) throw new HttpError("User not found");
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    avatarUrl:
      user.avatarUrl ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username)}&background=0D8ABC&color=fff`,
    online: Boolean(user.online) || isUserOnlineByLastRequest(user.last_request),
  };
}

export async function getChatUsersList(
  currentUserId: string,
  limit: number = 100,
  search?: string,
  offset: number = 0,
) {
  const normalizedLimit = Number.isFinite(limit)
    ? Math.max(1, Math.min(Math.floor(limit), 200))
    : 100;
  const normalizedOffset = Number.isFinite(offset)
    ? Math.max(0, Math.floor(offset))
    : 0;
  const onlineThreshold = new Date(Date.now() - ONLINE_WINDOW_MS).toISOString();
  const normalizedSearch = String(search || "").trim();

  const usersQuery = db("users")
    .select("id", "username", "avatarUrl", "online", "last_request")
    .whereNot({ id: currentUserId });

  if (normalizedSearch) {
    usersQuery.andWhere("username", "like", `%${normalizedSearch}%`);
  }

  const users = await usersQuery
    .orderByRaw(
      "CASE WHEN last_request IS NOT NULL AND last_request >= ? THEN 0 ELSE 1 END ASC",
      [onlineThreshold],
    )
    .orderBy("username", "asc")
    .offset(normalizedOffset)
    .limit(normalizedLimit);

  const countQuery = db("users")
    .countDistinct({ total: "id" })
    .whereNot({ id: currentUserId });

  if (normalizedSearch) {
    countQuery.andWhere("username", "like", `%${normalizedSearch}%`);
  }

  const countResult = await countQuery.first();
  const total = Number((countResult as any)?.total || 0);
  const mappedUsers = users.map((row) => ({
    id: row.id,
    username: row.username,
    avatarUrl:
      row.avatarUrl ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(row.username)}&background=0D8ABC&color=fff`,
    online: Boolean(row.online) || isUserOnlineByLastRequest(row.last_request),
  }));

  return {
    users: mappedUsers,
    total,
    hasMore: normalizedOffset + mappedUsers.length < total,
    offset: normalizedOffset,
    limit: normalizedLimit,
  };
}
