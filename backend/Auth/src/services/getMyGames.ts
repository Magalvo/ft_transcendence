import db from "../db.js";
import { sendError } from "../utils/respond.js";

export default async function getMyGames(req: any, reply: any) {
  try {
    const userId = req.user.id;

    const result = await db.raw(
      `
      SELECT 
        g.id as gameId,
        g.duration,
        g.powerups,
        g.mode,
        g.team_a_score,
        g.team_b_score,
        g.winner,
        g.created_at,
        gp.team as user_team
      FROM games g
      JOIN game_players gp ON gp.game_id = g.id
      WHERE gp.user_id = ?
      ORDER BY g.created_at DESC
      `,
      [userId]
    );

    const rows = Array.isArray(result[0]) ? result[0] : result;
    return reply.send(rows);
  } catch (err) {
    console.error(err);
    return sendError(reply, "Failed to fetch games", 500);
  }
}
