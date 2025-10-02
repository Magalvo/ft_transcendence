import { BABYLON } from "../index.js";
import type { SceneData } from "../index.js";

/**
 * Options for Table construction.
 */
type TableOptions = {
  pos: BABYLON.Vector3;
  size: BABYLON.Vector3;
  scene: BABYLON.Scene;
};

/**
 * Represents the game table, including mesh, lines, and center circle.
 */
export class Table {
  // Babylon mesh for rendering
  private obj: BABYLON.Mesh;
  // Visual elements
  private lines!: BABYLON.LinesMesh;
  private circle!: BABYLON.LinesMesh;
  // Table color themes
  private good_color: BABYLON.Color3;
  private bad_color: BABYLON.Color3;
  // Table dimensions and position
  public dimensions: BABYLON.Vector3;
  public pos: BABYLON.Vector3;
  public left_line!: number;
  public right_line!: number;
  public upper_line!: number;
  public lower_line!: number;
  public near_line!: number;
  public far_line!: number;

  constructor(options: TableOptions) {
    this.pos = options.pos;
    this.dimensions = options.size;
    this.good_color = new BABYLON.Color3(0.7, 0.7, 1);
    this.bad_color = new BABYLON.Color3(1, 0.2, 0.2);
    this.obj = this.initializeTable(options.scene);
    this.positionUpdate();
  }

  /* ***************** *
   *  DRAWING METHODS  *
   * ***************** */

  /**
   * Initializes and returns the table mesh, lines, and center circle.
   */
  private initializeTable(scene: BABYLON.Scene): BABYLON.Mesh {
    const new_table = BABYLON.MeshBuilder.CreateBox(
      "table",
      { width: this.dimensions.x, depth: this.dimensions.z, height: this.dimensions.y },
      scene
    );
    new_table.position.x = this.pos.x;
    new_table.position.y = this.pos.y;
    new_table.position.z = this.pos.z;

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
    new_table.material = tableMat;

    // Draw field lines and center circle
    this.drawLines(scene);
    this.drawCircle(scene);

    return new_table;
  }

  /**
   * Draws the field lines on the table surface.
   */
  private drawLines(scene: BABYLON.Scene) {
    const points = [
      new BABYLON.Vector3(this.pos.x, this.pos.y + this.dimensions.y / 2, this.pos.z + this.dimensions.z / 2),
      new BABYLON.Vector3(this.pos.x, this.pos.y + this.dimensions.y / 2, this.pos.z - this.dimensions.z / 2),
      new BABYLON.Vector3(this.pos.x - this.dimensions.x / 2, this.pos.y + this.dimensions.y / 2, this.pos.z - this.dimensions.z / 2),
      new BABYLON.Vector3(this.pos.x - this.dimensions.x / 2, this.pos.y + this.dimensions.y / 2, this.pos.z + this.dimensions.z / 2),
      new BABYLON.Vector3(this.pos.x + this.dimensions.x / 2, this.pos.y + this.dimensions.y / 2, this.pos.z + this.dimensions.z / 2),
      new BABYLON.Vector3(this.pos.x + this.dimensions.x / 2, this.pos.y + this.dimensions.y / 2, this.pos.z - this.dimensions.z / 2),
      new BABYLON.Vector3(this.pos.x, this.pos.y + this.dimensions.y / 2, this.pos.z - this.dimensions.z / 2),
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
    const circleYOffset = this.pos.y + this.dimensions.y / 2 + 0.01;

    const points: BABYLON.Vector3[] = [];
    for (let i = 0; i <= circleSegments; i++) {
      const angle = (2 * Math.PI * i) / circleSegments;
      points.push(
        new BABYLON.Vector3(
          this.pos.x + Math.cos(angle) * circleRadius,
          circleYOffset,
          this.pos.z + Math.sin(angle) * circleRadius
        )
      );
    }

    this.circle = BABYLON.MeshBuilder.CreateLines("centerCircleLine", { points }, scene);
    this.circle.color = this.good_color;
    this.circle.isPickable = false;
    this.circle.alwaysSelectAsActiveMesh = true;
  }

  /* ***************** *
   *  PRIVATE METHODS  *
   * ***************** */

  /**
   * Updates table position and bounding lines.
   */
  private positionUpdate() {
    this.pos = this.obj.position;
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

  /* **************** *
   *  PUBLIC METHODS  *
   * **************** */

  /**
   * Updates the table color theme based on camp side.
   */
  public update(data: SceneData) {
    if (!data.hell_side)
      this.changeTableColors(this.good_color);
    if (data.hell_side)
      this.changeTableColors(this.bad_color);
  }

  /**
   * Changes table, lines, and circle color to match current camp side.
   */
  private changeTableColors(color: BABYLON.Color3) {
    // Base table mesh
    const mat = this.obj.material as BABYLON.PBRMaterial;
    mat.albedoColor = color;
    mat.subSurface.tintColor = color;
    // Lines and circle
    this.lines.color = color;
    this.circle.color = color;
  }

  public flash(color: BABYLON.Color3 = new BABYLON.Color3(0, 0.6, 1), duration: number = 200) {
    const mat = this.obj.material as BABYLON.PBRMaterial;
    if (!mat) return;
    mat.emissiveColor = color;
    setTimeout(() => {
      mat.emissiveColor = BABYLON.Color3.Black();
    }, duration);
  }

}