import db from "../db.js";
import crypto from "crypto";

interface MatchResult {
  player1_id: string;
  player2_id: string;
  player1_score: number;
  player2_score: number;
  game_mode?: string;
  status?: "completed" | "abandoned" | "timeout";
  started_at: Date;
  ended_at: Date;
}

/**
 * Record a match result and update player statistics
 */
export async function recordMatch(match: MatchResult) {
  const matchId = crypto.randomUUID();
  const durationSeconds = Math.floor(
    (match.ended_at.getTime() - match.started_at.getTime()) / 1000
  );

  // Determine winner
  const winner_id =
    match.player1_score > match.player2_score
      ? match.player1_id
      : match.player2_score > match.player1_score
        ? match.player2_id
        : null;

  try {
    // 1. Insert match record
    await db("matches").insert({
      id: matchId,
      player1_id: match.player1_id,
      player2_id: match.player2_id,
      winner_id,
      player1_score: match.player1_score,
      player2_score: match.player2_score,
      game_mode: match.game_mode || "1v1",
      status: match.status || "completed",
      started_at: match.started_at,
      ended_at: match.ended_at,
      duration_seconds: durationSeconds,
    });

    // 2. Update player1 stats
    await updatePlayerStats(match.player1_id, {
      won: match.player1_score > match.player2_score,
      draw: match.player1_score === match.player2_score,
      goals_scored: match.player1_score,
      goals_conceded: match.player2_score,
    });

    // 3. Update player2 stats
    await updatePlayerStats(match.player2_id, {
      won: match.player2_score > match.player1_score,
      draw: match.player1_score === match.player2_score,
      goals_scored: match.player2_score,
      goals_conceded: match.player1_score,
    });

    return matchId;
  } catch (error) {
    console.error("Error recording match:", error);
    throw error;
  }
}

interface StatUpdate {
  won: boolean;
  draw: boolean;
  goals_scored: number;
  goals_conceded: number;
}

/**
 * Update player statistics after a match
 */
async function updatePlayerStats(userId: string, stats: StatUpdate) {
  try {
    // Check if player_stats record exists
    const existing = await db("player_stats")
      .where({ user_id: userId })
      .first();

    if (!existing) {
      // Create new stats record
      await db("player_stats").insert({
        user_id: userId,
        total_matches: 1,
        wins: stats.won ? 1 : 0,
        losses: (!stats.won && !stats.draw) ? 1 : 0,
        total_goals_scored: stats.goals_scored,
        total_goals_conceded: stats.goals_conceded,
        win_percentage: stats.won ? 100 : 0,
        avg_goals_per_match:
          Math.round((stats.goals_scored / 1) * 100) / 100,
        current_win_streak: stats.won ? 1 : 0,
        longest_win_streak: stats.won ? 1 : 0,
        last_match_at: new Date(),
        updated_at: new Date(),
      });
    } else {
      // Update existing stats
      const newTotalMatches = existing.total_matches + 1;
      const newWins = existing.wins + (stats.won ? 1 : 0);
      const newLosses = existing.losses + ((!stats.won && !stats.draw) ? 1 : 0);
      const newGoalsScored = existing.total_goals_scored + stats.goals_scored;
      const newGoalsConceded = existing.total_goals_conceded + stats.goals_conceded;

      const newWinPercentage =
        Math.round((newWins / newTotalMatches) * 10000) / 100;
      const newAvgGoals =
        Math.round((newGoalsScored / newTotalMatches) * 100) / 100;

      // Calculate win streak
      let newCurrentStreak = existing.current_win_streak;
      let newLongestStreak = existing.longest_win_streak;

      if (stats.won) {
        newCurrentStreak = existing.current_win_streak + 1;
        newLongestStreak = Math.max(
          newCurrentStreak,
          existing.longest_win_streak
        );
      } else {
        newCurrentStreak = 0;
      }

      await db("player_stats")
        .where({ user_id: userId })
        .update({
          total_matches: newTotalMatches,
          wins: newWins,
          losses: newLosses,
          total_goals_scored: newGoalsScored,
          total_goals_conceded: newGoalsConceded,
          win_percentage: newWinPercentage,
          avg_goals_per_match: newAvgGoals,
          current_win_streak: newCurrentStreak,
          longest_win_streak: newLongestStreak,
          last_match_at: new Date(),
          updated_at: new Date(),
        });
    }
  } catch (error) {
    console.error("Error updating player stats:", error);
    throw error;
  }
}

/**
 * Get player statistics
 */
export async function getPlayerStats(userId: string) {
  try {
    const stats = await db("player_stats")
      .where({ user_id: userId })
      .first();

    if (!stats) {
      // Return default stats if player has no record yet
      return {
        user_id: userId,
        total_matches: 0,
        wins: 0,
        losses: 0,
        total_goals_scored: 0,
        total_goals_conceded: 0,
        win_percentage: 0,
        avg_goals_per_match: 0,
        current_win_streak: 0,
        longest_win_streak: 0,
        last_match_at: null,
      };
    }

    return stats;
  } catch (error) {
    console.error("Error fetching player stats:", error);
    throw error;
  }
}

