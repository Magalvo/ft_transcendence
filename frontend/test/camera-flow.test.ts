import test from 'node:test';
import assert from 'node:assert/strict';

import {
  INITIAL_CAMERA_FLOW,
  isVisionFailed,
  isVisionReady,
  reduceCameraFlow,
  visionErrorKind,
  type CameraFlowEvent,
  type CameraFlowState,
} from '../src/games/spacedout/cameraFlow.ts';
import { VisionError, type VisionErrorKind } from '../src/games/spacedout/visionErrors.ts';

const KINDS: VisionErrorKind[] = [
  'permission-denied',
  'no-camera',
  'camera-busy',
  'insecure-context',
  'model-load-failed',
  'unknown',
];

const IDLE: CameraFlowState = { status: 'idle' };
const PRELOADING: CameraFlowState = { status: 'preloading' };
const READY: CameraFlowState = { status: 'ready' };
const REQUESTING: CameraFlowState = { status: 'requesting' };
const LIVE: CameraFlowState = { status: 'live' };
const error = (kind: VisionErrorKind): CameraFlowState => ({ status: 'error', kind });

const ALL_STATES: CameraFlowState[] = [IDLE, PRELOADING, READY, REQUESTING, LIVE, ...KINDS.map(error)];
const ALL_EVENTS: CameraFlowEvent[] = [
  { type: 'preloadStarted' },
  { type: 'preloadDone' },
  { type: 'preloadFailed', kind: 'model-load-failed' },
  { type: 'cameraRequested' },
  { type: 'cameraStarted' },
  { type: 'cameraFailed', kind: 'permission-denied' },
  { type: 'retry' },
  { type: 'stopped' },
];

const VALID: Array<[CameraFlowState, CameraFlowEvent, CameraFlowState]> = [
  [IDLE, { type: 'preloadStarted' }, PRELOADING],
  [PRELOADING, { type: 'preloadDone' }, READY],
  [PRELOADING, { type: 'preloadFailed', kind: 'model-load-failed' }, error('model-load-failed')],
  [READY, { type: 'cameraRequested' }, REQUESTING],
  // startCamera() preloads by itself, so Join may come before the model is ready.
  [IDLE, { type: 'cameraRequested' }, REQUESTING],
  [PRELOADING, { type: 'cameraRequested' }, REQUESTING],
  [REQUESTING, { type: 'cameraStarted' }, LIVE],
  [REQUESTING, { type: 'cameraFailed', kind: 'camera-busy' }, error('camera-busy')],
  [REQUESTING, { type: 'cameraFailed', kind: 'model-load-failed' }, error('model-load-failed')],
];

const describe = (state: CameraFlowState): string =>
  state.status === 'error' ? `error(${state.kind})` : state.status;

test('cameraFlow starts idle', () => {
  assert.deepEqual(INITIAL_CAMERA_FLOW, IDLE);
});

test('cameraFlow follows every valid transition', () => {
  for (const [from, event, to] of VALID) {
    assert.deepEqual(reduceCameraFlow(from, event), to, `${describe(from)} --${event.type}-->`);
  }
});

test('cameraFlow ignores invalid events', () => {
  const isValid = (from: CameraFlowState, event: CameraFlowEvent) =>
    event.type === 'stopped' ||
    (event.type === 'retry' && from.status === 'error') ||
    VALID.some(([s, e]) => describe(s) === describe(from) && e.type === event.type);
  for (const from of ALL_STATES) {
    for (const event of ALL_EVENTS) {
      if (isValid(from, event)) continue;
      assert.equal(reduceCameraFlow(from, event), from, `${describe(from)} ignores ${event.type}`);
    }
  }
});

test('cameraFlow retry goes back to requesting, or preloading after a model failure', () => {
  for (const kind of KINDS) {
    const next = reduceCameraFlow(error(kind), { type: 'retry' });
    if (kind === 'insecure-context') {
      // Nothing a retry can fix: the page itself has to be opened over HTTPS.
      assert.deepEqual(next, error(kind), 'insecure-context has no retry');
    } else if (kind === 'model-load-failed') {
      assert.deepEqual(next, PRELOADING, kind);
    } else {
      assert.deepEqual(next, REQUESTING, kind);
    }
  }
});

test('cameraFlow stopped from any state goes to idle', () => {
  for (const from of ALL_STATES) {
    assert.deepEqual(reduceCameraFlow(from, { type: 'stopped' }), IDLE, describe(from));
  }
});

test('visionReady and visionFailed are derived from the flow state', () => {
  for (const state of ALL_STATES) {
    assert.equal(isVisionReady(state), state.status === 'live', describe(state));
    assert.equal(isVisionFailed(state), state.status === 'error', describe(state));
  }
});

test('visionErrorKind reads the kind from a VisionError', () => {
  assert.equal(visionErrorKind(new VisionError('camera-busy')), 'camera-busy');
  assert.equal(visionErrorKind(new Error('boom')), 'unknown');
  assert.equal(visionErrorKind('boom'), 'unknown');
});
