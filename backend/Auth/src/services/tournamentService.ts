import db from "../db.js";
import crypto from "crypto";
import { HttpError } from "../utils/httpError.js";

const RESULT_CONFIRMATION_TIMEOUT_MINUTES = Number(
  process.env.TOURNAMENT_RESULT_CONFIRM_TIMEOUT_MINUTES || "15",
);

class TournamentResultError extends HttpError {
  constructor(message: string, statusCode = 400) {
    super(message, statusCode);
    this.name = "TournamentResultError";
  }
}

type SubmitTournamentMatchResultInput = {
  tournamentId: string;
  matchId: string;
  submittedByUserId: string;
  gameId: string;
  winnerId: string;
  player1Score: number;
  player2Score: number;
  reviewOverride?: boolean;
};

type RecordedMatchValidationContext = {
  player1Id: string;
  player2Id: string;
  winnerId: string;
  player1Score: number;
  player2Score: number;
  gameId: string;
};

interface CreateTournamentInput {
  name: string;
  created_by: string;
  player_ids: string[];
}

export function validateTournamentCreateInput(input: CreateTournamentInput): {
  normalizedName: string;
  uniquePlayerIds: string[];
} {
  const normalizedName = String(input.name ?? "").trim();
  const normalizedPlayerIds = input.player_ids
    .map((playerId) => String(playerId ?? "").trim())
    .filter(Boolean);
  const uniquePlayerIds = Array.from(new Set(normalizedPlayerIds));

  if (!normalizedName) {
    throw new HttpError("Tournament name is required");
  }
  if (uniquePlayerIds.length !== 4) {
    throw new HttpError("Tournament requires exactly 4 unique players");
  }
  if (!uniquePlayerIds.includes(input.created_by)) {
    throw new HttpError("Tournament creator must be included in the player list");
  }

  return {
    normalizedName,
    uniquePlayerIds,
  };
}

/**
 * Create a new tournament with initial bracket
 */
export async function createTournament(input: CreateTournamentInput) {
  const tournamentId = crypto.randomUUID();
  const now = new Date();
  const { normalizedName, uniquePlayerIds } =
    validateTournamentCreateInput(input);

  const registered = await db("users").whereIn("id", uniquePlayerIds).count({ count: "*" }).first();
  if (Number(registered?.count ?? 0) !== uniquePlayerIds.length) {
    throw new HttpError("All tournament players must be registered users");
  }

  try {
    // One transaction, so a failure never leaves a half-created tournament.
    const matches = await db.transaction(async (trx) => {
      // 1. Create tournament
      await trx("tournaments").insert({
        id: tournamentId,
        name: normalizedName,
        created_by: input.created_by,
        status: "active",
        player_count: uniquePlayerIds.length,
        created_at: now,
      });

      // 2. Add participants
      for (const userId of uniquePlayerIds) {
        await trx("tournament_participants").insert({
          tournament_id: tournamentId,
          user_id: userId,
          is_eliminated: false,
          created_at: now,
        });
      }

      // 3. Generate initial bracket (simple single elimination)
      const bracket = generateBracket(tournamentId, uniquePlayerIds, now);
      for (const match of bracket) {
        await trx("tournament_matches").insert(match);
      }
      return bracket;
    });

    return { tournamentId, matches };
  } catch (error) {
    console.error("Error creating tournament:", error);
    throw error;
  }
}

/**
 * Generate bracket for tournament (single elimination)
 */
function generateBracket(tournamentId: string, playerIds: string[], now: Date) {
  const matches: any[] = [];
  
  // For 4 players: 2 semi-final matches in round 1, 1 final match in round 2
  let matchNumber = 1;
  const round = 1;

  // Semi-finals (Round 1)
  for (let i = 0; i < playerIds.length; i += 2) {
    if (i + 1 < playerIds.length) {
      matches.push({
        id: crypto.randomUUID(),
        tournament_id: tournamentId,
        round,
        match_number: matchNumber++,
        player1_id: playerIds[i],
        player2_id: playerIds[i + 1],
        winner_id: null,
        player1_score: 0,
        player2_score: 0,
        status: "pending",
        created_at: now,
        completed_at: null,
      });
    }
  }

  // Finals (Round 2): players are filled in as the semi-finals finish
  matches.push({
    id: crypto.randomUUID(),
    tournament_id: tournamentId,
    round: 2,
    match_number: 1,
    player1_id: null,
    player2_id: null,
    winner_id: null,
    player1_score: 0,
    player2_score: 0,
    status: "pending",
    created_at: now,
    completed_at: null,
  });

  return matches;
}

