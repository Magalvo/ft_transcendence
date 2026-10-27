import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calibrationView,
  calibrationViewKey,
  cameraErrorView,
  cameraLoadingText,
  shouldDetect,
  type CalibrationInput,
  type CalibrationView,
  type DetectionPhase,
} from '../src/games/spacedout/calibrationView.ts';
import type { CameraFlowState } from '../src/games/spacedout/cameraFlow.ts';
import type { VisionErrorKind } from '../src/games/spacedout/visionErrors.ts';

const KINDS: VisionErrorKind[] = [
  'permission-denied',
  'no-camera',
  'camera-busy',
  'insecure-context',
  'model-load-failed',
  'unknown',
];

test('cameraErrorView gives every error kind its own message', () => {
  const messages = KINDS.map((kind) => cameraErrorView(kind).message);
  assert.equal(new Set(messages).size, KINDS.length, 'messages are distinct');
  for (const message of messages) assert.ok(message.length > 0);
});

test('cameraErrorView: permission-denied explains how to re-enable the camera and offers Retry', () => {
  const view = cameraErrorView('permission-denied');
  assert.match(view.message, /allow/i);
  assert.match(view.message, /address bar|site settings/i);
  assert.equal(view.retry, true);
});

test('cameraErrorView: no-camera and camera-busy offer Retry', () => {
  assert.equal(cameraErrorView('no-camera').retry, true);
  assert.equal(cameraErrorView('camera-busy').retry, true);
});

test('cameraErrorView: insecure-context points to HTTPS and has no retry', () => {
  const view = cameraErrorView('insecure-context');
  assert.match(view.message, /https/i);
  assert.equal(view.retry, false);
});

test('cameraErrorView: model-load-failed and unknown offer Retry', () => {
  assert.equal(cameraErrorView('model-load-failed').retry, true);
  assert.equal(cameraErrorView('unknown').retry, true);
});

const LIVE: CameraFlowState = { status: 'live' };

function input(overrides: Partial<CalibrationInput> = {}): CalibrationInput {
  return {
    webcamRequired: true,
    flow: LIVE,
    faceDetected: true,
    isDead: false,
    isPaused: false,
    isCalibrated: false,
    canCalibrate: true,
    ...overrides,
  };
}

test('calibrationView keeps the calibrate button states', () => {
  const label = (overrides: Partial<CalibrationInput>) => calibrationView(input(overrides)).buttonLabel;
  assert.equal(label({ webcamRequired: false }), 'Keyboard Mode');
  assert.equal(label({ flow: { status: 'error', kind: 'no-camera' } }), 'Camera Unavailable');
  assert.equal(label({ flow: { status: 'preloading' } }), 'Initializing...');
  assert.equal(label({ isPaused: true }), 'Paused');
  assert.equal(label({ isDead: true }), 'Unavailable');
  assert.equal(label({ canCalibrate: false }), 'Center Face');
  assert.equal(label({}), 'Calibrate');
  assert.equal(label({ isCalibrated: true }), 'Recalibrate');

  assert.equal(calibrationView(input()).buttonDisabled, false);
  assert.equal(calibrationView(input({ canCalibrate: false })).buttonDisabled, true);
  assert.equal(calibrationView(input({ flow: { status: 'requesting' } })).buttonDisabled, true);
});

test('calibrationView shows the error message and Retry for a failed camera', () => {
  const denied = calibrationView(input({ flow: { status: 'error', kind: 'permission-denied' } }));
  assert.equal(denied.errorMessage, cameraErrorView('permission-denied').message);
  assert.equal(denied.retryVisible, true);
  assert.equal(denied.previewVisible, false);

  const insecure = calibrationView(input({ flow: { status: 'error', kind: 'insecure-context' } }));
  assert.equal(insecure.retryVisible, false);

  const live = calibrationView(input());
  assert.equal(live.errorMessage, null);
  assert.equal(live.retryVisible, false);
});

test('calibrationView shows the preview and face indicator only while the camera is live', () => {
  assert.equal(calibrationView(input()).previewVisible, true);
  assert.equal(calibrationView(input()).faceDetected, true);
  assert.equal(calibrationView(input({ faceDetected: false })).faceDetected, false);
  const requesting = calibrationView(input({ flow: { status: 'requesting' } }));
  assert.equal(requesting.previewVisible, false);
  assert.equal(requesting.faceDetected, false);
});

test('calibrationViewKey is equal for equal states', () => {
  const a = calibrationView(input());
  const b = calibrationView(input());
  assert.notEqual(a, b);
  assert.equal(calibrationViewKey(a), calibrationViewKey(b));
});

test('calibrationViewKey differs when any shown field changes', () => {
  const base: CalibrationView = {
    buttonLabel: 'Calibrate',
    buttonDisabled: false,
    errorMessage: null,
    retryVisible: false,
    previewVisible: true,
    faceDetected: true,
  };
  const changed: Array<Partial<CalibrationView>> = [
    { buttonLabel: 'Recalibrate' },
    { buttonDisabled: true },
    { errorMessage: 'No camera was found.' },
    { retryVisible: true },
    { previewVisible: false },
    { faceDetected: false },
  ];
  assert.equal(changed.length, Object.keys(base).length, 'every field is covered');
  for (const change of changed) {
    assert.notEqual(
      calibrationViewKey({ ...base, ...change }),
      calibrationViewKey(base),
      `changing ${Object.keys(change)[0]}`,
    );
  }
  // Two different messages must not collapse to the same key.
  assert.notEqual(
    calibrationViewKey({ ...base, errorMessage: 'a' }),
    calibrationViewKey({ ...base, errorMessage: 'b' }),
  );
});

test('cameraLoadingText tells the player what the camera is waiting for', () => {
  assert.match(cameraLoadingText({ status: 'preloading' }), /loading/i);
  assert.match(cameraLoadingText({ status: 'requesting' }), /allow camera/i);
});

test('shouldDetect truth table', () => {
  const phases: DetectionPhase[] = ['lobby', 'spectating', 'calibrating', 'flying'];
  const bools = [false, true];
  for (const phase of phases) {
    for (const cameraLive of bools) {
      for (const isPaused of bools) {
        for (const isDead of bools) {
          for (const controlMode of ['FACE', 'KEYBOARD'] as const) {
            for (const faceCalibrated of bools) {
              const state = { phase, cameraLive, isPaused, isDead, controlMode, faceCalibrated };
              // Keyboard mode still needs detection for freelook, which only
              // works once the face has been calibrated.
              const flyingNeedsFace = controlMode === 'FACE' || faceCalibrated;
              const expected =
                cameraLive &&
                !isPaused &&
                !isDead &&
                (phase === 'calibrating' || (phase === 'flying' && flyingNeedsFace));
              assert.equal(shouldDetect(state), expected, JSON.stringify(state));
            }
          }
        }
      }
    }
  }
});
