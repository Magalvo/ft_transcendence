// Pure head-pose math for the SpacedOut face controls. Kept free of MediaPipe
// and DOM imports so it can be unit tested under plain Node.

export interface Landmark {
  x: number;
  y: number;
  z: number;
}

// Raw, uncalibrated head pose measured from a single frame.
export interface RawHeadPose {
  noseX: number;
  noseY: number;
  yaw: number;
  pitch: number;
}

// MediaPipe FaceMesh landmark indices used for pose estimation.
export const LANDMARK = {
  NOSE: 1,
  TOP_HEAD: 10,
  CHIN: 152,
  LEFT_EAR: 234,
  RIGHT_EAR: 454,
} as const;

export const STEERING_DEADZONE = 0.08;
// Head rotation (radians past neutral) that gives full steering, the same
// authority as holding a keyboard key. Chosen so the curve matches the
// original tuning (excess² × 15) below full deflection.
export const STEERING_FULL_ANGLE = 0.34;
// Looking down is physically harder than looking up, so it saturates sooner
// (the original tuning boosted downward pitch by 1.8×).
export const PITCH_DOWN_FULL_ANGLE = 0.27;
// Nose offset (normalized image units) to camera parallax offset.
export const PARALLAX_GAIN = 2.0 * 8.0;

// One Euro filter tuning. minCutoff sets how much jitter is removed while the
// head is still; beta sets how quickly the filter opens up during fast moves.
export const ANGLE_FILTER = { minCutoff: 1.0, beta: 0.8 } as const;
export const POSITION_FILTER = { minCutoff: 1.0, beta: 4.0 } as const;

// Calibration averages the recent filtered poses instead of one frame.
export const CALIBRATION_WINDOW_MS = 500;
export const CALIBRATION_MIN_SAMPLES = 5;

export function computeRawHeadPose(
  landmarks: readonly Landmark[] | null | undefined,
): RawHeadPose | null {
  if (!landmarks || landmarks.length <= LANDMARK.RIGHT_EAR) {
    return null;
  }

  const nose = landmarks[LANDMARK.NOSE];
  const leftEar = landmarks[LANDMARK.LEFT_EAR];
  const rightEar = landmarks[LANDMARK.RIGHT_EAR];
  const topHead = landmarks[LANDMARK.TOP_HEAD];
  const chin = landmarks[LANDMARK.CHIN];

  return {
    noseX: nose.x,
    noseY: nose.y,
    yaw: Math.atan2(rightEar.z - leftEar.z, rightEar.x - leftEar.x),
    pitch: -Math.atan2(chin.z - topHead.z, chin.y - topHead.y),
  };
}

// Zero inside the deadzone, then a quadratic ramp that keeps small head
// movements gentle, reaching ±1 at fullAngle and clamped there.
export function applySteeringCurve(
  angle: number,
  deadzone = STEERING_DEADZONE,
  fullAngle = STEERING_FULL_ANGLE,
): number {
  const magnitude = Math.abs(angle);
  if (magnitude <= deadzone) {
    return 0;
  }
  const progress = Math.min(1, (magnitude - deadzone) / (fullAngle - deadzone));
  return Math.sign(angle) * progress * progress;
}

export interface FlightInputs {
  yawInput: number;
  pitchInput: number;
  camPosX: number;
  camPosY: number;
}

export function computeFlightInputs(
  pose: RawHeadPose,
  calibration: RawHeadPose,
): FlightInputs {
  const adjustedYaw = pose.yaw - calibration.yaw;
  const adjustedPitch = pose.pitch - calibration.pitch;
  const pitchFullAngle =
    adjustedPitch < 0 ? PITCH_DOWN_FULL_ANGLE : STEERING_FULL_ANGLE;

  return {
    yawInput: -applySteeringCurve(adjustedYaw),
    pitchInput: applySteeringCurve(adjustedPitch, STEERING_DEADZONE, pitchFullAngle),
    camPosX: -(pose.noseX - calibration.noseX) * PARALLAX_GAIN,
    camPosY: (pose.noseY - calibration.noseY) * PARALLAX_GAIN,
  };
}

function smoothingFactor(cutoffHz: number, dtSeconds: number): number {
  const tau = 1 / (2 * Math.PI * cutoffHz);
  return 1 / (1 + tau / dtSeconds);
}

// One Euro filter (Casiez et al., 2012): a low-pass filter whose cutoff rises
// with speed, so it removes jitter when still without lagging fast moves.
export class OneEuroFilter {
  private readonly minCutoff: number;
  private readonly beta: number;
  private readonly derivativeCutoff: number;
  private previousValue: number | null = null;
  private previousDerivative = 0;
  private previousTimeMs = 0;

