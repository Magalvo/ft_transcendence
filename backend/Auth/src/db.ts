import knex from "knex";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);


const dbFile = process.env.DB_FILE || join(__dirname, "dev.sqlite");

console.log("Using DB file:", dbFile);


const db = knex({
  client: "sqlite3",
  connection: { filename: dbFile },
  useNullAsDefault: true,
  pool: {
    // SQLite enforces foreign keys (and ON DELETE CASCADE) only on connections
    // that ask for it, so turn it on for every connection the pool opens.
    afterCreate: (conn: any, done: (err: Error | null, conn: any) => void) => {
      conn.run("PRAGMA foreign_keys = ON", (err: Error | null) => done(err, conn));
    },
  },
});

export default db;
