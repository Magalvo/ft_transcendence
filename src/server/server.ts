import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { ServerBall } from './elements/ServerBall.js';
import { ServerPaddle } from './elements/ServerPaddle.js';
import { hellMode, mov } from '../shared/strings.js';
import { GameStatus } from '../shared/types.js';
import { randomInt } from '../shared/utils.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*", // Em produção, muda isto para o URL do teu site
        methods: ["GET", "POST"]
    }
});

const PORT = 3000;

// --- ESTADO DO JOGO ---
let status: GameStatus = GameStatus.WAITING;

const ball = new ServerBall(0, 0);
const paddleLeft = new ServerPaddle('left', -68);
const paddleRight = new ServerPaddle('right', 68);
const score = { left: 0, right: 0 };

let lastPauseToggle = 0; 
const PAUSE_COOLDOWN = 500;

const inputs = {
    left: mov.null,
    right: mov.null
};

const players: { [side: string]: string | null } = { left: null, right: null };
const playersReady: { [side: string]: boolean } = { left: false, right: false };

// Timers Globais
const HEAVEN_DURATION = 30;
const HELL_DURATION = 20;
let gameTime = 0;
let phaseTimer = 0;
let isHell = false;
let currentHellMode: number = hellMode.null;

// --- SOCKET.IO EVENTOS ---
io.on('connection', (socket) => {
    console.log(`Cliente conectado: ${socket.id}`);

    // 1. Atribuir um lado ao novo jogador
    let side = 'spectator';

    if (players.left === null) {
        players.left = socket.id;
        side = 'left';
    } else if (players.right === null) {
        players.right = socket.id;
        side = 'right';
    }

    // 2. Avisar o cliente qual é o papel dele
    socket.emit('init', { side: side });
    console.log(`Jogador ${socket.id} atribuído a: ${side}`);

    socket.on('playerReady', () => {
        const side = (players.left === socket.id) ? 'left' : (players.right === socket.id) ? 'right' : null;

        if (side) {
            playersReady[side] = true;
            console.log(`Jogador ${side} está pronto!`);

            // Se ambos estiverem prontos, arranca o jogo!
            if (playersReady.left && playersReady.right) {
                startGame();
            }
        }
    });

    // --- NOVO: Pausa (Qualquer jogador pode pausar) ---
    socket.on('pauseGame', () => {
        const now = Date.now();
        
        if (now - lastPauseToggle < PAUSE_COOLDOWN) {
            return; 
        }
        lastPauseToggle = now;

        if (status === GameStatus.RUNNING) {
            status = GameStatus.PAUSED;
            io.emit('gamePaused'); 
            console.log("JOGO PAUSADO");
        } else if (status === GameStatus.PAUSED) {
            status = GameStatus.RUNNING;
            io.emit('gameResumed');
            console.log("JOGO RETOMADO");
        }
    });

    // 3. Receber Input (Só aceita se for do dono da raquete)
    socket.on('input', (data) => {
        // Segurança básica: só aceita input se o socket for o dono desse lado
        if (side === 'left' && data.side === 'left') inputs.left = data.cmd;
        if (side === 'right' && data.side === 'right') inputs.right = data.cmd;
    });

    // 4. Lidar com desconexão
    socket.on('disconnect', () => {
        console.log(`Cliente desconectado: ${socket.id}`);
        if (players.left === socket.id) players.left = null;
        if (players.right === socket.id) players.right = null;
    });
});

function startGame() {
    console.log("AMBOS PRONTOS -> INICIAR JOGO!");
    status = GameStatus.RUNNING;
    // Resetar variáveis se necessário (score, tempo)
    gameTime = 0;
    phaseTimer = 0;
    isHell = false;
    currentHellMode = hellMode.null;
    score.left = 0;
    score.right = 0;
    ball.throwBall(); // Reinicia bola
}

// --- GAME LOOP (60 FPS) ---
const TICK_RATE = 60;
const TICK_MS = 1000 / TICK_RATE; // ~16.66 ms

setInterval(() => {

    const dt = TICK_MS / 1000;

    if (status === GameStatus.RUNNING) {

        gameTime += dt;

        // --- LÓGICA DO INFERNO (SERVER SIDE) ---
        phaseTimer += dt;

        if (!isHell && phaseTimer >= HEAVEN_DURATION) {
            // Entrar no Inferno
            isHell = true;
            phaseTimer = 0;
            // Escolher modo aleatório (exceto o null=0 e o end_list)
            currentHellMode = randomInt(1, hellMode.end_list - 1);
            console.log("MODO INFERNO ATIVADO:", currentHellMode);
        }
        else if (isHell && phaseTimer >= HELL_DURATION) {
            // Voltar ao Céu
            isHell = false;
            phaseTimer = 0;
            currentHellMode = hellMode.null;
            console.log("VOLTÁMOS AO CÉU");
        }

        // 1. Atualizar física
        const paddles = [paddleLeft, paddleRight];
        const updateResult = ball.update(dt, paddles);

        if (updateResult === 'left')
            score.left++;
        else if (updateResult === 'right')
            score.right++;

        paddleLeft.update(dt, inputs.left);
        paddleRight.update(dt, inputs.right);
    }

    // 2. Snapshot
    const gameState = {
        status: status,
        ball: ball.pos.asArray(),
        paddles: [
            { side: 'left', pos: paddleLeft.pos.asArray() },
            { side: 'right', pos: paddleRight.pos.asArray() }
        ],
        score: score,
        time: gameTime,
        hellTimer: phaseTimer,
        isHell: isHell,
        activeHellMode: currentHellMode
    };

    // 3. Enviar
    io.emit('gameState', gameState);

}, TICK_MS);

// --- INICIAR SERVIDOR ---
httpServer.listen(PORT, () => {
    console.log(`🚀 server running on http://localhost:${PORT}`);
});