import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import {
    GameStatus,
    ServerPaddle,
    CONFIG,
    TICK_MS,
    GameEngine,
    type GameFeatures,
    type Side,
} from './index.js';

export class GameServer {
    private app = express();
    private httpServer = createServer(this.app);
    private io = new Server(this.httpServer, {
        cors: { origin: "*", methods: ["GET", "POST"] }
    });

    private engine: GameEngine;

    constructor(features: GameFeatures) {
        this.engine = new GameEngine(this.io, features);
        this.initializeSocketListeners();

        this.httpServer.listen(CONFIG.PORT, () => {
            console.log(`🚀 Server running on http://localhost:${CONFIG.PORT}`);
        });

        setInterval(this.gameLoop.bind(this), TICK_MS);
    }

    private gameLoop() {
        const dt = TICK_MS / 1000;
        const data = this.engine.data;

        if (data.status === GameStatus.WAITING || data.status === GameStatus.PAUSED) {
            this.io.emit('gameState', this.engine.getSnapshot());
            return;
        }

        if (data.status === GameStatus.COUNTDOWN) {
            data.countdownTimer -= dt;
            const currentInt = Math.ceil(data.countdownTimer);

            if (currentInt < data.lastCountdownInt) {
                data.lastCountdownInt = currentInt;
                if (currentInt > 0) this.io.emit('countdown', { count: currentInt });
            }

            if (data.countdownTimer <= 0) {
                data.status = GameStatus.RUNNING;
                this.io.emit('countdown', { count: 0 });
                this.engine.data.balls.forEach(b => { b.throwBall(this.engine.data.table); });
            }

            this.io.emit('gameState', this.engine.getSnapshot());
            return;
        }

        if (data.status === GameStatus.ENDGAME) {
            data.countdownTimer -= dt / 2;
            const currentInt = Math.ceil(data.countdownTimer);

            if (currentInt < data.lastCountdownInt) {
                data.lastCountdownInt = currentInt;
                if (currentInt > 0) this.io.emit('endGame', { count: currentInt });
            }

            if (data.countdownTimer <= 0) {
                this.io.emit('endGame', { count: 0 });
                this.engine.resetGame();
            }

            this.io.emit('gameState', this.engine.getSnapshot());
            return;
        }

        this.engine.update(dt);
        this.io.emit('gameState', this.engine.getSnapshot());
    }

    private initializeSocketListeners() {
        this.io.on('connection', (socket: Socket) => {
            console.log(`Client connected: ${socket.id}`);
            const players = this.engine.data.players;
            // Garante que usamos um valor default caso as features não tenham a propriedade
            const max = this.engine.data.features.PLAYERS_PER_SIDE;

            let side: Side = 'spectator';
            let index = -1;

            const freeLeft = players.left.findIndex(p => p === null);
            if (freeLeft !== -1 && freeLeft < max) {
                players.left[freeLeft] = socket.id;
                side = 'left';
                index = freeLeft;
            }
            else {
                const freeRight = players.right.findIndex(p => p === null);
                if (freeRight !== -1 && freeRight < max) {
                    players.right[freeRight] = socket.id;
                    side = 'right';
                    index = freeRight;
                }
            }

            socket.emit('init', {
                side: side,
                index: index,
                features: this.engine.data.features
            });
            console.log(`Player ${socket.id} assigned to: ${side} [${index}]`);

            this.setupPlayerReadyHandlers(socket);
            this.setupGameControlHandlers(socket, side, index);

            socket.on('disconnect', () => {
                if (side === 'left' && index !== -1) {
                    players.left[index] = null;
                    if (index === 0) this.engine.data.score.left = -1;
                }
                if (side === 'right' && index !== -1) {
                    players.right[index] = null;
                    if (index === 0) this.engine.data.score.right = -1;
                }
                console.log(`Client disconnected: ${socket.id}`);

                if (this.engine.data.status != GameStatus.WAITING)
                    this.engine.endGame();
            });
        });
    }

