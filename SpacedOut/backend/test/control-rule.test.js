const test = require("node:test");
const assert = require("node:assert/strict");

const {
  sanitizeMatchSettings,
  isControlModeAllowed,
  createControlModeRateState,
  allowControlModeMessage,
  resolveControlModeRequest,
  pilotsToResetOnRuleChange,
  describePilot,
  DEFAULT_MATCH_SETTINGS,
  INITIAL_CONTROL_MODE,
  CONTROL_MODE_RATE_LIMIT,
  CONTROL_MODE_RATE_WINDOW_MS,
} = require("../controlRule.js");

// WS5-R1: match settings carry the control rule.

test("sanitizeMatchSettings defaults the control rule to FACE_REQUIRED", () => {
  assert.equal(DEFAULT_MATCH_SETTINGS.controlRule, "FACE_REQUIRED");
  assert.equal(sanitizeMatchSettings(undefined).controlRule, "FACE_REQUIRED");
  assert.equal(sanitizeMatchSettings(null).controlRule, "FACE_REQUIRED");
  assert.equal(sanitizeMatchSettings({}).controlRule, "FACE_REQUIRED");
  assert.equal(
    sanitizeMatchSettings({ gameMode: "PVP" }).controlRule,
    "FACE_REQUIRED",
  );
});

test("sanitizeMatchSettings keeps ANY", () => {
  assert.equal(sanitizeMatchSettings({ controlRule: "ANY" }).controlRule, "ANY");
});

test("sanitizeMatchSettings turns any other control rule into FACE_REQUIRED", () => {
  for (const controlRule of [
    "FACE_REQUIRED",
    "any",
    "KEYBOARD",
    "",
    1,
    true,
    null,
    { toString: () => "ANY" },
    ["ANY"],
  ]) {
    assert.equal(
      sanitizeMatchSettings({ controlRule }).controlRule,
      "FACE_REQUIRED",
      `controlRule ${String(controlRule)}`,
    );
  }
});

test("sanitizeMatchSettings keeps the gameMode and botsEnabled behavior", () => {
  assert.deepEqual(sanitizeMatchSettings(undefined), {
    gameMode: "ARCADE",
    botsEnabled: true,
    controlRule: "FACE_REQUIRED",
  });
  assert.deepEqual(sanitizeMatchSettings("PVP"), {
    gameMode: "ARCADE",
    botsEnabled: true,
    controlRule: "FACE_REQUIRED",
  });
  assert.deepEqual(sanitizeMatchSettings({}), {
    gameMode: "ARCADE",
    botsEnabled: false,
    controlRule: "FACE_REQUIRED",
  });
  assert.equal(sanitizeMatchSettings({ gameMode: "pvp" }).gameMode, "PVP");
  assert.equal(sanitizeMatchSettings({ gameMode: "junk" }).gameMode, "ARCADE");
  assert.equal(
    sanitizeMatchSettings({ gameMode: "ARCADE", botsEnabled: 1 }).botsEnabled,
    true,
  );
  assert.equal(
    sanitizeMatchSettings({ gameMode: "PVP", botsEnabled: true }).botsEnabled,
    false,
  );
});

test("sanitizeMatchSettings returns a fresh object for the default", () => {
  const settings = sanitizeMatchSettings(null);
  settings.controlRule = "ANY";
  assert.equal(DEFAULT_MATCH_SETTINGS.controlRule, "FACE_REQUIRED");
});

// WS5-R2: which control modes a rule allows.

test("isControlModeAllowed truth table", () => {
  assert.equal(isControlModeAllowed("FACE_REQUIRED", "FACE"), true);
  assert.equal(isControlModeAllowed("FACE_REQUIRED", "KEYBOARD"), false);
  assert.equal(isControlModeAllowed("ANY", "FACE"), true);
  assert.equal(isControlModeAllowed("ANY", "KEYBOARD"), true);
});

test("isControlModeAllowed rejects unknown modes", () => {
  for (const mode of ["MOUSE", "face", "", null, undefined]) {
    assert.equal(isControlModeAllowed("ANY", mode), false, String(mode));
  }
});

