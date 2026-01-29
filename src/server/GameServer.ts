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
        // Initialize Game Engine
        this.engine = new GameEngine(this.io, features);

        // Setup Network
        this.initializeSocketListeners();
        this.httpServer.listen(CONFIG.PORT, () => {
            console.log(`🚀 Server running on http://localhost:${CONFIG.PORT}`);
        });

        // Start Loop
        setInterval(this.gameLoop.bind(this), TICK_MS);
    }

    private gameLoop() {
        const dt = TICK_MS / 1000;
        const data = this.engine.data;

        // 1. Idle / Paused
        if (data.status === GameStatus.WAITING || data.status === GameStatus.PAUSED) {
            this.io.emit('gameState', this.engine.getSnapshot());
            return;
        }

        // 2. Countdown
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
                data.balls[0].throwBall();
            }

            this.io.emit('gameState', this.engine.getSnapshot());
            return;
        }

        // 3. Endgame Animation
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

        // 4. Running Game Physics
        this.engine.update(dt);
        this.io.emit('gameState', this.engine.getSnapshot());
    }

    private initializeSocketListeners() {
        this.io.on('connection', (socket: Socket) => {
            console.log(`Client connected: ${socket.id}`);
            const players = this.engine.data.players;

            // 1. Assign Role
            let side: Side = 'spectator';
            if (players.left === null) {
                players.left = socket.id;
                side = 'left';
            } else if (players.right === null) {
                players.right = socket.id;
                side = 'right';
            }

            socket.emit('init', { side: side, features: this.engine.data.features });
            console.log(`Player ${socket.id} assigned to: ${side}`);

            // 2. Event Handlers
            this.setupPlayerReadyHandlers(socket);
            this.setupGameControlHandlers(socket, side);

            socket.on('disconnect', () => {
                console.log(`Client disconnected: ${socket.id}`);
                if (players.left === socket.id) {
                    players.left = null;
                    this.engine.data.score.left = -1;
                }
                if (players.right === socket.id) {
                    players.right = null;
                    this.engine.data.score.right = -1;
                }

                if (this.engine.data.status != GameStatus.WAITING)
                    this.engine.endGame();
            });
        });
    }

    private setupPlayerReadyHandlers(socket: Socket) {
        const data = this.engine.data;

        socket.on('onlinePlayerReady', () => {
            const pSide = (data.players.left === socket.id) ? 'left' : (data.players.right === socket.id) ? 'right' : null;
            if (pSide) {
                data.playersReady[pSide] = true;
                if (data.playersReady.left && data.playersReady.right) {
                    data.paddleLeft = new ServerPaddle('left', 'human', CONFIG.PADDLE_X_LEFT);
                    data.paddleRight = new ServerPaddle('right', 'human', CONFIG.PADDLE_X_RIGHT);
                    this.engine.startGame();
                }
            }
        });

        socket.on('offlinePlayerReady', () => {
            data.paddleLeft = new ServerPaddle('left', 'human', CONFIG.PADDLE_X_LEFT);
            data.paddleRight = new ServerPaddle('right', 'bot', CONFIG.PADDLE_X_RIGHT, data.features.BOT_LEVEL);
            this.engine.startGame();
        });

        socket.on('demo', () => {
            data.paddleLeft = new ServerPaddle('left', 'bot', CONFIG.PADDLE_X_LEFT, data.features.BOT_LEVEL);
            data.paddleRight = new ServerPaddle('right', 'bot', CONFIG.PADDLE_X_RIGHT, data.features.BOT_LEVEL);
            this.engine.startGame();
        });
    }

    private setupGameControlHandlers(socket: Socket, side: Side) {
        const data = this.engine.data;

        socket.on('pauseGame', () => {
            const now = Date.now();
            if (now - data.lastPauseToggle < CONFIG.PAUSE_COOLDOWN_MS) return;

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
            if (side === 'left' && inputData.side === 'left') data.inputs.left = inputData.cmd;
            if (side === 'right' && inputData.side === 'right') data.inputs.right = inputData.cmd;
        });
    }
}