import test from "node:test";
import assert from "node:assert/strict";

import { authHeaders, createTestApp, registerUser, uniqueName } from "./helpers/app.ts";

const app = await createTestApp();
test.after(() => app.close());

test("/me returns the profile of the token's user", async () => {
  const user = await registerUser(app, "me");
  const res = await app.inject({ method: "GET", url: "/api/me", headers: authHeaders(user) });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.id, user.id);
  assert.equal(body.username, user.username);
  assert.equal(body.twoFactorEnabled, false);

  assert.equal((await app.inject({ method: "GET", url: "/api/me" })).statusCode, 401);
});

test("username updates validate format and uniqueness", async () => {
  const user = await registerUser(app, "rename");
  const other = await registerUser(app, "taken");
  const rename = (username: string) =>
    app.inject({ method: "PATCH", url: "/api/users/username", headers: authHeaders(user), payload: { username } });

  assert.equal((await rename("<b>x</b>")).statusCode, 400);
  assert.equal((await rename("ab")).statusCode, 400);
  assert.equal((await rename(other.username.toUpperCase())).statusCode, 409);

  const fresh = uniqueName("renamed");
  const ok = await rename(fresh);
  assert.equal(ok.statusCode, 200);
  const me = await app.inject({ method: "GET", url: "/api/me", headers: authHeaders(user) });
  assert.equal(me.json().username, fresh);
});

test("stats and match history are readable for a new user", async () => {
  const user = await registerUser(app, "stats");
  const stats = await app.inject({ method: "GET", url: `/api/users/${user.id}/stats`, headers: authHeaders(user) });
  assert.equal(stats.statusCode, 200);
  assert.equal(stats.json().total_matches, 0);

  const matches = await app.inject({ method: "GET", url: `/api/users/${user.id}/matches`, headers: authHeaders(user) });
  assert.equal(matches.statusCode, 200);
  assert.deepEqual(matches.json(), []);
});

test("friend requests can be sent, accepted, listed and removed", async () => {
  const alice = await registerUser(app, "alice");
  const bob = await registerUser(app, "bob");

  const sent = await app.inject({
    method: "POST",
    url: "/api/friends/requests",
    headers: authHeaders(alice),
    payload: { username: bob.username },
  });
  assert.equal(sent.statusCode, 200);
  const again = await app.inject({
    method: "POST",
    url: "/api/friends/requests",
    headers: authHeaders(alice),
    payload: { username: bob.username },
  });
  assert.equal(again.statusCode, 409);

  const incoming = await app.inject({ method: "GET", url: "/api/friends/requests/incoming", headers: authHeaders(bob) });
  assert.equal(incoming.statusCode, 200);
  const request = incoming.json().find((r: any) => r.requesterId === alice.id);
  assert.ok(request, "bob sees alice's request");

  // Only the target can accept.
  const wrongAccept = await app.inject({
    method: "POST",
    url: `/api/friends/requests/${request.id}/accept`,
    headers: authHeaders(alice),
  });
  assert.equal(wrongAccept.statusCode, 404);

  const accept = await app.inject({
    method: "POST",
    url: `/api/friends/requests/${request.id}/accept`,
    headers: authHeaders(bob),
  });
  assert.equal(accept.statusCode, 200);

  const friends = await app.inject({ method: "GET", url: `/api/users/${alice.id}/friends`, headers: authHeaders(alice) });
  assert.deepEqual(friends.json().map((f: any) => f.id), [bob.id]);

  const remove = await app.inject({
    method: "POST",
    url: "/api/friends/remove",
    headers: authHeaders(bob),
    payload: { friendId: alice.id },
  });
  assert.equal(remove.statusCode, 200);
  const after = await app.inject({ method: "GET", url: `/api/users/${alice.id}/friends`, headers: authHeaders(alice) });
  assert.deepEqual(after.json(), []);
});

test("a crossed friend request is accepted automatically", async () => {
  const alice = await registerUser(app, "alice");
  const bob = await registerUser(app, "bob");
  await app.inject({
    method: "POST",
    url: "/api/friends/requests",
    headers: authHeaders(alice),
    payload: { username: bob.username },
  });
  const crossed = await app.inject({
    method: "POST",
    url: "/api/friends/requests",
    headers: authHeaders(bob),
    payload: { username: alice.username },
  });
  assert.equal(crossed.statusCode, 200);
  assert.equal(crossed.json().autoAccepted, true);
});

test("friend routes reject bad input and missing auth", async () => {
  const alice = await registerUser(app, "alice");
  const self = await app.inject({
    method: "POST",
    url: "/api/friends/requests",
    headers: authHeaders(alice),
    payload: { username: alice.username },
  });
  assert.equal(self.statusCode, 400);

  const ghost = await app.inject({
    method: "POST",
    url: "/api/friends/requests",
    headers: authHeaders(alice),
    payload: { username: uniqueName("ghost") },
  });
  assert.equal(ghost.statusCode, 404);

  const anon = await app.inject({ method: "GET", url: "/api/friends/requests/incoming" });
  assert.equal(anon.statusCode, 401);
});
