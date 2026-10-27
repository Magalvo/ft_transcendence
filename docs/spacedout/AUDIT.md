# SpacedOut webcam-control audit — findings and status

The audit (2026-10-27) covered the MediaPipe face-tracking controls: `VisionController`,
the game loop, flight and camera code in `SpacedOutGame.ts`, and how `SpacedOut/backend/server.js`
receives telemetry. Numbers match the original audit report.

| # | Severity | Finding | Status / owner |
|---|---|---|---|
| 1 | Critical | Recalibration read processed outputs as raw angles, so the neutral pose was wrong and the camera jumped | Done — #7 |
| 2 | Critical | Leaving the page while loading left the webcam on; `FaceLandmarker` never closed | Done — #7 |
| 3 | High | "Webcam required" is a client-side radio; M switches to keyboard anyway; server doesn't know each pilot's control mode | WS5 (server), WS6 (client) |
| 4 | High | Face input unbounded (up to ~4–7× keyboard) | Done — #10 |
| 5 | High | Pose from noisy z landmarks, single-frame calibration, no filtering | Done — #10 (One Euro filter, averaged calibration). Pose from the transformation matrix not done; revisit only if manual tests show yaw/pitch bias |
| 6 | High | Server trusts client telemetry (teleport/speed hacks); `suicide` dev message live | WS1 |
| 7 | Medium | Camera requested on page load, even for spectators | WS4 |
| 8 | Medium | No retry after a camera failure; vague error messages | WS2 (error kinds), WS4 (UX) |
| 9 | Medium | Switching the webcam radio mid-flight freezes the ship | WS6 (the radio is replaced by the server-side rule) |
| 10 | Medium | Keyboard freelook uses uncalibrated raw angles | WS4 |
| 11 | Medium | Losing the face isn't signalled | Done — #10 (HUD warning) |
| 12 | Medium | Detection on the main thread even when idle; DOM writes every frame | WS2 (detection loop), WS4 (DOM writes) |
| 13 | Medium | No GPU→CPU delegate fallback | WS2 |
| 14 | Low | Wasm and model loaded from third-party CDNs with no integrity check | WS2 |
| 15 | Low | No camera preview during calibration | WS4 |
| 16 | Low | No tests for the pose math | Done — #7, #10 |
| 17 | Low | `SpacedOutGame.ts` is 2700+ lines, with magic numbers and dead code | WS7 |
| 18 | Low | No sensitivity, deadzone or invert settings | WS3 (logic), WS6 (UI) |

Still open from earlier PRs: the in-game webcam test ([MANUAL-TEST.md](MANUAL-TEST.md), section A).
