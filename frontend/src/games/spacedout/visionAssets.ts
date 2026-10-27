// MediaPipe wasm and the face model are served from the app's own origin:
// scripts/copy-mediapipe-wasm.mjs and scripts/fetch-face-model.mjs put them in
// public/mediapipe/. Pass import.meta.env.BASE_URL as baseUrl.
export function mediapipeAssetUrls(baseUrl: string): { wasmDir: string; modelPath: string } {
  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return {
    wasmDir: `${base}mediapipe/wasm`,
    modelPath: `${base}mediapipe/face_landmarker.task`,
  };
}
