import { Server } from 'socket.io';
import {
    GameStatus,
    TICK_MS,
    CONFIG,
    GameEngine,
    GameConfiguration,
    GamePlayer
} from './index.js';

export class Game {
    private io: Server;
    private engine: GameEngine;
    private gameLoopInterval: NodeJS.Timeout | null = null;

    private humansReady = 0;
    private totalHumans = 0;

    constructor(io: Server, configurations: GameConfiguration, initialPlayers: GamePlayer[]) {
        this.io = io;
        this.engine = new GameEngine(this.io, configurations);

        this.totalHumans = 0;

        initialPlayers.forEach(p => {
            let id = 0;
            while (this.engine.data.players.some(existing => existing.id === id)) id++;
            p.id = id;
            p.setReady();
            if (p.type === 'human')
                this.totalHumans++;
            this.engine.data.players.push(p);
        });
    }

    public removePlayerBySocket(socketId: string) {
        const index = this.engine.data.players.findIndex(p => p.socket_id === socketId);
        if (index !== -1) {
            console.log(`[Game] Player ${socketId} removed mid-game.`);
            this.engine.data.players.splice(index, 1);
        }
    }

    public start() {
        console.log("Initializing Game Entities...");
        this.engine.initGameEntities();
        this.setupInputs();

        this.engine.data.status = GameStatus.COUNTDOWN;
        console.log("Waiting for clients to render scene...");
    }

    private setupInputs() {
        const players = this.engine.data.players;
        players.forEach(player => {
            if (player.type === 'human' && player.socket_id) {
                this.bindSocketEvents(player);
            }
        });
    }

    private bindSocketEvents(player: GamePlayer) {
        const socket = this.io.sockets.sockets.get(player.socket_id || "");
        if (!socket) return;

        const teamPlayers = this.engine.data.players.filter(p => p.side === player.side);
        const myIndex = (player.side === 'spectator') ? -1 : teamPlayers.indexOf(player);

        socket.on('requestGameInit', () => {
            console.log(`Sending Init to player ${player.socket_id}`);
            socket.emit('init', {
                side: player.side,
                index: myIndex,
                configs: this.engine.data.configs
            });
        });

        socket.on('renderReady', () => {
            console.log(`Player ${player.socket_id} is ready to start!`);
            this.humansReady++;
            if (this.humansReady >= this.totalHumans)
                this.startGameLoop();
        });

        if (player.side !== 'spectator') {
            socket.on('input', (data) => {
                if (this.engine.data.status !== GameStatus.RUNNING) return;
                if (data.side === player.side) {
                    if (player.side === 'left') this.engine.data.inputs.left[myIndex] = data.cmd;
                    else this.engine.data.inputs.right[myIndex] = data.cmd;
                }
            });

            socket.on('pauseGame', () => {
                const data = this.engine.data;
                const now = Date.now();
                const cooldown = (CONFIG as any).PAUSE_COOLDOWN_MS ?? 500;

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
        }
    }

    private startGameLoop() {
        console.log("🚀 ALL PLAYERS READY -> Starting Game Loop!");
        this.engine.startGame();
        if (this.gameLoopInterval) clearInterval(this.gameLoopInterval);
        this.gameLoopInterval = setInterval(this.gameLoop.bind(this), TICK_MS);
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
                // SEND RESULTS TO SERVER
                this.sendResultsServer();
                // RETURN TO THE MAIN PAGE

            }
            this.io.emit('gameState', this.engine.getSnapshot());
            return;
        }

        this.engine.update(dt);
        this.io.emit('gameState', this.engine.getSnapshot());
    }

    private async sendResultsServer() {
        const eData = this.engine.data;
        const teamA_IDs = eData.players
            .filter(p => p.side === "left")
            .map(p => {
                return p.type === 'bot' ? `BOT-LVL-${p.id}` : p.socket_id;
            });

        const teamB_IDs = eData.players
            .filter(p => p.side === "right")
            .map(p => {
                return p.type === 'bot' ? `BOT-LVL-${p.id}` : p.socket_id;
            });
        const res = await fetch("http://localhost:3000/api/games", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + userJwtToken
            },
            body: JSON.stringify({
                duration: eData.configs.duration_label,
                powerups: eData.configs.power_ups,
                mode: eData.configs.players_per_side,
                teamA: teamA_IDs,
                teamB: teamB_IDs,
                teamAScore: eData.score.left,
                teamBScore: eData.score.right
            })
        });

        const data = await res.json();

        if (!res.ok) {
            console.error("Failed to save game:", data.message || res.status);
        } else {
            console.log("Game saved with ID:", data.gameId);
        }
    }
}