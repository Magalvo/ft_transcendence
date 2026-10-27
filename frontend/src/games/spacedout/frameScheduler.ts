export interface FrameScheduler {
  readonly kind: "video-frame" | "animation-frame";
  request(callback: () => void): number;
  cancel(handle: number): void;
}

interface VideoFrameSource {
  requestVideoFrameCallback?: (callback: () => void) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
}

interface AnimationFrames {
  requestAnimationFrame(callback: () => void): number;
  cancelAnimationFrame(handle: number): void;
}

// requestVideoFrameCallback fires once per new camera frame (~30 Hz) instead
// of once per display refresh, so detection does no idle work between frames.
export function pickFrameScheduler(
  video: VideoFrameSource,
  frames: AnimationFrames = globalThis,
): FrameScheduler {
  if (typeof video.requestVideoFrameCallback === "function"
    && typeof video.cancelVideoFrameCallback === "function") {
    return {
      kind: "video-frame",
      request: (callback) => video.requestVideoFrameCallback!(() => callback()),
      cancel: (handle) => video.cancelVideoFrameCallback!(handle),
    };
  }
  return {
    kind: "animation-frame",
    request: (callback) => frames.requestAnimationFrame(() => callback()),
    cancel: (handle) => frames.cancelAnimationFrame(handle),
  };
}
