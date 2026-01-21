import { BABYLON, Vec3, type MagicEffect } from "../../index.js";

/**
 * Options required for GameObject construction.
 */
export type GameObjectOptions = {
  scene: BABYLON.Scene;
  pos: ObjectValue<Vec3>;
  dimensions: ObjectValue<Vec3>;
};

/**
 * Axis-aligned bounding limits for collision and positioning.
 */
export type ObjectLimits = {
  left: number;
  right: number;
  upper: number;
  lower: number;
  near: number;
  far: number;
};

/**
 * Holds a value and its immutable original value (for resets).
 */
export type ObjectValue<T> = {
  value: T;
  readonly original: T;
};

/**
 * Abstract base for all game objects with 3D mesh, position, size, and limits.
 */
export abstract class GameObject {
  public mesh!: BABYLON.Mesh;           // Babylon mesh (must be set in subclass)
  public scene: BABYLON.Scene;         // Reference to scene
  public pos: ObjectValue<Vec3>;       // Position (mutable and original)
  public dimensions: ObjectValue<Vec3>;// Size/scale (mutable and original)
  public limits: ObjectLimits = {      // Bounding box, updated on position/size change
    left: 0, right: 0, upper: 0, lower: 0, near: 0, far: 0
  };
  public hellEffects: MagicEffect[] = [];
  public magicBallEffects: MagicEffect[] = [];

  constructor(options: GameObjectOptions) {
    this.scene = options.scene;
    this.pos = options.pos;
    this.dimensions = options.dimensions;
    this.updatePosition();
  }

  /**
   * Subclasses must implement game update logic.
   */
  abstract update(...args: any[]): void;

  /**
   * Clean up resources.
   */
  dispose() {
    this.mesh?.dispose();
  }

  /**
   * Updates bounding box after a position or size change.
   */
  protected updatePosition() {
    const { x, y, z } = this.pos.value;
    const { x: w, y: h, z: d } = this.dimensions.value;
    this.limits.left = x - w / 2;
    this.limits.right = x + w / 2;
    this.limits.upper = y + h / 2;
    this.limits.lower = y - h / 2;
    this.limits.near = z - d / 2;
    this.limits.far = z + d / 2;
  }

  /**
   * Rescales and updates dimensions for powerups or game modes.
   */
  protected changeSize(scale: Vec3 = new Vec3(1, 1, 1)) {
    this.mesh.scaling.set(scale.x, scale.y, scale.z);
    this.dimensions.value.x = this.dimensions.original.x * scale.x;
    this.dimensions.value.y = this.dimensions.original.y * scale.y;
    this.dimensions.value.z = this.dimensions.original.z * scale.z;
  }
}