import test from "node:test";
import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import knexFactory, { type Knex } from "knex";

import { migrationNames, migrationSource } from "../src/migrations/index.ts";
import * as baseline from "../src/migrations/20261027000000_baseline.ts";

// Each test gets its own throwaway SQLite file and knex instance, separate
// from the shared test database.
const opened: Knex[] = [];
function freshDb(): Knex {
  const db = knexFactory({
    client: "sqlite3",
    connection: { filename: join(tmpdir(), `ft-migrations-${randomBytes(6).toString("hex")}.sqlite`) },
    useNullAsDefault: true,
  });
  opened.push(db);
  return db;
}
test.after(async () => {
  await Promise.all(opened.map((db) => db.destroy()));
});

// baseline.up logs every table it checks; keep test output readable.
async function quietly<T>(fn: () => Promise<T>): Promise<T> {
  const log = console.log;
  console.log = () => {};
  try {
    return await fn();
  } finally {
    console.log = log;
  }
}

const migrate = (db: Knex) => quietly(() => db.migrate.latest({ migrationSource }));

async function columns(db: Knex, table: string): Promise<string[]> {
  const rows = await db.raw(`PRAGMA table_info(${table})`);
  return rows.map((r: any) => r.name);
}

async function seedMessage(db: Knex, text: string) {
  await db("users").insert({ id: "u1", username: "u1" });
  await db("chat_groups").insert({ admin_id: "u1", owner_id: "u1", name: "g" });
  await db("chat_group_messages").insert({ id_group: 1, id_usersender: "u1", messagem: text, timestamp: 1 });
}

test("migration names are unique, timestamp-prefixed and in order", () => {
  assert.equal(new Set(migrationNames).size, migrationNames.length);
  for (const name of migrationNames) assert.match(name, /^\d{14}_[a-z0-9_]+$/);
  assert.deepEqual([...migrationNames].sort(), migrationNames);
});

test("a fresh database gets every migration once", async () => {
  const db = freshDb();
  const [, applied] = await migrate(db);
  assert.deepEqual(applied, migrationNames);

  for (const table of ["users", "refresh_tokens", "chat_groups", "chat_group_messages", "private_messages", "tournament_matches", "tournament_match_invites"]) {
    assert.ok(await db.schema.hasTable(table), `${table} exists`);
  }
  assert.ok((await columns(db, "refresh_tokens")).includes("previous_token"));

  const [, again] = await migrate(db);
  assert.deepEqual(again, [], "nothing runs twice");
  const recorded = await db("knex_migrations").pluck("name");
  assert.deepEqual(recorded, migrationNames);
});

test("a database from an older initDb is brought up to date", async () => {
  const db = freshDb();
  // Old initDb: same tables, no migration history, missing later columns.
  await quietly(() => baseline.up(db));
  await db.schema.alterTable("refresh_tokens", (t) => {
    t.dropColumn("previous_token");
    t.dropColumn("rotated_at");
  });
  await db.schema.alterTable("users", (t) => t.dropColumn("accepted_terms"));
  await seedMessage(db, "Tom &amp; Jerry &lt;3 &quot;hi&quot;");

  const [, applied] = await migrate(db);
  assert.deepEqual(applied, migrationNames);

  assert.ok((await columns(db, "refresh_tokens")).includes("previous_token"));
  assert.ok((await columns(db, "refresh_tokens")).includes("rotated_at"));
  assert.ok((await columns(db, "users")).includes("accepted_terms"));

  const row = await db("chat_group_messages").first();
  assert.equal(row.messagem, 'Tom & Jerry <3 "hi"', "escaped legacy text is restored");
  const user = await db("users").where({ id: "u1" }).first();
  assert.ok(user, "existing rows survive");
});

test("chat text already unescaped by the old initDb is left alone", async () => {
  const db = freshDb();
  await quietly(() => baseline.up(db));
  await db.schema.createTable("schema_meta", (t) => {
    t.string("key").primary();
    t.string("applied_at").notNullable();
  });
  await db("schema_meta").insert({ key: "chat_messages_unescaped", applied_at: new Date().toISOString() });
  // A user really typed this entity after the old unescape ran.
  await seedMessage(db, "typed a &lt; b");

  await migrate(db);
  const row = await db("chat_group_messages").first();
  assert.equal(row.messagem, "typed a &lt; b");
});

test("the schema is the same whichever path a database took", async () => {
  const describe = async (db: Knex) => {
    const tables: string[] = await db("sqlite_master")
      .where({ type: "table" })
      .whereNotIn("name", ["schema_meta"])
      .andWhereNot("name", "like", "sqlite%")
      .orderBy("name")
      .pluck("name");
    const out: string[] = [];
    for (const table of tables) out.push(`${table}(${(await columns(db, table)).sort().join(",")})`);
    return out;
  };

  const fresh = freshDb();
  await migrate(fresh);

  const legacy = freshDb();
  await quietly(() => baseline.up(legacy));
  await legacy.schema.alterTable("refresh_tokens", (t) => {
    t.dropColumn("previous_token");
    t.dropColumn("rotated_at");
  });
  await migrate(legacy);

  assert.deepEqual(await describe(legacy), await describe(fresh));
});
