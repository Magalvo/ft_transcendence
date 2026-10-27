import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { createWithDelegateFallback, type Delegate } from "./delegateFallback";
import { pickFrameScheduler, type FrameScheduler } from "./frameScheduler";
import type { ControlSettings } from "./controlSettings";
import { HeadPoseTracker } from "./headPose";
import { mediapipeAssetUrls } from "./visionAssets";
import { VisionError, classifyCameraError, type VisionErrorKind } from "./visionErrors";

const CAMERA_ERROR_MESSAGES: Record<VisionErrorKind, string> = {
  "permission-denied": "Camera access was denied.",
  "no-camera": "No camera was found.",
  "camera-busy": "The camera is in use by another application.",
  "insecure-context": "The camera needs a secure (HTTPS) page.",
  "model-load-failed": "The face tracking model could not be loaded.",
  unknown: "The camera could not be started.",
};

export class VisionController {
  private videoElement: HTMLVideoElement;
  private faceLandmarker: FaceLandmarker | null = null;
  private landmarkerDelegate: Delegate | null = null;
  private preloadPromise: Promise<void> | null = null;
  private cameraPromise: Promise<void> | null = null;
  private stream: MediaStream | null = null;
  private lastVideoTime = -1;
  private readonly frameScheduler: FrameScheduler;
  private frameHandle: number | null = null;
  private active = true;
  private readonly tracker = new HeadPoseTracker();
  // Set by stop(). Every async step checks it after each await so a page left
  // while the model or camera was still loading never leaves the camera running.
  private disposed = false;

  constructor(videoElement: HTMLVideoElement) {
    this.videoElement = videoElement;
    this.frameScheduler = pickFrameScheduler(videoElement);
  }

  // Live flight outputs
  public get yawInput(): number {
    return this.tracker.yawInput;
  }

  public get pitchInput(): number {
    return this.tracker.pitchInput;
  }

  public get targetCamPosX(): number {
    return this.tracker.camPosX;
  }

  public get targetCamPosY(): number {
    return this.tracker.camPosY;
  }

  public get faceDetected(): boolean {
    return this.tracker.faceDetected;
  }

  // Which MediaPipe delegate the landmarker runs on; null until preloaded.
  public get delegate(): Delegate | null {
    return this.landmarkerDelegate;
  }

  // Kept for SpacedOutGame: model + camera, then onReady once frames flow.
  public async init(onReady: () => void): Promise<void> {
    await this.startCamera();
    if (this.disposed) return;
    onReady();
  }

  // Loads the wasm runtime and the model only; never prompts for the camera.
  // Idempotent; a failed load can be retried.
  public preload(): Promise<void> {
    if (this.disposed || this.faceLandmarker) return Promise.resolve();
    this.preloadPromise ??= this.loadLandmarker().catch((error: unknown) => {
      this.preloadPromise = null;
      throw error;
    });
    return this.preloadPromise;
  }

  // Preloads if needed, then opens the camera and starts detection.
  // Safe to call again after a failure.
  public startCamera(): Promise<void> {
    if (this.disposed || this.stream) return Promise.resolve();
    this.cameraPromise ??= this.openCamera().finally(() => {
      this.cameraPromise = null;
    });
    return this.cameraPromise;
  }

  // Pauses or resumes detection. The camera stays on, so resuming is instant.
  public setActive(active: boolean): void {
    this.active = active;
    if (active) {
      this.scheduleDetection();
    } else if (this.frameHandle !== null) {
      this.frameScheduler.cancel(this.frameHandle);
      this.frameHandle = null;
    }
  }

  // Returns false when there is no face or too few frames yet to average.
  public calibrate(): boolean {
    return this.tracker.calibrate();
  }

  public setControlSettings(settings: ControlSettings): void {
    this.tracker.setSettings(settings);
  }

  public faceLostForMs(nowMs: number): number {
    return this.tracker.faceLostForMs(nowMs);
  }

  public stop(): void {
    this.disposed = true;
    if (this.frameHandle !== null) {
      this.frameScheduler.cancel(this.frameHandle);
      this.frameHandle = null;
    }
    this.releaseCamera();
    this.faceLandmarker?.close();
    this.faceLandmarker = null;
  }

  private async loadLandmarker(): Promise<void> {
    const { wasmDir, modelPath } = mediapipeAssetUrls(import.meta.env.BASE_URL);
    let created: { value: FaceLandmarker; delegate: Delegate };
    try {
      const fileset = await FilesetResolver.forVisionTasks(wasmDir);
      if (this.disposed) return;
      created = await createWithDelegateFallback((delegate) =>
        FaceLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: modelPath, delegate },
          runningMode: "VIDEO",
          numFaces: 1,
        }),
      );
    } catch (error) {
      if (this.disposed) return;
      throw new VisionError("model-load-failed", CAMERA_ERROR_MESSAGES["model-load-failed"], { cause: error });
    }
    if (this.disposed) {
      created.value.close();
      return;
    }
    this.faceLandmarker = created.value;
    this.landmarkerDelegate = created.delegate;
    console.info(`[vision] Face landmarker running on the ${created.delegate} delegate.`);
  }

  private async openCamera(): Promise<void> {
    await this.preload();
    if (this.disposed) return;

    const env = {
      isSecureContext: globalThis.isSecureContext === true,
      hasMediaDevices: typeof navigator.mediaDevices?.getUserMedia === "function",
    };
    let stream: MediaStream;
    try {
      if (!env.isSecureContext || !env.hasMediaDevices) throw new Error("camera API unavailable");
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
      });
    } catch (error) {
      if (this.disposed) return;
      const kind = classifyCameraError(error, env);
      throw new VisionError(kind, CAMERA_ERROR_MESSAGES[kind], { cause: error });
    }
    if (this.disposed) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }

    this.stream = stream;
    this.videoElement.srcObject = stream;
    this.videoElement.muted = true;
    this.videoElement.playsInline = true;
    try {
      await this.videoElement.play();
    } catch (error) {
      // stop() clearing srcObject interrupts play(); that is not a failure.
      if (this.disposed) return;
      this.releaseCamera();
      throw new VisionError("unknown", CAMERA_ERROR_MESSAGES.unknown, { cause: error });
    }
    if (this.disposed) return;
    this.scheduleDetection();
  }

  private releaseCamera(): void {
    const stream = this.stream ?? (this.videoElement.srcObject as MediaStream | null);
    stream?.getTracks().forEach((track) => track.stop());
    this.videoElement.srcObject = null;
    this.stream = null;
  }

  private scheduleDetection(): void {
    if (this.disposed || !this.active || !this.stream || this.frameHandle !== null) return;
    this.frameHandle = this.frameScheduler.request(this.detectFrame);
  }

  private detectFrame = (): void => {
    this.frameHandle = null;
    if (this.disposed || !this.active) return;

    if (this.videoElement.currentTime !== this.lastVideoTime && this.faceLandmarker) {
      this.lastVideoTime = this.videoElement.currentTime;
      const now = performance.now();
      const results = this.faceLandmarker.detectForVideo(this.videoElement, now);
      this.tracker.update(results.faceLandmarks?.[0], now);
    }

    this.scheduleDetection();
  };
}
