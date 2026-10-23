const crypto = require("crypto");
const uWS = require("uWebSockets.js");
const combatEngine = require("bindings")("combat");

const port = Number(process.env.PORT) || 3000;
let nextPilotId = 1;
const players = {};

// ==========================================
// GAMEPLAY CONSTANTS (Previously Missing)
// ==========================================
const DEFAULT_HP = 100;
const FIRE_COOLDOWN_MS = 250;
const MAX_REWIND_MS = 200;
const LASER_MUZZLE_OFFSET = 3.0; // Pushes the raycast slightly forward of the ship center
const LASER_RANGE = 20000.0;
const SHIP_HIT_RADIUS = 15.0; // Hitbox
const SHOT_DAMAGE = 25;
const RESPAWN_DELAY_MS = 6000;
const TEAM_SPAWNS = {
  RED: { pos: { x: -8000, y: 5000, z: 70000 }, dir: { dx: 1, dy: 0.5, dz: -0.2 } },
  BLUE: { pos: { x: 8000, y: 5000, z: 70000 }, dir: { dx: -1, dy: 0.5, dz: -0.2 } }
};
const PLAYER_RESPAWN_POS = { x: 0, y: 0, z: 70000 };
const PLAYER_RESPAWN_DIR = { x: 0, y: 1, z: 0 };
const MISSILE_DAMAGE = 75;
const MISSILE_MAX_DISTANCE = 30000;
const MISSILE_HIT_RADIUS = 45;
const MISSILE_STEER_FACTOR = 0.04;
const MISSILE_ACCEL = 1.5;
const MISSILE_MAX_SPEED = 250;
const MISSILE_INITIAL_SPEED = 80;
const FLARE_DURATION_MS = 3000;
const TELEMETRY_FLOATS = 6;
const TELEMETRY_BYTES = TELEMETRY_FLOATS * Float32Array.BYTES_PER_ELEMENT;
const PING_INTERVAL_MS = 1000;
const MAX_VALID_RTT_MS = 5000;
const WORLD_RADIUS = 50000;
const TERRAIN_SCALE_Z = 4;
const TERRAIN_CLEARANCE_BIAS = -5;
const BOT_MIN_TERRAIN_CLEARANCE = 120;
const DEFAULT_MATCH_SETTINGS = {
  gameMode: "ARCADE",
  botsEnabled: true,
};

// Server-authoritative terrain params used by bot terrain collision.
let TERRAIN_SEED = 44897;
let TERRAIN_NOISE_SCALE = 4.0;
let TERRAIN_HEIGHT_AMPLITUDE = 2000;
let TERRAIN_NOISE_OCTAVES = 4;
let TERRAIN_PERSISTENCE = 0.2;
let TERRAIN_LACUNARITY = 2.5;

// Math Helper
function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function normalizeGameMode(value) {
  return String(value || "").toUpperCase() === "PVP" ? "PVP" : "ARCADE";
}

function sanitizeMatchSettings(raw) {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_MATCH_SETTINGS };
  }

  const gameMode = normalizeGameMode(raw.gameMode);
  return {
    gameMode,
    botsEnabled: gameMode === "ARCADE" && raw.botsEnabled !== false,
  };
}

function base64UrlDecode(value) {
  const normalized = String(value || "")
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const padding = normalized.length % 4;
  const padded =
    padding === 0 ? normalized : normalized + "=".repeat(4 - padding);
  return Buffer.from(padded, "base64").toString("utf8");
}

