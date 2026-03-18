import db from "../db.js";
import crypto from "crypto";

interface CreateTournamentInput {
  name: string;
  created_by: string;
  player_ids: string[];
}

interface TournamentMatch {
  id: string;
  round: number;
  match_number: number;
  player1_id: string;
  player2_id: string;
  winner_id: string | null;
  status: string;
}

/**
 * Create a new tournament with initial bracket
 */
export async function createTournament(input: CreateTournamentInput) {
  const tournamentId = crypto.randomUUID();
  const now = new Date();

  try {
    // 1. Create tournament
    await db("tournaments").insert({
      id: tournamentId,
      name: input.name,
      created_by: input.created_by,
      status: "active",
      player_count: input.player_ids.length,
      created_at: now,
    });

    // 2. Add participants
    for (const userId of input.player_ids) {
      await db("tournament_participants").insert({
        tournament_id: tournamentId,
        user_id: userId,
        is_eliminated: false,
        created_at: now,
      });
    }

    // 3. Generate initial bracket (simple single elimination)
    const matches = generateBracket(tournamentId, input.player_ids, now);
    for (const match of matches) {
      await db("tournament_matches").insert(match);
    }

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

  // Finals (Round 2) - placeholder with empty strings for players
  matches.push({
    id: crypto.randomUUID(),
    tournament_id: tournamentId,
    round: 2,
    match_number: 1,
    player1_id: "",
    player2_id: "",
    winner_id: null,
    player1_score: 0,
    player2_score: 0,
    status: "pending",
    created_at: now,
    completed_at: null,
  });

  return matches;
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

    const participants = await db("tournament_participants")
      .where({ tournament_id: tournamentId })
      .select("user_id");

    const matches = await db("tournament_matches")
      .where({ tournament_id: tournamentId })
      .orderBy(["round", "match_number"]);

    return {
      ...tournament,
      participants: participants.map((p: any) => p.user_id),
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
  matchId: string,
  gameId: string,
  winnerId: string,
  player1Score: number,
  player2Score: number
) {
  try {
    const match = await db("tournament_matches")
      .where({ id: matchId })
      .first();

    if (!match) {
      throw new Error("Tournament match not found");
    }

    const now = new Date();

    // Update the match with results
    await db("tournament_matches")
      .where({ id: matchId })
      .update({
        winner_id: winnerId,
        game_id: gameId,
        player1_score: player1Score,
        player2_score: player2Score,
        status: "completed",
        completed_at: now,
      });

    // Mark loser as eliminated if in last round of tournament
    const tournament = await db("tournaments")
      .where({ id: match.tournament_id })
      .first();

    // Check if next round matches can be progressed
    const nextRoundMatches = await db("tournament_matches")
      .where({ tournament_id: match.tournament_id, round: match.round + 1 });

    // Update next round matches with winners (handle empty strings and nulls as placeholders)
    for (const nextMatch of nextRoundMatches) {
      let updated = false;
      if (!nextMatch.player1_id || nextMatch.player1_id === "") {
        await db("tournament_matches")
          .where({ id: nextMatch.id })
          .update({ player1_id: winnerId });
        updated = true;
      } else if (!nextMatch.player2_id || nextMatch.player2_id === "") {
        await db("tournament_matches")
          .where({ id: nextMatch.id })
          .update({ player2_id: winnerId });
        updated = true;
      }

      if (updated) break; // Only update one slot per match
    }

    // Check if tournament is complete (finals match completed)
    const pendingMatches = await db("tournament_matches")
      .where({ tournament_id: match.tournament_id, status: "pending" });

    if (pendingMatches.length === 0) {
      // Find finals match to get winner
      const finalsMatch = await db("tournament_matches")
        .where({ tournament_id: match.tournament_id })
        .orderBy("round", "desc")
        .first();

      if (finalsMatch && finalsMatch.winner_id) {
        // Mark tournament as completed
        await db("tournaments")
          .where({ id: match.tournament_id })
          .update({
            status: "completed",
            winner_id: finalsMatch.winner_id,
            completed_at: now,
          });
      }
    }

    return match;
  } catch (error) {
    console.error("Error submitting tournament match result:", error);
    throw error;
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
