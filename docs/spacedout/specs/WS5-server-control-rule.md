# WS5 — Server control rule

**Status:** In progress (spacedout/ws5-server-control-rule)
**Wave:** 2. **Depends on:** WS1 (`server.js` test scaffolding and ownership). **Audit item:** 3 (server side).

## Context

Whether the webcam is required is a radio button on each client. Even with
"Required", **M** switches to keyboard, and the server never learns which
control mode a pilot uses. In PvP, keyboard pilots have a clear advantage that
nobody can see.

## Goal

The match host decides the control rule, the server enforces it on the
declared control mode, and every client can see each pilot's mode.

The server can't prove a webcam is really in use, because the client could
lie. The guarantee is *declared and visible*, not *proven*. The PR must say
this.

## Scope

**Owns (wave 2):**
- `SpacedOut/backend/server.js`: match settings, player state, the new message, roster payloads
- New `SpacedOut/backend/controlRule.js`
- New `SpacedOut/backend/test/control-rule.test.js`

**Must not edit:** any frontend file (WS4 owns them in this wave; the client side is WS6).

## Frozen protocol (consumed by WS6)

```text
matchSettings.controlRule: "FACE_REQUIRED" | "ANY"        // in every existing matchSettings payload
client → server  { type: "controlMode", mode: "FACE" | "KEYBOARD" }
server → client  { type: "controlModeRejected", mode, rule }   // only to the sender
server → all     { type: "pilotControlMode", id, mode }        // on accepted change
pilot/roster payloads gain  controlMode: "FACE" | "KEYBOARD"
```

## Requirements

- **WS5-R1:** `sanitizeMatchSettings` accepts `controlRule`.
  - Anything other than `"ANY"` becomes `"FACE_REQUIRED"`, which is the default and matches today's default radio.
  - Move `sanitizeMatchSettings` into `controlRule.js`, or a small `matchSettings.js`, so it can be tested.
- **WS5-R2:** `isControlModeAllowed(rule, mode)`: `FACE` is always allowed; `KEYBOARD` only under `ANY`.
- **WS5-R3:** Players start with `controlMode: "FACE"`.
  - The server applies a `controlMode` message only when it's allowed; otherwise it replies `controlModeRejected`.
  - At most 5 changes per second per player; extra messages are ignored.
- **WS5-R4:** If the host switches the rule to `FACE_REQUIRED`, every pilot on `KEYBOARD` is set back to `FACE` and a `pilotControlMode` is broadcast for each.
  - Settings can only change while the terrain is unlocked, as today, so this never happens mid-match.
- **WS5-R5:** Every payload that describes a pilot (snapshot, join, roster) includes `controlMode`. A pure `describePilot(player)` builds this, with tests.

## Implementation notes

Added while implementing; the frozen protocol above is unchanged.

- **R1:** `DEFAULT_MATCH_SETTINGS` moved into `controlRule.js` together with `sanitizeMatchSettings`. Only the exact string `"ANY"` is kept. Until WS6 sends `controlRule`, every `updateMatchSettings` and `terrainFinalize` from today's client resets the rule to `FACE_REQUIRED`.
- **R3:** `resolveControlModeRequest(rule, currentMode, requestedMode)` decides each message: `"invalid"` (not `FACE` / `KEYBOARD`, ignored), `"rejected"` (send `controlModeRejected`), `"unchanged"` (already in that mode, nothing sent) or `"apply"` (change and broadcast `pilotControlMode`).
  - The rate limit is a fixed one-second window per player (`allowControlModeMessage(state, nowMs)`). It counts every `controlMode` message, rejected ones included, so a client can't flood rejections either. Ignored messages don't extend the window.
  - No login is needed to declare a mode, so spectators can declare it before joining.
- **R4:** The reset runs after every settings change: `updateMatchSettings`, and `terrainFinalize`, which applies the host's settings as it locks the terrain. Each `pilotControlMode` reset is broadcast before the `matchSettingsUpdated` / `terrainLocked` that carries the new rule.
- **R5:** `describePilot(player)` returns `{ team, userId, username, controlMode }` and is spread into `worldSnapshot` entries (`pos`), `shipRespawned` (join, respawn, bot respawn), `returnedToLobby` and `pilotIdentity`. Bots report `FACE`.

## Acceptance criteria

- Under `FACE_REQUIRED`, a raw `{type:"controlMode",mode:"KEYBOARD"}` sent from the DevTools console is rejected, and other clients see no change.
- Under `ANY`, the same message is broadcast to everyone as `pilotControlMode`.

## Test plan (write first)

`SpacedOut/backend/test/control-rule.test.js`:
- `sanitizeMatchSettings`: default rule, `"ANY"` kept, junk → `FACE_REQUIRED`, existing `gameMode` / `botsEnabled` behavior unchanged;
- `isControlModeAllowed` truth table;
- rate limiter: 5 accepted, the 6th within the same second ignored, accepted again after one second (inject `nowMs`);
- `describePilot` includes `controlMode`;
- `pilotsToResetOnRuleChange(players, newRule)` returns only keyboard pilots when the rule becomes `FACE_REQUIRED`.

Manual checks to add to MANUAL-TEST.md (WS5): the two acceptance criteria above, done from the DevTools console.

## Tasks

1. R1 and R2: extract and extend the settings sanitizer, red → green.
2. R3 and R4: rate limiter and rule-change helper, red → green; wire them into `server.js`.
3. R5: `describePilot` and the payload updates.

## Definition of done

- The "SpacedOut server" CI job passes.
- The protocol matches the frozen block above exactly.
- The PR states the declared-not-proven limitation.
