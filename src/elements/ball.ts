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
  createFlame,
  hellMode,
  infiniteBallsAdd,
  GameObject,
  Vec3,
} from "../index.js";
import type { GameObjectOptions, Mov, Objects3D, ObjectValue, SceneData } from "../index.js";

/**
 * BallOptions extends base GameObjectOptions with ball-specific fields.
 */
export type BallOptions = GameObjectOptions & {
  radius: number;
  speed: ObjectValue<number> & { max: number };
  magic_ball?: boolean;
};

/**
 * Ball class: Handles ball logic, rendering, movement, collisions, respawn, and hell effects.
 */
export class Ball extends GameObject {
  // Ball physics and rendering state
  public radius: ObjectValue<number>;
  public speed: ObjectValue<number> & { max: number };
  public flame_animation: BABYLON.ParticleSystem;
  public magic_ball: boolean;
  public speed_modifier = 1;
  public angle = 0;
  public velocity = 0;
  public respawn_timer = 0;

  constructor(options: BallOptions) {
    super(options);
    this.radius = { value: options.radius, original: options.radius };
    this.speed = options.speed;
    this.magic_ball = !!options.magic_ball;

    // Set up flame particle effect (colorful for magic balls)
    this.flame_animation = createFlame({
      scene: options.scene,
      pos: this.pos.value,
      size: this.magic_ball ? 6 : 4,
      ...(this.magic_ball && {
        color1: new BABYLON.Color4(0.9, 0.2, 1, 1),
        color2: new BABYLON.Color4(0.5, 0.1, 0.4, 1),
      }),
    });
    this.flame_animation.emitter = this.pos.value;

    // Create Babylon mesh & launch ball
    this.obj = this.createMesh(options.scene);
    this.throwBall(false);
  }

  /**
   * Creates the Babylon mesh for the ball.
   */
  private createMesh(scene: BABYLON.Scene): BABYLON.Mesh {
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

  /**
   * Main update: Handles ball respawn, movement, collisions, and hell mode.
   */
  public update(obj3D: Objects3D, data: SceneData) {
    if (this.updateRespawnTimer(data.step)) return;
    this.move(data);
    obj3D.paddles.forEach(paddle => this.paddleCollisions(paddle, data, obj3D));
    this.wallCollisions(obj3D.table, data);
    this.hellUpdate(data);
  }

  /**
   * Clean up mesh and particles.
   */
  public dispose() {
    this.obj?.dispose();
    this.flame_animation?.dispose();
  }

  /**
   * Detects and handles collision with a paddle.
   */
  private paddleCollisions(paddle: Paddle, data: SceneData, obj3D: Objects3D) {
    // Axis-aligned bounding box overlap
    if (
      Math.abs(this.pos.value.x - paddle.pos.value.x) - paddle.dimensions.value.x / 2 - this.radius.value <= 0 &&
      Math.abs(this.pos.value.y - paddle.pos.value.y) - paddle.dimensions.value.y / 2 - this.radius.value <= 0 &&
      Math.abs(this.pos.value.z - paddle.pos.value.z) - paddle.dimensions.value.z / 2 - this.radius.value <= 0
    ) {
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
        // Hell mode effects on invert
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
  }

  /**
   * Handles wall collision and scoring.
   */
  private wallCollisions(table: Table, data: SceneData) {
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

  /**
   * Respawn the ball at center and give it a random direction.
   */
  private throwBall(reset_pos: boolean) {
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
   * Move the ball based on velocity, angle, and current speed modifier.
   */
  private move(data: SceneData | null, x?: number, z?: number) {
    const a = this.angle * Math.PI / 180;
    const vx = this.velocity * Math.cos(a);
    const vz = this.velocity * Math.sin(a);
    if (x !== undefined) this.pos.value.x = x;
    else if (data) this.pos.value.x += vx * data.step * this.speed_modifier;
    if (z !== undefined) this.pos.value.z = z;
    else if (data) this.pos.value.z += vz * data.step * this.speed_modifier;
    this.obj.position.copyFrom(this.pos.value);
    this.updatePosition();
  }

  /**
   * Updates angle, velocity, and optionally increases speed on collision.
   */
  private updateMovement(move: Mov, angle_distortion: boolean, increase_speed: boolean) {
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

  /**
   * Handles respawn timer: hides ball while respawning.
   * @returns true if timer is active; false otherwise.
   */
  private updateRespawnTimer(step: number, time?: number): boolean {
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

  /**
   * Applies hell mode: modifies speed and size.
   */
  private hellUpdate(data: SceneData) {
    // Speed modifier
    if (data.hell_mode == hellMode.fast_balls) this.speed_modifier = 4;
    else if (data.hell_mode == hellMode.infinite_balls) this.speed_modifier = 1.5;
    else if (data.hell_side) this.speed_modifier = 2;
    else this.speed_modifier = 1;

    // Size modifier
    if (data.hell_mode == hellMode.big_balls) this.changeSize(new Vec3(3, 3, 3));
    else this.changeSize();
  }

  protected changeSize(scale: Vec3 = new Vec3(1, 1, 1)) {
    super.changeSize(scale);
    this.radius.value = this.radius.original * scale.x;
  }
}