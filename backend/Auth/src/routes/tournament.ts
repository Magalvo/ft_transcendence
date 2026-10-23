import type { FastifyInstance } from "fastify";
import auth from "../middleware/authenticate.js";
import { sendError, sendSuccess } from "../utils/respond.js";
import {
  createTournament,
  getTournament,
  getTournamentBracketState,
  getUserTournaments,
  submitTournamentMatchResult,
} from "../services/tournamentService.js";
import { acceptTournamentInvite } from "../services/tournamentInviteService.js";
import { sendCaughtError } from "../utils/httpError.js";

export default async function tournamentRoutes(app: FastifyInstance) {
  /**
   * POST /api/tournaments
   * Create a new tournament
   */
  app.post(
    "/tournaments",
    { preHandler: auth },
    async (req, reply) => {
      try {
        const userId = (req as any).user?.id as string | undefined;
        if (!userId) {
          return sendError(reply, "Unauthorized", 401);
        }

        const { name, player_ids } = req.body as any;
        const normalizedName = String(name ?? "").trim();
        const normalizedPlayerIds = Array.isArray(player_ids)
          ? player_ids
              .map((playerId: unknown) => String(playerId ?? "").trim())
              .filter(Boolean)
          : [];
        const uniquePlayerIds = Array.from(new Set(normalizedPlayerIds));

        if (!normalizedName || uniquePlayerIds.length !== 4) {
          return sendError(
            reply,
            "Tournament requires exactly 4 unique players",
            400,
          );
        }

        if (!uniquePlayerIds.includes(userId)) {
          return sendError(
            reply,
            "Tournament creator must be included in the player list",
            400,
          );
        }

        const result = await createTournament({
          name: normalizedName,
          created_by: userId,
          player_ids: uniquePlayerIds,
        });

        reply.code(201);
        return sendSuccess(reply, result);
      } catch (error: any) {
        app.log.error(error);
        return sendCaughtError(reply, error, "Failed to create tournament");
      }
    }
  );

  /**
   * GET /api/tournaments/:tournamentId
   * Get tournament with all matches
   */
  app.get(
    "/tournaments/:tournamentId",
    { preHandler: auth },
    async (req, reply) => {
      try {
        const { tournamentId } = req.params as any;

        const tournament = await getTournament(tournamentId);
        if (!tournament) {
          return sendError(reply, "Tournament not found", 404);
        }

        return sendSuccess(reply, tournament);
      } catch (error: any) {
        app.log.error(error);
        return sendCaughtError(reply, error, "Failed to fetch tournament");
      }
    }
  );

  /**
   * GET /api/tournaments/:tournamentId/bracket
   * Get tournament bracket state (simplified for frontend)
   */
  app.get(
    "/tournaments/:tournamentId/bracket",
    { preHandler: auth },
    async (req, reply) => {
      try {
        const { tournamentId } = req.params as any;

        const bracket = await getTournamentBracketState(tournamentId);
        if (!bracket) {
          return sendError(reply, "Tournament not found", 404);
        }

        return sendSuccess(reply, bracket);
      } catch (error: any) {
        app.log.error(error);
        return sendCaughtError(reply, error, "Failed to fetch tournament bracket");
      }
    }
  );

  /**
   * POST /api/tournaments/:tournamentId/matches/:matchId/result
   * Submit match result for a tournament match
   */
  app.post(
    "/tournaments/:tournamentId/matches/:matchId/result",
    { preHandler: auth },
    async (req, reply) => {
      try {
        const userId = (req as any).user?.id as string | undefined;
        if (!userId) {
          return sendError(reply, "Unauthorized", 401);
        }

        const { tournamentId, matchId } = req.params as any;
        const {
          gameId,
          winnerId,
          player1Score,
          player2Score,
          reviewOverride,
        } = req.body as any;

        if (!gameId || !winnerId || player1Score === undefined || player2Score === undefined) {
          return sendError(
            reply,
            "Missing required fields: gameId, winnerId, player1Score, player2Score",
            400
          );
        }

        const result = await submitTournamentMatchResult({
          tournamentId: String(tournamentId ?? "").trim(),
          matchId: String(matchId ?? "").trim(),
          submittedByUserId: userId,
          gameId: String(gameId ?? "").trim(),
          winnerId: String(winnerId ?? "").trim(),
          player1Score: Number(player1Score),
          player2Score: Number(player2Score),
          reviewOverride: Boolean(reviewOverride),
        });

        return sendSuccess(reply, {
          message: "Tournament match result processed",
          ...result,
        });
      } catch (error: any) {
        app.log.error(error);
        return sendCaughtError(reply, error, "Failed to record match result");
      }
    }
  );

  /**
   * POST /api/tournaments/invites/accept
   * Accept a tournament invite token and resolve match context
   */
  app.post(
    "/tournaments/invites/accept",
    { preHandler: auth },
    async (req, reply) => {
      try {
        const userId = (req as any).user?.id as string | undefined;
        if (!userId) {
          return sendError(reply, "Unauthorized", 401);
        }

        const { token } = req.body as any;
        if (!token) {
          return sendError(reply, "Missing required field: token", 400);
        }

        const result = await acceptTournamentInvite(String(token), userId);
        return sendSuccess(reply, result);
      } catch (error: any) {
        app.log.error(error);
        return sendCaughtError(reply, error, "Failed to accept invite");
      }
    }
  );

  /**
   * GET /api/tournaments/user/me
   * Get all tournaments created by the current user
   */
  app.get(
    "/tournaments/user/me",
    { preHandler: auth },
    async (req, reply) => {
      try {
        const userId = (req as any).user?.id as string | undefined;
        if (!userId) {
          return sendError(reply, "Unauthorized", 401);
        }

        const tournaments = await getUserTournaments(userId);
        return sendSuccess(reply, tournaments);
      } catch (error: any) {
        app.log.error(error);
        return sendCaughtError(reply, error, "Failed to fetch tournaments");
      }
    }
  );
}
