# WS3 — Control settings core

**Status:** Not started
**Wave:** 1. **Depends on:** nothing. **Audit item:** 18 (logic only; the UI is in WS6).

## Context

Face steering uses fixed constants in `headPose.ts`: deadzone `0.08`, full
deflection at `0.34` rad (`0.27` rad looking down), and fixed signs. Neck
mobility varies a lot between players, so these need to be per-player settings.

## Goal

A pure, tested settings model that `headPose.ts` applies. With default
settings, the output is exactly what the game produces today.

## Scope

**Owns (wave 1):**
- `frontend/src/games/spacedout/headPose.ts`
- New `frontend/src/games/spacedout/controlSettings.ts`
- `frontend/test/head-pose.test.ts`
- New `frontend/test/control-settings.test.ts`

**Must not edit:** `SpacedOutGame.ts`, `VisionController.ts` (WS2), or any UI. Wiring settings into the game is WS6.

## Frozen interface (consumed by WS6)

```ts
// controlSettings.ts
export interface ControlSettings {
  sensitivity: number;   // 0.5–2.0, default 1.0 (higher = full deflection with a smaller head turn)
  deadzone: number;      // 0.02–0.20 rad, default 0.08
  invertYaw: boolean;    // default false
  invertPitch: boolean;  // default false
}
export const DEFAULT_CONTROL_SETTINGS: Readonly<ControlSettings>;
export const CONTROL_SETTINGS_LIMITS: { sensitivity: { min; max; step }; deadzone: { min; max; step } };
export function sanitizeControlSettings(raw: unknown): ControlSettings;
export function loadControlSettings(storage: Pick<Storage, "getItem"> | null): ControlSettings;
export function saveControlSettings(storage: Pick<Storage, "setItem"> | null, settings: ControlSettings): void;

// headPose.ts (additions)
computeFlightInputs(pose, calibration, settings?: ControlSettings): FlightInputs; // default = DEFAULT_CONTROL_SETTINGS
class HeadPoseTracker { setSettings(settings: ControlSettings): void }
```

## Requirements

- **WS3-R1:** `sanitizeControlSettings` returns a complete, valid object for any input.
  - Numbers are clamped to the limits.
  - Anything missing, non-numeric or `NaN` falls back to the default.
  - Booleans are coerced only from real booleans; anything else gets the default.
- **WS3-R2:** Sensitivity scales the angle *range past the deadzone*:
  - `fullAngle = deadzone + (BASE_FULL_ANGLE - BASE_DEADZONE) / sensitivity`
  - The same applies to the downward pitch angle, using its own base.
- **WS3-R3:** The deadzone setting replaces `STEERING_DEADZONE` in the curve. Inverts flip the sign of the final yaw or pitch input. Parallax is unaffected.
- **WS3-R4:** With `DEFAULT_CONTROL_SETTINGS`, `computeFlightInputs` produces **identical** results to the current version. A regression test compares against the current constants.
- **WS3-R5:** `loadControlSettings` / `saveControlSettings`:
  - use the key `spacedout.controlSettings.v1`;
  - store JSON;
  - treat a `null` storage, a throwing storage or corrupt JSON as defaults, and never throw.
- **WS3-R6:** `HeadPoseTracker.setSettings` takes effect from the next `update()`. Calibration is unaffected.

## Acceptance criteria

- Sensitivity 2.0 reaches full yaw with half the head turn past the deadzone that 1.0 needs.
- With `invertPitch`, looking up gives a negative pitch input.
- Loading from storage that throws on `getItem` returns the defaults.

## Test plan (write first)

`frontend/test/control-settings.test.ts`:
- `sanitize`: defaults for `undefined` / `null` / `{}` / a string;
- `sanitize`: clamps above the maximum and below the minimum, rejects `NaN`;
- `sanitize`: booleans coerced only from booleans;
- load / save round trip with an in-memory storage;
- load from corrupt JSON gives the defaults;
- load / save with a throwing storage and with a `null` storage never throws.

`frontend/test/head-pose.test.ts` (additions):
- defaults give identical output to the explicit current constants (R4), over a grid of angles;
- sensitivity 2 halves the angle needed for full deflection;
- deadzone 0.15 ignores a 0.12 rad turn;
- `invertYaw` and `invertPitch` flip the signs;
- `tracker.setSettings` applies to later frames.

## Tasks

1. R1 and R5: the `controlSettings.ts` module, red → green.
2. R2 to R4: thread `settings` through `applySteeringCurve` / `computeFlightInputs`, writing the regression test (R4) first.
3. R6: add `setSettings` to the tracker.

## Definition of done

- All tests pass and the build passes.
- Default behavior is unchanged, as proven by the R4 test.
- No UI or game changes.
