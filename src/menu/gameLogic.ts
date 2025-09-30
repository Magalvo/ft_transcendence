import { keyCode } from "../index.js";
import type { Objects2D, Objects3D, Parts3D, SceneData } from "../index.js";

/* ------------ *
 *  GAME LOGIC  *
 * ------------ */

export function gameUpdate(dt: number, data: SceneData, obj3D: Objects3D, obj2D: Objects2D, parts3D: Parts3D) {
  // time management
  const MAX_DT = 0.05;
  let dt_left = dt;
  while (dt_left > 0) {
    data.step = Math.min(dt_left, MAX_DT);
    if (data.game_running == true)
      objectsUpdate(data, obj3D, obj2D, parts3D);
    dt_left -= data.step;
  }
}

function objectsUpdate(data: SceneData, obj3D: Objects3D, obj2D: Objects2D, parts3D: Parts3D) {
  // game update
  for (const ball of obj3D.balls) {
    ball.update(obj3D, data);
  }
  for (const paddle of obj3D.paddles) {
    paddle.update(obj3D, data);
  }
  cameraChange(data, parts3D);
  labelUpdate(obj2D, data);
}

function cameraChange(data: SceneData, parts3D: Parts3D) {
  // camera target z
  if (data.keysPressed[keyCode.Z]) {
    data.camera_alpha = -Math.PI;
    data.camera_beta = Math.PI / 2.5;
  }
  // camera target x
  if (data.keysPressed[keyCode.X]) {
    data.camera_alpha = -Math.PI / 2;
    data.camera_beta = Math.PI / 4;
  }
  // camera target c
  if (data.keysPressed[keyCode.C]) {
    data.camera_alpha = 0;
    data.camera_beta = Math.PI / 2.5;
  }
  // changing camera
  const camera = parts3D.camera;
  const smooth = 3;
  camera.alpha += (data.camera_alpha - camera.alpha) * Math.min(1, smooth * data.step);
  camera.beta += (data.camera_beta - camera.beta) * Math.min(1, smooth * data.step);
}

function labelUpdate(obj2D: Objects2D, data: SceneData) {
  obj2D.left_score_label.text = "" + data.score.left;
  obj2D.right_score_label.text = "" + data.score.right;
}