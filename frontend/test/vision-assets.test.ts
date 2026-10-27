import test from 'node:test';
import assert from 'node:assert/strict';

import { mediapipeAssetUrls } from '../src/games/spacedout/visionAssets.ts';

test('mediapipeAssetUrls builds same-origin paths for the root base URL', () => {
  assert.deepEqual(mediapipeAssetUrls('/'), {
    wasmDir: '/mediapipe/wasm',
    modelPath: '/mediapipe/face_landmarker.task',
  });
});

test('mediapipeAssetUrls keeps a sub-path base URL', () => {
  assert.deepEqual(mediapipeAssetUrls('/sub/'), {
    wasmDir: '/sub/mediapipe/wasm',
    modelPath: '/sub/mediapipe/face_landmarker.task',
  });
});

test('mediapipeAssetUrls tolerates a base URL without the trailing slash', () => {
  assert.deepEqual(mediapipeAssetUrls('/sub'), mediapipeAssetUrls('/sub/'));
});
