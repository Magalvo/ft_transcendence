import type { AdvancedDynamicTexture } from "@babylonjs/gui";
import { GUI, keyCode } from "../../index.js";
import type { Environment3D, GameData } from "../../index.js";

/**
 * Activates the pause menu: displays the pause overlay, positions the camera, and locks the game.
 * Use the 'O' key or the menu button to resume the game.
 *
 * @param data - The global game state
 */
export function pauseScreen(data: GameData) {
  if (data.flags.game_running === true) {
    data.obj2D.guiPauseMenu = createPauseScreen(data);
  }

  // Allow resuming the game with the 'O' key
  if (data.input.keysPressed[keyCode.O]) {
    if (data.obj2D.guiPauseMenu) {
      resumeGame(data);
      data.obj2D.guiPauseMenu = undefined;
    }
  }
}

/**
 * Resumes the game: removes the pause overlay and returns control to the player.
 * @param data - The global game state
 * @param parts3D - 3D elements of the scene
 * @param guiTexture - The GUI instance to remove
 */
function resumeGame(data: GameData) {
  // Remove overlay
  if (data.obj2D.guiPauseMenu)
    data.obj2D.guiPauseMenu.dispose();
  // Detach extra camera control
  data.env.camera.detachControl();
  // Resume game
  data.flags.game_running = true;
  data.flags.pause_screen = false;
  // resume music
  data.env.hellMusic.play();
  data.env.heavenMusic.play();
}
/**
 * Resumes the game: removes the pause overlay and returns control to the player.
 * @param data - The global game state
 * @param parts3D - 3D elements of the scene
 * @param guiTexture - The GUI instance to remove
 */
function pauseGame(data: GameData) {
  // pause game
  data.flags.game_running = false;
  data.flags.pause_screen = true;
  // pause music
  data.env.hellMusic.pause();
  data.env.heavenMusic.pause();
  // reset canvas effects
  const canvas = document.getElementById("renderCanvas");
  if (canvas)
    canvas.style.transform = "scaleX(1)";
}

/**
 * Creates the pause overlay (pause menu) and locks the game.
 * @param data - The global game state
 * @param parts3D - 3D elements of the scene
 */
function createPauseScreen(data: GameData): GUI.AdvancedDynamicTexture {
  // Create a fullscreen GUI overlay
  const guiTexture = GUI.AdvancedDynamicTexture.CreateFullscreenUI("pause_GUI", true, { width: 1920, height: 1080 });
  guiTexture.idealWidth = 1920;
  guiTexture.idealHeight = 1080;

  // Pause the game
  pauseGame(data);

  // Reposition the camera for the pause view
  positionCamera(data.env);

  // Create title and subtitle
  createTitle(guiTexture);

  // Create menu buttons
  createButtons(data, guiTexture);

  return guiTexture;
}

/**
 * Creates the main pause menu button (Resume).
 * @param data - The global game state
 * @param parts3D - 3D elements of the scene
 * @param guiTexture - GUI instance to add controls to
 */
function createButtons(data: GameData, guiTexture: AdvancedDynamicTexture) {
  // Resume button
  const resumeBtn = GUI.Button.CreateSimpleButton("play", "RESUME");
  resumeBtn.width = "200px";
  resumeBtn.height = "60px";
  resumeBtn.color = "white";
  resumeBtn.background = "rgba(40, 71, 117, 1)";
  resumeBtn.top = "30%";
  resumeBtn.left = "-10%";
  resumeBtn.fontSize = 32;
  resumeBtn.onPointerUpObservable.add(() => {
    resumeGame(data);
  });
  guiTexture.addControl(resumeBtn);

  // Resume button
  const returnBtn = GUI.Button.CreateSimpleButton("return", "RETURN");
  returnBtn.width = "200px";
  returnBtn.height = "60px";
  returnBtn.color = "white";
  returnBtn.background = "rgba(40, 71, 117, 1)";
  returnBtn.top = "30%";
  returnBtn.left = "10%";
  returnBtn.fontSize = 32;
  returnBtn.onPointerUpObservable.add(() => {
    data.flags.return_main_menu = true;

  });
  guiTexture.addControl(returnBtn);
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
function positionCamera(parts3D: Environment3D) {
  // Example: only change the camera radius
  parts3D.camera.radius = 250;
  parts3D.camera.attachControl();
}
