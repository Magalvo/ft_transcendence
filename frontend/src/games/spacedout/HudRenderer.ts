import * as THREE from "three";
import {
  RADAR_MAX_RANGE,
  type RemotePilotState,
  type TeamName,
} from "./SpacedOutGameShared";

interface HudRendererOptions {
  hudCanvas: HTMLCanvasElement;
}

interface HudRenderState {
  speed: number;
  radarAltitude: number;
  altitude: number;
  rigPitch: number;
  shipRoll: number;
  aimX: number;
  aimY: number;
  aimZ: number;
  isLockedOn: boolean;
  lockProgress: number;
  isBeingTracked: boolean;
  flareCooldown: number;
  faceLost: boolean;
  targetScreenX: number;
  targetScreenY: number;
  localServerPosition: THREE.Vector3;
  localForward: THREE.Vector3;
  localTeam: TeamName;
  remotePilots: Iterable<RemotePilotState>;
  getEarthAnchorUpFromLocalPosition: (position: THREE.Vector3) => THREE.Vector3;
  getEarthAnchorDistanceFromLocalPosition: (position: THREE.Vector3) => number;
  getEarthAnchorDistanceFromWorldPosition: (position: THREE.Vector3) => number;
  worldRadius: number;
}

export class HudRenderer {
  private readonly hudCanvas: HTMLCanvasElement;
  private readonly tempA = new THREE.Vector3();
  private readonly tempB = new THREE.Vector3();

  public constructor(options: HudRendererOptions) {
    this.hudCanvas = options.hudCanvas;
  }

  public render(state: HudRenderState): void {
    const context = this.hudCanvas.getContext("2d");
    if (!context) {
      return;
    }

    const width = this.hudCanvas.width;
    const height = this.hudCanvas.height;
    const centerX = width / 2;
    const centerY = height / 2;

    context.strokeStyle = state.isLockedOn
      ? "rgba(255, 0, 85, 0.8)"
      : "rgba(0, 255, 204, 0.8)";
    context.fillStyle = context.strokeStyle;
    context.shadowColor = state.isLockedOn ? "#ff0055" : "#00ffcc";
    context.shadowBlur = 8;
    context.lineWidth = 2;
    context.textBaseline = "middle";

    if (state.aimZ < 1) {
      context.beginPath();
      context.arc(state.aimX, state.aimY, 35, 0, Math.PI * 2);
      context.moveTo(state.aimX - 50, state.aimY);
      context.lineTo(state.aimX - 20, state.aimY);
      context.moveTo(state.aimX + 20, state.aimY);
      context.lineTo(state.aimX + 50, state.aimY);
      context.moveTo(state.aimX, state.aimY - 50);
      context.lineTo(state.aimX, state.aimY - 20);
      context.stroke();

      context.shadowColor = "#ff0055";
      context.fillStyle = "#ff0055";
      context.beginPath();
      context.arc(state.aimX, state.aimY, 3, 0, Math.PI * 2);
      context.fill();
      context.shadowColor = "#00ffcc";
      context.fillStyle = "rgba(0, 255, 204, 0.8)";
    }

    if (state.isLockedOn) {
      const size = 40 - state.lockProgress * 15;
      const color = state.lockProgress >= 1 ? "#ff0055" : "#ffcc00";
      context.strokeStyle = color;
      context.shadowColor = color;
      context.strokeRect(
        state.targetScreenX - size / 2,
        state.targetScreenY - size / 2,
        size,
        size,
      );
      if (state.lockProgress >= 1) {
        context.font = 'bold 14px "Courier New"';
        context.fillStyle = "#ff0055";
        context.fillText("LOCK", state.targetScreenX, state.targetScreenY + 35);
      }
    }

    if (state.isBeingTracked && Date.now() % 500 < 250) {
      context.font = 'bold 36px "Courier New"';
      context.fillStyle = "#ff0055";
      context.textAlign = "center";
      context.fillText("WARNING: MISSILE LOCK", centerX, centerY + 120);
    }

    if (state.faceLost) {
      context.fillStyle = "#ffcc00";
      context.shadowColor = "#ffcc00";
      context.textAlign = "center";
      context.font = 'bold 28px "Courier New"';
      context.fillText("FACE SIGNAL LOST", centerX, centerY - 120);
      context.font = 'bold 16px "Courier New"';
      context.fillText(
        "RE-CENTER IN THE CAMERA OR PRESS M FOR KEYBOARD",
        centerX,
        centerY - 90,
      );
      context.shadowColor = "#00ffcc";
    }

    context.font = 'bold 16px "Courier New"';
    context.fillStyle = state.flareCooldown <= 0 ? "#00ffcc" : "#555555";
    context.textAlign = "left";
    context.fillText(
      `FLARES: ${state.flareCooldown <= 0 ? "READY" : "RELOADING"}`,
      20,
      height - 60,
    );

    context.save();
    context.translate(centerX, centerY);
    context.rotate(-state.shipRoll);
    context.translate(0, state.rigPitch * (height / Math.PI));
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
    context.fillText(String(Math.round(state.speed * 100)), 85, centerY);

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
      String(Math.max(0, Math.round(state.radarAltitude))),
      width - 85,
      centerY,
    );
    context.font = 'bold 12px "Courier New"';
    context.fillText(
      `MSL ${Math.max(0, Math.round(state.altitude))}`,
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

    const playerUp = state.getEarthAnchorUpFromLocalPosition(
      state.localServerPosition,
    );
    const radarRight = new THREE.Vector3()
      .crossVectors(state.localForward, playerUp)
      .normalize();
    const radarForward = new THREE.Vector3()
      .crossVectors(playerUp, radarRight)
      .normalize();
    const playerAltitude =
      state.getEarthAnchorDistanceFromLocalPosition(state.localServerPosition) -
      state.worldRadius;

    for (const pilot of state.remotePilots) {
      if (!pilot.mesh.visible) {
        continue;
      }

      pilot.mesh.getWorldPosition(this.tempA);
      this.tempB.subVectors(this.tempA, state.localServerPosition);
      const distance = this.tempB.length();
      if (distance > RADAR_MAX_RANGE) {
        continue;
      }

      const x = radarCx + this.tempB.dot(radarRight) * radarScale;
      const y = radarCy - this.tempB.dot(radarForward) * radarScale;
      const color = pilot.team === state.localTeam ? "#0088ff" : "#ff0055";
      context.fillStyle = color;
      context.beginPath();
      context.arc(x, y, 4, 0, Math.PI * 2);
      context.fill();
      const altitudeDelta =
        state.getEarthAnchorDistanceFromWorldPosition(this.tempA) -
        state.worldRadius -
        playerAltitude;
      context.strokeStyle = color;
      context.beginPath();
      context.moveTo(x, y);
      if (altitudeDelta > 400) context.lineTo(x, y - 12);
      else if (altitudeDelta < -400) context.lineTo(x, y + 12);
      context.stroke();
    }

    context.restore();
  }
}
