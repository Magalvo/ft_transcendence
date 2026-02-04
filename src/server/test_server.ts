import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { Game, GameConfiguration, GamePlayer, CONFIG } from './index.js';

const app = express();
const httpServer = createServer(app);

// CONFIGURAR CORS PARA O VITE
const io = new Server(httpServer, {
    cors: {
        origin: "*", // Permite conexão de qualquer lugar (incluindo o Vite na porta 5173)
        methods: ["GET", "POST"]
    }
});

// Setup Game
const configs = new GameConfiguration("normal", "one_for_one");
const gameInstance = new Game(io, configs);

console.log("--- LOBBY SERVER STARTED ---");

io.on('connection', (socket) => {
    console.log(`Lobby User connected: ${socket.id}`);

    socket.on('joinGame', (data: { side: "left" | "right" }) => {
        const existing = gameInstance['engine'].data.players.find(p => p.socket_id === socket.id);
        if (existing) return;
        const player = new GamePlayer("human", socket.id, data.side);
        gameInstance.setNewPlayer(player);
        console.log(`Player joined ${data.side}`);
    });

    socket.on('addBot', (data: { side: "left" | "right", level: number }) => {
        const bot = new GamePlayer("bot", data.level, data.side);
        gameInstance.setNewPlayer(bot);
        console.log(`Bot added to ${data.side}`);
    });

    socket.on('clientReady', () => {
        const player = gameInstance['engine'].data.players.find(p => p.socket_id === socket.id);
        if (player && !player.isReady) {
            player.setReady();
            // Acede ao método privado para forçar verificação
            (gameInstance as any).checkAndStartGame();
        }
    });
});

httpServer.listen(CONFIG.PORT, () => {
    console.log(`Socket Server running at http://localhost:${CONFIG.PORT}`);
});