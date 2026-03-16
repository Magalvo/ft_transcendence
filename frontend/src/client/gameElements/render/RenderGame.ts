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
  updateCountdownUI,
  type GameData,
} from "../../index.js";

/**
 * Main game loop logic.
 * Manages game state, UI visibility, and physics time steps.
 * * @param dt - Delta time since last frame (seconds)
 * @param data - Global game state
 */
export function renderGame(dt: number, data: GameData) {
  const visualDt = Math.min(dt, 0.1);
  updateCountdownUI(visualDt);
  updateMusic(data);

  // Return to Main Menu
  if (data.flags.return_main_menu) {
    handleReturnToMainMenu(data);
    return;
  }

  if (data.flags.pause_screen) {
    data.socket?.emit('pauseGame');
    data.flags.pause_screen = false;
  }

  if (!data.flags.game_running) {
    data.env3D.camera.attachControl();
    rotateCamera(data);
    data.obj2D.guiGame.rootContainer.isVisible = false;
    return;
  }

  if (data.mySide != "spectator")
    data.env3D.camera.detachControl();
  data.obj2D.guiGame.rootContainer.isVisible = true;

  const MAX_DT = 0.05;
  let dtLeft = dt;

  while (dtLeft > 0) {
    data.mods.step = Math.min(dtLeft, MAX_DT);
    updateActiveGameElements(data);
    dtLeft -= data.mods.step;
  }
}

/**
 * Handles the return to main menu with proper cleanup
 * @param data - Global game state
 */
function handleReturnToMainMenu(data: GameData) {
  console.log('🏠 Returning to main menu...');


  if (data.socket && data.socket.connected) {
    try {
      data.socket.emit('leaveGame', {
        side: data.mySide,
        reason: 'user_requested'
      });
      data.socket.emit('leaveLobbyPage');
    } catch (e) {
      console.error('Error notifying server of game leave:', e);
    }
  }

  const returnEvent = new CustomEvent('game-return-to-menu', {
    detail: { timestamp: Date.now() }
  });
  window.dispatchEvent(returnEvent);
}

/**
 * Updates all active entities, environment, and handles input.
 */
function updateActiveGameElements(data: GameData) {
  // --- Visuals & 3D Objects ---
  updateCamera(data);
  updateEnvironment(data);

  // --- UI & Game State ---
  updateScoreLabels(data);
  updateTimerLabel(data);
  updateHellTimerLabel(data);
  updateWarningMessages(data.mods.step);

  // --- Input Handling ---
  handleKeyboardEvents(data);

  if (data.socket && data.mySide && data.mySide !== 'spectator') {
    data.socket.emit('input', {
      side: data.mySide,
      cmd: data.input.paddle_mov
    });
  }
}