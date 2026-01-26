
import {
  BABYLON,
  GameObject,
  Color3,
  Color4,
  type GameData,
  type GameObjectOptions,
  type Side
} from "../../index.js";

type PaddleOptions = GameObjectOptions & {
  side: Side;
};

export class Paddle extends GameObject {
  public side: Side;
  private readonly paddleGood = new Color3(0.04, 0.06, 0.09);
  private readonly edgeGood = new Color4(0.2, 0.45, 1.0, 1.0);
  private readonly paddleBad = new Color3(0.8, 0.01, 0.01);
  private readonly edgeBad = new Color4(1.0, 0.45, 0.2, 1.0);

  constructor(options: PaddleOptions) {
    super(options);
    this.side = options.side;
    this.createMesh(options);
  }

  public update(data: GameData) {
    this.updateAppearance(data);
  }


  private updateAppearance(data: GameData) {
    const isHell = !!data.mods.is_hell;
    const mat = this.mesh.material as BABYLON.StandardMaterial;
    mat.diffuseColor = isHell ? this.paddleBad : this.paddleGood;
    this.mesh.edgesColor = isHell ? this.edgeBad : this.edgeGood;
  }

  private createMesh(options: PaddleOptions) {
    const newMesh = BABYLON.MeshBuilder.CreateBox(
      "paddle",
      {
        width: this.dimensions.x,
        depth: this.dimensions.z,
        height: this.dimensions.y,
      },
      options.scene
    );
    newMesh.position = options.pos;
    const mat = new BABYLON.StandardMaterial("paddleMat", options.scene);
    mat.diffuseColor = this.paddleGood;
    mat.alpha = 0.5;
    mat.specularColor = new Color3(0, 0, 0);
    mat.emissiveColor = new Color3(0.09, 0.12, 0.18);
    mat.needDepthPrePass = true;
    newMesh.material = mat;
    newMesh.enableEdgesRendering();
    newMesh.edgesWidth = 6.0;
    newMesh.edgesColor = this.edgeGood;
    this.mesh = newMesh;
  }
}