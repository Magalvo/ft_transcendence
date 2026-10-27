import type { FastifyInstance } from "fastify";
import db from "../db.js";
import { sendError } from "../utils/respond.js";
import { getAuthUserId } from "../utils/requestAuth.js";

export default async function friendRoutes(app: FastifyInstance) {
  const isOnlineByLastRequest = (
    lastRequest?: string | number | null,
  ): boolean => {
    if (!lastRequest) return false;
    const ts =
      typeof lastRequest === "number"
        ? lastRequest
        : new Date(String(lastRequest)).getTime();
    if (!Number.isFinite(ts)) return false;
    return Date.now() - ts <= 60_000;
  };

  // --- SEND FRIEND REQUEST ---
  const sendFriendRequestHandler = async (req: any, reply: any) => {
    try {
      const requesterId = getAuthUserId(req);
      const body = (req.body ?? {}) as { username?: string; userId?: string };
      const targetValue = String(body.username ?? body.userId ?? "").trim();
      if (!targetValue) {
        return sendError(reply, "Target username is required", 400);
      }

      const targetUser = await db("users")
        .select("id", "username")
        .whereRaw("LOWER(username) = LOWER(?)", [targetValue])
        .orWhere("id", targetValue)
        .first();

      if (!targetUser) {
        return sendError(reply, "User not found", 404);
      }
      if (targetUser.id === requesterId) {
        return sendError(reply, "You cannot add yourself", 400);
      }

      const [userA, userB] = [requesterId, targetUser.id].sort();
      const alreadyFriends = await db("friendships")
        .where({ user_a: userA, user_b: userB })
        .first();
      if (alreadyFriends) {
        return sendError(reply, "Already friends", 409);
      }

      const existing = await db("friend_requests")
        .where(function () {
          this.where({
            requester_id: requesterId,
            target_id: targetUser.id,
          }).orWhere({ requester_id: targetUser.id, target_id: requesterId });
        })
        .first();

      if (existing) {
        if (
          String(existing.requester_id) === String(targetUser.id) &&
          String(existing.target_id) === String(requesterId)
        ) {
          await db("friendships")
            .insert({
              user_a: userA,
              user_b: userB,
              created_at: Date.now(),
            })
            .onConflict(["user_a", "user_b"])
            .ignore();

          await db("friend_requests")
            .where({ id: existing.id })
            .delete();

          return {
            success: true,
            autoAccepted: true,
            friend: {
              id: targetUser.id,
              username: targetUser.username,
            },
          };
        }

        return sendError(reply, "Friend request already exists", 409);
      }

      const [id] = await db("friend_requests").insert({
        requester_id: requesterId,
        target_id: targetUser.id,
        created_at: Date.now(),
      });

      return {
        success: true,
        request: {
          id,
          requester_id: requesterId,
          target_id: targetUser.id,
          username: targetUser.username,
        },
      };
    } catch (err: any) {
      app.log.error(err);
      if (err.message === "Missing or invalid Authorization header") {
        return sendError(reply, err.message, 401);
      }
      return sendError(
        reply,
        "Failed to send friend request",
        500,
      );
    }
  };

  app.post("/friends/requests", sendFriendRequestHandler);
  // Backward compatibility (old frontend path)
  app.post("/friends", sendFriendRequestHandler);

  // --- LIST INCOMING FRIEND REQUESTS ---
  app.get("/friends/requests/incoming", async (req, reply) => {
    try {
      const myUserId = getAuthUserId(req);
      const requests = await db("friend_requests as fr")
        .join("users as u", "u.id", "fr.requester_id")
        .select("fr.id", "fr.requester_id", "u.username", "fr.created_at")
        .where("fr.target_id", myUserId)
        .orderBy("fr.created_at", "desc");

      return requests.map((r: any) => ({
        id: r.id,
        requesterId: r.requester_id,
        username: r.username,
        createdAt: r.created_at,
      }));
    } catch (err: any) {
      app.log.error(err);
      if (err.message === "Missing or invalid Authorization header") {
        return sendError(reply, err.message, 401);
      }
      return sendError(
        reply,
        "Failed to fetch incoming requests",
        500,
      );
    }
  });

  // --- ACCEPT FRIEND REQUEST ---
  app.post("/friends/requests/:requestId/accept", async (req, reply) => {
    try {
      const myUserId = getAuthUserId(req);
      const { requestId } = req.params as { requestId: string };
      const request = await db("friend_requests")
        .where({ id: Number(requestId), target_id: myUserId })
        .first();

      if (!request) {
        return sendError(reply, "Friend request not found", 404);
      }

      const [userA, userB] = [request.requester_id, request.target_id].sort();
      await db("friendships")
        .insert({
          user_a: userA,
          user_b: userB,
          created_at: Date.now(),
        })
        .onConflict(["user_a", "user_b"])
        .ignore();

      await db("friend_requests")
        .where({ id: Number(requestId) })
        .delete();

      return { success: true };
    } catch (err: any) {
      app.log.error(err);
      if (err.message === "Missing or invalid Authorization header") {
        return sendError(reply, err.message, 401);
      }
      return sendError(reply, "Failed to accept request", 500);
    }
  });

  // --- DECLINE FRIEND REQUEST ---
  app.post("/friends/requests/:requestId/decline", async (req, reply) => {
    try {
      const myUserId = getAuthUserId(req);
      const { requestId } = req.params as { requestId: string };
      const deleted = await db("friend_requests")
        .where({ id: Number(requestId), target_id: myUserId })
        .delete();

      if (!deleted) {
        return sendError(reply, "Friend request not found", 404);
      }

      return { success: true };
    } catch (err: any) {
      app.log.error(err);
      if (err.message === "Missing or invalid Authorization header") {
        return sendError(reply, err.message, 401);
      }
      return sendError(reply, "Failed to decline request", 500);
    }
  });

  // --- GET USER FRIENDS ---
  app.get("/users/:userId/friends", async (req, reply) => {
    try {
      const { userId } = req.params as { userId: string };
      if (!userId) {
        return sendError(reply, "User ID is required", 400);
      }

      const friends = await db("friendships as f")
        .join("users as u", function () {
          this.on(function () {
            this.on("f.user_a", "=", db.raw("?", [userId])).andOn(
              "u.id",
              "=",
              "f.user_b",
            );
          }).orOn(function () {
            this.on("f.user_b", "=", db.raw("?", [userId])).andOn(
              "u.id",
              "=",
              "f.user_a",
            );
          });
        })
        .select("u.id", "u.username", "u.last_request", "u.online")
        .orderBy("u.username", "asc");

      return friends.map((f: any) => ({
        id: f.id,
        username: f.username,
        status:
          Boolean(f.online) || isOnlineByLastRequest(f.last_request)
            ? "online"
            : "offline",
      }));
    } catch (err: any) {
      app.log.error(err);
      return sendError(reply, "Failed to fetch friends", 500);
    }
  });

  // --- REMOVE FRIEND ---
  app.post("/friends/remove", async (req, reply) => {
    try {
      const myUserId = getAuthUserId(req);
      const body = (req.body ?? {}) as { friendId?: string };
      const friendId = String(body.friendId ?? "").trim();

      if (!friendId) {
        return sendError(reply, "Friend ID is required", 400);
      }
      if (friendId === myUserId) {
        return sendError(reply, "Invalid friend ID", 400);
      }

      const [userA, userB] = [myUserId, friendId].sort();
      await db("friendships").where({ user_a: userA, user_b: userB }).delete();

      return { success: true };
    } catch (err: any) {
      app.log.error(err);
      if (err.message === "Missing or invalid Authorization header") {
        return sendError(reply, err.message, 401);
      }
      return sendError(reply, "Failed to remove friend", 500);
    }
  });

  // Match results are recorded server-side by the game engine (Game.ts);
  // there is intentionally no client-facing endpoint to submit them.
}
