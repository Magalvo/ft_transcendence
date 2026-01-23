
import { BABYLON, Table, mov, hellMode, GameObject, Vec3, magicEffect, Color3, Color4, PlayingBall } from "../../index.js";
import type { Mov, GameObjects, GameData, GameObjectOptions, ObjectValue, Ball, Side } from "../../index.js";

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
    this.mesh = this.createMesh(options.scene);
  }

  // Main update: movement, collision, appearance
  public update(data: GameData) {
    this.pos.value = this.mesh.position;
    this.keepWithinTable(data.obj3D.table);
    this.updateAppearance(data);
    // this.applyEffects(data);
  }

  // Keep paddle inside table bounds
  private keepWithinTable(table: Table) {
    if (this.limits.far >= table.limits.far)
      this.pos.value.z = table.limits.far - this.dimensions.value.z / 2;
    if (this.limits.near <= table.limits.near)
      this.pos.value.z = table.limits.near + this.dimensions.value.z / 2;
  }

  // Update paddle color and edge based on mode
  private updateAppearance(data: GameData) {
    const isHell = !!data.mods.is_hell;
    const mat = this.mesh.material as BABYLON.StandardMaterial;
    mat.diffuseColor = isHell ? this.paddleBad : this.paddleGood;
    this.mesh.edgesColor = isHell ? this.edgeBad : this.edgeGood;
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