import {
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
  updateWarningMessages
} from "../../index.js";

/**
 * Main game update function, called every frame.
 * Handles game running state, time step management, and delegates to object updates.
 *
 * @param dt - Time delta since last frame (in seconds)
 * @param data - Scene/game state
 */
export function renderGame(
  dt: number,
  data: GameData
) {
  // Handle pause screen logic
  if (data.flags.pause_screen) {
    if (data.socket) {
        data.socket.emit('pauseGame');
    }
    data.flags.pause_screen = false;
  }

  // If the game is not running, hide UI and exit update
  if (!data.flags.game_running) {
    rotateCamera(data);
    data.obj2D.guiGame.rootContainer.isVisible = false;
    return;
  } 
  
  data.obj2D.guiGame.rootContainer.isVisible = true;

  // To avoid physics bugs, split large dt into small steps (Fixed Time Step)
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
  // 1. Update 3D Objects
  data.obj3D.table.update(data);
  // data.obj3D.balls.forEach(ball => {ball.update(data)});
  data.obj3D.paddles.forEach(paddle => {paddle.update(data)});

  // 2. Handle Input
  handleKeyboardEvents(data);

  // 3. Update Environment & UI
  updateCamera(data);
  updateScoreLabels(data);
  updateTimer(data);
  updateHellTimer(data);
  magicBallsController(data);
  updateEnvironment(data);
  updateMusic(data);
  updateWarningMessages(data.mods.step);

  // 4. Send Input to Server
  if (data.socket && data.mySide && data.mySide !== 'spectator') {
    data.socket.emit('input', { 
        side: data.mySide, 
        cmd: data.input.paddle_mov 
    });
  }
}