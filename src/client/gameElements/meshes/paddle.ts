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
  private nameTexture?: BABYLON.DynamicTexture;
  private nickname: string = "";

  constructor(options: PaddleOptions) {
    super(options);
    this.side = options.side;
    this.createMesh(options);
    this.createNameTag(options.scene);
  }

  public update(data: GameData, nickname:string) {
    this.updateAppearance(data);
    this.updateNickname(nickname);
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

  private updateNickname(newName: string) {
    if (newName == this.nickname) return;
    this.nickname = newName;
    if (!this.nameTexture || !this.mesh) return;
    let displayNick = newName;
    if (displayNick.length > 15) {
      displayNick = displayNick.substring(0, 12) + "...";
    }

    const ctx = this.nameTexture.getContext();
    const size = this.nameTexture.getSize();
    ctx.clearRect(0, 0, size.width, size.height);

    const font = "bold 140px monospace";
    this.nameTexture.drawText(displayNick, null, null, font, "black", "transparent", true);
  }

  private createNameTag(scene: BABYLON.Scene) {
    if (!this.mesh) return;
    const tagRoot = new BABYLON.TransformNode("tagRoot", scene);
    tagRoot.parent = this.mesh;

    const tagHeight = 3.5;
    tagRoot.position.y = (this.dimensions.y / 2) + tagHeight;

    // --- 3. Lógica de Escala Independente ---
    scene.onBeforeRenderObservable.add(() => {
      if (!this.mesh || this.mesh.isDisposed() || tagRoot.isDisposed()) return;
      tagRoot.scaling.x = 1 / this.mesh!.scaling.x;
      tagRoot.scaling.y = 1 / this.mesh!.scaling.y;
      tagRoot.scaling.z = 1 / this.mesh!.scaling.z;
    });

    // --- 4. Seta ---
    const arrowSize = 1.5;
    const arrow = BABYLON.MeshBuilder.CreateDisc("arrowTag", {
      radius: arrowSize / 2,
      tessellation: 3,
    }, scene);
    arrow.parent = tagRoot;
    arrow.position.y = 0;
    arrow.rotation.z = Math.PI;

    const arrowMat = new BABYLON.StandardMaterial("arrowMat", scene);
    arrowMat.emissiveColor = Color3.Black();
    arrowMat.disableLighting = true;
    arrow.material = arrowMat;
    arrow.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;

    // --- 5. Texto (CORREÇÃO DE TAMANHO) ---

    // Aumentámos o plano 3D para ser mais largo (ratio 4:1)
    const planeWidth = 24;
    const planeHeight = 6;

    const plane = BABYLON.MeshBuilder.CreatePlane("nameTag", {
      width: planeWidth,
      height: planeHeight
    }, scene);
    plane.parent = tagRoot;
    plane.position.y = 2.5;

    // Aumentámos drasticamente a resolução da textura
    // 1024px de largura garante que 15 letras cabem à vontade
    const dtWidth = 1024;
    const dtHeight = 256; // Mantemos o ratio 4:1 (1024/256 = 4) para o texto não esticar

    this.nameTexture = new BABYLON.DynamicTexture("nameDT", { width: dtWidth, height: dtHeight }, scene);

    // Fonte grande para ficar nítida na textura de alta resolução
    const font = "bold 140px monospace";

    // drawText centralizado (null, null)
    this.nameTexture.drawText("", null, null, font, "black", "transparent", true);

    const planeMat = new BABYLON.StandardMaterial("nameMat", scene);
    planeMat.diffuseTexture = this.nameTexture;
    planeMat.emissiveColor = Color3.White();
    planeMat.diffuseTexture.hasAlpha = true;
    planeMat.disableLighting = true;
    planeMat.useAlphaFromDiffuseTexture = true;

    plane.material = planeMat;
    plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
  }
}