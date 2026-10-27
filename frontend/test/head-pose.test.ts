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
import { DEFAULT_CONTROL_SETTINGS } from '../src/games/spacedout/controlSettings.ts';

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

test('HeadPoseTracker outputs stay 0 before calibration', () => {
  const camera = new Camera();
  camera.hold({ noseX: 0.45, noseY: 0.4, yaw: 0.2, pitch: -0.15 });
  assert.equal(camera.tracker.isCalibrated, false);
  assert.equal(camera.tracker.faceDetected, true);
  assert.equal(camera.tracker.yawInput, 0, 'yaw');
  assert.equal(camera.tracker.pitchInput, 0, 'pitch');
  assert.equal(camera.tracker.camPosX, 0, 'camPosX');
  assert.equal(camera.tracker.camPosY, 0, 'camPosY');
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

// --- WS3: control settings ---

const NEUTRAL: RawHeadPose = { noseX: 0.5, noseY: 0.5, yaw: 0, pitch: 0 };

// The steering math as it was before settings existed, with the constants
// spelled out, so the default settings can be proven to change nothing.
function originalFlightInputs(pose: RawHeadPose, calibration: RawHeadPose) {
  const curve = (angle: number, fullAngle: number): number => {
    const magnitude = Math.abs(angle);
    if (magnitude <= 0.08) {
      return 0;
    }
    const progress = Math.min(1, (magnitude - 0.08) / (fullAngle - 0.08));
    return Math.sign(angle) * progress * progress;
  };
  const adjustedYaw = pose.yaw - calibration.yaw;
  const adjustedPitch = pose.pitch - calibration.pitch;
  return {
    yawInput: -curve(adjustedYaw, 0.34),
    pitchInput: curve(adjustedPitch, adjustedPitch < 0 ? 0.27 : 0.34),
    camPosX: -(pose.noseX - calibration.noseX) * 16,
    camPosY: (pose.noseY - calibration.noseY) * 16,
  };
}

test('computeFlightInputs with default settings matches the original tuning exactly', () => {
  const calibration: RawHeadPose = { noseX: 0.47, noseY: 0.53, yaw: 0.05, pitch: -0.03 };
  for (let yaw = -0.6; yaw <= 0.6; yaw += 0.01) {
    for (let pitch = -0.6; pitch <= 0.6; pitch += 0.03) {
      const pose: RawHeadPose = { noseX: 0.5 + yaw / 10, noseY: 0.5 - pitch / 10, yaw, pitch };
      const expected = originalFlightInputs(pose, calibration);
      assert.deepEqual(computeFlightInputs(pose, calibration), expected, `yaw ${yaw}, pitch ${pitch}`);
      assert.deepEqual(
        computeFlightInputs(pose, calibration, DEFAULT_CONTROL_SETTINGS),
        expected,
        `explicit defaults, yaw ${yaw}, pitch ${pitch}`,
      );
    }
  }
});

test('sensitivity 2 reaches full deflection with half the turn past the deadzone', () => {
  const settings = { ...DEFAULT_CONTROL_SETTINGS, sensitivity: 2 };
  const deadzone = DEFAULT_CONTROL_SETTINGS.deadzone;
  const yawHalf = deadzone + (STEERING_FULL_ANGLE - deadzone) / 2;
  const downHalf = deadzone + (PITCH_DOWN_FULL_ANGLE - deadzone) / 2;

  assertClose(computeFlightInputs({ ...NEUTRAL, yaw: yawHalf }, NEUTRAL, settings).yawInput, -1, 'yaw');
  assertClose(computeFlightInputs({ ...NEUTRAL, pitch: yawHalf }, NEUTRAL, settings).pitchInput, 1, 'pitch up');
  assertClose(computeFlightInputs({ ...NEUTRAL, pitch: -downHalf }, NEUTRAL, settings).pitchInput, -1, 'pitch down');
  assert.ok(
    computeFlightInputs({ ...NEUTRAL, yaw: yawHalf }, NEUTRAL).yawInput > -1,
    'sensitivity 1 is not saturated at that angle',
  );

  // Halfway through the shortened range gives the same quarter input.
  const quarter = deadzone + (STEERING_FULL_ANGLE - deadzone) / 4;
  assertClose(computeFlightInputs({ ...NEUTRAL, yaw: quarter }, NEUTRAL, settings).yawInput, -0.25, 'curve shape');
});

test('sensitivity 0.5 needs twice the turn past the deadzone', () => {
  const settings = { ...DEFAULT_CONTROL_SETTINGS, sensitivity: 0.5 };
  const deadzone = DEFAULT_CONTROL_SETTINGS.deadzone;
  const yawDouble = deadzone + (STEERING_FULL_ANGLE - deadzone) * 2;
  assertClose(computeFlightInputs({ ...NEUTRAL, yaw: STEERING_FULL_ANGLE }, NEUTRAL, settings).yawInput, -0.25, 'yaw');
  assertClose(computeFlightInputs({ ...NEUTRAL, yaw: yawDouble }, NEUTRAL, settings).yawInput, -1, 'yaw at 2×');
});

test('a deadzone of 0.15 ignores a 0.12 rad turn and keeps the range past it', () => {
  const settings = { ...DEFAULT_CONTROL_SETTINGS, deadzone: 0.15 };
  const turned = computeFlightInputs({ ...NEUTRAL, yaw: 0.12, pitch: -0.12 }, NEUTRAL, settings);
  assertClose(turned.yawInput, 0, 'yaw');
  assertClose(turned.pitchInput, 0, 'pitch');
  assert.notEqual(computeFlightInputs({ ...NEUTRAL, yaw: 0.12 }, NEUTRAL).yawInput, 0, 'default deadzone steers');

  const full = 0.15 + (STEERING_FULL_ANGLE - STEERING_DEADZONE);
  assertClose(computeFlightInputs({ ...NEUTRAL, yaw: full }, NEUTRAL, settings).yawInput, -1, 'full yaw');
});

test('invertYaw and invertPitch flip the steering signs but not parallax', () => {
  const pose: RawHeadPose = { noseX: 0.6, noseY: 0.4, yaw: 0.2, pitch: 0.2 };
  const normal = computeFlightInputs(pose, NEUTRAL);
  const invertedYaw = computeFlightInputs(pose, NEUTRAL, { ...DEFAULT_CONTROL_SETTINGS, invertYaw: true });
  const invertedPitch = computeFlightInputs(pose, NEUTRAL, { ...DEFAULT_CONTROL_SETTINGS, invertPitch: true });

  assert.ok(normal.yawInput < 0 && normal.pitchInput > 0);
  assert.equal(invertedYaw.yawInput, -normal.yawInput);
  assert.equal(invertedYaw.pitchInput, normal.pitchInput);
  assert.equal(invertedPitch.pitchInput, -normal.pitchInput, 'looking up gives a negative pitch input');
  assert.equal(invertedPitch.yawInput, normal.yawInput);
  for (const inputs of [invertedYaw, invertedPitch]) {
    assert.equal(inputs.camPosX, normal.camPosX);
    assert.equal(inputs.camPosY, normal.camPosY);
  }
});

test('invertPitch keeps the faster saturation looking down', () => {
  const settings = { ...DEFAULT_CONTROL_SETTINGS, invertPitch: true };
  const down = computeFlightInputs({ ...NEUTRAL, pitch: -PITCH_DOWN_FULL_ANGLE }, NEUTRAL, settings);
  assertClose(down.pitchInput, 1, 'looking down saturates, now positive');
});

test('HeadPoseTracker.setSettings applies from the next frame and keeps calibration', () => {
  const camera = new Camera();
  camera.hold({});
  assert.equal(camera.tracker.calibrate(), true);

  camera.hold({ yaw: 0.2 });
  const before = camera.tracker.yawInput;
  assertClose(before, -applySteeringCurve(0.2), 'default settings', 1e-6);

  camera.tracker.setSettings({ ...DEFAULT_CONTROL_SETTINGS, invertYaw: true });
  assert.equal(camera.tracker.yawInput, before, 'outputs only change on the next update');
  assert.equal(camera.tracker.isCalibrated, true, 'calibration is kept');

  camera.frame(makeFace({ yaw: 0.2 }));
  assertClose(camera.tracker.yawInput, -before, 'inverted on the next frame', 1e-6);

  camera.tracker.setSettings({ ...DEFAULT_CONTROL_SETTINGS, deadzone: 0.2 });
  camera.frame(makeFace({ yaw: 0.2 }));
  assertClose(camera.tracker.yawInput, 0, 'larger deadzone ignores the turn', 1e-6);

  camera.tracker.setSettings({ ...DEFAULT_CONTROL_SETTINGS });
  camera.hold({});
  assertClose(camera.tracker.yawInput, 0, 'neutral is still neutral after setting changes', 1e-6);
});

test('HeadPoseTracker.setSettings sanitizes what it is given', () => {
  const camera = new Camera();
  camera.hold({});
  camera.tracker.calibrate();
  camera.tracker.setSettings({ sensitivity: NaN, deadzone: 5, invertYaw: false, invertPitch: false });
  camera.hold({ yaw: 0.19 });
  assertClose(camera.tracker.yawInput, 0, 'deadzone clamped to 0.2', 1e-6);
});
