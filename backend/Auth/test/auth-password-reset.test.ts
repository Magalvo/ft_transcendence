import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

import { createTestApp, freshIp, registerUser, uniqueName, type TestUser } from "./helpers/app.ts";
import db from "../src/db.ts";
import { hashToken } from "../src/utils/tokens.ts";

const app = await createTestApp();
test.after(() => app.close());

// The plaintext reset token only ever exists in the email, so tests plant a
// known one the same way forgotPass stores it: hashed, with an expiry.
async function plantResetToken(user: TestUser, expiresInMs = 15 * 60 * 1000): Promise<string> {
  const token = randomBytes(32).toString("hex");
  await db("users")
    .where({ id: user.id })
    .update({
      resetToken: hashToken(token),
      resetExpires: new Date(Date.now() + expiresInMs).toISOString(),
    });
  return token;
}

const forgot = (email: string) =>
  app.inject({
    method: "POST",
    url: "/api/forgot",
    headers: { "x-forwarded-for": freshIp() },
    payload: { email },
  });

const reset = (resetToken: string, newPassword: string) =>
  app.inject({
    method: "POST",
    url: "/api/reset-password",
    headers: { "x-forwarded-for": freshIp() },
    payload: { resetToken, newPassword },
  });

const login = (username: string, password: string) =>
  app.inject({
    method: "POST",
    url: "/api/login",
    headers: { "x-forwarded-for": freshIp() },
    payload: { username, password },
  });

test("forgot password answers the same whether or not the account exists", async () => {
  const user = await registerUser(app, "forgot");
  const known = await forgot(user.email);
  const unknown = await forgot(`${uniqueName("nobody")}@example.test`);

  assert.equal(known.statusCode, 200);
  assert.equal(unknown.statusCode, 200);
  assert.deepEqual(known.json(), unknown.json());
});

test("forgot password stores only a hash of the token, with a short expiry", async () => {
  const user = await registerUser(app, "hash");
  await forgot(user.email.toUpperCase());

  const row = await db("users").select("resetToken", "resetExpires").where({ id: user.id }).first();
  assert.match(row.resetToken, /^[0-9a-f]{64}$/);
  const minutesLeft = (new Date(row.resetExpires).getTime() - Date.now()) / 60000;
  assert.ok(minutesLeft > 14 && minutesLeft <= 15, `expiry in ${minutesLeft} min`);
});

test("in production a failed reset email never logs the reset link", async () => {
  const user = await registerUser(app, "nolog");
  const warnings: string[] = [];
  const originalWarn = console.warn;
  const originalEnv = process.env.NODE_ENV;
  console.warn = (...args: unknown[]) => warnings.push(args.map(String).join(" "));
  process.env.NODE_ENV = "production";
  try {
    // SMTP is unset in tests, so sending fails and the fallback path runs.
    assert.equal((await forgot(user.email)).statusCode, 200);
  } finally {
    console.warn = originalWarn;
    process.env.NODE_ENV = originalEnv;
  }

  assert.ok(warnings.length > 0, "the failure is still reported");
  assert.ok(
    warnings.every((line) => !/reset-password\?token=/.test(line)),
    `reset link leaked: ${warnings.join(" | ")}`,
  );
});

test("a valid reset token changes the password and ends existing sessions", async () => {
  const user = await registerUser(app, "rst");
  const token = await plantResetToken(user);
  const newPassword = `new-${randomBytes(6).toString("hex")}`;

  assert.equal((await reset(token, newPassword)).statusCode, 200);

  assert.equal((await login(user.username, user.password)).statusCode, 401);
  assert.equal((await login(user.username, newPassword)).statusCode, 200);

  const refresh = await app.inject({
    method: "POST",
    url: "/api/token/refresh",
    payload: { refreshToken: user.refreshToken },
  });
  assert.equal(refresh.statusCode, 401, "sessions from before the reset are revoked");
});

test("a reset token works only once", async () => {
  const user = await registerUser(app, "once");
  const token = await plantResetToken(user);
  assert.equal((await reset(token, "first-new-password")).statusCode, 200);
  assert.equal((await reset(token, "second-new-password")).statusCode, 400);
});

test("expired and unknown reset tokens are rejected", async () => {
  const user = await registerUser(app, "expired");
  const token = await plantResetToken(user, -1000);

  const expired = await reset(token, "another-password");
  assert.equal(expired.statusCode, 400);
  assert.match(expired.json().error, /expired/i);
  const row = await db("users").select("resetToken").where({ id: user.id }).first();
  assert.equal(row.resetToken, null, "stale token is cleared");
  assert.equal((await login(user.username, user.password)).statusCode, 200);

  assert.equal((await reset(randomBytes(32).toString("hex"), "another-password")).statusCode, 400);
});

test("reset enforces the minimum password length", async () => {
  const user = await registerUser(app, "short");
  const token = await plantResetToken(user);
  assert.equal((await reset(token, "short")).statusCode, 400);
  assert.equal((await login(user.username, user.password)).statusCode, 200);
});
