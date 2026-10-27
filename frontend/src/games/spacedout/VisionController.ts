import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { HeadPoseTracker } from "./headPose";

// The wasm runtime must match the JS bundle from package.json exactly; keep
// both on the same pinned version (never "@latest", which would pull new
// third-party code into the app without a review or rebuild).
const MEDIAPIPE_VERSION = "0.10.32";
const MEDIAPIPE_WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;

export class VisionController {
  private videoElement: HTMLVideoElement;
  private faceLandmarker: FaceLandmarker | null = null;
  private lastVideoTime = -1;
  private requestAnimationFrameId: number | null = null;
  private readonly tracker = new HeadPoseTracker();
  // Set by stop(). init() checks it after every await so a page left while
  // the model or camera was still loading never leaves the camera running.
  private disposed = false;

  constructor(videoElement: HTMLVideoElement) {
    this.videoElement = videoElement;
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

  public async init(onReady: () => void): Promise<void> {
    const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_URL);
    if (this.disposed) return;

    const faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numFaces: 1,
    });
    if (this.disposed) {
      faceLandmarker.close();
      return;
    }
    this.faceLandmarker = faceLandmarker;

    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480 },
    });
    if (this.disposed) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }

    this.videoElement.srcObject = stream;
    this.videoElement.muted = true;
    this.videoElement.playsInline = true;
    this.videoElement.addEventListener("loadeddata", () => {
      if (this.disposed) return;
      this.predictWebcam();
      onReady();
    }, { once: true });

    try {
      await this.videoElement.play();
    } catch (error) {
      // stop() clearing srcObject interrupts play(); that is not a failure.
      if (this.disposed) return;
      throw error;
    }
  }

  public calibrate(): void {
    this.tracker.calibrate();
  }

  public stop(): void {
    this.disposed = true;
    if (this.requestAnimationFrameId !== null) {
      cancelAnimationFrame(this.requestAnimationFrameId);
      this.requestAnimationFrameId = null;
    }
    const stream = this.videoElement.srcObject as MediaStream | null;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    this.videoElement.srcObject = null;
    this.faceLandmarker?.close();
    this.faceLandmarker = null;
  }

  private predictWebcam = (): void => {
    if (this.disposed) return;

    if (this.videoElement.currentTime !== this.lastVideoTime && this.faceLandmarker) {
      this.lastVideoTime = this.videoElement.currentTime;
      const results = this.faceLandmarker.detectForVideo(this.videoElement, performance.now());
      this.tracker.update(results.faceLandmarks?.[0]);
    }

    this.requestAnimationFrameId = requestAnimationFrame(this.predictWebcam);
  };
}
