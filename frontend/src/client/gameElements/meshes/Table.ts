import { BABYLON, GameObject, Vec3, Color3, type GameObjectOptions, type GameData } from "../../index.js";

export class Table extends GameObject {
  private lines!: BABYLON.LinesMesh;
  private circle!: BABYLON.LinesMesh;

  // Configs
  private readonly COL_GOOD = new Color3(0.7, 0.7, 1);
  private readonly COL_BAD = new Color3(1, 0.2, 0.2);
  private _lastHellState = false;

  constructor(options: GameObjectOptions) {
    super(options);
    this.createTableMesh(options);
    this.createMarkings(options);
    this.setLimits(); // Inherited from GameObject
    this.applyColor(this.COL_GOOD); // Initial state
  }

  /* --- INITIALIZATION --- */

  private createTableMesh(opt: GameObjectOptions) {
    // 1. Surface Mesh
    this.mesh = BABYLON.MeshBuilder.CreateBox("table", {
      width: opt.dimensions.x, depth: opt.dimensions.z, height: opt.dimensions.y
    }, opt.scene);
    this.mesh.position = opt.pos;
    this.mesh.freezeWorldMatrix();

    // 2. Glass Material (PBR)
    const mat = new BABYLON.PBRMaterial("tableGlass", opt.scene);
    mat.alpha = 0.3;
    mat.metallic = 0.0;
    mat.roughness = 0.05;
    mat.indexOfRefraction = 0.4;

    // Refraction & Translucency
    mat.subSurface.isRefractionEnabled = true;
    mat.subSurface.refractionIntensity = 1;
    mat.subSurface.isTranslucencyEnabled = true;
    mat.subSurface.translucencyIntensity = 0.2;
    mat.subSurface.minimumThickness = 0.1;
    mat.subSurface.maximumThickness = 1.5;

    this.mesh.material = mat;
  }

  private createMarkings(opt: GameObjectOptions) {
    const { x: w, y: h, z: d } = opt.dimensions;
    const { x: px, y: py, z: pz } = opt.pos;
    const y = py + h * 0.5; // Top surface Y

    // 1. Lines (Net + Borders)
    // Path: TopCenter -> BotCenter -> BotLeft -> TopLeft -> TopRight -> BotRight -> BotCenter
    const points = [
      new Vec3(px, y, pz + d * 0.5),          // Top Center
      new Vec3(px, y, pz - d * 0.5),          // Bot Center
      new Vec3(px - w * 0.5, y, pz - d * 0.5),// Bot Left
      new Vec3(px - w * 0.5, y, pz + d * 0.5),// Top Left
      new Vec3(px + w * 0.5, y, pz + d * 0.5),// Top Right
      new Vec3(px + w * 0.5, y, pz - d * 0.5),// Bot Right
      new Vec3(px, y, pz - d * 0.5)           // Bot Center (Close loop)
    ];
    this.lines = BABYLON.MeshBuilder.CreateLines("lines", { points }, opt.scene);

    // 2. Center Circle
    const cPoints: Vec3[] = [];
    const segs = 64, rad = 20;
    for (let i = 0; i <= segs; i++) {
      const angle = (Math.PI * 2 * i) / segs;
      cPoints.push(new Vec3(px + Math.cos(angle) * rad, y + 0.01, pz + Math.sin(angle) * rad));
    }
    this.circle = BABYLON.MeshBuilder.CreateLines("circle", { points: cPoints }, opt.scene);
    this.circle.isPickable = false;
  }

  /* --- UPDATE LOOP --- */

  public update(data: GameData) {
    if (this._lastHellState !== data.mods.is_hell) {
      this._lastHellState = data.mods.is_hell;
      this.applyColor(this._lastHellState ? this.COL_BAD : this.COL_GOOD);
    }
  }

  private applyColor(c: Color3) {
    const mat = this.mesh.material as BABYLON.PBRMaterial;
    mat.albedoColor = c;
    mat.subSurface.tintColor = c;
    this.lines.color = c;
    this.circle.color = c;
  }
}