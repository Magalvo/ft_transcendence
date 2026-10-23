import { AbstractComponent } from "../core/Component";
import { Navbar } from "../components/layout/Navbar";
import { SpacedOutService } from "../services/SpacedOutService";
import { SpacedOutGame } from "../games/spacedout/SpacedOutGame";
import { JoinWarpTransition } from "../games/spacedout/JoinWarpTransition";
import "../games/spacedout/style.css";

import { escapeHtml } from "../shared/utils";
export class SpacedOutPage extends AbstractComponent {
  private navbar: Navbar | null = null;
  private game: SpacedOutGame | null = null;
  private isMounted = false;
  private joinTransition: JoinWarpTransition | null = null;
  private joinTransitionPlay: Promise<void> | null = null;

  constructor() {
    super("div", "spacedout-shell");
  }

  public render(): void {
    this.isMounted = true;
    this.destroyOwnedUi();
    this.element.innerHTML = "";

    this.navbar = new Navbar();
    this.navbar.render();
    const navbarSlot = document.createElement("div");
    navbarSlot.className = "spacedout-nav-slot";
    navbarSlot.appendChild(this.navbar.getElement());
    this.element.appendChild(navbarSlot);

    const content = document.createElement("main");
    content.className = "spacedout-page-content mx-auto max-w-7xl px-6 pb-10 pt-28";
    content.innerHTML = `
      <section class="spacedout-page-hero mb-8 max-w-4xl">
        <span class="mb-3 inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">
          Legacy Port
        </span>
        <h1 class="text-4xl font-black tracking-tight text-white">SpacedOut</h1>
        <p class="mt-4 text-base text-slate-300">
          The standalone prototype is now rendered inside the routed frontend with the original planet, HUD, and aircraft style.
        </p>
      </section>

      <section class="spacedout-grid">
        <div class="spacedout-top-row">
          <div class="spacedout-panel rounded-[1.5rem] p-4">
            <div class="spacedout-status-bar mb-4 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-cyan-400/15 bg-black/40 px-4 py-3">
              <div>
                <div class="text-xs uppercase tracking-[0.2em] text-cyan-300">Service Status</div>
                <div id="spacedout-status" class="mt-1 text-sm text-slate-200">Creating authenticated SpacedOut session...</div>
              </div>
              <div id="spacedout-ws-url" class="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-100">
                Session pending
              </div>
            </div>

            <div class="spacedout-webcam-toggle mb-4 rounded-2xl border border-cyan-400/15 bg-black/35 px-4 py-3">
              <p class="text-xs uppercase tracking-[0.2em] text-cyan-300">Webcam Requirement</p>
              <div class="spacedout-webcam-toggle-options mt-3">
                <label class="spacedout-webcam-toggle-option" for="spacedout-webcam-required">
                  <input id="spacedout-webcam-required" name="spacedout-webcam-requirement" type="radio" value="required" checked />
                  <span>Required</span>
                </label>
                <label class="spacedout-webcam-toggle-option" for="spacedout-webcam-optional">
                  <input id="spacedout-webcam-optional" name="spacedout-webcam-requirement" type="radio" value="optional" />
                  <span>Optional (Testing)</span>
                </label>
              </div>
            </div>

            <div id="spacedout-viewport" class="spacedout-viewport">
              <canvas id="spacedout-hud" class="spacedout-hud"></canvas>
              <div id="spacedout-labels" class="spacedout-labels"></div>
              <video id="spacedout-video" autoplay playsinline muted style="display:none"></video>

              <div id="spacedout-overlay" class="spacedout-overlay">
                <div class="spacedout-overlay-card">
                  <p class="text-xs uppercase tracking-[0.25em] text-cyan-300">Bootstrap</p>
                  <h2 id="spacedout-loading-text" class="mt-3 text-2xl font-bold text-white">INITIALIZING FDF MATRIX...</h2>
                </div>
              </div>

              <div id="spacedout-calibration" class="spacedout-screen hidden">
                <div class="spacedout-screen-card">
                  <p class="text-xs uppercase tracking-[0.25em] text-cyan-300">Calibration</p>
                  <h2 class="mt-3 text-3xl font-black text-white">SYSTEM CALIBRATION</h2>
                  <p class="mt-3 text-sm text-slate-300">1. Sit in your neutral flying posture.</p>
                  <p class="mt-2 text-sm text-slate-300">2. Look directly at the center of the screen.</p>
                  <button id="spacedout-calibrate-btn" type="button" disabled class="mt-6 rounded-md border border-cyan-400 bg-transparent px-5 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-cyan-200 hover:bg-cyan-300 hover:text-black disabled:cursor-not-allowed disabled:border-slate-600 disabled:text-slate-500">
                    Calibrate
                  </button>
                </div>
              </div>

              <div id="spacedout-team-screen" class="spacedout-screen hidden">
                <div class="spacedout-screen-card">
                  <p class="text-xs uppercase tracking-[0.25em] text-cyan-300">Faction Select</p>
                  <h2 class="mt-3 text-3xl font-black text-white">CHOOSE FACTION</h2>
                  <div class="mt-6 grid gap-3 sm:grid-cols-2">
                    <button id="spacedout-team-red" type="button" class="rounded-md border border-rose-500 bg-transparent px-4 py-4 text-left text-white hover:bg-rose-500 hover:text-black">
                      <strong class="block text-lg">Quack Slayers (RED)</strong>
                    </button>
                    <button id="spacedout-team-blue" type="button" class="rounded-md border border-blue-500 bg-transparent px-4 py-4 text-left text-white hover:bg-blue-500 hover:text-black">
                      <strong class="block text-lg">QuackSquadron (BLUE)</strong>
                    </button>
                  </div>
                </div>
              </div>

              <div id="spacedout-controls" class="spacedout-hint hidden">
                <strong class="text-white">[ FLIGHT OVERRIDE ]</strong>
                <span>M: Toggle FACE / KEYBOARD</span>
                <span>P: Pause / Resume</span>
                <span>WASD / Arrows: Manual flight backup</span>
                <span>Space: Lasers | Shift / Q: Missile | F: Flares</span>
                <span>Mouse Wheel: Throttle | Ctrl: Airbrake | C: Recalibrate</span>
                <span>B: Back to Lobby | R / V / [ / ] after death</span>
              </div>

              <div id="spacedout-actions" class="spacedout-actions">
                <button id="spacedout-join-btn" type="button" class="spacedout-action-btn spacedout-action-btn-primary">Join</button>
                <button id="spacedout-spectate-btn" type="button" class="spacedout-action-btn">Spectate</button>
              </div>

              <div id="spacedout-speed" class="spacedout-readout spacedout-readout-left hidden">SPD: --</div>
              <div id="spacedout-mode" class="spacedout-readout spacedout-readout-mode hidden">MODE: BOOT</div>
              <div id="spacedout-target" class="spacedout-readout spacedout-readout-target hidden">TARGET HP: --</div>
            </div>
          </div>
        </div>

        <div class="spacedout-middle-row">
          <section id="spacedout-terrain-panel" class="spacedout-panel spacedout-panel-shell rounded-[1.25rem] p-5">
            <div id="spacedout-terrain-overlay" class="spacedout-panel-overlay hidden">The terrain was locked already.</div>
            <div class="spacedout-panel-body">
              <div class="flex items-center justify-between gap-3">
                <h2 class="text-sm font-semibold uppercase tracking-[0.2em] text-sky-300">Terrain Editor</h2>
                <span id="spacedout-terrain-mode" class="rounded-full border border-sky-400/15 bg-slate-950/40 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-slate-300">
                  Awaiting server
                </span>
              </div>
              <div class="mt-4 grid gap-3 sm:grid-cols-2">
                <label class="text-sm text-slate-300">
                  Seed
                  <input id="terrain-seed" type="number" class="mt-2 w-full rounded-xl border border-sky-400/15 bg-slate-950/50 px-3 py-2 text-sm text-white" />
                </label>
                <label class="text-sm text-slate-300">
                  Noise Scale
                  <input id="terrain-noise-scale" type="number" step="0.1" class="mt-2 w-full rounded-xl border border-sky-400/15 bg-slate-950/50 px-3 py-2 text-sm text-white" />
                </label>
                <label class="text-sm text-slate-300">
                  Height Amplitude
                  <input id="terrain-height-amplitude" type="number" step="100" class="mt-2 w-full rounded-xl border border-sky-400/15 bg-slate-950/50 px-3 py-2 text-sm text-white" />
                </label>
                <label class="text-sm text-slate-300">
                  Noise Octaves
                  <input id="terrain-noise-octaves" type="number" step="1" class="mt-2 w-full rounded-xl border border-sky-400/15 bg-slate-950/50 px-3 py-2 text-sm text-white" />
                </label>
                <label class="text-sm text-slate-300">
                  Persistence
                  <input id="terrain-persistence" type="number" step="0.05" class="mt-2 w-full rounded-xl border border-sky-400/15 bg-slate-950/50 px-3 py-2 text-sm text-white" />
                </label>
                <label class="text-sm text-slate-300">
                  Lacunarity
                  <input id="terrain-lacunarity" type="number" step="0.1" class="mt-2 w-full rounded-xl border border-sky-400/15 bg-slate-950/50 px-3 py-2 text-sm text-white" />
                </label>
              </div>
              <div class="mt-4 flex flex-wrap gap-2">
                <button id="terrain-randomize" type="button" class="rounded-full border border-sky-400/20 bg-slate-950/40 px-4 py-2 text-sm text-slate-100 hover:bg-slate-900">
                  New Seed
                </button>
                <button id="terrain-regenerate" type="button" class="rounded-full border border-sky-400/20 bg-slate-950/40 px-4 py-2 text-sm text-slate-100 hover:bg-slate-900">
                  Regenerate
                </button>
                <button id="terrain-finalize" type="button" class="rounded-full bg-sky-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-sky-300">
                  Lock Terrain
                </button>
              </div>
            </div>
          </section>

          <section id="spacedout-match-panel" class="spacedout-panel spacedout-panel-shell rounded-[1.25rem] p-5">
            <div id="spacedout-match-overlay" class="spacedout-panel-overlay hidden">Only the active host can edit match rules.</div>
            <div class="spacedout-panel-body">
              <div class="flex items-center justify-between gap-3">
                <h2 class="text-sm font-semibold uppercase tracking-[0.2em] text-sky-300">Match Rules</h2>
                <span id="spacedout-match-mode" class="rounded-full border border-sky-400/15 bg-slate-950/40 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-slate-300">
                  Awaiting server
                </span>
              </div>
              <div class="mt-4 grid gap-4">
                <label class="text-sm text-slate-300">
                  Game Type
                  <select id="spacedout-game-mode" class="mt-2 w-full rounded-xl border border-sky-400/15 bg-slate-950/50 px-3 py-2 text-sm text-white">
                    <option value="ARCADE">Arcade</option>
                    <option value="PVP">PvP</option>
                  </select>
                </label>
                <label class="spacedout-match-toggle text-sm text-slate-300">
                  <span class="spacedout-match-toggle-copy">
                    <span class="spacedout-match-toggle-title">Enable Bots</span>
                    <span class="spacedout-match-toggle-note">Arcade-only AI opponents for lighter lobbies.</span>
                  </span>
                  <input id="spacedout-bots-enabled" type="checkbox" class="h-5 w-5 rounded border border-sky-400/25 bg-slate-950/50 text-sky-300" />
                </label>
              </div>
            </div>
          </section>

          <section id="spacedout-aim-assist-panel" class="spacedout-panel spacedout-panel-shell rounded-[1.25rem] p-5">
            <div id="spacedout-aim-assist-overlay" class="spacedout-panel-overlay hidden">Only the active host can tune aim assist.</div>
            <div class="spacedout-panel-body">
              <div class="flex items-center justify-between gap-3">
                <h2 class="text-sm font-semibold uppercase tracking-[0.2em] text-sky-300">Laser Aim Assist</h2>
                <span id="spacedout-aim-assist-mode" class="rounded-full border border-sky-400/15 bg-slate-950/40 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-slate-300">
                  Awaiting server
                </span>
              </div>
              <div class="spacedout-aim-assist-grid mt-4">
                <label class="spacedout-aim-assist-control text-sm text-slate-300">
                  <span class="spacedout-aim-assist-control-head">
                    <span>Assist Cone</span>
                    <strong id="aim-assist-cone-value">--</strong>
                  </span>
                  <input id="aim-assist-cone" type="range" min="0.08" max="0.35" step="0.01" />
                </label>
                <label class="spacedout-aim-assist-control text-sm text-slate-300">
                  <span class="spacedout-aim-assist-control-head">
                    <span>Assist Gain</span>
                    <strong id="aim-assist-gain-value">--</strong>
                  </span>
                  <input id="aim-assist-gain" type="range" min="0.02" max="0.28" step="0.01" />
                </label>
                <label class="spacedout-aim-assist-control text-sm text-slate-300">
                  <span class="spacedout-aim-assist-control-head">
                    <span>Max Pull</span>
                    <strong id="aim-assist-max-pull-value">--</strong>
                  </span>
                  <input id="aim-assist-max-pull" type="range" min="0.01" max="0.11" step="0.005" />
                </label>
                <label class="spacedout-aim-assist-control text-sm text-slate-300">
                  <span class="spacedout-aim-assist-control-head">
                    <span>Engage Smoothing</span>
                    <strong id="aim-assist-engage-value">--</strong>
                  </span>
                  <input id="aim-assist-engage" type="range" min="2" max="24" step="1" />
                </label>
                <label class="spacedout-aim-assist-control text-sm text-slate-300">
                  <span class="spacedout-aim-assist-control-head">
                    <span>Release Smoothing</span>
                    <strong id="aim-assist-release-value">--</strong>
                  </span>
                  <input id="aim-assist-release" type="range" min="2" max="24" step="1" />
                </label>
              </div>
            </div>
          </section>
        </div>

        <div class="spacedout-roster-row">
          <section class="spacedout-panel rounded-[1.25rem] p-5">
            <div class="flex items-center justify-between gap-3">
              <h2 class="text-sm font-semibold uppercase tracking-[0.2em] text-sky-300">Players In Server</h2>
              <span class="rounded-full border border-cyan-400/15 bg-slate-950/40 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-slate-300">
                Red | Spectators | Blue
              </span>
            </div>
            <div id="spacedout-player-list" class="spacedout-player-list mt-4"></div>
          </section>
        </div>

        <div class="spacedout-bottom-row">
          <section class="spacedout-panel rounded-[1.25rem] p-5">
            <h2 class="text-sm font-semibold uppercase tracking-[0.2em] text-sky-300">Telemetry</h2>
            <div id="spacedout-telemetry" class="spacedout-telemetry mt-4"></div>
          </section>

          <section class="spacedout-panel rounded-[1.25rem] p-5">
            <h2 class="text-sm font-semibold uppercase tracking-[0.2em] text-sky-300">Event Log</h2>
            <ol id="spacedout-logs" class="spacedout-log-list mt-4"></ol>
          </section>
        </div>
      </section>
    `;

    this.element.appendChild(content);
    this.mountJoinTransitionOverlay();
    void this.bootstrap(content);
  }

