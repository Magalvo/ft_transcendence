
import { Paddle, Table, BABYLON, Vec3, PlayingBall, type GameObjects } from "../../index.js";
import { MagicBall, type MagicEffect, type Side } from "../../index.js";

/**
 * Creates all 3D objects (meshes)
 * @param scene 
 * @returns 
 */
export function createObjects3D(scene: BABYLON.Scene): GameObjects {
  const table = createTable(scene);
  const balls = [
    createPlayingBall(scene, table.pos.value.x, table.pos.value.z),
  ];
  const paddles = [
    createPaddle(table.limits.left * 0.8, "left", scene),
    createPaddle(table.limits.right * 0.8, "right", scene),
  ];

  return { table, balls, paddles };
}

// Create a new Table at the center of the scene
export function createTable(scene: BABYLON.Scene): Table {
  const h = 0.5;
  return new Table({
    scene,
    pos: { value: new Vec3(0, -h / 2, 0), original: new Vec3(0, -h / 2, 0) },
    dimensions: { value: new Vec3(170, h, 90), original: new Vec3(170, h, 90) },
  });
}

// Create a new Paddle at given x and side
export function createPaddle(pos: number, side: Side, scene: BABYLON.Scene): Paddle {
  const h = 6;
  const speed = 60;
  return new Paddle({
    scene,
    pos: { value: new Vec3(pos, h / 2, 0), original: new Vec3(pos, h / 2, 0) },
    dimensions: { value: new Vec3(0.5, h, 30), original: new Vec3(0.5, h, 30) },
    side,
    speed: { value: speed, original: speed },
  });
}

// Create a new Ball at given x, z
export function createPlayingBall(scene: BABYLON.Scene, x: number, z: number): PlayingBall {
  const r = 2, d = r * 2;
  const speed = 50;
  return new PlayingBall({
    scene,
    pos: { value: new Vec3(x, r / 2, z), original: new Vec3(x, r / 2, z) },
    dimensions: { value: new Vec3(d, d, d), original: new Vec3(d, d, d) },
    speed: { value: speed, original: speed, max: speed * 2 },
    radius: r,
  });
}

// Create a new Ball with given effect at given x, z
export function createMagicBall(scene: BABYLON.Scene, x: number, z: number, effect: MagicEffect): MagicBall {
  const r = 1.5, d = r * 2;
  const speed = 40;
  return new MagicBall({
    scene,
    pos: { value: new Vec3(x, r / 2, z), original: new Vec3(x, r / 2, z) },
    dimensions: { value: new Vec3(d, d, d), original: new Vec3(d, d, d) },
    speed: { value: speed, original: speed, max: speed },
    radius: r,
    effect,
  });
}