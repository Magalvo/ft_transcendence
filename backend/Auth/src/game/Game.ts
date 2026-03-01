import { Server } from 'socket.io';
import {
    GameStatus,
    TICK_MS,
    CONFIG,
    GameEngine,
    GameConfiguration,
    GamePlayer
} from './index.js';
import { recordTeamMatch } from '../services/matchService.js';

export class Game {
    private io: Server;
    private roomId: string;
    private engine: GameEngine;
    private gameLoopInterval: NodeJS.Timeout | null = null;

    private humansReady = 0;
    private totalHumans = 0;

    constructor(io: Server, configurations: GameConfiguration, initialPlayers: GamePlayer[], roomId: string) {
        this.io = io;
        this.roomId = roomId;
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
                    this.emitToRoom('gamePaused');
                } else if (data.status === GameStatus.PAUSED) {
                    data.status = GameStatus.RUNNING;
                    this.emitToRoom('gameResumed');
                }
            });
        }

        // Handle player leaving the game mid-session
        socket.on('leaveGame', (data: any) => {
            const reason = data?.reason || 'unknown';
            console.log(`[Game] Player ${player.socket_id} (${player.side}) requested to leave. Reason: ${reason}`);
            
            // Notify other players that this player left
            this.emitToRoom('gameMessage', {
                side: player.side,
                message: `${player.nick || 'Player'} has left the game`,
                color: 'red',
                duration: 3
            });
            
            // Remove player from game
            this.removePlayerBySocket(player.socket_id || '');
            
            // If not enough players remain, end the game
            const activePlayers = this.engine.data.players.filter(p => p.type === 'human').length;
            if (activePlayers === 0) {
                console.log('[Game] All human players have left. Ending game.');
                this.engine.data.status = GameStatus.ENDGAME;
                this.engine.data.countdownTimer = 0;
            }
        });
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
            this.emitToRoom('gameState', this.engine.getSnapshot());
            return;
        }

        if (data.status === GameStatus.COUNTDOWN) {
            data.countdownTimer -= dt;
            const currentInt = Math.ceil(data.countdownTimer);

            if (currentInt < data.lastCountdownInt) {
                data.lastCountdownInt = currentInt;
                if (currentInt > 0) this.emitToRoom('countdown', { count: currentInt });
            }

            if (data.countdownTimer <= 0) {
                data.status = GameStatus.RUNNING;
                this.emitToRoom('countdown', { count: 0 });
                this.engine.data.balls.forEach(b => { b.throwBall(this.engine.data.table); });
            }

            this.emitToRoom('gameState', this.engine.getSnapshot());
            return;
        }

        if (data.status === GameStatus.ENDGAME) {
            data.countdownTimer -= dt / 2;
            const currentInt = Math.ceil(data.countdownTimer);
            if (currentInt < data.lastCountdownInt) {
                data.lastCountdownInt = currentInt;
                if (currentInt > 0) this.emitToRoom('endGame', { count: currentInt });
            }
            if (data.countdownTimer <= 0) {
                this.emitToRoom('endGame', { count: 0 });
                // SEND RESULTS TO SERVER (before resetting!)
                this.sendResultsServer();
                // RESET GAME STATE
                this.engine.resetGame();
                // CLEANUP AND END GAME
                this.cleanup();
            }
            this.emitToRoom('gameState', this.engine.getSnapshot());
            return;
        }

        this.engine.update(dt);
        this.emitToRoom('gameState', this.engine.getSnapshot());
    }

    private async sendResultsServer() {
        const eData = this.engine.data;
        
        // Find human players on each team
        const leftPlayers = eData.players.filter(p => p.side === "left" && p.type === 'human');
        const rightPlayers = eData.players.filter(p => p.side === "right" && p.type === 'human');

        console.log(`[Game] Recording match with scores: Left ${eData.score.left} - Right ${eData.score.right}`);
        console.log(`[Game] Players: ${leftPlayers.length} left, ${rightPlayers.length} right`);

        // Only record if there are human players on both teams
        if (leftPlayers.length > 0 && rightPlayers.length > 0) {
            try {
                const matchStartTime = new Date(Date.now() - (eData.gameTime * 1000));
                const matchEndTime = new Date();

                // Use the new team-based match recording function
                const gameMode = String(eData.configs.players_per_side);
                const gameId = await recordTeamMatch({
                    leftTeamPlayers: leftPlayers.map(p => ({
                        user_id: p.user_id || "",
                        socket_id: p.socket_id
                    })),
                    rightTeamPlayers: rightPlayers.map(p => ({
                        user_id: p.user_id || "",
                        socket_id: p.socket_id
                    })),
                    leftTeamScore: eData.score.left,
                    rightTeamScore: eData.score.right,
                    duration: eData.configs.duration_label,
                    powerups: eData.configs.power_ups,
                    gameMode: gameMode,
                    started_at: matchStartTime,
                    ended_at: matchEndTime,
                });

                console.log("✅ Game recorded with ID:", gameId);
                this.emitToRoom('matchRecorded', {
                    gameId,
                    winner: eData.score.left > eData.score.right ? "A" : "B"
                });
            } catch (error) {
                console.error("❌ Error recording game:", error);
                this.emitToRoom('matchRecordError', { message: 'Failed to record game stats' });
            }
        } else {
            console.warn("⚠️ Not recording game: Missing human players on one or both teams");
        }
    }

    private emitToRoom(event: string, payload?: unknown): void {
        if (payload === undefined) {
            this.io.to(this.roomId).emit(event);
            return;
        }

        this.io.to(this.roomId).emit(event, payload);
    }

    private cleanup() {
        console.log('🧹 [Game] Cleaning up game instance');
        
        // Stop the game loop
        if (this.gameLoopInterval) {
            clearInterval(this.gameLoopInterval);
            this.gameLoopInterval = null;
        }
    }
}