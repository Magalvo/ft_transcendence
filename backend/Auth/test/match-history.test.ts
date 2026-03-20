import test from "node:test";
import assert from "node:assert/strict";

import {
  groupMatchesForUserHistory,
  groupTeamGamesForUserHistory,
  mergeUserHistoryEntries,
} from "../src/services/matchService.ts";

test("groupMatchesForUserHistory collapses team matches by team_game_id", () => {
  const grouped = groupMatchesForUserHistory(
    "u1",
    [
      {
        id: "m1",
        team_game_id: "g1",
        player1_id: "u1",
        player2_id: "u3",
        player1_score: 7,
        player2_score: 4,
        winner_id: "u1",
      },
      {
        id: "m2",
        team_game_id: "g1",
        player1_id: "u1",
        player2_id: "u4",
        player1_score: 7,
        player2_score: 4,
        winner_id: "u1",
      },
    ],
    new Map([
      ["u3", "Riley"],
      ["u4", "Sam"],
    ]),
    10,
  );

  assert.equal(grouped.length, 1);
  assert.equal(grouped[0].user_perspective.opponent_username, "Riley, Sam");
  assert.equal(grouped[0].user_perspective.opponent_id, "u3,u4");
  assert.equal(grouped[0].user_perspective.user_score, 7);
  assert.equal(grouped[0].user_perspective.opponent_score, 4);
  assert.equal(grouped[0].user_perspective.won, true);
});

test("groupMatchesForUserHistory keeps legacy single matches separate", () => {
  const grouped = groupMatchesForUserHistory(
    "u1",
    [
      {
        id: "legacy-1",
        team_game_id: null,
        player1_id: "u1",
        player2_id: "u2",
        player1_score: 5,
        player2_score: 3,
        winner_id: "u1",
      },
      {
        id: "legacy-2",
        team_game_id: null,
        player1_id: "u3",
        player2_id: "u1",
        player1_score: 2,
        player2_score: 6,
        winner_id: "u1",
      },
    ],
    new Map([
      ["u2", "Alex"],
      ["u3", "Jordan"],
    ]),
    10,
  );

  assert.equal(grouped.length, 2);
  assert.equal(grouped[0].user_perspective.opponent_username, "Alex");
  assert.equal(grouped[1].user_perspective.opponent_username, "Jordan");
});

test("groupTeamGamesForUserHistory collapses canonical team games into one history entry", () => {
  const grouped = groupTeamGamesForUserHistory(
    [
      {
        id: "game-1",
        game_mode: "2v2",
        team_a_score: 8,
        team_b_score: 5,
        winner: "A",
        created_at: "2026-03-19T21:00:00.000Z",
        user_team: "A",
        opponent_id: "u3",
        opponent_username: "Riley",
      },
      {
        id: "game-1",
        game_mode: "2v2",
        team_a_score: 8,
        team_b_score: 5,
        winner: "A",
        created_at: "2026-03-19T21:00:00.000Z",
        user_team: "A",
        opponent_id: "u4",
        opponent_username: "Sam",
      },
    ],
    10,
  );

  assert.equal(grouped.length, 1);
  assert.equal(grouped[0].id, "game-1");
  assert.equal(grouped[0].user_perspective.opponent_username, "Riley, Sam");
  assert.equal(grouped[0].user_perspective.user_score, 8);
  assert.equal(grouped[0].user_perspective.opponent_score, 5);
  assert.equal(grouped[0].user_perspective.won, true);
});

test("mergeUserHistoryEntries prefers canonical team-game history over summary match rows", () => {
  const merged = mergeUserHistoryEntries(
    [
      {
        id: "game-1",
        ended_at: "2026-03-19T21:00:00.000Z",
        user_perspective: {
          opponent_id: "u3",
          opponent_username: "Riley",
          user_score: 8,
          opponent_score: 5,
          won: true,
        },
      },
    ],
    [
      {
        id: "game-1",
        ended_at: "2026-03-19T21:00:00.000Z",
        user_perspective: {
          opponent_id: "u3,u4",
          opponent_username: "Riley, Sam",
          user_score: 8,
          opponent_score: 5,
          won: true,
        },
      },
    ],
    10,
  );

  assert.equal(merged.length, 1);
  assert.equal(merged[0].user_perspective?.opponent_username, "Riley, Sam");
});
