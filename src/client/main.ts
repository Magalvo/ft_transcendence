import { GameScene } from "./index.js";

// 1. Inicializar o Jogo (Cena vazia inicialmente)
const game = new GameScene();
// Inicia apenas o motor e listeners, a cena 3D será criada quando o servidor mandar 'init'
game.startConnection(); 

// 2. Lógica dos Botões HTML
const btnJoinLeft = document.getElementById("btn-join-left")!;
const btnBotLeft = document.getElementById("btn-bot-left")!;
const btnJoinRight = document.getElementById("btn-join-right")!;
const btnBotRight = document.getElementById("btn-bot-right")!;
const btnReady = document.getElementById("btn-ready")!;
const lobbyOverlay = document.getElementById("lobby-overlay")!;
const statusMsg = document.getElementById("status-msg")!;

// Helpers para emitir eventos via socket do jogo
function emit(event: string, data?: any) {
    if (game.socket && game.socket.connected) {
        game.socket.emit(event, data);
    } else {
        console.error("Socket not connected");
    }
}

// Listeners
btnJoinLeft.onclick = () => emit('joinGame', { side: 'left' });
btnBotLeft.onclick = () => emit('addBot', { side: 'left', level: 5 });

btnJoinRight.onclick = () => emit('joinGame', { side: 'right' });
btnBotRight.onclick = () => emit('addBot', { side: 'right', level: 5 });

btnReady.onclick = () => {
    emit('clientReady');
    statusMsg.innerText = "Waiting for other players...";
    // Desativa o botão para evitar spam
    (btnReady as HTMLButtonElement).disabled = true;
};

// Opcional: Esconder o lobby quando o jogo começar
// Podes ouvir um evento customizado que vamos disparar no HandleEvents
window.addEventListener('game-start', () => {
    lobbyOverlay.classList.add('hidden');
});

// Fullscreen Canvas
const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();