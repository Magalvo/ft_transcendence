# WS1 — Server telemetry validation

**Status:** In progress (spacedout/ws1-server-telemetry-validation)
**Wave:** 1. **Depends on:** nothing. **Audit item:** 6.

## Context

`handleBinaryMessage` in `SpacedOut/backend/server.js` accepts any 24-byte
telemetry packet whose six floats are finite. It copies the position and
direction into the player and broadcasts them. A modified client can teleport
or fly at any speed, and the server uses these positions for hit detection
with rewind.

The `suicide` JSON message ("DEV MODE") applies 9999 damage to the sender.
The client sends it on terrain collision (`SpacedOutGame.ts`, around line 1933).

## Goal

The server only accepts movement a legitimate client could produce, and puts a
client back on the server's last accepted position when it drifts. Terrain
crashes use a purpose-named message instead of a dev command.

## Scope

**Owns (wave 1):**
- `SpacedOut/backend/server.js`: the telemetry handler, the `suicide` handler, and spawn/respawn code (baseline reset only).
- New `SpacedOut/backend/telemetryGuard.js`.
- New `SpacedOut/backend/test/`.
- `SpacedOut/backend/package.json`: the `test` script.
- `.github/workflows/ci.yml`: a new job.
- `frontend/src/games/spacedout/SpacedOutGame.ts` and `SpacedOutSocketClient.ts`: only the R5 message handler and the R7 crash message. (The spec said "R6"; R6 is the server-side baseline reset, the crash message is R7. `SpacedOutSocketClient.ts` needed no change: it already forwards every JSON message.)

**Out of scope:** server-side flight simulation, anti-cheat for weapons, and control mode (WS5).

## Facts to keep in sync

- The client moves `speed * delta * 18` units per second, with `MAX_FLIGHT_SPEED = 350` (`SpacedOutGame.ts`). The fastest legitimate speed is therefore **6300 units/s**.
- Telemetry is sent every `TELEMETRY_INTERVAL_MS = 80` (`SpacedOutGameShared.ts`).
- `WORLD_RADIUS = 50000` on both client and server.
- `telemetryGuard.js` must state these values as named constants, with a comment pointing at their client source.

## Requirements

- **WS1-R1:** Pure CommonJS module `telemetryGuard.js` exporting
  `validateTelemetry(baseline, sample, nowMs, limits = DEFAULT_LIMITS)`.
  - `baseline` is `{ x, y, z, timeMs }` or `null`.
  - `sample` is `{ x, y, z, dx, dy, dz }`.
  - Returns `{ ok: true }` or `{ ok: false, reason }`, where `reason` is one of `"non-finite"`, `"forward-not-unit"`, `"out-of-bounds"` or `"too-fast"`.
- **WS1-R2:** The forward vector length must be within `[0.9, 1.1]`.
- **WS1-R3:** The distance from the planet center must not exceed `WORLD_RADIUS * 3`. A ship below the surface is the crash logic's job, not this check's.
- **WS1-R4:** The distance from the baseline must not exceed `MAX_SPEED_UPS * elapsedS * SPEED_TOLERANCE + POSITION_SLACK`.
  - `elapsedS` is `nowMs - baseline.timeMs`, clamped to `[TELEMETRY_INTERVAL_MS, MAX_ELAPSED_MS]` and converted to seconds.
  - Defaults: tolerance `1.5`, slack `50`, max elapsed `2000 ms`.
  - With no baseline, the sample is accepted when R2 and R3 hold.
- **WS1-R5:** On a rejected sample, the server doesn't update or broadcast the player and increments `player.telemetryRejects`.
  - After `CORRECTION_AFTER_REJECTS = 3` consecutive rejects, it sends `{ type: "positionCorrection", x, y, z, dx, dy, dz }` with the last accepted pose. It sends at most one every `CORRECTION_COOLDOWN_MS = 500`.
  - A pure helper `shouldSendCorrection(state, nowMs)` makes this decision.
  - Accepted samples reset the counter.
  - The client applies a `positionCorrection` by setting its local position, forward vector and orientation to the received pose.
- **WS1-R6:** Every place the server positions a player resets that player's baseline to the new pose and `nowMs`. That covers joining a team (spawn), respawning, and returning to the lobby.
  - Returning to the lobby doesn't move the ship, so the baseline is reset at its current pose. The pilot is dead until the next `joinTeam`, which resets it again at the spawn.
- **WS1-R7:** Replace the `suicide` message with `terrainCollision`.
  - It applies lethal damage only if the player is alive, and is ignored if the player died less than `RESPAWN_DELAY_MS` ago.
  - A pure helper `shouldApplyTerrainCollision(player, nowMs, respawnDelayMs)` makes this decision. `destroyShip` records `player.lastDeathAt` for it, because `deadUntil` is reset to `0` on `joinTeam` and can't tell how long ago the ship died.
  - Remove the `suicide` handler.
  - The client sends `terrainCollision` instead of `suicide`.
- **WS1-R8:** Add a `npm test` script (`node --test "test/**/*.test.js"`) to `SpacedOut/backend/package.json`.
  - The spec first said `node --test test/`. Since Node 21, `node --test` treats a directory argument as a file to run and fails with `Cannot find module …/test` (seen on Node 24), so the script passes a glob, which `node --test` expands itself.
  - Add a CI job "SpacedOut server" that runs it with Node 22, without `npm ci`, because the pure modules have no dependencies.

## Acceptance criteria

- Given a baseline at spawn and a sample 500 units away 80 ms later, the sample is accepted.
- Given the same baseline and a sample 5000 units away 80 ms later, it is rejected as `too-fast`.
- Given a gap of 10 s since the baseline, the allowed distance is no larger than the allowance for 2 s.
- Given 3 rejected samples in a row, the client receives one `positionCorrection` and its ship snaps back.
- After respawning, the first sample at the respawn position is accepted.
- No `suicide` string remains in `frontend/` or `SpacedOut/backend/`. The legacy stand-alone prototype in `SpacedOut/frontend/index.html` still sends it, but it isn't part of the ft_transcendence stack or of WS1's files.

## Test plan (write first)

File `SpacedOut/backend/test/telemetry-guard.test.js`:
- accepts any finite sample when there is no baseline
- rejects non-finite values
- rejects a forward vector shorter than 0.9 or longer than 1.1
- rejects positions beyond 3× `WORLD_RADIUS`
- accepts movement at the maximum speed over one telemetry interval
- rejects a teleport within one interval (`too-fast`)
- clamps elapsed time: a 10 s gap allows no more than a 2 s gap
- `shouldSendCorrection`: false below 3 rejects; true at 3; false again inside the cooldown; true after it
- `shouldApplyTerrainCollision`: only for a live ship; ignored within `RESPAWN_DELAY_MS` of the last death

Manual checks to add to MANUAL-TEST.md (WS1):
- flying normally never triggers a correction, including at full throttle with server lag;
- crashing into terrain kills the ship once;
- respawning works.

## Tasks

1. R8 first: create the test scaffolding and the CI job, with one failing placeholder import of `telemetryGuard.js`.
2. R1–R4: red → green on `validateTelemetry`.
3. R5: red → green on `shouldSendCorrection`. Then wire it into `handleBinaryMessage`, and add the client handler.
4. R6: find every assignment of `player.x` / `p.x` for humans and reset the baseline there.
5. R7: rename the message on both ends.

## Definition of done

- Every requirement is covered by a test or by a MANUAL-TEST.md entry.
- The new CI job passes.
- The frontend tests and build pass.
- The PR lists each requirement with its tests.
