import {
  Ball,
  Paddle,
  Table,
  BABYLON,
  Vec3,
} from "../../index.js";
import type { Side } from "../../index.js";

/* -------------- *
 *  GAME OBJECTS  *
 * -------------- */

/**
 * Creates and returns a new Table object placed at the center of the scene.
 * @param scene - The BabylonJS scene where the table will be added
 * @returns {Table} The created Table instance
 */
export function createTable(scene: BABYLON.Scene): Table {
  const tableHeight = 0.5;
  return new Table({
    scene: scene,
    pos: {
      value: new Vec3(0, -tableHeight / 2, 0),
      original: new Vec3(0, -tableHeight / 2, 0)
    },
    dimensions: {
      value: new Vec3(170, tableHeight, 90),
      original: new Vec3(170, tableHeight, 90),
    },
  });
}

/**
 * Creates and returns a new Paddle object at the specified position and side.
 * @param pos - X position for the paddle
 * @param side - Side (left or right) the paddle belongs to
 * @param scene - The BabylonJS scene where the paddle will be added
 * @returns {Paddle} The created Paddle instance
 */
export function createPaddle(pos: number, side: Side, scene: BABYLON.Scene): Paddle {
  const paddleHeight = 6;
  return new Paddle({
    scene: scene,
    pos: {
      value: new Vec3(pos, paddleHeight / 2, 0),
      original: new Vec3(pos, paddleHeight / 2, 0),
    },
    dimensions: {
      value: new Vec3(1, paddleHeight, 30),
      original: new Vec3(1, paddleHeight, 30),
    },
    side: side,
    speed: {
      value: 50,
      original: 50
    },
  });
}

/**
 * Creates and returns a new Ball object at the specified position.
 * @param pos - X position for the ball
 * @param scene - The BabylonJS scene where the ball will be added
 * @returns {Ball} The created Ball instance
 */
export function createBall(scene: BABYLON.Scene, x: number, z: number): Ball {
  const ball_radius = 2;
  const ball_diameter = ball_radius * 2;
  return new Ball({
    scene: scene,
    pos: {
      value: new Vec3(x, ball_radius / 2, z),
      original: new Vec3(x, ball_radius / 2, z),
    },
    dimensions: {
      value: new Vec3(ball_diameter, ball_diameter, ball_diameter),
      original: new Vec3(ball_diameter, ball_diameter, ball_diameter),
    },
    speed: {
      value: 50,
      original: 50,
      max: 100
    },
    radius: ball_radius
  });
}