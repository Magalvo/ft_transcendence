# WS7 — Game refactor and cleanup

**Status:** Blocked on WS1–WS6
**Wave:** 4, run alone. **Depends on:** every other workstream being merged. **Audit item:** 17.

## Context

`SpacedOutGame.ts` (~2,700 lines) mixes networking, input, flight physics,
camera, HUD wiring and DOM flow. It has magic numbers spread around (0.85,
0.95, 18, 0.1, 0.15…), a large commented-out flight block, and unprofessional
comments. Every other workstream touches it, which is why this runs last.

## Goal

The same behavior, in smaller modules whose logic can be tested.

## Scope

**Owns (wave 4):** every file in `frontend/src/games/spacedout/` and their tests.
No server changes.

## Requirements

- **WS7-R1:** Characterization tests come **before** moving code. Extract the pure flight step first, unchanged, as `flightModel.ts`:
  - signature: `stepFlight(state, inputs, deltaS)` → `{ quaternion, forward, position }`;
  - it covers the rotation from yaw/pitch, forward movement and the planetary curvature correction;
  - pin today's outputs for a set of inputs with tests.
- **WS7-R2:** Move the tuning numbers into `flightConfig.ts`, as named and commented constants:
  - turn rates `0.95` / `0.85`;
  - the movement scale `18`;
  - camera smoothing factors;
  - freelook limits;
  - speed limits.
  - The values don't change.
- **WS7-R3:** Split `SpacedOutGame.ts` along clear seams. Each new file should stay under about 600 lines. Suggested split:
  - `InputController` (keyboard/mouse/throttle);
  - `CameraRig` (`updateCamera`, death/spectator cameras);
  - `FlightModel` (R1);
  - `NetworkSync` (telemetry, message handlers).
  - `SpacedOutGame` stays as the orchestrator.
- **WS7-R4:** Delete the commented-out flight block and the joke comments. Fix the comments that say "Assuming… swap if needed" by checking the behavior and documenting it.
- **WS7-R5:** No behavior change. The full MANUAL-TEST.md run (sections A and WS1–WS6) passes after the refactor.

## Test plan (write first)

`frontend/test/flight-model.test.ts`, written against the extracted but unchanged code:
- level flight moves forward by `speed * delta * 18`;
- a pure yaw input rotates the heading by `yaw * delta * 0.95`;
- a pure pitch input by `pitch * delta * 0.85`;
- the curvature correction keeps the ship tangent to the sphere after a step;
- the outputs are always normalized quaternions and unit forward vectors.

## Tasks

1. R1: extract `stepFlight` verbatim and pin it with tests.
2. R2: constants, with tests still green.
3. R3: move one module at a time, running `npm test` and `npm run build` after each move.
4. R4: cleanup.
5. R5: full manual run.

## Definition of done

- Tests and the build pass.
- `SpacedOutGame.ts` is under 1,000 lines.
- The full MANUAL-TEST.md pass is recorded in the PR.