function verifySpacedOutSessionToken(token) {
  const secret = process.env.JWT_SECRET;
  if (!secret || !token || typeof token !== "string") {
    return null;
  }

  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }

  const [headerPart, payloadPart, signaturePart] = parts;

  let header;
  let payload;
  try {
    header = JSON.parse(base64UrlDecode(headerPart));
    payload = JSON.parse(base64UrlDecode(payloadPart));
  } catch {
    return null;
  }

  if (header.alg !== "HS256" || header.typ !== "JWT") {
    return null;
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${headerPart}.${payloadPart}`)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

  if (
    expected.length !== signaturePart.length ||
    !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signaturePart))
  ) {
    return null;
  }

  if (payload.purpose !== "spacedout-session") {
    return null;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Number.isFinite(payload.exp) && payload.exp <= nowSeconds) {
    return null;
  }

  return payload;
}

// Prevent high-speed missiles from tunneling through targets between ticks.
function distSqPointToSegment(px, py, pz, ax, ay, az, bx, by, bz) {
  const abx = bx - ax;
  const aby = by - ay;
  const abz = bz - az;
  const apx = px - ax;
  const apy = py - ay;
  const apz = pz - az;

  const abLenSq = abx * abx + aby * aby + abz * abz;
  if (abLenSq <= 0) {
    return apx * apx + apy * apy + apz * apz;
  }

  let t = (apx * abx + apy * aby + apz * abz) / abLenSq;
  t = Math.max(0, Math.min(1, t));

  const cx = ax + abx * t;
  const cy = ay + aby * t;
  const cz = az + abz * t;
  const dx = px - cx;
  const dy = py - cy;
  const dz = pz - cz;
  return dx * dx + dy * dy + dz * dz;
}

// ==========================================
// ZERO-GC HISTORY BUFFER
// ==========================================
const STRIDE = 7; // t, x, y, z, dx, dy, dz
const MAX_HISTORY_SAMPLES = 240;
const HISTORY_BUFFER_LENGTH = MAX_HISTORY_SAMPLES * STRIDE;

function createPlayerState() {
  const telemetryOutBuffer = new ArrayBuffer(28);
  return {
    x: 0,
    y: 0,
    z: 0,
    dx: 0, dy: 1, dz: 0,
    hp: DEFAULT_HP,
    team: "SPECTATOR",
    rttMs: 0,
    lastPingNonce: 0,
    lastPingSentAt: 0,
    lastShotAt: 0,
    history: new Float64Array(HISTORY_BUFFER_LENGTH),
    historyHead: 0,
    historyCount: 0,
    flareActiveUntil: 0,
    deadUntil: 0,
    awaitingRespawn: false,
    respawnTimer: null,
    authenticated: false,
    userId: null,
    username: null,
    email: null,
    isBot: false,
    telemetryOutBuffer,
    telemetryOutView: new DataView(telemetryOutBuffer),
    telemetryOutFloats: new Float32Array(telemetryOutBuffer, 4),
  };
}

let nextMissileId = 1;
const activeMissiles = [];
const connectedSockets = new Map();
let nextPingNonce = 1;
let terrainHostId = null;
let terrainLocked = false;
let botsSpawned = false;
let serverTerrainGrid = null;
let serverGridRows = 0;
let serverGridCols = 0;
let matchSettings = { ...DEFAULT_MATCH_SETTINGS };

function getTerrainConfig() {
  return {
    seed: TERRAIN_SEED,
    noiseScale: TERRAIN_NOISE_SCALE,
    heightAmplitude: TERRAIN_HEIGHT_AMPLITUDE,
    noiseOctaves: TERRAIN_NOISE_OCTAVES,
    persistence: TERRAIN_PERSISTENCE,
    lacunarity: TERRAIN_LACUNARITY,
  };
}

function getMatchSettings() {
  return {
    gameMode: matchSettings.gameMode,
    botsEnabled: !!matchSettings.botsEnabled,
  };
}

function buildPilotIdentityPayload(id, player) {
  return {
    type: "pilotIdentity",
    id: String(id),
    userId: player.userId || null,
    username:
      player.username ||
      (player.isBot ? `BOT-${String(id)}` : `PILOT-${String(id)}`),
    isBot: !!player.isBot,
  };
}

function sendPilotIdentity(ws, id, player) {
  try {
    ws.send(JSON.stringify(buildPilotIdentityPayload(id, player)));
  } catch {
    // Best effort only.
  }
}

function publishPilotIdentity(id, player) {
  app.publish("radar", JSON.stringify(buildPilotIdentityPayload(id, player)));
}

function serializeSnapshotEntry(id, player) {
  return {
    id: String(id),
    pos: {
      x: player.x,
      y: player.y,
      z: player.z,
      dx: player.dx,
      dy: player.dy,
      dz: player.dz,
      hp: player.hp,
      dead: !isAlive(player),
      team: player.team,
      username:
        player.username ||
        (player.isBot ? `BOT-${String(id)}` : undefined),
    },
  };
}

function sendWorldSnapshot(ws) {
  const snapshotData = Object.entries(players)
    .filter(([idStr]) => idStr !== String(ws.numericId))
    .map(([idStr, player]) => serializeSnapshotEntry(idStr, player));

  ws.send(
    JSON.stringify({
      type: "worldSnapshot",
      data: snapshotData,
    }),
  );

  for (const [idStr, player] of Object.entries(players)) {
    if (idStr === String(ws.numericId)) continue;
    if (!player.username && !player.isBot) continue;
    sendPilotIdentity(ws, idStr, player);
  }
}

function sanitizeTerrainConfig(raw) {
  if (!raw || typeof raw !== "object") return null;

  const seed = Math.floor(Number(raw.seed));
  const noiseScale = Number(raw.noiseScale);
  const heightAmplitude = Number(raw.heightAmplitude);
  const noiseOctaves = Math.floor(Number(raw.noiseOctaves));
  const persistence = Number(raw.persistence);
  const lacunarity = Number(raw.lacunarity);

  if (!Number.isFinite(seed) || seed < 0 || seed > 999999999) return null;
  if (!Number.isFinite(noiseScale) || noiseScale < 1 || noiseScale > 20) return null;
  if (!Number.isFinite(heightAmplitude) || heightAmplitude < 500 || heightAmplitude > 10000) return null;
  if (!Number.isFinite(noiseOctaves) || noiseOctaves < 1 || noiseOctaves > 10) return null;
  if (!Number.isFinite(persistence) || persistence < 0.1 || persistence > 0.8) return null;
  if (!Number.isFinite(lacunarity) || lacunarity < 1.0 || lacunarity > 5.0) return null;

  return {
    seed,
    noiseScale,
    heightAmplitude,
    noiseOctaves,
    persistence,
    lacunarity,
  };
}

function applyTerrainConfig(config) {
  TERRAIN_SEED = config.seed;
  TERRAIN_NOISE_SCALE = config.noiseScale;
  TERRAIN_HEIGHT_AMPLITUDE = config.heightAmplitude;
  TERRAIN_NOISE_OCTAVES = config.noiseOctaves;
  TERRAIN_PERSISTENCE = config.persistence;
  TERRAIN_LACUNARITY = config.lacunarity;
}

function isAuthenticatedHuman(player) {
  return !!player && !player.isBot && !!player.authenticated;
}

function getConnectedHumanIds() {
  const ids = [];
  for (const id of connectedSockets.keys()) {
    const p = players[id];
    if (!isAuthenticatedHuman(p)) continue;
    ids.push(id);
  }
  return ids;
}

function assignTerrainHostIfNeeded() {
  if (terrainLocked || terrainHostId !== null) return;
  const ids = getConnectedHumanIds();
  if (ids.length === 0) return;
  terrainHostId = ids[0];
}

function reassignTerrainHostIfNeeded(disconnectedId) {
  if (terrainLocked) return;
  if (terrainHostId !== disconnectedId) return;

  terrainHostId = null;
  assignTerrainHostIfNeeded();
  if (terrainHostId === null) return;

  app.publish(
    "radar",
    JSON.stringify({ type: "terrainHostAssigned", hostId: terrainHostId }),
  );
}

function isAlive(player, now = Date.now()) {
  return !!player && (!player.deadUntil || player.deadUntil <= now);
}

function clearRespawnTimer(player) {
  if (player && player.respawnTimer) {
    clearTimeout(player.respawnTimer);
    player.respawnTimer = null;
  }
}

function areTeammates(a, b) {
  if (!a || !b) return false;
  if (a.team === "SPECTATOR" || b.team === "SPECTATOR") return false;
  return a.team === b.team;
}

function scheduleRespawn(id, delayMs = RESPAWN_DELAY_MS) {
  const player = players[id];
  if (!player) return;

  clearRespawnTimer(player);
  player.awaitingRespawn = false;
  const respawnAt = Date.now() + delayMs;
  player.deadUntil = respawnAt;

  player.respawnTimer = setTimeout(() => {
    const p = players[id];
    if (!p || p.deadUntil !== respawnAt) return;

    if (p.isBot && p.spawn) {
      p.deadUntil = 0;
      p.awaitingRespawn = false;
      p.hp = DEFAULT_HP;
      p.flareActiveUntil = 0;
      p.x = p.spawn.x;
      p.y = p.spawn.y;
      p.z = p.spawn.z;
      p.dx = Number.isFinite(p.spawn.dx) ? p.spawn.dx : 0;
      p.dy = Number.isFinite(p.spawn.dy) ? p.spawn.dy : 1;
      p.dz = Number.isFinite(p.spawn.dz) ? p.spawn.dz : 0;
      p.historyHead = 0;
      p.historyCount = 0;
      resetBotOnRespawn(p, Date.now());
      app.publish(
        "radar",
        JSON.stringify({
          type: "shipRespawned",
          id,
          hp: p.hp,
          team: p.team,
          username: p.username,
          pos: {
            x: p.x,
            y: p.y,
            z: p.z,
            dx: p.dx,
            dy: p.dy,
            dz: p.dz,
          },
        }),
      );
      return;
    }

    // Humans stay untargetable in spectator mode until they explicitly request respawn.
    p.deadUntil = Number.POSITIVE_INFINITY;
    p.awaitingRespawn = true;
    app.publish("radar", JSON.stringify({ type: "respawnReady", id }));
  }, delayMs);
}

function destroyShip(id, now = Date.now()) {
  const target = players[id];
  if (!target || !isAlive(target, now)) return false;

  target.hp = 0;
  app.publish("radar", JSON.stringify({ type: "shipDestroyed", id }));
  scheduleRespawn(id, RESPAWN_DELAY_MS);
  return true;
}

function applyDamage(targetId, damage, now = Date.now()) {
  const target = players[targetId];
  if (!target || !isAlive(target, now)) return false;

  target.hp -= damage;

  if (target.hp <= 0) {
    destroyShip(targetId, now);
    return true;
  }

  app.publish(
    "radar",
    JSON.stringify({ type: "hpUpdate", id: targetId, hp: target.hp }),
  );
  return true;
}

let lastCheckHitErrorLogAt = 0;
function safeCheckHit(shooter, target, shotTime) {
  if (
    !shooter ||
    !target ||
    shooter.historyCount <= 0 ||
    target.historyCount <= 0
  ) {
    return false;
  }

  try {
    return combatEngine.checkHit(
      shooter.history,
      shooter.historyHead,
      shooter.historyCount,
      target.history,
      target.historyHead,
      target.historyCount,
      shotTime,
      LASER_MUZZLE_OFFSET,
      LASER_RANGE,
      SHIP_HIT_RADIUS,
    );
  } catch (err) {
    const now = Date.now();
    if (now - lastCheckHitErrorLogAt > 2000) {
      console.error("Native checkHit failed:", err);
      lastCheckHitErrorLogAt = now;
    }
    return false;
  }
}

function pushHistorySample(player, t) {
  const idx = player.historyHead * STRIDE;

  player.history[idx] = t;
  player.history[idx + 1] = player.x;
  player.history[idx + 2] = player.y;
  player.history[idx + 3] = player.z;
  player.history[idx + 4] = Number.isFinite(player.dx) ? player.dx : 0;
  player.history[idx + 5] = Number.isFinite(player.dy) ? player.dy : 1;
  player.history[idx + 6] = Number.isFinite(player.dz) ? player.dz : 0;

  player.historyHead = (player.historyHead + 1) % MAX_HISTORY_SAMPLES;
  if (player.historyCount < MAX_HISTORY_SAMPLES) {
    player.historyCount++;
  }
}

// ==========================================
// BINARY TELEMETRY & MAP ROUTER
// ==========================================
function handleBinaryMessage(ws, message) {
  if (!(message instanceof ArrayBuffer)) return;

  // 1. High-frequency 60fps Telemetry (24 bytes)
  if (message.byteLength === TELEMETRY_BYTES) {
    const inFloats = new Float32Array(message);
    const player = players[ws.numericId];
    if (!player) return;
    if (!player.isBot && !player.authenticated) return;
    if (!isAlive(player)) return;

    for (let i = 0; i < TELEMETRY_FLOATS; i++) {
      if (!Number.isFinite(inFloats[i])) {
        return;
      }
    }

    // Update Authoritative Server State
    player.x = inFloats[0];
    player.y = inFloats[1];
    player.z = inFloats[2];
    player.dx = inFloats[3];
    player.dy = inFloats[4];
    player.dz = inFloats[5];

    // Feed the C++ Interpolator History Buffer
    pushHistorySample(player, Date.now());

    // Prepare the 28-byte broadcast buffer
    player.telemetryOutView.setUint32(0, ws.numericId, true);
    player.telemetryOutFloats.set(inFloats);

    // Blast to all connected clients
    ws.publish("radar", player.telemetryOutBuffer, true);
    return;
  }

  // 2. Heavy Terrain Collision Map Upload (from Host)
  if (message.byteLength > 1000) {
    const player = players[ws.numericId];
    if (!player || !player.authenticated) return;
    if (ws.numericId !== terrainHostId) return; // Security: Only Host can upload the map

    const safeCopy = message.slice(0);

    const header = new Uint32Array(safeCopy, 0, 2);
    serverGridRows = header[0];
    serverGridCols = header[1];
    serverTerrainGrid = new Float32Array(safeCopy, 8);

    console.log(`🗺️ [TERRAIN] Host uploaded collision map: ${serverGridRows}x${serverGridCols}`);
    return;
  }
}

// ==========================================
// SERVER INITIALIZATION
// ==========================================
const app = uWS
  .App()
  .ws("/*", {
    compression: uWS.SHARED_COMPRESSOR,
    maxPayloadLength: 16 * 1024 * 1024,
    idleTimeout: 32,

    open: (ws) => {
      ws.numericId = nextPilotId++;
      console.log("🟢 PILOT CONNECTED. ID:", ws.numericId);

      ws.subscribe("radar");
      ws.subscribe("combat");

      // Initialize their state
      players[ws.numericId] = createPlayerState();
      connectedSockets.set(ws.numericId, ws);

      // --- FIX: Put new players in the Lobby (spectator mode) ---
      players[ws.numericId].deadUntil = Number.POSITIVE_INFINITY;
      players[ws.numericId].awaitingRespawn = true;

      assignTerrainHostIfNeeded();

      // 1. Send the handshake (their ID)
      ws.send(
        JSON.stringify({
          type: "handshake",
          id: ws.numericId,
          isTerrainHost: ws.numericId === terrainHostId,
          terrainHostId,
          terrainLocked,
          matchSettings: getMatchSettings(),
          terrainConfig: terrainLocked ? getTerrainConfig() : null,
        }),
      );
      sendWorldSnapshot(ws);
    },

    message: (ws, message, isBinary) => {
      if (isBinary) {
        // Route high-speed binary movement
        handleBinaryMessage(ws, message);
      } else {
        // Route low-frequency JSON combat events
        let payload;
        try {
          payload = JSON.parse(Buffer.from(message).toString());
        } catch {
          return;
        }

        if (!payload || typeof payload.type !== "string") {
          return;
        }

        if (payload.type === "authSession") {
          const player = players[ws.numericId];
          if (!player) return;

          const claims = verifySpacedOutSessionToken(payload.token);
          if (!claims || !claims.userId) {
            ws.send(JSON.stringify({ type: "authRejected" }));
            return;
          }

          player.authenticated = true;
          player.userId = String(claims.userId);
          player.username =
            typeof claims.username === "string" && claims.username.trim()
              ? claims.username.trim()
              : `PILOT-${ws.numericId}`;
          player.email =
            typeof claims.email === "string" ? claims.email : null;

          const previousHostId = terrainHostId;
          assignTerrainHostIfNeeded();

          ws.send(
            JSON.stringify({
              type: "authAccepted",
              id: ws.numericId,
              userId: player.userId,
              username: player.username,
            }),
          );
          sendPilotIdentity(ws, ws.numericId, player);
          publishPilotIdentity(ws.numericId, player);

          if (terrainHostId !== previousHostId && terrainHostId !== null) {
            app.publish(
              "radar",
              JSON.stringify({
                type: "terrainHostAssigned",
                hostId: terrainHostId,
              }),
            );
          }

          return;
        }

        if (payload.type === "svPong") {
          const player = players[ws.numericId];
          if (!player || player.isBot) return;

          const nonce = Number(payload.nonce);
          if (!Number.isFinite(nonce) || nonce !== player.lastPingNonce) return;
          if (!player.lastPingSentAt) return;

          const rtt = Date.now() - player.lastPingSentAt;
          if (!Number.isFinite(rtt) || rtt < 0 || rtt > MAX_VALID_RTT_MS) return;

          // EWMA smooths jittery ping values for steadier rewind.
          player.rttMs = player.rttMs > 0 ? player.rttMs * 0.8 + rtt * 0.2 : rtt;
          return;
        }

        // --- Client Ping Echo ---
        if (payload.type === "clientPing") {
          ws.send(JSON.stringify({ type: "clientPong", timestamp: payload.timestamp }));
          return;
        }

        const player = players[ws.numericId];
        if (!player || !player.authenticated) {
          ws.send(JSON.stringify({ type: "authRequired" }));
          return;
        }

        if (payload.type === "terrainFinalize") {
          if (terrainLocked) return;
          if (ws.numericId !== terrainHostId) return;

          if (!serverTerrainGrid || serverGridRows === 0 || serverGridCols === 0) {
            ws.send(JSON.stringify({ type: "terrainMapMissing" }));
            return;
          }

          const config = sanitizeTerrainConfig(payload.config);
          if (!config) {
            ws.send(JSON.stringify({ type: "terrainRejected" }));
            return;
          }

          matchSettings = sanitizeMatchSettings(payload.matchSettings);
          applyTerrainConfig(config);
          terrainLocked = true;
          spawnBotsIfNeeded();

          app.publish(
            "radar",
            JSON.stringify({
              type: "terrainLocked",
              config: getTerrainConfig(),
              hostId: terrainHostId,
              matchSettings: getMatchSettings(),
            }),
          );
          return;
        }

        if (payload.type === "updateMatchSettings") {
          if (terrainLocked) return;
          if (ws.numericId !== terrainHostId) return;

          matchSettings = sanitizeMatchSettings(payload.settings);
          app.publish(
            "radar",
            JSON.stringify({
              type: "matchSettingsUpdated",
              settings: getMatchSettings(),
            }),
          );
          return;
        }

        if (payload.type === "fireShot") {
          const shooterId = ws.numericId;
          const shooter = players[shooterId];
          if (!shooter || !isAlive(shooter)) return;

          const now = Date.now();
          if (now - shooter.lastShotAt < FIRE_COOLDOWN_MS) return;
          shooter.lastShotAt = now;

          // Broadcast muzzle flashes/tracers so all clients can render the shot.
          app.publish(
            "radar",
            JSON.stringify({
              type: "shotFired",
              id: shooterId,
              pos: { x: shooter.x, y: shooter.y, z: shooter.z },
              dir: { x: shooter.dx, y: shooter.dy, z: shooter.dz },
            }),
          );

          const rewindMs = clamp((shooter.rttMs || 0) * 0.5, 0, MAX_REWIND_MS);
          const shotTime = now - rewindMs;
          const hitIds = [];

          for (const idStr in players) {
            const enemyId = Number(idStr);
            const target = players[idStr];
            if (enemyId === shooterId) continue;
            if (!isAlive(target)) continue;
            if (areTeammates(shooter, target)) continue;

            // Send raw flat buffers to C++ (fail-soft on native errors)
            const isHit = safeCheckHit(shooter, target, shotTime);

            if (isHit) hitIds.push(enemyId);
          }

          if (hitIds.length === 0) return;

          for (const enemyId of hitIds) {
            applyDamage(enemyId, SHOT_DAMAGE, now);
          }
        }
        if (payload.type === "missileFired") {
          const shooterId = ws.numericId;
          const shooter = players[shooterId];
          if (!shooter || !isAlive(shooter)) return;

          const targetId = Number(payload.targetId);
          if (!Number.isInteger(targetId)) return;
          const target = players[targetId];
          if (!target || !isAlive(target)) return;
          if (targetId === shooterId) return;
          if (areTeammates(shooter, target)) return;
          if (target.flareActiveUntil > Date.now()) return;

          activeMissiles.push({
            id: nextMissileId++,
            ownerId: shooterId,
            targetId,
            x: shooter.x,
            y: shooter.y,
            z: shooter.z,
            dx: shooter.dx, // <-- Updated
            dy: shooter.dy, // <-- Updated
            dz: shooter.dz,
            speed: MISSILE_INITIAL_SPEED,
            distanceTraveled: 0,
            expiresAt: Date.now() + 10000,
          });

          // Let all clients render remote missile launches.
          app.publish(
            "radar",
            JSON.stringify({
              type: "missileLaunched",
              ownerId: shooterId,
              targetId,
              pos: { x: shooter.x, y: shooter.y, z: shooter.z },
              dir: { x: shooter.dx, y: shooter.dy, z: shooter.dz },
              speed: MISSILE_INITIAL_SPEED,
            }),
          );
        }
        if (payload.type === "requestRespawn") {
          const id = ws.numericId;
          const player = players[id];
          if (!player || player.isBot) return;
          if (!player.awaitingRespawn) return;

          const now = Date.now();
          player.awaitingRespawn = false;
          player.deadUntil = 0;
          player.hp = DEFAULT_HP;
          player.flareActiveUntil = 0;
          player.x = PLAYER_RESPAWN_POS.x;
          player.y = PLAYER_RESPAWN_POS.y;
          player.z = PLAYER_RESPAWN_POS.z;
          player.dx = PLAYER_RESPAWN_DIR.x;
          player.dy = PLAYER_RESPAWN_DIR.y;
          player.dz = PLAYER_RESPAWN_DIR.z;
          player.historyHead = 0;
          player.historyCount = 0;
          pushHistorySample(player, now);

          app.publish(
            "radar",
            JSON.stringify({
              type: "shipRespawned",
              id,
              hp: player.hp,
              team: player.team,
              username: player.username,
              pos: {
                x: player.x,
                y: player.y,
                z: player.z,
                dx: player.dx,
                dy: player.dy,
                dz: player.dz,
              },
            }),
          );
        }
        // --- FLARE BROADCAST ---
        if (payload.type === "deployFlares") {
          const shooter = players[ws.numericId];
          if (!shooter || !isAlive(shooter)) return;

          shooter.flareActiveUntil = Date.now() + FLARE_DURATION_MS;
          // Tell all clients that this specific pilot popped flares
          app.publish(
            "radar",
            JSON.stringify({
              type: "flaresDeployed",
              id: ws.numericId,
              until: shooter.flareActiveUntil,
            }),
          );
        }
        // --- JOIN TEAM & SPAWN ---
        if (payload.type === "joinTeam") {
          const id = ws.numericId;
          const player = players[id];
          if (!player) return;
          if (!terrainLocked) {
            ws.send(JSON.stringify({ type: "terrainPending" }));
            return;
          }

          const chosenTeam = payload.team === "BLUE" ? "BLUE" : "RED";
          const spawnData = TEAM_SPAWNS[chosenTeam];
          const spawnPose = projectSpawnAboveTerrain({
            x: spawnData.pos.x,
            y: spawnData.pos.y,
            z: spawnData.pos.z,
            dx: spawnData.dir.dx,
            dy: spawnData.dir.dy,
            dz: spawnData.dir.dz,
          });

          player.team = chosenTeam;
          clearRespawnTimer(player);
          player.awaitingRespawn = false;
          player.deadUntil = 0;
          player.hp = DEFAULT_HP;
          player.flareActiveUntil = 0;

          player.x = spawnPose.x;
          player.y = spawnPose.y;
          player.z = spawnPose.z;
          player.dx = spawnPose.dx;
          player.dy = spawnPose.dy;
          player.dz = spawnPose.dz;

          player.historyHead = 0;
          player.historyCount = 0;
          pushHistorySample(player, Date.now());

          // Tell everyone the player spawned in as their chosen team
          app.publish(
            "radar",
            JSON.stringify({
              type: "shipRespawned",
              id,
              hp: player.hp,
              team: player.team,
              username: player.username,
              pos: {
                x: player.x, y: player.y, z: player.z,
                dx: player.dx, dy: player.dy, dz: player.dz,
              },
            }),
          );
          return;
        }

        if (payload.type === "returnToLobby") {
          clearRespawnTimer(player);
          player.team = "SPECTATOR";
          player.hp = DEFAULT_HP;
          player.flareActiveUntil = 0;
          player.awaitingRespawn = true;
          player.deadUntil = Number.POSITIVE_INFINITY;

          app.publish(
            "radar",
            JSON.stringify({
              type: "returnedToLobby",
              id: ws.numericId,
            }),
          );

          const activeHumans = getConnectedHumanIds();
          const everyoneInLobby =
            activeHumans.length > 0 &&
            activeHumans.every((id) => {
              const activePlayer = players[id];
              return !!activePlayer && activePlayer.team === "SPECTATOR";
            });

          if (everyoneInLobby) {
            resetRoundToLobby();
          }
          return;
        }
        // --- DEV MODE SUICIDE ---
        if (payload.type === "suicide") {
          applyDamage(ws.numericId, 9999);
        }
      }
    },

    close: (ws) => {
      console.log("🔴 PILOT DISCONNECTED. ID:", ws.numericId);
      const disconnectedPlayer = players[ws.numericId];
      connectedSockets.delete(ws.numericId);
      clearRespawnTimer(disconnectedPlayer);
      delete players[ws.numericId];
      reassignTerrainHostIfNeeded(ws.numericId);
      for (let i = activeMissiles.length - 1; i >= 0; i--) {
        const missile = activeMissiles[i];
        if (
          missile.ownerId === ws.numericId ||
          missile.targetId === ws.numericId
        ) {
          activeMissiles.splice(i, 1);
        }
      }
      app.publish(
        "radar",
        JSON.stringify({ type: "pilotDropped", id: ws.numericId }),
      );

      if (getConnectedHumanIds().length === 0) {
        terrainHostId = null;
        terrainLocked = false;
        serverTerrainGrid = null;
        serverGridRows = 0;
        serverGridCols = 0;
        activeMissiles.length = 0;
        clearBots();
        matchSettings = { ...DEFAULT_MATCH_SETTINGS };
      }
    },
  })
  .listen("0.0.0.0", port, (token) => {
    if (token) {
      console.log(`📡 TOWER ONLINE ON PORT ${port} (0.0.0.0)`);
    } else {
      console.error(`🔴 FATAL: FAILED TO BIND TO PORT ${port}.`);
      process.exit(1);
    }
  });

setInterval(() => {
  const now = Date.now();
  for (const [id, ws] of connectedSockets.entries()) {
    const player = players[id];
    if (!player || player.isBot) {
      connectedSockets.delete(id);
      continue;
    }

    const nonce = nextPingNonce++;
    player.lastPingNonce = nonce;
    player.lastPingSentAt = now;

    try {
      ws.send(JSON.stringify({ type: "svPing", nonce }));
    } catch {
      connectedSockets.delete(id);
    }
  }
}, PING_INTERVAL_MS);

// ==========================================
// MATH HELPERS FOR BOT AI
// ==========================================
function getShortestAngle(current, target) {
  let diff = (target - current) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

function distance3D(p1, p2) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const dz = p2.z - p1.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function getGridCoords(nx, ny, nz) {
  const phi = Math.acos(ny);
  const theta = Math.atan2(nz, nx);

  const rRow = Math.round((phi / Math.PI) * (serverGridRows - 1));
  const rCol = Math.round(((Math.PI - theta) / (2 * Math.PI)) * (serverGridCols - 1));

  return {
    row: clamp(rRow, 0, serverGridRows - 1),
    col: clamp(rCol, 0, serverGridCols - 1),
  };
}

function getGridAltitudeFromCell(row, col) {
  const idx = row * serverGridCols + col;
  const rawGroundZ = serverTerrainGrid[idx];
  return Math.max(0, rawGroundZ * TERRAIN_SCALE_Z) + TERRAIN_CLEARANCE_BIAS;
}

function getGridAltitude(nx, ny, nz) {
  // If map hasn't arrived yet, default to safe clearance
  if (!serverTerrainGrid || serverGridRows === 0 || serverGridCols === 0) {
    return Math.max(0, 0) + TERRAIN_CLEARANCE_BIAS;
  }

  const { row, col } = getGridCoords(nx, ny, nz);
  return getGridAltitudeFromCell(row, col);
}

function getBufferedGridAltitude(nx, ny, nz, cellRadius = 2) {
  if (!serverTerrainGrid || serverGridRows === 0 || serverGridCols === 0) {
    return Math.max(0, 0) + TERRAIN_CLEARANCE_BIAS;
  }

  const { row, col } = getGridCoords(nx, ny, nz);
  let maxAltitude = getGridAltitudeFromCell(row, col);

  for (let rowOffset = -cellRadius; rowOffset <= cellRadius; rowOffset += 1) {
    for (let colOffset = -cellRadius; colOffset <= cellRadius; colOffset += 1) {
      const sampleRow = clamp(row + rowOffset, 0, serverGridRows - 1);
      const sampleCol = clamp(col + colOffset, 0, serverGridCols - 1);
      const altitude = getGridAltitudeFromCell(sampleRow, sampleCol);
      if (altitude > maxAltitude) {
        maxAltitude = altitude;
      }
    }
  }

  return maxAltitude;
}

function projectSpawnAboveTerrain(spawn, clearance = BOT_MIN_TERRAIN_CLEARANCE + 500) {
  const sx = Number(spawn?.x) || 0;
  const sy = Number(spawn?.y) || 0;
  const sz = Number(spawn?.z) || 0;
  const distFromCenter = Math.sqrt(sx * sx + sy * sy + sz * sz);

  const nx =
    Number.isFinite(distFromCenter) && distFromCenter > 0 ? sx / distFromCenter : 0;
  const ny =
    Number.isFinite(distFromCenter) && distFromCenter > 0 ? sy / distFromCenter : 1;
  const nz =
    Number.isFinite(distFromCenter) && distFromCenter > 0 ? sz / distFromCenter : 0;

  const safeRadius = WORLD_RADIUS + getBufferedGridAltitude(nx, ny, nz, 4) + clearance;
  const dx = Number.isFinite(spawn?.dx) ? spawn.dx : 0;
  const dy = Number.isFinite(spawn?.dy) ? spawn.dy : 1;
  const dz = Number.isFinite(spawn?.dz) ? spawn.dz : 0;

  return {
    x: nx * safeRadius,
    y: ny * safeRadius,
    z: nz * safeRadius,
    dx,
    dy,
    dz,
  };
}

/* function sampleTerrainRawElevation(nx, ny, nz) {
  let elevation = 0;
  let currentAmplitude = TERRAIN_HEIGHT_AMPLITUDE;
  let currentScale = TERRAIN_NOISE_SCALE;

  for (let o = 0; o < TERRAIN_NOISE_OCTAVES; o++) {
    const offset = TERRAIN_SEED + o * 100;
    const noiseVal =
      Math.sin(nx * currentScale + offset) *
      Math.cos(ny * currentScale - offset) *
      Math.sin(nz * currentScale + offset);

    elevation += noiseVal * currentAmplitude;
    currentAmplitude *= TERRAIN_PERSISTENCE;
    currentScale *= TERRAIN_LACUNARITY;
  }

  if (elevation < 0) {
    elevation *= 0.3;
  } else {
    elevation += 200;
  }
  return elevation;
}

function getTerrainAltitudeAtNormal(nx, ny, nz) {
  const rawGroundZ = sampleTerrainRawElevation(nx, ny, nz);
  return Math.max(0, rawGroundZ * TERRAIN_SCALE_Z) + TERRAIN_CLEARANCE_BIAS;
} */

function keepBotAboveTerrain(bot, stepScale) {
  const distFromCenter = Math.sqrt(bot.x * bot.x + bot.y * bot.y + bot.z * bot.z);
  if (!Number.isFinite(distFromCenter) || distFromCenter <= 0) return;

  const nx = bot.x / distFromCenter;
  const ny = bot.y / distFromCenter;
  const nz = bot.z / distFromCenter;

  const terrainAltitude = getBufferedGridAltitude(nx, ny, nz, 2);
  const minSafeAltitude = terrainAltitude + BOT_MIN_TERRAIN_CLEARANCE;
  const currentAltitude = distFromCenter - WORLD_RADIUS;

  if (currentAltitude >= minSafeAltitude) return;

  const deficit = minSafeAltitude - currentAltitude;
  const steerStrength = clamp(0.12 + deficit / 400, 0.12, 0.85) * stepScale;
  bot.dx += nx * steerStrength;
  bot.dy += ny * steerStrength;
  bot.dz += nz * steerStrength;

  // Snap just above terrain to avoid frame-to-frame tunneling into mountains.
  const safeRadius = WORLD_RADIUS + minSafeAltitude + 2;
  bot.x = nx * safeRadius;
  bot.y = ny * safeRadius;
  bot.z = nz * safeRadius;
}

// ==========================================
// AI DRONE SIMULATOR: HUNTER-KILLER SYSTEM
// ==========================================

const BOT_FIXED_STEP_MS = 16;
const BOT_DRIVER_INTERVAL_MS = 8;
const BOT_MAX_CATCH_UP_STEPS = 6;
const BOT_HARD_DECK_RADIUS = WORLD_RADIUS + 120;

const BOT_PROFILES = {
  rookie: {
    reactionMs: 260,
    reactionJitterMs: 80,
    aimNoise: 0.07,
    fireCooldownMs: 950,
    agility: 0.028,
    minSpeed: 9,
    maxSpeed: 12,
    chaseAccel: 0.09,
    patrolDecel: 0.04,
    chaseEnterRange: 30000,
    chaseExitRange: 36000,
    engageEnterRange: 12000,
    engageExitRange: 17000,
    fireRange: 14000,
    yawTolerance: 0.14,
    pitchTolerance: 0.14,
    leadSpeed: 12000,
    maxLeadSeconds: 0.55,
  },
  veteran: {
    reactionMs: 180,
    reactionJitterMs: 60,
    aimNoise: 0.04,
    fireCooldownMs: 750,
    agility: 0.034,
    minSpeed: 10,
    maxSpeed: 13,
    chaseAccel: 0.1,
    patrolDecel: 0.05,
    chaseEnterRange: 32000,
    chaseExitRange: 38000,
    engageEnterRange: 14000,
    engageExitRange: 19000,
    fireRange: 15500,
    yawTolerance: 0.11,
    pitchTolerance: 0.11,
    leadSpeed: 10500,
    maxLeadSeconds: 0.7,
  },
  ace: {
    reactionMs: 120,
    reactionJitterMs: 40,
    aimNoise: 0.02,
    fireCooldownMs: 620,
    agility: 0.04,
    minSpeed: 10,
    maxSpeed: 14,
    chaseAccel: 0.11,
    patrolDecel: 0.06,
    chaseEnterRange: 34000,
    chaseExitRange: 40000,
    engageEnterRange: 15000,
    engageExitRange: 21000,
    fireRange: 16500,
    yawTolerance: 0.09,
    pitchTolerance: 0.09,
    leadSpeed: 9500,
    maxLeadSeconds: 0.85,
  },
};

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

function estimateVelocity(player) {
  if (!player || player.historyCount < 2) {
    return { vx: 0, vy: 0, vz: 0 };
  }

  const latestHead =
    (player.historyHead - 1 + MAX_HISTORY_SAMPLES) % MAX_HISTORY_SAMPLES;
  const prevHead =
    (player.historyHead - 2 + MAX_HISTORY_SAMPLES) % MAX_HISTORY_SAMPLES;
  const latestIdx = latestHead * STRIDE;
  const prevIdx = prevHead * STRIDE;

  const latestT = player.history[latestIdx];
  const prevT = player.history[prevIdx];
  const dt = (latestT - prevT) / 1000;
  if (!Number.isFinite(dt) || dt <= 0) {
    return { vx: 0, vy: 0, vz: 0 };
  }

  return {
    vx: (player.history[latestIdx + 1] - player.history[prevIdx + 1]) / dt,
    vy: (player.history[latestIdx + 2] - player.history[prevIdx + 2]) / dt,
    vz: (player.history[latestIdx + 3] - player.history[prevIdx + 3]) / dt,
  };
}

function initializeBotState(bot, botConfig, now, spawnPose) {
  bot.isBot = true;
  bot.authenticated = true;
  bot.username = `BOT-${botConfig.id}`;
  bot.botProfile = botConfig.profile;
  bot.speed = 10;
  bot.spawn = {
    ...spawnPose,
    dx: Number.isFinite(spawnPose?.dx) ? spawnPose.dx : 0,
    dy: Number.isFinite(spawnPose?.dy) ? spawnPose.dy : 1,
    dz: Number.isFinite(spawnPose?.dz) ? spawnPose.dz : 0,
  };
  bot.aiMode = "PATROL";
  bot.aiTargetId = null;
  bot.aiTargetDistance = Infinity;
  bot.aiNextThinkAt = now;
  bot.aiPatrolPhase = randomRange(0, Math.PI * 2);
  bot.aiBroadcastBuffer = new ArrayBuffer(28);
  bot.aiBroadcastDataView = new DataView(bot.aiBroadcastBuffer);
  bot.aiBroadcastFloats = new Float32Array(bot.aiBroadcastBuffer, 4);
}

function resetBotOnRespawn(bot, now) {
  if (!bot || !bot.isBot || !bot.botProfile) return;
  bot.speed = 10;
  bot.aiMode = "PATROL";
  bot.aiTargetId = null;
  bot.aiTargetDistance = Infinity;
  bot.aiDesiredYaw = Math.atan2(bot.dx, -bot.dz);
  bot.aiDesiredPitch = Math.asin(clamp(bot.dy, -1, 1));
  bot.aiNextThinkAt = now + bot.botProfile.reactionMs;
}

function pickBotTarget(bot, activeHumanIds, now, profile) {
  let nearestId = null;
  let nearestDistance = Infinity;

  for (const humanId of activeHumanIds) {
    const human = players[humanId];
    if (!human || !isAlive(human, now)) continue;
    const dist = distance3D(bot, human);
    if (dist < nearestDistance) {
      nearestDistance = dist;
      nearestId = humanId;
    }
  }

  let stickyId = bot.aiTargetId;
  let stickyDistance = Infinity;
  if (stickyId !== null) {
    const stickyTarget = players[stickyId];
    if (stickyTarget && isAlive(stickyTarget, now)) {
      stickyDistance = distance3D(bot, stickyTarget);
      if (
        stickyDistance < profile.chaseExitRange &&
        stickyDistance <= nearestDistance * 1.2
      ) {
        nearestId = stickyId;
        nearestDistance = stickyDistance;
      }
    }
  }

  return { targetId: nearestId, distance: nearestDistance };
}

function updateBotIntent(bot, activeHumanIds, now) {
  const profile = bot.botProfile;
  const targetInfo = pickBotTarget(bot, activeHumanIds, now, profile);
  const hasTarget = targetInfo.targetId !== null;

  if (bot.aiMode === "PATROL") {
    if (hasTarget && targetInfo.distance < profile.chaseEnterRange) {
      bot.aiMode = "CHASE";
    }
  } else if (bot.aiMode === "CHASE") {
    if (!hasTarget || targetInfo.distance > profile.chaseExitRange) {
      bot.aiMode = "PATROL";
    } else if (targetInfo.distance < profile.engageEnterRange) {
      bot.aiMode = "ENGAGE";
    }
  } else if (bot.aiMode === "ENGAGE") {
    if (!hasTarget) {
      bot.aiMode = "PATROL";
    } else if (targetInfo.distance > profile.engageExitRange) {
      bot.aiMode = "CHASE";
    }
  }

  bot.aiTargetId = hasTarget ? targetInfo.targetId : null;
  bot.aiTargetDistance = hasTarget ? targetInfo.distance : Infinity;

  let desiredYaw = Math.atan2(bot.dx, -bot.dz) + Math.sin(now / 3000 + bot.aiPatrolPhase) * 0.02;
  let desiredPitch = 0;

  if (bot.aiTargetId !== null && bot.aiMode !== "PATROL") {
    const target = players[bot.aiTargetId];
    if (target && isAlive(target, now)) {
      const velocity = estimateVelocity(target);
      const leadSeconds = clamp(
        bot.aiTargetDistance / profile.leadSpeed,
        0,
        profile.maxLeadSeconds,
      );

      const predictedX = target.x + velocity.vx * leadSeconds;
      const predictedY = target.y + velocity.vy * leadSeconds;
      const predictedZ = target.z + velocity.vz * leadSeconds;

      const dx = predictedX - bot.x;
      const dy = predictedY - bot.y;
      const dz = predictedZ - bot.z;
      const horizDist = Math.sqrt(dx * dx + dz * dz);

      desiredYaw = Math.atan2(dx, -dz);
      desiredPitch = Math.atan2(dy, horizDist);

      const noiseScale = bot.aiMode === "ENGAGE" ? 0.6 : 1.0;
      desiredYaw += randomRange(-profile.aimNoise, profile.aimNoise) * noiseScale;
      desiredPitch +=
        randomRange(-profile.aimNoise, profile.aimNoise) * noiseScale;
    }
  }

  bot.aiDesiredYaw = desiredYaw;
  bot.aiDesiredPitch = desiredPitch;
  bot.aiNextThinkAt =
    now +
    Math.max(
      40,
      profile.reactionMs +
      randomRange(-profile.reactionJitterMs, profile.reactionJitterMs),
    );
}

function simulateBotStep(botConfig, now, stepScale, activeHumanIds) {
  const bot = players[botConfig.id];
  if (!bot || !isAlive(bot, now)) return;

  const profile = bot.botProfile;
  if (now >= bot.aiNextThinkAt) updateBotIntent(bot, activeHumanIds, now);

  bot.speed = clamp(
    bot.speed + (bot.aiMode === "PATROL" ? -profile.patrolDecel : profile.chaseAccel) * stepScale,
    profile.minSpeed, profile.maxSpeed
  );

  // Calculate desired flight vector
  let targetDx = 0, targetDy = 1, targetDz = 0;

  if (bot.aiMode === "PATROL") {
    const angle = now / 3000 + bot.aiPatrolPhase;
    targetDx = Math.sin(angle); targetDy = Math.cos(angle);
  } else if (bot.aiTargetId !== null) {
    const target = players[bot.aiTargetId];
    if (target && isAlive(target, now)) {
      const vel = estimateVelocity(target);
      const lead = clamp(bot.aiTargetDistance / profile.leadSpeed, 0, profile.maxLeadSeconds);
      targetDx = (target.x + vel.vx * lead) - bot.x;
      targetDy = (target.y + vel.vy * lead) - bot.y;
      targetDz = (target.z + vel.vz * lead) - bot.z;
    }
  }

  // Normalize target vector
  let tLen = Math.sqrt(targetDx * targetDx + targetDy * targetDy + targetDz * targetDz) || 1;
  targetDx /= tLen; targetDy /= tLen; targetDz /= tLen;

  // Smoothly steer current vector towards target vector
  const agility = profile.agility * (bot.aiMode === "ENGAGE" ? 1.15 : 1.0) * stepScale;
  bot.dx += (targetDx - bot.dx) * agility;
  bot.dy += (targetDy - bot.dy) * agility;
  bot.dz += (targetDz - bot.dz) * agility;

  // Hard Deck Collision Avoidance
  const distFromCenter = Math.sqrt(bot.x * bot.x + bot.y * bot.y + bot.z * bot.z);
  if (distFromCenter < BOT_HARD_DECK_RADIUS && distFromCenter > 0) {
    const nx = bot.x / distFromCenter;
    const ny = bot.y / distFromCenter;
    const nz = bot.z / distFromCenter;
    const hardDeckPush = (BOT_HARD_DECK_RADIUS - distFromCenter) / 200;
    bot.dx += nx * hardDeckPush * stepScale;
    bot.dy += ny * hardDeckPush * stepScale;
    bot.dz += nz * hardDeckPush * stepScale;
  }

  keepBotAboveTerrain(bot, stepScale);

  // Re-normalize final flight vector
  let bLen = Math.sqrt(bot.dx * bot.dx + bot.dy * bot.dy + bot.dz * bot.dz) || 1;
  bot.dx /= bLen; bot.dy /= bLen; bot.dz /= bLen;

  // Move
  bot.x += bot.dx * bot.speed * stepScale;
  bot.y += bot.dy * bot.speed * stepScale;
  bot.z += bot.dz * bot.speed * stepScale;

  keepBotAboveTerrain(bot, stepScale);

  // Firing logic using vector dot-product (1.0 is a perfect hit)
  if (bot.aiMode === "ENGAGE" && bot.aiTargetDistance < profile.fireRange && now - bot.lastShotAt > profile.fireCooldownMs) {
    const target = players[bot.aiTargetId];
    if (target && isAlive(target, now)) {
      const dot = bot.dx * targetDx + bot.dy * targetDy + bot.dz * targetDz;
      if (dot > 0.98) { // Target is squarely in the crosshairs
        bot.lastShotAt = now;
        app.publish(
          "radar",
          JSON.stringify({
            type: "botFired",
            id: botConfig.id,
            pos: { x: bot.x, y: bot.y, z: bot.z },
            dir: { x: bot.dx, y: bot.dy, z: bot.dz },
          }),
        );
        if (!areTeammates(bot, target) && safeCheckHit(bot, target, now)) {
          applyDamage(bot.aiTargetId, SHOT_DAMAGE, now);
        }
      }
    }
  }

  // Broadcast
  pushHistorySample(bot, now);
  bot.aiBroadcastDataView.setUint32(0, botConfig.id, true);
  bot.aiBroadcastFloats[0] = bot.x; bot.aiBroadcastFloats[1] = bot.y; bot.aiBroadcastFloats[2] = bot.z;
  bot.aiBroadcastFloats[3] = bot.dx; bot.aiBroadcastFloats[4] = bot.dy; bot.aiBroadcastFloats[5] = bot.dz;
  app.publish("radar", bot.aiBroadcastBuffer, true);
}

function simulateMissileStep(now, stepScale) {
  for (let i = activeMissiles.length - 1; i >= 0; i--) {
    const missile = activeMissiles[i];
    const owner = players[missile.ownerId];
    const target = players[missile.targetId];

    if (!owner || !target || !isAlive(owner, now) || !isAlive(target, now)) {
      activeMissiles.splice(i, 1);
      continue;
    }
    if (areTeammates(owner, target)) {
      activeMissiles.splice(i, 1);
      continue;
    }

    if (now >= missile.expiresAt) {
      activeMissiles.splice(i, 1);
      continue;
    }

    // Server-authoritative flare immunity: missiles lose lock and fizzle.
    if (target.flareActiveUntil > now) {
      missile.targetId = null;
      //activeMissiles.splice(i, 1);
      continue;
    }

    const tx = target.x - missile.x;
    const ty = target.y - missile.y;
    const tz = target.z - missile.z;
    const tLen = Math.sqrt(tx * tx + ty * ty + tz * tz) || 1;
    const nx = tx / tLen;
    const ny = ty / tLen;
    const nz = tz / tLen;

    missile.dx =
      missile.dx * (1 - MISSILE_STEER_FACTOR) + nx * MISSILE_STEER_FACTOR;
    missile.dy =
      missile.dy * (1 - MISSILE_STEER_FACTOR) + ny * MISSILE_STEER_FACTOR;
    missile.dz =
      missile.dz * (1 - MISSILE_STEER_FACTOR) + nz * MISSILE_STEER_FACTOR;

    const dirLen =
      Math.sqrt(
        missile.dx * missile.dx +
        missile.dy * missile.dy +
        missile.dz * missile.dz,
      ) || 1;
    missile.dx /= dirLen;
    missile.dy /= dirLen;
    missile.dz /= dirLen;

    const prevX = missile.x;
    const prevY = missile.y;
    const prevZ = missile.z;

    missile.speed = Math.min(
      missile.speed + MISSILE_ACCEL * stepScale,
      MISSILE_MAX_SPEED,
    );
    missile.x += missile.dx * missile.speed * stepScale;
    missile.y += missile.dy * missile.speed * stepScale;
    missile.z += missile.dz * missile.speed * stepScale;
    missile.distanceTraveled += missile.speed * stepScale;

    const hitDistanceSq = distSqPointToSegment(
      target.x,
      target.y,
      target.z,
      prevX,
      prevY,
      prevZ,
      missile.x,
      missile.y,
      missile.z,
    );
    if (hitDistanceSq <= MISSILE_HIT_RADIUS * MISSILE_HIT_RADIUS) {
      applyDamage(missile.targetId, MISSILE_DAMAGE, now);
      activeMissiles.splice(i, 1);
      continue;
    }

    if (missile.distanceTraveled >= MISSILE_MAX_DISTANCE) {
      activeMissiles.splice(i, 1);
    }
  }
}

// 1. Initialize bots with tiered behavior profiles
const BOTS = [
  { id: 9001, spawn: { x: 0, y: 15000, z: 58000 }, profile: BOT_PROFILES.rookie },
  //{ id: 9002, spawn: { x: -3000, y: 18000, z: 57500 }, profile: BOT_PROFILES.rookie },
  //{ id: 9003, spawn: { x: 3000, y: 22000, z: 58500 }, profile: BOT_PROFILES.rookie },
];

function clearBots() {
  for (const botConfig of BOTS) {
    if (!players[botConfig.id]) continue;
    delete players[botConfig.id];
    app.publish(
      "radar",
      JSON.stringify({ type: "pilotDropped", id: botConfig.id }),
    );
  }
  botsSpawned = false;
}

function resetRoundToLobby() {
  terrainLocked = false;
  serverTerrainGrid = null;
  serverGridRows = 0;
  serverGridCols = 0;
  activeMissiles.length = 0;
  clearBots();

  terrainHostId = null;
  assignTerrainHostIfNeeded();

  app.publish(
    "radar",
    JSON.stringify({
      type: "terrainUnlocked",
      config: getTerrainConfig(),
      hostId: terrainHostId,
      matchSettings: getMatchSettings(),
    }),
  );
}

function spawnBotsIfNeeded() {
  if (
    normalizeGameMode(matchSettings.gameMode) !== "ARCADE" ||
    !matchSettings.botsEnabled
  ) {
    clearBots();
    return;
  }
  if (botsSpawned) return;

  const botInitNow = Date.now();
  BOTS.forEach((botConfig) => {
    const spawnPose = projectSpawnAboveTerrain(botConfig.spawn);
    const p = createPlayerState();
    p.x = spawnPose.x;
    p.y = spawnPose.y;
    p.z = spawnPose.z;
    p.dx = spawnPose.dx;
    p.dy = spawnPose.dy;
    p.dz = spawnPose.dz;
    initializeBotState(p, botConfig, botInitNow, spawnPose);
    pushHistorySample(p, botInitNow);
    players[botConfig.id] = p;
    publishPilotIdentity(botConfig.id, p);
  });
  botsSpawned = true;
}

let botAccumulatorMs = 0;
let botLastTickMs = Date.now();
setInterval(() => {
  const realNow = Date.now();
  const frameDelta = Math.max(0, Math.min(100, realNow - botLastTickMs));
  botLastTickMs = realNow;
  botAccumulatorMs += frameDelta;

  let stepCount = 0;
  while (
    botAccumulatorMs >= BOT_FIXED_STEP_MS &&
    stepCount < BOT_MAX_CATCH_UP_STEPS
  ) {
    botAccumulatorMs -= BOT_FIXED_STEP_MS;
    const simNow = realNow - botAccumulatorMs;
    const stepScale = BOT_FIXED_STEP_MS / 16;

    const activeHumanIds = [];
    for (const idStr in players) {
      const p = players[idStr];
      if (p.isBot || !isAlive(p, simNow)) continue;
      activeHumanIds.push(Number(idStr));
    }

    if (terrainLocked && botsSpawned) {
      for (const botConfig of BOTS) {
        simulateBotStep(botConfig, simNow, stepScale, activeHumanIds);
      }
    }

    simulateMissileStep(simNow, stepScale);
    stepCount++;
  }

  if (stepCount === BOT_MAX_CATCH_UP_STEPS && botAccumulatorMs >= BOT_FIXED_STEP_MS) {
    // Avoid spiral-of-death if the process stalls briefly.
    botAccumulatorMs = 0;
  }
}, BOT_DRIVER_INTERVAL_MS);

// ==========================================
// SERVER PERFORMANCE TELEMETRY
// ==========================================
setInterval(() => {
  const mem = process.memoryUsage();
  // Convert bytes to Megabytes
  const heapUsed = (mem.heapUsed / 1024 / 1024).toFixed(2);
  const rss = (mem.rss / 1024 / 1024).toFixed(2);

  const activePlayers = connectedSockets.size;
  const activeBots = BOTS.length;
  const missiles = activeMissiles.length;

  console.log(`📊 [PERF] Players: ${activePlayers} (Bots: ${activeBots}) | Missiles: ${missiles} | RAM: ${heapUsed}MB Heap / ${rss}MB Total`);
}, 10000); // Logs every 10 seconds
