import type { AdvancedDynamicTexture } from "@babylonjs/gui";
import { GUI, keyCode } from "../../index.js";
import type { Objects2D, Parts3D, SceneData } from "../../index.js";

/**
 * Activates the pause menu: displays the pause overlay, positions the camera, and locks the game.
 * Use the 'O' key or the menu button to resume the game.
 *
 * @param data - The global game state
 * @param parts3D - 3D elements of the scene
 * @param parts2D - 2D/UI elements of the scene
 */
export function pauseScreen(data: SceneData, parts3D: Parts3D, parts2D: Objects2D) {
  if (data.game_running === true) {
    parts2D.guiPauseMenu = createPauseScreen(data, parts3D);
  }

  // Allow resuming the game with the 'O' key
  if (data.keysPressed[keyCode.O]) {
    if (parts2D.guiPauseMenu) {
      resumeGame(data, parts3D, parts2D.guiPauseMenu);
      parts2D.guiPauseMenu = undefined;
    }
  }
}

/**
 * Creates the pause overlay (pause menu) and locks the game.
 * @param data - The global game state
 * @param parts3D - 3D elements of the scene
 */
function createPauseScreen(data: SceneData, parts3D: Parts3D): GUI.AdvancedDynamicTexture {
  // Create a fullscreen GUI overlay
  const guiTexture = GUI.AdvancedDynamicTexture.CreateFullscreenUI("pause_GUI", true, { width: 1920, height: 1080 });
  guiTexture.idealWidth = 1920;
  guiTexture.idealHeight = 1080;

  // Pause the game
  data.game_running = false;
  data.pause_screen = true;

  // Reposition the camera for the pause view
  positionCamera(parts3D);

  // (Optional) Add custom background here
  // createBackground();

  // Create title and subtitle
  createTitle(guiTexture);

  // Create menu buttons
  createButtons(data, parts3D, guiTexture);

  return guiTexture;
}

/**
 * Creates the main pause menu button (Resume).
 * @param data - The global game state
 * @param parts3D - 3D elements of the scene
 * @param guiTexture - GUI instance to add controls to
 */
function createButtons(data: SceneData, parts3D: Parts3D, guiTexture: AdvancedDynamicTexture) {
  // Resume button
  const playBtn = GUI.Button.CreateSimpleButton("play", "RESUME");
  playBtn.width = "200px";
  playBtn.height = "60px";
  playBtn.color = "white";
  playBtn.background = "rgba(40, 71, 117, 1)";
  playBtn.top = "30%";
  playBtn.fontSize = 32;
  playBtn.onPointerUpObservable.add(() => {
    resumeGame(data, parts3D, guiTexture);
  });
  guiTexture.addControl(playBtn);
}

/**
 * Resumes the game: removes the pause overlay and returns control to the player.
 * @param data - The global game state
 * @param parts3D - 3D elements of the scene
 * @param guiTexture - The GUI instance to remove
 */
function resumeGame(data: SceneData, parts3D: Parts3D, guiTexture: AdvancedDynamicTexture) {
  // Remove overlay
  guiTexture.dispose();
  // Detach extra camera control
  parts3D.camera.detachControl();
  // Resume game
  data.game_running = true;
  data.pause_screen = false;
}

/**
 * Creates the pause menu title and subtitle.
 * @param guiTexture - GUI instance to add controls to
 */
function createTitle(guiTexture: AdvancedDynamicTexture) {
  const title = new GUI.TextBlock();
  title.text = "Heaven's Pong";
  title.color = "white";
  title.fontSize = 150;
  title.top = "-35%";
  guiTexture.addControl(title);

  const subtitle = new GUI.TextBlock();
  subtitle.text = "Good vs Evil battle";
  subtitle.color = "white";
  subtitle.fontSize = 80;
  subtitle.top = "-25%";
  guiTexture.addControl(subtitle);
}

/**
 * Sets the camera position for the pause menu view.
 * @param parts3D - 3D elements of the scene
 */
function positionCamera(parts3D: Parts3D) {
  // Example: only change the camera radius
  parts3D.camera.radius = 250;
  parts3D.camera.attachControl();
}