  private async bootstrap(content: HTMLElement): Promise<void> {
    const viewport = content.querySelector<HTMLElement>("#spacedout-viewport");
    const hudCanvas =
      content.querySelector<HTMLCanvasElement>("#spacedout-hud");
    const labelsMount = content.querySelector<HTMLElement>("#spacedout-labels");
    const videoElement =
      content.querySelector<HTMLVideoElement>("#spacedout-video");
    const logsMount = content.querySelector<HTMLElement>("#spacedout-logs");
    const statusMount = content.querySelector<HTMLElement>("#spacedout-status");
    const wsUrlMount = content.querySelector<HTMLElement>("#spacedout-ws-url");
    const playerListMount = content.querySelector<HTMLElement>("#spacedout-player-list");
    const telemetryMount = content.querySelector<HTMLElement>(
      "#spacedout-telemetry",
    );
    const loadingOverlay =
      content.querySelector<HTMLElement>("#spacedout-overlay");
    const loadingText = content.querySelector<HTMLElement>(
      "#spacedout-loading-text",
    );
    const calibrationScreen = content.querySelector<HTMLElement>(
      "#spacedout-calibration",
    );
    const calibrateButton = content.querySelector<HTMLButtonElement>(
      "#spacedout-calibrate-btn",
    );
    const teamScreen = content.querySelector<HTMLElement>(
      "#spacedout-team-screen",
    );
    const redTeamButton = content.querySelector<HTMLButtonElement>(
      "#spacedout-team-red",
    );
    const blueTeamButton = content.querySelector<HTMLButtonElement>(
      "#spacedout-team-blue",
    );
    const controlsHint = content.querySelector<HTMLElement>(
      "#spacedout-controls",
    );
    const actionButtons = content.querySelector<HTMLElement>("#spacedout-actions");
    const joinButton = content.querySelector<HTMLButtonElement>("#spacedout-join-btn");
    const spectateButton = content.querySelector<HTMLButtonElement>("#spacedout-spectate-btn");
    const speedReadout = content.querySelector<HTMLElement>("#spacedout-speed");
    const modeReadout = content.querySelector<HTMLElement>("#spacedout-mode");
    const targetReadout =
      content.querySelector<HTMLElement>("#spacedout-target");
    const terrainEditorPanel = content.querySelector<HTMLElement>(
      "#spacedout-terrain-panel",
    );
    const terrainEditorOverlay = content.querySelector<HTMLElement>(
      "#spacedout-terrain-overlay",
    );
    const terrainMode = content.querySelector<HTMLElement>(
      "#spacedout-terrain-mode",
    );
    const terrainSeed =
      content.querySelector<HTMLInputElement>("#terrain-seed");
    const terrainNoiseScale = content.querySelector<HTMLInputElement>(
      "#terrain-noise-scale",
    );
    const terrainHeightAmplitude = content.querySelector<HTMLInputElement>(
      "#terrain-height-amplitude",
    );
    const terrainNoiseOctaves = content.querySelector<HTMLInputElement>(
      "#terrain-noise-octaves",
    );
    const terrainPersistence = content.querySelector<HTMLInputElement>(
      "#terrain-persistence",
    );
    const terrainLacunarity = content.querySelector<HTMLInputElement>(
      "#terrain-lacunarity",
    );
    const terrainRandomize =
      content.querySelector<HTMLButtonElement>("#terrain-randomize");
    const terrainRegenerate = content.querySelector<HTMLButtonElement>(
      "#terrain-regenerate",
    );
    const terrainFinalize =
      content.querySelector<HTMLButtonElement>("#terrain-finalize");
    const matchSettingsPanel = content.querySelector<HTMLElement>(
      "#spacedout-match-panel",
    );
    const matchSettingsOverlay = content.querySelector<HTMLElement>(
      "#spacedout-match-overlay",
    );
    const matchSettingsMode = content.querySelector<HTMLElement>(
      "#spacedout-match-mode",
    );
    const gameModeSelect = content.querySelector<HTMLSelectElement>(
      "#spacedout-game-mode",
    );
    const botsEnabledInput = content.querySelector<HTMLInputElement>(
      "#spacedout-bots-enabled",
    );
    const aimAssistPanel = content.querySelector<HTMLElement>(
      "#spacedout-aim-assist-panel",
    );
    const aimAssistOverlay = content.querySelector<HTMLElement>(
      "#spacedout-aim-assist-overlay",
    );
    const aimAssistMode = content.querySelector<HTMLElement>(
      "#spacedout-aim-assist-mode",
    );
    const aimAssistCone = content.querySelector<HTMLInputElement>(
      "#aim-assist-cone",
    );
    const aimAssistConeValue = content.querySelector<HTMLElement>(
      "#aim-assist-cone-value",
    );
    const aimAssistGain = content.querySelector<HTMLInputElement>(
      "#aim-assist-gain",
    );
    const aimAssistGainValue = content.querySelector<HTMLElement>(
      "#aim-assist-gain-value",
    );
    const aimAssistMaxPull = content.querySelector<HTMLInputElement>(
      "#aim-assist-max-pull",
    );
    const aimAssistMaxPullValue = content.querySelector<HTMLElement>(
      "#aim-assist-max-pull-value",
    );
    const aimAssistEngage = content.querySelector<HTMLInputElement>(
      "#aim-assist-engage",
    );
    const aimAssistEngageValue = content.querySelector<HTMLElement>(
      "#aim-assist-engage-value",
    );
    const aimAssistRelease = content.querySelector<HTMLInputElement>(
      "#aim-assist-release",
    );
    const aimAssistReleaseValue = content.querySelector<HTMLElement>(
      "#aim-assist-release-value",
    );
    const webcamRequiredInput = content.querySelector<HTMLInputElement>(
      "#spacedout-webcam-required",
    );
    const webcamOptionalInput = content.querySelector<HTMLInputElement>(
      "#spacedout-webcam-optional",
    );

    if (
      !viewport ||
      !hudCanvas ||
      !labelsMount ||
      !videoElement ||
      !logsMount ||
      !statusMount ||
      !wsUrlMount ||
      !playerListMount ||
      !telemetryMount ||
      !loadingOverlay ||
      !loadingText ||
      !calibrationScreen ||
      !calibrateButton ||
      !teamScreen ||
      !redTeamButton ||
      !blueTeamButton ||
      !controlsHint ||
      !actionButtons ||
      !joinButton ||
      !spectateButton ||
      !speedReadout ||
      !modeReadout ||
      !targetReadout ||
      !terrainEditorPanel ||
      !terrainEditorOverlay ||
      !terrainMode ||
      !terrainSeed ||
      !terrainNoiseScale ||
      !terrainHeightAmplitude ||
      !terrainNoiseOctaves ||
      !terrainPersistence ||
      !terrainLacunarity ||
      !terrainRandomize ||
      !terrainRegenerate ||
      !terrainFinalize ||
      !matchSettingsPanel ||
      !matchSettingsOverlay ||
      !matchSettingsMode ||
      !gameModeSelect ||
      !botsEnabledInput ||
      !aimAssistPanel ||
      !aimAssistOverlay ||
      !aimAssistMode ||
      !aimAssistCone ||
      !aimAssistConeValue ||
      !aimAssistGain ||
      !aimAssistGainValue ||
      !aimAssistMaxPull ||
      !aimAssistMaxPullValue ||
      !aimAssistEngage ||
      !aimAssistEngageValue ||
      !aimAssistRelease ||
      !aimAssistReleaseValue ||
      !webcamRequiredInput ||
      !webcamOptionalInput
    ) {
      throw new Error("SpacedOut page failed to mount required elements.");
    }

    try {
      const session = await SpacedOutService.createSession();
      if (!this.isMounted) {
        return;
      }
      wsUrlMount.textContent = session.wsUrl;

      this.game = new SpacedOutGame({
        mount: viewport,
        hudCanvas,
        labelsMount,
        videoElement,
        logsMount,
        statusMount,
        playerListMount,
        telemetryMount,
        loadingOverlay,
        loadingText,
        calibrationScreen,
        calibrateButton,
        teamScreen,
        redTeamButton,
        blueTeamButton,
        controlsHint,
        actionButtons,
        joinButton,
        spectateButton,
        speedReadout,
        modeReadout,
        targetReadout,
        terrainEditorPanel,
        terrainEditorOverlay,
        terrainMode,
        terrainSeed,
        terrainNoiseScale,
        terrainHeightAmplitude,
        terrainNoiseOctaves,
        terrainPersistence,
        terrainLacunarity,
        terrainRandomize,
        terrainRegenerate,
        terrainFinalize,
        matchSettingsPanel,
        matchSettingsOverlay,
        matchSettingsMode,
        gameModeSelect,
        botsEnabledInput,
        aimAssistPanel,
        aimAssistOverlay,
        aimAssistMode,
        aimAssistCone,
        aimAssistConeValue,
        aimAssistGain,
        aimAssistGainValue,
        aimAssistMaxPull,
        aimAssistMaxPullValue,
        aimAssistEngage,
        aimAssistEngageValue,
        aimAssistRelease,
        aimAssistReleaseValue,
        webcamRequiredInput,
        webcamOptionalInput,
        session,
        onJoinSequenceRequest: async () => this.runJoinSequence(),
        onLobbyRestoreRequest: () => this.restoreLobbyView(),
      });
      this.game.start();
    } catch (error: any) {
      statusMount.textContent =
        "Failed to create an authenticated SpacedOut session.";
      loadingText.textContent = "Session bootstrap failed.";
      logsMount.innerHTML = `<li class="spacedout-log spacedout-log-error">${escapeHtml(error?.message || "Unknown SpacedOut session error.")}</li>`;
    }
  }