    private setupPlayerReadyHandlers(socket: Socket) {
        const data = this.engine.data;
        const maxPlayers = data.features.PLAYERS_PER_SIDE;

        const paddleXLeft = (CONFIG as any).PADDLE_X_LEFT ?? -68;
        const paddleXRight = (CONFIG as any).PADDLE_X_RIGHT ?? 68;

        const spawnPaddles = (side: 'left' | 'right', mode: 'online' | 'offline' | 'demo') => {
            const paddles: ServerPaddle[] = [];
            const spacing = 20;
            const startZ = maxPlayers === 1 ? 0 : -((maxPlayers - 1) * spacing) / 2;

            for (let i = 0; i < maxPlayers; i++) {
                const playerId = data.players[side][i];
                let type: 'human' | 'bot' | null = null;

                if (mode === 'demo') type = 'bot';
                else if (mode === 'offline') type = playerId ? 'human' : 'bot';
                else if (mode === 'online') {
                    if (playerId) type = 'human';
                    else continue;
                }

                if (type) {
                    const x = (side === 'left') ? paddleXLeft : paddleXRight;
                    const p = new ServerPaddle(side, type, data);

                    p.pos.z = startZ + (i * spacing);
                    p.playerIndex = i;
                    paddles.push(p);
                }
            }
            return paddles;
        };

        socket.on('onlinePlayerReady', () => {
            const leftList = data.players.left as unknown as (string | null)[];
            const rightList = data.players.right as unknown as (string | null)[];
            const leftIndex = leftList.indexOf(socket.id);
            const rightIndex = rightList.indexOf(socket.id);

            if (leftIndex !== -1) {
                data.playersReady.left[leftIndex] = true;
                console.log(`Left Player ${leftIndex} is Ready`);
            }
            else if (rightIndex !== -1) {
                data.playersReady.right[rightIndex] = true;
                console.log(`Right Player ${rightIndex} is Ready`);
            }
            const isLobbyFull = !leftList.includes(null) && !rightList.includes(null);
            const allLeftReady = data.playersReady.left.every(r => r === true);
            const allRightReady = data.playersReady.right.every(r => r === true);
            if (isLobbyFull && allLeftReady && allRightReady) {
                console.log("All players ready! Starting game...");
                data.paddlesLeft = spawnPaddles('left', 'online');
                data.paddlesRight = spawnPaddles('right', 'online');
                this.engine.startGame();
            }
        });

        socket.on('offlinePlayerReady', () => {
            data.paddlesLeft = spawnPaddles('left', 'offline');
            data.paddlesRight = spawnPaddles('right', 'offline');
            this.engine.startGame();
        });

        socket.on('demo', () => {
            data.paddlesLeft = spawnPaddles('left', 'demo');
            data.paddlesRight = spawnPaddles('right', 'demo');
            this.engine.startGame();
        });
    }

    private setupGameControlHandlers(socket: Socket, side: Side, index: number) {
        const data = this.engine.data;
        const cooldown = (CONFIG as any).PAUSE_COOLDOWN_MS ?? 500;

        socket.on('pauseGame', () => {
            const now = Date.now();
            if (now - data.lastPauseToggle < cooldown) return;

            data.lastPauseToggle = now;
            if (data.status === GameStatus.RUNNING) {
                data.status = GameStatus.PAUSED;
                this.io.emit('gamePaused');
            } else if (data.status === GameStatus.PAUSED) {
                data.status = GameStatus.RUNNING;
                this.io.emit('gameResumed');
            }
        });

        socket.on('input', (inputData) => {
            if (side === 'spectator' || index === -1) return;

            if (side === 'left' && inputData.side === 'left') {
                data.inputs.left[index] = inputData.cmd;
            }
            if (side === 'right' && inputData.side === 'right') {
                data.inputs.right[index] = inputData.cmd;
            }
        });
    }
}