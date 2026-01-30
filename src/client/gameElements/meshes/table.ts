import {
  BABYLON,
  GameObject,
  Vec3,
  Color3,
  type GameObjectOptions,
  type GameData
} from "../../index.js";

type TableOptions = GameObjectOptions & {
};

/**
 * Represents the game table, including mesh, lines, and center circle.
 */
export class Table extends GameObject {
  private lines!: BABYLON.LinesMesh;
  private circle!: BABYLON.LinesMesh;
  private good_color: Color3;
  private bad_color: Color3;

  constructor(options: TableOptions) {
    super(options);
    this.good_color = new Color3(0.7, 0.7, 1);
    this.bad_color = new Color3(1, 0.2, 0.2);
    this.initializeTable(options);
    this.setLimits();
  }

  /* ***************** *
   * DRAWING METHODS  *
   * ***************** */

  private initializeTable(options: TableOptions) {
    // Create the main glass table surface
    const newMesh = BABYLON.MeshBuilder.CreateBox(
      "table",
      { width: options.dimensions.x, depth: options.dimensions.z, height: options.dimensions.y },
      options.scene
    );
    newMesh.position = options.pos;

    // Apply PBR Material for glass effect
    const tableMat = new BABYLON.PBRMaterial("tableGlass", options.scene);
    tableMat.albedoColor = this.good_color;
    tableMat.alpha = 0.3;
    tableMat.metallic = 0.0;
    tableMat.roughness = 0.05;
    tableMat.indexOfRefraction = 0.4;

    // SubSurface configuration for refraction/translucency
    tableMat.subSurface.isRefractionEnabled = true;
    tableMat.subSurface.refractionIntensity = 1;
    tableMat.subSurface.isTranslucencyEnabled = true;
    tableMat.subSurface.translucencyIntensity = 0.2;
    tableMat.subSurface.tintColor = this.good_color;
    tableMat.subSurface.minimumThickness = 0.1;
    tableMat.subSurface.maximumThickness = 1.5;

    newMesh.freezeWorldMatrix();
    newMesh.material = tableMat;

    this.drawLines(options);
    this.drawCircle(options);

    this.mesh = newMesh;
  }

  private drawLines(options: TableOptions) {
    const points = [
      this.newPoint(options, { y: 0.5, z: 0.5 }),
      this.newPoint(options, { y: 0.5, z: -0.5 }),
      this.newPoint(options, { x: -0.5, y: 0.5, z: -0.5 }),
      this.newPoint(options, { x: -0.5, y: 0.5, z: 0.5 }),
      this.newPoint(options, { x: 0.5, y: 0.5, z: 0.5 }),
      this.newPoint(options, { x: 0.5, y: 0.5, z: -0.5 }),
      this.newPoint(options, { y: 0.5, z: -0.5 }),
    ];
    this.lines = BABYLON.MeshBuilder.CreateLines("lines", { points }, options.scene);
    this.lines.color = this.good_color;
  }

  private newPoint(options: TableOptions, { x = 0, y = 0, z = 0 }): Vec3 {
    return new Vec3(
      options.pos.x + options.dimensions.x * x,
      options.pos.y + options.dimensions.y * y,
      options.pos.z + options.dimensions.z * z
    );
  }

  private drawCircle(options: TableOptions) {
    const circleRadius = 20;
    const circleSegments = 64;
    const circleYOffset = options.pos.y + options.dimensions.y / 2 + 0.01;

    const points: Vec3[] = [];
    for (let i = 0; i <= circleSegments; i++) {
      const angle = (2 * Math.PI * i) / circleSegments;
      points.push(
        new Vec3(
          options.pos.x + Math.cos(angle) * circleRadius,
          circleYOffset,
          options.pos.z + Math.sin(angle) * circleRadius
        )
      );
    }

    this.circle = BABYLON.MeshBuilder.CreateLines("centerCircleLine", { points }, options.scene);
    this.circle.color = this.good_color;
    this.circle.isPickable = false;
    this.circle.alwaysSelectAsActiveMesh = true;
  }

  /* **************** *
   * PUBLIC METHODS  *
   * **************** */

  public update(data: GameData) {
    this.updateColor(data);
  }

  private updateColor(data: GameData) {
    if (data.mods.is_hell)
      this.changeTableColors(this.bad_color);
    else
      this.changeTableColors(this.good_color);
  }

  private changeTableColors(color: Color3) {
    const mat = this.mesh.material as BABYLON.PBRMaterial;
    mat.albedoColor = color;
    mat.subSurface.tintColor = color;
    this.lines.color = color;
    this.circle.color = color;
  }
}