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

        if (!name || !Array.isArray(player_ids) || player_ids.length < 4) {
          return sendError(reply, "Tournament requires a name and at least 4 players", 400);
        }

        const result = await createTournament({
          name,
          created_by: userId,
          player_ids,
        });

        reply.code(201);
        return sendSuccess(reply, result);
      } catch (error: any) {
        app.log.error(error);
        return sendError(reply, error.message || "Failed to create tournament", 500);
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
        return sendError(reply, error.message || "Failed to fetch tournament", 500);
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
        return sendError(reply, error.message || "Failed to fetch tournament bracket", 500);
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
        const { tournamentId, matchId } = req.params as any;
        const { gameId, winnerId, player1Score, player2Score } = req.body as any;

        if (!gameId || !winnerId || player1Score === undefined || player2Score === undefined) {
          return sendError(
            reply,
            "Missing required fields: gameId, winnerId, player1Score, player2Score",
            400
          );
        }

        const result = await submitTournamentMatchResult(
          matchId,
          gameId,
          winnerId,
          player1Score,
          player2Score
        );

        return sendSuccess(reply, {
          message: "Match result recorded",
          match: result,
        });
      } catch (error: any) {
        app.log.error(error);
        return sendError(reply, error.message || "Failed to record match result", 500);
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
        return sendError(reply, error.message || "Failed to fetch tournaments", 500);
      }
    }
  );
}
