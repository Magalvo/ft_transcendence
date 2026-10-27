import type { Knex } from "knex";

// Later-round bracket matches (e.g. the final) have no players until the
// earlier rounds finish. They used to store "" as a placeholder, which breaks
// the foreign key to users now that foreign keys are enforced. Allow NULL and
// convert existing placeholders.
//
// Changing NOT NULL makes SQLite rebuild the table; that must happen with
// foreign keys off (ignored inside a transaction, hence transaction: false).
export const config = { transaction: false };

export async function up(knex: Knex): Promise<void> {
  await knex.raw("PRAGMA foreign_keys = OFF");
  try {
    await knex.schema.alterTable("tournament_matches", (table) => {
      table.uuid("player1_id").nullable().alter();
      table.uuid("player2_id").nullable().alter();
    });
    await knex("tournament_matches").where({ player1_id: "" }).update({ player1_id: null });
    await knex("tournament_matches").where({ player2_id: "" }).update({ player2_id: null });
  } finally {
    await knex.raw("PRAGMA foreign_keys = ON");
  }
}

// Going back to NOT NULL would need placeholders that break the foreign key.
export async function down(): Promise<void> {
  throw new Error("Cannot make bracket players NOT NULL again without invalid placeholders");
}
