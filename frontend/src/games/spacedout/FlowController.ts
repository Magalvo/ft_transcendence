import type {
  CameraMode,
  ControlMode,
  TeamName,
} from "./SpacedOutGameShared";
import type { MatchSettings } from "./types";

interface FlowControllerOptions {
  loadingOverlay: HTMLElement;
  loadingText: HTMLElement;
  calibrationScreen: HTMLElement;
  calibrateButton: HTMLButtonElement;
  teamScreen: HTMLElement;
  actionButtons: HTMLElement;
  joinButton: HTMLButtonElement;
  spectateButton: HTMLButtonElement;
  speedReadout: HTMLElement;
  modeReadout: HTMLElement;
  targetReadout: HTMLElement;
  terrainEditorPanel: HTMLElement;
  terrainEditorOverlay: HTMLElement;
  terrainMode: HTMLElement;
  terrainControls: Array<HTMLInputElement | HTMLButtonElement>;
  terrainFinalize: HTMLButtonElement;
  matchSettingsPanel: HTMLElement;
  matchSettingsOverlay: HTMLElement;
  matchSettingsMode: HTMLElement;
  gameModeSelect: HTMLSelectElement;
  botsEnabledInput: HTMLInputElement;
}

interface CalibrationControlsState {
  webcamRequired: boolean;
  visionReady: boolean;
  visionFailed: boolean;
  isDead: boolean;
  isPaused: boolean;
  isCalibrated: boolean;
  canCalibrate: boolean;
}

interface ActionButtonsState {
  isDead: boolean;
  localTeam: TeamName;
  isPaused: boolean;
  terrainLockedByServer: boolean;
  canSpectate: boolean;
  cameraMode: CameraMode;
  joinSequencePending: boolean;
  wantsToPlay: boolean;
}

interface ModeReadoutState {
  isPaused: boolean;
  isDead: boolean;
  controlMode: ControlMode;
  spectatorTargetId: string | null;
  respawnAvailable: boolean;
  cameraMode: CameraMode;
}

interface FlowScreenState extends ActionButtonsState, CalibrationControlsState {
  sessionAccepted: boolean;
  terrainStateKnown: boolean;
  isTerrainHost: boolean;
  waitingForTerrainFinalize: boolean;
  matchSettings: MatchSettings;
}

export class FlowController {
  private readonly loadingOverlay: HTMLElement;
  private readonly loadingText: HTMLElement;
  private readonly calibrationScreen: HTMLElement;
  private readonly calibrateButton: HTMLButtonElement;
  private readonly teamScreen: HTMLElement;
  private readonly actionButtons: HTMLElement;
  private readonly joinButton: HTMLButtonElement;
  private readonly spectateButton: HTMLButtonElement;
  private readonly speedReadout: HTMLElement;
  private readonly modeReadout: HTMLElement;
  private readonly targetReadout: HTMLElement;
  private readonly terrainEditorPanel: HTMLElement;
  private readonly terrainEditorOverlay: HTMLElement;
  private readonly terrainMode: HTMLElement;
  private readonly terrainControls: Array<HTMLInputElement | HTMLButtonElement>;
  private readonly terrainFinalize: HTMLButtonElement;
  private readonly matchSettingsPanel: HTMLElement;
  private readonly matchSettingsOverlay: HTMLElement;
  private readonly matchSettingsMode: HTMLElement;
  private readonly gameModeSelect: HTMLSelectElement;
  private readonly botsEnabledInput: HTMLInputElement;

  public constructor(options: FlowControllerOptions) {
    this.loadingOverlay = options.loadingOverlay;
    this.loadingText = options.loadingText;
    this.calibrationScreen = options.calibrationScreen;
    this.calibrateButton = options.calibrateButton;
    this.teamScreen = options.teamScreen;
    this.actionButtons = options.actionButtons;
    this.joinButton = options.joinButton;
    this.spectateButton = options.spectateButton;
    this.speedReadout = options.speedReadout;
    this.modeReadout = options.modeReadout;
    this.targetReadout = options.targetReadout;
    this.terrainEditorPanel = options.terrainEditorPanel;
    this.terrainEditorOverlay = options.terrainEditorOverlay;
    this.terrainMode = options.terrainMode;
    this.terrainControls = options.terrainControls;
    this.terrainFinalize = options.terrainFinalize;
    this.matchSettingsPanel = options.matchSettingsPanel;
    this.matchSettingsOverlay = options.matchSettingsOverlay;
    this.matchSettingsMode = options.matchSettingsMode;
    this.gameModeSelect = options.gameModeSelect;
    this.botsEnabledInput = options.botsEnabledInput;
  }