  public onDestroy(): void {
    this.isMounted = false;
    this.destroyOwnedUi();
    this.game?.destroy();
    this.game = null;
    this.joinTransition?.destroy();
    this.joinTransition = null;
    this.joinTransitionPlay = null;
  }

  private destroyOwnedUi(): void {
    this.navbar?.onDestroy();
    this.navbar = null;
  }

  private mountJoinTransitionOverlay(): void {
    const overlay = document.createElement("div");
    overlay.className = "spacedout-transition-overlay";
    overlay.innerHTML = `
      <div class="spacedout-transition-copy">
        <p class="spacedout-transition-kicker">Jump Corridor</p>
        <h2 id="spacedout-transition-title" class="spacedout-transition-title">Stabilizing Star Field</h2>
      </div>
    `;
    this.element.appendChild(overlay);

    const title = overlay.querySelector<HTMLElement>("#spacedout-transition-title");
    if (!title) {
      return;
    }

    this.joinTransition = new JoinWarpTransition({
      mount: overlay,
      onPhaseChange: (phase) => {
        if (phase === "fade") {
          title.textContent = "Stabilizing Star Field";
        } else if (phase === "warp") {
          title.textContent = "Engaging Warp Corridor";
        } else {
          title.textContent = "Deploying Flight Interface";
        }
      },
    });
  }

