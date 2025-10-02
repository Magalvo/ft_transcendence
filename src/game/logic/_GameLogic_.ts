import { pauseScreen, handleKeyboardEvents, updateCamera, updateScoreLabels, updateEnvironment, rotateCamera, updateTimer, updateMusic, updateDevilTimer, handleHellModes } from "../../index.js";
import type { Objects2D, Objects3D, Parts3D, SceneData } from "../../index.js";

/**
 * Main game update function, called every frame.
 * Handles game running state, time step management, and delegates to object updates.
 *
 * @param dt - Time delta since last frame (in seconds)
 * @param data - Scene/game state
 * @param obj3D - 3D game objects
 * @param obj2D - 2D UI objects
 * @param parts3D - 3D scene parts (camera, environment, etc.)
 */
export function gameUpdate(
  dt: number,
  data: SceneData,
  obj3D: Objects3D,
  obj2D: Objects2D,
  parts3D: Parts3D
) {
  // handle pause screen
  if (data.pause_screen) pauseScreen(data, parts3D, obj2D);

  // If the game is not running, hide UI and exit update
  if (!data.game_running) {
    rotateCamera(parts3D, data);
    obj2D.guiGame.rootContainer.isVisible = false;
    return;
  } else {
    obj2D.guiGame.rootContainer.isVisible = true;
  }

  // Handle hell modes
  handleHellModes(data, obj3D);

  // To avoid physics bugs, split large dt into small steps
  const MAX_DT = 0.05;
  let dtLeft = dt;
  while (dtLeft > 0) {
    data.step = Math.min(dtLeft, MAX_DT);
    updateGameObjects(data, obj3D, obj2D, parts3D);
    dtLeft -= data.step;
  }
}

/**
 * Updates all game objects and handles game mechanics.
 * @param data - Scene/game state
 * @param obj3D - 3D game objects
 * @param obj2D - 2D UI objects
 * @param parts3D - 3D scene parts
 */
function updateGameObjects(
  data: SceneData,
  obj3D: Objects3D,
  obj2D: Objects2D,
  parts3D: Parts3D
) {
  // Update the table, balls, and paddles
  obj3D.table.update(data);
  for (const ball of obj3D.balls) {
    ball.update(obj3D, data);
  }
  for (const paddle of obj3D.paddles) {
    paddle.update(obj3D, data);
  }

  // Handle user keyboard input and camera/environment updates
  handleKeyboardEvents(data);
  updateCamera(data, parts3D);
  updateScoreLabels(obj2D, data);
  updateTimer(obj2D, data);
  updateDevilTimer(obj2D, data);
  updateEnvironment(parts3D, data, obj3D);
  updateMusic(data, parts3D);
}