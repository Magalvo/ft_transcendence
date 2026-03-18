import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { SpacedOutSocketClient } from "./SpacedOutSocketClient";
import type {
  GameMode,
  MatchSettings,
  SpacedOutLogEntry,
  SpacedOutSessionResponse,
  SpacedOutSocketPayload,
  TerrainConfig,
} from "./types";
import { AudioManager } from "./AudioManager";
import { VisionController } from "./VisionController";
import { CombatManager, type CombatState } from "./CombatManager";

const WORLD_RADIUS = 50000;
const TELEMETRY_INTERVAL_MS = 80;
const RADAR_MAX_RANGE = 30000;
const CHUNK_SIZE = 64;
const SCALE_Z = 4;
const MAP_CHUNKS_X = 12;
const MAP_CHUNKS_Y = 12;
const DEFAULT_FLIGHT_SPEED = 220;
const MIN_FLIGHT_SPEED = 100;
const MAX_FLIGHT_SPEED = 350;
const AIRBRAKE_DECELERATION = 180;
const LASER_REPEAT_INTERVAL_MS = 250;
const MISSILE_FIRE_KEY = "q";
const GAMEPLAY_KEYS = new Set([
  " ",
  "w",
  "a",
  "s",
  "d",
  "arrowup",
  "arrowdown",
  "arrowleft",
  "arrowright",
  "shift",
  "control",
  "alt",
  "meta",
  "q",
  "f",
  "c",
  "m",
  "p",
  "b",
  "v",
  "r",
  "[",
  "]",
]);

const DEFAULT_TERRAIN_CONFIG: TerrainConfig = {
  seed: 44897,
  noiseScale: 4,
  heightAmplitude: 2000,
  noiseOctaves: 4,
  persistence: 0.2,
  lacunarity: 2.5,
};

const DEFAULT_MATCH_SETTINGS: MatchSettings = {
  gameMode: "ARCADE",
  botsEnabled: true,
};

type TeamName = "RED" | "BLUE" | "SPECTATOR";
type CameraMode = "PLAYER" | "TERRAIN" | "DEATH" | "SPECTATOR";
type ControlMode = "FACE" | "KEYBOARD";

interface RemotePilotState {
  id: string;
  mesh: THREE.Group;
  label: HTMLDivElement;
  targetPosition: THREE.Vector3;
  targetQuaternion: THREE.Quaternion;
  velocity: THREE.Vector3;
  lastSnapshotAt: number | null;
  hp: number;
  team: TeamName;
  username: string;
}

interface SpacedOutGameOptions {
  mount: HTMLElement;
  hudCanvas: HTMLCanvasElement;
  labelsMount: HTMLElement;
  videoElement: HTMLVideoElement;
  logsMount: HTMLElement;
  statusMount: HTMLElement;
  playerListMount: HTMLElement;
  telemetryMount: HTMLElement;
  loadingOverlay: HTMLElement;
  loadingText: HTMLElement;
  calibrationScreen: HTMLElement;
  calibrateButton: HTMLButtonElement;
  teamScreen: HTMLElement;
  redTeamButton: HTMLButtonElement;
  blueTeamButton: HTMLButtonElement;
  controlsHint: HTMLElement;
  actionButtons: HTMLElement;
  joinButton: HTMLButtonElement;
  spectateButton: HTMLButtonElement;
  speedReadout: HTMLElement;
  modeReadout: HTMLElement;
  targetReadout: HTMLElement;
  terrainEditorPanel: HTMLElement;
  terrainEditorOverlay: HTMLElement;
  terrainMode: HTMLElement;
  terrainSeed: HTMLInputElement;
  terrainNoiseScale: HTMLInputElement;
  terrainHeightAmplitude: HTMLInputElement;
  terrainNoiseOctaves: HTMLInputElement;
  terrainPersistence: HTMLInputElement;
  terrainLacunarity: HTMLInputElement;
  terrainRandomize: HTMLButtonElement;
  terrainRegenerate: HTMLButtonElement;
  terrainFinalize: HTMLButtonElement;
  matchSettingsPanel: HTMLElement;
  matchSettingsOverlay: HTMLElement;
  matchSettingsMode: HTMLElement;
  gameModeSelect: HTMLSelectElement;
  botsEnabledInput: HTMLInputElement;
  session: SpacedOutSessionResponse;
  onJoinSequenceRequest?: () => Promise<void> | void;
  onLobbyRestoreRequest?: () => void;
}

const DEFAULT_COMBAT_STATE: CombatState = {
  aimX: 0,
  aimY: 0,
  aimZ: 1,
  isLockedOn: false,
  lockProgress: 0,
  isBeingTracked: false,
  flareCooldown: 0,
  targetScreenX: 0,
  targetScreenY: 0,
  magnetismYaw: 0,
  magnetismPitch: 0,
  lockedEnemyId: null,
};

function normalizeTeamName(value: unknown): TeamName {
  const upper = String(value || "SPECTATOR").toUpperCase();
  return upper === "BLUE" ? "BLUE" : upper === "RED" ? "RED" : "SPECTATOR";
}

function normalizeGameMode(value: unknown): GameMode {
  return String(value || "").toUpperCase() === "PVP" ? "PVP" : "ARCADE";
}

function quaternionFromPose(
  position: THREE.Vector3,
  direction: THREE.Vector3,
): THREE.Quaternion {
  const up =
    position.lengthSq() > 1e-8
      ? position.clone().normalize()
      : new THREE.Vector3(0, 1, 0);
  const forward =
    direction.lengthSq() > 1e-8
      ? direction.clone().normalize()
      : new THREE.Vector3(0, 1, 0);

  let right = new THREE.Vector3().crossVectors(forward, up);
  if (right.lengthSq() <= 1e-8) {
    right = new THREE.Vector3().crossVectors(
      Math.abs(up.y) < 0.99
        ? new THREE.Vector3(0, 1, 0)
        : new THREE.Vector3(1, 0, 0),
      up,
    );
  }
  right.normalize();

  const correctedUp = new THREE.Vector3()
    .crossVectors(right, forward)
    .normalize();
  const matrix = new THREE.Matrix4();
  matrix.makeBasis(right, correctedUp, forward.clone().negate());
  return new THREE.Quaternion().setFromRotationMatrix(matrix);
}

export class SpacedOutGame {
  private readonly mount: HTMLElement;
  private readonly hudCanvas: HTMLCanvasElement;
  private readonly labelsMount: HTMLElement;
  private readonly videoElement: HTMLVideoElement;
  private readonly logsMount: HTMLElement;
  private readonly statusMount: HTMLElement;
  private readonly playerListMount: HTMLElement;
  private readonly telemetryMount: HTMLElement;
  private readonly loadingOverlay: HTMLElement;
  private readonly loadingText: HTMLElement;
  private readonly calibrationScreen: HTMLElement;
  private readonly calibrateButton: HTMLButtonElement;
  private readonly teamScreen: HTMLElement;
  private readonly redTeamButton: HTMLButtonElement;
  private readonly blueTeamButton: HTMLButtonElement;
  private readonly controlsHint: HTMLElement;
  private readonly actionButtons: HTMLElement;
  private readonly joinButton: HTMLButtonElement;
  private readonly spectateButton: HTMLButtonElement;
  private readonly speedReadout: HTMLElement;
  private readonly modeReadout: HTMLElement;
  private readonly targetReadout: HTMLElement;
  private readonly terrainEditorPanel: HTMLElement;
  private readonly terrainEditorOverlay: HTMLElement;
  private readonly terrainMode: HTMLElement;
  private readonly terrainSeed: HTMLInputElement;
  private readonly terrainNoiseScale: HTMLInputElement;
  private readonly terrainHeightAmplitude: HTMLInputElement;
  private readonly terrainNoiseOctaves: HTMLInputElement;
  private readonly terrainPersistence: HTMLInputElement;
  private readonly terrainLacunarity: HTMLInputElement;
  private readonly terrainRandomize: HTMLButtonElement;
  private readonly terrainRegenerate: HTMLButtonElement;
  private readonly terrainFinalize: HTMLButtonElement;
  private readonly matchSettingsPanel: HTMLElement;
  private readonly matchSettingsOverlay: HTMLElement;
  private readonly matchSettingsMode: HTMLElement;
  private readonly gameModeSelect: HTMLSelectElement;
  private readonly botsEnabledInput: HTMLInputElement;
  private readonly session: SpacedOutSessionResponse;
  private readonly onJoinSequenceRequest?: () => Promise<void> | void;
  private readonly onLobbyRestoreRequest?: () => void;
  private readonly socketClient: SpacedOutSocketClient;
  private readonly logs: SpacedOutLogEntry[] = [];
  private readonly cleanupCallbacks: Array<() => void> = [];
  private readonly remotePilots = new Map<string, RemotePilotState>();
  private readonly telemetryBuffer = new ArrayBuffer(24);
  private readonly telemetryView = new Float32Array(this.telemetryBuffer);
  private readonly terrainCameraPosition = new THREE.Vector3(
    0,
    WORLD_RADIUS + 2800,
    WORLD_RADIUS + 2200,
  );
  private readonly tempA = new THREE.Vector3();
  private readonly tempB = new THREE.Vector3();
  private readonly tempEuler = new THREE.Euler(0, 0, 0, "YXZ");
  private readonly spectateCamPos = new THREE.Vector3();
  private readonly spectateTargetPos = new THREE.Vector3();
  private readonly spectateForward = new THREE.Vector3();
  private readonly spectateUp = new THREE.Vector3();
  private readonly spectateQuat = new THREE.Quaternion();

  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private earthAnchor: THREE.Group | null = null;
  private terrainGroup: THREE.Group | null = null;
  private playerRig: THREE.Group | null = null;
  private localShip: THREE.Group | null = null;
  private animationFrameId: number | null = null;
  private terrainConfig: TerrainConfig = { ...DEFAULT_TERRAIN_CONFIG };
  private myPilotId: string | null = null;
  private localTeam: TeamName = "SPECTATOR";
  private sessionAccepted = false;
  private terrainStateKnown = false;
  private terrainLockedByServer = false;
  private isTerrainHost = false;
  private waitingForTerrainFinalize = false;
  private matchSettings: MatchSettings = { ...DEFAULT_MATCH_SETTINGS };
  private isCalibrated = false;
  private visionReady = false;
  private visionFailed = false;
  private cameraMode: CameraMode = "TERRAIN";
  private controlMode: ControlMode = "FACE";
  private localServerPosition = new THREE.Vector3(0, 0, WORLD_RADIUS + 20000);
  private localForward = new THREE.Vector3(0, 1, 0);
  private localQuaternion = quaternionFromPose(
    new THREE.Vector3(0, 0, WORLD_RADIUS + 20000),
    new THREE.Vector3(0, 1, 0),
  );
  private pressedKeys = new Set<string>();
  private worldGrid: number[][] | null = null;
  private speed = DEFAULT_FLIGHT_SPEED;
  private localYawInput = 0;
  private localPitchInput = 0;
  private isLaserTriggerHeld = false;
  private laserShotQueued = false;
  private nextLaserShotAt = 0;
  private lastFrameTime = 0;
  private lastTelemetryAt = 0;
  private frames = 0;
  private fps = 0;
  private lastFpsSample = 0;
  private isDead = false;
  private respawnAvailable = false;
  private respawnRequested = false;
  private spectatorTargetId: string | null = null;
  private deathCamFuselage: THREE.Object3D | null = null;
  private wantsToPlay = false;
  private joinSequencePending = false;
  private isPaused = false;
  private isDestroyed = false;
  private audio = new AudioManager();
  private vision: VisionController;
  private combatManager: CombatManager | null = null;
  private combatState: CombatState = { ...DEFAULT_COMBAT_STATE };

  constructor(options: SpacedOutGameOptions) {
    this.mount = options.mount;
    this.hudCanvas = options.hudCanvas;
    this.labelsMount = options.labelsMount;
    this.videoElement = options.videoElement;
    this.logsMount = options.logsMount;
    this.statusMount = options.statusMount;
    this.playerListMount = options.playerListMount;
    this.telemetryMount = options.telemetryMount;
    this.loadingOverlay = options.loadingOverlay;
    this.loadingText = options.loadingText;
    this.calibrationScreen = options.calibrationScreen;
    this.calibrateButton = options.calibrateButton;
    this.teamScreen = options.teamScreen;
    this.redTeamButton = options.redTeamButton;
    this.blueTeamButton = options.blueTeamButton;
    this.controlsHint = options.controlsHint;
    this.actionButtons = options.actionButtons;
    this.joinButton = options.joinButton;
    this.spectateButton = options.spectateButton;
    this.speedReadout = options.speedReadout;
    this.modeReadout = options.modeReadout;
    this.targetReadout = options.targetReadout;
    this.terrainEditorPanel = options.terrainEditorPanel;
    this.terrainEditorOverlay = options.terrainEditorOverlay;
    this.terrainMode = options.terrainMode;
    this.terrainSeed = options.terrainSeed;
    this.terrainNoiseScale = options.terrainNoiseScale;
    this.terrainHeightAmplitude = options.terrainHeightAmplitude;
    this.terrainNoiseOctaves = options.terrainNoiseOctaves;
    this.terrainPersistence = options.terrainPersistence;
    this.terrainLacunarity = options.terrainLacunarity;
    this.terrainRandomize = options.terrainRandomize;
    this.terrainRegenerate = options.terrainRegenerate;
    this.terrainFinalize = options.terrainFinalize;
    this.matchSettingsPanel = options.matchSettingsPanel;
    this.matchSettingsOverlay = options.matchSettingsOverlay;
    this.matchSettingsMode = options.matchSettingsMode;
    this.gameModeSelect = options.gameModeSelect;
    this.botsEnabledInput = options.botsEnabledInput;
    this.session = options.session;
    this.onJoinSequenceRequest = options.onJoinSequenceRequest;
    this.onLobbyRestoreRequest = options.onLobbyRestoreRequest;
    this.socketClient = new SpacedOutSocketClient(
      options.session.wsUrl,
      options.session.token,
    );
    this.vision = new VisionController(this.videoElement);
  }

