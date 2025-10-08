
import { BABYLON, Table, mov, side, hellMode, GameObject, Vec3, magicEffect, Color3, Color4 } from "../index.js";
import type { Side, Mov, Objects3D, SceneData, GameObjectOptions, ObjectValue, Ball } from "../index.js";

// Paddle options
type PaddleOptions = GameObjectOptions & {
  side: Side;
  speed: ObjectValue<number>;
};

// Paddle: player or bot logic, appearance, and movement
export class Paddle extends GameObject {
  public side: Side;
  public speed: ObjectValue<number>;
  private human: boolean;
  private readonly paddleGood = new Color3(0.04, 0.06, 0.09);
  private readonly paddleBad = new Color3(0.8, 0.01, 0.01);
  private readonly edgeGood = new Color4(0.2, 0.45, 1.0, 1.0);
  private readonly edgeBad = new Color4(1.0, 0.45, 0.2, 1.0);

  constructor(options: PaddleOptions) {
    super(options);
    this.side = options.side;
    this.speed = options.speed;
    this.human = true;
    this.obj = this.createMesh(options.scene);
  }

  // Main update: movement, collision, appearance
  public update(obj: Objects3D, data: SceneData) {
    this.human = this.isHuman(data);
    this.human ? this.handleHuman(data) : this.handleBot(data, obj.balls);
    this.keepWithinTable(obj.table);
    this.updateAppearance(data);
    this.applyEffects(data);
  }

  // Check if this paddle is human-controlled
  private isHuman(data: SceneData) {
    return (this.side == side.left && data.left_player_human) ||
           (this.side == side.right && data.right_player_human);
  }

  // Move paddle by user input
  private handleHuman(data: SceneData) {
    if (this.side == side.left && data.left_paddle_mov != mov.null)
      this.move(data, data.left_paddle_mov, this.speed.value);
    // Add right paddle controls if needed
  }

  // AI: move toward closest ball if approaching
  private handleBot(data: SceneData, balls: Ball[]) {
    const closest = balls.reduce((prev, b) =>
      Math.abs(b.pos.value.x - this.pos.value.x) < Math.abs(prev.pos.value.x - this.pos.value.x) ? b : prev
    );
    if ((this.side == side.left && closest.velocity < 0) ||
        (this.side == side.right && closest.velocity > 0)) {
      this.move(data, this.pos.value.z < closest.pos.value.z ? mov.far : mov.near, this.speed.value);
    }
  }

  // Move paddle along Z axis
  private move(data: SceneData, direction: Mov, speed: number) {
    if (direction === mov.far) this.pos.value.z += speed * data.step;
    if (direction === mov.near) this.pos.value.z -= speed * data.step;
    this.updatePosition();
  }

  // Keep paddle inside table bounds
  private keepWithinTable(table: Table) {
    if (this.limits.far >= table.limits.far)
      this.pos.value.z = table.limits.far - this.dimensions.value.z / 2;
    if (this.limits.near <= table.limits.near)
      this.pos.value.z = table.limits.near + this.dimensions.value.z / 2;
  }

  // Update paddle color and edge based on mode
  private updateAppearance(data: SceneData) {
    const isHell = !!data.is_hell;
    const mat = this.obj.material as BABYLON.StandardMaterial;
    mat.diffuseColor = isHell ? this.paddleBad : this.paddleGood;
    this.obj.edgesColor = isHell ? this.edgeBad : this.edgeGood;
  }

  // Apply magic/hell effects (size, speed)
  private applyEffects(data: SceneData) {
    const effects = data.is_hell ? this.hellEffects : this.magicBallEffects;
    let size_x = 1, size_y = 1, size_z = 1;
    let speed = data.is_hell ? this.speed.original * 2 : this.speed.original;
    for (let effect of effects) {
      if (effect === magicEffect.big) size_z = 2;
      if (effect === magicEffect.small) { size_y = 0.4; size_z = 0.4; }
      if (effect === magicEffect.thick) size_x = 5;
      if (effect === magicEffect.slow) speed = this.speed.original * 0.5;
      if (effect === magicEffect.normal_speed) speed = this.speed.original * 1;
      if (effect === magicEffect.crazy_fast) speed = this.speed.original * 4;
      if (effect === magicEffect.freeze) speed = this.speed.original * 0.1;
    }
    this.changeSize(new Vec3(size_x, size_y, size_z));
    this.speed.value = speed;
    if (data.hell_mode != hellMode.big_balls)
      this.pos.value.x = this.pos.original.x;
  }

  // Create paddle mesh
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
    mat.specularColor = new Color3(0, 0, 0);
    mat.emissiveColor = new Color3(0.09, 0.12, 0.18);
    mat.needDepthPrePass = true;
    mesh.material = mat;
    mesh.enableEdgesRendering();
    mesh.edgesWidth = 6.0;
    mesh.edgesColor = this.edgeGood;
    return mesh;
  }
}