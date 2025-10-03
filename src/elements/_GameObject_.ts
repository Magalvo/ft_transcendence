import { BABYLON } from "../index.js";

export type GameObjectOptions = {
  // mandatory
  scene: BABYLON.Scene,
  pos: ObjectValue<BABYLON.Vector3>,
  dimensions: ObjectValue<BABYLON.Vector3>,
}

export type ObjectLimits = {
  left: number,
  right: number,
  upper: number,
  lower: number,
  near: number,
  far: number,
}

export type ObjectValue<T> = {
  value: T,
  readonly original: T
}

export abstract class GameObject {
  // --- mandatory ---
  //
  public obj!: BABYLON.Mesh;
  public scene: BABYLON.Scene;
  // position, dimensions & limits
  public pos: ObjectValue<BABYLON.Vector3>;
  public dimensions: ObjectValue<BABYLON.Vector3>;
  public limits: ObjectLimits = {
    left: 0, right: 0, upper: 0, lower: 0, near: 0, far: 0
  };

  constructor(options: GameObjectOptions) {
    // --- mandatory ---
    this.scene = options.scene;
    // position, dimensions & limits
    this.pos = options.pos;
    this.dimensions = options.dimensions;
    this.updatePosition(); // !
  }

  abstract update(...args: any[]): void;

  dispose() {
    this.obj?.dispose();
  }

  protected updatePosition() {
    this.limitsUpdate();
  }

  private limitsUpdate() {
    // X
    this.limits.left = this.pos.value.x - this.dimensions.value.x / 2;
    this.limits.right = this.pos.value.x + this.dimensions.value.x / 2;
    // Y
    this.limits.upper = this.pos.value.y + this.dimensions.value.y / 2;
    this.limits.lower = this.pos.value.y - this.dimensions.value.y / 2;
    // Z
    this.limits.near = this.pos.value.z - this.dimensions.value.z / 2;
    this.limits.far = this.pos.value.z + this.dimensions.value.z / 2;
  }
}