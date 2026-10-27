# SpacedOut face controls — remaining audit work

This folder plans the open items from the SpacedOut webcam-control audit so
several sessions (people or agents) can work on them in parallel without
stepping on each other.

- [AUDIT.md](AUDIT.md): every audit finding, its status, and which workstream owns it.
- [specs/](specs/): one spec per workstream (WS1–WS7), the contract each session implements.
- [MANUAL-TEST.md](MANUAL-TEST.md): checks that need a person at the webcam.

## Methodology: spec-driven, test-first

**SDD: the spec is the contract.** Each workstream has a spec with numbered
requirements (`WSn-Rk`), frozen interfaces where other workstreams depend on
it, and acceptance criteria. Implement the spec, not your own reading of the audit.

- If the spec is wrong, ambiguous or impossible, change the spec **in the same
  PR** and say why in the PR description. Don't silently diverge.
- Interfaces marked **Frozen** are consumed by a later workstream. Changing one
  needs a note in the consuming spec as well.

**TDD: red → green → refactor, per requirement.**

1. Write the tests listed in the spec's *Test plan* first. Run them and confirm
   they fail for the expected reason. That's the red step.
2. Write the minimum code that makes them pass (green).
3. Refactor with the tests green. Then go to the next requirement.
4. In the PR description, list each requirement with the tests that cover it.
   Requirements that can only be checked by hand go to
   [MANUAL-TEST.md](MANUAL-TEST.md) instead.

Logic goes in **pure modules** (no DOM, MediaPipe, uWebSockets or native
addons) so it runs under plain `node --test`. Glue code that only wires pure
modules to the browser or server stays thin and is checked by hand.

## Waves and parallelism

A wave starts once every workstream it depends on is merged into `main`.
Workstreams in the same wave own disjoint files, so they can run at the same time.

| Wave | Workstream | Audit items | Depends on |
|---|---|---|---|
| 1 | [WS1 — Server telemetry validation](specs/WS1-server-telemetry-validation.md) | 6 | — |
| 1 | [WS2 — Vision runtime](specs/WS2-vision-runtime.md) | 12 (detection), 13, 14 | — |
| 1 | [WS3 — Control settings core](specs/WS3-control-settings-core.md) | 18 (logic) | — |
| 2 | [WS4 — Camera UX and flow](specs/WS4-camera-ux-flow.md) | 7, 8, 10, 12 (DOM), 15 | WS2 |
| 2 | [WS5 — Server control rule](specs/WS5-server-control-rule.md) | 3 (server) | WS1 |
| 3 | [WS6 — Client control rule and settings UI](specs/WS6-client-control-rule-settings-ui.md) | 3 (client), 9, 18 (UI) | WS3, WS4, WS5 |
| 4 | [WS7 — Game refactor and cleanup](specs/WS7-game-refactor.md) | 17 | WS1–WS6 |

Audit item 16 (tests for the pose math) is done. Every workstream keeps adding tests as part of TDD.

## File ownership

Only the workstream listed may edit a file during its wave. If you need a change
in a file you don't own, stop and note it in your PR, or coordinate first.

| File / area | W1 | W2 | W3 | W4 |
|---|---|---|---|---|
| `SpacedOut/backend/server.js` | WS1 | WS5 | — | WS7 |
| `SpacedOut/backend/*.js` (new pure modules), `SpacedOut/backend/test/` | WS1 | WS5 | — | — |
| `SpacedOut/backend/package.json`, `.github/workflows/ci.yml` | WS1 | — | — | — |
| `frontend/src/games/spacedout/VisionController.ts`, `visionErrors.ts` | WS2 | — | WS6 (settings pass-through only) | WS7 |
| `frontend/vite.config.ts`, `frontend/nginx.conf.template`, `frontend/Dockerfile`, `frontend/scripts/` | WS2 | — | — | — |
| `frontend/src/games/spacedout/headPose.ts`, `controlSettings.ts` | WS3 | WS4 (R3 only) | — | WS7 |
| `frontend/src/games/spacedout/SpacedOutGame.ts` | WS1 (R5/R7 hooks only) | WS4 | WS6 | WS7 |
| `FlowController.ts`, `HudRenderer.ts`, `pages/SpacedOut.ts`, `style.css` | — | WS4 | WS6 | WS7 |
| `SpacedOutSocketClient.ts` | WS1 (R5 only) | — | WS6 | WS7 |
| `frontend/test/*` | new test files belong to whoever creates them; don't edit another workstream's test file in the same wave |

## Working on a workstream

1. Branch from the latest `main`: `spacedout/ws<N>-<slug>` (for example `spacedout/ws2-vision-runtime`).
2. Read this README, then your spec. Set the spec's **Status** line to
   `In progress (<branch>)`. Only your workstream edits that line.
3. Follow the TDD loop above, one requirement at a time.
4. Before opening the PR, run every check:
   ```bash
   cd frontend && npm test && npm run build
   ```
   ```bash
   cd SpacedOut/backend && npm test
   ```
   The backend command only works after WS1 adds the test script.
5. Open the PR against `main` with the title `[WSn] <summary>`. In the
   description, map each requirement to its tests and list the manual checks
   you added to MANUAL-TEST.md.
6. Once merged, set the spec's **Status** to `Done (#<PR>)`.

### Starting a session

To start a session on a workstream:

> Implement `docs/spacedout/specs/WS2-vision-runtime.md`, following the methodology and file ownership in `docs/spacedout/README.md`.

## Test conventions

- **Frontend:** `node:test` with `--experimental-strip-types`.
  - Test files import sources with the `.ts` extension, as in `frontend/test/head-pose.test.ts`.
  - Code under test can't use TypeScript-only runtime syntax (enums, parameter properties). `tsconfig.json` enforces this with `erasableSyntaxOnly`.
- **SpacedOut server:** CommonJS and plain `node --test`.
  - `server.js` loads uWebSockets and a native addon, so tests import only the new pure modules, never `server.js`.
- **Time:** functions that depend on time take `nowMs` as a parameter, so tests stay deterministic.
