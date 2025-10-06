
import { Paddle, Table, BABYLON, Vec3, PlayingBall } from "../../index.js";
import type { Side } from "../../index.js";

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
  return new Paddle({
    scene,
    pos: { value: new Vec3(pos, h / 2, 0), original: new Vec3(pos, h / 2, 0) },
    dimensions: { value: new Vec3(0.5, h, 30), original: new Vec3(0.5, h, 30) },
    side,
    speed: { value: 50, original: 50 },
  });
}

// Create a new Ball at given x, z
export function createBall(scene: BABYLON.Scene, x: number, z: number): PlayingBall {
  const r = 2, d = r * 2;
  return new PlayingBall({
    scene,
    pos: { value: new Vec3(x, r / 2, z), original: new Vec3(x, r / 2, z) },
    dimensions: { value: new Vec3(d, d, d), original: new Vec3(d, d, d) },
    speed: { value: 50, original: 50, max: 100 },
    radius: r,
  });
}