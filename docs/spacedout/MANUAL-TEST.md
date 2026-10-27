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

Keep DevTools → Network → WS open on the SpacedOut socket, filtered on `positionCorrection`, for these checks.

- [ ] **No false corrections.** Join a team and fly for a few minutes, mostly at full throttle (mouse wheel up), with sharp turns and dives. No `positionCorrection` frame arrives and the ship never jumps. Repeat with DevTools → Network throttling set to *Slow 4G*: still no correction.
- [ ] **Snap back.** While flying, paste this in the console. It shifts the next 5 telemetry packets 5000+ units sideways:
  ```js
  let n = 0; const send = WebSocket.prototype.send;
  WebSocket.prototype.send = function (d) {
    if (d instanceof ArrayBuffer && d.byteLength === 24 && n < 5) {
      const f = new Float32Array(d.slice(0)); f[0] += 5000 * ++n; return send.call(this, f.buffer);
    }
    return send.call(this, d);
  };
  ```
  Exactly one `positionCorrection` arrives and the ship snaps back a short distance. A second client sees no teleport. Reload the page afterwards to remove the patch.
- [ ] **Terrain crash.** Dive into a mountain. The ship explodes once, one `shipDestroyed` arrives, and the respawn countdown starts. No `suicide` message appears in the WS frames; the client sends `terrainCollision`.
- [ ] **Respawn.** After the countdown, respawn. The ship appears at the spawn point and flies normally with no `positionCorrection`. Do the same after *Return to lobby* → pick a team again.

## WS2

Checked with a stand-alone harness in Vite dev (2026-10-27, Claude): wasm and model came from `/mediapipe/`, there were no CSP violations under the production policy, WebGL disabled gave `delegate === "CPU"`, and a denied camera gave `permission-denied`. The checks below still need the full stack and a real webcam.

- [ ] **CDNs blocked.** In DevTools → Network → *Block request domain*, block `cdn.jsdelivr.net` and `storage.googleapis.com`, then reload SpacedOut. Tracking starts. Network shows `vision_wasm_internal.wasm` and `face_landmarker.task` loaded from `https://localhost:8443/mediapipe/...`.
- [ ] **No WebGL.** Disable WebGL (Chrome: `--disable-webgl`, or `chrome://settings/system` → turn off graphics acceleration; Firefox: `webgl.disabled = true`). Tracking still starts, a bit slower. The console logs `[vision] Face landmarker running on the CPU delegate.` (`GPU` with WebGL on).
- [ ] **No CSP errors.** With the console open, load SpacedOut, allow the camera and fly for a moment. No `Content-Security-Policy` violations appear.
- [ ] **Denied camera.** Block the camera for the site and reload. The game reports the webcam as unavailable and nothing crashes. (WS4 turns the `permission-denied` kind into its own message.)

## WS3

WS3 adds only the settings model; nothing in the game reads it until WS6. Checks of the settings themselves (sensitivity, deadzone, invert) are in the WS6 section once its UI exists.

- [ ] **Default feel unchanged.** Calibrate and fly in face mode. Steering feels as before WS3: small turns are ignored, a turn of roughly 20° gives full yaw, and looking down saturates sooner than looking up. (Covered exactly by the R4 regression test; this is a sanity check on the real build.)

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

WS5 is server-only: the client doesn't send `controlMode` or show modes until WS6, so these checks use the DevTools console. Open SpacedOut in two browsers (A is the match host, the first to connect), log in on both, and keep DevTools → Network → WS open on the SpacedOut socket in both. In each console, grab the socket first:
```js
let so; const _send = WebSocket.prototype.send;
WebSocket.prototype.send = function (d) { so = this; return _send.call(this, d); };
```
Wait a second for the next telemetry or ping frame so `so` is set. Checked with a stand-alone harness that loaded `server.js` with uWebSockets and the native addon stubbed (2026-10-27, Claude): rejection, broadcast, reset on rule change and the rate limit behaved as below. These checks still need the full stack.

- [ ] **Keyboard rejected under FACE_REQUIRED.** With the default rule (the current client always sends `FACE_REQUIRED`), in B's console run `so.send(JSON.stringify({ type: "controlMode", mode: "KEYBOARD" }))`. B receives `{"type":"controlModeRejected","mode":"KEYBOARD","rule":"FACE_REQUIRED"}`. Neither A nor B receives a `pilotControlMode` frame.
- [ ] **Keyboard broadcast under ANY.** Before picking a team, in A's console run `so.send(JSON.stringify({ type: "updateMatchSettings", settings: { gameMode: "PVP", controlRule: "ANY" } }))`. Both receive `matchSettingsUpdated` with `controlRule: "ANY"`. Send the `controlMode` / `KEYBOARD` message from B again: both A and B receive `{"type":"pilotControlMode","id":<B>,"mode":"KEYBOARD"}`. A third browser that opens SpacedOut now sees `controlMode: "KEYBOARD"` for B in its `worldSnapshot`.
- [ ] **Rule change resets keyboard pilots.** Continuing from the previous check, in A's console send `updateMatchSettings` with `settings: { gameMode: "PVP" }` (no `controlRule`). Both receive `pilotControlMode` with B's id and `mode: "FACE"`, then `matchSettingsUpdated` with `controlRule: "FACE_REQUIRED"`.
- [ ] **Rate limit.** In B's console run `for (let i = 0; i < 10; i++) so.send(JSON.stringify({ type: "controlMode", mode: "KEYBOARD" }))` under `FACE_REQUIRED`. B receives exactly 5 `controlModeRejected` frames.

## WS6

## WS7
