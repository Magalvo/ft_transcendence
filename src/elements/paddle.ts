import {
  BABYLON,
  Ball,
  Table,
  mov,
  side,
  hellMode,
} from "../index.js";
import type { Side, Mov, Objects3D, SceneData } from "../index.js";

/**
 * Options for Paddle construction.
 */
type PaddleOptions = {
  speed: number;                // Paddle movement speed
  side: Side;                   // Paddle side (left/right)
  pos: BABYLON.Vector3;         // Initial position
  dimensions: BABYLON.Vector3;  // Paddle dimensions
  scene: BABYLON.Scene;         // Babylon.js scene
};

/**
 * Represents a player or bot paddle.
 */
export class Paddle {
  // --- Rendering ---
  /** Babylon mesh for rendering */
  private obj: BABYLON.Mesh;

  // --- Paddle dimensions & position ---
  public original_dimensions: BABYLON.Vector3;  // Unmodified paddle size
  public dimensions: BABYLON.Vector3;           // Current paddle size (may change due to powerups/mods)
  public pos: BABYLON.Vector3;                  // Paddle position

  // --- Side & movement ---
  public side: Side;                // Paddle side (left/right)
  private original_speed: number;   // Default movement speed
  private speed: number;            // Current movement speed (may change due to powerups/mods)
  private human: boolean;           // Is this paddle controlled by a human?

  // --- Collision bounds (calculated each update) ---
  public left_line!: number;
  public right_line!: number;
  public upper_line!: number;
  public lower_line!: number;
  public near_line!: number;
  public far_line!: number;

  // --- Appearance (color themes) ---
  private paddle_color_good: BABYLON.Color3;
  private paddle_color_bad: BABYLON.Color3;
  private edges_color_good: BABYLON.Color4;
  private edges_color_bad: BABYLON.Color4;

  /**
   * Constructs a new Paddle.
   */
  constructor(options: PaddleOptions) {
    // Set position & dimensions (clone to avoid shared references)
    this.pos = options.pos.clone();
    this.original_dimensions = options.dimensions.clone();
    this.dimensions = options.dimensions.clone();

    // Set movement and side
    this.side = options.side;
    this.original_speed = options.speed;
    this.speed = options.speed;
    this.human = true;

    // Color schemes for "heaven" (good) and "hell" (bad) sides
    this.paddle_color_good = new BABYLON.Color3(0.04, 0.06, 0.09);
    this.paddle_color_bad = new BABYLON.Color3(0.8, 0.01, 0.01);
    this.edges_color_good = new BABYLON.Color4(0.2, 0.45, 1.0, 1.0);
    this.edges_color_bad = new BABYLON.Color4(1.0, 0.45, 0.2, 1.0);

    // Create the mesh and place it
    this.obj = this.initializePaddle(options.scene);
    this.positionUpdate();
  }

  // ======================
  //   DRAWING METHODS
  // ======================

  /**
   * Initializes and returns the paddle mesh.
   */
  private initializePaddle(scene: BABYLON.Scene): BABYLON.Mesh {
    // Create a box mesh for the paddle
    const new_paddle = BABYLON.MeshBuilder.CreateBox(
      "paddle",
      { width: this.dimensions.x, depth: this.dimensions.z, height: this.dimensions.y },
      scene
    );
    new_paddle.position.set(this.pos.x, this.pos.y, this.pos.z);

    // Material setup
    const paddleMat = new BABYLON.StandardMaterial("paddleMat", scene);
    paddleMat.diffuseColor = this.paddle_color_good;
    paddleMat.alpha = 0.5;
    paddleMat.specularColor = new BABYLON.Color3(0, 0, 0);
    paddleMat.emissiveColor = new BABYLON.Color3(0.09, 0.12, 0.18);
    paddleMat.needDepthPrePass = true;

    new_paddle.material = paddleMat;

    // Edges rendering
    new_paddle.enableEdgesRendering();
    new_paddle.edgesWidth = 6.0;
    new_paddle.edgesColor = this.edges_color_good;

    return new_paddle;
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
      if (Math.abs(temp_ball.pos.x - this.pos.x) < Math.abs(ball.pos.x - this.pos.x))
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
    if (this.pos.z < ball.pos.z) direction = mov.far;
    else direction = mov.near;

    this.move(data, direction, this.speed);
  }

  /**
   * Human-controlled movement: checks for keyboard input.
   */
  private humanMove(data: SceneData) {
    if (this.side == side.left && data.left_paddle_mov != mov.null)
      this.move(data, data.left_paddle_mov, this.speed);
  }

  /**
   * Moves the paddle along the Z axis.
   */
  private move(data: SceneData, move: Mov, speed: number) {
    switch (move) {
      case mov.far:
        this.pos.z += speed * data.step;
        break;
      case mov.near:
        this.pos.z -= speed * data.step;
        break;
    }
    this.positionUpdate();
  }

  // ======================
  //    PRIVATE METHODS
  // ======================

  /**
   * Updates the paddle's position and bounding box for collision detection.
   */
  private positionUpdate() {
    this.obj.position.set(this.pos.x, this.pos.y, this.pos.z);
    this.pos = this.obj.position;

    // Calculate bounding lines for collision checks
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
   * Prevents paddle from leaving the table along the Z axis.
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
    if (data.hell_mode == hellMode.smaller_paddles)
      this.changeSize({ z: this.original_dimensions.z * 0.4 });
    else
      this.changeSize();

    // --- Speed Update (hell side & mode) ---
    if (data.hell_mode == hellMode.slow_paddles)
      this.speed = this.original_speed * 0.5;
    else if (data.hell_side)
      this.speed = this.original_speed * 2;
    else
      this.speed = this.original_speed;
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
    const width = options.x ?? this.original_dimensions.x;
    const height = options.y ?? this.original_dimensions.y;
    const depth = options.z ?? this.original_dimensions.z;

    // Set mesh scaling to match requested absolute size
    mesh.scaling.x = width / size.x;
    mesh.scaling.y = height / size.y;
    mesh.scaling.z = depth / size.z;

    // Update dimensions properties
    this.dimensions.x = width;
    this.dimensions.y = height;
    this.dimensions.z = depth;
  }
}