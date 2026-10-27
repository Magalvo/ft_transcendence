const test = require("node:test");
const assert = require("node:assert/strict");

const {
  validateTelemetry,
  allowedDistance,
  shouldSendCorrection,
  shouldApplyTerrainCollision,
  DEFAULT_LIMITS,
  WORLD_RADIUS,
  TELEMETRY_INTERVAL_MS,
  MAX_SPEED_UPS,
  CORRECTION_AFTER_REJECTS,
  CORRECTION_COOLDOWN_MS,
} = require("../telemetryGuard.js");

const SPAWN = { x: 0, y: 0, z: 70000 };
const FORWARD = { dx: 0, dy: 1, dz: 0 };

function baselineAt(pos, timeMs) {
  return { x: pos.x, y: pos.y, z: pos.z, timeMs };
}

function sampleAt(pos, dir = FORWARD) {
  return { x: pos.x, y: pos.y, z: pos.z, dx: dir.dx, dy: dir.dy, dz: dir.dz };
}

function movedAlongY(pos, distance) {
  return { x: pos.x, y: pos.y + distance, z: pos.z };
}

// --- WS1-R1 / R4: no baseline ---

test("accepts any finite sample when there is no baseline", () => {
  const far = { x: 0, y: 0, z: WORLD_RADIUS * 2 };
  assert.deepEqual(validateTelemetry(null, sampleAt(far), 1000), { ok: true });
  assert.deepEqual(validateTelemetry(null, sampleAt(SPAWN), 0), { ok: true });
});

// --- WS1-R1 ---

test("rejects non-finite values", () => {
  const baseline = baselineAt(SPAWN, 0);
  const fields = ["x", "y", "z", "dx", "dy", "dz"];
  for (const field of fields) {
    for (const bad of [NaN, Infinity, -Infinity, undefined, "1"]) {
      const sample = { ...sampleAt(SPAWN), [field]: bad };
      assert.deepEqual(
        validateTelemetry(baseline, sample, 80),
        { ok: false, reason: "non-finite" },
        `${field} = ${String(bad)}`,
      );
      assert.deepEqual(
        validateTelemetry(null, sample, 80),
        { ok: false, reason: "non-finite" },
        `${field} = ${String(bad)} without baseline`,
      );
    }
  }
});

// --- WS1-R2 ---

test("rejects a forward vector shorter than 0.9 or longer than 1.1", () => {
  const baseline = baselineAt(SPAWN, 0);
  const reject = { ok: false, reason: "forward-not-unit" };
  for (const length of [0, 0.5, 0.89, 1.11, 2]) {
    const sample = sampleAt(SPAWN, { dx: 0, dy: length, dz: 0 });
    assert.deepEqual(validateTelemetry(baseline, sample, 80), reject, `${length}`);
    assert.deepEqual(validateTelemetry(null, sample, 80), reject, `${length} without baseline`);
  }
  for (const length of [0.9, 1, 1.1]) {
    const sample = sampleAt(SPAWN, { dx: 0, dy: 0, dz: -length });
    assert.deepEqual(validateTelemetry(baseline, sample, 80), { ok: true }, `${length}`);
  }
  const diagonal = sampleAt(SPAWN, { dx: Math.SQRT1_2, dy: Math.SQRT1_2, dz: 0 });
  assert.deepEqual(validateTelemetry(baseline, diagonal, 80), { ok: true });
});

// --- WS1-R3 ---

test("rejects positions beyond 3x WORLD_RADIUS", () => {
  const limit = WORLD_RADIUS * 3;
  const reject = { ok: false, reason: "out-of-bounds" };
  const outside = { x: 0, y: 0, z: limit + 1 };
  assert.deepEqual(validateTelemetry(null, sampleAt(outside), 0), reject);
  const diagonal = { x: limit, y: limit, z: 0 };
  assert.deepEqual(validateTelemetry(null, sampleAt(diagonal), 0), reject);

  const edge = { x: 0, y: 0, z: limit };
  assert.deepEqual(validateTelemetry(null, sampleAt(edge), 0), { ok: true });
  // Below the surface is the crash logic's job, not this check's.
  const underground = { x: 0, y: 0, z: WORLD_RADIUS / 2 };
  assert.deepEqual(validateTelemetry(null, sampleAt(underground), 0), { ok: true });
});

// --- WS1-R4 ---

test("states the client facts as named constants", () => {
  assert.equal(WORLD_RADIUS, 50000);
  assert.equal(TELEMETRY_INTERVAL_MS, 80);
  assert.equal(MAX_SPEED_UPS, 6300);
  assert.equal(DEFAULT_LIMITS.speedTolerance, 1.5);
  assert.equal(DEFAULT_LIMITS.positionSlack, 50);
  assert.equal(DEFAULT_LIMITS.maxElapsedMs, 2000);
});

test("accepts movement at the maximum speed over one telemetry interval", () => {
  const baseline = baselineAt(SPAWN, 1000);
  const oneInterval = (MAX_SPEED_UPS * TELEMETRY_INTERVAL_MS) / 1000; // 504
  const sample = sampleAt(movedAlongY(SPAWN, oneInterval));
  assert.deepEqual(validateTelemetry(baseline, sample, 1000 + TELEMETRY_INTERVAL_MS), { ok: true });

  // Acceptance criterion: 500 units, 80 ms after spawn.
  const fiveHundred = sampleAt(movedAlongY(SPAWN, 500));
  assert.deepEqual(validateTelemetry(baseline, fiveHundred, 1080), { ok: true });

  // Packets that arrive bunched together still get one full interval each.
  assert.deepEqual(validateTelemetry(baseline, fiveHundred, 1001), { ok: true });
});

