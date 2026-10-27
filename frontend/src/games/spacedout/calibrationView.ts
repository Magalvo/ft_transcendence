// Pure view helpers for the calibration screen and the detection loop. The
// game calls these every frame, so they stay cheap and DOM-free.
import type { CameraFlowState } from "./cameraFlow";
import type { ControlMode } from "./SpacedOutGameShared";
import type { VisionErrorKind } from "./visionErrors";

export interface CameraErrorView {
  message: string;
  // Whether a Retry button can fix it. The camera flow decides whether the
  // retry reloads the model or asks for the camera again.
  retry: boolean;
}

const CAMERA_ERROR_VIEWS: Record<VisionErrorKind, CameraErrorView> = {
  "permission-denied": {
    message:
      "Camera access is blocked. Click the camera icon in the address bar (or open the site settings), allow the camera, then press Retry.",
    retry: true,
  },
  "no-camera": {
    message: "No camera was found. Connect a webcam, then press Retry.",
    retry: true,
  },
  "camera-busy": {
    message:
      "The camera is in use by another app or tab. Close it, then press Retry.",
    retry: true,
  },
  "insecure-context": {
    message:
      "The camera only works on a secure page. Open SpacedOut over HTTPS (https://).",
    retry: false,
  },
  "model-load-failed": {
    message:
      "The face-tracking model failed to load. Check your connection, then press Retry.",
    retry: true,
  },
  unknown: {
    message: "The camera could not be started. Press Retry to try again.",
    retry: true,
  },
};

export function cameraErrorView(kind: VisionErrorKind): CameraErrorView {
  return CAMERA_ERROR_VIEWS[kind];
}

export function cameraLoadingText(flow: CameraFlowState): string {
  return flow.status === "requesting" || flow.status === "ready"
    ? "ALLOW CAMERA ACCESS TO CONTINUE."
    : "LOADING FACE TRACKER...";
}

export interface CalibrationInput {
  webcamRequired: boolean;
  flow: CameraFlowState;
  faceDetected: boolean;
  isDead: boolean;
  isPaused: boolean;
  isCalibrated: boolean;
  canCalibrate: boolean;
}

// Everything the calibration screen shows. Adding a field here means adding
// it to calibrationViewKey too.
export interface CalibrationView {
  buttonLabel: string;
  buttonDisabled: boolean;
  errorMessage: string | null;
  retryVisible: boolean;
  previewVisible: boolean;
  faceDetected: boolean;
}

function calibrateButton(input: CalibrationInput): [string, boolean] {
  if (!input.webcamRequired) return ["Keyboard Mode", true];
  if (input.flow.status === "error") return ["Camera Unavailable", true];
  if (input.flow.status !== "live") return ["Initializing...", true];
  if (input.isPaused) return ["Paused", true];
  if (input.isDead) return ["Unavailable", true];
  if (!input.canCalibrate) return ["Center Face", true];
  return [input.isCalibrated ? "Recalibrate" : "Calibrate", false];
}

export function calibrationView(input: CalibrationInput): CalibrationView {
  const [buttonLabel, buttonDisabled] = calibrateButton(input);
  const error =
    input.flow.status === "error" ? cameraErrorView(input.flow.kind) : null;
  const live = input.flow.status === "live";
  return {
    buttonLabel,
    buttonDisabled,
    errorMessage: error?.message ?? null,
    retryVisible: error?.retry ?? false,
    previewVisible: live,
    faceDetected: live && input.faceDetected,
  };
}

// A comparable key, so the DOM is only touched when something shown changes.
export function calibrationViewKey(view: CalibrationView): string {
  return JSON.stringify([
    view.buttonLabel,
    view.buttonDisabled,
    view.errorMessage,
    view.retryVisible,
    view.previewVisible,
    view.faceDetected,
  ]);
}

export type DetectionPhase = "lobby" | "spectating" | "calibrating" | "flying";

export interface DetectionInput {
  phase: DetectionPhase;
  cameraLive: boolean;
  isPaused: boolean;
  isDead: boolean;
  controlMode: ControlMode;
  // The face has been calibrated at least once, so keyboard freelook works.
  faceCalibrated: boolean;
}

// Face detection runs only while calibrating or flying with face input.
export function shouldDetect(input: DetectionInput): boolean {
  if (!input.cameraLive || input.isPaused || input.isDead) return false;
  if (input.phase === "calibrating") return true;
  if (input.phase !== "flying") return false;
  return input.controlMode === "FACE" || input.faceCalibrated;
}
