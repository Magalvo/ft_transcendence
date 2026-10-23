import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// VisionController loads the MediaPipe wasm runtime from a CDN; it must be the
// exact version of the JS bundle installed from package.json.
test('MediaPipe wasm URL is pinned to the installed package version', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const declared: string = pkg.dependencies['@mediapipe/tasks-vision'];
  assert.match(declared, /^\d+\.\d+\.\d+$/, 'package.json must pin an exact version');

  const source = readFileSync(
    new URL('../src/games/spacedout/VisionController.ts', import.meta.url),
    'utf8',
  );
  const pinned = source.match(/MEDIAPIPE_VERSION = "([^"]+)"/)?.[1];
  assert.equal(pinned, declared);
  assert.doesNotMatch(source, /tasks-vision@latest/);
});
