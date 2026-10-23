import * as THREE from "three";
import type { GameMode, MatchSettings, TerrainConfig } from "./types";

export const WORLD_RADIUS = 50000;
export const TELEMETRY_INTERVAL_MS = 80;
export const RADAR_MAX_RANGE = 30000;
export const SCALE_Z = 4;
export const DEFAULT_FLIGHT_SPEED = 220;

export const DEFAULT_TERRAIN_CONFIG: TerrainConfig = {
  seed: 44897,
  noiseScale: 4,
  heightAmplitude: 2000,
  noiseOctaves: 4,
  persistence: 0.2,
  lacunarity: 2.5,
};

export const DEFAULT_MATCH_SETTINGS: MatchSettings = {
  gameMode: "ARCADE",
  botsEnabled: true,
};

export type TeamName = "RED" | "BLUE" | "SPECTATOR";
export type CameraMode = "PLAYER" | "TERRAIN" | "DEATH" | "SPECTATOR";
export type ControlMode = "FACE" | "KEYBOARD";

export interface RemotePilotState {
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

export function normalizeTeamName(value: unknown): TeamName {
  const upper = String(value || "SPECTATOR").toUpperCase();
  return upper === "BLUE" ? "BLUE" : upper === "RED" ? "RED" : "SPECTATOR";
}

export function normalizeGameMode(value: unknown): GameMode {
  return String(value || "").toUpperCase() === "PVP" ? "PVP" : "ARCADE";
}

export function quaternionFromPose(
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
