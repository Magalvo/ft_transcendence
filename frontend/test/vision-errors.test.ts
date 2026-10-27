import test from 'node:test';
import assert from 'node:assert/strict';

import {
  VisionError,
  classifyCameraError,
  type VisionErrorKind,
} from '../src/games/spacedout/visionErrors.ts';

const SECURE = { isSecureContext: true, hasMediaDevices: true };

const CASES: Array<[string, VisionErrorKind]> = [
  ['NotAllowedError', 'permission-denied'],
  ['SecurityError', 'permission-denied'],
  ['NotFoundError', 'no-camera'],
  ['OverconstrainedError', 'no-camera'],
  ['NotReadableError', 'camera-busy'],
  ['AbortError', 'camera-busy'],
];

for (const [name, kind] of CASES) {
  test(`classifyCameraError maps ${name} to ${kind}`, () => {
    assert.equal(classifyCameraError(new DOMException('x', name), SECURE), kind);
  });
}

test('classifyCameraError: an insecure context wins over the error name', () => {
  const denied = new DOMException('x', 'NotAllowedError');
  assert.equal(
    classifyCameraError(denied, { isSecureContext: false, hasMediaDevices: true }),
    'insecure-context',
  );
  assert.equal(
    classifyCameraError(denied, { isSecureContext: true, hasMediaDevices: false }),
    'insecure-context',
  );
  assert.equal(
    classifyCameraError(undefined, { isSecureContext: false, hasMediaDevices: false }),
    'insecure-context',
  );
});

test('classifyCameraError: other DOMException names are unknown', () => {
  assert.equal(classifyCameraError(new DOMException('x', 'InvalidStateError'), SECURE), 'unknown');
});

test('classifyCameraError: non-DOMException input is unknown', () => {
  for (const input of [new Error('boom'), new TypeError('bad'), 'NotAllowedError', null, undefined, 42, {}]) {
    assert.equal(classifyCameraError(input, SECURE), 'unknown');
  }
});

test('VisionError carries its kind and cause', () => {
  const cause = new DOMException('x', 'NotAllowedError');
  const error = new VisionError('permission-denied', 'Camera blocked', { cause });
  assert.ok(error instanceof Error);
  assert.equal(error.name, 'VisionError');
  assert.equal(error.kind, 'permission-denied');
  assert.equal(error.message, 'Camera blocked');
  assert.equal(error.cause, cause);
});
