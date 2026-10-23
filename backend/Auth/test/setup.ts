// Loaded with --import before any test file, so every module that imports
// src/db.ts talks to a throwaway database instead of a real one.
import { tmpdir } from "os";
import { join } from "path";

process.env.DB_FILE = join(tmpdir(), `ft-auth-test-${process.pid}-${Date.now()}.sqlite`);
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
