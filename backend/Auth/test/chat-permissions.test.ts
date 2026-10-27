import test from "node:test";
import assert from "node:assert/strict";

import { authHeaders, createTestApp, registerUser, uniqueName, type TestUser } from "./helpers/app.ts";

const app = await createTestApp();
test.after(() => app.close());

type Call = { status: number; body: any };

async function call(
  user: TestUser | null,
  method: "GET" | "POST" | "PATCH" | "DELETE",
  url: string,
  payload?: Record<string, unknown>,
): Promise<Call> {
  const res = await app.inject({
    method,
    url,
    headers: user ? authHeaders(user) : {},
    ...(payload ? { payload } : {}),
  });
  let body: any = null;
  try {
    body = res.json();
  } catch {
    body = res.body;
  }
  return { status: res.statusCode, body };
}

async function createGroup(owner: TestUser, visibility: "public" | "protected" | "private", password?: string) {
  const res = await call(owner, "POST", "/api/groups", {
    name: uniqueName(`g_${visibility}`),
    visibility,
    ...(password ? { password } : {}),
  });
  assert.ok(res.status < 300, `create group: ${res.status} ${JSON.stringify(res.body)}`);
  return Number(res.body.id_group);
}

const send = (user: TestUser, groupId: number, messagem = "hello") =>
  call(user, "POST", `/api/groups/${groupId}/messages`, { messagem });

// Successful writes answer 200 or 201 depending on the route.
const OK = "ok";
const outcome = (res: Call) => (res.status >= 200 && res.status < 300 ? OK : res.status);

test("chat routes require authentication", async () => {
  assert.equal((await call(null, "GET", "/api/groups")).status, 401);
  assert.equal((await call(null, "POST", "/api/groups", { name: "x", visibility: "public" })).status, 401);
});

test("non-members cannot read or post in a channel", async () => {
  const owner = await registerUser(app, "own");
  const outsider = await registerUser(app, "out");
  const groupId = await createGroup(owner, "public");
  await send(owner, groupId, "members only");

  const read = await call(outsider, "GET", `/api/groups/${groupId}/messages`);
  assert.equal(read.status, 400);
  assert.equal(read.body.error, "Not a group member");
  assert.equal((await send(outsider, groupId)).status, 400);
  assert.equal((await call(outsider, "GET", `/api/groups/${groupId}/members`)).status, 400);

  assert.equal(outcome(await call(outsider, "POST", `/api/groups/${groupId}/join`)), OK);
  assert.equal(outcome(await send(outsider, groupId)), OK);
});

test("protected channels need the password, private ones an invitation", async () => {
  const owner = await registerUser(app, "own");
  const guest = await registerUser(app, "guest");

  const protectedId = await createGroup(owner, "protected", "s3cret-pass");
  const wrong = await call(guest, "POST", `/api/groups/${protectedId}/join`, { password: "nope" });
  assert.equal(wrong.status, 400);
  assert.equal(wrong.body.error, "Invalid channel password");
  assert.equal((await call(guest, "POST", `/api/groups/${protectedId}/join`)).status, 400);
  assert.equal(
    (await call(guest, "POST", `/api/groups/${protectedId}/join`, { password: "s3cret-pass" })).status,
    200,
  );

  const privateId = await createGroup(owner, "private");
  const refused = await call(guest, "POST", `/api/groups/${privateId}/join`);
  assert.equal(refused.status, 400);
  assert.equal(refused.body.error, "Private channel requires an invitation");
});

test("only owner/admins can invite to private channels", async () => {
  const owner = await registerUser(app, "own");
  const member = await registerUser(app, "mem");
  const target = await registerUser(app, "tgt");
  const groupId = await createGroup(owner, "private");

  assert.equal(outcome(await call(owner, "POST", `/api/groups/${groupId}/invite`, { username: member.username })), OK);
  const byMember = await call(member, "POST", `/api/groups/${groupId}/invite`, { username: target.username });
  assert.equal(byMember.status, 400);
  assert.equal(byMember.body.error, "Only owner/admin can invite");

  assert.equal(outcome(await send(member, groupId)), OK, "invited member can post");
});

test("plain members cannot moderate", async () => {
  const owner = await registerUser(app, "own");
  const a = await registerUser(app, "a");
  const b = await registerUser(app, "b");
  const groupId = await createGroup(owner, "public");
  await call(a, "POST", `/api/groups/${groupId}/join`);
  await call(b, "POST", `/api/groups/${groupId}/join`);

  for (const [method, url, payload] of [
    ["POST", `/api/groups/${groupId}/ban/${b.id}`, undefined],
    ["POST", `/api/groups/${groupId}/kick/${b.id}`, undefined],
    ["POST", `/api/groups/${groupId}/mute/${b.id}`, { seconds: 60 }],
    ["POST", `/api/groups/${groupId}/admins/${b.id}`, { enabled: true }],
    ["PATCH", `/api/groups/${groupId}/password`, { visibility: "protected", password: "x" }],
  ] as const) {
    const res = await call(a, method, url, payload as Record<string, unknown> | undefined);
    assert.equal(res.status, 400, `${method} ${url} should be refused`);
  }

  assert.equal(outcome(await send(b, groupId)), OK, "b is untouched");
});