  public start(): void {
    this.isDestroyed = false;
    this.createScene();
    this.bindWindowEvents();
    this.bindUiEvents();
    this.bindSocketEvents();
    this.syncTerrainInputs();
    this.syncMatchSettingsInputs();
    this.rebuildTerrain();
    this.syncFlowScreens();
    this.setTerrainSelectionCamera(true);
    this.setStatus(`Connecting as ${this.session.user.username}...`);
    this.log("info", "Authenticated SpacedOut bootstrap created.");
    this.socketClient.connect();
    void this.initializeVision();
    this.animationFrameId = window.requestAnimationFrame(this.animate);
  }

  public destroy(): void {
    this.isDestroyed = true;
    this.isPaused = false;
    if (this.animationFrameId !== null) {
      window.cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    this.cleanupCallbacks.splice(0).forEach((cleanup) => cleanup());
    this.socketClient.disconnect();
    this.vision.stop();
    this.audio.stop();
    this.remotePilots.forEach((pilot) => pilot.label.remove());
    this.remotePilots.clear();
    this.disposeScene();

    if (this.renderer) {
      this.renderer.dispose();
      const canvas = this.renderer.domElement;
      if (canvas.parentElement === this.mount) {
        this.mount.removeChild(canvas);
      }
    }
  }

  private async initializeVision(): Promise<void> {
    this.calibrateButton.disabled = true;
    try {
      await this.vision.init(() => {
        if (this.isDestroyed) {
          return;
        }
        this.visionReady = true;
        this.visionFailed = false;
        this.updateCalibrationControls();
        this.log("success", "Face tracking link established.");
        this.syncFlowScreens();
      });
    } catch (error) {
      if (this.isDestroyed) {
        return;
      }
      this.visionFailed = true;
      this.updateCalibrationControls();
      this.setStatus("Webcam access is required for SpacedOut face tracking.");
      this.log(
        "error",
        error instanceof Error
          ? error.message
          : "Unable to initialize MediaPipe face tracking.",
      );
    }
  }

  private createScene(): void {
    this.renderer = new THREE.WebGLRenderer({ antialias: false });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(this.mount.clientWidth, this.mount.clientHeight);
    this.mount.insertBefore(this.renderer.domElement, this.mount.firstChild);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x050508);
    this.scene.fog = new THREE.Fog(0x1e488f, 15000, 80000);

    this.camera = new THREE.PerspectiveCamera(
      75,
      this.mount.clientWidth / Math.max(this.mount.clientHeight, 1),
      1,
      100000,
    );

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.15));

    const starGeometry = new THREE.BufferGeometry();
    const stars = new Float32Array(2200 * 3);
    for (let i = 0; i < stars.length; i += 3) {
      stars[i] = THREE.MathUtils.randFloatSpread(220000);
      stars[i + 1] = THREE.MathUtils.randFloatSpread(220000);
      stars[i + 2] = THREE.MathUtils.randFloatSpread(220000);
    }
    starGeometry.setAttribute("position", new THREE.BufferAttribute(stars, 3));
    this.scene.add(
      new THREE.Points(
        starGeometry,
        new THREE.PointsMaterial({
          color: 0xdbeafe,
          size: 180,
          transparent: true,
          opacity: 0.9,
          depthWrite: false,
        }),
      ),
    );

    const earthAnchor = new THREE.Group();
    const terrainGroup = new THREE.Group();
    const playerRig = new THREE.Group();
    playerRig.rotation.order = "YXZ";
    const localShip = this.createPilotShip("RED");
    localShip.position.set(0, -2, -8);

    this.earthAnchor = earthAnchor;
    this.terrainGroup = terrainGroup;
    this.playerRig = playerRig;
    this.localShip = localShip;
    this.combatManager = new CombatManager(
      earthAnchor,
      terrainGroup,
      this.socketClient,
      this.audio,
    );

    this.scene.add(earthAnchor);
    earthAnchor.add(terrainGroup);
    earthAnchor.add(playerRig);
    playerRig.add(localShip);
    playerRig.add(this.camera);

    this.applyLocalShipState();
    this.resizeRenderer();
    this.updateTelemetryPanel();
  }

  private bindWindowEvents(): void {
    const resizeHandler = () => this.resizeRenderer();
    const blurHandler = () => {
      this.pressedKeys.clear();
      this.isLaserTriggerHeld = false;
      this.laserShotQueued = false;
    };
    const wheelHandler = (event: WheelEvent) => {
      if (!this.canControlShip() || this.isPaused) {
        return;
      }

      const direction = Math.sign(event.deltaY);
      if (direction === 0) {
        return;
      }

      event.preventDefault();
      this.speed = THREE.MathUtils.clamp(
        this.speed - direction * 12,
        MIN_FLIGHT_SPEED,
        MAX_FLIGHT_SPEED,
      );
    };
    const keydownHandler = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (this.shouldCaptureGameplayKey(event, key)) {
        event.preventDefault();
      }

      if (key === " ") {
        if (!this.isLaserTriggerHeld && this.canFireWeapons()) {
          this.laserShotQueued = true;
        }
        this.isLaserTriggerHeld = true;
      }

      if (this.isDead || this.isPaused) {
        if (key === "r") {
          event.preventDefault();
          this.activateLocalRespawn();
          return;
        }
        if (key === "b") {
          event.preventDefault();
          this.activateReturnToLobby();
          return;
        }
        if (key === "v") {
          event.preventDefault();
          this.activateLocalSpectate(true);
          return;
        }
        if (key === "[" || key === "]") {
          event.preventDefault();
          if (this.cameraMode !== "SPECTATOR") {
            this.activateLocalSpectate(false);
          }
          this.cycleSpectatorTarget(key === "]" ? 1 : -1);
          return;
        }
      }

      if (key === "m" && this.isCalibrated && !this.isDead) {
        event.preventDefault();
        this.controlMode = this.controlMode === "FACE" ? "KEYBOARD" : "FACE";
        if (this.camera) {
          this.camera.position.set(0, 0, 0);
          this.camera.rotation.set(0, 0, 0);
        }
        return;
      }

      if (
        key === "shift" &&
        !event.repeat &&
        !this.isPaused &&
        this.canFireWeapons()
      ) {
        event.preventDefault();
        this.combatManager?.fireMissile(this.localShip!, this.speed);
        return;
      }

      if (key === "p" && !event.repeat) {
        event.preventDefault();
        this.togglePause();
        return;
      }

      if (key === "c" && !event.repeat) {
        event.preventDefault();
        this.calibrateVision();
        return;
      }

      this.pressedKeys.add(key);
    };
    const keyupHandler = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (this.shouldCaptureGameplayKey(event, key)) {
        event.preventDefault();
      }
      if (key === " ") {
        this.isLaserTriggerHeld = false;
        this.nextLaserShotAt = 0;
      }
      this.pressedKeys.delete(key);
    };

    window.addEventListener("resize", resizeHandler);
    window.addEventListener("blur", blurHandler);
    window.addEventListener("wheel", wheelHandler, { passive: false });
    window.addEventListener("keydown", keydownHandler);
    window.addEventListener("keyup", keyupHandler);

    this.cleanupCallbacks.push(() =>
      window.removeEventListener("resize", resizeHandler),
    );
    this.cleanupCallbacks.push(() =>
      window.removeEventListener("blur", blurHandler),
    );
    this.cleanupCallbacks.push(() =>
      window.removeEventListener("wheel", wheelHandler),
    );
    this.cleanupCallbacks.push(() =>
      window.removeEventListener("keydown", keydownHandler),
    );
    this.cleanupCallbacks.push(() =>
      window.removeEventListener("keyup", keyupHandler),
    );
  }

  private bindUiEvents(): void {
    const onTerrainInput = () => {
      this.terrainConfig = {
        seed: Math.floor(
          Number(this.terrainSeed.value) || DEFAULT_TERRAIN_CONFIG.seed,
        ),
        noiseScale:
          Number(this.terrainNoiseScale.value) ||
          DEFAULT_TERRAIN_CONFIG.noiseScale,
        heightAmplitude:
          Number(this.terrainHeightAmplitude.value) ||
          DEFAULT_TERRAIN_CONFIG.heightAmplitude,
        noiseOctaves: Math.max(
          1,
          Math.floor(
            Number(this.terrainNoiseOctaves.value) ||
              DEFAULT_TERRAIN_CONFIG.noiseOctaves,
          ),
        ),
        persistence:
          Number(this.terrainPersistence.value) ||
          DEFAULT_TERRAIN_CONFIG.persistence,
        lacunarity:
          Number(this.terrainLacunarity.value) ||
          DEFAULT_TERRAIN_CONFIG.lacunarity,
      };
    };

    const regenerate = () => {
      onTerrainInput();
      this.rebuildTerrain();
      this.log("info", "Terrain regenerated locally.");
    };
    const randomize = () => {
      this.terrainConfig.seed = Math.floor(Math.random() * 999999);
      this.syncTerrainInputs();
      this.rebuildTerrain();
      this.log(
        "info",
        `Terrain seed randomized to ${this.terrainConfig.seed}.`,
      );
    };
    const finalize = () => {
      onTerrainInput();
      this.rebuildTerrain();
      if (!this.uploadTerrainCollisionMap()) {
        this.log("error", "Unable to upload the current terrain collision map.");
        return;
      }
      this.waitingForTerrainFinalize = true;
      this.loadingText.textContent = "LOCKING TERRAIN...";
      this.loadingOverlay.classList.remove("hidden");
      this.syncFlowScreens();
      this.socketClient.sendJson({
        type: "terrainFinalize",
        config: this.terrainConfig,
        matchSettings: this.matchSettings,
      });
    };
    const onMatchSettingsInput = () => {
      this.matchSettings = {
        gameMode: normalizeGameMode(this.gameModeSelect.value),
        botsEnabled:
          normalizeGameMode(this.gameModeSelect.value) === "ARCADE" &&
          this.botsEnabledInput.checked,
      };
      this.syncMatchSettingsInputs();
      this.syncFlowScreens();
      this.socketClient.sendJson({
        type: "updateMatchSettings",
        settings: this.matchSettings,
      });
    };
    const calibrate = () => {
      this.calibrateVision();
    };
    const chooseRed = () => this.joinTeam("RED");
    const chooseBlue = () => this.joinTeam("BLUE");
    const joinFlow = () => {
      if (this.isPaused) {
        this.activateReturnToLobby();
        return;
      }
      void this.requestJoinFlow();
    };
    const spectateFlow = () => this.requestSpectateFlow();
    const spectateButtonFlow = () => {
      if (this.isPaused) {
        this.activateLocalSpectate(true);
        return;
      }
      spectateFlow();
    };

    const inputs = [
      this.terrainSeed,
      this.terrainNoiseScale,
      this.terrainHeightAmplitude,
      this.terrainNoiseOctaves,
      this.terrainPersistence,
      this.terrainLacunarity,
    ];
    inputs.forEach((input) => input.addEventListener("change", onTerrainInput));
    this.terrainRegenerate.addEventListener("click", regenerate);
    this.terrainRandomize.addEventListener("click", randomize);
    this.terrainFinalize.addEventListener("click", finalize);
    this.gameModeSelect.addEventListener("change", onMatchSettingsInput);
    this.botsEnabledInput.addEventListener("change", onMatchSettingsInput);
    this.calibrateButton.addEventListener("click", calibrate);
    this.redTeamButton.addEventListener("click", chooseRed);
    this.blueTeamButton.addEventListener("click", chooseBlue);
    this.joinButton.addEventListener("click", joinFlow);
    this.spectateButton.addEventListener("click", spectateButtonFlow);

    inputs.forEach((input) =>
      this.cleanupCallbacks.push(() =>
        input.removeEventListener("change", onTerrainInput),
      ),
    );
    this.cleanupCallbacks.push(() =>
      this.terrainRegenerate.removeEventListener("click", regenerate),
    );
    this.cleanupCallbacks.push(() =>
      this.terrainRandomize.removeEventListener("click", randomize),
    );
    this.cleanupCallbacks.push(() =>
      this.terrainFinalize.removeEventListener("click", finalize),
    );
    this.cleanupCallbacks.push(() =>
      this.gameModeSelect.removeEventListener("change", onMatchSettingsInput),
    );
    this.cleanupCallbacks.push(() =>
      this.botsEnabledInput.removeEventListener("change", onMatchSettingsInput),
    );
    this.cleanupCallbacks.push(() =>
      this.calibrateButton.removeEventListener("click", calibrate),
    );
    this.cleanupCallbacks.push(() =>
      this.redTeamButton.removeEventListener("click", chooseRed),
    );
    this.cleanupCallbacks.push(() =>
      this.blueTeamButton.removeEventListener("click", chooseBlue),
    );
    this.cleanupCallbacks.push(() =>
      this.joinButton.removeEventListener("click", joinFlow),
    );
    this.cleanupCallbacks.push(() =>
      this.spectateButton.removeEventListener("click", spectateButtonFlow),
    );
  }

  private bindSocketEvents(): void {
    this.cleanupCallbacks.push(
      this.socketClient.on("open", () => {
        this.log("success", "Realtime connection established.");
        this.socketClient.sendJson({
          type: "authSession",
          token: this.session.token,
        });
        this.socketClient.sendJson({
          type: "clientPing",
          timestamp: Date.now(),
        });
      }),
    );
    this.cleanupCallbacks.push(
      this.socketClient.on("close", (event) => {
        this.setStatus(`SpacedOut connection closed (${event.code}).`);
        this.log("warning", "Realtime connection closed.");
      }),
    );
    this.cleanupCallbacks.push(
      this.socketClient.on("error", () => {
        this.setStatus("SpacedOut realtime service is unreachable.");
        this.log(
          "error",
          "Realtime error while talking to the SpacedOut backend.",
        );
      }),
    );
    this.cleanupCallbacks.push(
      this.socketClient.on("binary", (buffer) =>
        this.handleBinaryRadar(buffer),
      ),
    );
    this.cleanupCallbacks.push(
      this.socketClient.on("json", (payload) =>
        this.handleJsonMessage(payload),
      ),
    );
  }

  private handleJsonMessage(payload: SpacedOutSocketPayload): void {
    const type = typeof payload.type === "string" ? payload.type : "message";

    switch (type) {
      case "handshake": {
        this.myPilotId = String(payload.id ?? "");
        this.terrainStateKnown = true;
        this.isTerrainHost = !!payload.isTerrainHost;
        this.terrainLockedByServer = !!payload.terrainLocked;
        this.applyMatchSettings(payload.matchSettings);
        const config = payload.terrainConfig as TerrainConfig | undefined;
        if (config) {
          this.terrainConfig = {
            seed: Number(config.seed),
            noiseScale: Number(config.noiseScale),
            heightAmplitude: Number(config.heightAmplitude),
            noiseOctaves: Number(config.noiseOctaves),
            persistence: Number(config.persistence),
            lacunarity: Number(config.lacunarity),
          };
          this.syncTerrainInputs();
          this.rebuildTerrain();
        }
        this.syncFlowScreens();
        this.log(
          "success",
          `Handshake received for pilot ${this.myPilotId || "unknown"}.`,
        );
        break;
      }
      case "authAccepted":
        this.sessionAccepted = true;
        this.setStatus(
          `Authenticated SpacedOut session for ${this.session.user.username}.`,
        );
        this.log(
          "success",
          "SpacedOut session accepted by the realtime backend.",
        );
        this.syncFlowScreens();
        break;
      case "authRejected":
      case "authRequired":
        this.setStatus("SpacedOut authentication failed.");
        this.log(
          "error",
          "The realtime backend rejected the current session token.",
        );
        break;
      case "terrainHostAssigned":
        this.isTerrainHost =
          String(payload.hostId ?? "") === String(this.myPilotId ?? "");
        this.syncFlowScreens();
        this.log("info", "Terrain host assignment updated.");
        break;
      case "matchSettingsUpdated":
        this.applyMatchSettings(payload.settings);
        this.syncFlowScreens();
        this.log("info", "Match settings updated.");
        break;
      case "terrainLocked": {
        this.applyMatchSettings(payload.matchSettings);
        const config = payload.config as TerrainConfig | undefined;
        if (config) {
          this.terrainConfig = {
            seed: Number(config.seed),
            noiseScale: Number(config.noiseScale),
            heightAmplitude: Number(config.heightAmplitude),
            noiseOctaves: Number(config.noiseOctaves),
            persistence: Number(config.persistence),
            lacunarity: Number(config.lacunarity),
          };
          this.syncTerrainInputs();
        }
        this.waitingForTerrainFinalize = false;
        this.terrainLockedByServer = true;
        this.rebuildTerrain();
        this.syncFlowScreens();
        this.log("success", "Terrain locked by the realtime backend.");
        break;
      }
      case "terrainUnlocked": {
        this.applyMatchSettings(payload.matchSettings);
        const config = payload.config as TerrainConfig | undefined;
        if (config) {
          this.terrainConfig = {
            seed: Number(config.seed),
            noiseScale: Number(config.noiseScale),
            heightAmplitude: Number(config.heightAmplitude),
            noiseOctaves: Number(config.noiseOctaves),
            persistence: Number(config.persistence),
            lacunarity: Number(config.lacunarity),
          };
          this.syncTerrainInputs();
        }
        this.waitingForTerrainFinalize = false;
        this.terrainLockedByServer = false;
        this.isTerrainHost =
          String(payload.hostId ?? "") === String(this.myPilotId ?? "");
        this.syncFlowScreens();
        this.log(
          "info",
          "Terrain unlocked because the server returned to lobby-only state.",
        );
        break;
      }
      case "terrainRejected":
        this.waitingForTerrainFinalize = false;
        this.loadingText.textContent = "TERRAIN SETTINGS REJECTED BY SERVER.";
        this.loadingOverlay.classList.remove("hidden");
        this.log("warning", "Terrain configuration rejected.");
        break;
      case "terrainMapMissing":
        this.waitingForTerrainFinalize = false;
        this.loadingText.textContent =
          "UPLOAD THE TERRAIN MAP BEFORE LOCKING.";
        this.loadingOverlay.classList.remove("hidden");
        this.log(
          "warning",
          "The server did not receive a valid terrain collision map for this lock attempt.",
        );
        break;
      case "terrainPending":
        this.log(
          "warning",
          "Terrain is not locked yet. Pick or wait for a host configuration.",
        );
        break;
      case "worldSnapshot":
        if (Array.isArray(payload.data)) {
          payload.data.forEach((entry) => {
            const pilot = entry as { id: string; pos: Record<string, unknown> };
            this.applyPilotSnapshot(String(pilot.id), pilot.pos);
          });
        }
        break;
      case "pilotIdentity":
        this.setRemotePilotIdentity(String(payload.id ?? ""), payload);
        break;
      case "shipRespawned": {
        const pilotId = String(payload.id ?? "");
        const pos = payload.pos as Record<string, unknown> | undefined;
        if (!pos) {
          break;
        }
        if (pilotId === this.myPilotId) {
          this.localTeam = normalizeTeamName(payload.team);
          this.completeLocalRespawn(pos);
          this.log("success", `Spawned into the ${this.localTeam} faction.`);
        } else {
          this.applyPilotSnapshot(pilotId, {
            ...pos,
            team: payload.team,
            hp: payload.hp,
            username: payload.username,
          });
        }
        break;
      }
      case "hpUpdate": {
        const pilot = this.remotePilots.get(String(payload.id ?? ""));
        if (pilot && Number.isFinite(Number(payload.hp))) {
          pilot.hp = Number(payload.hp);
        }
        break;
      }
      case "respawnReady": {
        const pilotId = String(payload.id ?? "");
        if (pilotId === this.myPilotId) {
          this.respawnAvailable = true;
          this.respawnRequested = false;
        }
        const pilot = this.remotePilots.get(pilotId);
        if (pilot) {
          pilot.mesh.visible = false;
          pilot.label.style.display = "none";
        }
        break;
      }
      case "shotFired":
      case "botFired": {
        if (!this.combatManager) {
          break;
        }
        const shooterId = String(payload.id ?? "");
        if (!shooterId || shooterId === this.myPilotId) {
          break;
        }
        const shooter = this.remotePilots.get(shooterId);
        if (shooter?.mesh.visible) {
          this.combatManager.handleRemoteShot(shooter.mesh);
        } else {
          const pos = payload.pos as Record<string, unknown> | undefined;
          const dir = payload.dir as Record<string, unknown> | undefined;
          if (pos && dir) {
            this.combatManager.handleRemoteShotFromPose(
              new THREE.Vector3(
                Number(pos.x) || 0,
                Number(pos.y) || 0,
                Number(pos.z) || 0,
              ),
              new THREE.Vector3(
                Number(dir.x) || 0,
                Number(dir.y) || 1,
                Number(dir.z) || 0,
              ),
            );
          }
        }
        break;
      }
      case "missileLaunched": {
        if (!this.combatManager) {
          break;
        }
        const ownerId = String(payload.ownerId ?? "");
        if (!ownerId || ownerId === this.myPilotId) {
          break;
        }

        const pos = payload.pos as Record<string, unknown> | undefined;
        const dir = payload.dir as Record<string, unknown> | undefined;
        const owner = this.remotePilots.get(ownerId);
        const spawnPos = pos
          ? new THREE.Vector3(
              Number(pos.x) || 0,
              Number(pos.y) || 0,
              Number(pos.z) || 0,
            )
          : (owner?.mesh.getWorldPosition(new THREE.Vector3()) ?? null);
        const direction = dir
          ? new THREE.Vector3(
              Number(dir.x) || 0,
              Number(dir.y) || 1,
              Number(dir.z) || 0,
            )
          : owner
            ? new THREE.Vector3(0, 0, -1).applyQuaternion(
                owner.mesh.getWorldQuaternion(new THREE.Quaternion()),
              )
            : null;

        if (spawnPos && direction) {
          this.combatManager.handleRemoteMissile(
            spawnPos,
            direction,
            String(payload.targetId ?? ""),
            Number(payload.speed) || 80,
          );
        }
        break;
      }
      case "flaresDeployed": {
        const pilotId = String(payload.id ?? "");
        const until = Number(payload.until) || Date.now() + 3000;
        if (pilotId === this.myPilotId && this.localShip) {
          this.localShip.userData.flareActiveUntil = until;
          break;
        }
        const pilot = this.remotePilots.get(pilotId);
        if (pilot && this.combatManager) {
          this.combatManager.deployFlares(pilot.mesh, false);
          pilot.mesh.userData.flareActiveUntil = until;
        }
        break;
      }
      case "pilotDropped":
        this.removeRemotePilot(String(payload.id ?? ""));
        break;
      case "returnedToLobby": {
        this.handleReturnToLobby(String(payload.id ?? ""));
        break;
      }
      case "shipDestroyed": {
        const deadId = String(payload.id ?? "");
        const isMe = deadId === this.myPilotId;
        const deadShip = isMe
          ? this.localShip
          : this.remotePilots.get(deadId)?.mesh;
        if (!deadShip || !this.combatManager) {
          break;
        }

        deadShip.getWorldPosition(this.tempA);
        this.combatManager.spawnExplosion(this.tempA.clone());
        const fuselageDebris = this.combatManager.spawnDebris(
          deadShip,
          isMe,
          deadId,
        );
        deadShip.visible = false;

        if (isMe) {
          this.isDead = true;
          this.respawnAvailable = false;
          this.respawnRequested = false;
          this.startDeathCam(fuselageDebris);
          this.log("warning", "Your ship was destroyed.");
        } else {
          const pilot = this.remotePilots.get(deadId);
          if (pilot) {
            pilot.label.style.display = "none";
          }
        }
        break;
      }
      case "clientPong":
        break;
      default:
        this.log("info", `Received "${type}" from the realtime backend.`);
    }
  }

  private applyPilotSnapshot(
    id: string,
    snapshot: Record<string, unknown>,
  ): void {
    if (!id || id === this.myPilotId) {
      return;
    }

    const position = new THREE.Vector3(
      Number(snapshot.x) || 0,
      Number(snapshot.y) || 0,
      Number(snapshot.z) || 0,
    );
    const direction = new THREE.Vector3(
      Number(snapshot.dx) || 0,
      Number(snapshot.dy) || 1,
      Number(snapshot.dz) || 0,
    );
    const team = normalizeTeamName(snapshot.team);
    const username =
      typeof snapshot.username === "string"
        ? snapshot.username
        : `PILOT-${id.slice(0, 4)}`;
    const pilot = this.ensureRemotePilot(id, username, team);
    const isFirstSnapshot = pilot.lastSnapshotAt === null;
    const now = performance.now();
    const elapsedSeconds =
      isFirstSnapshot || pilot.lastSnapshotAt === null
        ? null
        : Math.max(
            (now - pilot.lastSnapshotAt) / 1000,
            TELEMETRY_INTERVAL_MS / 1000,
          );

    if (elapsedSeconds !== null) {
      const measuredVelocity = position
        .clone()
        .sub(pilot.targetPosition)
        .divideScalar(elapsedSeconds);
      if (measuredVelocity.lengthSq() > 1e-6) {
        pilot.velocity.lerp(measuredVelocity, 0.6);
      }
    } else {
      pilot.velocity
        .copy(
          direction.lengthSq() > 1e-8
            ? direction.clone().normalize()
            : new THREE.Vector3(0, 1, 0),
        )
        .multiplyScalar(DEFAULT_FLIGHT_SPEED * 18);
    }
    pilot.lastSnapshotAt = now;

    pilot.targetPosition.copy(position);
    pilot.targetQuaternion.copy(quaternionFromPose(position, direction));
    if (isFirstSnapshot) {
      // Snap the first authoritative pose into place so remote ships do not
      // lerp outward from the planet center on their spawn frame.
      pilot.mesh.position.copy(position);
      pilot.mesh.quaternion.copy(pilot.targetQuaternion);
    }
    pilot.hp = Number(snapshot.hp) || 100;
    pilot.team = team;
    pilot.username = username;
    pilot.mesh.visible = !snapshot.dead;
    pilot.label.textContent = username;
    this.applyTeamColor(pilot.mesh, team);
    this.updateSpectatorBroadcastMode();
  }

  private setRemotePilotIdentity(
    id: string,
    payload: SpacedOutSocketPayload,
  ): void {
    const pilot = this.remotePilots.get(id);
    if (!pilot) {
      return;
    }
    pilot.username =
      typeof payload.username === "string" ? payload.username : pilot.username;
    pilot.label.textContent = pilot.username;
  }

  private ensureRemotePilot(
    id: string,
    username: string,
    team: TeamName,
  ): RemotePilotState {
    const existing = this.remotePilots.get(id);
    if (existing) {
      return existing;
    }
    if (!this.earthAnchor) {
      throw new Error("Earth anchor is not ready for remote pilot creation.");
    }

    const mesh = this.createPilotShip(team);
    mesh.scale.set(3, 3, 3);
    mesh.visible = false;
    this.earthAnchor.add(mesh);

    const label = document.createElement("div");
    label.className = "spacedout-contact-label";
    label.textContent = username;
    label.style.display = "none";
    this.labelsMount.appendChild(label);

    const state: RemotePilotState = {
      id,
      mesh,
      label,
      targetPosition: new THREE.Vector3(),
      targetQuaternion: new THREE.Quaternion(),
      velocity: new THREE.Vector3(0, DEFAULT_FLIGHT_SPEED * 18, 0),
      lastSnapshotAt: null,
      hp: 100,
      team,
      username,
    };
    this.remotePilots.set(id, state);
    return state;
  }

  private removeRemotePilot(id: string): void {
    const pilot = this.remotePilots.get(id);
    if (!pilot || !this.earthAnchor) {
      return;
    }
    pilot.label.remove();
    this.earthAnchor.remove(pilot.mesh);
    this.remotePilots.delete(id);
    if (this.spectatorTargetId === id) {
      this.spectatorTargetId = null;
    }
    this.updateSpectatorBroadcastMode();
  }

  private handleBinaryRadar(buffer: ArrayBuffer): void {
    if (buffer.byteLength < 28) {
      return;
    }

    const dataView = new DataView(buffer);
    const pilotId = String(dataView.getUint32(0, true));
    if (pilotId === this.myPilotId) {
      return;
    }

    const floats = new Float32Array(buffer, 4);
    this.applyPilotSnapshot(pilotId, {
      x: floats[0],
      y: floats[1],
      z: floats[2],
      dx: floats[3],
      dy: floats[4],
      dz: floats[5],
    });
  }

  private getManualYawInput(): number {
    return (
      (this.pressedKeys.has("d") || this.pressedKeys.has("arrowright")
        ? 1
        : 0) -
      (this.pressedKeys.has("a") || this.pressedKeys.has("arrowleft") ? 1 : 0)
    );
  }

  private getManualPitchInput(): number {
    return (
      (this.pressedKeys.has("w") || this.pressedKeys.has("arrowup") ? 1 : 0) -
      (this.pressedKeys.has("s") || this.pressedKeys.has("arrowdown") ? 1 : 0)
    );
  }

  private canControlShip(): boolean {
    return (
      this.terrainLockedByServer &&
      this.isCalibrated &&
      !this.isDead &&
      this.localTeam !== "SPECTATOR"
    );
  }

  private canFireWeapons(): boolean {
    return this.canControlShip() && !!this.combatManager && !!this.localShip;
  }

  private shouldCaptureGameplayKey(
    event: KeyboardEvent,
    key: string,
  ): boolean {
    if (!this.sessionAccepted || this.isDestroyed || !GAMEPLAY_KEYS.has(key)) {
      return false;
    }

    const target = event.target as HTMLElement | null;
    if (!target) {
      return true;
    }

    return !(
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      target.isContentEditable
    );
  }

  private hasSpectatablePilots(): boolean {
    return [...this.remotePilots.values()].some((pilot) => pilot.mesh.visible);
  }

  private updateActionButtons(): void {
    const showButtons =
      !this.isDead && (this.localTeam === "SPECTATOR" || this.isPaused);
    const canJoin = this.terrainLockedByServer;
    const canSpectate = this.hasSpectatablePilots();
    const isSpectating =
      this.localTeam === "SPECTATOR" && this.cameraMode === "SPECTATOR";
    const isPauseMenu = this.isPaused;

    this.actionButtons.classList.toggle("hidden", !showButtons);
    this.joinButton.disabled = isPauseMenu
      ? false
      : !canJoin || this.joinSequencePending;
    this.spectateButton.disabled = isPauseMenu
      ? !canSpectate
      : !canSpectate || this.joinSequencePending;
    this.joinButton.classList.toggle(
      "is-active",
      isPauseMenu || this.wantsToPlay,
    );
    this.spectateButton.classList.toggle("is-active", isSpectating);
    this.joinButton.textContent = isPauseMenu
      ? "Return to Lobby"
      : this.joinSequencePending
        ? "Warping"
        : canJoin
          ? "Join"
          : "Join Locked";
    this.spectateButton.textContent = canSpectate ? "Spectate" : "No Pilots";
  }

  private async requestJoinFlow(): Promise<void> {
    if (!this.terrainLockedByServer) {
      this.log("warning", "Terrain must be locked before joining the match.");
      return;
    }

    if (this.joinSequencePending) {
      return;
    }

    this.joinSequencePending = true;
    this.updateActionButtons();

    try {
      await this.onJoinSequenceRequest?.();
    } catch (error) {
      this.log(
        "error",
        error instanceof Error
          ? error.message
          : "Unable to complete the jump transition.",
      );
      return;
    } finally {
      this.joinSequencePending = false;
      this.updateActionButtons();
    }

    this.wantsToPlay = true;
    this.syncFlowScreens();
  }

  private requestSpectateFlow(): void {
    this.wantsToPlay = false;
    this.calibrationScreen.classList.add("hidden");
    this.teamScreen.classList.add("hidden");
    if (this.hasSpectatablePilots()) {
      this.enterSpectatorMode(true);
    } else {
      this.cameraMode = "TERRAIN";
      this.spectatorTargetId = null;
    }
    this.syncFlowScreens();
  }

  private updateSpectatorBroadcastMode(): void {
    this.updateActionButtons();
    if (!this.hasSpectatablePilots() && this.cameraMode === "SPECTATOR") {
      this.cameraMode = "TERRAIN";
      this.spectatorTargetId = null;
      return;
    }

    if (
      this.localTeam === "SPECTATOR" &&
      this.cameraMode === "SPECTATOR" &&
      !this.spectatorTargetId &&
      this.hasSpectatablePilots()
    ) {
      this.cycleSpectatorTarget(1);
    }
  }

  private getSpectatorTargetIds(): string[] {
    return [...this.remotePilots.entries()]
      .filter(([, pilot]) => pilot.mesh.visible)
      .map(([id]) => id)
      .sort((left, right) => Number(left) - Number(right));
  }

  private cycleSpectatorTarget(step: number): void {
    const ids = this.getSpectatorTargetIds();
    if (ids.length === 0) {
      this.spectatorTargetId = null;
      return;
    }

    if (!this.spectatorTargetId || !ids.includes(this.spectatorTargetId)) {
      this.spectatorTargetId = ids[0];
      return;
    }

    const currentIndex = ids.indexOf(this.spectatorTargetId);
    const nextIndex = (currentIndex + step + ids.length) % ids.length;
    this.spectatorTargetId = ids[nextIndex];
  }

  private enterSpectatorMode(pickNewTarget = false): void {
    this.cameraMode = "SPECTATOR";
    this.deathCamFuselage = null;
    if (pickNewTarget || !this.spectatorTargetId) {
      this.cycleSpectatorTarget(1);
    }
  }

  private startDeathCam(fuselageDebris: THREE.Object3D | null): void {
    if (!fuselageDebris) {
      this.enterSpectatorMode(true);
      return;
    }
    this.deathCamFuselage = fuselageDebris;
    this.cameraMode = "DEATH";
  }

  private activateLocalRespawn(): void {
    if (!this.isDead || !this.respawnAvailable || this.respawnRequested) {
      return;
    }
    this.respawnAvailable = false;
    this.respawnRequested = true;
    this.socketClient.sendJson({ type: "requestRespawn" });
  }

  private activateLocalSpectate(pickNewTarget = true): void {
    if (!this.isDead && !this.isPaused) {
      return;
    }
    if (!this.hasSpectatablePilots()) {
      return;
    }
    this.enterSpectatorMode(pickNewTarget);
  }

  private activateReturnToLobby(): void {
    if (!this.isDead && !this.isPaused) {
      return;
    }

    this.socketClient.sendJson({ type: "returnToLobby" });
    this.handleReturnToLobby(String(this.myPilotId ?? ""));
  }

  private handleReturnToLobby(pilotId: string): void {
    if (!pilotId) {
      return;
    }

    if (pilotId === this.myPilotId) {
      this.localTeam = "SPECTATOR";
      this.wantsToPlay = false;
      this.joinSequencePending = false;
      this.isDead = false;
      this.respawnAvailable = false;
      this.respawnRequested = false;
      this.deathCamFuselage = null;
      this.spectatorTargetId = null;
      this.combatState = { ...DEFAULT_COMBAT_STATE };
      this.combatManager?.clearOwnDebris();
      if (this.localShip) {
        this.localShip.visible = false;
        this.localShip.rotation.set(0, 0, 0);
      }
      this.controlsHint.classList.add("hidden");
      this.speedReadout.classList.add("hidden");
      this.modeReadout.classList.add("hidden");
      this.targetReadout.classList.add("hidden");
      this.audio.updateEngineSound(this.speed, true);
      this.cameraMode = "TERRAIN";
      this.syncFlowScreens();
      this.onLobbyRestoreRequest?.();
      return;
    }

    const pilot = this.remotePilots.get(pilotId);
    if (!pilot) {
      return;
    }

    pilot.team = "SPECTATOR";
    pilot.mesh.visible = false;
    pilot.label.style.display = "none";
    if (this.spectatorTargetId === pilotId) {
      this.spectatorTargetId = null;
    }
    this.updateSpectatorBroadcastMode();
  }

  private completeLocalRespawn(pos: Record<string, unknown>): void {
    this.respawnAvailable = false;
    this.respawnRequested = false;
    this.isDead = false;
    this.deathCamFuselage = null;
    this.spectatorTargetId = null;
    this.combatState = { ...DEFAULT_COMBAT_STATE };
    this.combatManager?.clearOwnDebris();
    this.applyLocalServerPose(pos);
    if (this.localShip) {
      this.localShip.visible = true;
      this.localShip.rotation.set(0, 0, 0);
    }
    this.controlsHint.classList.remove("hidden");
    this.speedReadout.classList.remove("hidden");
    this.modeReadout.classList.remove("hidden");
    this.targetReadout.classList.remove("hidden");
    this.cameraMode = "PLAYER";
    this.syncFlowScreens();
  }

  private uploadTerrainCollisionMap(): boolean {
    if (!this.worldGrid || this.worldGrid.length === 0) {
      return false;
    }

    const mapRows = this.worldGrid.length;
    const mapCols = this.worldGrid[0].length;
    if (mapCols === 0) {
      return false;
    }

    for (const row of this.worldGrid) {
      if (row.length !== mapCols) {
        return false;
      }
    }

    // Create a binary buffer to hold the dimensions (8 bytes) + all the floats
    const buffer = new ArrayBuffer(8 + mapRows * mapCols * 4);
    const header = new Uint32Array(buffer, 0, 2);
    const flatGrid = new Float32Array(buffer, 8);

    // Set the width and height header
    header[0] = mapRows;
    header[1] = mapCols;

    // Flatten the 2D array into the binary payload
    let i = 0;
    for (let r = 0; r < mapRows; r++) {
      for (let c = 0; c < mapCols; c++) {
        flatGrid[i++] = this.worldGrid[r][c];
      }
    }

    // Blast it to the server!
    this.socketClient.sendBinary(buffer);
    this.log("info", "Authoritative collision map sent to the server.");
    return true;
  }

  private updateModeReadout(): void {
    if (this.isPaused) {
      this.modeReadout.textContent = "MODE: PAUSED";
      return;
    }

    if (!this.isDead) {
      this.modeReadout.textContent = `MODE: ${this.controlMode}`;
      return;
    }

    const targetTag = this.spectatorTargetId
      ? `TGT ${this.spectatorTargetId}`
      : "NO TARGET";
    if (this.respawnAvailable) {
      this.modeReadout.textContent = `MODE: SPECTATE [${targetTag}] | R RESPAWN | B LOBBY`;
    } else if (this.cameraMode === "DEATH") {
      this.modeReadout.textContent =
        "MODE: DEATH CAM | B LOBBY | V OR [ ] SPECTATE";
    } else {
      this.modeReadout.textContent = `MODE: SPECTATE [${targetTag}] | B LOBBY | RESPAWN PENDING`;
    }
  }

  private updateDeathCamera(frameScale: number): void {
    if (!this.camera || !this.scene) {
      return;
    }
    if (!this.deathCamFuselage || !this.deathCamFuselage.parent) {
      this.enterSpectatorMode(true);
      return;
    }

    if (this.camera.parent !== this.scene) {
      this.scene.attach(this.camera);
    }

    const velocity = this.deathCamFuselage.userData.velocity as
      | THREE.Vector3
      | undefined;
    const speed = velocity?.length() ?? 0;
    this.spectateUp.copy(this.deathCamFuselage.position).normalize();

    if (velocity && speed > 0.001) {
      this.spectateForward.copy(velocity).normalize();
    } else {
      this.spectateForward
        .set(0, 0, -1)
        .applyQuaternion(this.deathCamFuselage.quaternion);
    }

    const followDistance = 220 + Math.min(speed * 2, 240);
    const verticalOffset = 60 + Math.min(speed * 0.4, 70);
    this.spectateCamPos
      .copy(this.deathCamFuselage.position)
      .addScaledVector(this.spectateUp, verticalOffset)
      .addScaledVector(this.spectateForward, -followDistance);

    this.camera.position.lerp(
      this.spectateCamPos,
      Math.min(1, 0.08 * frameScale),
    );
    this.camera.lookAt(this.deathCamFuselage.position);
  }

  private updateSpectatorCamera(frameScale: number): void {
    if (!this.camera || !this.scene) {
      return;
    }
    if (this.camera.parent !== this.scene) {
      this.scene.attach(this.camera);
    }

    const currentTarget = this.spectatorTargetId
      ? this.remotePilots.get(this.spectatorTargetId)
      : null;
    if (!currentTarget || !currentTarget.mesh.visible) {
      this.cycleSpectatorTarget(1);
    }

    const nextTarget = this.spectatorTargetId
      ? this.remotePilots.get(this.spectatorTargetId)
      : null;
    if (!nextTarget || !nextTarget.mesh.visible) {
      this.spectateCamPos.set(0, WORLD_RADIUS + 1800, WORLD_RADIUS + 1200);
      this.camera.position.lerp(
        this.spectateCamPos,
        Math.min(1, 0.06 * frameScale),
      );
      this.camera.lookAt(0, 0, 0);
      return;
    }

    nextTarget.mesh.getWorldPosition(this.spectateTargetPos);
    nextTarget.mesh.getWorldQuaternion(this.spectateQuat);
    this.spectateForward
      .set(0, 0, 1)
      .applyQuaternion(this.spectateQuat)
      .normalize();
    this.spectateUp.copy(this.spectateTargetPos).normalize();

    this.spectateCamPos
      .copy(this.spectateTargetPos)
      .addScaledVector(this.spectateUp, 35)
      .addScaledVector(this.spectateForward, 130);

    this.camera.position.lerp(
      this.spectateCamPos,
      Math.min(1, 0.08 * frameScale),
    );
    this.camera.lookAt(this.spectateTargetPos);
  }

  private togglePause(): void {
    if (!this.sessionAccepted || this.isDestroyed) {
      return;
    }

    this.isPaused = !this.isPaused;
    if (this.isPaused) {
      this.audio.pause();
      this.loadingText.textContent = "SIMULATION PAUSED";
      this.loadingOverlay.classList.remove("hidden");
      this.updateCalibrationControls();
      this.updateActionButtons();
      this.updateModeReadout();
      return;
    }

    this.audio.resume();
    this.updateCalibrationControls();
    this.syncFlowScreens();
  }

  private animate = (timestamp: number): void => {
    if (this.isDestroyed || !this.scene || !this.camera || !this.renderer) {
      return;
    }

    this.updateCalibrationControls();

    if (!this.lastFrameTime) {
      this.lastFrameTime = timestamp;
      this.lastFpsSample = timestamp;
    }

    const delta = Math.min((timestamp - this.lastFrameTime) / 1000, 0.05);
    this.lastFrameTime = timestamp;

    if (this.isPaused) {
      this.updateModeReadout();
      this.renderer.render(this.scene, this.camera);
      this.animationFrameId = window.requestAnimationFrame(this.animate);
      return;
    }

    this.updateFlight(delta, timestamp);
    this.updateRemotePilots();
    this.updateCamera(delta);
    this.renderHud();
    this.renderer.render(this.scene, this.camera);
    this.updateLabels();
    this.updateFps(timestamp);
    this.updateTelemetryPanel();

    this.animationFrameId = window.requestAnimationFrame(this.animate);
  };

  private updateFlight(delta: number, timestamp: number): void {
    if (
      !this.localShip ||
      !this.playerRig ||
      !this.camera ||
      !this.combatManager
    ) {
      return;
    }

    const manualYaw = this.getManualYawInput();
    const manualPitch = this.getManualPitchInput();

    this.localYawInput =
      this.controlMode === "FACE" ? this.vision.yawInput : manualYaw;
    this.localPitchInput =
      this.controlMode === "FACE" ? this.vision.pitchInput : manualPitch;

    if (this.canControlShip()) {
      if (this.pressedKeys.has("control")) {
        this.speed = Math.max(
          MIN_FLIGHT_SPEED,
          this.speed - AIRBRAKE_DECELERATION * delta,
        );
      }
    }

    if (this.canFireWeapons()) {
      const shouldAutoFire =
        this.isLaserTriggerHeld && timestamp >= this.nextLaserShotAt;
      if (this.laserShotQueued || shouldAutoFire) {
        this.laserShotQueued = false;
        this.combatManager.fireLasers(this.playerRig, this.localShip);
        this.nextLaserShotAt = timestamp + LASER_REPEAT_INTERVAL_MS;
      }
      if (this.pressedKeys.has(MISSILE_FIRE_KEY)) {
        this.pressedKeys.delete(MISSILE_FIRE_KEY);
        this.combatManager.fireMissile(this.localShip, this.speed);
      }
      if (this.pressedKeys.has("f")) {
        this.pressedKeys.delete("f");
        this.combatManager.deployFlares(this.localShip, true);
      }
    } else {
      this.laserShotQueued = false;
      this.nextLaserShotAt = 0;
    }

    this.combatState = this.combatManager.update(
      delta,
      this.frames,
      this.playerRig,
      this.camera,
      this.remotePilots,
      this.myPilotId,
      this.localShip,
      this.localTeam,
      this.worldGrid,
      this.hudCanvas.width,
      this.hudCanvas.height,
    );

    if (this.canControlShip()) {
      this.localYawInput -= this.combatState.magnetismYaw;
      this.localPitchInput += this.combatState.magnetismPitch;
    }

    /*     if (this.canControlShip()) {
      const upAxis = this.localServerPosition.clone().normalize();
      const rightAxis = new THREE.Vector3()
        .crossVectors(this.localForward, upAxis)
        .normalize();

      if (this.localYawInput) {
        this.localForward
          .applyQuaternion(
            new THREE.Quaternion().setFromAxisAngle(
              upAxis,
              -this.localYawInput * delta * 0.95,
            ),
          )
          .normalize();
      }

      if (this.localPitchInput && rightAxis.lengthSq() > 1e-8) {
        this.localForward
          .applyQuaternion(
            new THREE.Quaternion().setFromAxisAngle(
              rightAxis,
              -this.localPitchInput * delta * 0.85,
            ),
          )
          .normalize();
      }

      this.localServerPosition.addScaledVector(
        this.localForward,
        this.speed * delta * 18,
      );
      if (
        this.getEarthAnchorDistanceFromLocalPosition(this.localServerPosition) <
        WORLD_RADIUS + 4000
      ) {
        this.localServerPosition
          .copy(this.getEarthAnchorUpFromLocalPosition(this.localServerPosition))
          .multiplyScalar(WORLD_RADIUS + 4000);
      }

      this.localQuaternion.copy(
        quaternionFromPose(this.localServerPosition, this.localForward),
      );
      this.applyLocalShipState();
      this.updateLocalShipVisuals();
      this.speedReadout.textContent = `SPD: ${Math.round(this.speed)}`;

      const propeller = this.localShip.userData.propeller as
        | THREE.Object3D
        | undefined;
      if (propeller) {
        propeller.rotation.z += delta * 40;
      }
    } else {
      this.speedReadout.textContent = `SPD: ${Math.round(this.speed)}`;
    } */

    if (this.canControlShip()) {
      // 1. Store the Earth's gravity vector (Up) before we move
      const oldUp = this.localServerPosition.clone().normalize();

      // 2. UNRESTRICTED 6DOF FLIGHT MATH (Face tracking & Keyboard)
      const pitchQuat = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(1, 0, 0),
        this.localPitchInput * delta * 0.85,
      );
      const yawQuat = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 1, 0),
        -this.localYawInput * delta * 0.95,
      );

      this.localQuaternion.multiply(yawQuat);
      this.localQuaternion.multiply(pitchQuat);
      this.localQuaternion.normalize();

      this.localForward
        .set(0, 0, -1)
        .applyQuaternion(this.localQuaternion)
        .normalize();

      // 3. Move the ship forward through space
      this.localServerPosition.addScaledVector(
        this.localForward,
        this.speed * delta * 18,
      );

      // --- THE FIX: PLANETARY GRAVITY (SPHERICAL CURVATURE) ---
      // 4. Calculate the new gravity vector after moving along the curved earth
      const newUp = this.localServerPosition.clone().normalize();

      // Find the exact mathematical rotation difference between the old spot and the new spot
      const curvatureRotation = new THREE.Quaternion().setFromUnitVectors(
        oldUp,
        newUp,
      );

      // PREMULTIPLY: Apply the planet's curvature to the ship's world orientation.
      // This constantly dips the nose down perfectly to match the curve of the Earth!
      this.localQuaternion.premultiply(curvatureRotation);
      this.localQuaternion.normalize();

      // Re-extract the forward vector now that gravity has aligned us
      this.localForward
        .set(0, 0, -1)
        .applyQuaternion(this.localQuaternion)
        .normalize();

      // 2. TERRAIN CRASH DETECTION
      if (this.worldGrid && !this.isDead) {
        const altitude =
          this.getEarthAnchorDistanceFromLocalPosition(
            this.localServerPosition,
          ) - WORLD_RADIUS;
        const actualSurfaceHeight =
          this.getTerrainHeightAtPosition(this.localServerPosition) - 5;

        // Boom.
        if (altitude < actualSurfaceHeight) {
          this.socketClient.sendJson({ type: "suicide" });
          this.isDead = true;
        }
      }

      // Apply the final state to the visual Three.js rig
      this.applyLocalShipState();
      this.updateLocalShipVisuals();
      this.speedReadout.textContent = `SPD: ${Math.round(this.speed)}`;

      const propeller = this.localShip.userData.propeller as
        | THREE.Object3D
        | undefined;
      if (propeller) {
        propeller.rotation.z += delta * 40;
      }
    } else {
      this.speedReadout.textContent = `SPD: ${Math.round(this.speed)}`;
    }

    if (this.isDead && this.cameraMode === "DEATH") {
      const velocity = this.deathCamFuselage?.userData.velocity as
        | THREE.Vector3
        | undefined;
      if (velocity && velocity.length() <= 0.001) {
        this.enterSpectatorMode(true);
      }
    }

    if (
      timestamp - this.lastTelemetryAt >= TELEMETRY_INTERVAL_MS &&
      this.localTeam !== "SPECTATOR" &&
      !this.isDead
    ) {
      this.lastTelemetryAt = timestamp;
      this.telemetryView[0] = this.localServerPosition.x;
      this.telemetryView[1] = this.localServerPosition.y;
      this.telemetryView[2] = this.localServerPosition.z;
      this.telemetryView[3] = this.localForward.x;
      this.telemetryView[4] = this.localForward.y;
      this.telemetryView[5] = this.localForward.z;
      this.socketClient.sendBinary(this.telemetryBuffer);
    }
    const suppressFlightAudio =
      this.isDead ||
      this.isPaused ||
      this.localTeam === "SPECTATOR" ||
      !this.terrainLockedByServer;
    this.audio.updateEngineSound(this.speed, suppressFlightAudio);
    this.audio.manageLockOnSound(
      !suppressFlightAudio && this.combatState.isLockedOn,
      this.combatState.lockProgress,
    );
    this.updateModeReadout();
  }

  private updateRemotePilots(): void {
    this.remotePilots.forEach((pilot) => {
      pilot.mesh.position.lerp(pilot.targetPosition, 0.15);
      pilot.mesh.quaternion.slerp(pilot.targetQuaternion, 0.15);
      const propeller = pilot.mesh.userData.propeller as
        | THREE.Object3D
        | undefined;
      if (propeller) {
        propeller.rotation.z += 0.45;
      }
    });
  }

  private updateCamera(delta: number): void {
    if (!this.camera || !this.playerRig || !this.localShip) {
      return;
    }

    if (this.cameraMode === "TERRAIN") {
      this.setTerrainSelectionCamera();
      return;
    }

    if (this.cameraMode === "DEATH") {
      this.updateDeathCamera(delta * 60);
      return;
    }

    if (this.cameraMode === "SPECTATOR") {
      this.updateSpectatorCamera(delta * 60);
      return;
    }

    this.setPlayerCamera();
    if (this.controlMode === "FACE") {
      this.camera.position.x +=
        (this.vision.targetCamPosX - this.camera.position.x) * 0.1;
      this.camera.position.y +=
        (this.vision.targetCamPosY - this.camera.position.y) * 0.1;
      this.camera.rotation.x += (0 - this.camera.rotation.x) * 0.15;
      this.camera.rotation.y += (0 - this.camera.rotation.y) * 0.15;

      // Changed * 10 down to * 0.3 so the camera rolls smoothly into the turn
      this.camera.rotation.z +=
        (-this.localYawInput * 0.3 - this.camera.rotation.z) * 0.1;
      return;
    }

    // (Keyboard Mode with Face-Tracking Freelook)
    this.camera.position.x += (0 - this.camera.position.x) * 0.1;
    this.camera.position.y += (0 - this.camera.position.y) * 0.1;

    const smoothFactor = 0.05;

    // Add a MINUS SIGN (-) to invert the horizontal look direction ---
    // We also drop the 1.5 multiplier down to 1.0, as the raw input is plenty strong
    let targetYaw = -this.vision.yawInput * 1.0;
    let targetPitch = this.vision.pitchInput * 1.0;

    // BIOLOGICAL NECK LIMITS FOR DOUBLE CHINNERS AND DOUBLE NECKERS KEKW 
    // Limit the horizontal turn to ~100 degrees (1.8 radians) so you can look
    // over your shoulder, but not directly behind you.
    targetYaw = THREE.MathUtils.clamp(targetYaw, -1.8, 1.8);

    // Limit the vertical pitch to ~85 degrees (1.5 radians) so you can't
    // clip the camera down inside your own torso.
    targetPitch = THREE.MathUtils.clamp(targetPitch, -1.5, 1.5);

    // Apply the smoothed and clamped targets
    this.camera.rotation.y +=
      (targetYaw - this.camera.rotation.y) * smoothFactor;
    this.camera.rotation.x +=
      (targetPitch - this.camera.rotation.x) * smoothFactor;
    this.camera.rotation.z += (0 - this.camera.rotation.z) * smoothFactor;
  }

  private renderHud(): void {
    const context = this.hudCanvas.getContext("2d");
    if (!context || !this.camera || !this.playerRig || !this.localShip) {
      return;
    }

    context.clearRect(0, 0, this.hudCanvas.width, this.hudCanvas.height);
    if (
      !this.terrainLockedByServer ||
      !this.isCalibrated ||
      this.localTeam === "SPECTATOR" ||
      this.isDead
    ) {
      return;
    }

    this.tempEuler.setFromQuaternion(this.localQuaternion);

    let targetLabel = "TARGET HP: --";
    const trackedPilot = this.combatState.lockedEnemyId
      ? this.remotePilots.get(this.combatState.lockedEnemyId)
      : null;
    if (trackedPilot) {
      targetLabel = `TARGET HP: ${trackedPilot.hp}`;
    }

    this.targetReadout.textContent = targetLabel;

    this.renderLegacyHud(
      context,
      this.speed / 100,
      this.getRadarAltitude(this.localServerPosition),
      Math.max(
        0,
        this.getEarthAnchorDistanceFromLocalPosition(this.localServerPosition) -
          WORLD_RADIUS,
      ),
      this.tempEuler.x,
      this.localShip.rotation.z,
      this.combatState.aimX,
      this.combatState.aimY,
      this.combatState.aimZ,
      this.combatState.isLockedOn,
      this.combatState.lockProgress,
      this.combatState.isBeingTracked,
      this.combatState.flareCooldown,
      this.combatState.targetScreenX,
      this.combatState.targetScreenY,
    );
  }

  private updateLabels(): void {
    if (!this.camera) {
      return;
    }

    this.remotePilots.forEach((pilot) => {
      if (!pilot.mesh.visible) {
        pilot.label.style.display = "none";
        return;
      }

      pilot.mesh.getWorldPosition(this.tempA);
      this.tempA.y += 15;
      this.tempA.project(this.camera as THREE.Camera);

      if (this.tempA.z >= 1) {
        pilot.label.style.display = "none";
        return;
      }

      pilot.label.style.display = "block";
      pilot.label.style.left = `${(this.tempA.x * 0.5 + 0.5) * this.mount.clientWidth}px`;
      pilot.label.style.top = `${(-this.tempA.y * 0.5 + 0.5) * this.mount.clientHeight}px`;
      pilot.label.dataset.team = pilot.team;
    });
  }

  private updateFps(timestamp: number): void {
    this.frames += 1;
    if (timestamp - this.lastFpsSample >= 1000) {
      this.fps = Math.round(
        (this.frames * 1000) / (timestamp - this.lastFpsSample),
      );
      this.frames = 0;
      this.lastFpsSample = timestamp;
    }
  }

  private updateTelemetryPanel(): void {
    const altitude = Math.max(
      0,
      this.getEarthAnchorDistanceFromLocalPosition(this.localServerPosition) -
        WORLD_RADIUS,
    );
    const radarAltitude = this.getRadarAltitude(this.localServerPosition);
    this.telemetryMount.innerHTML = `
      <div><span class="spacedout-label">FPS</span><strong>${this.fps || "--"}</strong></div>
      <div><span class="spacedout-label">Pilot</span><strong>${this.session.user.username}</strong></div>
      <div><span class="spacedout-label">Team</span><strong>${this.localTeam}</strong></div>
      <div><span class="spacedout-label">Radar Alt</span><strong>${Math.round(radarAltitude)}</strong></div>
      <div><span class="spacedout-label">MSL Alt</span><strong>${Math.round(altitude)}</strong></div>
      <div><span class="spacedout-label">Host</span><strong>${this.isTerrainHost ? "Yes" : "No"}</strong></div>
      <div><span class="spacedout-label">Contacts</span><strong>${this.remotePilots.size}</strong></div>
    `;
    this.updatePlayerListPanel();
  }

  private updatePlayerListPanel(): void {
    const localState =
      this.localTeam === "SPECTATOR"
        ? "Lobby"
        : this.isDead
          ? "Destroyed"
          : "Active";

    const roster = [
      {
        id: this.myPilotId ?? "local",
        username: this.session.user.username,
        team: this.localTeam,
        state: localState,
        isLocal: true,
      },
      ...[...this.remotePilots.values()]
        .map((pilot) => ({
          id: pilot.id,
          username: pilot.username,
          team: pilot.team,
          state:
            pilot.team === "SPECTATOR"
              ? "Lobby"
              : pilot.mesh.visible
                ? "Active"
                : "Destroyed",
          isLocal: false,
        }))
        .sort((left, right) => left.username.localeCompare(right.username)),
    ];

    const renderGroup = (team: TeamName, title: string): string => {
      const pilots = roster.filter((pilot) => pilot.team === team);
      const cards =
        pilots.length > 0
          ? pilots
              .map(
                (pilot) => `
                  <article class="spacedout-player-card" data-team="${pilot.team}">
                    <div>
                      <div class="spacedout-player-name">${this.escapeHtml(pilot.username)}${pilot.isLocal ? ' <span class="spacedout-player-you">YOU</span>' : ""}</div>
                      <div class="spacedout-player-meta">${pilot.team} • ${pilot.state}</div>
                    </div>
                    <div class="spacedout-player-id">#${this.escapeHtml(String(pilot.id))}</div>
                  </article>
                `,
              )
              .join("")
          : `<div class="spacedout-roster-empty">No Pilots</div>`;

      return `
        <section class="spacedout-roster-column" data-team="${team}">
          <header class="spacedout-roster-header">
            <h3 class="spacedout-roster-title">${title}</h3>
            <span class="spacedout-roster-count">${pilots.length} online</span>
          </header>
          <div class="spacedout-roster-cards">${cards}</div>
        </section>
      `;
    };

    this.playerListMount.innerHTML = `
      <div class="spacedout-roster-grid">
        ${renderGroup("RED", "Red Team")}
        ${renderGroup("SPECTATOR", "Spectators")}
        ${renderGroup("BLUE", "Blue Team")}
      </div>
    `;
    this.playerListMount.innerHTML = this.playerListMount.innerHTML.replaceAll(
      "â€¢",
      " - ",
    );
    this.playerListMount.innerHTML = this.playerListMount.innerHTML.replaceAll(
      "â€¢",
      " - ",
    );
    this.playerListMount.innerHTML = this.playerListMount.innerHTML.replaceAll(
      "•",
      " - ",
    );
    return;
    /*

    this.playerListMount.innerHTML = roster
      .map(
        (pilot) => `
          <article class="spacedout-player-card" data-team="${pilot.team}">
            <div>
              <div class="spacedout-player-name">${pilot.username}${pilot.isLocal ? ' <span class="spacedout-player-you">YOU</span>' : ""}</div>
              <div class="spacedout-player-meta">${pilot.team} • ${pilot.state}</div>
            </div>
            <div class="spacedout-player-id">#${pilot.id}</div>
          </article>
        `,
      )
      .join("");
    */
  }

  private syncFlowScreens(): void {
    const waitingForJoinFlow =
      this.terrainLockedByServer &&
      this.localTeam === "SPECTATOR" &&
      !this.wantsToPlay;
    this.terrainMode.textContent = this.terrainLockedByServer
      ? "Terrain Locked"
      : this.isTerrainHost
        ? "Host Editing"
        : "Waiting for Host";

    const canEditMatchSettings =
      this.sessionAccepted && !this.terrainLockedByServer && this.isTerrainHost;
    this.matchSettingsMode.textContent = this.terrainLockedByServer
      ? "Rules Locked"
      : this.isTerrainHost
        ? "Host Rules"
        : "Watching Host";

    this.terrainEditorPanel.classList.toggle(
      "spacedout-panel-locked",
      this.terrainLockedByServer,
    );
    this.terrainEditorOverlay.classList.toggle(
      "hidden",
      !this.terrainLockedByServer,
    );
    if (this.terrainLockedByServer) {
      this.terrainEditorOverlay.textContent = "The terrain was locked already.";
    }
    this.updateActionButtons();

    const disableEditor = this.terrainLockedByServer || !this.isTerrainHost;
    [
      this.terrainSeed,
      this.terrainNoiseScale,
      this.terrainHeightAmplitude,
      this.terrainNoiseOctaves,
      this.terrainPersistence,
      this.terrainLacunarity,
      this.terrainRandomize,
      this.terrainRegenerate,
    ].forEach((control) => {
      control.disabled = disableEditor;
    });
    this.terrainFinalize.disabled =
      disableEditor || this.waitingForTerrainFinalize;
    this.matchSettingsPanel.classList.toggle(
      "spacedout-panel-locked",
      !canEditMatchSettings,
    );
    this.matchSettingsOverlay.classList.toggle("hidden", canEditMatchSettings);
    this.matchSettingsOverlay.textContent = this.terrainLockedByServer
      ? "Match rules are locked for this round."
      : this.isTerrainHost
        ? "Waiting for authenticated host control."
        : "Only the active host can edit match rules.";
    this.gameModeSelect.disabled = !canEditMatchSettings;
    this.botsEnabledInput.disabled =
      !canEditMatchSettings || this.matchSettings.gameMode !== "ARCADE";
    this.syncMatchSettingsInputs();

    if (!this.sessionAccepted || !this.terrainStateKnown) {
      this.loadingText.textContent =
        "WAITING FOR AUTHENTICATED TERRAIN STATE...";
      this.loadingOverlay.classList.remove("hidden");
      this.calibrationScreen.classList.add("hidden");
      this.teamScreen.classList.add("hidden");
      this.cameraMode = "TERRAIN";
      return;
    }

    if (!this.terrainLockedByServer) {
      this.loadingText.textContent = "WAITING FOR TERRAIN HOST...";
      this.loadingOverlay.classList.toggle("hidden", this.isTerrainHost);
      this.calibrationScreen.classList.add("hidden");
      this.teamScreen.classList.add("hidden");
      if (this.cameraMode !== "SPECTATOR") {
        this.cameraMode = "TERRAIN";
      }
      return;
    }

    if (waitingForJoinFlow) {
      this.loadingOverlay.classList.add("hidden");
      this.calibrationScreen.classList.add("hidden");
      this.teamScreen.classList.add("hidden");
      if (this.cameraMode !== "SPECTATOR") {
        this.cameraMode = "TERRAIN";
      }
      return;
    }

    if (this.visionFailed && this.localTeam !== "SPECTATOR") {
      this.loadingText.textContent =
        "WEBCAM ACCESS REQUIRED FOR FACE TRACKING.";
      this.loadingOverlay.classList.remove("hidden");
      this.calibrationScreen.classList.add("hidden");
      this.teamScreen.classList.add("hidden");
      this.cameraMode = "TERRAIN";
      return;
    }

    this.loadingOverlay.classList.toggle("hidden", this.visionReady);
    if (!this.isCalibrated) {
      this.loadingText.textContent = this.visionReady
        ? "VISUAL LINK READY. CALIBRATE TO DEPLOY."
        : "INITIALIZING FACE TRACKER...";
      this.loadingOverlay.classList.toggle("hidden", this.visionReady);
      this.calibrationScreen.classList.toggle("hidden", !this.visionReady);
      this.teamScreen.classList.add("hidden");
      if (this.localTeam === "SPECTATOR" && this.cameraMode !== "SPECTATOR") {
        this.cameraMode = "TERRAIN";
      }
      return;
    }

    this.calibrationScreen.classList.add("hidden");
    if (this.isDead) {
      this.teamScreen.classList.add("hidden");
      if (this.cameraMode !== "DEATH" && this.cameraMode !== "SPECTATOR") {
        this.enterSpectatorMode(true);
      }
      return;
    }
    this.teamScreen.classList.toggle("hidden", this.localTeam !== "SPECTATOR");
    if (this.localTeam === "SPECTATOR") {
      if (this.cameraMode !== "SPECTATOR") {
        this.cameraMode = "TERRAIN";
      }
      return;
    }
    this.cameraMode = "PLAYER";
  }

  private joinTeam(team: TeamName): void {
    this.localTeam = team;
    this.isDead = false;
    this.respawnAvailable = false;
    this.respawnRequested = false;
    this.teamScreen.classList.add("hidden");
    this.controlsHint.classList.remove("hidden");
    this.speedReadout.classList.remove("hidden");
    this.modeReadout.classList.remove("hidden");
    this.targetReadout.classList.remove("hidden");
    this.cameraMode = "PLAYER";
    this.applyTeamColor(this.localShip, this.localTeam);
    this.socketClient.sendJson({ type: "joinTeam", team });
    this.log("info", `Requested join for team ${team}.`);
  }

  private rebuildTerrain(): void {
    if (!this.terrainGroup) {
      return;
    }

    this.loadingText.textContent = "GENERATING PLANET TERRAIN...";
    while (this.terrainGroup.children.length > 0) {
      const child = this.terrainGroup.children[0];
      this.terrainGroup.remove(child);
      this.disposeObject(child);
    }

    const grid = this.generateSeamlessWorld(MAP_CHUNKS_X, MAP_CHUNKS_Y);
    this.worldGrid = grid;
    let minZ = Infinity;
    for (const row of grid) {
      for (const value of row) {
        minZ = Math.min(minZ, value);
      }
    }

    this.terrainGroup.add(
      new THREE.Mesh(
        new THREE.SphereGeometry(WORLD_RADIUS + minZ * SCALE_Z - 500, 32, 32),
        new THREE.MeshBasicMaterial({ color: 0x000b18 }),
      ),
    );

    const ocean = new THREE.Mesh(
      new THREE.SphereGeometry(WORLD_RADIUS, 32, 32),
      new THREE.MeshBasicMaterial({
        color: 0x071f67,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      }),
    );
    ocean.renderOrder = 1;
    this.terrainGroup.add(ocean);

    const totalRows = grid.length;
    const totalCols = grid[0].length;
    const geometries: THREE.BufferGeometry[] = [];
    const origin = new THREE.Vector3(0, 0, 0);

    for (let row = 0; row < totalRows - 1; row += CHUNK_SIZE) {
      for (let col = 0; col < totalCols - 1; col += CHUNK_SIZE) {
        geometries.push(
          this.createChunkGeometry(
            grid,
            row,
            col,
            4,
            totalRows,
            totalCols,
            origin,
          ),
        );
      }
    }

    const merged = mergeGeometries(geometries);
    if (!merged) {
      return;
    }

    this.terrainGroup.add(
      new THREE.Mesh(
        merged,
        new THREE.MeshBasicMaterial({
          vertexColors: true,
          wireframe: true,
          transparent: false,
          opacity: 1,
        }),
      ),
    );
    geometries.forEach((geometry) => geometry.dispose());
  }

  private generateSeamlessWorld(chunksX: number, chunksY: number): number[][] {
    const rows = chunksY * CHUNK_SIZE + 1;
    const cols = chunksX * CHUNK_SIZE + 1;
    const grid: number[][] = [];

    for (let row = 0; row < rows; row += 1) {
      const phi = Math.PI * (row / (rows - 1));
      const terrainRow: number[] = [];

      for (let col = 0; col < cols; col += 1) {
        const theta = 2 * Math.PI * (col / (cols - 1));
        const nx = Math.sin(phi) * Math.cos(theta);
        const ny = Math.cos(phi);
        const nz = Math.sin(phi) * Math.sin(theta);
        let elevation = 0;
        let amplitude = this.terrainConfig.heightAmplitude;
        let scale = this.terrainConfig.noiseScale;

        for (
          let octave = 0;
          octave < this.terrainConfig.noiseOctaves;
          octave += 1
        ) {
          const offset = this.terrainConfig.seed + octave * 100;
          elevation +=
            Math.sin(nx * scale + offset) *
            Math.cos(ny * scale - offset) *
            Math.sin(nz * scale + offset) *
            amplitude;
          amplitude *= this.terrainConfig.persistence;
          scale *= this.terrainConfig.lacunarity;
        }

        terrainRow.push(elevation < 0 ? elevation * 0.3 : elevation + 200);
      }

      grid.push(terrainRow);
    }

    return grid;
  }

  private createChunkGeometry(
    grid: number[][],
    startRow: number,
    startCol: number,
    step: number,
    totalRows: number,
    totalCols: number,
    centerXYZ: THREE.Vector3,
  ): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    const vertices: number[] = [];
    const indices: number[] = [];
    const colors: number[] = [];
    const color = new THREE.Color();
    const endRow = Math.min(startRow + CHUNK_SIZE, totalRows - 1);
    const endCol = Math.min(startCol + CHUNK_SIZE, totalCols - 1);
    const chunkRows = Math.floor((endRow - startRow) / step) + 1;
    const chunkCols = Math.floor((endCol - startCol) / step) + 1;

    for (let row = startRow; row <= endRow; row += step) {
      for (let col = startCol; col <= endCol; col += step) {
        const rawZ = grid[row][col];
        if (rawZ <= -500) color.setHex(0x0a1e3f);
        else if (rawZ < 0) color.setHex(0x00469e);
        else if (rawZ < 200) color.setHex(0x387c44);
        else if (rawZ < 1000) color.setHex(0x8a9a5b);
        else if (rawZ < 3000) color.setHex(0x8b7355);
        else color.setHex(0xffffff);
        colors.push(color.r, color.g, color.b);

        const point = this.getSphericalXYZ(
          row,
          col,
          totalRows,
          totalCols,
          rawZ,
        );
        vertices.push(
          point.x - centerXYZ.x,
          point.y - centerXYZ.y,
          point.z - centerXYZ.z,
        );
      }
    }

    for (let row = 0; row < chunkRows - 1; row += 1) {
      for (let col = 0; col < chunkCols - 1; col += 1) {
        const a = row * chunkCols + col;
        const b = row * chunkCols + col + 1;
        const c = (row + 1) * chunkCols + col;
        const d = (row + 1) * chunkCols + col + 1;
        indices.push(a, c, b, b, c, d);
      }
    }

    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(vertices, 3),
    );
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }

  private getSphericalXYZ(
    row: number,
    col: number,
    totalRows: number,
    totalCols: number,
    rawZ: number,
  ): THREE.Vector3 {
    const phi = Math.PI * (row / (totalRows - 1));
    const theta = Math.PI - 2 * Math.PI * (col / (totalCols - 1));
    const radius = WORLD_RADIUS + rawZ * SCALE_Z;
    return new THREE.Vector3(
      radius * Math.sin(phi) * Math.cos(theta),
      radius * Math.cos(phi),
      radius * Math.sin(phi) * Math.sin(theta),
    );
  }

  private syncTerrainInputs(): void {
    this.terrainSeed.value = String(this.terrainConfig.seed);
    this.terrainNoiseScale.value = this.terrainConfig.noiseScale.toFixed(1);
    this.terrainHeightAmplitude.value = String(
      this.terrainConfig.heightAmplitude,
    );
    this.terrainNoiseOctaves.value = String(this.terrainConfig.noiseOctaves);
    this.terrainPersistence.value = this.terrainConfig.persistence.toFixed(2);
    this.terrainLacunarity.value = this.terrainConfig.lacunarity.toFixed(1);
  }

  private applyMatchSettings(rawSettings: unknown): void {
    const settings = rawSettings as Partial<MatchSettings> | undefined;
    const gameMode = normalizeGameMode(settings?.gameMode);
    this.matchSettings = {
      gameMode,
      botsEnabled: gameMode === "ARCADE" && Boolean(settings?.botsEnabled),
    };
    this.syncMatchSettingsInputs();
  }

  private syncMatchSettingsInputs(): void {
    this.gameModeSelect.value = this.matchSettings.gameMode;
    this.botsEnabledInput.checked = this.matchSettings.botsEnabled;
    this.botsEnabledInput.disabled =
      this.gameModeSelect.disabled || this.matchSettings.gameMode !== "ARCADE";
  }

  private resizeRenderer(): void {
    if (!this.renderer || !this.camera) {
      return;
    }

    const width = this.mount.clientWidth;
    const height = Math.max(this.mount.clientHeight, 1);
    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.hudCanvas.width = width;
    this.hudCanvas.height = height;
  }

  private applyLocalServerPose(pos: Record<string, unknown>): void {
    this.localServerPosition.set(
      Number(pos.x) || 0,
      Number(pos.y) || 0,
      Number(pos.z) || 0,
    );
    const direction = new THREE.Vector3(
      Number(pos.dx) || 0,
      Number(pos.dy) || 1,
      Number(pos.dz) || 0,
    );
    this.localForward.copy(
      direction.lengthSq() > 1e-8
        ? direction.normalize()
        : new THREE.Vector3(0, 1, 0),
    );
    this.localQuaternion.copy(
      quaternionFromPose(this.localServerPosition, this.localForward),
    );
    this.applyLocalShipState();
  }

  private applyLocalShipState(): void {
    if (!this.playerRig) {
      return;
    }
    this.playerRig.position.copy(this.localServerPosition);
    this.playerRig.quaternion.copy(this.localQuaternion);
    this.applyTeamColor(this.localShip, this.localTeam);
  }

  private updateLocalShipVisuals(): void {
    if (!this.localShip) {
      return;
    }

    const roll = THREE.MathUtils.clamp(
      -this.localYawInput * 0.7,
      -Math.PI / 3,
      Math.PI / 3,
    );
    const pitch = THREE.MathUtils.clamp(
      Math.abs(this.localShip.rotation.z) * 0.2 + this.localPitchInput * 0.3,
      -Math.PI / 4,
      Math.PI / 4,
    );
    this.localShip.rotation.z += (roll - this.localShip.rotation.z) * 0.1;
    this.localShip.rotation.x += (pitch - this.localShip.rotation.x) * 0.15;
  }

  private createPilotShip(team: TeamName): THREE.Group {
    const fuselage = (): THREE.BufferGeometry => {
      const positions: number[] = [];
      const indices: number[] = [];
      const radialSegments = 32;
      const lengthSegments = 40;
      const radiusAt = (t: number): number =>
        t < 0.15
          ? 0.1 + t * 2.5
          : t < 0.35
            ? 0.5 + Math.sin((t - 0.15) * 10) * 0.15
            : t < 0.7
              ? 0.65 - (t - 0.35) * 0.3
              : 0.45 - (t - 0.7) * 1.2;

      for (let y = 0; y <= lengthSegments; y += 1) {
        const t = y / lengthSegments;
        const z = t * 10;
        const radius = Math.max(radiusAt(t), 0.05);
        for (let i = 0; i <= radialSegments; i += 1) {
          const theta = (i / radialSegments) * Math.PI * 2;
          positions.push(Math.cos(theta) * radius, Math.sin(theta) * radius, z);
        }
      }

      const ring = radialSegments + 1;
      for (let y = 0; y < lengthSegments; y += 1) {
        for (let i = 0; i < radialSegments; i += 1) {
          indices.push(
            y * ring + i,
            y * ring + i + ring,
            y * ring + i + 1,
            y * ring + i + ring,
            y * ring + i + ring + 1,
            y * ring + i + 1,
          );
        }
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(positions, 3),
      );
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      return geometry;
    };

    const wingSurface = (
      span: number,
      rootChord: number,
      tipChord: number,
      thicknessRoot: number,
      thicknessTip: number,
      dihedralScale: number,
      chordSegments: number,
      spanSegments: number,
    ): THREE.BufferGeometry => {
      const positions: number[] = [];
      const indices: number[] = [];

      for (let s = 0; s <= spanSegments; s += 1) {
        const spanT = s / spanSegments;
        const halfSpan = spanT * span;
        const chord = rootChord - spanT * (rootChord - tipChord);
        const thickness = thicknessRoot * (1 - spanT) + thicknessTip;
        const dihedral = dihedralScale * spanT;

        for (let c = 0; c <= chordSegments; c += 1) {
          const chordT = c / chordSegments;
          positions.push(
            chordT * chord,
            thickness * Math.sin(Math.PI * chordT) - thickness / 2 + dihedral,
            halfSpan,
          );
        }
      }

      const ring = chordSegments + 1;
      for (let s = 0; s < spanSegments; s += 1) {
        for (let c = 0; c < chordSegments; c += 1) {
          indices.push(
            s * ring + c,
            s * ring + c + ring,
            s * ring + c + 1,
            s * ring + c + ring,
            s * ring + c + ring + 1,
            s * ring + c + 1,
          );
        }
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(positions, 3),
      );
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      return geometry;
    };

    const canopy = new THREE.SphereGeometry(0.5, 24, 24);
    canopy.scale(1.2, 0.6, 1.0);
    canopy.translate(0, 0.6, 3.0);

    const wingRootBlend = new THREE.SphereGeometry(0.9, 24, 24);
    wingRootBlend.scale(1.6, 0.5, 1.0);
    wingRootBlend.translate(0, -0.15, 3.2);

    const wing = wingSurface(6, 2.0, 1.2, 0.25, 0.08, 0.2, 16, 24);
    wing.rotateY(Math.PI / 2);
    wing.translate(0.5, -0.2, 5.4);
    const wingMirror = wing.clone();
    wingMirror.scale(-1, 1, 1);

    const tail = wingSurface(3.2, 1.4, 0.8, 0.18, 0.05, 0.08, 12, 18);
    tail.rotateY(Math.PI / 2);
    tail.translate(-0.4, -0.05, 8.8);
    const tailMirror = tail.clone();
    tailMirror.scale(-1, 1, 1);

    const vTailPositions: number[] = [];
    const vTailIndices: number[] = [];
    for (let y = 0; y <= 20; y += 1) {
      const t = y / 20;
      const finHeight = t * 2.6;
      const thickness = 0.25 * (1 - t) + 0.05;
      const chord = 1.6 - t * 0.8;
      for (let i = 0; i <= 16; i += 1) {
        const theta = (i / 16) * Math.PI;
        vTailPositions.push(
          Math.cos(theta) * thickness,
          finHeight,
          Math.sin(theta) * chord,
        );
      }
    }
    for (let y = 0; y < 20; y += 1) {
      for (let i = 0; i < 16; i += 1) {
        vTailIndices.push(
          y * 17 + i,
          y * 17 + i + 17,
          y * 17 + i + 1,
          y * 17 + i + 17,
          y * 17 + i + 18,
          y * 17 + i + 1,
        );
      }
    }
    const vTail = new THREE.BufferGeometry();
    vTail.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(vTailPositions, 3),
    );
    vTail.setIndex(vTailIndices);
    vTail.computeVertexNormals();
    vTail.rotateY(Math.PI);
    vTail.rotateZ(-0.08);
    vTail.translate(0, 0.2, 8.6);

    const wheel = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 16);
    wheel.rotateZ(Math.PI / 2);
    wheel.translate(0, -0.5, 0);
    const strut = new THREE.CylinderGeometry(0.05, 0.05, 1);
    strut.translate(0, -0.2, 0);
    const gearRight = mergeGeometries([wheel, strut]);
    gearRight?.translate(0.8, -0.5, 2.5);
    const gearLeft = mergeGeometries([wheel.clone(), strut.clone()]);
    gearLeft?.translate(-0.8, -0.5, 2.5);

    const blade = new THREE.BoxGeometry(0.15, 2, 0.3);
    blade.translate(0, 0.5, 1.5);
    const bladeTwo = blade.clone();
    bladeTwo.rotateZ(Math.PI / 2);
    const propellerGeo = mergeGeometries([blade, bladeTwo]);

    const group = new THREE.Group();
    const accents: THREE.MeshBasicMaterial[] = [];
    const wire = (color: number) =>
      new THREE.MeshBasicMaterial({
        color,
        wireframe: true,
        transparent: true,
        opacity: 0.9,
      });

    const fuselageMesh = new THREE.Mesh(fuselage(), wire(0x616161));
    fuselageMesh.userData.isFuselage = true;
    group.add(fuselageMesh);
    group.add(new THREE.Mesh(canopy, wire(0x1a1a1a)));
    group.add(new THREE.Mesh(wingRootBlend, wire(0x8b8b8b)));

    const wingMaterial = wire(0xff2222);
    accents.push(wingMaterial);
    group.add(new THREE.Mesh(wing, wingMaterial));
    group.add(new THREE.Mesh(wingMirror, wingMaterial));

    const tailMaterial = wire(0xff2222);
    accents.push(tailMaterial);
    group.add(new THREE.Mesh(tail, tailMaterial));
    group.add(new THREE.Mesh(tailMirror, tailMaterial));
    group.add(new THREE.Mesh(vTail, tailMaterial));

    if (gearRight) group.add(new THREE.Mesh(gearRight, wire(0x8b8b8b)));
    if (gearLeft) group.add(new THREE.Mesh(gearLeft, wire(0x8b8b8b)));

    if (propellerGeo) {
      const propeller = new THREE.Mesh(
        propellerGeo,
        new THREE.MeshBasicMaterial({ color: 0x8d8d8d, wireframe: true }),
      );
      propeller.position.set(0, 0, -1.4);
      group.add(propeller);
      group.userData.propeller = propeller;
    }

    group.userData.applyFactionColor = (teamName: TeamName) => {
      const color =
        normalizeTeamName(teamName) === "BLUE" ? 0x0088ff : 0xff2222;
      accents.forEach((material) => material.color.setHex(color));
    };

    group.scale.set(0.5, 0.5, 0.5);
    this.applyTeamColor(group, team);
    return group;
  }

  private applyTeamColor(ship: THREE.Group | null, team: TeamName): void {
    const applyFactionColor = ship?.userData.applyFactionColor as
      | ((teamName: TeamName) => void)
      | undefined;
    if (applyFactionColor) {
      applyFactionColor(team);
    }
  }

  private canCalibrateVision(): boolean {
    return (
      this.visionReady &&
      !this.visionFailed &&
      !this.isDead &&
      !this.isPaused &&
      this.vision.faceDetected
    );
  }

  private updateCalibrationControls(): void {
    if (this.visionFailed) {
      this.calibrateButton.disabled = true;
      this.calibrateButton.textContent = "Camera Unavailable";
      return;
    }

    if (!this.visionReady) {
      this.calibrateButton.disabled = true;
      this.calibrateButton.textContent = "Initializing...";
      return;
    }

    if (this.isPaused) {
      this.calibrateButton.disabled = true;
      this.calibrateButton.textContent = "Paused";
      return;
    }

    if (this.isDead) {
      this.calibrateButton.disabled = true;
      this.calibrateButton.textContent = "Unavailable";
      return;
    }

    const canCalibrate = this.canCalibrateVision();
    this.calibrateButton.disabled = !canCalibrate;
    this.calibrateButton.textContent = canCalibrate
      ? this.isCalibrated
        ? "Recalibrate"
        : "Calibrate"
      : "Center Face";
  }

  private calibrateVision(): void {
    if (!this.visionReady) {
      this.log("warning", "Face tracker is still initializing.");
      return;
    }
    if (this.visionFailed) {
      this.log("warning", "Camera access is unavailable.");
      return;
    }
    if (this.isPaused) {
      this.log("warning", "Resume the simulation before recalibrating.");
      return;
    }
    if (this.isDead) {
      this.log("warning", "Calibration is unavailable while destroyed.");
      return;
    }
    if (!this.vision.faceDetected) {
      this.log("warning", "No face detected for calibration.");
      return;
    }

    const firstCalibration = !this.isCalibrated;
    this.audio.init();
    this.vision.calibrate();
    this.isCalibrated = true;
    this.log(
      "success",
      firstCalibration
        ? "Calibration step completed."
        : "Face tracking recalibrated.",
    );
    this.updateCalibrationControls();
    this.syncFlowScreens();
  }

  private getTerrainHeightAtPosition(position: THREE.Vector3): number {
    if (!this.worldGrid) {
      return 0;
    }

    const normPos = this.getEarthAnchorUpFromLocalPosition(position);
    const phi = Math.acos(normPos.y);
    const theta = Math.atan2(normPos.z, normPos.x);
    const mapRows = this.worldGrid.length;
    const mapCols = this.worldGrid[0].length;
    const rRow = Math.round((phi / Math.PI) * (mapRows - 1));
    const rCol = Math.round(
      ((Math.PI - theta) / (2 * Math.PI)) * (mapCols - 1),
    );
    const safeRow = Math.max(0, Math.min(rRow, mapRows - 1));
    const safeCol = Math.max(0, Math.min(rCol, mapCols - 1));

    return Math.max(0, this.worldGrid[safeRow][safeCol] * SCALE_Z);
  }

  private getRadarAltitude(position: THREE.Vector3): number {
    const altitude =
      this.getEarthAnchorDistanceFromLocalPosition(position) - WORLD_RADIUS;
    return Math.max(0, altitude - this.getTerrainHeightAtPosition(position));
  }

  private getEarthAnchorUpFromLocalPosition(
    position: THREE.Vector3,
  ): THREE.Vector3 {
    if (!this.earthAnchor) {
      return position.clone().normalize();
    }

    const anchorWorldPosition = this.earthAnchor.getWorldPosition(
      new THREE.Vector3(),
    );
    const worldPosition = this.earthAnchor.localToWorld(position.clone());
    return worldPosition.sub(anchorWorldPosition).normalize();
  }

  private getEarthAnchorDistanceFromLocalPosition(
    position: THREE.Vector3,
  ): number {
    if (!this.earthAnchor) {
      return position.length();
    }

    const anchorWorldPosition = this.earthAnchor.getWorldPosition(
      new THREE.Vector3(),
    );
    return this.earthAnchor
      .localToWorld(position.clone())
      .distanceTo(anchorWorldPosition);
  }

  private getEarthAnchorDistanceFromWorldPosition(
    position: THREE.Vector3,
  ): number {
    if (!this.earthAnchor) {
      return position.length();
    }

    const anchorWorldPosition = this.earthAnchor.getWorldPosition(
      new THREE.Vector3(),
    );
    return position.distanceTo(anchorWorldPosition);
  }

  private renderLegacyHud(
    context: CanvasRenderingContext2D,
    speed: number,
    radarAltitude: number,
    altitude: number,
    rigPitch: number,
    shipRoll: number,
    aimX: number,
    aimY: number,
    aimZ: number,
    isLockedOn: boolean,
    lockProgress: number,
    isBeingTracked: boolean,
    flareCooldown: number,
    targetScreenX: number,
    targetScreenY: number,
  ): void {
    const width = this.hudCanvas.width;
    const height = this.hudCanvas.height;
    const centerX = width / 2;
    const centerY = height / 2;

    context.strokeStyle = isLockedOn
      ? "rgba(255, 0, 85, 0.8)"
      : "rgba(0, 255, 204, 0.8)";
    context.fillStyle = context.strokeStyle;
    context.shadowColor = isLockedOn ? "#ff0055" : "#00ffcc";
    context.shadowBlur = 8;
    context.lineWidth = 2;
    context.textBaseline = "middle";

    if (aimZ < 1) {
      context.beginPath();
      context.arc(aimX, aimY, 35, 0, Math.PI * 2);
      context.moveTo(aimX - 50, aimY);
      context.lineTo(aimX - 20, aimY);
      context.moveTo(aimX + 20, aimY);
      context.lineTo(aimX + 50, aimY);
      context.moveTo(aimX, aimY - 50);
      context.lineTo(aimX, aimY - 20);
      context.stroke();

      context.shadowColor = "#ff0055";
      context.fillStyle = "#ff0055";
      context.beginPath();
      context.arc(aimX, aimY, 3, 0, Math.PI * 2);
      context.fill();
      context.shadowColor = "#00ffcc";
      context.fillStyle = "rgba(0, 255, 204, 0.8)";
    }

    if (isLockedOn) {
      const size = 40 - lockProgress * 15;
      const color = lockProgress >= 1 ? "#ff0055" : "#ffcc00";
      context.strokeStyle = color;
      context.shadowColor = color;
      context.strokeRect(
        targetScreenX - size / 2,
        targetScreenY - size / 2,
        size,
        size,
      );
      if (lockProgress >= 1) {
        context.font = 'bold 14px "Courier New"';
        context.fillStyle = "#ff0055";
        context.fillText("LOCK", targetScreenX, targetScreenY + 35);
      }
    }

    if (isBeingTracked && Date.now() % 500 < 250) {
      context.font = 'bold 36px "Courier New"';
      context.fillStyle = "#ff0055";
      context.textAlign = "center";
      context.fillText("WARNING: MISSILE LOCK", centerX, centerY + 120);
    }

    context.font = 'bold 16px "Courier New"';
    context.fillStyle = flareCooldown <= 0 ? "#00ffcc" : "#555555";
    context.textAlign = "left";
    context.fillText(
      `FLARES: ${flareCooldown <= 0 ? "READY" : "RELOADING"}`,
      20,
      height - 60,
    );

    context.save();
    context.translate(centerX, centerY);
    context.rotate(-shipRoll);
    context.translate(0, rigPitch * (height / Math.PI));
    context.beginPath();
    context.setLineDash([20, 15]);
    context.moveTo(-200, 0);
    context.lineTo(200, 0);
    context.stroke();
    context.setLineDash([]);
    context.font = 'bold 16px "Courier New"';
    context.textAlign = "center";
    context.fillText("HORIZON", 0, -15);
    context.restore();

    context.textAlign = "right";
    context.beginPath();
    context.moveTo(100, centerY - 150);
    context.lineTo(100, centerY + 150);
    context.moveTo(100, centerY);
    context.lineTo(120, centerY);
    context.stroke();
    context.font = 'bold 16px "Courier New"';
    context.fillText("MACH", 90, centerY - 160);
    context.font = 'bold 28px "Courier New"';
    context.fillText(String(Math.round(speed * 100)), 85, centerY);

    context.textAlign = "left";
    context.beginPath();
    context.moveTo(width - 100, centerY - 150);
    context.lineTo(width - 100, centerY + 150);
    context.moveTo(width - 100, centerY);
    context.lineTo(width - 120, centerY);
    context.stroke();
    context.font = 'bold 16px "Courier New"';
    context.fillText("RAD ALT", width - 90, centerY - 160);
    context.font = 'bold 28px "Courier New"';
    context.fillText(
      String(Math.max(0, Math.round(radarAltitude))),
      width - 85,
      centerY,
    );
    context.font = 'bold 12px "Courier New"';
    context.fillText(
      `MSL ${Math.max(0, Math.round(altitude))}`,
      width - 85,
      centerY + 28,
    );

    const radarRadius = 110;
    const radarCx = width - radarRadius - 30;
    const radarCy = radarRadius + 30;
    const radarScale = radarRadius / RADAR_MAX_RANGE;

    context.save();
    context.beginPath();
    context.arc(radarCx, radarCy, radarRadius, 0, Math.PI * 2);
    context.fillStyle = "rgba(0, 30, 20, 0.5)";
    context.fill();
    context.strokeStyle = "rgba(0, 255, 204, 0.6)";
    context.stroke();

    context.beginPath();
    context.arc(radarCx, radarCy, radarRadius * 0.33, 0, Math.PI * 2);
    context.arc(radarCx, radarCy, radarRadius * 0.66, 0, Math.PI * 2);
    context.stroke();

    context.beginPath();
    context.moveTo(radarCx - radarRadius, radarCy);
    context.lineTo(radarCx + radarRadius, radarCy);
    context.moveTo(radarCx, radarCy - radarRadius);
    context.lineTo(radarCx, radarCy + radarRadius);
    context.stroke();

    context.fillStyle = "#00ffcc";
    context.beginPath();
    context.moveTo(radarCx, radarCy - 8);
    context.lineTo(radarCx - 5, radarCy + 5);
    context.lineTo(radarCx + 5, radarCy + 5);
    context.fill();

    const playerUp = this.getEarthAnchorUpFromLocalPosition(
      this.localServerPosition,
    );
    const radarRight = new THREE.Vector3()
      .crossVectors(this.localForward, playerUp)
      .normalize();
    const radarForward = new THREE.Vector3()
      .crossVectors(playerUp, radarRight)
      .normalize();
    const playerAltitude =
      this.getEarthAnchorDistanceFromLocalPosition(this.localServerPosition) -
      WORLD_RADIUS;

    this.remotePilots.forEach((pilot) => {
      if (!pilot.mesh.visible) {
        return;
      }
      pilot.mesh.getWorldPosition(this.tempA);
      this.tempB.subVectors(this.tempA, this.localServerPosition);
      const dist = this.tempB.length();
      if (dist > RADAR_MAX_RANGE) {
        return;
      }
      const x = radarCx + this.tempB.dot(radarRight) * radarScale;
      const y = radarCy - this.tempB.dot(radarForward) * radarScale;
      const color = pilot.team === this.localTeam ? "#0088ff" : "#ff0055";
      context.fillStyle = color;
      context.beginPath();
      context.arc(x, y, 4, 0, Math.PI * 2);
      context.fill();
      const diff =
        this.getEarthAnchorDistanceFromWorldPosition(this.tempA) -
        WORLD_RADIUS -
        playerAltitude;
      context.strokeStyle = color;
      context.beginPath();
      context.moveTo(x, y);
      if (diff > 400) context.lineTo(x, y - 12);
      else if (diff < -400) context.lineTo(x, y + 12);
      context.stroke();
    });

    context.restore();
  }

  private setTerrainSelectionCamera(force = false): void {
    if (!this.camera || !this.scene || !this.localShip) {
      return;
    }
    if (force || this.camera.parent !== this.scene) {
      this.scene.attach(this.camera);
    }
    this.localShip.visible = false;
    if (force) this.camera.position.copy(this.terrainCameraPosition);
    else this.camera.position.lerp(this.terrainCameraPosition, 0.08);
    this.camera.lookAt(0, 0, 0);
  }

  private setPlayerCamera(): void {
    if (!this.camera || !this.playerRig || !this.localShip) {
      return;
    }
    if (this.camera.parent !== this.playerRig) {
      this.playerRig.attach(this.camera);
      this.camera.position.set(0, 0, 0);
      this.camera.rotation.set(0, 0, 0);
    }
    this.localShip.visible = true;
  }

  private setStatus(message: string): void {
    this.statusMount.textContent = message;
  }

  private escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (char) => {
      switch (char) {
        case "&":
          return "&amp;";
        case "<":
          return "&lt;";
        case ">":
          return "&gt;";
        case '"':
          return "&quot;";
        default:
          return "&#39;";
      }
    });
  }

  private log(level: SpacedOutLogEntry["level"], message: string): void {
    this.logs.unshift({ id: Date.now() + this.logs.length, level, message });
    this.logs.splice(8);
    this.logsMount.innerHTML = this.logs
      .map(
        (entry) =>
          `<li class="spacedout-log spacedout-log-${entry.level}">${entry.message}</li>`,
      )
      .join("");
  }

  private disposeScene(): void {
    if (!this.scene) {
      return;
    }
    this.scene.traverse((object: THREE.Object3D) => {
      const mesh = object as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const material = mesh.material;
      if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
      else if (material) material.dispose();
    });
  }

  private disposeObject(object: THREE.Object3D): void {
    object.traverse((child: THREE.Object3D) => {
      const mesh = child as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const material = mesh.material;
      if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
      else if (material) material.dispose();
    });
  }
}
