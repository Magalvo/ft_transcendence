import * as BABYLON from "@babylonjs/core";
import "@babylonjs/loaders";
import { GameScene } from "./index";

// Get the canvas and create the Babylon engine
const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
const engine = new BABYLON.Engine(canvas);

// initialize our game
const game = new GameScene(engine);
game.startGame();

// Responsive resize canvas
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    engine.resize();
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();