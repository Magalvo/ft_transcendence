import db from "../db.js";
import crypto from "crypto";

interface MatchResult {
  team_game_id?: string | null;
  player1_id: string;
  player2_id: string;
  player1_score: number;
  player2_score: number;
  game_mode?: string;
  status?: "completed" | "abandoned" | "timeout";
  started_at: Date;
  ended_at: Date;
  teamGameData?: {
    leftTeamPlayers: Array<{ user_id: string; socket_id?: string }>;
    rightTeamPlayers: Array<{ user_id: string; socket_id?: string }>;
    duration: string;
    powerups: boolean;
    gameMode: string;
  };
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
    if (match.teamGameData) {
      const {
        leftTeamPlayers,
        rightTeamPlayers,
        duration,
        powerups,
        gameMode,
      } = match.teamGameData;

      const gameId = crypto.randomUUID();
      const leftTeamWon = match.player1_score > match.player2_score;
      const rightTeamWon = match.player2_score > match.player1_score;
      const isDraw = match.player1_score === match.player2_score;

      await db("games").insert({
        id: gameId,
        duration,
        powerups,
        mode: gameMode,
        team_a_score: match.player1_score,
        team_b_score: match.player2_score,
        winner: isDraw ? "draw" : leftTeamWon ? "A" : "B",
        created_at: match.ended_at,
      });

      await db("matches").insert({
        id: gameId,
        team_game_id: gameId,
        player1_id: match.player1_id,
        player2_id: match.player2_id,
        winner_id,
        player1_score: match.player1_score,
        player2_score: match.player2_score,
        game_mode: gameMode,
        status: match.status || "completed",
        started_at: match.started_at,
        ended_at: match.ended_at,
        duration_seconds: durationSeconds,
      });

      for (const leftPlayer of leftTeamPlayers) {
        if (!leftPlayer.user_id) continue;
        await db("game_players").insert({
          game_id: gameId,
          user_id: leftPlayer.user_id,
          team: "A",
        });
      }

      for (const rightPlayer of rightTeamPlayers) {
        if (!rightPlayer.user_id) continue;
        await db("game_players").insert({
          game_id: gameId,
          user_id: rightPlayer.user_id,
          team: "B",
        });
      }

      for (const player of leftTeamPlayers) {
        if (player.user_id) {
          await updatePlayerStats(player.user_id, {
            won: leftTeamWon,
            draw: isDraw,
            goals_scored: match.player1_score,
            goals_conceded: match.player2_score,
          });
        }
      }

      for (const player of rightTeamPlayers) {
        if (player.user_id) {
          await updatePlayerStats(player.user_id, {
            won: rightTeamWon,
            draw: isDraw,
            goals_scored: match.player2_score,
            goals_conceded: match.player1_score,
          });
        }
      }

      console.log(`✅ Team match recorded with ID: ${gameId} (${gameMode})`);
      return gameId;
    }

