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
} from "../index.js";
import type { GameObjectOptions, Mov, Objects3D, ObjectValue, SceneData } from "../index.js";

/**
 * Options for creating a Ball instance.
 */
export type BallOptions = GameObjectOptions & {
  radius: number,
  speed: ObjectValue<number> & { max: number },
  magic_ball?: boolean,
};

/**
 * Represents the ball in the game: movement, drawing, collisions, respawn.
 */
export class Ball extends GameObject {
  // Rendering & animation
  public flame_animation: BABYLON.ParticleSystem;

  // Ball physics state
  public radius: number;
  public original_radius: number;
  public speed_modifier: number = 1;
  public angle: number = 0;
  public velocity: number = 0;
  public respawn_timer: number = 0;
  public magic_ball: boolean = false;
  public speed: ObjectValue<number> & { max: number };

  constructor(options: BallOptions) {
    super(options);
    // ball specifics
    this.speed = options.speed;
    this.magic_ball = options.magic_ball ?? false;
    this.radius = options.radius;
    this.original_radius = options.radius;
    if (!this.magic_ball)
      this.flame_animation = createFlame({ scene: options.scene, pos: this.pos.value, size: 4 });
    else
      this.flame_animation = createFlame({
        scene: options.scene,
        pos: this.pos.value,
        size: 6,
        color1: new BABYLON.Color4(0.9, 0.2, 1, 1),
        color2: new BABYLON.Color4(0.5, 0.1, 0.4, 1),
      });
      this.flame_animation.emitter = this.pos.value;
    this.obj = this.createMesh(options.scene);
    this.throwBall(false);
  }

  /**
   * Creates and initializes the BabylonJS Mesh for the ball.
   */
  private createMesh(scene: BABYLON.Scene): BABYLON.Mesh {
    const mesh = BABYLON.MeshBuilder.CreateSphere(
      "ball",
      { diameter: this.radius * 2, segments: 32 },
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
   * Main update: handles respawn, movement, collisions, and hell mode.
   */
  public update(obj3D: Objects3D, data: SceneData) {
    if (this.updateRespawnTimer(data.step)) return;
    this.move(data);
    for (let paddle of obj3D.paddles) this.paddleCollisions(paddle, data, obj3D);
    this.wallCollisions(obj3D.table, data);
    this.hellUpdate(data);
  }

  /**
   * Dispose of the mesh and particle system (remove from scene).
   */
  public dispose() {
    this.obj?.dispose();
    this.flame_animation?.dispose();
  }

  /**
   * Handles collision with a paddle.
   */
  private paddleCollisions(paddle: Paddle, data: SceneData, obj3D: Objects3D) {
    // Axis-aligned bounding box overlap (AABB)
    if (
      Math.abs(this.pos.value.x - paddle.pos.value.x) - paddle.dimensions.value.x / 2 - this.radius <= 0 &&
      Math.abs(this.pos.value.y - paddle.pos.value.y) - paddle.dimensions.value.y / 2 - this.radius <= 0 &&
      Math.abs(this.pos.value.z - paddle.pos.value.z) - paddle.dimensions.value.z / 2 - this.radius <= 0
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
        // hell mode
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
   * Handles collision with table walls and scoring.
   */
  private wallCollisions(table: Table, data: SceneData) {
    // Z+ wall (far)
    if (this.limits.far >= table.limits.far) {
      this.pos.value.z = table.limits.far - this.radius;
      this.updateMovement(mov.invert_z, false, false);
      spawnHitParticles(data.scene, this.pos.value);
    }
    // Z- wall (near)
    if (this.limits.near <= table.limits.near) {
      this.pos.value.z = table.limits.near + this.radius;
      this.updateMovement(mov.invert_z, false, false);
      spawnHitParticles(data.scene, this.pos.value);
    }

    // X- wall (left): score for right
    if (this.limits.left <= table.limits.left) {
      data.score.right++;
      flashZone(data, side.left, table);
      this.throwBall(true);
    }
    // X+ wall (right): score for left
    if (this.limits.right - this.radius >= table.limits.right) {
      data.score.left++;
      flashZone(data, side.right, table);
      this.throwBall(true);
    }
  }

  /**
   * Respawns the ball at initial position with randomized direction.
   */
  private throwBall(reset_pos: boolean) {
    const direction: Mov = randomInt(0, 1) ? mov.left : mov.right;
    this.velocity = this.speed.value;
    this.speed.value = this.speed.value;
    this.angle = 0;
    this.updateMovement(direction, true, false);
    if (reset_pos) {
      this.move(null!, 0, 0);
      this.updateRespawnTimer(0, 0.5); // 0.5s respawn timer
    }
  }

  /**
   * Updates the position of the ball based on velocity and angle.
   */
  private move(data: SceneData | null, x?: number, z?: number) {
    const angle_rad = this.angle * Math.PI / 180;
    const vx = this.velocity * Math.cos(angle_rad);
    const vz = this.velocity * Math.sin(angle_rad);
    if (x !== undefined) this.pos.value.x = x;
    else if (data) this.pos.value.x += vx * data.step * this.speed_modifier;
    if (z !== undefined) this.pos.value.z = z;
    else if (data) this.pos.value.z += vz * data.step * this.speed_modifier;
    this.obj.position.copyFrom(this.pos.value);
    this.updatePosition();
  }

  /**
   * Updates the ball's direction, angle, and speed based on collision or movement type.
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
   * Handles the respawn timer for the ball. Hides the ball while timer > 0.
   * @returns True if timer is active, false if ball should be visible
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
   * Updates ball appearance and speed based on hell mode.
   */
  private hellUpdate(data: SceneData) {
    // speed
    if (data.hell_mode == hellMode.fast_balls)
      this.speed_modifier = 4;
    else if (data.hell_mode == hellMode.infinite_balls)
      this.speed_modifier = 1.5;
    else if (data.hell_side)
      this.speed_modifier = 2;
    else
      this.speed_modifier = 1;

    // size
    if (data.hell_mode == hellMode.big_balls)
      this.changeSize(this.original_radius * 2);
    else
      this.changeSize();
  }

  /**
   * Sets the ball's radius and scales the mesh accordingly.
   */
  private changeSize(radius: number = this.original_radius) {
    const boundingInfo = this.obj.getBoundingInfo();
    const currentRadius = (boundingInfo.maximum.x - boundingInfo.minimum.x) / 2;
    const scale = radius / currentRadius;
    this.obj.scaling.set(scale, scale, scale);
    this.radius = radius;
  }
}