import test from "node:test";
import assert from "node:assert/strict";

import { validateTournamentCreateInput } from "../src/services/tournamentService.ts";

test("validateTournamentCreateInput trims the name and normalizes player ids", () => {
  const result = validateTournamentCreateInput({
    name: "  Friday Cup  ",
    created_by: "u1",
    player_ids: ["u1", " u2 ", "u3", "u4"],
  });

  assert.equal(result.normalizedName, "Friday Cup");
  assert.deepEqual(result.uniquePlayerIds, ["u1", "u2", "u3", "u4"]);
});

test("validateTournamentCreateInput rejects duplicate players", () => {
  assert.throws(
    () =>
      validateTournamentCreateInput({
        name: "Dupes",
        created_by: "u1",
        player_ids: ["u1", "u2", "u2", "u4"],
      }),
    /exactly 4 unique players/,
  );
});

test("validateTournamentCreateInput rejects tournaments without the creator", () => {
  assert.throws(
    () =>
      validateTournamentCreateInput({
        name: "No Creator",
        created_by: "u1",
        player_ids: ["u2", "u3", "u4", "u5"],
      }),
    /creator must be included/,
  );
});
