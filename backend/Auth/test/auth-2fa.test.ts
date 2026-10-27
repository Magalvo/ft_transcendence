import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import speakeasy from "speakeasy";

import { authHeaders, createTestApp, freshIp, registerUser, type TestUser } from "./helpers/app.ts";
import { signAccessToken, signTwoFactorPendingToken, verifyAccessToken } from "../src/utils/tokens.ts";

const app = await createTestApp();
test.after(() => app.close());

const currentCode = (secret: string) => speakeasy.totp({ secret, encoding: "base32" });
// A code from an hour away is outside the verification window.
const staleCode = (secret: string) =>
  speakeasy.totp({ secret, encoding: "base32", time: Math.floor(Date.now() / 1000) - 3600 });

async function enableTwoFactor(user: TestUser): Promise<string> {
  const setup = await app.inject({ method: "POST", url: "/api/2fa/setup", headers: authHeaders(user) });
  assert.equal(setup.statusCode, 200);
  const { secret, qr } = setup.json().data;
  assert.match(qr, /^data:image\/png;base64,/);

  const verify = await app.inject({
    method: "POST",
    url: "/api/2fa/verify",
    headers: authHeaders(user),
    payload: { code: currentCode(secret) },
  });
  assert.equal(verify.statusCode, 200);
  return secret;
}

const login = (user: TestUser, twoFactorCode?: string) =>
  app.inject({
    method: "POST",
    url: "/api/login",
    headers: { "x-forwarded-for": freshIp() },
    payload: { username: user.username, password: user.password, ...(twoFactorCode ? { twoFactorCode } : {}) },
  });

test("2FA setup requires authentication", async () => {
  const res = await app.inject({ method: "POST", url: "/api/2fa/setup" });
  assert.equal(res.statusCode, 401);
});

test("2FA is only enabled after a valid code is confirmed", async () => {
  const user = await registerUser(app, "tfa");
  const setup = await app.inject({ method: "POST", url: "/api/2fa/setup", headers: authHeaders(user) });
  const { secret } = setup.json().data;

  const wrong = await app.inject({
    method: "POST",
    url: "/api/2fa/verify",
    headers: authHeaders(user),
    payload: { code: staleCode(secret) },
  });
  assert.equal(wrong.statusCode, 401);

  let me = await app.inject({ method: "GET", url: "/api/me", headers: authHeaders(user) });
  assert.equal(me.json().twoFactorEnabled, false);

  const right = await app.inject({
    method: "POST",
    url: "/api/2fa/verify",
    headers: authHeaders(user),
    payload: { code: currentCode(secret) },
  });
  assert.equal(right.statusCode, 200);

  me = await app.inject({ method: "GET", url: "/api/me", headers: authHeaders(user) });
  assert.equal(me.json().twoFactorEnabled, true);
});

test("login with 2FA requires a valid code", async () => {
  const user = await registerUser(app, "tfalogin");
  const secret = await enableTwoFactor(user);

  const missing = await login(user);
  assert.equal(missing.statusCode, 400);
  assert.match(missing.json().error, /2FA code required/);

  assert.equal((await login(user, staleCode(secret))).statusCode, 401);

  const ok = await login(user, currentCode(secret));
  assert.equal(ok.statusCode, 200);
  assert.equal(verifyAccessToken(ok.json().data.token).userId, user.id);
});

test("disabling 2FA requires a valid code", async () => {
  const user = await registerUser(app, "tfaoff");
  const secret = await enableTwoFactor(user);
  const disable = (code?: string) =>
    app.inject({
      method: "POST",
      url: "/api/2fa/disable",
      headers: authHeaders(user),
      payload: code ? { code } : {},
    });

  assert.equal((await disable()).statusCode, 401);
  assert.equal((await disable(staleCode(secret))).statusCode, 401);
  assert.equal((await login(user)).statusCode, 400, "2FA must still be on");

  assert.equal((await disable(currentCode(secret))).statusCode, 200);
  assert.equal((await login(user)).statusCode, 200, "no code needed once disabled");
});

test("2FA code attempts are rate limited per user", async () => {
  const user = await registerUser(app, "tfabrute");
  const setup = await app.inject({ method: "POST", url: "/api/2fa/setup", headers: authHeaders(user) });
  const { secret } = setup.json().data;
  const attempt = () =>
    app.inject({
      method: "POST",
      url: "/api/2fa/verify",
      headers: authHeaders(user),
      payload: { code: staleCode(secret) },
    });

  for (let i = 0; i < 5; i++) assert.equal((await attempt()).statusCode, 401);
  assert.equal((await attempt()).statusCode, 429);
});

test("Google login second step exchanges a pending token plus code for a session", async () => {
  const user = await registerUser(app, "tfagoogle");
  const secret = await enableTwoFactor(user);
  const exchange = (twoFactorToken: string, code: string) =>
    app.inject({ method: "POST", url: "/api/2fa/login", payload: { twoFactorToken, code } });

  // An access token is not a pending-2FA token.
  assert.equal((await exchange(signAccessToken(user.id), currentCode(secret))).statusCode, 401);

  const expired = jwt.sign(
    { userId: user.id, purpose: "2fa-pending", exp: Math.floor(Date.now() / 1000) - 10 },
    process.env.JWT_SECRET as string,
  );
  assert.equal((await exchange(expired, currentCode(secret))).statusCode, 401);

  const pending = signTwoFactorPendingToken(user.id);
  assert.equal((await exchange(pending, staleCode(secret))).statusCode, 401);

  const ok = await exchange(pending, currentCode(secret));
  assert.equal(ok.statusCode, 200);
  assert.equal(verifyAccessToken(ok.json().data.token).userId, user.id);
  assert.ok(ok.json().data.refreshToken);
});

test("a pending 2FA token cannot be used as an access token", async () => {
  const user = await registerUser(app, "tfapend");
  const res = await app.inject({
    method: "GET",
    url: "/api/me",
    headers: { authorization: `Bearer ${signTwoFactorPendingToken(user.id)}` },
  });
  assert.equal(res.statusCode, 401);
});