/**
 * Get player's recent matches
 */
export async function getPlayerMatches(userId: string, limit: number = 10) {
  try {
    const matches = await db("matches")
      .where((builder) => {
        builder.where("player1_id", userId).orWhere("player2_id", userId);
      })
      .orderBy("ended_at", "desc")
      .limit(limit);

    // Fetch opponent usernames for all matches
    const enrichedMatches = await Promise.all(
      matches.map(async (match) => {
        const opponentId = match.player1_id === userId ? match.player2_id : match.player1_id;
        
        // Fetch opponent username
        const opponent = await db("users")
          .select("username")
          .where({ id: opponentId })
          .first();

        return {
          ...match,
          user_perspective: {
            opponent_id: opponentId,
            opponent_username: opponent?.username || "Unknown Player",
            user_score: match.player1_id === userId ? match.player1_score : match.player2_score,
            opponent_score: match.player1_id === userId ? match.player2_score : match.player1_score,
            won: match.winner_id === userId,
          },
        };
      })
    );

    return enrichedMatches;
  } catch (error) {
    console.error("Error fetching player matches:", error);
    throw error;
  }
}

/**
 * Get match details by ID
 */
export async function getMatchDetails(matchId: string) {
  try {
    const match = await db("matches").where({ id: matchId }).first();
    return match;
  } catch (error) {
    console.error("Error fetching match details:", error);
    throw error;
  }
}

interface TeamGameResult {
  leftTeamPlayers: Array<{ user_id: string; socket_id?: string }>;
  rightTeamPlayers: Array<{ user_id: string; socket_id?: string }>;
  leftTeamScore: number;
  rightTeamScore: number;
  duration: string; // "fast" | "normal" | "long"
  powerups: boolean;
  gameMode: string; // "1v1" | "2v2" | "3v3"
  started_at: Date;
  ended_at: Date;
}

/**
 * Record a team-based game result and update all player statistics
 * Supports 1v1, 2v2, 3v3, etc.
 * Creates individual match records for each player-to-player pairing
 */
export async function recordTeamMatch(teamGame: TeamGameResult) {
  const gameId = crypto.randomUUID();
  const durationSeconds = Math.floor(
    (teamGame.ended_at.getTime() - teamGame.started_at.getTime()) / 1000
  );

  // Determine winning team
  const leftTeamWon = teamGame.leftTeamScore > teamGame.rightTeamScore;
  const rightTeamWon = teamGame.rightTeamScore > teamGame.leftTeamScore;
  const isDraw = teamGame.leftTeamScore === teamGame.rightTeamScore;

  try {
    // 1. Create individual match records for each player-to-player pairing
    // For 2v2: 4 matches (P1 vs P3, P1 vs P4, P2 vs P3, P2 vs P4)
    // This allows tracking individual win/loss against all opponents
    
    for (const leftPlayer of teamGame.leftTeamPlayers) {
      if (!leftPlayer.user_id) continue;
      
      for (const rightPlayer of teamGame.rightTeamPlayers) {
        if (!rightPlayer.user_id) continue;

        const matchId = crypto.randomUUID();
        
        // Determine winner for this match
        let winner_id: string | null = null;
        if (leftTeamWon) {
          winner_id = leftPlayer.user_id;
        } else if (rightTeamWon) {
          winner_id = rightPlayer.user_id;
        }
        // else: draw, winner_id stays null

        // Insert match record
        await db("matches").insert({
          id: matchId,
          player1_id: leftPlayer.user_id,
          player2_id: rightPlayer.user_id,
          winner_id,
          player1_score: teamGame.leftTeamScore,
          player2_score: teamGame.rightTeamScore,
          game_mode: teamGame.gameMode,
          status: "completed",
          started_at: teamGame.started_at,
          ended_at: teamGame.ended_at,
          duration_seconds: durationSeconds,
        });
      }
    }

    // 2. Update player statistics for all left team players
    for (const player of teamGame.leftTeamPlayers) {
      if (player.user_id) {
        await updatePlayerStats(player.user_id, {
          won: leftTeamWon,
          draw: isDraw,
          goals_scored: teamGame.leftTeamScore,
          goals_conceded: teamGame.rightTeamScore,
        });
      }
    }

    // 3. Update player statistics for all right team players
    for (const player of teamGame.rightTeamPlayers) {
      if (player.user_id) {
        await updatePlayerStats(player.user_id, {
          won: rightTeamWon,
          draw: isDraw,
          goals_scored: teamGame.rightTeamScore,
          goals_conceded: teamGame.leftTeamScore,
        });
      }
    }

    console.log(`✅ Team match recorded with ID: ${gameId} (${teamGame.gameMode})`);
    return gameId;
  } catch (error) {
    console.error("Error recording team match:", error);
    throw error;
  }
}