function validateSubmittedTournamentScores(
  player1Score: number,
  player2Score: number,
  winnerId: string,
  player1Id: string,
  player2Id: string,
) {
  if (!Number.isInteger(player1Score) || !Number.isInteger(player2Score)) {
    throw new TournamentResultError("Scores must be whole numbers", 400);
  }

  if (player1Score < 0 || player2Score < 0) {
    throw new TournamentResultError("Scores cannot be negative", 400);
  }

  if (player1Score === player2Score) {
    throw new TournamentResultError("Tournament matches cannot end in a draw", 400);
  }

  const expectedWinnerId =
    player1Score > player2Score ? player1Id : player2Id;

  if (winnerId !== expectedWinnerId) {
    throw new TournamentResultError(
      "winnerId must match the player with the higher score",
      400,
    );
  }
}

async function validateRecordedMatchResult(
  trx: any,
  context: RecordedMatchValidationContext,
) {
  const recordedMatch = await trx("matches")
    .where({ id: context.gameId })
    .first();

  if (!recordedMatch) {
    throw new TournamentResultError("Recorded match not found", 404);
  }

  const recordedGame = await trx("games")
    .where({ id: context.gameId })
    .first();

  if (!recordedGame) {
    throw new TournamentResultError("Recorded game payload not found", 404);
  }

  if (
    String(recordedMatch.player1_id) !== context.player1Id ||
    String(recordedMatch.player2_id) !== context.player2Id
  ) {
    throw new TournamentResultError(
      "Recorded match participants do not match the tournament bracket",
      409,
    );
  }

  if (
    Number(recordedMatch.player1_score) !== context.player1Score ||
    Number(recordedMatch.player2_score) !== context.player2Score
  ) {
    throw new TournamentResultError(
      "Submitted score does not match the recorded match result",
      409,
    );
  }

  if (
    Number(recordedGame.team_a_score) !== context.player1Score ||
    Number(recordedGame.team_b_score) !== context.player2Score
  ) {
    throw new TournamentResultError(
      "Submitted score does not match the recorded final game score",
      409,
    );
  }

  const expectedRecordedWinner =
    context.player1Score > context.player2Score ? "A" : "B";
  if (String(recordedGame.winner) !== expectedRecordedWinner) {
    throw new TournamentResultError(
      "Recorded game winner does not match the submitted result",
      409,
    );
  }

  if (String(recordedMatch.winner_id || "") !== context.winnerId) {
    throw new TournamentResultError(
      "Recorded match winner does not match the submitted winner",
      409,
    );
  }
}

/**
 * Get tournament with all matches
 */
export async function getTournament(tournamentId: string) {
  try {
    const tournament = await db("tournaments")
      .where({ id: tournamentId })
      .first();

    if (!tournament) {
      return null;
    }

    const participants = await db("tournament_participants as tp")
      .join("users as u", "u.id", "tp.user_id")
      .where({ tournament_id: tournamentId })
      .select("u.id", "u.username");

    const matches = await db("tournament_matches")
      .where({ tournament_id: tournamentId })
      .orderBy(["round", "match_number"]);

    return {
      ...tournament,
      participants: participants.map((p: any) => ({
        id: String(p.id),
        username: String(p.username),
        isAI: false,
      })),
      matches,
    };
  } catch (error) {
    console.error("Error getting tournament:", error);
    throw error;
  }
}

/**
 * Submit match result for a tournament match
 */