  public updateCalibrationControls(state: CalibrationControlsState): void {
    if (!state.webcamRequired) {
      this.calibrateButton.disabled = true;
      this.calibrateButton.textContent = "Keyboard Mode";
      return;
    }

    if (state.visionFailed) {
      this.calibrateButton.disabled = true;
      this.calibrateButton.textContent = "Camera Unavailable";
      return;
    }

    if (!state.visionReady) {
      this.calibrateButton.disabled = true;
      this.calibrateButton.textContent = "Initializing...";
      return;
    }

    if (state.isPaused) {
      this.calibrateButton.disabled = true;
      this.calibrateButton.textContent = "Paused";
      return;
    }

    if (state.isDead) {
      this.calibrateButton.disabled = true;
      this.calibrateButton.textContent = "Unavailable";
      return;
    }

    this.calibrateButton.disabled = !state.canCalibrate;
    this.calibrateButton.textContent = state.canCalibrate
      ? state.isCalibrated
        ? "Recalibrate"
        : "Calibrate"
      : "Center Face";
  }

  public updateActionButtons(state: ActionButtonsState): void {
    const showButtons =
      !state.isDead && (state.localTeam === "SPECTATOR" || state.isPaused);
    const canJoin = state.terrainLockedByServer;
    const isSpectating =
      state.localTeam === "SPECTATOR" && state.cameraMode === "SPECTATOR";
    const isPauseMenu = state.isPaused;

    this.actionButtons.classList.toggle("hidden", !showButtons);
    this.joinButton.disabled = isPauseMenu
      ? false
      : !canJoin || state.joinSequencePending;
    this.spectateButton.disabled = isPauseMenu
      ? !state.canSpectate
      : !state.canSpectate || state.joinSequencePending;
    this.joinButton.classList.toggle(
      "is-active",
      isPauseMenu || state.wantsToPlay,
    );
    this.spectateButton.classList.toggle("is-active", isSpectating);
    this.joinButton.textContent = isPauseMenu
      ? "Return to Lobby"
      : state.joinSequencePending
        ? "Warping"
        : canJoin
          ? "Join"
          : "Join Locked";
    this.spectateButton.textContent = state.canSpectate
      ? "Spectate"
      : "No Pilots";
  }

  public updateModeReadout(state: ModeReadoutState): void {
    if (state.isPaused) {
      this.modeReadout.textContent = "MODE: PAUSED";
      return;
    }

    if (!state.isDead) {
      this.modeReadout.textContent = `MODE: ${state.controlMode}`;
      return;
    }

    const targetTag = state.spectatorTargetId
      ? `TGT ${state.spectatorTargetId}`
      : "NO TARGET";
    if (state.respawnAvailable) {
      this.modeReadout.textContent = `MODE: SPECTATE [${targetTag}] | R RESPAWN | B LOBBY`;
    } else if (state.cameraMode === "DEATH") {
      this.modeReadout.textContent =
        "MODE: DEATH CAM | B LOBBY | V OR [ ] SPECTATE";
    } else {
      this.modeReadout.textContent = `MODE: SPECTATE [${targetTag}] | B LOBBY | RESPAWN PENDING`;
    }
  }

