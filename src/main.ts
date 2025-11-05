import { GameScene } from "./index";

// game usage
const game = new GameScene();
game.startGame();






// fullscreen canvas - 100% optional
const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();