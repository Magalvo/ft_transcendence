import * as THREE from "three";
import type { SpacedOutSocketClient } from "./SpacedOutSocketClient";
import type { AudioManager } from "./AudioManager";

const GLOBE_RADIUS = 50000;
const SCALE_Z = 4;
const LASER_SPEED = 9000;
const DEFAULT_SHIP_SPEED = 3960;
const MISSILE_PROXIMITY_FUSE_RADIUS = 100;
const MISSILE_TERMINAL_GUIDANCE_RADIUS = 2500;
const LOCK_ON_DURATION_MS = 1500;
const LOCK_DECAY_PER_SECOND = 2000;
const FLARE_COOLDOWN_MS = 5000;

interface TargetablePilot {
  mesh: THREE.Group;
  team: string;
  velocity: THREE.Vector3;
}

export interface CombatState {
  aimX: number;
  aimY: number;
  aimZ: number;
  isLockedOn: boolean;
  lockProgress: number;
  isBeingTracked: boolean;
  flareCooldown: number;
  targetScreenX: number;
  targetScreenY: number;
  magnetismYaw: number;
  magnetismPitch: number;
  lockedEnemyId: string | null;
}

export class CombatManager {
  private earthAnchor: THREE.Group;
  private terrainGroup: THREE.Group;
  private socketClient: SpacedOutSocketClient;
  private audio: AudioManager;

  // State Arrays
  private lasers: THREE.Mesh[] = [];
  private missiles: THREE.Mesh[] = [];
  private activeFlares: THREE.Mesh[] = [];
  private explosions: THREE.Mesh[] = [];
  private fireParticles: THREE.Mesh[] = [];
  public debrisParticles: THREE.Mesh[] = []; // Public so DeathCam can access fuselage

  // Geometries & Materials
  private laserGeo = new THREE.CylinderGeometry(0.5, 0.5, 50, 30).rotateX(Math.PI / 2);
  private laserMat = new THREE.MeshBasicMaterial({ color: 0xc3352b });
  private missileGeo = new THREE.CylinderGeometry(1, 1, 10, 10).rotateX(Math.PI / 2);
  private missileMat = new THREE.MeshBasicMaterial({ color: 0xf27d0c });
  private fireGeoLarge = new THREE.IcosahedronGeometry(12, 1);
  private fireGeoSmall = new THREE.IcosahedronGeometry(3, 0);
  private fireGeoFlare = new THREE.IcosahedronGeometry(5, 0);
  