test("rejects a teleport within one interval (too-fast)", () => {
  const baseline = baselineAt(SPAWN, 1000);
  const sample = sampleAt(movedAlongY(SPAWN, 5000));
  assert.deepEqual(validateTelemetry(baseline, sample, 1080), { ok: false, reason: "too-fast" });

  // Just past the allowance for one interval.
  const limit = allowedDistance(TELEMETRY_INTERVAL_MS);
  assert.deepEqual(
    validateTelemetry(baseline, sampleAt(movedAlongY(SPAWN, limit + 1)), 1080),
    { ok: false, reason: "too-fast" },
  );
  assert.deepEqual(
    validateTelemetry(baseline, sampleAt(movedAlongY(SPAWN, limit - 1)), 1080),
    { ok: true },
  );
});

test("clamps elapsed time: a 10 s gap allows no more than a 2 s gap", () => {
  assert.equal(allowedDistance(10000), allowedDistance(2000));
  assert.equal(allowedDistance(0), allowedDistance(TELEMETRY_INTERVAL_MS));
  assert.equal(allowedDistance(-500), allowedDistance(TELEMETRY_INTERVAL_MS));
  assert.equal(allowedDistance(2000), MAX_SPEED_UPS * 2 * 1.5 + 50);

  const baseline = baselineAt(SPAWN, 0);
  const justOverTwoSeconds = sampleAt(movedAlongY(SPAWN, allowedDistance(2000) + 1));
  assert.deepEqual(validateTelemetry(baseline, justOverTwoSeconds, 10000), { ok: false, reason: "too-fast" });
});

test("respects custom limits", () => {
  const limits = { ...DEFAULT_LIMITS, maxSpeedUps: 100, positionSlack: 0, speedTolerance: 1 };
  const baseline = baselineAt(SPAWN, 0);
  // 100 u/s for 1 s = 100 units.
  assert.deepEqual(validateTelemetry(baseline, sampleAt(movedAlongY(SPAWN, 100)), 1000, limits), { ok: true });
  assert.deepEqual(
    validateTelemetry(baseline, sampleAt(movedAlongY(SPAWN, 101)), 1000, limits),
    { ok: false, reason: "too-fast" },
  );
});

// --- WS1-R5 ---

test("shouldSendCorrection: false below 3 rejects; true at 3; false again inside the cooldown; true after it", () => {
  assert.equal(CORRECTION_AFTER_REJECTS, 3);
  assert.equal(CORRECTION_COOLDOWN_MS, 500);

  const state = { telemetryRejects: 0, lastCorrectionAt: null };
  assert.equal(shouldSendCorrection(state, 1000), false);
  state.telemetryRejects = 1;
  assert.equal(shouldSendCorrection(state, 1000), false);
  state.telemetryRejects = 2;
  assert.equal(shouldSendCorrection(state, 1000), false);
  state.telemetryRejects = 3;
  assert.equal(shouldSendCorrection(state, 1000), true);

  state.lastCorrectionAt = 1000;
  state.telemetryRejects = 4;
  assert.equal(shouldSendCorrection(state, 1080), false);
  assert.equal(shouldSendCorrection(state, 1499), false);
  assert.equal(shouldSendCorrection(state, 1500), true);
});

test("shouldSendCorrection: a fresh run of rejects after an accepted sample waits for 3 again", () => {
  const state = { telemetryRejects: 2, lastCorrectionAt: 0 };
  assert.equal(shouldSendCorrection(state, 10000), false);
});

// --- WS1-R7 ---

test("shouldApplyTerrainCollision: only for a live ship", () => {
  const delay = 6000;
  assert.equal(shouldApplyTerrainCollision({ deadUntil: 0, lastDeathAt: 0 }, 10000, delay), true);
  assert.equal(shouldApplyTerrainCollision({ deadUntil: 0 }, 10000, delay), true);
  // Dead, waiting for the respawn timer or for a respawn request.
  assert.equal(shouldApplyTerrainCollision({ deadUntil: 16000, lastDeathAt: 10000 }, 10500, delay), false);
  assert.equal(
    shouldApplyTerrainCollision({ deadUntil: Number.POSITIVE_INFINITY, lastDeathAt: 10000 }, 20000, delay),
    false,
  );
  assert.equal(shouldApplyTerrainCollision(null, 0, delay), false);
});

test("shouldApplyTerrainCollision: ignored within the respawn delay of the last death", () => {
  const delay = 6000;
  // Rejoined a team 1 s after dying: a late collision from the old ship is ignored.
  assert.equal(shouldApplyTerrainCollision({ deadUntil: 0, lastDeathAt: 10000 }, 11000, delay), false);
  assert.equal(shouldApplyTerrainCollision({ deadUntil: 0, lastDeathAt: 10000 }, 15999, delay), false);
  assert.equal(shouldApplyTerrainCollision({ deadUntil: 0, lastDeathAt: 10000 }, 16000, delay), true);
});
