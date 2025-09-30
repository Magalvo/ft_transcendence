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
} from "../index.js";
import type { Mov, Objects3D, SceneData } from "../index.js";

/**
 * Options for creating a Ball instance
 */
type BallOptions = {
  speed: number;
  max_speed: number;
  pos: BABYLON.Vector3;
  radius: number;
  scene: BABYLON.Scene;
};

/**
 * Represents the ball in the game, including logic for movement,
 * drawing, collisions, and respawn.
 */
export class Ball {
  // Mesh used to render the ball in BabylonJS
  private obj: BABYLON.Mesh;
  // Ball parameters
  public radius: number;
  private speed: number;
  private initial_speed: number;
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
    this.speed = options.speed;
    this.initial_speed = options.speed;
    this.max_speed = options.max_speed;
    this.obj = this.initializeBall(options.scene);
    this.positionUpdate();
    this.throwBall();
  }

  /* ***************** *
   *  DRAWING METHODS  *
   * ***************** */

  /**
   * Initializes and returns the BabylonJS Mesh for the ball.
   * @param scene - The BabylonJS scene
   * @returns {BABYLON.Mesh}
   */
  private initializeBall(scene: BABYLON.Scene): BABYLON.Mesh {
    const new_ball = BABYLON.MeshBuilder.CreateSphere(
      "ball",
      { diameter: this.radius, segments: 32 },
      scene
    );
    new_ball.position.x = this.pos.x;
    new_ball.position.y = this.pos.y;
    new_ball.position.z = this.pos.z;

    const ballMat = new BABYLON.StandardMaterial("ballMat", scene);
    ballMat.diffuseColor = new BABYLON.Color3(0.8, 0.95, 1.0);
    ballMat.alpha = 0.8;
    ballMat.specularColor = new BABYLON.Color3(0, 0, 0);
    ballMat.emissiveColor = new BABYLON.Color3(0.09, 0.12, 0.18);
    ballMat.needDepthPrePass = true;

    new_ball.material = ballMat;

    return new_ball;
  }

  /* **************** *
   *  PUBLIC METHODS  *
   * **************** */

  /**
   * Main update function for the ball: handles respawn, movement, and collisions.
   * @param obj - All 3D objects in the game (including paddles and table)
   * @param data - Scene/game state
   */
  public update(obj: Objects3D, data: SceneData) {
    // Handle respawn timer: skip update if respawning
    if (this.updateRespawnTimer(data.step) === true) return;
    // Move ball
    this.move(data);
    // Paddle collisions
    for (let paddle of obj.paddles) this.paddleCollisions(paddle, data);
    // Wall collisions / scoring
    this.wallCollisions(obj.table, data);
  }

  /* ******************* *
   *  COLLISION METHODS  *
   * ******************* */

  /**
   * Checks and handles collision with a paddle.
   * @param paddle - Paddle instance
   */
  private paddleCollisions(paddle: Paddle, data: SceneData) {
    // Ball and paddle overlap check (AABB)
    if (
      Math.abs(this.pos.x - paddle.pos.x) - paddle.dimensions.x / 2 - this.radius <= 0 &&
      Math.abs(this.pos.y - paddle.pos.y) - paddle.dimensions.y / 2 - this.radius <= 0 &&
      Math.abs(this.pos.z - paddle.pos.z) - paddle.dimensions.z / 2 - this.radius <= 0
    ) {
      // X collision (lateral)
      if (this.pos.z > paddle.near_line && this.pos.z < paddle.far_line) {
        // Collision from left on right paddle
        if (this.pos.x < paddle.left_line && paddle.side == side.right)
          this.updateMovement(mov.left, true, true);
        // Collision from right on left paddle
        if (this.pos.x > paddle.right_line && paddle.side == side.left)
          this.updateMovement(mov.right, true, true);
        spawnHitParticles(data.scene, this.pos);
      }
      // Z collision (top/bottom)
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
   * Checks and handles collision with table walls and scoring.
   * @param table - Table instance
   * @param data - Scene/game state
   */
  private wallCollisions(table: Table, data: SceneData) {
    // Far wall (Z+)
    if (this.far_line >= table.far_line) {
      this.pos.z = table.far_line - this.radius;
      this.updateMovement(mov.invert_z, false, false);
      spawnHitParticles(data.scene, this.pos);
    }
    // Near wall (Z-)
    if (this.near_line <= table.near_line) {
      this.pos.z = table.near_line + this.radius;
      this.updateMovement(mov.invert_z, false, false);
      spawnHitParticles(data.scene, this.pos);
    }

    // Ball out of bounds: scoring
    // Left wall (X-)
    if (this.left_line <= table.left_line) {
      data.score.right++;
      flashZone(data, side.left, table);
      this.throwBall();
    }
    // Right wall (X+)
    if (this.right_line - this.radius >= table.right_line) {
      data.score.left++;
      flashZone(data, side.right, table);
      this.throwBall();
    }
  }

  /* ****************** *
   *  MOVEMENT METHODS  *
   * ****************** */

  /**
   * Respawns the ball at initial position with randomized direction.
   */
  private throwBall() {
    // Randomize initial direction
    const direction: Mov = randomInt(0, 1) ? mov.left : mov.right;

    // Reset properties
    this.velocity = this.speed;
    this.speed = this.initial_speed;
    this.angle = 0;

    // Start moving
    this.move(null!, 0, 0);
    this.updateMovement(direction, true, false);

    // Set respawn timer (e.g., 0.5 seconds)
    this.updateRespawnTimer(0, 0.5);
  }

  /**
   * Updates the position of the ball based on its velocity and angle.
   * @param data - Scene/game state (if null, movement is skipped)
   * @param x - Optional X override
   * @param z - Optional Z override
   */
  private move(data: SceneData, x?: number, z?: number) {
    // Speed modifier for "heaven/hell" mode
    let speed_modifier = 1;
    if (data !== null && data.good_side == side.left) speed_modifier = 2;
    // Convert angle to radians
    const angle_rad = this.angle * Math.PI / 180;
    // Calculate velocity components
    const vx = this.velocity * Math.cos(angle_rad);
    const vz = this.velocity * Math.sin(angle_rad);
    // Update X
    if (x !== undefined) this.pos.x = x;
    else this.pos.x += vx * data.step * speed_modifier;
    // Update Z
    if (z !== undefined) this.pos.z = z;
    else this.pos.z += vz * data.step * speed_modifier;
    // Apply updated position to mesh and recalculate bounds
    this.obj.position.set(this.pos.x, this.pos.y, this.pos.z);
    this.positionUpdate();
  }

  /**
   * Updates the ball's velocity and angle for a new movement direction.
   * @param move - Movement type (enum)
   * @param angle_distortion - Whether to randomize angle
   * @param increase_speed - Whether to increment speed
   */
  private updateMovement(move: Mov, angle_distortion: boolean, increase_speed: boolean) {
    // Manage movement direction
    switch (move) {
      case mov.far:
        this.angle = Math.abs(this.angle);
        break;
      case mov.near:
        this.angle = -Math.abs(this.angle);
        break;
      case mov.left:
        this.velocity = this.speed * -1;
        break;
      case mov.right:
        this.velocity = this.speed * 1;
        break;
      case mov.invert_x:
        this.velocity *= -1;
        break;
      case mov.invert_z:
        this.angle *= -1;
        break;
    }

    // Increase speed up to max_speed
    if (increase_speed && this.speed < this.max_speed) this.speed += 1;

    // Randomize the angle if requested
    if (angle_distortion === true) {
      this.angle = 0;
      this.angle += randomInt(-70, 70);
    }

    // Normalize angle to [-180, 180)
    this.angle = normalizeAngle180(this.angle);
  }

  /* ***************** *
   *  PRIVATE METHODS  *
   * ***************** */

  /**
   * Updates the bounding lines for collision detection.
   */
  private positionUpdate() {
    // X bounds
    this.left_line = this.pos.x - this.radius;
    this.right_line = this.pos.x + this.radius;
    // Y bounds
    this.upper_line = this.pos.y + this.radius;
    this.lower_line = this.pos.y - this.radius;
    // Z bounds
    this.near_line = this.pos.z - this.radius;
    this.far_line = this.pos.z + this.radius;
  }

  /**
   * Handles the respawn timer for the ball. Hides the ball while timer > 0.
   * @param step - Time step to decrement
   * @param time - Optional time to start/resume the respawn timer
   * @returns {boolean} True if timer is active, false if ball should be visible
   */
  private updateRespawnTimer(step: number, time?: number): boolean {
    if (time !== undefined) {
      this.respawn_timer = time;
      this.obj.isVisible = false;
    } else {
      if (this.respawn_timer > 0) {
        this.respawn_timer -= step;
        return true;
      } else {
        this.obj.isVisible = true;
        return false;
      }
    }
    return false;
  }
}