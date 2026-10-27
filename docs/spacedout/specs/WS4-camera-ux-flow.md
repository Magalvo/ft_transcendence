# WS4 — Camera UX and flow

**Status:** Blocked on WS2
**Wave:** 2. **Depends on:** WS2 (frozen `VisionController` / `VisionError` API). **Audit items:** 7, 8 (UX), 10, 12 (DOM writes), 15.

## Context

`SpacedOutGame.start()` calls `vision.init()` as soon as the page opens, so
spectators get a permission prompt too. A camera failure sets `visionFailed`
for good, and only a reload recovers. Keyboard-mode freelook reads
`vision.yawInput`, which holds *raw* angles until calibration.
`updateCalibrationControls()` writes to the DOM on every animation frame.
The calibration screen doesn't show the camera, so players can't check their
framing.

## Goal

The camera is requested only when a player chooses to fly. Failures explain
themselves and can be retried. Detection runs only while needed. Players see
themselves while calibrating.

## Scope

**Owns (wave 2):**
- `SpacedOutGame.ts`, `FlowController.ts`, `pages/SpacedOut.ts` and `style.css`
- New `cameraFlow.ts` and `calibrationView.ts` (pure) in `frontend/src/games/spacedout/`, with their tests
- `headPose.ts`, for R3 only (removing the raw-pose passthrough)

**Must not edit:** `VisionController.ts`. If its API is insufficient, ask for a WS2 follow-up.

## Requirements

- **WS4-R1 (item 7):** The page calls `vision.preload()` on start, with no prompt. `vision.startCamera()` is called only when the user clicks **Join**. Spectating never requests the camera.
- **WS4-R2:** Pure state machine `cameraFlow.ts`:
  - states: `idle → preloading → ready → requesting → live`, plus `error(kind)`;
  - events: `preloadStarted`, `preloadDone`, `preloadFailed(kind)`, `cameraRequested`, `cameraStarted`, `cameraFailed(kind)`, `retry`, `stopped`;
  - invalid events leave the state unchanged.
  - The game derives `visionReady` / `visionFailed` from this state instead of booleans.
- **WS4-R3 (item 10):** Keyboard freelook uses only calibrated inputs; uncalibrated, it's 0.
  - Remove the "uncalibrated → raw passthrough" branch from `HeadPoseTracker.update()`.
  - Before calibration, the outputs stay at 0. Update the existing test that asserts the passthrough.
- **WS4-R4 (item 8):** Each `VisionErrorKind` maps to a clear message and an action:
  - `permission-denied` → how to re-enable the camera in the browser, plus a **Retry** button;
  - `no-camera` / `camera-busy` → **Retry**;
  - `insecure-context` → open the site over HTTPS (no retry);
  - `model-load-failed` → **Retry** (calls `preload()` again).
  - The mapping is a pure function in `calibrationView.ts`.
  - Retry works after switching the webcam requirement from Optional to Required.
- **WS4-R5 (item 12):** `updateCalibrationControls()` touches the DOM only when its derived view state changes. A pure `calibrationViewKey(state)` builds a comparable key, so `animate()` can call it every frame cheaply.
- **WS4-R6 (item 12):** `vision.setActive(true)` only while calibrating or flying in face mode. It is `false` in the lobby, while spectating, paused, dead, or in keyboard mode with freelook unavailable. A pure `shouldDetect(state)` decides.
- **WS4-R7 (item 15):** The calibration screen shows a small mirrored preview of the video:
  - it is a CSS transform on the existing `<video>`, with no second stream;
  - it has a "face detected" indicator;
  - it is hidden during flight.

## Acceptance criteria

- Opening SpacedOut and clicking **Spectate** never shows a permission prompt.
- Denying the camera shows the permission message. Allowing it in the browser settings and clicking **Retry** starts tracking without a reload.
- In the lobby after calibrating, DevTools Performance shows no `detectForVideo` calls.
- The calibration screen shows a mirrored preview, and the indicator turns on when a face is visible.

## Test plan (write first)

- `frontend/test/camera-flow.test.ts`:
  - every valid transition;
  - invalid events are ignored;
  - retry from each error kind goes to `requesting` (or `preloading` for `model-load-failed`);
  - `stopped` from any state goes to `idle`.
- `frontend/test/calibration-view.test.ts`:
  - message/action per error kind;
  - `calibrationViewKey` is equal for equal states and differs when any shown field changes;
  - `shouldDetect` truth table.
- `frontend/test/head-pose.test.ts`: the passthrough test becomes "outputs stay 0 before calibration".

Manual checks to add to MANUAL-TEST.md (WS4):
- the acceptance criteria above;
- the preview is mirrored, so moving right moves right on screen.

## Tasks

1. R2: state machine, red → green.
2. R4 to R6: pure view helpers, red → green.
3. R3: head-pose change and its test update.
4. Wire R1, R4, R5 and R6 into `SpacedOutGame` / `FlowController` / page.
5. R7: preview markup and CSS; manual check.

## Definition of done

- Every requirement is covered by a test or by a MANUAL-TEST.md entry.
- `npm test` and `npm run build` pass.
- The acceptance criteria were checked in a browser.
