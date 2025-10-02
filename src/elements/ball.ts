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
} from "../index.js";
import type { Mov, Objects3D, SceneData } from "../index.js";

/**
 * Options for creating a Ball instance.
 */
type BallOptions = {
  speed: number;               // Initial ball speed
  max_speed: number;           // Maximum speed
  pos: BABYLON.Vector3;        // Start position
  radius: number;              // Ball radius (not diameter)
  scene: BABYLON.Scene;        // BabylonJS scene
};

/**
 * Represents the ball in the game: movement, drawing, collisions, respawn.
 */
export class Ball {
  // Rendering & animation
  private obj: BABYLON.Mesh;
  public flame_animation: BABYLON.ParticleSystem;

  // Ball physics state
  public original_radius: number;
  public radius: number;
  private speed: number;
  private original_speed: number;
  private speed_modifier: number;
  private angle: number = 0;
  private max_speed: number;
  public velocity: number = 0;
  public respawn_timer: number = 0;

  // Position and collision bounds
  public pos: BABYLON.Vector3;
  public left_line!: number;
  public right_line!: number;
  public upper_line!: number;
  public lower_line!: number;
  public near_line!: number;
  public far_line!: number;

  constructor(options: BallOptions) {
    this.pos = options.pos;
    this.radius = options.radius;
    this.original_radius = options.radius;
    this.speed = options.speed;
    this.original_speed = options.speed;
    this.speed_modifier = 1;
    this.max_speed = options.max_speed;
    this.flame_animation = createFlame(options.scene, this.pos, 4);
    this.obj = this.createMesh(options.scene);
    this.positionUpdate();
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
    mesh.position.copyFrom(this.pos);

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
      Math.abs(this.pos.x - paddle.pos.x) - paddle.dimensions.x / 2 - this.radius <= 0 &&
      Math.abs(this.pos.y - paddle.pos.y) - paddle.dimensions.y / 2 - this.radius <= 0 &&
      Math.abs(this.pos.z - paddle.pos.z) - paddle.dimensions.z / 2 - this.radius <= 0
    ) {
      // Side collision (X axis)
      if (this.pos.z > paddle.near_line && this.pos.z < paddle.far_line) {
        let inverting = false;
        if (this.pos.x < paddle.left_line && paddle.side == side.right) {
          if (this.velocity > 0) inverting = true;
          this.updateMovement(mov.left, true, true);
        }
        if (this.pos.x > paddle.right_line && paddle.side == side.left) {
          if (this.velocity < 0) inverting = true;
          this.updateMovement(mov.right, true, true);
        }
        spawnHitParticles(data.scene, this.pos);
        // hell mode
        if (inverting) {
          if (data.hell_mode == hellMode.infinite_balls)
            infiniteBallsAdd(data, obj3D, this.pos.x, this.pos.z);
          if (data.hell_mode == hellMode.big_balls)
            paddle.pos.x -= this.velocity / Math.abs(this.velocity) * 3;
        }

      }
      // Top/bottom collision (Z axis)
      if (this.pos.x > paddle.left_line && this.pos.x < paddle.right_line) {
        if (this.pos.z > paddle.far_line)
          this.updateMovement(mov.near, false, false);
        if (this.pos.z < paddle.near_line)
          this.updateMovement(mov.far, false, false);
        spawnHitParticles(data.scene, this.pos);
      }
    }
  }

  /**
   * Handles collision with table walls and scoring.
   */
  private wallCollisions(table: Table, data: SceneData) {
    // Z+ wall (far)
    if (this.far_line >= table.far_line) {
      this.pos.z = table.far_line - this.radius;
      this.updateMovement(mov.invert_z, false, false);
      spawnHitParticles(data.scene, this.pos);
    }
    // Z- wall (near)
    if (this.near_line <= table.near_line) {
      this.pos.z = table.near_line + this.radius;
      this.updateMovement(mov.invert_z, false, false);
      spawnHitParticles(data.scene, this.pos);
    }

    // X- wall (left): score for right
    if (this.left_line <= table.left_line) {
      data.score.right++;
      flashZone(data, side.left, table);
      this.throwBall(true);
    }
    // X+ wall (right): score for left
    if (this.right_line - this.radius >= table.right_line) {
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
    this.velocity = this.speed;
    this.speed = this.original_speed;
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
    if (x !== undefined) this.pos.x = x;
    else if (data) this.pos.x += vx * data.step * this.speed_modifier;
    if (z !== undefined) this.pos.z = z;
    else if (data) this.pos.z += vz * data.step * this.speed_modifier;
    this.obj.position.copyFrom(this.pos);
    this.positionUpdate();
  }

  /**
   * Updates the ball's direction, angle, and speed based on collision or movement type.
   */
  private updateMovement(move: Mov, angle_distortion: boolean, increase_speed: boolean) {
    switch (move) {
      case mov.far: this.angle = Math.abs(this.angle); break;
      case mov.near: this.angle = -Math.abs(this.angle); break;
      case mov.left: this.velocity = -this.speed; break;
      case mov.right: this.velocity = this.speed; break;
      case mov.invert_x: this.velocity *= -1; break;
      case mov.invert_z: this.angle *= -1; break;
    }
    if (increase_speed && this.speed < this.max_speed) this.speed += 2;
    if (angle_distortion) this.angle = randomInt(-70, 70);
    this.angle = normalizeAngle180(this.angle);
  }

  /**
   * Updates the bounding lines for collision and animates the flame.
   */
  private positionUpdate() {
    this.left_line = this.pos.x - this.radius;
    this.right_line = this.pos.x + this.radius;
    this.upper_line = this.pos.y + this.radius;
    this.lower_line = this.pos.y - this.radius;
    this.near_line = this.pos.z - this.radius;
    this.far_line = this.pos.z + this.radius;
    this.flame_animation.emitter = this.pos;
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