import { randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";

import { buildApp } from "../../src/app.ts";
import { initDb } from "../../src/initDb.ts";

let schemaReady: Promise<void> | null = null;

// Creates the schema once per test process (test/setup.ts points DB_FILE at a
// throwaway file). initDb is chatty, so its console output is muted here.
export function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    const log = console.log;
    console.log = () => {};
    schemaReady = initDb().finally(() => {
      console.log = log;
    });
  }
  return schemaReady;
}

export async function createTestApp(): Promise<FastifyInstance> {
  await ensureSchema();
  const app = buildApp({ logger: false });
  await app.ready();
  return app;
}

// Rate limits are keyed by client IP; every helper call can use a fresh one so
// tests do not throttle each other.
let ipCounter = 1;
export function freshIp(): string {
  ipCounter += 1;
  return `10.${(ipCounter >> 16) & 255}.${(ipCounter >> 8) & 255}.${ipCounter & 255}`;
}

export function uniqueName(prefix: string): string {
  return `${prefix}_${randomBytes(4).toString("hex")}`.slice(0, 20);
}

export type TestUser = {
  id: string;
  username: string;
  password: string;
  email: string;
  token: string;
  refreshToken: string;
};

export async function registerUser(app: FastifyInstance, prefix = "user"): Promise<TestUser> {
  const username = uniqueName(prefix);
  const password = `pw-${randomBytes(6).toString("hex")}`;
  const email = `${username}@example.test`;

  const res = await app.inject({
    method: "POST",
    url: "/api/register",
    headers: { "x-forwarded-for": freshIp() },
    payload: { username, password, email, acceptTerms: true },
  });
  if (res.statusCode !== 201) {
    throw new Error(`register failed: ${res.statusCode} ${res.body}`);
  }
  const { token, refreshToken } = res.json().data;

  const me = await app.inject({
    method: "GET",
    url: "/api/me",
    headers: { authorization: `Bearer ${token}` },
  });
  return { id: me.json().id, username, password, email, token, refreshToken };
}

export function authHeaders(user: { token: string }) {
  return { authorization: `Bearer ${user.token}`, "x-forwarded-for": freshIp() };
}
