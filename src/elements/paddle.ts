import {
  BABYLON,
  Ball,
  Table,
  mov,
  side,
  hellMode,
  GameObject,
} from "../index.js";
import type { Side, Mov, Objects3D, SceneData, GameObjectOptions, ObjectValue } from "../index.js";

/**
 * Options for Paddle construction.
 */
type PaddleOptions = GameObjectOptions & {
  side: Side;
  speed: ObjectValue<number>,
};

/**
 * Represents a player or bot paddle.
 */
export class Paddle extends GameObject {

  // --- Side & movement ---
  public side: Side;
  private human: boolean;
  public speed: ObjectValue<number>;

  // --- Appearance (color themes) ---
  private paddle_color_good: BABYLON.Color3;
  private paddle_color_bad: BABYLON.Color3;
  private edges_color_good: BABYLON.Color4;
  private edges_color_bad: BABYLON.Color4;

  /**
   * Constructs a new Paddle.
   */
  constructor(options: PaddleOptions) {
    super(options)

    this.side = options.side;
    this.human = true;
    this.speed = options.speed;

    // Color schemes for "heaven" (good) and "hell" (bad) sides
    this.paddle_color_good = new BABYLON.Color3(0.04, 0.06, 0.09);
    this.paddle_color_bad = new BABYLON.Color3(0.8, 0.01, 0.01);
    this.edges_color_good = new BABYLON.Color4(0.2, 0.45, 1.0, 1.0);
    this.edges_color_bad = new BABYLON.Color4(1.0, 0.45, 0.2, 1.0);

    // Create the mesh and place it
    this.obj = this.initializePaddle(options.scene);
  }

  // ======================
  //   DRAWING METHODS
  // ======================

  /**
   * Initializes and returns the paddle mesh.
   */
  private initializePaddle(scene: BABYLON.Scene): BABYLON.Mesh {
    // Create a box mesh for the paddle
    const mesh = BABYLON.MeshBuilder.CreateBox(
      "paddle",
      { width: this.dimensions.value.x, depth: this.dimensions.value.z, height: this.dimensions.value.y },
      scene
    );
    mesh.position = this.pos.value;

    // Material setup
    const paddleMat = new BABYLON.StandardMaterial("paddleMat", scene);
    paddleMat.diffuseColor = this.paddle_color_good;
    paddleMat.alpha = 0.5;
    paddleMat.specularColor = new BABYLON.Color3(0, 0, 0);
    paddleMat.emissiveColor = new BABYLON.Color3(0.09, 0.12, 0.18);
    paddleMat.needDepthPrePass = true;

    mesh.material = paddleMat;

    // Edges rendering
    mesh.enableEdgesRendering();
    mesh.edgesWidth = 6.0;
    mesh.edgesColor = this.edges_color_good;

    return mesh;
  }

  // ======================
  //    PUBLIC METHODS
  // ======================

  /**
   * Updates paddle logic: movement, collisions, and color.
   */
  public update(obj: Objects3D, data: SceneData) {
    // Determine if paddle is human-controlled
    this.human =
      (this.side == side.left && data.left_player_human) ||
      (this.side == side.right && data.right_player_human);

    // Move paddle (either human or bot logic)
    if (this.human) this.humanMove(data);
    else this.botMove(data, obj.balls);

    // Handle wall collisions and color/size changes
    this.wallCollisions(obj.table);
    this.hellUpdate(data);
  }

  // ======================
  //   MOVEMENT METHODS
  // ======================

  /**
   * Bot AI: finds the closest ball and moves toward it if the ball is approaching.
   */
  private botMove(data: SceneData, balls: Ball[]) {
    // Find the ball closest (in x) to the paddle
    let ball = balls[0];
    for (let temp_ball of balls) {
      if (Math.abs(temp_ball.pos.value.x - this.pos.value.x) < Math.abs(ball.pos.value.x - this.pos.value.x))
        ball = temp_ball;
    }

    // Only track balls moving toward the paddle
    if (this.side == side.left && ball.velocity < 0)
      this.botMove2(data, ball);
    if (this.side == side.right && ball.velocity > 0)
      this.botMove2(data, ball);
  }

