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

Checked with a stand-alone harness in Vite dev (2026-10-27, Claude) that mounted the real `VisionController`, `FlowController` and calibration markup. Preload reached `ready` with no camera request. With the camera blocked, **Join** showed the permission-denied message and **Retry**, and Retry called `startCamera()` again. The calibration DOM saw no writes over 1 s idle. The page has one `<video>`, transformed `scaleX(-1)`. The checks below still need the full stack and a real webcam.

- [ ] **Spectators aren't prompted.** Open SpacedOut in a fresh profile (or reset the camera permission) and click **Spectate**. No permission prompt appears. The console logs `[vision] Face landmarker running on the … delegate.`, so the model still preloaded.
- [ ] **Prompt on Join.** Click **Join**. The permission prompt appears during the warp, not before.
- [ ] **Denied, then allowed, without a reload.** Deny the camera on Join. The calibration screen explains how to allow it and shows **Retry**. Allow the camera in the site settings, click **Retry**: the preview appears and tracking starts.
- [ ] **Optional → Required.** With the camera blocked, pick *Optional (Testing)*, Join and fly in keyboard mode. Switch to *Required*. The calibration screen shows the error and **Retry**. Allow the camera and click **Retry**: tracking starts without a reload.
- [ ] **No camera / camera busy.** Unplug the webcam (or open it in another app) and Join: the matching message and **Retry** show. Plug it back in (or close the other app) and click **Retry**: tracking starts.
- [ ] **Detection pauses.** Calibrate, then stay on the faction screen. Record 5 s in DevTools → Performance: no `detectForVideo` calls. Do the same while spectating and while paused.
- [ ] **Detection runs when needed.** Record while calibrating and while flying in face mode: `detectForVideo` runs about once per camera frame. In keyboard mode after calibrating, freelook still follows your head.
- [ ] **Keyboard freelook before calibration.** In *Optional* mode, Join and fly with the keyboard without calibrating. Turning your head doesn't move the view.
- [ ] **Mirrored preview.** On the calibration screen, the preview shows your face. Moving your head to your right moves the image to the right, like a mirror.
- [ ] **Face indicator.** The badge on the preview reads "Face detected" (green) while your face is in frame and "No face" when you leave it.
- [ ] **Preview hidden in flight.** After calibrating and picking a faction, no preview shows. Face steering keeps working while the `<video>` is hidden, so the detection loop still gets frames.

## WS5

## WS6

## WS7