  constructor(minCutoff: number, beta: number, derivativeCutoff = 1.0) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.derivativeCutoff = derivativeCutoff;
  }

  public reset(): void {
    this.previousValue = null;
    this.previousDerivative = 0;
  }

  public filter(value: number, timeMs: number): number {
    if (this.previousValue === null) {
      this.previousValue = value;
      this.previousTimeMs = timeMs;
      return value;
    }

    const dtSeconds = (timeMs - this.previousTimeMs) / 1000;
    if (dtSeconds <= 0) {
      return this.previousValue;
    }

    const rawDerivative = (value - this.previousValue) / dtSeconds;
    const derivativeAlpha = smoothingFactor(this.derivativeCutoff, dtSeconds);
    const derivative =
      this.previousDerivative +
      derivativeAlpha * (rawDerivative - this.previousDerivative);

    const cutoff = this.minCutoff + this.beta * Math.abs(derivative);
    const alpha = smoothingFactor(cutoff, dtSeconds);
    const filtered = this.previousValue + alpha * (value - this.previousValue);

    this.previousValue = filtered;
    this.previousDerivative = derivative;
    this.previousTimeMs = timeMs;
    return filtered;
  }
}

class HeadPoseFilter {
  private readonly noseX = new OneEuroFilter(POSITION_FILTER.minCutoff, POSITION_FILTER.beta);
  private readonly noseY = new OneEuroFilter(POSITION_FILTER.minCutoff, POSITION_FILTER.beta);
  private readonly yaw = new OneEuroFilter(ANGLE_FILTER.minCutoff, ANGLE_FILTER.beta);
  private readonly pitch = new OneEuroFilter(ANGLE_FILTER.minCutoff, ANGLE_FILTER.beta);

  public reset(): void {
    this.noseX.reset();
    this.noseY.reset();
    this.yaw.reset();
    this.pitch.reset();
  }

  public filter(pose: RawHeadPose, timeMs: number): RawHeadPose {
    return {
      noseX: this.noseX.filter(pose.noseX, timeMs),
      noseY: this.noseY.filter(pose.noseY, timeMs),
      yaw: this.yaw.filter(pose.yaw, timeMs),
      pitch: this.pitch.filter(pose.pitch, timeMs),
    };
  }
}

interface PoseSample {
  timeMs: number;
  pose: RawHeadPose;
}

// Tracks the latest filtered pose and the calibrated "zero" pose. The raw pose
// is kept separately from the outputs so recalibrating always captures the
// player's real posture, never already-processed steering values.
export class HeadPoseTracker {
  public yawInput = 0;
  public pitchInput = 0;
  public camPosX = 0;
  public camPosY = 0;
  public faceDetected = false;

  private readonly filter = new HeadPoseFilter();
  private recentPoses: PoseSample[] = [];
  private calibration: RawHeadPose | null = null;
  private lastFaceSeenAtMs: number | null = null;

  public get isCalibrated(): boolean {
    return this.calibration !== null;
  }

  public update(
    landmarks: readonly Landmark[] | null | undefined,
    timeMs: number,
  ): void {
    const rawPose = computeRawHeadPose(landmarks);

    if (!rawPose) {
      // Keep the last parallax offset so the camera doesn't snap when the
      // face briefly leaves the frame; just stop steering. Filter state and
      // calibration samples are dropped so a returning face starts fresh.
      this.faceDetected = false;
      this.yawInput = 0;
      this.pitchInput = 0;
      this.filter.reset();
      this.recentPoses = [];
      return;
    }

    const pose = this.filter.filter(rawPose, timeMs);
    this.faceDetected = true;
    this.lastFaceSeenAtMs = timeMs;
    this.recentPoses.push({ timeMs, pose });
    this.recentPoses = this.recentPoses.filter(
      (sample) => timeMs - sample.timeMs <= CALIBRATION_WINDOW_MS,
    );

    if (!this.calibration) {
      // Uncalibrated angles are meaningless as inputs, so every output stays 0
      // (keyboard freelook included) until the player calibrates.
      return;
    }

    const inputs = computeFlightInputs(pose, this.calibration);
    this.yawInput = inputs.yawInput;
    this.pitchInput = inputs.pitchInput;
    this.camPosX = inputs.camPosX;
    this.camPosY = inputs.camPosY;
  }

  // Milliseconds since a face was last tracked; 0 while one is visible or
  // before any face has been seen.
  public faceLostForMs(nowMs: number): number {
    if (this.faceDetected || this.lastFaceSeenAtMs === null) {
      return 0;
    }
    return Math.max(0, nowMs - this.lastFaceSeenAtMs);
  }

  // Locks the average of the recent poses in as neutral. Returns false when
  // there is no face or too few frames yet to average.
  public calibrate(): boolean {
    if (!this.faceDetected || this.recentPoses.length < CALIBRATION_MIN_SAMPLES) {
      return false;
    }

    const count = this.recentPoses.length;
    const sum = { noseX: 0, noseY: 0, yaw: 0, pitch: 0 };
    for (const { pose } of this.recentPoses) {
      sum.noseX += pose.noseX;
      sum.noseY += pose.noseY;
      sum.yaw += pose.yaw;
      sum.pitch += pose.pitch;
    }
    this.calibration = {
      noseX: sum.noseX / count,
      noseY: sum.noseY / count,
      yaw: sum.yaw / count,
      pitch: sum.pitch / count,
    };
    this.yawInput = 0;
    this.pitchInput = 0;
    this.camPosX = 0;
    this.camPosY = 0;
    return true;
  }
}
