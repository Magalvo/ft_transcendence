import type { AdvancedDynamicTexture } from "@babylonjs/gui";
import { GUI } from "../../index.js";
import type { GameData } from "../../index.js";

/**
 * Activates the pause menu.
 */
export function pauseScreen(data: GameData) {
  if (data.obj2D.guiPauseMenu) {
    data.obj2D.guiPauseMenu.dispose();
    data.obj2D.guiPauseMenu = undefined;
  }
  if (data.flags.game_running === true) {
    console.log("Creating Pause Menu...");
    data.obj2D.guiPauseMenu = createPauseScreen(data);
  }
}

/**
 * Resumes the game.
 */
export function resumeGame(data: GameData) {
  console.log("Disposing Pause Menu...");
  if (data.obj2D.guiPauseMenu) {
    data.obj2D.guiPauseMenu.dispose();
  }
  data.obj2D.guiPauseMenu = undefined;
}

function createPauseScreen(data: GameData): AdvancedDynamicTexture {
  // Cria a textura UI
  const guiTexture = GUI.AdvancedDynamicTexture.CreateFullscreenUI("pause_GUI", true, { width: 1920, height: 1080 });
  guiTexture.idealWidth = 1920;
  guiTexture.idealHeight = 1080;

  createTitle(guiTexture);
  // positionCamera(data.env3D);

  // Botão RESUME
  const resumeBtn = GUI.Button.CreateSimpleButton("resume", "RESUME");
  resumeBtn.width = "200px";
  resumeBtn.height = "60px";
  resumeBtn.color = "white";
  resumeBtn.background = "rgba(40, 71, 117, 1)";
  resumeBtn.top = "20%";
  resumeBtn.left = "-10%";
  resumeBtn.fontSize = 32;
  resumeBtn.onPointerUpObservable.add(() => {
    if (data.socket) {
      console.log("Resume clicked");
      data.socket.emit('pauseGame');
    }
  });
  guiTexture.addControl(resumeBtn);

  // Botão RETURN
  const returnBtn = GUI.Button.CreateSimpleButton("return", "RETURN");
  returnBtn.width = "200px";
  returnBtn.height = "60px";
  returnBtn.color = "white";
  returnBtn.background = "rgba(40, 71, 117, 1)";
  returnBtn.top = "20%";
  returnBtn.left = "10%";
  returnBtn.fontSize = 32;
  returnBtn.onPointerUpObservable.add(() => {
    // Lógica para voltar ao menu principal
    // (Nota: garante que o 'HandleEvents' trata disto se necessário)
    data.flags.return_main_menu = true;
  });
  guiTexture.addControl(returnBtn);

  return guiTexture;
}

function createTitle(guiTexture: AdvancedDynamicTexture) {
  const title = new GUI.TextBlock();
  title.text = "Heaven's Pong";
  title.color = "white";
  title.fontSize = 150;
  title.top = "-25%";
  guiTexture.addControl(title);

  const subtitle = new GUI.TextBlock();
  subtitle.text = "Good vs Evil";
  subtitle.color = "white";
  subtitle.fontSize = 80;
  subtitle.top = "-15%";
  guiTexture.addControl(subtitle);
}