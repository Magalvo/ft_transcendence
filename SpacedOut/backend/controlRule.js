// Pure control-rule logic (WS5). No uWebSockets or native addon here,
// so `node --test` can load this module on its own.
//
// The server only knows the control mode each client *declares*. It can't
// prove a webcam is in use, so the rule is "declared and visible", not proven.

const CONTROL_RULES = Object.freeze(["FACE_REQUIRED", "ANY"]);
const CONTROL_MODES = Object.freeze(["FACE", "KEYBOARD"]);

const INITIAL_CONTROL_MODE = "FACE";
const CONTROL_MODE_RATE_LIMIT = 5;
const CONTROL_MODE_RATE_WINDOW_MS = 1000;

const DEFAULT_MATCH_SETTINGS = Object.freeze({
  gameMode: "ARCADE",
  botsEnabled: true,
  controlRule: "FACE_REQUIRED",
});

function sanitizeMatchSettings(raw) {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_MATCH_SETTINGS };
  }

  const gameMode = String(raw.gameMode || "").toUpperCase() === "PVP"
    ? "PVP"
    : "ARCADE";
  const botsEnabled = gameMode === "ARCADE" && !!raw.botsEnabled;
  const controlRule = raw.controlRule === "ANY" ? "ANY" : "FACE_REQUIRED";

  return { gameMode, botsEnabled, controlRule };
}

function isControlModeAllowed(rule, mode) {
  if (mode === "FACE") return true;
  return mode === "KEYBOARD" && rule === "ANY";
}

function createControlModeRateState() {
  return { windowStartMs: null, count: 0 };
}

// Fixed one-second window: at most CONTROL_MODE_RATE_LIMIT `controlMode`
// messages per player; extra ones are ignored and don't extend the window.
function allowControlModeMessage(state, nowMs) {
  if (
    state.windowStartMs === null ||
    nowMs - state.windowStartMs >= CONTROL_MODE_RATE_WINDOW_MS
  ) {
    state.windowStartMs = nowMs;
    state.count = 0;
  }
  if (state.count >= CONTROL_MODE_RATE_LIMIT) return false;
  state.count += 1;
  return true;
}

// "invalid": not a known mode, ignore. "unchanged": already in that mode.
// "rejected": the rule forbids it, tell the sender. "apply": change and broadcast.
function resolveControlModeRequest(rule, currentMode, requestedMode) {
  if (!CONTROL_MODES.includes(requestedMode)) return "invalid";
  if (!isControlModeAllowed(rule, requestedMode)) return "rejected";
  if (requestedMode === currentMode) return "unchanged";
  return "apply";
}

// Ids of the pilots whose declared mode the new rule no longer allows.
function pilotsToResetOnRuleChange(players, newRule) {
  return Object.entries(players)
    .filter(
      ([, p]) =>
        p.controlMode === "KEYBOARD" && !isControlModeAllowed(newRule, "KEYBOARD"),
    )
    .map(([id]) => Number(id));
}

// Identity fields shared by every payload that describes a pilot
// (worldSnapshot, shipRespawned, returnedToLobby, pilotIdentity).
function describePilot(player) {
  return {
    team: player.team,
    userId: player.appUserId,
    username: player.username,
    controlMode: player.controlMode ?? INITIAL_CONTROL_MODE,
  };
}

module.exports = {
  CONTROL_RULES,
  CONTROL_MODES,
  INITIAL_CONTROL_MODE,
  CONTROL_MODE_RATE_LIMIT,
  CONTROL_MODE_RATE_WINDOW_MS,
  DEFAULT_MATCH_SETTINGS,
  sanitizeMatchSettings,
  isControlModeAllowed,
  createControlModeRateState,
  allowControlModeMessage,
  resolveControlModeRequest,
  pilotsToResetOnRuleChange,
  describePilot,
};
