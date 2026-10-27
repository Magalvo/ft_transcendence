// Typed failures from the face tracker, so the UI can tell "permission
// denied" apart from "no camera" and offer the right retry.
export type VisionErrorKind =
  | "permission-denied"   // NotAllowedError / SecurityError
  | "no-camera"           // NotFoundError / OverconstrainedError
  | "camera-busy"         // NotReadableError / AbortError from getUserMedia
  | "insecure-context"    // !isSecureContext or navigator.mediaDevices missing
  | "model-load-failed"   // wasm or model fetch/instantiate failed
  | "unknown";

export class VisionError extends Error {
  readonly kind: VisionErrorKind;

  constructor(kind: VisionErrorKind, message?: string, options?: { cause?: unknown }) {
    super(message ?? kind, options);
    this.name = "VisionError";
    this.kind = kind;
  }
}

const KIND_BY_NAME: Record<string, VisionErrorKind> = {
  NotAllowedError: "permission-denied",
  SecurityError: "permission-denied",
  NotFoundError: "no-camera",
  OverconstrainedError: "no-camera",
  NotReadableError: "camera-busy",
  AbortError: "camera-busy",
};

// Maps a getUserMedia() rejection to a kind. Without a secure context the
// browser hides navigator.mediaDevices, so that case wins over the error.
export function classifyCameraError(
  error: unknown,
  env: { isSecureContext: boolean; hasMediaDevices: boolean },
): VisionErrorKind {
  if (!env.isSecureContext || !env.hasMediaDevices) return "insecure-context";
  if (typeof DOMException === "undefined" || !(error instanceof DOMException)) return "unknown";
  return KIND_BY_NAME[error.name] ?? "unknown";
}
