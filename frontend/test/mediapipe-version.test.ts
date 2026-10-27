import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { copyMediapipeWasm } from '../scripts/copy-mediapipe-wasm.mjs';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const pkg = JSON.parse(read('../package.json'));
const declared: string = pkg.dependencies['@mediapipe/tasks-vision'];
const installedDir = fileURLToPath(new URL('../node_modules/@mediapipe/tasks-vision/', import.meta.url));
const publicWasmDir = fileURLToPath(new URL('../public/mediapipe/wasm/', import.meta.url));

// The wasm runtime is copied from the installed package, so it always matches
// the JS bundle; package.json must still pin an exact version (never a range
// or "latest", which would pull new third-party code in without a review).
test('MediaPipe is pinned to an exact, installed version', () => {
  assert.match(declared, /^\d+\.\d+\.\d+$/, 'package.json must pin an exact version');
  const installed = JSON.parse(readFileSync(join(installedDir, 'package.json'), 'utf8')).version;
  assert.equal(installed, declared);
});

test('VisionController loads MediaPipe from the app origin, not a CDN', () => {
  const source = read('../src/games/spacedout/VisionController.ts');
  assert.doesNotMatch(source, /https?:\/\//);
  assert.doesNotMatch(source, /jsdelivr|googleapis|unpkg/);
  assert.match(source, /mediapipeAssetUrls\(import\.meta\.env\.BASE_URL\)/);
});

test('the CSP no longer allows the MediaPipe CDNs', () => {
  const csp = read('../nginx.conf.template').match(/Content-Security-Policy "([^"]+)"/)?.[1];
  assert.ok(csp, 'nginx.conf.template must set a CSP');
  assert.doesNotMatch(csp, /cdn\.jsdelivr\.net|storage\.googleapis\.com/);
  assert.match(csp, /script-src [^;]*'wasm-unsafe-eval'/);
});

test('copyMediapipeWasm copies the installed wasm and records its version', async () => {
  const dest = mkdtempSync(join(tmpdir(), 'mediapipe-wasm-'));
  try {
    await copyMediapipeWasm(join(installedDir, 'wasm'), dest, declared);
    const sourceFiles = readdirSync(join(installedDir, 'wasm')).sort();
    assert.ok(sourceFiles.length > 0);
    for (const file of sourceFiles) {
      assert.ok(readFileSync(join(dest, file)).equals(readFileSync(join(installedDir, 'wasm', file))), file);
    }
    assert.deepEqual(JSON.parse(readFileSync(join(dest, 'version.json'), 'utf8')), { version: declared });
  } finally {
    rmSync(dest, { recursive: true, force: true });
  }
});

test('the copied public/mediapipe/wasm matches the installed package version', (t) => {
  if (!existsSync(publicWasmDir)) {
    t.skip('not copied yet (predev/prebuild create it)');
    return;
  }
  const copied = JSON.parse(readFileSync(join(publicWasmDir, 'version.json'), 'utf8')).version;
  assert.equal(copied, declared, 'stale wasm: run `npm run copy-wasm`');
});
