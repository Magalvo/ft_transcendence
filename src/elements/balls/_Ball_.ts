import {
  BABYLON,
  Paddle,
  Table,
  mov,
  randomInt,
  side,
  normalizeAngle180,
  flashZone,
  spawnHitParticles,
  hellMode,
  infiniteBallsAdd,
  GameObject,
} from "../../index.js";
import type { GameObjectOptions, Mov, Objects3D, ObjectValue, SceneData } from "../../index.js";


// Ball options type
export type BallOptions = GameObjectOptions & {
  radius: number;
  speed: ObjectValue<number> & { max: number };
};


// Ball: base class for all balls (movement, collisions, respawn)
export abstract class Ball extends GameObject {
  public radius: ObjectValue<number>;
  public speed: ObjectValue<number> & { max: number };
  public speed_modifier = 1;
  public angle = 0;
  public velocity = 0;
  public respawn_timer = 0;
  public flame_animation!: BABYLON.ParticleSystem;

  constructor(options: BallOptions) {
    super(options);
    this.radius = { value: options.radius, original: options.radius };
    this.speed = options.speed;
    this.obj = this.createMesh(options.scene);
    this.throwBall(false);
  }

  // Create Babylon mesh for the ball
  protected createMesh(scene: BABYLON.Scene): BABYLON.Mesh {
    const mesh = BABYLON.MeshBuilder.CreateSphere(
      "ball",
      { diameter: this.radius.value * 2, segments: 32 },
      scene
    );
    mesh.position = this.pos.value;
    const mat = new BABYLON.StandardMaterial("ballMat", scene);
    mat.diffuseColor = new BABYLON.Color3(0.8, 0.95, 1.0);
    mat.alpha = 0.8;
    mat.specularColor = new BABYLON.Color3(0, 0, 0);
    mat.emissiveColor = new BABYLON.Color3(0.09, 0.12, 0.18);
    mat.needDepthPrePass = true;
    mesh.material = mat;
    return mesh;
  }

  // Main update (to be implemented by subclasses)
  abstract update(...args: any[]): void;

  // Clean up mesh and particles
  public dispose() {
    this.obj?.dispose();
    this.flame_animation?.dispose();
  }

  // Paddle collision (AABB overlap)
  protected paddleCollisions(paddle: Paddle, data: SceneData, obj3D: Objects3D) {
    const overlap =
      Math.abs(this.pos.value.x - paddle.pos.value.x) - paddle.dimensions.value.x / 2 - this.radius.value <= 0 &&
      Math.abs(this.pos.value.y - paddle.pos.value.y) - paddle.dimensions.value.y / 2 - this.radius.value <= 0 &&
      Math.abs(this.pos.value.z - paddle.pos.value.z) - paddle.dimensions.value.z / 2 - this.radius.value <= 0;
    if (!overlap) return;
    // Side collision (X axis)
    if (this.pos.value.z > paddle.limits.near && this.pos.value.z < paddle.limits.far) {
      let inverting = false;
      if (this.pos.value.x < paddle.limits.left && paddle.side == side.right) {
        if (this.velocity > 0) inverting = true;
        this.updateMovement(mov.left, true, true);
      }
      if (this.pos.value.x > paddle.limits.right && paddle.side == side.left) {
        if (this.velocity < 0) inverting = true;
        this.updateMovement(mov.right, true, true);
      }
      spawnHitParticles(data.scene, this.pos.value);
      // Hell mode effects
      if (inverting) {
        if (data.hell_mode == hellMode.infinite_balls)
          infiniteBallsAdd(data, obj3D, this.pos.value.x, this.pos.value.z);
        if (data.hell_mode == hellMode.big_balls)
          paddle.pos.value.x -= this.velocity / Math.abs(this.velocity) * 3;
      }
    }
    // Top/bottom collision (Z axis)
    if (this.pos.value.x > paddle.limits.left && this.pos.value.x < paddle.limits.right) {
      if (this.pos.value.z > paddle.limits.far)
        this.updateMovement(mov.near, false, false);
      if (this.pos.value.z < paddle.limits.near)
        this.updateMovement(mov.far, false, false);
      spawnHitParticles(data.scene, this.pos.value);
    }
  }

