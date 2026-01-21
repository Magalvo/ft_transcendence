import { GUI } from "../../index.js";
import type { Side } from "../../index.js";

/**
 * Container type for all 2D UI objects in the scene.
 */
export type Objects2D = {
  guiGame: GUI.AdvancedDynamicTexture;
  left_score_label: GUI.TextBlock;
  right_score_label: GUI.TextBlock;
  timer_label: GUI.TextBlock;
  devil_timer_label: GUI.TextBlock;
  guiPauseMenu?: GUI.AdvancedDynamicTexture;
};

/* ---------------- *
 *  SCENE 2D PARTS  *
 * ---------------- */

/**
 * Creates all main 2D UI elements for the game (score labels, UI texture, etc).
 * @returns {Objects2D}
 */
export function create2DParts(): Objects2D {
  // Create a fullscreen GUI texture for all UI elements, with a fixed ideal size
  const guiTexture = GUI.AdvancedDynamicTexture.CreateFullscreenUI(
    "interface_GUI",
    true,
    { width: 1920, height: 1080 }
  );
  guiTexture.idealWidth = 1920;
  guiTexture.idealHeight = 1080;

  return {
    guiGame: guiTexture,
    left_score_label: createScoreLabel(guiTexture, "left"),
    right_score_label: createScoreLabel(guiTexture, "right"),
    timer_label: createTimer(guiTexture),
    devil_timer_label: createDevilTimer(guiTexture),
  };
}

/**
 * Creates a score label (TextBlock) for the left or right side.
 * @param advancedTexture - The GUI texture to add the label to
 * @param s - Side of the label (left or right)
 * @returns {GUI.TextBlock}
 */
function createScoreLabel(
  advancedTexture: GUI.AdvancedDynamicTexture,
  s: Side
): GUI.TextBlock {
  const scoreText = new GUI.TextBlock();
  scoreText.text = "0";
  scoreText.color = "white";
  scoreText.fontSize = "100px";
  scoreText.top = "-40%";
  if (s === "left") scoreText.left = "-40%";
  if (s === "right") scoreText.left = "40%";
  advancedTexture.addControl(scoreText);
  return scoreText;
}

/**
 * Creates a timer label (TextBlock)
 * @param advancedTexture - The GUI texture to add the label to
 * @returns {GUI.TextBlock}
 */
function createTimer(advancedTexture: GUI.AdvancedDynamicTexture): GUI.TextBlock {
  const timerText = new GUI.TextBlock();
  timerText.text = "0";
  timerText.color = "white";
  timerText.fontSize = "100px";
  timerText.top = "-40%";
  advancedTexture.addControl(timerText);
  return timerText;
}

/**
 * Creates a devil timer label (TextBlock)
 * @param advancedTexture - The GUI texture to add the label to
 * @returns {GUI.TextBlock}
 */
function createDevilTimer(advancedTexture: GUI.AdvancedDynamicTexture): GUI.TextBlock {
  const timerText = new GUI.TextBlock();
  timerText.text = "0";
  timerText.color = "white";
  timerText.fontSize = "60px";
  timerText.top = "-30%";
  advancedTexture.addControl(timerText);
  return timerText;
}
