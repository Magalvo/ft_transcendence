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

    constructor(io: Server, configurations: GameConfiguration) {
        this.io = io;
        this.engine = new GameEngine(this.io, configurations);

        // Removemos o 'connection' genérico aqui porque agora gerimos
        // sockets específicos associados a jogadores no bindSocketEvents
    }

    // --- PLAYER MANAGEMENT ---

    public setNewPlayer(new_player: GamePlayer) {
        const config = this.engine.data.configs;
        const maxPlayers = config.players_per_side * 2;
        const currentCount = this.engine.data.players.length;

        // 1. IMPEDIR SOBRELOTAÇÃO
        // Se já estiver cheio, rejeita o novo jogador
        if (currentCount >= maxPlayers) {
            console.warn(`[Game] Lobby Full! Cannot add player. (${currentCount}/${maxPlayers})`);
            // Se for um jogador humano, podes querer avisar via socket aqui
            if (new_player.socket_id) {
                const s = this.io.sockets.sockets.get(new_player.socket_id);
                if (s) s.emit('log', '⚠️ Lobby is Full!');
            }
            return;
        }

        // 2. Validar se a equipa específica já está cheia
        const teamCount = this.engine.data.players.filter(p => p.side === new_player.side).length;
        if (teamCount >= config.players_per_side) {
            console.warn(`[Game] Team ${new_player.side} is Full!`);
            return;
        }

        // 3. Atribuir ID e Adicionar
        let id = 0;
        while (this.engine.data.players.some(p => p.id === id)) id++;
        new_player.id = id;

        this.engine.data.players.push(new_player);
        console.log(`Player added: ${new_player.type} (${new_player.side}) Status: ${new_player.state}`);

        // 4. Verificar arranque
        this.checkAndStartGame();
    }

    public removePlayer(player_id: number) {
        const index = this.engine.data.players.findIndex(p => p.id === player_id);
        if (index !== -1) {
            this.engine.data.players.splice(index, 1);
        }
    }

    private checkAndStartGame() {
        // Ignora se já estiver a correr ou em countdown
        if (this.engine.data.status !== GameStatus.WAITING) return;

        const config = this.engine.data.configs;
        const neededPlayers = config.players_per_side * 2;
        const currentPlayers = this.engine.data.players.length;
        const readyPlayers = this.engine.data.players.filter(p => p.isReady).length;

        console.log(`Start Check: ${readyPlayers}/${neededPlayers} players ready.`);

        // Só arranca se a sala estiver CHEIA e TODOS estiverem prontos
        if (currentPlayers === neededPlayers && readyPlayers === neededPlayers) {
            console.log("✅ ALL PLAYERS READY! STARTING GAME AUTOMATICALLY.");
            this.start();
        }
    }

    // --- GAME LIFECYCLE ---

    // O método que arranca tudo
    public start() {
        console.log("Initializing Game...");
        this.engine.initGameEntities();
        this.setupInputs();
        setTimeout(() => {
            console.log("🚀 Starting Game Loop now!");
            this.engine.startGame();
            if (this.gameLoopInterval) clearInterval(this.gameLoopInterval);
            this.gameLoopInterval = setInterval(this.gameLoop.bind(this), TICK_MS);
        }, 3000);
    }

    private setupInputs() {
        const players = this.engine.data.players;
        players.forEach(player => {
            // Apenas ligamos eventos se for humano e tiver um socket válido
            if (player.type === 'human' && player.socket_id)
                this.bindSocketEvents(player);
        });
    }

    private bindSocketEvents(player: GamePlayer) {
        // Encontrar o socket conectado correspondente ao ID do jogador
        const socket = this.io.sockets.sockets.get(player.socket_id || "");

        if (!socket) {
            console.warn(`Socket not found for player ${player.socket_id}. Input might not work.`);
            return;
        }

        // Descobrir o índice deste jogador na sua equipa
        const teamPlayers = this.engine.data.players.filter(p => p.side === player.side);
        const myIndex = teamPlayers.indexOf(player);

        console.log(`Binding inputs for ${player.side} player index ${myIndex} (Socket: ${player.socket_id})`);

        // Enviar Init (dizer ao cliente quem ele é e enviar as configs)
        socket.emit('init', {
            side: player.side,
            index: myIndex,
            configs: this.engine.data.configs
        });

        // --- EVENT: INPUT ---
        socket.on('input', (data) => {
            // Validação de segurança: o input é mesmo deste lado?
            if (data.side === player.side) {
                if (player.side === 'left') {
                    this.engine.data.inputs.left[myIndex] = data.cmd;
                } else {
                    this.engine.data.inputs.right[myIndex] = data.cmd;
                }
            }
        });

        // --- EVENT: PAUSE (Lógica trazida do código antigo) ---
        socket.on('pauseGame', () => {
            const data = this.engine.data;
            const now = Date.now();
            // Leitura segura do CONFIG
            const cooldown = (CONFIG as any).PAUSE_COOLDOWN_MS ?? 500;

            if (now - data.lastPauseToggle < cooldown) return;

            data.lastPauseToggle = now;

            if (data.status === GameStatus.RUNNING) {
                data.status = GameStatus.PAUSED;
                this.io.emit('gamePaused');
                console.log("Game Paused");
            } else if (data.status === GameStatus.PAUSED) {
                data.status = GameStatus.RUNNING;
                this.io.emit('gameResumed');
                console.log("Game Resumed");
            }
        });

        // --- EVENT: DISCONNECT ---
        socket.on('disconnect', () => {
            console.log(`Player ${player.socket_id} disconnected.`);

            // Opcional: Se quiseres terminar o jogo quando alguém sai:
            // if (this.engine.data.status !== GameStatus.WAITING && this.engine.data.status !== GameStatus.ENDGAME) {
            //     this.engine.endGame(); 
            // }
        });

        socket.on('clientReady', () => {
            if (!player.isReady) {
                console.log(`Player ${player.id} (${player.side}) is READY!`);
                player.setReady();
                this.checkAndStartGame();
            }
        });
    }

    // --- GAME LOOP ---

    private gameLoop() {
        const dt = TICK_MS / 1000;
        const data = this.engine.data;

        // 1. Estado de Espera ou Pausa
        if (data.status === GameStatus.WAITING || data.status === GameStatus.PAUSED) {
            this.io.emit('gameState', this.engine.getSnapshot());
            return;
        }

        // 2. Estado de Countdown (3, 2, 1...)
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
                // Lança as bolas
                this.engine.data.balls.forEach(b => { b.throwBall(this.engine.data.table); });
            }

            this.io.emit('gameState', this.engine.getSnapshot());
            return;
        }

        // 3. Estado de Fim de Jogo
        if (data.status === GameStatus.ENDGAME) {
            data.countdownTimer -= dt / 2;
            const currentInt = Math.ceil(data.countdownTimer);

            if (currentInt < data.lastCountdownInt) {
                data.lastCountdownInt = currentInt;
                if (currentInt > 0) this.io.emit('endGame', { count: currentInt });
            }

            if (data.countdownTimer <= 0) {
                this.io.emit('endGame', { count: 0 });
                // Reseta o jogo para poder ser jogado novamente
                this.engine.resetGame();
                // Nota: Talvez queiras parar o loop aqui ou esperar nova ordem de start
            }

            this.io.emit('gameState', this.engine.getSnapshot());
            return;
        }

        // 4. Estado Normal (Running)
        this.engine.update(dt);
        this.io.emit('gameState', this.engine.getSnapshot());
    }
}