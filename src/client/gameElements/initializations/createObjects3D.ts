
import {
  Paddle,
  Table,
  BABYLON,
  Vec3,
  type GameObjects,
  type Side,
  Ball,
  GameConfiguration
} from "../../index.js";

/**
 * Creates all 3D objects (meshes)
 * @param scene 
 * @returns 
 */
export function createObjects3D(scene: BABYLON.Scene, configs: GameConfiguration): GameObjects {
  const table = createTable(scene, configs);
  const balls: Ball[] = [];
  const paddles: Paddle[] = [];

  return { table, balls, paddles };
}

// Create a new Table at the center of the scene
export function createTable(scene: BABYLON.Scene, configs: GameConfiguration): Table {
  const h = 0.5;
  return new Table({
    scene,
    pos: new Vec3(0, -h / 2, 0),
    dimensions: new Vec3(configs.table.width, h, configs.table.depth),
  });
}

// Create a new Paddle at given x and side
export function createPaddle(pos: number, side: Side, scene: BABYLON.Scene): Paddle {
  const h = 6;
  return new Paddle({
    scene,
    pos: new Vec3(pos, h / 2, 0),
    dimensions: new Vec3(0.5, h, 30),
    side,
  });
}

// Create a new Ball at given x, z
export function createPlayingBall(scene: BABYLON.Scene, x: number, z: number): Ball {
  const radius = 2;
  const diameter = radius * 2;
  return new Ball({
    scene,
    pos: new Vec3(x, radius / 2, z),
    dimensions: new Vec3(diameter, diameter, diameter),
    radius: radius
  });
}

// Create a new Ball with given effect at given x, z
export function createMagicBall(scene: BABYLON.Scene, x: number, z: number): Ball {
  const radius = 1.5;
  const diameter = radius * 2;
  return new Ball({
    scene,
    pos: new Vec3(x, radius / 2, z),
    dimensions: new Vec3(diameter, diameter, diameter),
    radius: radius,
  });
}