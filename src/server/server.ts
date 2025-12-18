import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { ServerBall } from './elements/ServerBall.js';
import { ServerPaddle } from './elements/ServerPaddle.js';
import { mov } from '../shared/strings.js';

// Configuração Básica do Servidor
const app = express();
const httpServer = createServer(app);
// Configura o Socket.io com CORS (para permitir conexão do Vite/Client)
const io = new Server(httpServer, {
    cors: {
        origin: "*", // Em produção, muda isto para o URL do teu site
        methods: ["GET", "POST"]
    }
});

const PORT = 3000;

// --- ESTADO DO JOGO ---
const ball = new ServerBall(0, 0);
const paddleLeft = new ServerPaddle('left', -80);
const paddleRight = new ServerPaddle('right', 80);
const score = { left: 0, right: 0 };

const inputs = {
    left: mov.null,
    right: mov.null
};

const players: { [side: string]: string | null } = {
    left: null,
    right: null
};

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
// --- GAME LOOP (60 FPS) ---
const TICK_RATE = 60;
const TICK_MS = 1000 / TICK_RATE; // ~16.66 ms

setInterval(() => {
    const dt = TICK_MS / 1000;

    // 1. Atualizar física
    const updateResult = ball.update(dt);

    if (updateResult === 'left')
        score.left++;
    else if (updateResult === 'right')
        score.right++;

    paddleLeft.update(dt, inputs.left);
    paddleRight.update(dt, inputs.right);

    // 2. Snapshot
    const gameState = {
        ball: ball.pos.asArray(),
        paddles: [
            { side: 'left', pos: paddleLeft.pos.asArray() },
            { side: 'right', pos: paddleRight.pos.asArray() }
        ],
        score: score
    };

    // 3. Enviar
    io.emit('gameState', gameState);

}, TICK_MS);

// --- INICIAR SERVIDOR ---
httpServer.listen(PORT, () => {
    console.log(`🚀 server running on http://localhost:${PORT}`);
});