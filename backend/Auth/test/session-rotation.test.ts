import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { ensureSchema, uniqueName } from "./helpers/app.ts";

const { default: db } = await import("../src/db.ts");
const { issueSession, rotateSession, REFRESH_ROTATION_GRACE_MS } = await import(
  "../src/services/session.ts"
);
const { verifyAccessToken } = await import("../src/utils/tokens.ts");

// Uses the real schema shared with the other test files (never drop tables
// here: they all run in the same process against the same database).
await ensureSchema();
const username = uniqueName("alice");
const user = { id: randomUUID(), username, email: `${username}@example.test` };
await db("users").insert({ id: user.id, username: user.username, email: user.email });

test("rotation issues a new refresh token and a valid access token", async () => {
  const { refreshToken } = await issueSession(user);
  const result = await rotateSession(refreshToken);

  assert.equal(result.status, "rotated");
  if (result.status !== "rotated") return;
  assert.notEqual(result.refreshToken, refreshToken);
  assert.equal(verifyAccessToken(result.token).userId, user.id);

  const next = await rotateSession(result.refreshToken);
  assert.equal(next.status, "rotated");
});

test("the previous token still works within the grace period", async () => {
  const { refreshToken } = await issueSession(user);
  const first = await rotateSession(refreshToken);
  assert.equal(first.status, "rotated");

  const racing = await rotateSession(refreshToken);
  assert.equal(racing.status, "grace");
  if (racing.status === "grace") {
    assert.equal(verifyAccessToken(racing.token).userId, user.id);
  }
});

test("reusing a rotated token after the grace period revokes the session", async () => {
  const { refreshToken } = await issueSession(user);
  const first = await rotateSession(refreshToken);
  assert.equal(first.status, "rotated");

  const longAgo = new Date(Date.now() - REFRESH_ROTATION_GRACE_MS - 1000).toISOString();
  await db("refresh_tokens").where({ userId: user.id }).update({ rotated_at: longAgo });

  assert.equal((await rotateSession(refreshToken)).status, "invalid");
  // The whole session is gone, including the token issued by the rotation.
  if (first.status === "rotated") {
    assert.equal((await rotateSession(first.refreshToken)).status, "invalid");
  }
});

test("expired and unknown tokens are rejected", async () => {
  const { refreshToken } = await issueSession(user);
  await db("refresh_tokens")
    .where({ userId: user.id })
    .update({ expires_at: new Date(Date.now() - 1000).toISOString() });

  assert.equal((await rotateSession(refreshToken)).status, "invalid");
  assert.equal((await rotateSession("not-a-real-token")).status, "invalid");
});

test("logging in again resets rotation state", async () => {
  const { refreshToken } = await issueSession(user);
  await rotateSession(refreshToken);
  await issueSession(user);

  // The pre-login token is neither current nor a recent previous token.
  assert.equal((await rotateSession(refreshToken)).status, "invalid");
});
