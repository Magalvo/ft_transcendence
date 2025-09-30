import {
  BABYLON,
  Ball,
  Table,
  mov,
  side,
  keyCode,
} from "../index.js";
import type { Side, Vec3, Mov, Objects3D, SceneData } from "../index.js";

/**
 * Options for Paddle construction.
 */
type PaddleOptions = {
  speed: number;
  side: Side;
  pos: BABYLON.Vector3;
  dimensions: Vec3;
  scene: BABYLON.Scene;
};

/**
 * Represents a player or bot paddle.
 */
export class Paddle {
  // Babylon mesh for rendering
  private obj: BABYLON.Mesh;
  // Paddle values
  public dimensions: Vec3;
  public side: Side;
  private speed: number;
  private human: boolean;
  // 3D position and collision bounds
  public pos: BABYLON.Vector3;
  public left_line!: number;
  public right_line!: number;
  public upper_line!: number;
  public lower_line!: number;
  public near_line!: number;
  public far_line!: number;
  // Paddle color settings
  private paddle_color_good: BABYLON.Color3;
  private paddle_color_bad: BABYLON.Color3;
  private edges_color_good: BABYLON.Color4;
  private edges_color_bad: BABYLON.Color4;

  constructor(options: PaddleOptions) {
    this.pos = options.pos;
    this.dimensions = options.dimensions;
    this.side = options.side;
    this.speed = options.speed;
    this.human = true;
    // Color themes for "heaven" and "hell"
    this.paddle_color_good = new BABYLON.Color3(0.04, 0.06, 0.09);
    this.paddle_color_bad = new BABYLON.Color3(0.8, 0.01, 0.01);
    this.edges_color_good = new BABYLON.Color4(0.2, 0.45, 1.0, 1.0);
    this.edges_color_bad = new BABYLON.Color4(1.0, 0.45, 0.2, 1.0);
    this.obj = this.initializePaddle(options.scene);
    this.positionUpdate();
  }

  /* ***************** *
   *  DRAWING METHODS  *
   * ***************** */

  /**
   * Initializes and returns the paddle mesh.
   */
  private initializePaddle(scene: BABYLON.Scene): BABYLON.Mesh {
    const new_paddle = BABYLON.MeshBuilder.CreateBox(
      "paddle",
      { width: this.dimensions.x, depth: this.dimensions.z, height: this.dimensions.y },
      scene
    );
    new_paddle.position.set(this.pos.x, this.pos.y, this.pos.z);

    const paddleMat = new BABYLON.StandardMaterial("paddleMat", scene);
    paddleMat.diffuseColor = this.paddle_color_good;
    paddleMat.alpha = 0.5;
    paddleMat.specularColor = new BABYLON.Color3(0, 0, 0);
    paddleMat.emissiveColor = new BABYLON.Color3(0.09, 0.12, 0.18);
    paddleMat.needDepthPrePass = true;

    new_paddle.material = paddleMat;

    new_paddle.enableEdgesRendering();
    new_paddle.edgesWidth = 6.0;
    new_paddle.edgesColor = this.edges_color_good;

    return new_paddle;
  }

  /* **************** *
   *  PUBLIC METHODS  *
   * **************** */

  /**
   * Updates paddle logic: movement, collisions, color.
   */
  public update(obj: Objects3D, data: SceneData) {
    this.human =
      (this.side == side.left && data.left_player_human) ||
      (this.side == side.right && data.right_player_human);

    // Move paddle (human or bot)
    if (this.human) {
      if (this.side == side.left)
        this.humanMove(data, [keyCode.W, keyCode.A], [keyCode.S, keyCode.D]);
      if (this.side == side.right)
        this.humanMove(data, [keyCode.UP_ARROW, keyCode.RIGHT_ARROW], [keyCode.DOWN_ARROW, keyCode.LEFT_ARROW]);
    } else {
      this.botMove(data, obj.balls);
    }
    // Wall collision and color change
    this.wallCollisions(obj.table);
    this.changeSide(data);
  }

