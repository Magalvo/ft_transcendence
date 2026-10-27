// Pure view helpers for the server's control rule (WS5 protocol) and each
// pilot's declared control mode. DOM-free so they run under plain Node.
import type { ControlMode } from "./SpacedOutGameShared";
import type { MatchSettings } from "./types";

export type ControlRule = "FACE_REQUIRED" | "ANY";

// Match settings as the server sends them since WS5.
export interface MatchRules extends MatchSettings {
  controlRule: ControlRule;
}

// Mirrors the server: anything but the exact "ANY" is the default rule.
export function normalizeControlRule(value: unknown): ControlRule {
  return value === "ANY" ? "ANY" : "FACE_REQUIRED";
}

export function normalizeControlMode(value: unknown): ControlMode {
  return value === "KEYBOARD" ? "KEYBOARD" : "FACE";
}

export function controlRuleLabel(rule: ControlRule): string {
  return rule === "ANY" ? "Any" : "Face required";
}

export interface ControlModeToggleInput {
  rule: ControlRule;
  // Past the calibration step, so the pilot is flying or about to.
  isCalibrated: boolean;
  isDead: boolean;
}

// Whether the M key may switch between FACE and KEYBOARD.
export function canToggleControlMode(input: ControlModeToggleInput): boolean {
  return input.rule === "ANY" && input.isCalibrated && !input.isDead;
}

// What to log when M is pressed but the rule forbids keyboard mode. Other
// blocks (not calibrated, destroyed) stay silent, as before WS6.
export function controlModeToggleMessage(
  input: ControlModeToggleInput,
): string | null {
  if (input.rule === "ANY" || !input.isCalibrated || input.isDead) {
    return null;
  }
  return "Keyboard mode is off: the host set the control rule to Face required.";
}

export interface ControlModeBadge {
  mode: ControlMode;
  label: string;
  icon: string;
}

export function controlModeBadge(mode: ControlMode): ControlModeBadge {
  return mode === "KEYBOARD"
    ? { mode, label: "Keyboard", icon: "⌨️" }
    : { mode, label: "Face", icon: "\u{1F4F7}" };
}

export type RuleSelectState = "editable" | "readonly";

// Same lock as the other match rules, so the rule can't change mid-flight.
export function ruleSelectState(input: {
  isHost: boolean;
  terrainLocked: boolean;
}): RuleSelectState {
  return input.isHost && !input.terrainLocked ? "editable" : "readonly";
}

// The calibration screen offers "Fly with keyboard" instead of blocking.
export function keyboardFallbackVisible(rule: ControlRule): boolean {
  return rule === "ANY";
}