  public syncFlowScreens(state: FlowScreenState): void {
    const waitingForJoinFlow =
      state.terrainLockedByServer &&
      state.localTeam === "SPECTATOR" &&
      !state.wantsToPlay;
    this.terrainMode.textContent = state.terrainLockedByServer
      ? "Terrain Locked"
      : state.isTerrainHost
        ? "Host Editing"
        : "Waiting for Host";

    const canEditMatchSettings =
      state.sessionAccepted &&
      !state.terrainLockedByServer &&
      state.isTerrainHost;
    this.matchSettingsMode.textContent = state.terrainLockedByServer
      ? "Rules Locked"
      : state.isTerrainHost
        ? "Host Rules"
        : "Watching Host";

    this.terrainEditorPanel.classList.toggle(
      "spacedout-panel-locked",
      state.terrainLockedByServer,
    );
    this.terrainEditorOverlay.classList.toggle(
      "hidden",
      !state.terrainLockedByServer,
    );
    if (state.terrainLockedByServer) {
      this.terrainEditorOverlay.textContent = "The terrain was locked already.";
    }

    const disableEditor =
      state.terrainLockedByServer || !state.isTerrainHost;
    this.terrainControls.forEach((control) => {
      control.disabled = disableEditor;
    });
    this.terrainFinalize.disabled =
      disableEditor || state.waitingForTerrainFinalize;

    this.matchSettingsPanel.classList.toggle(
      "spacedout-panel-locked",
      !canEditMatchSettings,
    );
    this.matchSettingsOverlay.classList.toggle("hidden", canEditMatchSettings);
    this.matchSettingsOverlay.textContent = state.terrainLockedByServer
      ? "Match rules are locked for this round."
      : state.isTerrainHost
        ? "Waiting for authenticated host control."
        : "Only the active host can edit match rules.";
    this.gameModeSelect.disabled = !canEditMatchSettings;
    this.botsEnabledInput.disabled =
      !canEditMatchSettings || state.matchSettings.gameMode !== "ARCADE";

    if (!state.sessionAccepted || !state.terrainStateKnown) {
      this.loadingText.textContent =
        "WAITING FOR AUTHENTICATED TERRAIN STATE...";
      this.loadingOverlay.classList.remove("hidden");
      this.calibrationScreen.classList.add("hidden");
      this.teamScreen.classList.add("hidden");
      return;
    }

    if (!state.terrainLockedByServer) {
      this.loadingText.textContent = "WAITING FOR TERRAIN HOST...";
      this.loadingOverlay.classList.toggle("hidden", state.isTerrainHost);
      this.calibrationScreen.classList.add("hidden");
      this.teamScreen.classList.add("hidden");
      return;
    }

    if (waitingForJoinFlow) {
      this.loadingOverlay.classList.add("hidden");
      this.calibrationScreen.classList.add("hidden");
      this.teamScreen.classList.add("hidden");
      return;
    }

    if (state.visionFailed && state.localTeam !== "SPECTATOR") {
      this.loadingText.textContent =
        "WEBCAM ACCESS REQUIRED FOR FACE TRACKING.";
      this.loadingOverlay.classList.remove("hidden");
      this.calibrationScreen.classList.add("hidden");
      this.teamScreen.classList.add("hidden");
      return;
    }

    this.loadingOverlay.classList.toggle("hidden", state.visionReady);
    if (!state.isCalibrated) {
      this.loadingText.textContent = state.visionReady
        ? "VISUAL LINK READY. CALIBRATE TO DEPLOY."
        : "INITIALIZING FACE TRACKER...";
      this.loadingOverlay.classList.toggle("hidden", state.visionReady);
      this.calibrationScreen.classList.toggle("hidden", !state.visionReady);
      this.teamScreen.classList.add("hidden");
      return;
    }

    this.calibrationScreen.classList.add("hidden");
    if (state.isDead) {
      this.teamScreen.classList.add("hidden");
      return;
    }

    this.teamScreen.classList.toggle(
      "hidden",
      state.localTeam !== "SPECTATOR",
    );
  }

  public showPausedOverlay(): void {
    this.loadingText.textContent = "SIMULATION PAUSED";
    this.loadingOverlay.classList.remove("hidden");
  }

  public showHud(): void {
    this.speedReadout.classList.remove("hidden");
    this.modeReadout.classList.remove("hidden");
    this.targetReadout.classList.remove("hidden");
  }

  public hideHud(): void {
    this.speedReadout.classList.add("hidden");
    this.modeReadout.classList.add("hidden");
    this.targetReadout.classList.add("hidden");
  }
}
