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

    await db.raw("PRAGMA foreign_keys = ON;");
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
