import {
  pauseScreen,
  handleKeyboardEvents,
  updateCamera,
  updateScoreLabels,
  updateEnvironment,
  rotateCamera,
  updateTimer,
  updateMusic,
  updateHellTimer,
  magicBallsController,
  type GameData,
} from "../../index.js";

/**
 * Main game update function, called every frame.
 * Handles game running state, time step management, and delegates to object updates.
 *
 * @param dt - Time delta since last frame (in seconds)
 * @param data - Scene/game state
 */
export function gameUpdate(
  dt: number,
  data: GameData
) {
  // handle pause screen
  if (data.flags.pause_screen) pauseScreen(data);

  // If the game is not running, hide UI and exit update
  if (!data.flags.game_running) {
    rotateCamera(data);
    data.obj2D.guiGame.rootContainer.isVisible = false;
    return;
  } else {
    data.obj2D.guiGame.rootContainer.isVisible = true;
  }

  // To avoid physics bugs, split large dt into small steps
  const MAX_DT = 0.05;
  let dtLeft = dt;
  while (dtLeft > 0) {
    data.mods.step = Math.min(dtLeft, MAX_DT);
    updateGameObjects(data);
    dtLeft -= data.mods.step;
  }
}

/**
 * Updates all game objects and handles game mechanics.
 * @param data - Scene/game state
 */
function updateGameObjects(
  data: GameData
) {
  // Update the table, balls, and paddles
  data.obj3D.table.update(data);
  for (const ball of data.obj3D.balls) {
    ball.update(data);
  }
  for (const paddle of data.obj3D.paddles) {
    paddle.update(data);
  }

  // Handle user keyboard input and camera/environment updates
  handleKeyboardEvents(data);
  updateCamera(data);
  updateScoreLabels(data);
  updateTimer(data);
  updateHellTimer(data);
  magicBallsController(data);
  updateEnvironment(data);
  updateMusic(data);
}