import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { Lobby } from './Lobby.js'; // Importar a nova classe Lobby
import { CONFIG } from './index.js';

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

// Criamos o Lobby (que vai gerir o Game internamente)
const lobby = new Lobby(io);

console.log("--- LOBBY SERVER STARTED ---");

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);
    
    // Adiciona ao Lobby assim que conecta
    lobby.addClient(socket.id);

    // --- LOBBY EVENTS ---

    socket.on('lobby_setMode', (mode) => {
        lobby.setGameMode(socket.id, mode);
    });

    socket.on('lobby_movePlayer', (data: { targetId: string, side: 'left'|'right', slotIndex: number }) => {
        lobby.movePlayerToSlot(socket.id, data.targetId, data.side, data.slotIndex);
    });

    socket.on('lobby_addBot', (data: { side: 'left'|'right', slotIndex: number }) => {
        lobby.addBot(socket.id, data.side, data.slotIndex);
    });

    socket.on('lobby_removeBot', (data: { side: 'left'|'right', slotIndex: number }) => {
        lobby.removeBot(socket.id, data.side, data.slotIndex);
    });

    socket.on('lobby_botLevel', (data: { side: 'left'|'right', slotIndex: number, delta: number }) => {
        lobby.changeBotLevel(socket.id, data.side, data.slotIndex, data.delta);
    });

    socket.on('lobby_start', () => {
        lobby.startGame(socket.id);
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        lobby.removeClient(socket.id);
    });
});

httpServer.listen(CONFIG.PORT, () => {
    console.log(`Server running at http://localhost:${CONFIG.PORT}`);
});