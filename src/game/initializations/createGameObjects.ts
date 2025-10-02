import {
  Ball,
  Paddle,
  Table,
  BABYLON,
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
    pos: new BABYLON.Vector3(0, -tableHeight / 2, 0),
    size: new BABYLON.Vector3(170, tableHeight, 90),
    scene: scene,
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
    speed: 50,
    side: side,
    pos: new BABYLON.Vector3(pos, paddleHeight / 2, 0),
    dimensions: new BABYLON.Vector3(1, paddleHeight, 30),
    scene: scene,
  });
}

/**
 * Creates and returns a new Ball object at the specified position.
 * @param pos - X position for the ball
 * @param scene - The BabylonJS scene where the ball will be added
 * @returns {Ball} The created Ball instance
 */
export function createBall(pos: number, scene: BABYLON.Scene): Ball {
  const ballRadius = 4;
  return new Ball({
    speed: 50,
    max_speed: 100,
    pos: new BABYLON.Vector3(pos, ballRadius / 2, 0),
    radius: ballRadius,
    scene: scene,
  });
}