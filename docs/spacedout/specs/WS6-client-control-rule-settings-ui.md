# WS6 — Client control rule and settings UI

**Status:** In progress (spacedout/ws6-client-control-rule-settings-ui)
**Wave:** 3. **Depends on:** WS3 (`ControlSettings`), WS4 (camera flow), WS5 (control-rule protocol). **Audit items:** 3 (client), 9, 18 (UI).

## Context

Today the webcam requirement is a radio button that any client can flip at
any moment. Flipping it mid-flight freezes the ship (item 9). After WS5 the
server owns the rule and each pilot's declared mode. After WS3 there is a
settings model with no UI.

## Goal

The client follows the server's control rule, shows each pilot's mode, and
lets each player tune their own face controls.

## Scope

**Owns (wave 3):** `SpacedOutGame.ts`, `FlowController.ts`, `pages/SpacedOut.ts`,
`style.css`, `SpacedOutSocketClient.ts`, the i18n files if strings are
translated, new pure view modules, and their tests. It may also add the
`setControlSettings` pass-through to `VisionController.ts` (R4), and nothing
else in that file.

## Requirements

- **WS6-R1 (item 3, item 9):** Remove the "Webcam Requirement" radio. The Match Rules panel gains a **Control rule** select (`Face required` / `Any`):
  - editable only by the host while the terrain is unlocked, like the other rules;
  - shown read-only to everyone else;
  - synced from `matchSettings.controlRule`.
  - Because it follows the existing settings lock, it can't change mid-flight, which fixes item 9.
- **WS6-R2:** The **M** key is allowed only when the rule is `ANY`.
  - On toggle, the client sends `controlMode`. On `controlModeRejected`, it reverts to `FACE` and logs why.
  - On `pilotControlMode` for itself (a reset after a rule change), it applies the mode.
  - A pure `canToggleControlMode({ rule, isCalibrated, isDead })` decides whether M is allowed.
- **WS6-R3:** The roster shows a camera or keyboard badge per pilot, from `controlMode`. A pure `controlModeBadge(mode)` returns the label and icon, with tests.
- **WS6-R4 (item 18):** A **Face controls** panel with sliders for sensitivity and deadzone (using `CONTROL_SETTINGS_LIMITS`) and toggles to invert yaw and pitch.
  - Changes apply live via `HeadPoseTracker.setSettings`. Add a one-line `VisionController.setControlSettings(settings)` pass-through. That is the only `VisionController.ts` edit WS6 may make.
  - Changes are saved with `saveControlSettings(localStorage)`, guarded with try/catch.
  - A **Reset** button restores `DEFAULT_CONTROL_SETTINGS`.
- **WS6-R5:** In "optional/testing" setups (rule `ANY`), keyboard-only play works without a camera. The calibration screen offers **Fly with keyboard** instead of blocking.

## Implementation notes

Added while implementing; the frozen interfaces of WS3 and WS5 are used unchanged.

- **Pure modules:** `controlRuleView.ts` (R1–R3, R5) and `controlSettingsView.ts` (R4).
  - `ControlRule` and `MatchRules` (`MatchSettings` plus `controlRule`) live in `controlRuleView.ts`, so `types.ts` and `SpacedOutGameShared.ts`, which WS6 doesn't own, stay untouched. WS7 can move them.
  - Besides the helpers in the test plan, they export `normalizeControlRule` / `normalizeControlMode` (mirroring the server: only the exact `"ANY"` / `"KEYBOARD"` count), `controlRuleLabel`, `controlModeToggleMessage` (the log line when the rule blocks M) and `keyboardFallbackVisible(rule)` (R5).
- **R1, clarified:** the Match Rules panel is blurred for everyone but the host, so a disabled select alone isn't readable. The radio's old spot above the viewport becomes a read-only **Control Rule** bar that every client sees. `ruleSelectState` gets `isHost = sessionAccepted && isTerrainHost`, like the other match rules.
- **R2, clarified:** `isCalibrated` in `canToggleControlMode` means *past the calibration step*: face calibrated, or already flying with the keyboard. So M from keyboard back to face works before the face was ever calibrated; the calibration screen then shows, as on Join.
  - The client switches at once and sends `controlMode`; `controlModeRejected` reverts to `FACE`. A held M doesn't repeat (the server allows 5 changes per second).
  - On a new connection the server starts the pilot in `FACE`, so the client re-declares `KEYBOARD` after `handshake` if needed.
  - Under `FACE_REQUIRED`, M only logs when the pilot is past calibration and alive; otherwise it is ignored, as before.
- **R3:** other pilots' modes come from `worldSnapshot`, `shipRespawned`, `pilotIdentity`, `returnedToLobby` and `pilotControlMode`. A pilot with no mode yet shows `FACE`, the server's initial mode.
- **R4:** the panel is per browser and always editable. Sliders take `min` / `max` / `step` from `CONTROL_SETTINGS_LIMITS`, values snap to the step, and the deadzone shows in degrees. `window.localStorage` itself is read in a try/catch, because accessing it can throw when site data is blocked.
- **R5:** the old "webcam optional" state is now "declared mode is `KEYBOARD`": no calibration needed and camera errors don't block. `calibrationView.ts` (WS4) keeps its `webcamRequired` input, now fed with `controlMode === "FACE"`; WS7 can rename it.
- `SpacedOutSocketClient.ts` and `HudRenderer.ts` needed no change: `sendJson` already carries the new messages, and the HUD mode readout already shows `controlMode`.

## Acceptance criteria

- A non-host can't change the control rule; the host can, until the terrain is locked.
- Under `FACE_REQUIRED`, pressing M does nothing except log a short explanation.
- Under `ANY`, pressing M switches mode, and the roster badge updates on every client.
- Setting sensitivity to 2.0 visibly needs a smaller head turn. Reloading the page keeps the setting.

## Test plan (write first)

- `frontend/test/control-rule-view.test.ts`:
  - `canToggleControlMode` truth table;
  - `controlModeBadge` per mode;
  - rule select state per host/locked combination: `ruleSelectState({ isHost, terrainLocked })` → `editable` / `readonly`.
- `frontend/test/control-settings-view.test.ts`: the slider value ↔ settings mapping uses the limits and steps, and Reset gives the defaults.

Manual checks to add to MANUAL-TEST.md (WS6): the acceptance criteria above, with two browsers (host and guest).

## Tasks

1. Pure view helpers, red → green.
2. R1: replace the radio with the rule select.
3. R2 and R3: control-mode protocol and roster badge.
4. R4: settings panel and persistence.
5. R5: keyboard path when the rule is `ANY`.

## Definition of done

- Every requirement is covered by a test or by a MANUAL-TEST.md entry.
- `npm test` and `npm run build` pass.
- Checked by hand with two browsers.
