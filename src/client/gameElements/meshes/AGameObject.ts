import * as BABYLON from "@babylonjs/core";
import { Vector3 as Vec3 } from "@babylonjs/core";

export type GameObjectOptions = {
  scene: BABYLON.Scene;
  pos: Vec3;
  dimensions: Vec3;
};

export type ObjectLimits = {
  left: number;
  right: number;
  upper: number;
  lower: number;
  near: number;
  far: number;
};

export abstract class GameObject {
  public mesh!: BABYLON.Mesh;
  public dimensions: Vec3;
  public limits: ObjectLimits = {
    left: 0, right: 0, upper: 0, lower: 0, near: 0, far: 0
  };

  constructor(options: GameObjectOptions) {
    this.dimensions = options.dimensions;
  }

  abstract update(...args: any[]): void;

  dispose() {
    this.mesh?.dispose();
  }

  protected setLimits() {
    const { x, y, z } = this.mesh.position;
    const { x: w, y: h, z: d } = this.dimensions;
    this.limits.left = x - w / 2;
    this.limits.right = x + w / 2;
    this.limits.upper = y + h / 2;
    this.limits.lower = y - h / 2;
    this.limits.near = z - d / 2;
    this.limits.far = z + d / 2;
  }
}