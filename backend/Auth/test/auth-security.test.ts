import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";

process.env.JWT_SECRET = "test-secret";

const {
  readBearerToken,
  signAccessToken,
  signTwoFactorPendingToken,
  verifyAccessToken,
  verifyTwoFactorPendingToken,
  hashToken,
} = await import("../src/utils/tokens.ts");
const { createRateLimiter } = await import("../src/utils/rateLimit.ts");
const { detectImageExtension } = await import("../src/utils/image.ts");

test("verifyAccessToken accepts access tokens", () => {
  const token = signAccessToken("u1", "u1@example.com");
  assert.deepEqual(verifyAccessToken(token), {
    userId: "u1",
    email: "u1@example.com",
  });
});

test("verifyAccessToken rejects tokens minted for another purpose", () => {
  const spacedOut = jwt.sign(
    { userId: "u1", purpose: "spacedout-session" },
    "test-secret",
  );
  assert.throws(() => verifyAccessToken(spacedOut));
  assert.throws(() => verifyAccessToken(signTwoFactorPendingToken("u1")));
});

test("verifyAccessToken rejects tokens signed with another secret", () => {
  const forged = jwt.sign({ userId: "u1" }, "other-secret");
  assert.throws(() => verifyAccessToken(forged));
});

test("2FA pending tokens only verify as 2FA pending tokens", () => {
  assert.equal(verifyTwoFactorPendingToken(signTwoFactorPendingToken("u2")), "u2");
  assert.throws(() => verifyTwoFactorPendingToken(signAccessToken("u2")));
});

test("readBearerToken strips the scheme and ignores empty values", () => {
  assert.equal(readBearerToken("Bearer abc"), "abc");
  assert.equal(readBearerToken("bearer   abc "), "abc");
  assert.equal(readBearerToken("Bearer "), undefined);
  assert.equal(readBearerToken(undefined), undefined);
});

test("hashToken is deterministic and does not echo the input", () => {
  assert.equal(hashToken("abc"), hashToken("abc"));
  assert.notEqual(hashToken("abc"), "abc");
  assert.match(hashToken("abc"), /^[0-9a-f]{64}$/);
});

test("rate limiter blocks after max hits and can be reset", () => {
  const limiter = createRateLimiter({ windowMs: 60_000, max: 2 });
  assert.equal(limiter.hit("k").allowed, true);
  assert.equal(limiter.hit("k").allowed, true);
  const blocked = limiter.hit("k");
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterSec >= 1);
  assert.equal(limiter.hit("other").allowed, true);

  limiter.reset("k");
  assert.equal(limiter.hit("k").allowed, true);
});

test("detectImageExtension trusts magic bytes, not names or MIME types", () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
  const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
  const gif = Buffer.from("GIF89a....", "latin1");
  const webp = Buffer.from("RIFF\x00\x00\x00\x00WEBPVP8 ", "latin1");

  assert.equal(detectImageExtension(png), "png");
  assert.equal(detectImageExtension(jpg), "jpg");
  assert.equal(detectImageExtension(gif), "gif");
  assert.equal(detectImageExtension(webp), "webp");
  assert.equal(detectImageExtension(Buffer.from("<script>alert(1)</script>")), null);
  assert.equal(detectImageExtension(Buffer.from("<svg onload=x>")), null);
  assert.equal(detectImageExtension(Buffer.alloc(0)), null);
});