export async function submitTournamentMatchResult(
  input: SubmitTournamentMatchResultInput,
) {
  const {
    tournamentId,
    matchId,
    submittedByUserId,
    gameId,
    winnerId,
    player1Score,
    player2Score,
    reviewOverride = false,
  } = input;

  try {
    if (!tournamentId) {
      throw new TournamentResultError("Tournament id is required", 400);
    }
    if (!matchId) {
      throw new TournamentResultError("Match id is required", 400);
    }
    if (!submittedByUserId) {
      throw new TournamentResultError("Submitting user is required", 401);
    }
    if (!winnerId) {
      throw new TournamentResultError("Winner id is required", 400);
    }
    if (!gameId) {
      throw new TournamentResultError("Game id is required", 400);
    }
    return await db.transaction(async (trx) => {
      const match = await trx("tournament_matches as tm")
        .join("tournaments as t", "t.id", "tm.tournament_id")
        .where("tm.id", matchId)
        .select(
          "tm.*",
          "t.created_by as tournament_created_by",
          "t.status as tournament_status",
        )
        .first();

      if (!match) {
        throw new TournamentResultError("Tournament match not found", 404);
      }

      if (match.tournament_id !== tournamentId) {
        throw new TournamentResultError(
          "Match does not belong to the provided tournament",
          400,
        );
      }

      if (match.tournament_status === "completed") {
        throw new TournamentResultError("Tournament is already completed", 409);
      }

      if (!match.player1_id || !match.player2_id) {
        throw new TournamentResultError(
          "Match participants are not fully assigned yet",
          409,
        );
      }

      const participants = [match.player1_id, match.player2_id];
      const submittedByIsParticipant = participants.includes(submittedByUserId);
      const submittedByIsHost = submittedByUserId === match.tournament_created_by;

      if (!participants.includes(winnerId)) {
        throw new TournamentResultError(
          "winnerId must be one of the match participants",
          400,
        );
      }

      validateSubmittedTournamentScores(
        player1Score,
        player2Score,
        winnerId,
        String(match.player1_id),
        String(match.player2_id),
      );

      await validateRecordedMatchResult(trx, {
        player1Id: String(match.player1_id),
        player2Id: String(match.player2_id),
        winnerId,
        player1Score,
        player2Score,
        gameId,
      });

      const duplicatedGameUsage = await trx("tournament_matches")
        .where({ game_id: gameId })
        .whereNot({ id: match.id })
        .first();

      if (duplicatedGameUsage) {
        throw new TournamentResultError(
          "This recorded game is already attached to another tournament match",
          409,
        );
      }

      if (reviewOverride) {
        if (!submittedByIsHost) {
          throw new TournamentResultError(
            "Only the tournament host can resolve disputed results",
            403,
          );
        }

        if (match.status === "completed") {
          const completedMatch = await trx("tournament_matches")
            .where({ id: match.id })
            .first();
          return {
            resolution: "already_completed",
            status: "completed",
            requiresReview: false,
            match: completedMatch,
          };
        }

        const now = new Date();
        await trx("tournament_matches")
          .where({ id: match.id })
          .update({
            winner_id: winnerId,
            game_id: gameId,
            player1_score: player1Score,
            player2_score: player2Score,
            status: "completed",
            completed_at: now,
            reported_by_user_id: submittedByUserId,
            confirmed_by_user_id: submittedByUserId,
            result_submitted_at: now,
            result_confirmed_at: now,
            requires_review: false,
            review_reason: null,
          });

        await progressTournamentAfterCompletedMatch(
          trx,
          match.tournament_id,
          match.round,
          winnerId,
        );

        const finalMatch = await trx("tournament_matches")
          .where({ id: match.id })
          .first();

        return {
          resolution: "host_override_completed",
          status: "completed",
          requiresReview: false,
          match: finalMatch,
        };
      }

      if (!submittedByIsParticipant) {
        throw new TournamentResultError(
          "Only match participants can submit results",
          403,
        );
      }

      if (match.status === "review_required" || match.requires_review) {
        throw new TournamentResultError(
          "Match result requires host review",
          409,
        );
      }

      if (match.status === "completed") {
        const completedMatch = await trx("tournament_matches")
          .where({ id: match.id })
          .first();
        return {
          resolution: "already_completed",
          status: "completed",
          requiresReview: false,
          match: completedMatch,
        };
      }

      const now = new Date();

      if (match.status === "pending" || match.status === "in_progress") {
        await trx("tournament_matches")
          .where({ id: match.id })
          .update({
            winner_id: winnerId,
            game_id: gameId,
            player1_score: player1Score,
            player2_score: player2Score,
            status: "pending_confirmation",
            completed_at: null,
            reported_by_user_id: submittedByUserId,
            confirmed_by_user_id: null,
            result_submitted_at: now,
            result_confirmed_at: null,
            requires_review: false,
            review_reason: null,
          });

        const pendingMatch = await trx("tournament_matches")
          .where({ id: match.id })
          .first();

        return {
          resolution: "submitted_waiting_confirmation",
          status: "pending_confirmation",
          requiresReview: false,
          match: pendingMatch,
        };
      }

      if (match.status === "pending_confirmation") {
        const reportedByUserId = String(match.reported_by_user_id || "").trim();

        if (!reportedByUserId) {
          throw new TournamentResultError(
            "Pending confirmation state is invalid; host review required",
            409,
          );
        }

        if (reportedByUserId === submittedByUserId) {
          throw new TournamentResultError(
            "The reporting participant cannot self-confirm the result",
            409,
          );
        }

        const submittedAt = match.result_submitted_at
          ? new Date(match.result_submitted_at)
          : null;
        if (
          submittedAt &&
          Number.isFinite(submittedAt.getTime()) &&
          Date.now() - submittedAt.getTime() >
            RESULT_CONFIRMATION_TIMEOUT_MINUTES * 60 * 1000
        ) {
          await trx("tournament_matches")
            .where({ id: match.id })
            .update({
              status: "review_required",
              requires_review: true,
              review_reason: "confirmation_timeout",
            });

          throw new TournamentResultError(
            "Result confirmation timed out and now requires host review",
            409,
          );
        }

        const sameWinner = match.winner_id === winnerId;
        const sameScores =
          Number(match.player1_score) === player1Score &&
          Number(match.player2_score) === player2Score;
        const sameGame = String(match.game_id || "") === String(gameId || "");

        if (!sameWinner || !sameScores || !sameGame) {
          await trx("tournament_matches")
            .where({ id: match.id })
            .update({
              status: "review_required",
              requires_review: true,
              review_reason: "conflicting_submissions",
            });

          throw new TournamentResultError(
            "Conflicting participant submissions; host review required",
            409,
          );
        }

        await trx("tournament_matches")
          .where({ id: match.id })
          .update({
            status: "completed",
            completed_at: now,
            confirmed_by_user_id: submittedByUserId,
            result_confirmed_at: now,
            requires_review: false,
            review_reason: null,
          });

        await progressTournamentAfterCompletedMatch(
          trx,
          match.tournament_id,
          match.round,
          winnerId,
        );

        const completedMatch = await trx("tournament_matches")
          .where({ id: match.id })
          .first();

        return {
          resolution: "confirmed_and_completed",
          status: "completed",
          requiresReview: false,
          match: completedMatch,
        };
      }

      throw new TournamentResultError(
        `Match status '${match.status}' is not eligible for result submission`,
        409,
      );
    });
  } catch (error) {
    console.error("Error submitting tournament match result:", error);
    if (error instanceof TournamentResultError) {
      throw error;
    }
    throw error;
  }
}

