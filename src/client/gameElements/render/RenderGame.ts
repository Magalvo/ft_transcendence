import {
  handleKeyboardEvents,
  updateCamera,
  updateScoreLabels,
  updateEnvironment,
  rotateCamera,
  updateTimerLabel,
  updateMusic,
  updateHellTimerLabel,
  updateWarningMessages,
  type GameData,
} from "../../index.js";

/**
 * Main game loop logic.
 * Manages game state, UI visibility, and physics time steps.
 * * @param dt - Delta time since last frame (seconds)
 * @param data - Global game state
 */
export function renderGame(dt: number, data: GameData) {
  // 1. Handle Pause Requests
  if (data.flags.pause_screen) {
    data.socket?.emit('pauseGame');
    data.flags.pause_screen = false;
  }

  // 2. Idle State (Menu/Waiting)
  // Rotates camera around the table and hides the HUD
  if (!data.flags.game_running) {
    rotateCamera(data);
    data.obj2D.guiGame.rootContainer.isVisible = false;
    return;
  }

  // 3. Running State
  data.obj2D.guiGame.rootContainer.isVisible = true;

  // Fixed Time Step: Splits large frame times into smaller chunks
  // to ensure consistent physics/animation speed even if FPS drops.
  const MAX_DT = 0.05;
  let dtLeft = dt;

  while (dtLeft > 0) {
    data.mods.step = Math.min(dtLeft, MAX_DT);
    updateActiveGameElements(data);
    dtLeft -= data.mods.step;
  }
}

/**
 * Updates all active entities, environment, and handles input.
 */
function updateActiveGameElements(data: GameData) {
  // --- Visuals & 3D Objects ---
  data.obj3D.table.update(data);
  data.obj3D.paddles.forEach(paddle => paddle.update(data));
  
  updateCamera(data);
  updateEnvironment(data);

  // --- UI & Game State ---
  updateScoreLabels(data);
  updateTimerLabel(data);
  updateHellTimerLabel(data);
  updateWarningMessages(data.mods.step);

  // --- Audio ---
  updateMusic(data);

  // --- Input Handling ---
  handleKeyboardEvents(data);

  // Send input to server (only if player is active)
  if (data.socket && data.mySide && data.mySide !== 'spectator') {
    data.socket.emit('input', {
      side: data.mySide,
      cmd: data.input.paddle_mov
    });
  }
}