  // Wall collision and scoring
  protected wallCollisions(table: Table, data: SceneData) {
    // Z+ far wall
    if (this.limits.far >= table.limits.far) {
      this.pos.value.z = table.limits.far - this.radius.value;
      this.updateMovement(mov.invert_z, false, false);
      spawnHitParticles(data.scene, this.pos.value);
    }
    // Z- near wall
    if (this.limits.near <= table.limits.near) {
      this.pos.value.z = table.limits.near + this.radius.value;
      this.updateMovement(mov.invert_z, false, false);
      spawnHitParticles(data.scene, this.pos.value);
    }
    // X- left wall: score for right
    if (this.limits.left <= table.limits.left) {
      data.score.right++;
      flashZone(data, side.left, table);
      this.throwBall(true);
    }
    // X+ right wall: score for left
    if (this.limits.right - this.radius.value >= table.limits.right) {
      data.score.left++;
      flashZone(data, side.right, table);
      this.throwBall(true);
    }
  }

  // Respawn ball at center and launch in random direction
  protected throwBall(reset_pos: boolean) {
    const direction: Mov = randomInt(0, 1) ? mov.left : mov.right;
    this.velocity = this.speed.value;
    this.speed.value = this.speed.value;
    this.angle = 0;
    this.updateMovement(direction, true, false);
    if (reset_pos) {
      this.move(null!, 0, 0);
      this.updateRespawnTimer(0, 0.5); // 0.5s respawn
    }
  }

  /**
   * Move the ball in increments of 0.1 units, calling onStep after each mini-step.
   * Use onStep to check collisions at each mini-step.
   */
  protected move(
    data: SceneData | null,
    x?: number,
    z?: number,
    onStep?: () => void
  ) {
    const a = this.angle * Math.PI / 180;
    const vx = this.velocity * Math.cos(a);
    const vz = this.velocity * Math.sin(a);
    const stepSize = 0.1;
    if (x !== undefined) {
      this.pos.value.x = x;
    } else if (data) {
      let totalDx = vx * data.step * this.speed_modifier;
      let dxSign = Math.sign(totalDx);
      let dx = Math.abs(totalDx);
      while (dx > 0) {
        const moveStep = Math.min(dx, stepSize);
        this.pos.value.x += moveStep * dxSign;
        dx -= moveStep;
        if (onStep) onStep();
      }
    }
    if (z !== undefined) {
      this.pos.value.z = z;
    } else if (data) {
      let totalDz = vz * data.step * this.speed_modifier;
      let dzSign = Math.sign(totalDz);
      let dz = Math.abs(totalDz);
      while (dz > 0) {
        const moveStep = Math.min(dz, stepSize);
        this.pos.value.z += moveStep * dzSign;
        dz -= moveStep;
        if (onStep) onStep();
      }
    }
    this.obj.position.copyFrom(this.pos.value);
    this.updatePosition();
  }

  // Update angle, velocity, and optionally increase speed on collision
  protected updateMovement(move: Mov, angle_distortion: boolean, increase_speed: boolean) {
    switch (move) {
      case mov.far: this.angle = Math.abs(this.angle); break;
      case mov.near: this.angle = -Math.abs(this.angle); break;
      case mov.left: this.velocity = -this.speed.value; break;
      case mov.right: this.velocity = this.speed.value; break;
      case mov.invert_x: this.velocity *= -1; break;
      case mov.invert_z: this.angle *= -1; break;
    }
    if (increase_speed && this.speed.value < this.speed.max) this.speed.value += 2;
    if (angle_distortion) this.angle = randomInt(-70, 70);
    this.angle = normalizeAngle180(this.angle);
  }

  // Handles respawn timer: hides ball while respawning
  // Returns true if timer is active
  protected updateRespawnTimer(step: number, time?: number): boolean {
    if (time !== undefined) {
      this.respawn_timer = time;
      this.obj.isVisible = false;
    } else if (this.respawn_timer > 0) {
      this.respawn_timer -= step;
      return true;
    } else {
      this.obj.isVisible = true;
    }
    return false;
  }
}