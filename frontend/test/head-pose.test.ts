import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CALIBRATION_MIN_SAMPLES,
  HeadPoseTracker,
  LANDMARK,
  OneEuroFilter,
  PARALLAX_GAIN,
  PITCH_DOWN_FULL_ANGLE,
  STEERING_DEADZONE,
  STEERING_FULL_ANGLE,
  applySteeringCurve,
  computeFlightInputs,
  computeRawHeadPose,
  type Landmark,
  type RawHeadPose,
} from '../src/games/spacedout/headPose.ts';

const FRAME_MS = 1000 / 30;

function assertClose(actual: number, expected: number, message?: string, epsilon = 1e-9): void {
  assert.ok(
    Math.abs(actual - expected) < epsilon,
    `${message ?? 'value'}: expected ${expected}, got ${actual}`,
  );
}

type FacePose = Partial<RawHeadPose>;

// Builds a 468-point face with only the landmarks the pose math reads set.
// yaw/pitch rotate the ear and forehead/chin pairs in the depth axis.
function makeFace({ noseX = 0.5, noseY = 0.5, yaw = 0, pitch = 0 }: FacePose = {}): Landmark[] {
  const face: Landmark[] = Array.from({ length: 468 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  const earHalfWidth = 0.15;
  const headHalfHeight = 0.2;
  face[LANDMARK.NOSE] = { x: noseX, y: noseY, z: -0.05 };
  face[LANDMARK.LEFT_EAR] = {
    x: noseX - earHalfWidth * Math.cos(yaw),
    y: noseY,
    z: -earHalfWidth * Math.sin(yaw),
  };
  face[LANDMARK.RIGHT_EAR] = {
    x: noseX + earHalfWidth * Math.cos(yaw),
    y: noseY,
    z: earHalfWidth * Math.sin(yaw),
  };
  face[LANDMARK.TOP_HEAD] = {
    x: noseX,
    y: noseY - headHalfHeight * Math.cos(pitch),
    z: headHalfHeight * Math.sin(pitch),
  };
  face[LANDMARK.CHIN] = {
    x: noseX,
    y: noseY + headHalfHeight * Math.cos(pitch),
    z: -headHalfHeight * Math.sin(pitch),
  };
  return face;
}

// Drives a tracker at 30 fps on a shared clock so the filters see real time.
class Camera {
  public readonly tracker = new HeadPoseTracker();
  public timeMs = 0;

  // Holds a pose long enough (3 s) for the filters to settle on it.
  public hold(pose: FacePose, durationMs = 3000): void {
    const frames = Math.round(durationMs / FRAME_MS);
    for (let i = 0; i < frames; i++) {
      this.frame(makeFace(pose));
    }
  }

  public frame(landmarks: Landmark[] | undefined): void {
    this.timeMs += FRAME_MS;
    this.tracker.update(landmarks, this.timeMs);
  }
}

test('computeRawHeadPose returns null without a usable face', () => {
  assert.equal(computeRawHeadPose(undefined), null);
  assert.equal(computeRawHeadPose(null), null);
  assert.equal(computeRawHeadPose([]), null);
  assert.equal(computeRawHeadPose(makeFace().slice(0, LANDMARK.RIGHT_EAR)), null);
});

test('computeRawHeadPose reads a frontal face as zero yaw and pitch', () => {
  const pose = computeRawHeadPose(makeFace({ noseX: 0.4, noseY: 0.6 }));
  assert.ok(pose);
  assertClose(pose.yaw, 0, 'yaw');
  assertClose(pose.pitch, 0, 'pitch');
  assertClose(pose.noseX, 0.4, 'noseX');
  assertClose(pose.noseY, 0.6, 'noseY');
});

test('computeRawHeadPose recovers the yaw and pitch angles', () => {
  const turned = computeRawHeadPose(makeFace({ yaw: 0.3 }));
  assert.ok(turned);
  assertClose(turned.yaw, 0.3, 'yaw');
  assertClose(turned.pitch, 0, 'pitch while turning');

  const tilted = computeRawHeadPose(makeFace({ pitch: 0.25 }));
  assert.ok(tilted);
  assertClose(tilted.pitch, 0.25, 'pitch');
  assertClose(tilted.yaw, 0, 'yaw while tilting');
});

test('applySteeringCurve ignores movement inside the deadzone', () => {
  assert.equal(applySteeringCurve(0), 0);
  assert.equal(applySteeringCurve(STEERING_DEADZONE), 0);
  assert.equal(applySteeringCurve(-STEERING_DEADZONE * 0.5), 0);
});

test('applySteeringCurve ramps quadratically and keeps the sign', () => {
  const halfway = (STEERING_DEADZONE + STEERING_FULL_ANGLE) / 2;
  assertClose(applySteeringCurve(halfway), 0.25, 'halfway');
  assertClose(applySteeringCurve(-halfway), -0.25, 'negative halfway');
  assert.ok(applySteeringCurve(halfway + 0.05) > applySteeringCurve(halfway));
});

test('applySteeringCurve keeps the original feel below full deflection', () => {
  // The original tuning was excess² × 15 with no cap.
  for (const excess of [0.05, 0.1, 0.2]) {
    const original = excess * excess * 15;
    assertClose(applySteeringCurve(STEERING_DEADZONE + excess), original, `excess ${excess}`, 0.01);
  }
});

test('applySteeringCurve is capped at keyboard authority (±1)', () => {
  assertClose(applySteeringCurve(STEERING_FULL_ANGLE), 1, 'at full angle');
  assert.equal(applySteeringCurve(1.2), 1);
  assert.equal(applySteeringCurve(-1.2), -1);
});

test('computeFlightInputs is neutral at the calibrated pose', () => {
  const calibration: RawHeadPose = { noseX: 0.42, noseY: 0.57, yaw: 0.12, pitch: -0.07 };
  const inputs = computeFlightInputs({ ...calibration }, calibration);
  assertClose(inputs.yawInput, 0, 'yawInput');
  assertClose(inputs.pitchInput, 0, 'pitchInput');
  assertClose(inputs.camPosX, 0, 'camPosX');
  assertClose(inputs.camPosY, 0, 'camPosY');
});

test('computeFlightInputs inverts yaw and stays within ±1', () => {
  const calibration: RawHeadPose = { noseX: 0.5, noseY: 0.5, yaw: 0, pitch: 0 };
  const delta = STEERING_DEADZONE + 0.1;

  const right = computeFlightInputs({ ...calibration, yaw: delta }, calibration);
  assertClose(right.yawInput, -applySteeringCurve(delta), 'yaw is inverted');

  for (const angle of [-1.5, -0.6, 0.6, 1.5]) {
    const inputs = computeFlightInputs({ ...calibration, yaw: angle, pitch: angle }, calibration);
    assert.ok(Math.abs(inputs.yawInput) <= 1, `yaw ${angle} within ±1`);
    assert.ok(Math.abs(inputs.pitchInput) <= 1, `pitch ${angle} within ±1`);
  }
});

test('computeFlightInputs saturates downward pitch sooner than upward', () => {
  const calibration: RawHeadPose = { noseX: 0.5, noseY: 0.5, yaw: 0, pitch: 0 };
  const down = computeFlightInputs({ ...calibration, pitch: -PITCH_DOWN_FULL_ANGLE }, calibration);
  const up = computeFlightInputs({ ...calibration, pitch: PITCH_DOWN_FULL_ANGLE }, calibration);
  assertClose(down.pitchInput, -1, 'down is at full deflection');
  assert.ok(up.pitchInput > 0 && up.pitchInput < 1, 'up is not saturated yet');
});

test('computeFlightInputs maps nose offset to camera parallax', () => {
  const calibration: RawHeadPose = { noseX: 0.5, noseY: 0.5, yaw: 0, pitch: 0 };
  const inputs = computeFlightInputs({ ...calibration, noseX: 0.6, noseY: 0.45 }, calibration);
  assertClose(inputs.camPosX, -0.1 * PARALLAX_GAIN, 'camPosX');
  assertClose(inputs.camPosY, -0.05 * PARALLAX_GAIN, 'camPosY');
});

test('OneEuroFilter passes the first value and holds a constant signal', () => {
  const filter = new OneEuroFilter(1.0, 0.8);
  assert.equal(filter.filter(0.3, 0), 0.3);
  for (let i = 1; i <= 30; i++) {
    assertClose(filter.filter(0.3, i * FRAME_MS), 0.3, `frame ${i}`);
  }
});

test('OneEuroFilter removes jitter around a still pose', () => {
  const filter = new OneEuroFilter(1.0, 0.8);
  let maxDeviation = 0;
  for (let i = 0; i < 90; i++) {
    const noisy = 0.2 + (i % 2 === 0 ? 0.02 : -0.02);
    const filtered = filter.filter(noisy, i * FRAME_MS);
    if (i > 30) {
      maxDeviation = Math.max(maxDeviation, Math.abs(filtered - 0.2));
    }
  }
  assert.ok(maxDeviation < 0.005, `jitter of ±0.02 reduced to ±${maxDeviation.toFixed(4)}`);
});

test('OneEuroFilter follows fast moves more closely than a plain low-pass', () => {
  const adaptive = new OneEuroFilter(1.0, 0.8);
  const plain = new OneEuroFilter(1.0, 0);
  adaptive.filter(0, 0);
  plain.filter(0, 0);
  let adaptiveValue = 0;
  let plainValue = 0;
  for (let i = 1; i <= 5; i++) {
    adaptiveValue = adaptive.filter(1, i * FRAME_MS);
    plainValue = plain.filter(1, i * FRAME_MS);
  }
  assert.ok(adaptiveValue > plainValue, `${adaptiveValue} should lead ${plainValue}`);
});

test('OneEuroFilter ignores repeated timestamps and restarts after reset', () => {
  const filter = new OneEuroFilter(1.0, 0.8);
  filter.filter(0, 0);
  const moved = filter.filter(1, FRAME_MS);
  assert.equal(filter.filter(5, FRAME_MS), moved, 'same timestamp returns the previous value');

  filter.reset();
  assert.equal(filter.filter(-2, 2 * FRAME_MS), -2, 'first value after reset passes through');
});

test('HeadPoseTracker passes the raw pose through before calibration', () => {
  const camera = new Camera();
  camera.hold({ noseX: 0.45, yaw: 0.2 });
  assert.equal(camera.tracker.isCalibrated, false);
  assert.equal(camera.tracker.faceDetected, true);
  assertClose(camera.tracker.yawInput, 0.2, 'raw yaw', 1e-6);
  assertClose(camera.tracker.camPosX, 0.45, 'raw noseX', 1e-6);
});

test('HeadPoseTracker refuses to calibrate without a face', () => {
  const camera = new Camera();
  assert.equal(camera.tracker.calibrate(), false);
  camera.frame(undefined);
  assert.equal(camera.tracker.calibrate(), false);
  assert.equal(camera.tracker.isCalibrated, false);
});

test('HeadPoseTracker needs a few frames before it can calibrate', () => {
  const camera = new Camera();
  for (let i = 0; i < CALIBRATION_MIN_SAMPLES - 1; i++) {
    camera.frame(makeFace());
  }
  assert.equal(camera.tracker.calibrate(), false, 'too few frames');

  camera.frame(makeFace());
  assert.equal(camera.tracker.calibrate(), true, 'enough frames');
});

test('HeadPoseTracker steers relative to the calibrated posture', () => {
  const camera = new Camera();
  const neutral = { noseX: 0.55, noseY: 0.48, yaw: 0.1, pitch: -0.05 };
  camera.hold(neutral);
  assert.equal(camera.tracker.calibrate(), true);

  camera.hold(neutral);
  assertClose(camera.tracker.yawInput, 0, 'yaw at neutral', 1e-6);
  assertClose(camera.tracker.pitchInput, 0, 'pitch at neutral', 1e-6);
  assertClose(camera.tracker.camPosX, 0, 'camPosX at neutral', 1e-6);
  assertClose(camera.tracker.camPosY, 0, 'camPosY at neutral', 1e-6);

  camera.hold({ ...neutral, yaw: neutral.yaw + 0.2 });
  assertClose(camera.tracker.yawInput, -applySteeringCurve(0.2), 'yaw after turning', 1e-6);
});

test('HeadPoseTracker calibration averages out jitter', () => {
  const camera = new Camera();
  for (let i = 0; i < 90; i++) {
    camera.frame(makeFace({ noseX: i % 2 === 0 ? 0.48 : 0.52 }));
  }
  assert.equal(camera.tracker.calibrate(), true);

  camera.hold({ noseX: 0.5 });
  assert.ok(
    Math.abs(camera.tracker.camPosX) < 0.02,
    `neutral parallax should be ~0, got ${camera.tracker.camPosX}`,
  );
});

test('HeadPoseTracker calibration only uses recent frames', () => {
  const camera = new Camera();
  camera.hold({ noseX: 0.3 }, 3000);
  camera.hold({ noseX: 0.6 }, 1500);
  assert.equal(camera.tracker.calibrate(), true);

  camera.hold({ noseX: 0.6 });
  assert.ok(
    Math.abs(camera.tracker.camPosX) < 0.05,
    `old posture must not leak into calibration, got ${camera.tracker.camPosX}`,
  );
});

// Regression: recalibrating used to read the processed steering/parallax
// outputs as if they were raw angles, so the new "zero" was wrong and the
// camera jumped by ~8 units.
test('HeadPoseTracker recalibration captures the new raw posture', () => {
  const camera = new Camera();
  camera.hold({ noseX: 0.5, noseY: 0.5 });
  camera.tracker.calibrate();

  // Player slouches to a new neutral position, far enough to be steering.
  const slouched = { noseX: 0.62, noseY: 0.58, yaw: 0.35, pitch: -0.3 };
  camera.hold(slouched);
  assert.notEqual(camera.tracker.yawInput, 0);
  assert.notEqual(camera.tracker.pitchInput, 0);

  camera.tracker.calibrate();
  camera.hold(slouched);
  assertClose(camera.tracker.yawInput, 0, 'yaw after recalibration', 1e-6);
  assertClose(camera.tracker.pitchInput, 0, 'pitch after recalibration', 1e-6);
  assertClose(camera.tracker.camPosX, 0, 'camPosX after recalibration', 1e-6);
  assertClose(camera.tracker.camPosY, 0, 'camPosY after recalibration', 1e-6);

  // And steering is measured from the new neutral, not the old one.
  camera.hold({ ...slouched, yaw: slouched.yaw + 0.2 });
  assertClose(camera.tracker.yawInput, -applySteeringCurve(0.2), 'yaw relative to new neutral', 1e-6);
});

test('HeadPoseTracker stops steering but keeps parallax when the face is lost', () => {
  const camera = new Camera();
  camera.hold({});
  camera.tracker.calibrate();
  camera.hold({ noseX: 0.6, yaw: 0.4 });
  const lastCamPosX = camera.tracker.camPosX;
  assert.notEqual(camera.tracker.yawInput, 0);

  camera.frame(undefined);
  assert.equal(camera.tracker.faceDetected, false);
  assert.equal(camera.tracker.yawInput, 0);
  assert.equal(camera.tracker.pitchInput, 0);
  assert.equal(camera.tracker.camPosX, lastCamPosX);
  assert.equal(camera.tracker.calibrate(), false, 'cannot calibrate on a lost face');
  assert.equal(camera.tracker.isCalibrated, true, 'previous calibration is kept');
});

test('HeadPoseTracker reports how long the face has been lost', () => {
  const camera = new Camera();
  assert.equal(camera.tracker.faceLostForMs(1000), 0, 'no face seen yet');

  camera.hold({}, 1000);
  const lastSeenAt = camera.timeMs;
  assert.equal(camera.tracker.faceLostForMs(lastSeenAt + 500), 0, 'face visible');

  camera.frame(undefined);
  camera.frame(undefined);
  assertClose(camera.tracker.faceLostForMs(lastSeenAt + 400), 400, 'time since last face');

  camera.frame(makeFace());
  assert.equal(camera.tracker.faceLostForMs(camera.timeMs + 1000), 0, 'face back');
});
