import { BABYLON, GameObject, Color3, Color4, type GameData, type GameObjectOptions, type Side } from "../../index.js";

type PaddleOptions = GameObjectOptions & { side: Side };

export class Paddle extends GameObject {
  public side: Side;
  private nameTexture?: BABYLON.DynamicTexture;
  private _nickname: string = "";

  // Configs
  private readonly C_P_GOOD = new Color3(0.04, 0.06, 0.09);
  private readonly C_E_GOOD = new Color4(0.2, 0.45, 1.0, 1.0);
  private readonly C_P_BAD = new Color3(0.8, 0.01, 0.01);
  private readonly C_E_BAD = new Color4(1.0, 0.45, 0.2, 1.0);

  constructor(opt: PaddleOptions) {
    super(opt);
    this.side = opt.side;
    this.createMesh(opt);
    this.createTag(opt.scene);
  }

  /* --- UPDATE LOOP --- */

  public update(data: GameData, nickname: string) {
    // Appearance
    const isHell = !!data.mods.is_hell;
    const mat = this.mesh.material as BABYLON.StandardMaterial;
    mat.diffuseColor = isHell ? this.C_P_BAD : this.C_P_GOOD;
    this.mesh.edgesColor = isHell ? this.C_E_BAD : this.C_E_GOOD;

    // Nickname
    this.updateNickname(nickname);
  }

  private updateNickname(name: string) {
    if (name === this._nickname || !this.nameTexture) return;
    this._nickname = name;

    // Truncate
    const display = name.length > 15 ? name.substring(0, 12) + "..." : name;

    // Draw (Clear canvas first to avoid overlapping)
    const ctx = this.nameTexture.getContext();
    const { width, height } = this.nameTexture.getSize();
    ctx.clearRect(0, 0, width, height);

    this.nameTexture.drawText(display, null, null, "bold 140px monospace", "black", "transparent", true);
  }

  /* --- INITIALIZATION --- */

  private createMesh(opt: PaddleOptions) {
    this.mesh = BABYLON.MeshBuilder.CreateBox("paddle", {
      width: this.dimensions.x, depth: this.dimensions.z, height: this.dimensions.y,
    }, opt.scene);
    this.mesh.position = opt.pos;
    this.mesh.enableEdgesRendering();
    this.mesh.edgesWidth = 6.0;
    this.mesh.edgesColor = this.C_E_GOOD;

    const mat = new BABYLON.StandardMaterial("paddleMat", opt.scene);
    mat.diffuseColor = this.C_P_GOOD;
    mat.alpha = 0.5;
    mat.specularColor = Color3.Black();
    mat.emissiveColor = new Color3(0.09, 0.12, 0.18);
    this.mesh.material = mat;
  }

  private createTag(scene: BABYLON.Scene) {
    if (!this.mesh) return;

    // 1. Container
    const root = new BABYLON.TransformNode("tagRoot", scene);
    root.parent = this.mesh;
    root.position.y = (this.dimensions.y / 2) + 3.5;

    // Scale compensator (keeps tag size constant relative to world)
    scene.onBeforeRenderObservable.add(() => {
      if (!this.mesh?.scaling || root.isDisposed()) return;
      root.scaling.set(1 / this.mesh.scaling.x, 1 / this.mesh.scaling.y, 1 / this.mesh.scaling.z);
    });

    // 2. Arrow Indicator
    const arrow = BABYLON.MeshBuilder.CreateDisc("arrow", { radius: 0.75, tessellation: 3 }, scene);
    arrow.parent = root;
    arrow.rotation.z = Math.PI;

    const arrowMat = new BABYLON.StandardMaterial("arrowMat", scene);
    arrowMat.emissiveColor = Color3.Black();
    arrowMat.disableLighting = true;
    arrow.material = arrowMat;
    arrow.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;

    // 3. Name Plane (High Res)
    const plane = BABYLON.MeshBuilder.CreatePlane("tag", { width: 24, height: 6 }, scene);
    plane.parent = root;
    plane.position.y = 2.5;
    plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;

    this.nameTexture = new BABYLON.DynamicTexture("nameDT", { width: 1024, height: 256 }, scene);
    this.nameTexture.drawText("", null, null, "bold 140px monospace", "black", "transparent", true);

    const planeMat = new BABYLON.StandardMaterial("nameMat", scene);
    planeMat.diffuseTexture = this.nameTexture;
    planeMat.emissiveColor = Color3.White();
    planeMat.diffuseTexture.hasAlpha = true;
    planeMat.useAlphaFromDiffuseTexture = true;
    planeMat.disableLighting = true;
    plane.material = planeMat;
  }
}