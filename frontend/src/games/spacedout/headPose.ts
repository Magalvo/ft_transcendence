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
export const STEERING_SENSITIVITY = 15.0;
// Looking down is physically harder than looking up, so it gets a boost.
export const PITCH_DOWN_MULTIPLIER = 1.8;
// Nose offset (normalized image units) to camera parallax offset.
export const PARALLAX_GAIN = 2.0 * 8.0;

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
// movements gentle and lets bigger turns steer hard.
export function applySteeringCurve(
  angle: number,
  deadzone = STEERING_DEADZONE,
  sensitivity = STEERING_SENSITIVITY,
): number {
  const magnitude = Math.abs(angle);
  if (magnitude <= deadzone) {
    return 0;
  }
  const excess = magnitude - deadzone;
  return excess * excess * Math.sign(angle) * sensitivity;
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
  const pitchMultiplier = adjustedPitch < 0 ? PITCH_DOWN_MULTIPLIER : 1.0;

  return {
    yawInput: -applySteeringCurve(adjustedYaw),
    pitchInput: applySteeringCurve(adjustedPitch) * pitchMultiplier,
    camPosX: -(pose.noseX - calibration.noseX) * PARALLAX_GAIN,
    camPosY: (pose.noseY - calibration.noseY) * PARALLAX_GAIN,
  };
}

// Tracks the latest raw pose and the calibrated "zero" pose. The raw pose is
// kept separately from the outputs so recalibrating always captures the
// player's real posture, never already-processed steering values.
export class HeadPoseTracker {
  public yawInput = 0;
  public pitchInput = 0;
  public camPosX = 0;
  public camPosY = 0;
  public faceDetected = false;

  private rawPose: RawHeadPose | null = null;
  private calibration: RawHeadPose | null = null;

  public get isCalibrated(): boolean {
    return this.calibration !== null;
  }

  public update(landmarks: readonly Landmark[] | null | undefined): void {
    const pose = computeRawHeadPose(landmarks);
    this.rawPose = pose;

    if (!pose) {
      // Keep the last parallax offset so the camera doesn't snap when the
      // face briefly leaves the frame; just stop steering.
      this.faceDetected = false;
      this.yawInput = 0;
      this.pitchInput = 0;
      return;
    }

    this.faceDetected = true;

    if (!this.calibration) {
      // Uncalibrated: expose the raw pose (used by keyboard-mode freelook).
      this.yawInput = pose.yaw;
      this.pitchInput = pose.pitch;
      this.camPosX = pose.noseX;
      this.camPosY = pose.noseY;
      return;
    }

    const inputs = computeFlightInputs(pose, this.calibration);
    this.yawInput = inputs.yawInput;
    this.pitchInput = inputs.pitchInput;
    this.camPosX = inputs.camPosX;
    this.camPosY = inputs.camPosY;
  }

  // Locks the current raw pose in as neutral. Returns false without a face.
  public calibrate(): boolean {
    if (!this.rawPose) {
      return false;
    }
    this.calibration = { ...this.rawPose };
    this.yawInput = 0;
    this.pitchInput = 0;
    this.camPosX = 0;
    this.camPosY = 0;
    return true;
  }
}
