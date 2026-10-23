import test from "node:test";
import assert from "node:assert/strict";

const { default: db } = await import("../src/db.ts");
const { issueSession, rotateSession, REFRESH_ROTATION_GRACE_MS } = await import(
  "../src/services/session.ts"
);
const { verifyAccessToken } = await import("../src/utils/tokens.ts");

await db.schema.dropTableIfExists("refresh_tokens");
await db.schema.dropTableIfExists("users");
await db.schema.createTable("users", (table) => {
  table.uuid("id").primary();
  table.string("username");
  table.string("email");
  table.boolean("online");
  table.string("last_request");
});
await db.schema.createTable("refresh_tokens", (table) => {
  table.increments("id").primary();
  table.string("username").notNullable();
  table.uuid("userId").notNullable();
  table.string("token").notNullable();
  table.dateTime("expires_at").notNullable();
  table.dateTime("last_update").notNullable();
  table.string("previous_token").nullable();
  table.dateTime("rotated_at").nullable();
});

const user = { id: "11111111-1111-1111-1111-111111111111", username: "alice", email: "a@ex.com" };
await db("users").insert({ id: user.id, username: user.username, email: user.email });

test.after(async () => {
  await db.destroy();
});

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
