import test from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { io as connect, type Socket as ClientSocket } from "socket.io-client";

import { createTestApp, registerUser } from "./helpers/app.ts";
import { setupSocketIO } from "../src/socket/index.ts";

// Real Socket.IO server on an ephemeral port, driven by real clients.
const app = await createTestApp();
await app.listen({ port: 0, host: "127.0.0.1" });
const { io } = setupSocketIO(app.server);
app.io = io;
const url = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;

const clients: ClientSocket[] = [];
test.after(async () => {
  for (const client of clients) client.disconnect();
  await new Promise<void>((resolve) => io.close(() => resolve()));
  await app.close();
});

function client(token?: string): ClientSocket {
  const socket = connect(url, {
    transports: ["websocket"],
    forceNew: true,
    reconnection: false,
    auth: token ? { token } : {},
  });
  clients.push(socket);
  return socket;
}

function next<T = any>(socket: ClientSocket, event: string, timeoutMs = 3000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out waiting for "${event}"`)), timeoutMs);
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

async function connected(token: string): Promise<ClientSocket> {
  const socket = client(token);
  await next(socket, "connect");
  return socket;
}

async function lobbyList(socket: ClientSocket): Promise<any[]> {
  const list = next<any[]>(socket, "availableLobbies");
  socket.emit("requestAvailableLobbies");
  return list;
}

test("sockets without a valid token are rejected", async () => {
  const anonymous = client();
  const rejected = await next(anonymous, "authRejected");
  assert.equal(rejected.reason, "missing_or_invalid_token");

  const forged = client("not-a-jwt");
  assert.equal((await next(forged, "authRejected")).reason, "missing_or_invalid_token");
});

test("an authenticated socket cannot switch identity", async () => {
  const user = await registerUser(app, "sockid");
  const socket = await connected(user.token);
  const rejected = next(socket, "authRejected");
  socket.emit("userAuth", { userId: "someone-else" });
  assert.equal((await rejected).reason, "identity_mismatch");
});

test("lobbies can be created, listed and joined", async () => {
  const owner = await registerUser(app, "lobbyown");
  const guest = await registerUser(app, "lobbyguest");
  const ownerSocket = await connected(owner.token);
  const guestSocket = await connected(guest.token);

  const created = next(ownerSocket, "lobbyCreated");
  const joinedOwn = next(ownerSocket, "joinLobbySuccess");
  ownerSocket.emit("createLobby", { mode: "1v1", isPrivate: false });
  const { lobbyId } = await created;
  assert.match(lobbyId, /^[A-Za-z0-9_-]{12}$/, "random base64url lobby id");
  assert.equal((await joinedOwn).lobbyId, lobbyId);

  const listed = (await lobbyList(guestSocket)).find((l) => l.id === lobbyId);
  assert.ok(listed, "guest sees the new lobby");
  assert.equal(listed.mode, "1v1");
  assert.equal(listed.leader.id, owner.id);

  const joined = next(guestSocket, "joinLobbySuccess");
  guestSocket.emit("joinLobbyById", { lobbyId });
  assert.equal((await joined).lobbyId, lobbyId);
});

test("private lobbies need a code and unknown lobbies cannot be joined", async () => {
  const user = await registerUser(app, "lobbypriv");
  const socket = await connected(user.token);

  const noCode = next(socket, "joinLobbyError");
  socket.emit("createLobby", { mode: "1v1", isPrivate: true });
  assert.match((await noCode).message, /requires a valid code/);

  const unknown = next(socket, "joinLobbyError");
  socket.emit("joinLobbyById", { lobbyId: "does-not-exist" });
  assert.equal((await unknown).message, "Lobby not found");
});

test("a lobby disappears from the list when its only member disconnects", async () => {
  const owner = await registerUser(app, "lobbygone");
  const watcher = await registerUser(app, "lobbywatch");
  const ownerSocket = await connected(owner.token);
  const watcherSocket = await connected(watcher.token);

  const created = next(ownerSocket, "lobbyCreated");
  ownerSocket.emit("createLobby", { mode: "2v2", isPrivate: false });
  const { lobbyId } = await created;
  assert.ok((await lobbyList(watcherSocket)).some((l) => l.id === lobbyId));

  const changed = next(watcherSocket, "lobbyListChanged");
  ownerSocket.disconnect();
  await changed;
  assert.ok(!(await lobbyList(watcherSocket)).some((l) => l.id === lobbyId));
});

test("tournament events answer with client-safe errors", async () => {
  const user = await registerUser(app, "sockcup");
  const socket = await connected(user.token);

  const missing = next(socket, "error");
  socket.emit("requestTournamentMatch", {});
  assert.equal((await missing).message, "Missing tournament match context");

  // Expected failures from the invite service reach the client verbatim
  // (participation is checked first, so unknown tournaments reveal nothing).
  const outsider = next(socket, "error");
  socket.emit("requestTournamentMatch", { tournamentId: "nope", matchId: "nope" });
  assert.equal((await outsider).message, "Only tournament participants can send invites");
});
