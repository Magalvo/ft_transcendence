import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { authHeaders, createTestApp, registerUser, uniqueName } from "./helpers/app.ts";
import db from "../src/db.ts";

const app = await createTestApp();
test.after(() => app.close());

test("foreign keys are enforced on the app's connections", async () => {
  const [row] = await db.raw("PRAGMA foreign_keys");
  assert.equal(row.foreign_keys, 1);

  await assert.rejects(
    db("refresh_tokens").insert({
      username: "ghost",
      userId: randomUUID(),
      token: "x",
      expires_at: new Date().toISOString(),
      last_update: new Date().toISOString(),
    }),
    /FOREIGN KEY/,
  );
});

test("referencing a user that does not exist is a 400, and nothing is stored", async () => {
  const user = await registerUser(app, "fkref");
  const ghost = randomUUID();

  const block = await app.inject({ method: "POST", url: `/api/blocks/${ghost}`, headers: authHeaders(user) });
  assert.equal(block.statusCode, 400);
  assert.equal(block.json().error, "Referenced record does not exist");
  assert.equal(await db("blocked_users").where({ blocked_id: ghost }).first(), undefined);

  const dm = await app.inject({
    method: "POST",
    url: "/api/private",
    headers: authHeaders(user),
    payload: { targetId: ghost },
  });
  assert.equal(dm.statusCode, 400);

  const group = await app.inject({
    method: "POST",
    url: "/api/groups",
    headers: authHeaders(user),
    payload: { name: uniqueName("fk"), visibility: "public" },
  });
  const groupId = group.json().id_group;
  const ban = await app.inject({
    method: "POST",
    url: `/api/groups/${groupId}/ban/${ghost}`,
    headers: authHeaders(user),
  });
  assert.equal(ban.statusCode, 400);
});

test("tournaments need registered players and are created atomically", async () => {
  const players = await Promise.all([1, 2, 3, 4].map((i) => registerUser(app, `fkcup${i}`)));
  const creator = players[0];
  const create = (playerIds: string[]) =>
    app.inject({
      method: "POST",
      url: "/api/tournaments",
      headers: authHeaders(creator),
      payload: { name: uniqueName("cup"), player_ids: playerIds },
    });

  const before = Number((await db("tournaments").count({ n: "*" }).first())?.n);
  const invalid = await create([creator.id, players[1].id, players[2].id, randomUUID()]);
  assert.equal(invalid.statusCode, 400);
  assert.match(invalid.json().error, /registered users/);
  const after = Number((await db("tournaments").count({ n: "*" }).first())?.n);
  assert.equal(after, before, "no half-created tournament");

  const ok = await create(players.map((p) => p.id));
  // The route sets 201 but sendSuccess always answers 200 (existing API).
  assert.equal(ok.statusCode, 200);
  const tournamentId = ok.json().data.tournamentId;
  const participants = await db("tournament_participants").where({ tournament_id: tournamentId });
  assert.equal(participants.length, 4);

  // The final has no players yet: NULL placeholders satisfy the foreign key.
  const final = await db("tournament_matches").where({ tournament_id: tournamentId, round: 2 }).first();
  assert.equal(final.player1_id, null);
  assert.equal(final.player2_id, null);
});

test("deleting a user cascades to the rows that belong to them", async () => {
  const alice = await registerUser(app, "fkalice");
  const bob = await registerUser(app, "fkbob");
  await app.inject({
    method: "POST",
    url: "/api/friends/requests",
    headers: authHeaders(alice),
    payload: { username: bob.username },
  });
  await app.inject({
    method: "POST",
    url: "/api/friends/requests",
    headers: authHeaders(bob),
    payload: { username: alice.username },
  });
  assert.ok(await db("refresh_tokens").where({ userId: alice.id }).first());
  assert.ok(await db("friendships").where({ user_a: [alice.id, bob.id].sort()[0] }).first());

  await db("users").where({ id: alice.id }).delete();

  assert.equal(await db("refresh_tokens").where({ userId: alice.id }).first(), undefined);
  assert.equal(
    await db("friendships").where({ user_a: alice.id }).orWhere({ user_b: alice.id }).first(),
    undefined,
  );
  assert.ok(await db("users").where({ id: bob.id }).first(), "other users are untouched");
});