  private async runJoinSequence(): Promise<void> {
    if (this.element.classList.contains("spacedout-shell-fullscreen")) {
      return;
    }

    if (this.joinTransitionPlay) {
      return this.joinTransitionPlay;
    }

    const overlay = this.element.querySelector<HTMLElement>(".spacedout-transition-overlay");
    if (!overlay || !this.joinTransition) {
      this.element.classList.add("spacedout-shell-fullscreen");
      window.dispatchEvent(new Event("resize"));
      return;
    }

    this.element.classList.add("spacedout-shell-transitioning");
    overlay.classList.add("is-active");
    this.joinTransition.resize();

    this.joinTransitionPlay = this.joinTransition.play().then(() => {
      if (!this.isMounted) {
        return;
      }

      this.element.classList.add("spacedout-shell-fullscreen");
      window.dispatchEvent(new Event("resize"));

      window.setTimeout(() => {
        overlay.classList.remove("is-active");
        this.element.classList.remove("spacedout-shell-transitioning");
      }, 120);
    }).finally(() => {
      this.joinTransitionPlay = null;
    });

    return this.joinTransitionPlay;
  }

  private restoreLobbyView(): void {
    this.joinTransitionPlay = null;

    const overlay = this.element.querySelector<HTMLElement>(
      ".spacedout-transition-overlay",
    );
    overlay?.classList.remove("is-active");

    this.element.classList.remove("spacedout-shell-transitioning");
    this.element.classList.remove("spacedout-shell-fullscreen");

    this.joinTransition?.resize();
    window.requestAnimationFrame(() => {
      window.dispatchEvent(new Event("resize"));
    });
  }
}
