# WS6 — Client control rule and settings UI

**Status:** Blocked on WS3, WS4, WS5
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
