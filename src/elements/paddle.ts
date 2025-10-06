import {
  BABYLON,
  Table,
  mov,
  side,
  hellMode,
  GameObject,
  Vec3,
  magicEffect,
} from "../index.js";
import type {
  Side,
  Mov,
  Objects3D,
  SceneData,
  GameObjectOptions,
  ObjectValue,
  Ball,
  MagicEffect,
} from "../index.js";

/**
 * PaddleOptions extends base GameObjectOptions to add
 * paddle-specific properties.
 */
type PaddleOptions = GameObjectOptions & {
  side: Side;
  speed: ObjectValue<number>;
};

/**
 * Paddle class: Controls player or bot paddle logic,
 * appearance, and interactions with the table and balls.
 */
export class Paddle extends GameObject {
  // --- Core properties ---
  public side: Side;
  public speed: ObjectValue<number>;
  private human: boolean;

  // --- Visual properties for themes ---
  private readonly paddleGood: BABYLON.Color3 = new BABYLON.Color3(0.04, 0.06, 0.09);
  private readonly paddleBad: BABYLON.Color3 = new BABYLON.Color3(0.8, 0.01, 0.01);
  private readonly edgeGood: BABYLON.Color4 = new BABYLON.Color4(0.2, 0.45, 1.0, 1.0);
  private readonly edgeBad: BABYLON.Color4 = new BABYLON.Color4(1.0, 0.45, 0.2, 1.0);

  /**
   * Constructor initializes paddle with visual style,
   * side, speed, and mesh creation.
   */
  constructor(options: PaddleOptions) {
    super(options);
    this.side = options.side;
    this.speed = options.speed;
    this.human = true;

    // Create paddle mesh
    this.obj = this.createMesh(options.scene);
  }

  /**
   * Creates the paddle mesh with initial styling and edge rendering.
   */
  private createMesh(scene: BABYLON.Scene): BABYLON.Mesh {
    const mesh = BABYLON.MeshBuilder.CreateBox(
      "paddle",
      {
        width: this.dimensions.value.x,
        depth: this.dimensions.value.z,
        height: this.dimensions.value.y,
      },
      scene
    );
    mesh.position = this.pos.value;

    const mat = new BABYLON.StandardMaterial("paddleMat", scene);
    mat.diffuseColor = this.paddleGood;
    mat.alpha = 0.5;
    mat.specularColor = new BABYLON.Color3(0, 0, 0);
    mat.emissiveColor = new BABYLON.Color3(0.09, 0.12, 0.18);
    mat.needDepthPrePass = true;
    mesh.material = mat;

    mesh.enableEdgesRendering();
    mesh.edgesWidth = 6.0;
    mesh.edgesColor = this.edgeGood;

    return mesh;
  }

  /**
   * Main update function: Handles movement, collision,
   * and appearance logic each frame.
   */
  public update(obj: Objects3D, data: SceneData) {
    // Determine if user or AI controls this paddle
    this.human =
      (this.side == side.left && data.left_player_human) ||
      (this.side == side.right && data.right_player_human);

    // Move paddle according to control type
    this.human
      ? this.handleHumanMovement(data)
      : this.handleBotMovement(data, obj.balls);

    this.keepWithinTable(obj.table);
    this.updateAppearance(data);
    if (data.is_hell)
      this.handleEffects(this.hellEffects, data);
    else
      this.handleEffects(this.magicBallEffects, data);
  }

  // ====== MOVEMENT LOGIC ======

  /**
   * AI: Move toward the closest ball if it's coming toward this paddle.
   */
  private handleBotMovement(data: SceneData, balls: Ball[]) {
    // Find closest ball along x-axis
    let closest = balls.reduce((prev, b) =>
      Math.abs(b.pos.value.x - this.pos.value.x) <
        Math.abs(prev.pos.value.x - this.pos.value.x)
        ? b
        : prev
    );

    // Only move if the ball is approaching
    if (
      (this.side == side.left && closest.velocity < 0) ||
      (this.side == side.right && closest.velocity > 0)
    ) {
      this.moveTowardBall(data, closest);
    }
  }

  /**
   * Bot moves toward the ball's Z position.
   */
  private moveTowardBall(data: SceneData, ball: Ball) {
    const direction: Mov =
      this.pos.value.z < ball.pos.value.z ? mov.far : mov.near;
    this.move(data, direction, this.speed.value);
  }

  /**
   * Handles user keyboard input for movement.
   */
  private handleHumanMovement(data: SceneData) {
    if (
      this.side == side.left &&
      data.left_paddle_mov != mov.null
    ) {
      this.move(data, data.left_paddle_mov, this.speed.value);
    }
    // Right paddle controls can be added similarly if needed
  }

  /**
   * Move the paddle along the Z axis.
   */
  private move(data: SceneData, direction: Mov, speed: number) {
    if (direction === mov.far) this.pos.value.z += speed * data.step;
    if (direction === mov.near) this.pos.value.z -= speed * data.step;
    this.updatePosition();
  }

  // ====== COLLISION & APPEARANCE ======

  /**
   * Prevents the paddle from moving outside the table along the Z axis.
   */
  private keepWithinTable(table: Table) {
    if (this.limits.far >= table.limits.far)
      this.pos.value.z = table.limits.far - this.dimensions.value.z / 2;
    if (this.limits.near <= table.limits.near)
      this.pos.value.z = table.limits.near + this.dimensions.value.z / 2;
  }

  /**
   * Updates paddle color, size, and speed based on game mode and side.
   */
  private updateAppearance(data: SceneData) {
    // Choose color scheme based on hell_side
    const isHell = !!data.is_hell;
    const mat = this.obj.material as BABYLON.StandardMaterial;
    mat.diffuseColor = isHell ? this.paddleBad : this.paddleGood;
    this.obj.edgesColor = isHell ? this.edgeBad : this.edgeGood;
  }

  private handleEffects(effects: MagicEffect[], data: SceneData) {
    let size_x: number = 1;
    let size_y: number = 1;
    let size_z: number = 1;
    let speed: number =
      (data.is_hell)
        ? this.speed.original * 2
        : this.speed.original;

    for (let effect of effects) {
      switch (effect) {
        case magicEffect.big:
          size_z = 3; break;
        case magicEffect.small:
          size_y = 0.4; size_z = 0.4; break;
        case magicEffect.thick:
          size_x = 3; break;
        case magicEffect.slow:
          speed = this.speed.original * 0.5; break;
        case magicEffect.medium_fast:
          speed = this.speed.original * 1.5; break;
        case magicEffect.crazy_fast:
          speed = this.speed.original * 4; break;
      }
    }
    this.changeSize(new Vec3(size_x, size_y, size_z));
    this.speed.value = speed;

    // Adjust X position if not in big_balls mode
    if (data.hell_mode != hellMode.big_balls)
      this.pos.value.x = this.pos.original.x;
  }
}