import db from "../db.js";
import crypto from "crypto";
import { sendError } from "../utils/respond.js";

export default async function createGame(req: any, reply: any) {
  try {
    const {
      duration,
      powerups,
      mode,
      teamA,
      teamB,
      teamAScore,
      teamBScore,
    } = req.body;

    const gameId = crypto.randomUUID();
    const winner = teamAScore > teamBScore ? "A" : "B";

    // Insert game
    await db.raw(
      `INSERT INTO games 
       (id, duration, powerups, mode, team_a_score, team_b_score, winner)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [gameId, duration, powerups, mode, teamAScore, teamBScore, winner]
    );

    // Insert players
    for (const userId of teamA) {
      await db.raw(
        "INSERT INTO game_players (game_id, user_id, team) VALUES (?, ?, 'A')",
        [gameId, userId]
      );
    }

    for (const userId of teamB) {
      await db.raw(
        "INSERT INTO game_players (game_id, user_id, team) VALUES (?, ?, 'B')",
        [gameId, userId]
      );
    }

    return reply.code(201).send({ gameId });
  } catch (err) {
    console.error(err);
    return sendError(reply, "Failed to save game", 500);
  }
}
