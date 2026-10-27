// Pure state machine for the webcam lifecycle: the model preloads on page
// open, the camera is only requested when the player chooses to fly, and any
// failure can be retried without a reload.
import { VisionError, type VisionErrorKind } from "./visionErrors.ts";

export type CameraFlowState =
  | { status: "idle" }
  | { status: "preloading" }
  | { status: "ready" }
  | { status: "requesting" }
  | { status: "live" }
  | { status: "error"; kind: VisionErrorKind };

export type CameraFlowEvent =
  | { type: "preloadStarted" }
  | { type: "preloadDone" }
  | { type: "preloadFailed"; kind: VisionErrorKind }
  | { type: "cameraRequested" }
  | { type: "cameraStarted" }
  | { type: "cameraFailed"; kind: VisionErrorKind }
  | { type: "retry" }
  | { type: "stopped" };

export const INITIAL_CAMERA_FLOW: CameraFlowState = { status: "idle" };

// Returns the next state, or the same object when the event doesn't apply.
export function reduceCameraFlow(
  state: CameraFlowState,
  event: CameraFlowEvent,
): CameraFlowState {
  switch (event.type) {
    case "stopped":
      return INITIAL_CAMERA_FLOW;
    case "preloadStarted":
      return state.status === "idle" ? { status: "preloading" } : state;
    case "preloadDone":
      return state.status === "preloading" ? { status: "ready" } : state;
    case "preloadFailed":
      return state.status === "preloading"
        ? { status: "error", kind: event.kind }
        : state;
    case "cameraRequested":
      // startCamera() preloads by itself, so Join may come before the model is ready.
      return state.status === "idle" ||
        state.status === "preloading" ||
        state.status === "ready"
        ? { status: "requesting" }
        : state;
    case "cameraStarted":
      return state.status === "requesting" ? { status: "live" } : state;
    case "cameraFailed":
      return state.status === "requesting"
        ? { status: "error", kind: event.kind }
        : state;
    case "retry":
      if (state.status !== "error" || state.kind === "insecure-context") {
        return state;
      }
      return state.kind === "model-load-failed"
        ? { status: "preloading" }
        : { status: "requesting" };
  }
}

export function isVisionReady(state: CameraFlowState): boolean {
  return state.status === "live";
}

export function isVisionFailed(state: CameraFlowState): boolean {
  return state.status === "error";
}

// The kind carried by a rejection from VisionController, "unknown" otherwise.
export function visionErrorKind(error: unknown): VisionErrorKind {
  return error instanceof VisionError ? error.kind : "unknown";
}
