import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";

import {
  authHeaders,
  createTestApp,
  freshIp,
  registerUser,
  uniqueName,
} from "./helpers/app.ts";
import { verifyAccessToken } from "../src/utils/tokens.ts";

const app = await createTestApp();
test.after(() => app.close());

const login = (username: string, password: string, ip = freshIp()) =>
  app.inject({
    method: "POST",
    url: "/api/login",
    headers: { "x-forwarded-for": ip },
    payload: { username, password },
  });

test("register returns a usable session", async () => {
  const user = await registerUser(app, "reg");
  assert.equal(verifyAccessToken(user.token).userId, user.id);
  assert.match(user.refreshToken, /^[0-9a-f]{128}$/);
});

test("register rejects duplicates, unsafe usernames and missing consent", async () => {
  const user = await registerUser(app, "dup");
  const attempt = (payload: Record<string, unknown>) =>
    app.inject({
      method: "POST",
      url: "/api/register",
      headers: { "x-forwarded-for": freshIp() },
      payload: { password: "password123", acceptTerms: true, ...payload },
    });

  const sameName = await attempt({ username: user.username, email: `${uniqueName("o")}@example.test` });
  assert.equal(sameName.statusCode, 409);
  const sameEmail = await attempt({ username: uniqueName("other"), email: user.email });
  assert.equal(sameEmail.statusCode, 409);

  const html = await attempt({ username: "<svg onload=x>", email: `${uniqueName("h")}@example.test` });
  assert.equal(html.statusCode, 400);

  const noConsent = await attempt({
    username: uniqueName("nc"),
    email: `${uniqueName("nc")}@example.test`,
    acceptTerms: false,
  });
  assert.equal(noConsent.statusCode, 400);
});

test("login succeeds with the right password and issues a valid token", async () => {
  const user = await registerUser(app, "login");
  const res = await login(user.username, user.password);
  assert.equal(res.statusCode, 200);
  const { token, refreshToken } = res.json().data;
  assert.equal(verifyAccessToken(token).userId, user.id);
  assert.ok(refreshToken);
});

test("wrong password and unknown user get the same answer", async () => {
  const user = await registerUser(app, "enum");
  const wrong = await login(user.username, "definitely-wrong");
  const unknown = await login(uniqueName("ghost"), "definitely-wrong");

  assert.equal(wrong.statusCode, 401);
  assert.equal(unknown.statusCode, 401);
  assert.equal(wrong.json().error, unknown.json().error);
});

test("malformed login input is a 400, not a 401", async () => {
  const res = await login("ab", "short");
  assert.equal(res.statusCode, 400);
});

test("failed logins are rate limited per account, across IPs", async () => {
  const user = await registerUser(app, "brute");
  for (let i = 0; i < 10; i++) {
    assert.equal((await login(user.username, "wrong-password")).statusCode, 401);
  }

  const blocked = await login(user.username, "wrong-password");
  assert.equal(blocked.statusCode, 429);
  assert.ok(Number(blocked.headers["retry-after"]) > 0);

  // Even the right password waits until the window ends.
  assert.equal((await login(user.username, user.password)).statusCode, 429);
});

test("a successful login resets the per-account failure count", async () => {
  const user = await registerUser(app, "reset");
  for (let i = 0; i < 6; i++) await login(user.username, "wrong-password");
  assert.equal((await login(user.username, user.password)).statusCode, 200);

  for (let i = 0; i < 9; i++) {
    assert.equal((await login(user.username, "wrong-password")).statusCode, 401);
  }
});

test("protected routes reject missing and purpose-scoped tokens", async () => {
  const user = await registerUser(app, "scope");

  const none = await app.inject({ method: "GET", url: "/api/games/me" });
  assert.equal(none.statusCode, 401);

  const spacedOut = jwt.sign(
    { userId: user.id, purpose: "spacedout-session" },
    process.env.JWT_SECRET as string,
  );
  const scoped = await app.inject({
    method: "GET",
    url: "/api/games/me",
    headers: { authorization: `Bearer ${spacedOut}` },
  });
  assert.equal(scoped.statusCode, 401);

  const ok = await app.inject({ method: "GET", url: "/api/games/me", headers: authHeaders(user) });
  assert.notEqual(ok.statusCode, 401);
});

test("logout revokes the refresh token", async () => {
  const user = await registerUser(app, "logout");
  const out = await app.inject({ method: "POST", url: "/api/logout", headers: authHeaders(user) });
  assert.equal(out.statusCode, 200);

  const refresh = await app.inject({
    method: "POST",
    url: "/api/token/refresh",
    payload: { refreshToken: user.refreshToken },
  });
  assert.equal(refresh.statusCode, 401);
});