    await db("matches").insert({
      id: matchId,
      team_game_id: match.team_game_id ?? null,
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

    await updatePlayerStats(match.player1_id, {
      won: match.player1_score > match.player2_score,
      draw: match.player1_score === match.player2_score,
      goals_scored: match.player1_score,
      goals_conceded: match.player2_score,
    });

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

type HistoryMatchRow = {
  id: string;
  team_game_id?: string | null;
  player1_id: string;
  player2_id: string;
  player1_score: number;
  player2_score: number;
  winner_id: string | null;
  [key: string]: unknown;
};

type TeamGameHistoryRow = {
  id: string;
  game_mode?: string | null;
  team_a_score: number;
  team_b_score: number;
  winner: string | null;
  created_at?: string | number | Date | null;
  user_team: string;
  opponent_id: string;
  opponent_username: string;
};

type UserHistoryEntry = {
  id: string;
  started_at?: unknown;
  ended_at?: unknown;
  user_perspective?: {
    opponent_id?: string | null;
    opponent_username?: string;
    user_score?: number;
    opponent_score?: number;
    won?: boolean;
  };
  [key: string]: unknown;
};

export function groupMatchesForUserHistory(
  userId: string,
  matches: HistoryMatchRow[],
  opponentNames: Map<string, string>,
  limit: number,
) {
  const groupedMatches = new Map<
    string,
    {
      match: HistoryMatchRow;
      opponentIds: Set<string>;
      opponentNames: Set<string>;
    }
  >();

  for (const match of matches) {
    const opponentId =
      match.player1_id === userId ? match.player2_id : match.player1_id;
    const groupKey = String(match.team_game_id || match.id);
    const existing = groupedMatches.get(groupKey);

    if (!existing) {
      groupedMatches.set(groupKey, {
        match,
        opponentIds: new Set(opponentId ? [String(opponentId)] : []),
        opponentNames: new Set(
          opponentId
            ? [opponentNames.get(String(opponentId)) || "Unknown Player"]
            : [],
        ),
      });
      continue;
    }

    if (opponentId) {
      existing.opponentIds.add(String(opponentId));
      existing.opponentNames.add(
        opponentNames.get(String(opponentId)) || "Unknown Player",
      );
    }
  }

  return Array.from(groupedMatches.values())
    .slice(0, limit)
    .map(({ match, opponentIds, opponentNames: aggregatedOpponentNames }) => {
      const opponentIdList = Array.from(opponentIds);
      const opponentNameList = Array.from(aggregatedOpponentNames);

      return {
        ...match,
        user_perspective: {
          opponent_id:
            opponentIdList.length <= 1
              ? (opponentIdList[0] ?? null)
              : opponentIdList.join(","),
          opponent_username:
            opponentNameList.length > 0
              ? opponentNameList.join(", ")
              : "Unknown Player",
          user_score:
            match.player1_id === userId
              ? match.player1_score
              : match.player2_score,
          opponent_score:
            match.player1_id === userId
              ? match.player2_score
              : match.player1_score,
          won: match.winner_id === userId,
        },
      };
    });
}

export function groupTeamGamesForUserHistory(
  games: TeamGameHistoryRow[],
  limit: number,
) {
  const groupedGames = new Map<
    string,
    {
      game: TeamGameHistoryRow;
      opponentIds: Set<string>;
      opponentNames: Set<string>;
    }
  >();

  for (const game of games) {
    const existing = groupedGames.get(game.id);

    if (!existing) {
      groupedGames.set(game.id, {
        game,
        opponentIds: new Set(game.opponent_id ? [String(game.opponent_id)] : []),
        opponentNames: new Set(
          game.opponent_username ? [String(game.opponent_username)] : [],
        ),
      });
      continue;
    }

    if (game.opponent_id) {
      existing.opponentIds.add(String(game.opponent_id));
    }
    if (game.opponent_username) {
      existing.opponentNames.add(String(game.opponent_username));
    }
  }

  return Array.from(groupedGames.values())
    .slice(0, limit)
    .map(({ game, opponentIds, opponentNames }) => {
      const userOnTeamA = game.user_team === "A";
      const userScore = userOnTeamA ? game.team_a_score : game.team_b_score;
      const opponentScore = userOnTeamA ? game.team_b_score : game.team_a_score;

      return {
        id: game.id,
        game_mode: game.game_mode ?? null,
        started_at: game.created_at ?? null,
        ended_at: game.created_at ?? null,
        user_perspective: {
          opponent_id: Array.from(opponentIds).join(","),
          opponent_username: Array.from(opponentNames).join(", "),
          user_score: userScore,
          opponent_score: opponentScore,
          won: game.winner === game.user_team,
        },
      };
    });
}

function getHistoryTimestamp(entry: { ended_at?: unknown; started_at?: unknown }) {
  const raw = entry.ended_at ?? entry.started_at;
  if (!raw) return 0;
  const timestamp =
    raw instanceof Date ? raw.getTime() : new Date(String(raw)).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function mergeUserHistoryEntries(
  individualHistory: UserHistoryEntry[],
  teamGameHistory: UserHistoryEntry[],
  limit: number,
) {
  const mergedById = new Map<string, UserHistoryEntry>();

  for (const entry of individualHistory) {
    mergedById.set(String(entry.id), entry);
  }

  for (const entry of teamGameHistory) {
    mergedById.set(String(entry.id), entry);
  }

  return Array.from(mergedById.values())
    .sort((left, right) => getHistoryTimestamp(right) - getHistoryTimestamp(left))
    .slice(0, limit);
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
    const fetchLimit = Math.max(limit * 6, limit);
    const matches = await db("matches")
      .where((builder) => {
        builder.where("player1_id", userId).orWhere("player2_id", userId);
      })
      .orderBy("ended_at", "desc")
      .limit(fetchLimit);

    const opponentIds = Array.from(
      new Set(
        matches
          .map((match) =>
            match.player1_id === userId ? match.player2_id : match.player1_id,
          )
          .filter(Boolean),
      ),
    );
    const opponents =
      opponentIds.length > 0
        ? await db("users")
            .select("id", "username")
            .whereIn("id", opponentIds)
        : [];
    const opponentNames = new Map<string, string>(
      opponents.map((opponent: any) => [
        String(opponent.id),
        String(opponent.username),
      ]),
    );

    const individualHistory = groupMatchesForUserHistory(
      userId,
      matches as HistoryMatchRow[],
      opponentNames,
      limit,
    );

    const recentTeamGameIds = Array.from(
      new Set(
        (
          await db("games as g")
            .join("game_players as gp_self", "gp_self.game_id", "g.id")
            .where("gp_self.user_id", userId)
            .select("g.id")
            .orderBy("g.created_at", "desc")
            .limit(fetchLimit)
        ).map((row: any) => String(row.id)),
      ),
    );

    const teamGameRows =
      recentTeamGameIds.length > 0
        ? await db("games as g")
            .join("game_players as gp_self", "gp_self.game_id", "g.id")
            .join("game_players as gp_opp", function () {
              this.on("gp_opp.game_id", "=", "g.id").andOn(
                "gp_opp.team",
                "<>",
                "gp_self.team",
              );
            })
            .join("users as u_opp", "u_opp.id", "gp_opp.user_id")
            .where("gp_self.user_id", userId)
            .whereIn("g.id", recentTeamGameIds)
            .select(
              "g.id",
              "g.mode as game_mode",
              "g.team_a_score",
              "g.team_b_score",
              "g.winner",
              "g.created_at",
              "gp_self.team as user_team",
              "u_opp.id as opponent_id",
              "u_opp.username as opponent_username",
            )
            .orderBy("g.created_at", "desc")
        : [];

    const teamGameHistory = groupTeamGamesForUserHistory(
      teamGameRows as TeamGameHistoryRow[],
      limit,
    );

    return mergeUserHistoryEntries(
      individualHistory as UserHistoryEntry[],
      teamGameHistory as UserHistoryEntry[],
      limit,
    );
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
    const game = await db("games").where({ id: matchId }).first();
    if (!match && !game) {
      return null;
    }

    const participants =
      game
        ? await db("game_players as gp")
            .join("users as u", "u.id", "gp.user_id")
            .select("gp.user_id", "gp.team", "u.username")
            .where("gp.game_id", matchId)
            .orderBy("gp.team", "asc")
            .orderBy("u.username", "asc")
        : [];

    return {
      ...(match || {}),
      ...(game || {}),
      participants,
    };
  } catch (error) {
    console.error("Error fetching match details:", error);
    throw error;
  }
}

