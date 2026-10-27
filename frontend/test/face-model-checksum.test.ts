import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import {
  FACE_MODEL_SHA256,
  FACE_MODEL_URL,
  verifySha256,
} from '../scripts/fetch-face-model.mjs';

const DATA = Buffer.from('face landmarker bytes');
const DIGEST = createHash('sha256').update(DATA).digest('hex');

test('verifySha256 accepts a matching digest', () => {
  assert.equal(verifySha256(DATA, DIGEST), true);
  assert.equal(verifySha256(new Uint8Array(DATA), DIGEST.toUpperCase()), true);
});

test('verifySha256 rejects a mismatch', () => {
  assert.equal(verifySha256(Buffer.from('tampered'), DIGEST), false);
  assert.equal(verifySha256(DATA, ''), false);
});

test('the face model is pinned to an https URL and a SHA-256 digest', () => {
  assert.match(FACE_MODEL_URL, /^https:\/\/.+\.task$/);
  assert.match(FACE_MODEL_SHA256, /^[0-9a-f]{64}$/);
});