test("admins can mute, unmute, kick and ban members", async () => {
  const owner = await registerUser(app, "own");
  const admin = await registerUser(app, "adm");
  const member = await registerUser(app, "mem");
  const groupId = await createGroup(owner, "public");
  await call(admin, "POST", `/api/groups/${groupId}/join`);
  await call(member, "POST", `/api/groups/${groupId}/join`);
  assert.equal(outcome(await call(owner, "POST", `/api/groups/${groupId}/admins/${admin.id}`, { enabled: true })), OK);

  assert.equal(outcome(await call(admin, "POST", `/api/groups/${groupId}/mute/${member.id}`, { seconds: 60 })), OK);
  const muted = await send(member, groupId);
  assert.equal(muted.status, 400);
  assert.equal(muted.body.error, "User is muted in this channel");
  assert.equal(outcome(await call(admin, "POST", `/api/groups/${groupId}/unmute/${member.id}`)), OK);
  assert.equal(outcome(await send(member, groupId)), OK);

  assert.equal(outcome(await call(admin, "POST", `/api/groups/${groupId}/kick/${member.id}`)), OK);
  assert.equal((await send(member, groupId)).status, 400, "kicked member is out");
  assert.equal(outcome(await call(member, "POST", `/api/groups/${groupId}/join`)), OK, "kick is not a ban");

  assert.equal(outcome(await call(admin, "POST", `/api/groups/${groupId}/ban/${member.id}`)), OK);
  const rejoin = await call(member, "POST", `/api/groups/${groupId}/join`);
  assert.equal(rejoin.status, 400);
  assert.equal(rejoin.body.error, "User is banned from this channel");
});

test("banned users cannot be invited back into a private channel", async () => {
  const owner = await registerUser(app, "own");
  const member = await registerUser(app, "mem");
  const groupId = await createGroup(owner, "private");
  await call(owner, "POST", `/api/groups/${groupId}/invite`, { username: member.username });
  await call(owner, "POST", `/api/groups/${groupId}/ban/${member.id}`);

  const invite = await call(owner, "POST", `/api/groups/${groupId}/invite`, { username: member.username });
  assert.equal(invite.status, 400);
});

test("the channel owner cannot be kicked, banned or muted by an admin", async () => {
  const owner = await registerUser(app, "own");
  const admin = await registerUser(app, "adm");
  const groupId = await createGroup(owner, "public");
  await call(admin, "POST", `/api/groups/${groupId}/join`);
  await call(owner, "POST", `/api/groups/${groupId}/admins/${admin.id}`, { enabled: true });

  assert.equal((await call(admin, "POST", `/api/groups/${groupId}/kick/${owner.id}`)).status, 400);
  assert.equal((await call(admin, "POST", `/api/groups/${groupId}/ban/${owner.id}`)).status, 400);
  assert.equal((await call(admin, "POST", `/api/groups/${groupId}/mute/${owner.id}`, { seconds: 60 })).status, 400);

  assert.equal(outcome(await send(owner, groupId)), OK, "owner keeps full access");
  assert.equal((await call(owner, "GET", `/api/groups/${groupId}/role`)).body.role, "owner");
});

test("the owner cannot leave without transferring ownership", async () => {
  const owner = await registerUser(app, "own");
  const groupId = await createGroup(owner, "public");
  const res = await call(owner, "POST", `/api/groups/${groupId}/leave`);
  assert.equal(res.status, 400);
});

test("channel names are unique, case-insensitively", async () => {
  const owner = await registerUser(app, "own");
  const name = uniqueName("Dup");
  assert.ok((await call(owner, "POST", "/api/groups", { name, visibility: "public" })).status < 300);
  const again = await call(owner, "POST", "/api/groups", { name: name.toUpperCase(), visibility: "public" });
  assert.equal(again.status, 400);
});

test("private chats are only visible to their two participants", async () => {
  const alice = await registerUser(app, "alice");
  const bob = await registerUser(app, "bob");
  const eve = await registerUser(app, "eve");

  const chat = await call(alice, "POST", "/api/private", { targetId: bob.id });
  assert.ok(chat.status < 300);
  const chatId = chat.body.id_privatechat;

  assert.equal(outcome(await call(alice, "POST", `/api/private/${chatId}/messages`, { messagem: "hi bob" })), OK);
  const bobReads = await call(bob, "GET", `/api/private/${chatId}/messages`);
  assert.equal(bobReads.status, 200);
  assert.equal(bobReads.body[0].messagem, "hi bob");

  assert.equal((await call(eve, "GET", `/api/private/${chatId}/messages`)).status, 400);
  assert.equal((await call(eve, "POST", `/api/private/${chatId}/messages`, { messagem: "x" })).status, 400);
  assert.equal((await call(alice, "POST", "/api/private", { targetId: alice.id })).status, 400);
});

test("blocking hides the blocked user's messages from the blocker", async () => {
  const alice = await registerUser(app, "alice");
  const bob = await registerUser(app, "bob");
  const chatId = (await call(alice, "POST", "/api/private", { targetId: bob.id })).body.id_privatechat;
  await call(bob, "POST", `/api/private/${chatId}/messages`, { messagem: "before block" });

  assert.equal(outcome(await call(alice, "POST", `/api/blocks/${bob.id}`)), OK);
  assert.equal((await call(alice, "GET", `/api/private/${chatId}/messages`)).body.length, 0);

  assert.equal(outcome(await call(alice, "DELETE", `/api/blocks/${bob.id}`)), OK);
  assert.equal((await call(alice, "GET", `/api/private/${chatId}/messages`)).body.length, 1);
  assert.equal((await call(alice, "POST", `/api/blocks/${alice.id}`)).status, 400, "cannot block yourself");
});