async function progressTournamentAfterCompletedMatch(
  trx: any,
  tournamentId: string,
  round: number,
  winnerId: string,
) {
  const nextRoundMatches = await trx("tournament_matches")
    .where({ tournament_id: tournamentId, round: round + 1 });

  for (const nextMatch of nextRoundMatches) {
    let updated = false;
    if (!nextMatch.player1_id) {
      await trx("tournament_matches")
        .where({ id: nextMatch.id })
        .update({ player1_id: winnerId });
      updated = true;
    } else if (!nextMatch.player2_id) {
      await trx("tournament_matches")
        .where({ id: nextMatch.id })
        .update({ player2_id: winnerId });
      updated = true;
    }

    if (updated) break;
  }

  const unresolvedMatches = await trx("tournament_matches")
    .where({ tournament_id: tournamentId })
    .whereNot({ status: "completed" });

  if (unresolvedMatches.length > 0) {
    return;
  }

  const finalsMatch = await trx("tournament_matches")
    .where({ tournament_id: tournamentId })
    .orderBy("round", "desc")
    .first();

  if (finalsMatch && finalsMatch.winner_id) {
    await trx("tournaments")
      .where({ id: tournamentId })
      .update({
        status: "completed",
        winner_id: finalsMatch.winner_id,
        completed_at: new Date(),
      });
  }
}

/**
 * Get all tournaments for a user
 */
export async function getUserTournaments(userId: string) {
  try {
    const tournaments = await db("tournaments")
      .where({ created_by: userId })
      .orderBy("created_at", "desc");

    return tournaments;
  } catch (error) {
    console.error("Error getting user tournaments:", error);
    throw error;
  }
}

/**
 * Get tournament bracket state for frontend
 */
export async function getTournamentBracketState(tournamentId: string) {
  try {
    const tournament = await db("tournaments")
      .where({ id: tournamentId })
      .first();

    if (!tournament) {
      return null;
    }

    const matches = await db("tournament_matches")
      .where({ tournament_id: tournamentId })
      .select("id", "player1_id", "player2_id", "winner_id", "status", "round")
      .orderBy(["round", "match_number"]);

    return {
      ...tournament,
      matches,
    };
  } catch (error) {
    console.error("Error getting tournament bracket state:", error);
    throw error;
  }
}
