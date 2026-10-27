import test from 'node:test';
import assert from 'node:assert/strict';

import {
  HeadPoseTracker,
  LANDMARK,
  PARALLAX_GAIN,
  PITCH_DOWN_MULTIPLIER,
  STEERING_DEADZONE,
  STEERING_SENSITIVITY,
  applySteeringCurve,
  computeFlightInputs,
  computeRawHeadPose,
  type Landmark,
  type RawHeadPose,
} from '../src/games/spacedout/headPose.ts';

const EPSILON = 1e-9;

function assertClose(actual: number, expected: number, message?: string): void {
  assert.ok(
    Math.abs(actual - expected) < EPSILON,
    `${message ?? 'value'}: expected ${expected}, got ${actual}`,
  );
}

// Builds a 468-point face with only the landmarks the pose math reads set.
// yaw/pitch rotate the ear and forehead/chin pairs in the depth axis.
function makeFace({ noseX = 0.5, noseY = 0.5, yaw = 0, pitch = 0 } = {}): Landmark[] {
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
  const angle = STEERING_DEADZONE + 0.2;
  const expected = 0.2 * 0.2 * STEERING_SENSITIVITY;
  assertClose(applySteeringCurve(angle), expected, 'positive');
  assertClose(applySteeringCurve(-angle), -expected, 'negative');
  assert.ok(applySteeringCurve(angle + 0.1) > applySteeringCurve(angle));
});

test('computeFlightInputs is neutral at the calibrated pose', () => {
  const calibration: RawHeadPose = { noseX: 0.42, noseY: 0.57, yaw: 0.12, pitch: -0.07 };
  const inputs = computeFlightInputs({ ...calibration }, calibration);
  assertClose(inputs.yawInput, 0, 'yawInput');
  assertClose(inputs.pitchInput, 0, 'pitchInput');
  assertClose(inputs.camPosX, 0, 'camPosX');
  assertClose(inputs.camPosY, 0, 'camPosY');
});

test('computeFlightInputs inverts yaw and boosts downward pitch', () => {
  const calibration: RawHeadPose = { noseX: 0.5, noseY: 0.5, yaw: 0, pitch: 0 };
  const delta = STEERING_DEADZONE + 0.2;
  const curve = applySteeringCurve(delta);

  const right = computeFlightInputs({ ...calibration, yaw: delta }, calibration);
  assertClose(right.yawInput, -curve, 'yaw is inverted');

  const up = computeFlightInputs({ ...calibration, pitch: delta }, calibration);
  assertClose(up.pitchInput, curve, 'upward pitch');

  const down = computeFlightInputs({ ...calibration, pitch: -delta }, calibration);
  assertClose(down.pitchInput, -curve * PITCH_DOWN_MULTIPLIER, 'downward pitch');
});

test('computeFlightInputs maps nose offset to camera parallax', () => {
  const calibration: RawHeadPose = { noseX: 0.5, noseY: 0.5, yaw: 0, pitch: 0 };
  const inputs = computeFlightInputs({ ...calibration, noseX: 0.6, noseY: 0.45 }, calibration);
  assertClose(inputs.camPosX, -0.1 * PARALLAX_GAIN, 'camPosX');
  assertClose(inputs.camPosY, -0.05 * PARALLAX_GAIN, 'camPosY');
});

test('HeadPoseTracker passes the raw pose through before calibration', () => {
  const tracker = new HeadPoseTracker();
  tracker.update(makeFace({ noseX: 0.45, yaw: 0.2 }));
  assert.equal(tracker.isCalibrated, false);
  assert.equal(tracker.faceDetected, true);
  assertClose(tracker.yawInput, 0.2, 'raw yaw');
  assertClose(tracker.camPosX, 0.45, 'raw noseX');
});

test('HeadPoseTracker refuses to calibrate without a face', () => {
  const tracker = new HeadPoseTracker();
  assert.equal(tracker.calibrate(), false);
  tracker.update(undefined);
  assert.equal(tracker.calibrate(), false);
  assert.equal(tracker.isCalibrated, false);
});

test('HeadPoseTracker steers relative to the calibrated posture', () => {
  const tracker = new HeadPoseTracker();
  const neutral = { noseX: 0.55, noseY: 0.48, yaw: 0.1, pitch: -0.05 };
  tracker.update(makeFace(neutral));
  assert.equal(tracker.calibrate(), true);

  tracker.update(makeFace(neutral));
  assertClose(tracker.yawInput, 0, 'yaw at neutral');
  assertClose(tracker.pitchInput, 0, 'pitch at neutral');
  assertClose(tracker.camPosX, 0, 'camPosX at neutral');
  assertClose(tracker.camPosY, 0, 'camPosY at neutral');

  tracker.update(makeFace({ ...neutral, yaw: neutral.yaw + 0.3 }));
  assertClose(tracker.yawInput, -applySteeringCurve(0.3), 'yaw after turning');
});

// Regression: recalibrating used to read the processed steering/parallax
// outputs as if they were raw angles, so the new "zero" was wrong and the
// camera jumped by ~8 units.
test('HeadPoseTracker recalibration captures the new raw posture', () => {
  const tracker = new HeadPoseTracker();
  tracker.update(makeFace({ noseX: 0.5, noseY: 0.5 }));
  tracker.calibrate();

  // Player slouches to a new neutral position, far enough to be steering.
  const slouched = { noseX: 0.62, noseY: 0.58, yaw: 0.35, pitch: -0.3 };
  tracker.update(makeFace(slouched));
  assert.notEqual(tracker.yawInput, 0);
  assert.notEqual(tracker.pitchInput, 0);

  tracker.calibrate();
  tracker.update(makeFace(slouched));
  assertClose(tracker.yawInput, 0, 'yaw after recalibration');
  assertClose(tracker.pitchInput, 0, 'pitch after recalibration');
  assertClose(tracker.camPosX, 0, 'camPosX after recalibration');
  assertClose(tracker.camPosY, 0, 'camPosY after recalibration');

  // And steering is measured from the new neutral, not the old one.
  tracker.update(makeFace({ ...slouched, yaw: slouched.yaw + 0.2 }));
  assertClose(tracker.yawInput, -applySteeringCurve(0.2), 'yaw relative to new neutral');
});

test('HeadPoseTracker stops steering but keeps parallax when the face is lost', () => {
  const tracker = new HeadPoseTracker();
  tracker.update(makeFace());
  tracker.calibrate();
  tracker.update(makeFace({ noseX: 0.6, yaw: 0.4 }));
  const lastCamPosX = tracker.camPosX;
  assert.notEqual(tracker.yawInput, 0);

  tracker.update(undefined);
  assert.equal(tracker.faceDetected, false);
  assert.equal(tracker.yawInput, 0);
  assert.equal(tracker.pitchInput, 0);
  assert.equal(tracker.camPosX, lastCamPosX);
  assert.equal(tracker.calibrate(), false, 'cannot calibrate on a lost face');
  assert.equal(tracker.isCalibrated, true, 'previous calibration is kept');
});
