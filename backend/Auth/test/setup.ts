// Loaded with --import before any test file, so every module that imports
// src/db.ts talks to a throwaway database instead of a real one.
import { after } from "node:test";
import { tmpdir } from "os";
import { join } from "path";

process.env.DB_FILE = join(tmpdir(), `ft-auth-test-${process.pid}-${Date.now()}.sqlite`);
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
// A local backend/Auth/.env must not leak into tests (dotenv never overrides
// variables that are already set): no real SMTP, no Google OAuth.
process.env.SMTP_HOST = "";
process.env.GOOGLE_CLIENT_SECRET = "";
process.env.FRONTEND_URL = "https://localhost:8443";

// All test files share one process (--experimental-test-isolation=none) and
// one knex pool. Close it once, after every test has run; an open pool keeps
// the process alive forever.
after(async () => {
  const { default: db } = await import("../src/db.ts");
  await db.destroy();
});
