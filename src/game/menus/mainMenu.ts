import { GUI } from "../../index.js";
import type { Parts3D, SceneData } from "../../index.js";

/**
 * Stores the menu GUI texture globally for use within this module.
 */
let guiTexture!: GUI.AdvancedDynamicTexture;

/**
 * Initializes the menu by creating a fullscreen GUI texture.
 */
export function createMenu() {
  guiTexture = GUI.AdvancedDynamicTexture.CreateFullscreenUI("menu_GUI", true, { width: 1920, height: 1080 });
  guiTexture.idealWidth = 1920;
  guiTexture.idealHeight = 1080;
}

/**
 * Starts and displays the game menu, including positioning the camera and showing the loading overlay.
 * @param data - Scene/game state
 * @param parts3D - 3D scene parts
 */
export function startMenu(data: SceneData, parts3D: Parts3D) {
  positionCamera(parts3D);

  // Optionally, add a menu background image:
  // createBackground();

  createTitle();

  // Show loading overlay for a minimum duration and then show menu buttons
  const hideLoading = showLoadingOverlay({ minDuration: 3000 });
  Promise.all([
    waitForScene(parts3D.scene)
  ]).then(() => {
    hideLoading(() => {
      createButtons(data, parts3D);
    });
  });
}

function waitForScene(scene: any): Promise<void> {
  return new Promise(resolve => {
    scene.executeWhenReady(() => resolve());
  });
}

/**
 * Creates the main menu buttons: Play, Left Player, and Right Player.
 * @param data - Scene/game state
 * @param parts3D - 3D scene parts
 */
function createButtons(data: SceneData, parts3D: Parts3D) {
  // Play button
  const playBtn = GUI.Button.CreateSimpleButton("play", "PLAY");
  playBtn.width = "200px";
  playBtn.height = "60px";
  playBtn.color = "white";
  playBtn.background = "rgba(40, 71, 117, 1)";
  playBtn.top = "30%";
  playBtn.fontSize = 32;
  playBtn.onPointerUpObservable.add(() => {
    guiTexture.dispose();
    data.game_running = true;
    parts3D.camera.detachControl();
  });
  guiTexture.addControl(playBtn);

  // Left player selector button
  const leftPlayer = GUI.Button.CreateSimpleButton("LP", "HUMAN");
  leftPlayer.width = "150px";
  leftPlayer.height = "150px";
  leftPlayer.color = "white";
  leftPlayer.background = "rgba(40, 71, 117, 1)";
  leftPlayer.top = "30%";
  leftPlayer.left = "-30%";
  leftPlayer.fontSize = 32;
  leftPlayer.onPointerUpObservable.add(() => {
    data.left_player_human = !data.left_player_human;
    leftPlayer.textBlock!.text = data.left_player_human ? "HUMAN" : "BOT";
  });
  guiTexture.addControl(leftPlayer);

  // Right player selector button
  const rightPlayer = GUI.Button.CreateSimpleButton("RP", "BOT");
  rightPlayer.width = "150px";
  rightPlayer.height = "150px";
  rightPlayer.color = "white";
  rightPlayer.background = "rgba(40, 71, 117, 1)";
  rightPlayer.top = "30%";
  rightPlayer.left = "30%";
  rightPlayer.fontSize = 32;
  rightPlayer.onPointerUpObservable.add(() => {
    data.right_player_human = !data.right_player_human;
    rightPlayer.textBlock!.text = data.right_player_human ? "HUMAN" : "BOT";
  });
  guiTexture.addControl(rightPlayer);
}

/**
 * (Optional) Creates a background image for the menu.
 * Disabled by default—uncomment in startMenu to use.
 */
function createBackground() {
  const bg = new GUI.Image("bg", "textures/menu_bg.jpg");
  bg.stretch = GUI.Image.STRETCH_UNIFORM;
  bg.width = 2;
  bg.height = 2;
  bg.zIndex = 0;
  guiTexture.addControl(bg);
}

/**
 * Creates the game title and subtitle on the menu.
 */
function createTitle() {
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
 * Positions the camera for the menu view.
 * @param parts3D - 3D scene parts
 */
function positionCamera(parts3D: Parts3D) {
  parts3D.camera.beta = Math.PI;
  parts3D.camera.radius = 250;
}

/**
 * Shows a loading spinner overlay for a minimum duration.
 * Returns a function to hide the spinner and optionally execute a callback.
 * @param options - { minDuration: number } (minimum duration in ms)
 */
export function showLoadingOverlay({ minDuration = 0 } = {}) {
  const spinner = new GUI.Ellipse();
  spinner.width = "10%";
  spinner.height = "10%";
  spinner.thickness = 5;
  spinner.color = "yellow";
  spinner.background = "transparent";
  spinner.zIndex = 1;
  guiTexture.addControl(spinner);

  let disposed = false;
  let startTime = Date.now();

  // Spinner animation: rotates continuously
  let angle = 0;
  const anim = () => {
    if (disposed) return;
    angle += 0.1;
    spinner.rotation = angle;
    requestAnimationFrame(anim);
  };
  anim();

  // Returns a function to hide the spinner (respects minDuration) and run an optional callback
  return (onFinish?: () => void) => {
    const elapsed = Date.now() - startTime;
    const delay = Math.max(0, minDuration - elapsed);
    setTimeout(() => {
      disposed = true;
      spinner.dispose();
      if (onFinish) onFinish();
    }, delay);
  };
}