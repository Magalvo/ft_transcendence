import { BABYLON, GameObject, Vec3 } from "../../index.js";
import { Color3, type GameObjectOptions, type GameData } from "../../index.js";

/**
 * Options for Table construction.
 */
type TableOptions = GameObjectOptions & {
};

/**
 * Represents the game table, including mesh, lines, and center circle.
 */
export class Table extends GameObject {
  // Visual elements
  private lines!: BABYLON.LinesMesh;
  private circle!: BABYLON.LinesMesh;
  // Table color themes
  private good_color: Color3;
  private bad_color: Color3;

  constructor(options: TableOptions) {
    super(options);

    this.pos = options.pos;
    this.dimensions = options.dimensions;
    this.good_color = new Color3(0.7, 0.7, 1);
    this.bad_color = new Color3(1, 0.2, 0.2);
    this.mesh = this.initializeTable(options.scene);
    this.mesh.freezeWorldMatrix();
  }

  /* ***************** *
   *  DRAWING METHODS  *
   * ***************** */

  /**
   * Initializes and returns the table mesh, lines, and center circle.
   */
  private initializeTable(scene: BABYLON.Scene): BABYLON.Mesh {
    const mesh = BABYLON.MeshBuilder.CreateBox(
      "table",
      { width: this.dimensions.value.x, depth: this.dimensions.value.z, height: this.dimensions.value.y },
      scene
    );
    mesh.position = this.pos.value;

    const tableMat = new BABYLON.PBRMaterial("tableGlass", scene);
    tableMat.albedoColor = this.good_color;
    tableMat.alpha = 0.3;
    tableMat.metallic = 0.0;
    tableMat.roughness = 0.05;
    tableMat.indexOfRefraction = 0.4;
    tableMat.subSurface.isRefractionEnabled = true;
    tableMat.subSurface.refractionIntensity = 1;
    tableMat.subSurface.isTranslucencyEnabled = true;
    tableMat.subSurface.translucencyIntensity = 0.2;
    tableMat.subSurface.tintColor = this.good_color;
    tableMat.subSurface.minimumThickness = 0.1;
    tableMat.subSurface.maximumThickness = 1.5;
    // Optionally: assign scene.environmentTexture to tableMat.reflectionTexture
    mesh.material = tableMat;

    // Draw field lines and center circle
    this.drawLines(scene);
    this.drawCircle(scene);

    return mesh;
  }

  /**
   * Draws the field lines on the table surface.
   */
  private drawLines(scene: BABYLON.Scene) {
    const points = [
      new Vec3(this.pos.value.x, this.pos.value.y + this.dimensions.value.y / 2, this.pos.value.z + this.dimensions.value.z / 2),
      new Vec3(this.pos.value.x, this.pos.value.y + this.dimensions.value.y / 2, this.pos.value.z - this.dimensions.value.z / 2),
      new Vec3(this.pos.value.x - this.dimensions.value.x / 2, this.pos.value.y + this.dimensions.value.y / 2, this.pos.value.z - this.dimensions.value.z / 2),
      new Vec3(this.pos.value.x - this.dimensions.value.x / 2, this.pos.value.y + this.dimensions.value.y / 2, this.pos.value.z + this.dimensions.value.z / 2),
      new Vec3(this.pos.value.x + this.dimensions.value.x / 2, this.pos.value.y + this.dimensions.value.y / 2, this.pos.value.z + this.dimensions.value.z / 2),
      new Vec3(this.pos.value.x + this.dimensions.value.x / 2, this.pos.value.y + this.dimensions.value.y / 2, this.pos.value.z - this.dimensions.value.z / 2),
      new Vec3(this.pos.value.x, this.pos.value.y + this.dimensions.value.y / 2, this.pos.value.z - this.dimensions.value.z / 2),
    ];
    this.lines = BABYLON.MeshBuilder.CreateLines("lines", { points }, scene);
    this.lines.color = this.good_color;
  }

  /**
   * Draws a center circle on the table.
   */
  private drawCircle(scene: BABYLON.Scene) {
    const circleRadius = 20;
    const circleSegments = 64;
    const circleYOffset = this.pos.value.y + this.dimensions.value.y / 2 + 0.01;

    const points: Vec3[] = [];
    for (let i = 0; i <= circleSegments; i++) {
      const angle = (2 * Math.PI * i) / circleSegments;
      points.push(
        new Vec3(
          this.pos.value.x + Math.cos(angle) * circleRadius,
          circleYOffset,
          this.pos.value.z + Math.sin(angle) * circleRadius
        )
      );
    }

    this.circle = BABYLON.MeshBuilder.CreateLines("centerCircleLine", { points }, scene);
    this.circle.color = this.good_color;
    this.circle.isPickable = false;
    this.circle.alwaysSelectAsActiveMesh = true;
  }

  /* **************** *
   *  PUBLIC METHODS  *
   * **************** */

  /**
   * Updates the table color theme based on camp side.
   */
  public update(data: GameData) {
    this.updateColor(data);
  }

  private updateColor(data: GameData) {
    if (data.mods.is_hell)
      this.changeTableColors(this.bad_color);
    else
      this.changeTableColors(this.good_color);
  }

  /**
   * Changes table, lines, and circle color to match current camp side.
   */
  private changeTableColors(color: Color3) {
    // Base table mesh
    const mat = this.mesh.material as BABYLON.PBRMaterial;
    mat.albedoColor = color;
    mat.subSurface.tintColor = color;
    // Lines and circle
    this.lines.color = color;
    this.circle.color = color;
  }

  public flash(color: Color3 = new Color3(0, 0.6, 1), duration: number = 200) {
    const mat = this.mesh.material as BABYLON.PBRMaterial;
    if (!mat) return;
    mat.emissiveColor = color;
    setTimeout(() => {
      mat.emissiveColor = Color3.Black();
    }, duration);
  }
}