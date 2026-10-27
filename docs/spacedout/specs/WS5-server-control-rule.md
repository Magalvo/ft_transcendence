# WS5 — Server control rule

**Status:** Blocked on WS1
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
