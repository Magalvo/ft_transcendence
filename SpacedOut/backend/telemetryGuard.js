// Pure checks on client telemetry (WS1). No uWebSockets or native addon here,
// so `node --test` can load this module on its own.

// Client facts. Keep in sync with the frontend:
// frontend/src/games/spacedout/SpacedOutGameShared.ts: WORLD_RADIUS, TELEMETRY_INTERVAL_MS
// frontend/src/games/spacedout/SpacedOutGame.ts: MAX_FLIGHT_SPEED, `this.speed * delta * 18`
const WORLD_RADIUS = 50000;
const TELEMETRY_INTERVAL_MS = 80;
const MAX_FLIGHT_SPEED = 350;
const CLIENT_SPEED_TO_UNITS = 18;
const MAX_SPEED_UPS = MAX_FLIGHT_SPEED * CLIENT_SPEED_TO_UNITS; // 6300 units/s

const CORRECTION_AFTER_REJECTS = 3;
const CORRECTION_COOLDOWN_MS = 500;

const DEFAULT_LIMITS = Object.freeze({
  maxSpeedUps: MAX_SPEED_UPS,
  speedTolerance: 1.5,
  positionSlack: 50,
  minElapsedMs: TELEMETRY_INTERVAL_MS,
  maxElapsedMs: 2000,
  maxRadius: WORLD_RADIUS * 3,
  minForwardLength: 0.9,
  maxForwardLength: 1.1,
});

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// Farthest a legitimate client can move in `elapsedMs`, with the elapsed time
// clamped so bunched packets get one interval and long gaps can't bank distance.
function allowedDistance(elapsedMs, limits = DEFAULT_LIMITS) {
  const elapsedS =
    clamp(elapsedMs, limits.minElapsedMs, limits.maxElapsedMs) / 1000;
  return (
    limits.maxSpeedUps * elapsedS * limits.speedTolerance + limits.positionSlack
  );
}

function validateTelemetry(baseline, sample, nowMs, limits = DEFAULT_LIMITS) {
  const { x, y, z, dx, dy, dz } = sample;
  for (const value of [x, y, z, dx, dy, dz]) {
    if (!Number.isFinite(value)) return { ok: false, reason: "non-finite" };
  }

  const forwardLength = Math.hypot(dx, dy, dz);
  if (
    forwardLength < limits.minForwardLength ||
    forwardLength > limits.maxForwardLength
  ) {
    return { ok: false, reason: "forward-not-unit" };
  }

  // Only the upper bound: a ship below the surface is the crash logic's job.
  if (Math.hypot(x, y, z) > limits.maxRadius) {
    return { ok: false, reason: "out-of-bounds" };
  }

  if (baseline) {
    const moved = Math.hypot(x - baseline.x, y - baseline.y, z - baseline.z);
    if (moved > allowedDistance(nowMs - baseline.timeMs, limits)) {
      return { ok: false, reason: "too-fast" };
    }
  }

  return { ok: true };
}

// `state` is `{ telemetryRejects, lastCorrectionAt }`; the caller records
// `lastCorrectionAt` when it sends a correction.
function shouldSendCorrection(state, nowMs) {
  if (state.telemetryRejects < CORRECTION_AFTER_REJECTS) return false;
  if (!Number.isFinite(state.lastCorrectionAt)) return true;
  return nowMs - state.lastCorrectionAt >= CORRECTION_COOLDOWN_MS;
}

// `player` is `{ deadUntil, lastDeathAt }` as kept by server.js. Ignores a
// collision from a ship that is dead, or that died less than `respawnDelayMs`
// ago (a late message from the previous ship after a quick rejoin).
function shouldApplyTerrainCollision(player, nowMs, respawnDelayMs) {
  if (!player) return false;
  if (player.deadUntil && player.deadUntil > nowMs) return false;
  if (
    Number.isFinite(player.lastDeathAt) &&
    player.lastDeathAt > 0 &&
    nowMs - player.lastDeathAt < respawnDelayMs
  ) {
    return false;
  }
  return true;
}

module.exports = {
  WORLD_RADIUS,
  TELEMETRY_INTERVAL_MS,
  MAX_FLIGHT_SPEED,
  MAX_SPEED_UPS,
  CORRECTION_AFTER_REJECTS,
  CORRECTION_COOLDOWN_MS,
  DEFAULT_LIMITS,
  allowedDistance,
  validateTelemetry,
  shouldSendCorrection,
  shouldApplyTerrainCollision,
};