  private matSmokeDark = new THREE.MeshBasicMaterial({ color: 0x222222, transparent: true, opacity: 0.8 });
  private matFireOrange = new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.8 });
  private matSmokeLight = new THREE.MeshBasicMaterial({ color: 0xcccccc, transparent: true, opacity: 0.8 });
  private matFlareBright = new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.9 });

  // Combat State
  private lockTimerMs = 0;
  private lockedEnemyId: string | null = null;
  public flareCooldownMs = 0;
  
  // Raycaster for line-of-sight
  private losRaycaster = new THREE.Raycaster();

  constructor(
    earthAnchor: THREE.Group, 
    terrainGroup: THREE.Group,
    socketClient: SpacedOutSocketClient,
    audio: AudioManager
  ) {
    this.earthAnchor = earthAnchor;
    this.terrainGroup = terrainGroup;
    this.socketClient = socketClient;
    this.audio = audio;
  }

  // ==========================================
  // WEAPON FIRING
  // ==========================================

  public fireLasers(playerRig: THREE.Group, playerShip: THREE.Group): void {
    const leftWing = new THREE.Vector3(-3.5, -0.2, 2);
    const rightWing = new THREE.Vector3(3.5, -0.2, 2);

    playerShip.localToWorld(leftWing);
    playerShip.localToWorld(rightWing);

    const laser1 = new THREE.Mesh(this.laserGeo, this.laserMat);
    const laser2 = new THREE.Mesh(this.laserGeo, this.laserMat);

    playerRig.add(laser1);
    playerRig.add(laser2);

    playerRig.worldToLocal(leftWing);
    playerRig.worldToLocal(rightWing);

    laser1.position.copy(leftWing);
    laser2.position.copy(rightWing);
    laser1.position.z -= 5;
    laser2.position.z -= 5;

    laser1.userData = { distanceTraveled: 0 };
    laser2.userData = { distanceTraveled: 0 };

    this.earthAnchor.attach(laser1);
    this.earthAnchor.attach(laser2);

    this.lasers.push(laser1, laser2);

    this.socketClient.sendJson({ type: "fireShot" });
    this.audio.playLaserSound();
  }

  public fireMissile(playerShip: THREE.Group, currentSpeed: number): void {
    if (this.lockTimerMs < LOCK_ON_DURATION_MS || !this.lockedEnemyId) return;

    const missile = new THREE.Mesh(this.missileGeo, this.missileMat);
    const spawnPos = new THREE.Vector3(0, -2, 0);
    playerShip.localToWorld(spawnPos);
    missile.position.copy(spawnPos);

    missile.quaternion.copy(playerShip.getWorldQuaternion(new THREE.Quaternion()));

    this.earthAnchor.attach(missile);
    missile.userData = {
      targetId: this.lockedEnemyId,
      speed: currentSpeed + 5,
      distanceTraveled: 0,
    };

    this.missiles.push(missile);

    this.socketClient.sendJson({ type: "missileFired", targetId: this.lockedEnemyId });
    this.audio.playMissileLaunchSound();

    this.lockTimerMs = 0;
  }

  public deployFlares(ship: THREE.Group, isLocalPlayer: boolean): void {
    if (isLocalPlayer) {
      if (this.flareCooldownMs > 0) return;
      this.flareCooldownMs = FLARE_COOLDOWN_MS;
      this.socketClient.sendJson({ type: "deployFlares" });
    }

    for (let i = 0; i < 6; i++) {
      const flare = new THREE.Mesh(
        new THREE.IcosahedronGeometry(4, 0),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1 })
      );

      const worldPos = new THREE.Vector3();
      ship.getWorldPosition(worldPos);
      this.earthAnchor.worldToLocal(worldPos);
      flare.position.copy(worldPos);

      const shipQuat = new THREE.Quaternion();
      ship.getWorldQuaternion(shipQuat);
      const backward = new THREE.Vector3((Math.random() - 0.5) * 2, -1, 1.5).normalize();
      backward.applyQuaternion(shipQuat);

      flare.userData = {
        velocity: backward.multiplyScalar(8 + Math.random() * 5),
        life: 120, // 2 seconds
      };

      this.earthAnchor.add(flare);
      this.activeFlares.push(flare);
    }

    ship.userData.flareActiveUntil = Date.now() + 3000;
  }

  // ==========================================
  // DEBRIS & EXPLOSIONS
  // ==========================================

  public spawnExplosion(worldPos: THREE.Vector3): void {
    const expGeo = new THREE.IcosahedronGeometry(1, 5);
    const expMat = new THREE.MeshBasicMaterial({ color: 0xffd580, wireframe: false, transparent: true, opacity: 1 });
    const explosion = new THREE.Mesh(expGeo, expMat);
    
    const localPos = this.earthAnchor.worldToLocal(worldPos.clone());
    explosion.position.copy(localPos);
    
    this.earthAnchor.add(explosion);
    this.explosions.push(explosion);
    this.audio.playExplosionSound();
  }

  public spawnDebris(deadShip: THREE.Group, isMe: boolean, originalId: string): THREE.Mesh | null {
    let localFuselageDebris: THREE.Mesh | null = null;
    let localFallbackDebris: THREE.Mesh | null = null;
    const deadShipPos = new THREE.Vector3();
    const deadShipQuat = new THREE.Quaternion();
    deadShip.getWorldPosition(deadShipPos);
    deadShip.getWorldQuaternion(deadShipQuat);
    this.earthAnchor.worldToLocal(deadShipPos);

    deadShip.children.forEach((part) => {
      if (part.type !== "Mesh" && part.type !== "Group") return;

      const debris = part.clone() as THREE.Mesh;
      const worldPos = new THREE.Vector3();
      const worldQuat = new THREE.Quaternion();
      const worldScale = new THREE.Vector3();

      part.getWorldPosition(worldPos);
      part.getWorldQuaternion(worldQuat);
      part.getWorldScale(worldScale);

      this.earthAnchor.worldToLocal(worldPos);
      debris.position.copy(worldPos);
      debris.quaternion.copy(worldQuat);
      debris.scale.copy(worldScale);

      debris.traverse((child) => {
        if ((child as THREE.Mesh).isMesh && (child as THREE.Mesh).material) {
          const meshChild = child as THREE.Mesh;
          meshChild.material = (meshChild.material as THREE.Material).clone();
          meshChild.material.transparent = true;
        }
      });

      const burstDir = new THREE.Vector3().subVectors(debris.position, deadShipPos).normalize();
      const velocity = burstDir.multiplyScalar(8 + Math.random() * 12);
      
const forward = new THREE.Vector3(0, 0, -20);
      forward.applyQuaternion(deadShipQuat);
      velocity.add(forward);
      velocity.add(
        deadShipPos.clone().normalize().multiplyScalar(-8),
      );

      debris.userData = {
        velocity,
        rotSpeed: new THREE.Vector3((Math.random() - 0.5) * 0.12, (Math.random() - 0.5) * 0.12, (Math.random() - 0.5) * 0.12),
        isFuselage: !!(part.userData && part.userData.isFuselage),
        isMe,
        originalId,
        burnUntil: Date.now() + 14000,
        expiresAt: Date.now() + 18000,
      };

      this.earthAnchor.add(debris);
      this.debrisParticles.push(debris);

      if (isMe && !localFallbackDebris) localFallbackDebris = debris;
      if (isMe && debris.userData.isFuselage && !localFuselageDebris) localFuselageDebris = debris;
    });

    return localFuselageDebris || localFallbackDebris;
  }

  public clearOwnDebris(): void {
    for (let i = this.debrisParticles.length - 1; i >= 0; i--) {
      const d = this.debrisParticles[i];
      if (d.userData.isMe) {
        this.disposeDetachedMaterials(d);
        this.earthAnchor.remove(d);
        this.debrisParticles.splice(i, 1);
      }
    }
  }

  // ==========================================
  // REMOTE MULTIPLAYER SPAWNS
  // ==========================================

  public handleRemoteShot(shooter: THREE.Group): void {
    if (!shooter || !shooter.visible) return;
    
    const leftWing = new THREE.Vector3(-3.5, -0.2, 2);
    const rightWing = new THREE.Vector3(3.5, -0.2, 2);
    shooter.localToWorld(leftWing);
    shooter.localToWorld(rightWing);
    this.earthAnchor.worldToLocal(leftWing);
    this.earthAnchor.worldToLocal(rightWing);

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(shooter.quaternion).normalize();

    const spawnLaser = (pos: THREE.Vector3) => {
      const laser = new THREE.Mesh(this.laserGeo, this.laserMat);
      laser.position.copy(pos);
      laser.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), forward);
      laser.userData = { distanceTraveled: 0 };
      this.earthAnchor.add(laser);
      this.lasers.push(laser);
    };

    spawnLaser(leftWing);
    spawnLaser(rightWing);
    this.audio.playLaserSound();
  }

  public handleRemoteShotFromPose(origin: THREE.Vector3, forward: THREE.Vector3): void {
    const anchorWorldPos = this.earthAnchor.getWorldPosition(new THREE.Vector3());
    const up = origin.clone().sub(anchorWorldPos).normalize();
    const right = new THREE.Vector3().crossVectors(forward, up).normalize();
    const leftWing = origin.clone().addScaledVector(right, -10);
    const rightWing = origin.clone().addScaledVector(right, 10);

    const spawnLaser = (pos: THREE.Vector3) => {
      const localPos = this.earthAnchor.worldToLocal(pos.clone());
      const laser = new THREE.Mesh(this.laserGeo, this.laserMat);
      laser.position.copy(localPos);
      laser.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 0, -1),
        forward.clone().normalize(),
      );
      laser.userData = { distanceTraveled: 0 };
      this.earthAnchor.add(laser);
      this.lasers.push(laser);
    };

    spawnLaser(leftWing);
    spawnLaser(rightWing);
    this.audio.playLaserSound();
  }

  public handleRemoteMissile(spawnPos: THREE.Vector3, dir: THREE.Vector3, targetId: string, speed: number): void {
    const missile = new THREE.Mesh(this.missileGeo, this.missileMat);
    missile.position.copy(spawnPos);

    if (dir.lengthSq() > 1e-8) {
      missile.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), dir.normalize());
    }

    missile.userData = {
      targetId,
      speed: speed || 80,
      distanceTraveled: 0,
    };

    this.earthAnchor.add(missile);
    this.missiles.push(missile);
    this.audio.playMissileLaunchSound();
  }

  // ==========================================
  // MAIN UPDATE LOOP
  // ==========================================

  public update(
    delta: number, 
    frameCount: number,
    playerRig: THREE.Group, 
    camera: THREE.Camera, 
    remotePilots: Map<string, TargetablePilot>, 
    localPilotId: string | null,
    localShip: THREE.Group | null,
    myTeam: string,
    gridData: number[][] | null,
    viewportWidth: number,
    viewportHeight: number
  ): CombatState {
    const frameScale = delta * 60;
    const deltaMs = delta * 1000;
    
    // 1. AIM ASSIST & MISSILE LOCK
    let isLockedOn = false;
    let targetScreenX = 0;
    let targetScreenY = 0;
    let magnetismYaw = 0;
    let magnetismPitch = 0;
    let currentTargetId: string | null = null;
    let isAimAssistActive = false;
    let bestCenterScore = 0.5; // MISSILE_LOCK_CONE

    const aimMyWorldPos = new THREE.Vector3();
    playerRig.getWorldPosition(aimMyWorldPos);

    remotePilots.forEach((enemy, id) => {
      if (!enemy.mesh.visible || enemy.team === myTeam) return;

      const aimEnemyWorld = enemy.mesh.getWorldPosition(new THREE.Vector3());
      const distanceToTarget = aimEnemyWorld.distanceTo(aimMyWorldPos);
      const timeToHit = distanceToTarget / LASER_SPEED;
      const predictedVelocity =
        enemy.velocity.lengthSq() > 1e-6
          ? enemy.velocity
          : new THREE.Vector3(0, 0, -1)
              .applyQuaternion(enemy.mesh.quaternion)
              .multiplyScalar(DEFAULT_SHIP_SPEED);
      const futurePos = aimEnemyWorld
        .clone()
        .addScaledVector(predictedVelocity, timeToHit);
      const aimEnemyLocal = playerRig.worldToLocal(futurePos.clone());

      if (aimEnemyLocal.z > 0) return; // Behind us

      const yawOffCenter = Math.atan2(aimEnemyLocal.x, -aimEnemyLocal.z);
      const pitchOffCenter = Math.atan2(aimEnemyLocal.y, -aimEnemyLocal.z);
      const totalOffCenter = Math.abs(yawOffCenter) + Math.abs(pitchOffCenter);
      const distance = aimEnemyLocal.length();

      if (distance < 25000 && totalOffCenter < bestCenterScore) {
        // Raycast check
        const aimToEnemy = new THREE.Vector3()
          .subVectors(aimEnemyWorld, aimMyWorldPos)
          .normalize();
        this.losRaycaster.near = 2;

        this.losRaycaster.far = Math.max(2, distanceToTarget - 2);

        this.losRaycaster.set(aimMyWorldPos, aimToEnemy);
        const hits = this.losRaycaster.intersectObject(this.terrainGroup, true); 
        
        if (hits.length > 0) return;

        bestCenterScore = totalOffCenter;
        currentTargetId = id;

        futurePos.project(camera);
        targetScreenX = (futurePos.x * 0.5 + 0.5) * viewportWidth;
        targetScreenY = -(futurePos.y * 0.5 - 0.5) * viewportHeight;

        if (totalOffCenter < 0.15) { // AIM_ASSIST_CONE
          isAimAssistActive = true;
          magnetismYaw = -yawOffCenter * 0.05;
          magnetismPitch = pitchOffCenter * 0.05;
        }
      }
    });

    if (currentTargetId) {
      isLockedOn = true;
      if (currentTargetId === this.lockedEnemyId) {
        this.lockTimerMs = Math.min(
          this.lockTimerMs + deltaMs,
          LOCK_ON_DURATION_MS,
        );
      } else {
        this.lockedEnemyId = currentTargetId;
        this.lockTimerMs = 0;
      }
    } else {
      this.lockTimerMs = Math.max(
        this.lockTimerMs - LOCK_DECAY_PER_SECOND * delta,
        0,
      );
      if (this.lockTimerMs === 0) this.lockedEnemyId = null;
    }

    // 2. RADAR WARNING RECEIVER (RWR)
    let isBeingTracked = false;
    const rwrMyWorldPos = new THREE.Vector3();
    playerRig.getWorldPosition(rwrMyWorldPos);

    remotePilots.forEach((enemy) => {
      if (!enemy.mesh.visible || enemy.team === myTeam) return;

      const rwrEnemyWorldPos = new THREE.Vector3();
      enemy.mesh.getWorldPosition(rwrEnemyWorldPos);
      
      const rwrToMe = new THREE.Vector3().subVectors(rwrMyWorldPos, rwrEnemyWorldPos);
      if (rwrToMe.length() < 25000) {
        rwrToMe.normalize();
        const rwrEnemyQuat = new THREE.Quaternion();
        enemy.mesh.getWorldQuaternion(rwrEnemyQuat);
        const rwrEnemyForward = new THREE.Vector3(0, 0, -1).applyQuaternion(rwrEnemyQuat);

        if (rwrEnemyForward.dot(rwrToMe) > 0.98) {
          isBeingTracked = true;
        }
      }
    });

    // 3. UPDATE LASERS
    for (let i = this.lasers.length - 1; i >= 0; i--) {
      const laser = this.lasers[i];
      const stepDistance = 150 * frameScale;
      laser.translateZ(-stepDistance);
      laser.userData.distanceTraveled += stepDistance;

      if (laser.userData.distanceTraveled > 20000) {
        this.earthAnchor.remove(laser);
        this.lasers.splice(i, 1);
      }
    }

    // 4. UPDATE MISSILES
    for (let i = this.missiles.length - 1; i >= 0; i--) {
      const missile = this.missiles[i];
      const targetId = String(missile.userData.targetId ?? "");
      const remoteTarget = remotePilots.get(targetId);
      const targetMesh =
        remoteTarget?.mesh ||
        (targetId && localPilotId === targetId ? localShip : null);

      missile.userData.speed = Math.min(
        missile.userData.speed + 1.5 * frameScale,
        250,
      );
      
      if (targetMesh?.visible) {
        if (
          targetMesh.userData.flareActiveUntil &&
          targetMesh.userData.flareActiveUntil > Date.now()
        ) {
          missile.userData.targetId = null; // Blinded by flares
        } else {
          const mTargetPos = new THREE.Vector3();
          targetMesh.getWorldPosition(mTargetPos);
          this.earthAnchor.worldToLocal(mTargetPos);
          
          const mToTarget = new THREE.Vector3().subVectors(mTargetPos, missile.position).normalize();
          const mTargetRot = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), mToTarget);
          const targetDistance = missile.position.distanceTo(mTargetPos);
          const terminalGuidance = THREE.MathUtils.clamp(
            1 - targetDistance / MISSILE_TERMINAL_GUIDANCE_RADIUS,
            0,
            1,
          );
          const guidanceStrength = THREE.MathUtils.lerp(0.04, 0.18, terminalGuidance);
          missile.quaternion.slerp(
            mTargetRot,
            1 - Math.pow(1 - guidanceStrength, frameScale),
          );
        }
      }

      const missileStep = missile.userData.speed * frameScale;
      missile.translateZ(-missileStep);
      missile.userData.distanceTraveled += missileStep;

      if (frameCount % 2 === 0) {
        this.spawnFireParticle(
          missile.position,
          new THREE.Vector3(
            (Math.random() - 0.5) * 0.5,
            (Math.random() - 0.5) * 0.5,
            (Math.random() - 0.5) * 0.5,
          ),
          this.fireGeoSmall,
          this.matSmokeLight,
          40,
        );
      }

      let hitTarget = false;
      let triggerProximityFuse = false;
      if (targetMesh?.visible) {
        const mTargetPos = new THREE.Vector3();
        targetMesh.getWorldPosition(mTargetPos);
        this.earthAnchor.worldToLocal(mTargetPos);
        const distanceToTarget = missile.position.distanceTo(mTargetPos);
        if (distanceToTarget < 30) hitTarget = true;
        else if (distanceToTarget < MISSILE_PROXIMITY_FUSE_RADIUS) triggerProximityFuse = true;
      }

      if (
        hitTarget ||
        triggerProximityFuse ||
        missile.userData.distanceTraveled > 30000 ||
        (!targetMesh && missile.userData.distanceTraveled > 5000)
      ) {
        if (hitTarget || triggerProximityFuse) {
          this.spawnExplosion(this.earthAnchor.localToWorld(missile.position.clone()));
        }
        this.earthAnchor.remove(missile);
        this.missiles.splice(i, 1);
      }
    }

    // 5. UPDATE EXPLOSIONS
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const exp = this.explosions[i];
      exp.scale.addScalar(5.0);
      const expMaterial = exp.material as THREE.MeshBasicMaterial;
      expMaterial.opacity -= 0.02;
      if (expMaterial.opacity <= 0) {
        this.earthAnchor.remove(exp);
        exp.geometry.dispose();
        expMaterial.dispose();
        this.explosions.splice(i, 1);
      }
    }

    // 6. UPDATE PARTICLES & FLARES
    for (let i = this.fireParticles.length - 1; i >= 0; i--) {
      const p = this.fireParticles[i];
      p.position.addScaledVector(p.userData.velocity, frameScale);
      p.scale.multiplyScalar(Math.pow(p.userData.expandRate ?? 1.02, frameScale));
      p.userData.life -= frameScale;
      if (p.userData.life <= 0) {
        this.earthAnchor.remove(p);
        this.fireParticles.splice(i, 1);
      }
    }

    for (let i = this.activeFlares.length - 1; i >= 0; i--) {
      const f = this.activeFlares[i];
      f.position.add(f.userData.velocity);
      //const upVector = this.getAnchorUpFromLocalPosition(f.position);
      const upVector = f.position.clone().normalize();
      f.userData.velocity.sub(upVector.multiplyScalar(0.2));
      f.userData.velocity.multiplyScalar(0.98);
      f.userData.life--;
      (f.material as THREE.MeshBasicMaterial).opacity = f.userData.life / 120;

      if (frameCount % 2 === 0) {
        this.spawnFireParticle(
          f.position,
          upVector.clone().multiplyScalar(1),
          this.fireGeoFlare,
          this.matFlareBright,
          24,
          1.04,
        );
      }

      if (f.userData.life <= 0) {
        this.earthAnchor.remove(f);
        f.geometry.dispose();
        (f.material as THREE.Material).dispose();
        this.activeFlares.splice(i, 1);
      }
    }

    // 7. UPDATE DEBRIS PHYSICS
    const nowMs = Date.now();
    for (let i = this.debrisParticles.length - 1; i >= 0; i--) {
      const debris = this.debrisParticles[i];
      
      if (debris.userData.expiresAt && nowMs >= debris.userData.expiresAt && !debris.userData.isFuselage) {
        this.disposeDetachedMaterials(debris);
        this.earthAnchor.remove(debris);
        this.debrisParticles.splice(i, 1);
        continue;
      }

      debris.position.addScaledVector(debris.userData.velocity, frameScale);
      debris.rotation.x += debris.userData.rotSpeed.x * frameScale;
      debris.rotation.y += debris.userData.rotSpeed.y * frameScale;
      debris.rotation.z += debris.userData.rotSpeed.z * frameScale;
      debris.userData.rotSpeed.multiplyScalar(Math.max(0.85, 1 - 0.015 * frameScale));

      const upVector = debris.position.clone().normalize();
      //const upVector = this.getAnchorUpFromLocalPosition(debris.position);
      const gravityForce = debris.userData.isFuselage ? 0.07 : 0.12;
      debris.userData.velocity.sub(upVector.clone().multiplyScalar(gravityForce * frameScale));

      const speed = debris.userData.velocity.length();
      const dragCoef = debris.userData.isFuselage ? 0.0012 : 0.0018;
      debris.userData.velocity.multiplyScalar(Math.max(0.75, 1 - dragCoef * speed * frameScale));

      // Terrain Collision
      if (gridData) {
        const altitude =
          this.getAnchorDistanceFromLocalPosition(debris.position) - GLOBE_RADIUS;
        const phi = Math.acos(upVector.y);
        const theta = Math.atan2(upVector.z, upVector.x);
        const mapRows = gridData.length;
        const mapCols = gridData[0].length;
        
        const rRow = Math.round((phi / Math.PI) * (mapRows - 1));
        const rCol = Math.round(((Math.PI - theta) / (2 * Math.PI)) * (mapCols - 1));
        const safeRow = Math.max(0, Math.min(rRow, mapRows - 1));
        const safeCol = Math.max(0, Math.min(rCol, mapCols - 1));
        
        const groundHeight = Math.max(0, gridData[safeRow][safeCol] * SCALE_Z);

        if (altitude < groundHeight) {
          debris.position.copy(upVector).multiplyScalar(GLOBE_RADIUS + groundHeight + 1);
          if (speed > 2) {
            debris.userData.velocity.reflect(upVector).multiplyScalar(0.4);
            debris.userData.rotSpeed.multiplyScalar(0.5);
          } else {
            debris.userData.velocity.set(0, 0, 0);
            debris.userData.rotSpeed.set(0, 0, 0);
          }
        }
      }

      // Fireballs for fuselage
      if (debris.userData.isFuselage && frameCount % 2 === 0 && nowMs < debris.userData.burnUntil) {
        const isSmoke = Math.random() > 0.3;
        this.spawnFireParticle(
          debris.position
            .clone()
            .add(
              new THREE.Vector3(
                (Math.random() - 0.5) * 6,
                (Math.random() - 0.5) * 6,
                (Math.random() - 0.5) * 6,
              ),
            ),
          upVector
            .clone()
            .multiplyScalar(1.5)
            .add(
              new THREE.Vector3(
                (Math.random() - 0.5) * 1.2,
                (Math.random() - 0.5) * 1.2,
                (Math.random() - 0.5) * 1.2,
              ),
            ),
          this.fireGeoLarge,
          isSmoke ? this.matSmokeDark : this.matFireOrange,
          42,
          1.03,
        );
      }
    }

    this.flareCooldownMs = Math.max(0, this.flareCooldownMs - deltaMs);

    // Calculate nose target for HUD aim reticle
    const noseTarget = new THREE.Vector3(0, 0, -3000);
    playerRig.localToWorld(noseTarget);
    noseTarget.project(camera);

    return {
      aimX: (noseTarget.x * 0.5 + 0.5) * viewportWidth,
      aimY: -(noseTarget.y * 0.5 - 0.5) * viewportHeight,
      aimZ: noseTarget.z,
      isLockedOn,
      lockProgress: this.lockTimerMs / LOCK_ON_DURATION_MS,
      isBeingTracked,
      flareCooldown: this.flareCooldownMs,
      targetScreenX,
      targetScreenY,
      magnetismYaw: isAimAssistActive ? magnetismYaw : 0,
      magnetismPitch: isAimAssistActive ? magnetismPitch : 0,
      lockedEnemyId: this.lockedEnemyId,
    };
  }

  private spawnFireParticle(
    position: THREE.Vector3,
    velocity: THREE.Vector3,
    geometry: THREE.BufferGeometry,
    material: THREE.MeshBasicMaterial,
    life: number,
    expandRate = 1.02,
  ): void {
    const particle = new THREE.Mesh(geometry, material);
    particle.position.copy(position);
    particle.userData.velocity = velocity;
    particle.userData.life = life;
    particle.userData.expandRate = expandRate;
    this.earthAnchor.add(particle);
    this.fireParticles.push(particle);
  }

/*   private getAnchorUpFromLocalPosition(localPosition: THREE.Vector3): THREE.Vector3 {
    return this.getAnchorUpFromWorldPosition(
      this.earthAnchor.localToWorld(localPosition.clone()),
    );
  }

  private getAnchorUpFromWorldPosition(worldPosition: THREE.Vector3): THREE.Vector3 {
    const anchorWorldPosition = this.earthAnchor.getWorldPosition(
      new THREE.Vector3(),
    );
    return worldPosition.sub(anchorWorldPosition).normalize();
  } */

  private getAnchorDistanceFromLocalPosition(localPosition: THREE.Vector3): number {
    const anchorWorldPosition = this.earthAnchor.getWorldPosition(
      new THREE.Vector3(),
    );
    return this.earthAnchor
      .localToWorld(localPosition.clone())
      .distanceTo(anchorWorldPosition);
  }

  private disposeDetachedMaterials(object: THREE.Object3D): void {
    object.traverse((child) => {
      const mesh = child as THREE.Mesh;
      const material = mesh.material;
      if (Array.isArray(material)) {
        material.forEach((entry) => entry.dispose());
      } else if (material) {
        material.dispose();
      }
    });
  }
}