// WS5-R3: players start on FACE, changes are checked and rate-limited.

test("players start with controlMode FACE", () => {
  assert.equal(INITIAL_CONTROL_MODE, "FACE");
});

test("rate limiter: 5 accepted, the 6th in the same second ignored, accepted again after one second", () => {
  assert.equal(CONTROL_MODE_RATE_LIMIT, 5);
  assert.equal(CONTROL_MODE_RATE_WINDOW_MS, 1000);

  const state = createControlModeRateState();
  const t0 = 10_000;
  for (let i = 0; i < 5; i++) {
    assert.equal(allowControlModeMessage(state, t0 + i * 100), true, `message ${i + 1}`);
  }
  assert.equal(allowControlModeMessage(state, t0 + 999), false, "6th message");
  assert.equal(allowControlModeMessage(state, t0 + 999), false, "7th message");
  assert.equal(allowControlModeMessage(state, t0 + 1000), true, "after one second");
});

test("rate limiter: ignored messages don't extend the window", () => {
  const state = createControlModeRateState();
  for (let i = 0; i < 5; i++) allowControlModeMessage(state, 0);
  for (let t = 100; t < 1000; t += 100) {
    assert.equal(allowControlModeMessage(state, t), false);
  }
  assert.equal(allowControlModeMessage(state, 1000), true);
});

test("resolveControlModeRequest applies an allowed change", () => {
  assert.equal(resolveControlModeRequest("ANY", "FACE", "KEYBOARD"), "apply");
  assert.equal(resolveControlModeRequest("ANY", "KEYBOARD", "FACE"), "apply");
  assert.equal(
    resolveControlModeRequest("FACE_REQUIRED", "KEYBOARD", "FACE"),
    "apply",
  );
});

test("resolveControlModeRequest rejects KEYBOARD under FACE_REQUIRED", () => {
  assert.equal(
    resolveControlModeRequest("FACE_REQUIRED", "FACE", "KEYBOARD"),
    "rejected",
  );
});

test("resolveControlModeRequest ignores the current mode and unknown modes", () => {
  assert.equal(resolveControlModeRequest("ANY", "FACE", "FACE"), "unchanged");
  assert.equal(
    resolveControlModeRequest("ANY", "KEYBOARD", "KEYBOARD"),
    "unchanged",
  );
  for (const mode of ["MOUSE", "keyboard", "", null, undefined, 1]) {
    assert.equal(
      resolveControlModeRequest("ANY", "FACE", mode),
      "invalid",
      String(mode),
    );
  }
});

// WS5-R4: switching the rule to FACE_REQUIRED puts keyboard pilots back on FACE.

test("pilotsToResetOnRuleChange returns only keyboard pilots when the rule becomes FACE_REQUIRED", () => {
  const players = {
    1: { controlMode: "FACE" },
    2: { controlMode: "KEYBOARD" },
    3: { controlMode: "KEYBOARD" },
    40: { controlMode: "FACE", isBot: true },
    41: {},
  };
  assert.deepEqual(pilotsToResetOnRuleChange(players, "FACE_REQUIRED"), [2, 3]);
});

test("pilotsToResetOnRuleChange returns nobody under ANY", () => {
  const players = { 1: { controlMode: "KEYBOARD" } };
  assert.deepEqual(pilotsToResetOnRuleChange(players, "ANY"), []);
  assert.deepEqual(pilotsToResetOnRuleChange({}, "FACE_REQUIRED"), []);
});

// WS5-R5: every payload that describes a pilot carries its control mode.

test("describePilot includes controlMode with the pilot's identity", () => {
  const player = {
    x: 1,
    hp: 80,
    team: "BLUE",
    appUserId: 7,
    username: "ace",
    email: "ace@example.test",
    controlMode: "KEYBOARD",
  };
  assert.deepEqual(describePilot(player), {
    team: "BLUE",
    userId: 7,
    username: "ace",
    controlMode: "KEYBOARD",
  });
});

test("describePilot reports FACE for a pilot that never declared a mode", () => {
  assert.equal(
    describePilot({ team: "RED", appUserId: null, username: null }).controlMode,
    "FACE",
  );
});
