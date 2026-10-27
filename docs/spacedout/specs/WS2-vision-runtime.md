# WS2 — Vision runtime

**Status:** In progress (spacedout/ws2-vision-runtime)
**Wave:** 1. **Depends on:** nothing. **Audit items:** 12 (detection loop), 13, 14, and 8 (error kinds).

## Context

`VisionController.init()` loads the MediaPipe wasm from jsDelivr and the face
model from `storage.googleapis.com`, both without integrity checks. It always
uses the GPU delegate, and then requests the camera straight away. Detection
runs on its own `requestAnimationFrame` loop for as long as the controller
lives, even in the lobby or while paused. Errors reach the game as raw
`Error`s, so the UI can't tell "permission denied" apart from "no camera".

## Goal

A `VisionController` that loads from the app's own origin and survives
machines without WebGL. It splits "load the model" from "turn on the camera",
can pause detection, and reports typed errors. WS4 builds the camera flow on
this API.

## Scope

**Owns (wave 1):**
- `frontend/src/games/spacedout/VisionController.ts`
- New `visionErrors.ts`, `visionAssets.ts`, `delegateFallback.ts` and `frameScheduler.ts` (holds R7's `pickFrameScheduler`) in the same folder
- `frontend/vite.config.ts`, `frontend/nginx.conf.template` (CSP), `frontend/Dockerfile`, new `frontend/scripts/`
- `frontend/package.json` (scripts only), `frontend/test/mediapipe-version.test.ts`, new test files
- `.gitignore` entries for generated assets (`frontend/.gitignore`)

**Must not edit:** `SpacedOutGame.ts`. It keeps calling `init(onReady)` and `stop()`, which must keep working. WS4 migrates the game to the new API.

## Frozen interface (consumed by WS4)

```ts
// visionErrors.ts
export type VisionErrorKind =
  | "permission-denied"   // NotAllowedError / SecurityError
  | "no-camera"           // NotFoundError / OverconstrainedError
  | "camera-busy"         // NotReadableError / AbortError from getUserMedia
  | "insecure-context"    // !isSecureContext or navigator.mediaDevices missing
  | "model-load-failed"   // wasm or model fetch/instantiate failed
  | "unknown";
export class VisionError extends Error { readonly kind: VisionErrorKind }
export function classifyCameraError(
  error: unknown,
  env: { isSecureContext: boolean; hasMediaDevices: boolean },
): VisionErrorKind;

// VisionController.ts (new members; existing getters stay)
preload(): Promise<void>;          // wasm + model only, no permission prompt; idempotent; throws VisionError("model-load-failed")
startCamera(): Promise<void>;      // calls preload() if needed; throws VisionError; safe to call again after a failure
setActive(active: boolean): void;  // pauses/resumes detection without releasing the camera
readonly delegate: "GPU" | "CPU" | null;
init(onReady: () => void): Promise<void>; // kept: preload() + startCamera() + onReady on first frame
```

## Requirements

- **WS2-R1:** `classifyCameraError` maps DOMException names to kinds as in the comment above.
  - When the context is insecure or there is no `navigator.mediaDevices`, the result is `insecure-context`, whatever the error says.
  - Anything else is `unknown`.
- **WS2-R2:** `createWithDelegateFallback(create)` in `delegateFallback.ts` (pure, generic):
  - calls `create("GPU")`;
  - if that throws, calls `create("CPU")`;
  - returns `{ value, delegate }`;
  - if both throw, it rethrows the CPU error.
  - `VisionController` uses it, and `delegate` reflects the outcome.
- **WS2-R3:** Self-hosted wasm.
  - A build step copies `node_modules/@mediapipe/tasks-vision/wasm/*` into `public/mediapipe/wasm/`, using a small vite plugin or a `prebuild`/`predev` script with no new dependencies.
  - The copied folder is gitignored.
  - `visionAssets.ts` exports `mediapipeAssetUrls(baseUrl)` → `{ wasmDir, modelPath }`, built from `import.meta.env.BASE_URL` at the call site.
- **WS2-R4:** Self-hosted model.
  - `scripts/fetch-face-model.mjs` downloads the pinned model URL and checks it against a pinned **SHA-256**. It writes `public/mediapipe/face_landmarker.task`, which is gitignored.
  - The pure checksum check is `verifySha256(buffer, expectedHex)`, exported and tested.
  - The script runs in the Dockerfile builder stage before `npm run build`. Local dev runs it on demand, and `predev` runs it if the file is missing.
  - CI's `npm run build` must not need network access for the model: guard with an env flag, or skip when the file exists.
    *Implemented:* `npm run build` never downloads (its `prebuild` only copies the wasm). The script keeps an existing file whose digest matches and re-downloads otherwise. `predev` passes `--optional`, so offline dev only warns.
  - `verifySha256` lives in `scripts/fetch-face-model.mjs`; a `.d.mts` next to it types it for `tsc` and the tests.
- **WS2-R5:** CSP.
  - Remove `https://cdn.jsdelivr.net` from `script-src` and `connect-src`, and `https://storage.googleapis.com` from `connect-src`, after confirming with grep that nothing else uses them.
  - Keep `'wasm-unsafe-eval'`.
  - Update `mediapipe-version.test.ts` to assert that `VisionController.ts` has no CDN URLs and that the copied wasm matches the installed package version.
- **WS2-R6:** `preload()` / `startCamera()` split, with the existing lifecycle guarantees from #7 kept:
  - a `disposed` check after every await;
  - `startCamera()` resolves once the video is playing and detection is scheduled; `init()` calls `onReady` then. A failed `video.play()` releases the camera and throws `VisionError("unknown")`;
  - `stop()` closes the landmarker and stops the tracks.
- **WS2-R7:** Detection loop.
  - Use `video.requestVideoFrameCallback` when it is available, otherwise `requestAnimationFrame`.
  - While `setActive(false)`, don't run `detectForVideo`. The camera stays on, so resuming is instant.
  - A pure scheduler choice `pickFrameScheduler(video)` is tested with fakes. It lives in `frameScheduler.ts` (not `VisionController.ts`, which imports MediaPipe and can't load under `node --test`) and takes an optional second argument for `requestAnimationFrame`/`cancelAnimationFrame`, so tests can pass fakes.

## Acceptance criteria

- With network access to jsDelivr and googleapis blocked, the game loads the face tracker from `https://localhost:8443/mediapipe/...`.
- In a browser with WebGL disabled, tracking starts with `delegate === "CPU"`.
- `preload()` never triggers a permission prompt.
- `startCamera()` after a denied prompt throws `VisionError` with kind `permission-denied`.

## Test plan (write first)

- `frontend/test/vision-errors.test.ts`:
  - each DOMException name → kind;
  - insecure context wins;
  - non-DOMException input → `unknown`.
- `frontend/test/delegate-fallback.test.ts`:
  - GPU ok;
  - GPU fails then CPU ok;
  - both fail → CPU error rethrown;
  - `create` is called with the right delegate strings.
- `frontend/test/vision-assets.test.ts`: URL building with `/` and `/sub/` base URLs.
- `frontend/test/face-model-checksum.test.ts`: `verifySha256` accepts a matching digest and rejects a mismatch.
- `frontend/test/frame-scheduler.test.ts`: picks rVFC when present, rAF otherwise.
- `frontend/test/mediapipe-version.test.ts`: updated as in R5.

Manual checks to add to MANUAL-TEST.md (WS2):
- tracking works with the CDNs blocked in DevTools;
- tracking works with WebGL disabled;
- no CSP errors in the console.

## Tasks

1. R1 and R2: pure modules, red → green.
2. R3 and R4: asset pipeline and checksum, red → green on the pure parts; wire up the Dockerfile and scripts.
3. R6 and R7: refactor `VisionController` onto the new API, keeping `init()` and `stop()` behavior.
4. R5: tighten the CSP, update the version test, and check in the browser.

## Definition of done

- Every requirement is covered by a test or by a MANUAL-TEST.md entry.
- `npm test` and `npm run build` pass, both locally and in CI.
- `docker compose up --build` serves the model from the app's origin.
