import type { Knex } from "knex";

// Remembers the last TOTP time step each user consumed, so a 2FA code cannot
// be used twice (it would otherwise stay valid for its whole 30s window).
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("users", (table) => {
    table.bigInteger("totp_last_step").nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("users", (table) => {
    table.dropColumn("totp_last_step");
  });
}
