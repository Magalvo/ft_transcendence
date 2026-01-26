import {
  BABYLON,
  GameObject,
  Color3,
  type GameObjectOptions,
} from "../../index.js";

export type BallOptions = GameObjectOptions & {
  radius: number;
};

export class Ball extends GameObject {
  public speed_modifier = 1;
  public angle = 0;
  public velocity = 0;
  public respawn_timer = 0;
  public flame_animation!: BABYLON.ParticleSystem;

  constructor(options: BallOptions) {
    super(options);
    this.createMesh(options);
  }

  protected createMesh(options: BallOptions) {
    const newMesh = BABYLON.MeshBuilder.CreateSphere(
      "ball",
      { diameter: options.radius * 2, segments: 32 },
      options.scene
    );
    newMesh.position = options.pos;
    const mat = new BABYLON.StandardMaterial("ballMat", options.scene);
    mat.diffuseColor = new Color3(0.8, 0.95, 1.0);
    mat.alpha = 0.8;
    mat.specularColor = new Color3(0, 0, 0);
    mat.emissiveColor = new Color3(0.09, 0.12, 0.18);
    mat.needDepthPrePass = true;
    newMesh.material = mat;
    this.mesh = newMesh;
  }

  public update() { };
}