  /**
   * Moves the bot paddle toward the ball's z position.
   */
  private botMove2(data: SceneData, ball: Ball) {
    let direction: Mov;
    if (this.pos.value.z < ball.pos.value.z) direction = mov.far;
    else direction = mov.near;

    this.move(data, direction, this.speed.value);
  }

  /**
   * Human-controlled movement: checks for keyboard input.
   */
  private humanMove(data: SceneData) {
    if (this.side == side.left && data.left_paddle_mov != mov.null)
      this.move(data, data.left_paddle_mov, this.speed.value);
  }

  /**
   * Moves the paddle along the Z axis.
   */
  private move(data: SceneData, move: Mov, speed: number) {
    switch (move) {
      case mov.far:
        this.pos.value.z += speed * data.step;
        break;
      case mov.near:
        this.pos.value.z -= speed * data.step;
        break;
    }
    this.updatePosition();
  }

  // ======================
  //    PRIVATE METHODS
  // ======================

  /**
   * Prevents paddle from leaving the table along the Z axis.
   */
  private wallCollisions(table: Table) {
    // Far wall
    if (this.limits.far >= table.limits.far)
      this.pos.value.z = table.limits.far - this.dimensions.value.z / 2;
    // Near wall
    if (this.limits.near <= table.limits.near)
      this.pos.value.z = table.limits.near + this.dimensions.value.z / 2;
  }

  /**
   * Updates paddle appearance and attributes based on "hell" mode and side.
   */
  private hellUpdate(data: SceneData) {
    // --- Color Update (side) ---
    let paddle_color: BABYLON.Color3;
    let edges_color: BABYLON.Color4;
    if (!data.hell_side) {
      paddle_color = this.paddle_color_good;
      edges_color = this.edges_color_good;
    } else {
      paddle_color = this.paddle_color_bad;
      edges_color = this.edges_color_bad;
    }
    const mat = this.obj.material as BABYLON.StandardMaterial;
    mat.diffuseColor = paddle_color;
    this.obj.edgesColor = edges_color;

    // --- Size Update (hell mode) ---
    if (data.hell_mode == hellMode.small_paddles)
      this.changeSize({ z: this.dimensions.original.z * 0.4 });
    else
      this.changeSize();

    // --- Speed Update (hell side & mode) ---
    if (data.hell_mode == hellMode.slow_paddles)
      this.speed.value = this.speed.original * 0.5;
    else if (data.hell_side)
      this.speed.value = this.speed.original * 2;
    else
      this.speed.value = this.speed.original;

    // --- Change position (hell mode) ---
    if (data.hell_mode != hellMode.big_balls)
      this.pos.value.x = this.pos.original.x;
  }

  /**
   * Changes the paddle's size in world units. Only specified axes are changed.
   * @param options - Object with x, y, z properties to override dimensions.
   */
  private changeSize(options: {
    x?: number,
    y?: number,
    z?: number
  } = {}) {
    const mesh = this.obj;
    const boundingInfo = mesh.getBoundingInfo();
    const size = boundingInfo.maximum.subtract(boundingInfo.minimum);

    // Use original dimensions if not overridden
    const width = options.x ?? this.dimensions.original.x;
    const height = options.y ?? this.dimensions.original.y;
    const depth = options.z ?? this.dimensions.original.z;

    // Set mesh scaling to match requested absolute size
    mesh.scaling.x = width / size.x;
    mesh.scaling.y = height / size.y;
    mesh.scaling.z = depth / size.z;

    // Update dimensions properties
    this.dimensions.value.x = width;
    this.dimensions.value.y = height;
    this.dimensions.value.z = depth;
  }
}