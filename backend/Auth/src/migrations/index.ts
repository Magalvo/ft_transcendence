import type { Knex } from "knex";

import * as baseline from "./20261027000000_baseline.js";
import * as unescapeChatMessages from "./20261027000001_unescape_chat_messages.js";
import * as totpLastStep from "./20261027000002_totp_last_step.js";
import * as nullableBracketPlayers from "./20261027000003_nullable_bracket_players.js";

type Migration = {
  up: (knex: Knex) => Promise<void>;
  down: (knex: Knex) => Promise<void>;
  config?: { transaction?: boolean };
};

// Every migration, in order. Names are recorded in the knex_migrations table,
// so never rename or remove an entry once it has shipped.
//
// To change the schema: add a file named <YYYYMMDDHHMMSS>_<what>.ts exporting
// up (and down), then append it here. Migrations run in a transaction unless
// they export `config = { transaction: false }`.
const migrations: Array<[name: string, migration: Migration]> = [
  ["20261027000000_baseline", baseline],
  ["20261027000001_unescape_chat_messages", unescapeChatMessages],
  ["20261027000002_totp_last_step", totpLastStep],
  ["20261027000003_nullable_bracket_players", nullableBracketPlayers],
];

// Migrations are listed in code rather than discovered on disk, so the same
// list works under tsx (src/*.ts) and in the compiled build (dist/*.js).
export const migrationSource: Knex.MigrationSource<[string, Migration]> = {
  async getMigrations() {
    return migrations;
  },
  getMigrationName([name]) {
    return name;
  },
  async getMigration([, migration]) {
    return migration;
  },
};

export const migrationNames = migrations.map(([name]) => name);
