import path from "path";
import { fileURLToPath } from "url";
import db from "./db.js";
import { migrationSource } from "./migrations/index.js";

// Brings the schema up to date by running every pending migration (see
// ./migrations/index.ts). Safe to run on every start: applied migrations are
// recorded in knex_migrations and never run twice.
export async function initDb(): Promise<void> {
  try {
    const [batch, applied] = await db.migrate.latest({ migrationSource });
    if (applied.length === 0) {
      console.log("Database schema is up to date");
    } else {
      console.log(`Applied migration batch ${batch}: ${applied.join(", ")}`);
    }

    // Foreign keys are enforced on every connection (see db.ts), but rows
    // written before that may point at records that no longer exist. Report
    // them; deleting someone's data automatically is not this script's call.
    const orphans: Array<{ table: string; parent: string }> = await db.raw("PRAGMA foreign_key_check");
    if (orphans.length > 0) {
      const byTable = new Map<string, number>();
      for (const row of orphans) {
        const key = `${row.table} -> ${row.parent}`;
        byTable.set(key, (byTable.get(key) ?? 0) + 1);
      }
      console.warn(
        `Found ${orphans.length} row(s) referencing missing records (left untouched): ` +
          [...byTable].map(([key, count]) => `${key}: ${count}`).join(", "),
      );
    }
  } catch (err) {
    console.error("Error initializing DB:", err);
    throw err;
  }
}

// Run as a script (npm run init-db / the container CMD), not when imported.
const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  initDb()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
