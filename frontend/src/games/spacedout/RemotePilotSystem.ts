import * as THREE from "three";
import {
  DEFAULT_FLIGHT_SPEED,
  TELEMETRY_INTERVAL_MS,
  normalizeTeamName,
  quaternionFromPose,
  type RemotePilotState,
  type TeamName,
} from "./SpacedOutGameShared";
import { ShipFactory } from "./ShipFactory";

export class RemotePilotSystem {
  public readonly pilots = new Map<string, RemotePilotState>();
  private readonly earthAnchor: THREE.Group;
  private readonly labelsMount: HTMLElement;

  public constructor(earthAnchor: THREE.Group, labelsMount: HTMLElement) {
    this.earthAnchor = earthAnchor;
    this.labelsMount = labelsMount;
  }

  public get(id: string): RemotePilotState | undefined {
    return this.pilots.get(id);
  }

  public clear(): void {
    this.pilots.forEach((pilot) => {
      pilot.label.remove();
      this.earthAnchor.remove(pilot.mesh);
    });
    this.pilots.clear();
  }

  public applySnapshot(
    id: string,
    snapshot: Record<string, unknown>,
    myPilotId: string | null,
  ): RemotePilotState | null {
    if (!id || id === myPilotId) {
      return null;
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
    const pilot = this.ensurePilot(id, username, team);
    const now = performance.now();
    const elapsedSeconds =
      pilot.lastSnapshotAt === null
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
    pilot.hp = Number(snapshot.hp) || 100;
    pilot.team = team;
    pilot.username = username;
    pilot.mesh.visible = !Boolean(snapshot.dead);
    pilot.label.textContent = username;
    ShipFactory.applyTeamColor(pilot.mesh, team);
    return pilot;
  }

  public setIdentity(id: string, username: unknown): void {
    const pilot = this.pilots.get(id);
    if (!pilot || typeof username !== "string") {
      return;
    }
    pilot.username = username;
    pilot.label.textContent = username;
  }

  public remove(id: string): void {
    const pilot = this.pilots.get(id);
    if (!pilot) {
      return;
    }
    pilot.label.remove();
    this.earthAnchor.remove(pilot.mesh);
    this.pilots.delete(id);
  }

  public update(): void {
    this.pilots.forEach((pilot) => {
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

  public hasSpectatablePilots(): boolean {
    return [...this.pilots.values()].some((pilot) => pilot.mesh.visible);
  }

  public getSpectatorTargetIds(): string[] {
    return [...this.pilots.entries()]
      .filter(([, pilot]) => pilot.mesh.visible)
      .map(([id]) => id)
      .sort((left, right) => Number(left) - Number(right));
  }

  private ensurePilot(
    id: string,
    username: string,
    team: TeamName,
  ): RemotePilotState {
    const existing = this.pilots.get(id);
    if (existing) {
      return existing;
    }

    const mesh = ShipFactory.createPilotShip(team);
    mesh.scale.set(3, 3, 3);
    this.earthAnchor.add(mesh);

    const label = document.createElement("div");
    label.className = "spacedout-contact-label";
    label.textContent = username;
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
    this.pilots.set(id, state);
    return state;
  }
}
