import type { Knex } from "knex";

// Chat messages used to be HTML-escaped on write, but the frontend renders
// them as plain text, so the entities showed up literally. Restore the
// original text; escaping now happens only where HTML is generated.
//
// Databases started before migrations existed may already have run this step
// from the old initDb, which recorded it in schema_meta: skip it there so the
// text is never unescaped twice.
const LEGACY_MARKER = "chat_messages_unescaped";

export async function up(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable("schema_meta")) {
    const applied = await knex("schema_meta").where({ key: LEGACY_MARKER }).first();
    if (applied) return;
  }

  for (const tableName of ["chat_group_messages", "private_messages"]) {
    await knex.raw(
      `UPDATE ${tableName} SET messagem = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(messagem, '&lt;', '<'), '&gt;', '>'), '&quot;', '"'), '&#39;', ''''), '&amp;', '&') WHERE messagem LIKE '%&%'`,
    );
  }
}

// Re-escaping cannot tell messages that were escaped from ones typed with
// entities, so there is nothing safe to undo.
export async function down(): Promise<void> {}