  /* ****************** *
   *  MOVEMENT METHODS  *
   * ****************** */

  /**
   * Bot logic: find closest ball and move towards it if approaching.
   */
  private botMove(data: SceneData, balls: Ball[]) {
    // Find the nearest ball
    let ball = balls[0];
    for (let temp_ball of balls) {
      if (Math.abs(temp_ball.pos.x - this.pos.x) < Math.abs(ball.pos.x - this.pos.x))
        ball = temp_ball;
    }

    // Only track balls moving towards the paddle
    if (this.side == side.left && ball.velocity < 0)
      this.botMove2(data, ball);
    if (this.side == side.right && ball.velocity > 0)
      this.botMove2(data, ball);
  }

  /**
   * Moves the bot paddle towards the ball's z position.
   */
  private botMove2(data: SceneData, ball: Ball) {
    let direction: Mov;
    if (this.pos.z < ball.pos.z)
      direction = mov.far;
    else
      direction = mov.near;
    let speed: number = this.speed;
    this.move(data, direction, speed);
  }

  /**
   * Human movement logic: checks keyboard input arrays for up/down.
   */
  private humanMove(data: SceneData, keys_up: number[], keys_down: number[]) {
    // Move up
    for (let key of keys_up) {
      if (data.keysPressed[key])
        this.move(data, mov.far, this.speed);
    }
    // Move down
    for (let key of keys_down) {
      if (data.keysPressed[key])
        this.move(data, mov.near, this.speed);
    }
  }

  /**
   * Moves the paddle along Z axis.
   */
  private move(data: SceneData, move: Mov, speed: number) {
    // Speed modifier for "heaven/hell" mode
    let speed_modifier = 1;
    if (data !== null && data.good_side == side.left)
      speed_modifier = 2;
    switch (move) {
      case mov.far:
        this.pos.z += speed * data.step * speed_modifier;
        break;
      case mov.near:
        this.pos.z -= speed * data.step * speed_modifier;
        break;
    }
    this.positionUpdate();
  }

  /* ***************** *
   *  PRIVATE METHODS  *
   * ***************** */

  /**
   * Updates the paddle's position and bounding box for collision.
   */
  private positionUpdate() {
    this.obj.position.set(this.pos.x, this.pos.y, this.pos.z);
    this.pos = this.obj.position;
    // X bounds
    this.left_line = this.pos.x - this.dimensions.x / 2;
    this.right_line = this.pos.x + this.dimensions.x / 2;
    // Y bounds
    this.upper_line = this.pos.y + this.dimensions.y / 2;
    this.lower_line = this.pos.y - this.dimensions.y / 2;
    // Z bounds
    this.near_line = this.pos.z - this.dimensions.z / 2;
    this.far_line = this.pos.z + this.dimensions.z / 2;
  }

  /**
   * Prevents paddle from leaving the table.
   */
  private wallCollisions(table: Table) {
    // Far wall
    if (this.far_line >= table.far_line)
      this.pos.z = table.far_line - this.dimensions.z / 2;
    // Near wall
    if (this.near_line <= table.near_line)
      this.pos.z = table.near_line + this.dimensions.z / 2;
  }

  /**
   * Changes paddle color based on camp side.
   */
  private changeSide(data: SceneData) {
    let paddle_color: BABYLON.Color3;
    let edges_color: BABYLON.Color4;
    if (data.good_side == side.right) {
      paddle_color = this.paddle_color_good;
      edges_color = this.edges_color_good;
    } else {
      paddle_color = this.paddle_color_bad;
      edges_color = this.edges_color_bad;
    }
    const mat = this.obj.material as BABYLON.StandardMaterial;
    mat.diffuseColor = paddle_color;
    this.obj.edgesColor = edges_color;
  }
}