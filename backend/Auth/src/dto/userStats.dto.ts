/**
 * DTO for player statistics
 * Maps to 'player_stats' table
 * Returned by /users/:userId/stats endpoint
 */
class UserStatsDTO {

    user_id!: string;               // UUID foreign key to users table

    total_matches!: number;         // Total matches played

    wins!: number;                  // Total wins

    losses!: number;                // Total losses

    total_goals_scored!: number;    // Cumulative goals scored

    total_goals_conceded!: number;  // Cumulative goals conceded

    win_percentage!: number;        // Percentage (0-100)

    avg_goals_per_match!: number;   // Average goals per match (decimal)

    current_win_streak!: number;    // Current consecutive wins

    longest_win_streak!: number;    // Best streak achieved

    last_match_at!: string | null;  // ISO timestamp of last match

    updated_at!: string;            // ISO timestamp of last stats update
}

export default UserStatsDTO;
