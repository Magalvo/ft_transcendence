# SpacedOut — manual webcam checks

These checks need a real person in front of a real webcam. Workstreams add items
here for any requirement that unit tests can't cover. Tick an item and note the
date and tester when it's checked.

## Setup

1. Start the stack from the repository root:
   ```bash
   docker compose -p ft_transcendence up -d --build
   ```
   Use `make` if it's installed.
2. Open `https://localhost:8443`, accept the self-signed certificate and log in.
3. Open **SpacedOut** and allow camera access.

## A. Pending from #7 and #10

- [ ] **Recalibration.** Center Face → Join → pick a team → fly. Change posture, then press C. The ship flies straight again and the camera does not jump sideways.
- [ ] **Steering feel.** Small head turns steer gently and a full turn equals holding a key. Tune `STEERING_FULL_ANGLE` and `PITCH_DOWN_FULL_ANGLE` in `headPose.ts` if needed.
- [ ] **Filter.** With the head still, the view doesn't shake. Fast turns respond without noticeable lag. Tune `ANGLE_FILTER` and `POSITION_FILTER` if needed.
- [ ] **Calibration timing.** Pressing Center Face the instant the face appears logs "Hold still…". A moment later it succeeds.
- [ ] **Face lost.** While flying in face mode, leave the frame. "FACE SIGNAL LOST" shows after about 0.3 s and disappears when you return.

## WS1

## WS2

Checked with a stand-alone harness in Vite dev (2026-10-27, Claude): wasm and model came from `/mediapipe/`, there were no CSP violations under the production policy, WebGL disabled gave `delegate === "CPU"`, and a denied camera gave `permission-denied`. The checks below still need the full stack and a real webcam.

- [ ] **CDNs blocked.** In DevTools → Network → *Block request domain*, block `cdn.jsdelivr.net` and `storage.googleapis.com`, then reload SpacedOut. Tracking starts. Network shows `vision_wasm_internal.wasm` and `face_landmarker.task` loaded from `https://localhost:8443/mediapipe/...`.
- [ ] **No WebGL.** Disable WebGL (Chrome: `--disable-webgl`, or `chrome://settings/system` → turn off graphics acceleration; Firefox: `webgl.disabled = true`). Tracking still starts, a bit slower. The console logs `[vision] Face landmarker running on the CPU delegate.` (`GPU` with WebGL on).
- [ ] **No CSP errors.** With the console open, load SpacedOut, allow the camera and fly for a moment. No `Content-Security-Policy` violations appear.
- [ ] **Denied camera.** Block the camera for the site and reload. The game reports the webcam as unavailable and nothing crashes. (WS4 turns the `permission-denied` kind into its own message.)

## WS3

## WS4

## WS5

## WS6

## WS7
