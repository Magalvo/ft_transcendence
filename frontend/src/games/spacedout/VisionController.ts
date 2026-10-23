import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

// The wasm runtime must match the JS bundle from package.json exactly; keep
// both on the same pinned version (never "@latest", which would pull new
// third-party code into the app without a review or rebuild).
const MEDIAPIPE_VERSION = "0.10.32";
const MEDIAPIPE_WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;

export class VisionController {
  private videoElement: HTMLVideoElement;
  private faceLandmarker: FaceLandmarker | null = null;
  private isCalibrated = false;
  private lastVideoTime = -1;
  private requestAnimationFrameId: number | null = null;

  // Calibration state
  private calNoseX = 0.5;
  private calNoseY = 0.5;
  private calYaw = 0;
  private calPitch = 0;

  // Live flight outputs
  public yawInput = 0;
  public pitchInput = 0;
  public targetCamPosX = 0;
  public targetCamPosY = 0;
  public faceDetected = false;

  constructor(videoElement: HTMLVideoElement) {
    this.videoElement = videoElement;
  }

  public async init(onReady: () => void): Promise<void> {
    const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_URL);

    this.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numFaces: 1,
    });

    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480 },
    });
    
    this.videoElement.srcObject = stream;
    this.videoElement.muted = true;
    this.videoElement.playsInline = true;
    this.videoElement.addEventListener("loadeddata", () => {
      this.predictWebcam();
      onReady();
    }, { once: true });
    await this.videoElement.play();
  }

  public calibrate(): void {
    if (!this.faceDetected) return;
    this.isCalibrated = true;
    
    // Lock in the current pose as "Zero"
    this.calYaw = this.yawInput; // We temporarily store raw yaw here in predictWebcam
    this.calPitch = this.pitchInput; 
    this.calNoseX = this.targetCamPosX;
    this.calNoseY = this.targetCamPosY;
  }

  public stop(): void {
    if (this.requestAnimationFrameId !== null) {
      cancelAnimationFrame(this.requestAnimationFrameId);
    }
    const stream = this.videoElement.srcObject as MediaStream;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
  }

  private predictWebcam = (): void => {
    if (this.videoElement.currentTime !== this.lastVideoTime && this.faceLandmarker) {
      this.lastVideoTime = this.videoElement.currentTime;
      const results = this.faceLandmarker.detectForVideo(this.videoElement, performance.now());

      if (results.faceLandmarks && results.faceLandmarks.length > 0) {
        this.faceDetected = true;
        const landmarks = results.faceLandmarks[0];

        const nose = landmarks[1];
        const leftEar = landmarks[234];
        const rightEar = landmarks[454];
        const topHead = landmarks[10];
        const chin = landmarks[152];

        // Raw face calculations
        const liveRawNoseX = nose.x;
        const liveRawNoseY = nose.y;
        const liveRawYaw = Math.atan2(rightEar.z - leftEar.z, rightEar.x - leftEar.x);
        const liveRawPitch = -Math.atan2(chin.z - topHead.z, chin.y - topHead.y);

        if (this.isCalibrated) {
          // Calculate Parallax offsets
          this.targetCamPosX = (liveRawNoseX - this.calNoseX) * -2.0 * 8.0;
          this.targetCamPosY = -((liveRawNoseY - this.calNoseY) * -2.0 * 8.0);

          // Calculate Steering Inputs
          const adjustedYaw = liveRawYaw - this.calYaw;
          const adjustedPitch = liveRawPitch - this.calPitch;

         // const DEADZONE = 0.08;
          const DEADZONE = 0.08;
          const STEERING_SENSITIVITY = 15.0
          if (Math.abs(adjustedYaw) > DEADZONE) {
            const rawInput = Math.abs(adjustedYaw) - DEADZONE;
            this.yawInput = -(rawInput * rawInput * Math.sign(adjustedYaw) * STEERING_SENSITIVITY);
          } else {
            this.yawInput = 0;
          }

          if (Math.abs(adjustedPitch) > DEADZONE) {
            const rawInput = Math.abs(adjustedPitch) - DEADZONE;

            // ORIGINAL IMPLEMENTATION (linear after deadzone)
            //this.pitchInput = rawInput * rawInput * Math.sign(adjustedPitch) * STEERING_SENSITIVITY;

            let asymmetricMultiplier = 1.0;
            if (adjustedPitch < 0) { // Assuming < 0 is looking down. Swap to > 0 if needed.
              asymmetricMultiplier = 1.8; // Boost downward pitch by 80%
            }

            // Apply the asymmetric multiplier to the final curve
            this.pitchInput = (rawInput * rawInput * Math.sign(adjustedPitch) * STEERING_SENSITIVITY * asymmetricMultiplier);
          } else {
            this.pitchInput = 0;
          }
        } else {
          // Pre-calibration storage AINDA NAO FUNFA
          this.yawInput = liveRawYaw;
          this.pitchInput = liveRawPitch;
          this.targetCamPosX = liveRawNoseX;
          this.targetCamPosY = liveRawNoseY;
        }
      } else {
        this.faceDetected = false;
        this.yawInput = 0;
        this.pitchInput = 0;
      }
    }
    
    this.requestAnimationFrameId = requestAnimationFrame(this.predictWebcam);
  };
}
