import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import {
    ServerBall,
    ServerPaddle,
    ServerMagicBall,
    GameStatus,
    randomInt,
    HEAVEN_DURATION,
    HELL_DURATION,
    hellMode,
    MAGIC_BALL_INTERVAL,
    MAGIC_BALL_MAX,
    MAGIC_EFFECT_DURATION,
    magicEffect,
    mov,
    GAME_DURATION,
    type MagicEffect,
    type Mov,
    type Side
} from './index.js';

// --- CONFIGURATION ---
const CONFIG = {
    PORT: 3000,
    TICK_RATE: 60,
    PAUSE_COOLDOWN_MS: 500,
    PADDLE_X_LEFT: -68,
    PADDLE_X_RIGHT: 68,
    SPEED_MOD_FAST: 4,
    SPEED_MOD_NORMAL: 2
};

const TICK_MS = 1000 / CONFIG.TICK_RATE;

// --- INTERFACES ---

interface IGameData {
    // Game Flow
    status: GameStatus;
    gameTime: number;
    phaseTimer: number;
    countdownTimer: number;
    lastCountdownInt: number;
    lastPauseToggle: number;

    // Entities
    balls: ServerBall[];
    magicBalls: ServerMagicBall[];
    paddleLeft: ServerPaddle;
    paddleRight: ServerPaddle;

    // Score & Visuals
    score: { left: number, right: number };
    scoreFlash: 'left' | 'right' | null;

    // Mechanics / Mods
    isHell: boolean;
    currentHellMode: number;
    magicBallTimer: number;
    nextMagicBallId: number;

    // Player Management
    inputs: { left: Mov, right: Mov };
    players: { left: string | null, right: string | null };
    playersReady: { left: boolean, right: boolean };
}

// --- CLASS DEFINITION ---

export class GameServer {

    // O TS sabe que será inicializado no constructor via createInitialState
    public data: IGameData;

    // Server Components
    private app = express();
    private httpServer = createServer(this.app);
    private io = new Server(this.httpServer, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        }
    });

    constructor() {
        // 1. Inicializa o Estado (State Object Pattern)
        this.data = this.createInitialState();

        // 2. Configura os Listeners
        this.initializeSocketListeners();

        // 3. Arranca o Servidor e o Loop
        this.httpServer.listen(CONFIG.PORT, () => {
            console.log(`🚀 Server running on http://localhost:${CONFIG.PORT}`);
        });

        // Inicia o Game Loop (bind(this) garante que o 'this' dentro do loop é a classe)
        setInterval(this.gameLoop.bind(this), TICK_MS);
    }

    // --- INITIALIZATION & RESET ---

    /**
     * Cria o objeto de estado inicial limpo.
     * Usado no construtor e quando precisamos de um reset total (hard reset).
     */
    private createInitialState(): IGameData {
        return {
            status: GameStatus.WAITING,
            gameTime: 0,
            phaseTimer: 0,
            countdownTimer: 3,
            lastCountdownInt: 0,
            lastPauseToggle: 0,

            balls: [new ServerBall(0, 0)],
            magicBalls: [],
            paddleLeft: new ServerPaddle('left', 'human', CONFIG.PADDLE_X_LEFT),
            paddleRight: new ServerPaddle('right', 'human', CONFIG.PADDLE_X_RIGHT),

            score: { left: 0, right: 0 },
            scoreFlash: null,

            isHell: false,
            currentHellMode: hellMode.null,
            magicBallTimer: 0,
            nextMagicBallId: 1,

            inputs: { left: mov.null, right: mov.null },
            players: { left: null, right: null },
            playersReady: { left: false, right: false }
        };
    }

    /**
     * Reinicia o jogo para uma nova partida, mantendo os jogadores ligados.
     */
    private resetGame() {
        // Reset Flow
        this.data.status = GameStatus.WAITING;
        this.data.gameTime = 0;
        this.data.phaseTimer = 0;
        this.data.isHell = false;
        this.data.currentHellMode = hellMode.null;
        this.data.score = { left: 0, right: 0 };
        this.data.scoreFlash = null;
        
        // Reset Entities
        this.data.balls = [new ServerBall(0, 0)];
        this.data.magicBalls = [];
        this.data.paddleLeft.resetEffects();
        this.data.paddleRight.resetEffects();
        
        // Reset Inputs/Ready (Optional: keep players connected)
        this.data.inputs = { left: mov.null, right: mov.null };
        this.data.playersReady = { left: false, right: false };
        
        // Se quisermos desconectar jogadores logicamente:
        // this.data.players = { left: null, right: null };
    }

    private startGame() {
        console.log("Starting countdown...");
        this.data.status = GameStatus.COUNTDOWN;
        this.data.countdownTimer = 3;
        this.data.lastCountdownInt = 4; // Força envio do primeiro tick
    }

    // --- GAME LOOP ---

    private gameLoop() {
        const dt = TICK_MS / 1000;

        // 1. Idle / Paused
        if (this.data.status === GameStatus.WAITING || this.data.status === GameStatus.PAUSED) {
            this.io.emit('gameState', this.createSnapshot());
            return;
        }

        // 2. Countdown
        if (this.data.status === GameStatus.COUNTDOWN) {
            this.data.countdownTimer -= dt;
            const currentInt = Math.ceil(this.data.countdownTimer);
            
            if (currentInt < this.data.lastCountdownInt) {
                this.data.lastCountdownInt = currentInt;
                if (currentInt > 0) {
                    this.io.emit('countdown', { count: currentInt });
                }
            }
            
            if (this.data.countdownTimer <= 0) {
                this.data.status = GameStatus.RUNNING;
                this.io.emit('countdown', { count: 0 });
                this.data.balls[0].throwBall();
            }
            
            this.io.emit('gameState', this.createSnapshot());
            return;
        }

        // 3. Endgame Animation
        if (this.data.status === GameStatus.ENDGAME) {
            this.data.countdownTimer -= dt / 2; // Animação mais lenta
            const currentInt = Math.ceil(this.data.countdownTimer);
            
            if (currentInt < this.data.lastCountdownInt) {
                this.data.lastCountdownInt = currentInt;
                if (currentInt > 0) {
                    this.io.emit('endGame', { count: currentInt });
                }
            }
            
            if (this.data.countdownTimer <= 0) {
                this.io.emit('endGame', { count: 0 });
                this.resetGame();
            }
            
            this.io.emit('gameState', this.createSnapshot());
            return;
        }

        // 4. Running Game Logic
        this.data.gameTime += dt;
        this.updateGamePhases(dt);
        this.updateMagicBalls(dt);
        this.updatePaddles(dt);
        this.updateBalls(dt);

        // Broadcast State
        this.io.emit('gameState', this.createSnapshot());

        // Check Match Duration
        if (this.data.gameTime >= GAME_DURATION) {
            this.data.countdownTimer = 3;
            this.data.lastCountdownInt = 4;
            this.data.status = GameStatus.ENDGAME;
        }
    }

    // --- GAME LOGIC METHODS ---

    private updateGamePhases(dt: number) {
        this.data.phaseTimer += dt;

        if (!this.data.isHell && this.data.phaseTimer >= HEAVEN_DURATION) {
            this.enterHellMode();
        } else if (this.data.isHell && this.data.phaseTimer >= HELL_DURATION) {
            this.exitHellMode();
        }
    }

    private enterHellMode() {
        this.data.isHell = true;
        this.data.phaseTimer = 0;

        // Reset Effects
        this.data.paddleLeft.resetEffects();
        this.data.paddleRight.resetEffects();
        this.data.magicBalls = []; 

        this.data.currentHellMode = randomInt(1, hellMode.end_list);

        this.io.emit('gameMessage', {
            message: getHellModeName(this.data.currentHellMode),
            side: "center",
            color: "red",
            duration: HELL_DURATION
        });

        // Apply Hell Logic
        switch (this.data.currentHellMode) {
            case hellMode.big_balls:
                this.data.balls.forEach(b => b.setBigBall(true));
                break;
            case hellMode.small_paddles:
                this.data.paddleLeft.applyPowerUp(magicEffect.small);
                this.data.paddleRight.applyPowerUp(magicEffect.small);
                break;
            case hellMode.slow_paddles:
                this.data.paddleLeft.applyPowerUp(magicEffect.slow);
                this.data.paddleRight.applyPowerUp(magicEffect.slow);
                break;
            case hellMode.multipleBalls:
                while (this.data.balls.length < 4)
                    this.data.balls.push(new ServerBall(0, 0));
                this.data.balls.forEach(b => {
                    if (b.velocity === 0) b.throwBall();
                });
                break;
            case hellMode.fast_balls:
                // Handled in updateBalls via speed modifier
                break;
        }
    }

    private exitHellMode() {
        this.data.isHell = false;
        this.data.phaseTimer = 0;
        this.data.currentHellMode = hellMode.null;

        // Reset to single ball
        this.data.balls = [new ServerBall(0, 0)];
        this.data.balls[0].throwBall();

        // Reset Paddles
        this.data.paddleLeft.resetEffects();
        this.data.paddleRight.resetEffects();
    }

    private updateMagicBalls(dt: number) {
        // 1. Spawning
        if (!this.data.isHell) {
            this.data.magicBallTimer += dt;
            if (this.data.magicBallTimer >= MAGIC_BALL_INTERVAL) {
                this.data.magicBallTimer = 0;
                if (this.data.magicBalls.length < MAGIC_BALL_MAX) {
                    const effect = randomInt(1, magicEffect.end_list) as MagicEffect;
                    const mb = new ServerMagicBall(this.data.nextMagicBallId++, effect);
                    this.data.magicBalls.push(mb);
                }
            }
        } else {
            if (this.data.magicBalls.length > 0) this.data.magicBalls = [];
        }

        // 2. Physics & Collision
        for (let i = this.data.magicBalls.length - 1; i >= 0; i--) {
            const mb = this.data.magicBalls[i];
            mb.update(dt);

            let collected = false;
            const paddles = [this.data.paddleLeft, this.data.paddleRight];

            for (const paddle of paddles) {
                const pBox = paddle.getBoundingBox();
                const collisionX = (mb.pos.x + mb.radius >= pBox.left) && (mb.pos.x - mb.radius <= pBox.right);
                const collisionZ = (mb.pos.z + mb.radius >= pBox.near) && (mb.pos.z - mb.radius <= pBox.far);

                if (collisionX && collisionZ) {
                    paddle.applyPowerUp(mb.effectType);
                    collected = true;

                    this.io.emit('gameMessage', {
                        message: getMagicEffectName(mb.effectType),
                        side: paddle.side,
                        color: "green",
                        duration: MAGIC_EFFECT_DURATION
                    });
                    break;
                }
            }

            if (collected) {
                this.data.magicBalls.splice(i, 1);
            }
        }
    }

    private updatePaddles(dt: number) {
        let leftCmd = this.getPaddleMoveCmd(this.data.paddleLeft);
        let rightCmd = this.getPaddleMoveCmd(this.data.paddleRight);

        if (this.data.currentHellMode === hellMode.inverted_keys) {
            leftCmd = invertInput(leftCmd);
            rightCmd = invertInput(rightCmd);
        }

        this.data.paddleLeft.update(dt, leftCmd);
        this.data.paddleRight.update(dt, rightCmd);
    }

    private getPaddleMoveCmd(paddle: ServerPaddle): Mov {
        if (paddle.player === 'human') {
            return (paddle.side === 'left') ? this.data.inputs.left : this.data.inputs.right;
        }
        return this.handleBot(paddle);
    }

    private handleBot(paddle: ServerPaddle): Mov {
        const closest = this.data.balls.reduce((prev, b) =>
            Math.abs(b.pos.x - paddle.pos.x) < Math.abs(prev.pos.x - paddle.pos.x) ? b : prev
        );
        const vx = closest.velocity * Math.cos(closest.angle * Math.PI / 180);

        if ((paddle.side == "left" && vx < 0) || (paddle.side == "right" && vx > 0)) {
            if (Math.abs(paddle.pos.z - closest.pos.z) > 2) {
                return paddle.pos.z < closest.pos.z ? mov.far : mov.near;
            }
        }
        return mov.null;
    }

    private updateBalls(dt: number) {
        const paddles = [this.data.paddleLeft, this.data.paddleRight];
        this.data.scoreFlash = null;

        this.data.balls.forEach(ball => {
            if (this.data.isHell) {
                const mod = (this.data.currentHellMode === hellMode.fast_balls) ? CONFIG.SPEED_MOD_FAST : CONFIG.SPEED_MOD_NORMAL;
                ball.setSpeedModifier(mod);
            }

            const result = ball.update(dt, paddles);
            if (this.data.scoreFlash === null) this.data.scoreFlash = result;

            if (result === 'left') {
                this.data.score.left++;
                ball.throwBall();
            } else if (result === 'right') {
                this.data.score.right++;
                ball.throwBall();
            }
        });
    }

    private createSnapshot() {
        return {
            status: this.data.status,
            balls: this.data.balls.map(b => ({
                pos: b.pos.asArray(),
                radius: b.radius,
                particles: b.isColliding,
            })),
            magicBalls: this.data.magicBalls.map(mb => mb.getData()),
            paddles: [
                { side: 'left', pos: this.data.paddleLeft.pos.asArray(), size: this.data.paddleLeft.depth, sizeX: this.data.paddleLeft.width },
                { side: 'right', pos: this.data.paddleRight.pos.asArray(), size: this.data.paddleRight.depth, sizeX: this.data.paddleRight.width }
            ],
            score: this.data.score,
            time: this.data.gameTime,
            hellTimer: this.data.phaseTimer,
            isHell: this.data.isHell,
            activeHellMode: this.data.currentHellMode,
            scoreFlash: this.data.scoreFlash,
        };
    }

    // --- SOCKET HANDLING ---

    private initializeSocketListeners() {
        this.io.on('connection', (socket: Socket) => {
            console.log(`Client connected: ${socket.id}`);

            // 1. Assign Role
            let side: Side = 'spectator';
            if (this.data.players.left === null) {
                this.data.players.left = socket.id;
                side = 'left';
            } else if (this.data.players.right === null) {
                this.data.players.right = socket.id;
                side = 'right';
            }

            socket.emit('init', { side });
            console.log(`Player ${socket.id} assigned to: ${side}`);

            // 2. Event Listeners
            
            socket.on('onlinePlayerReady', () => {
                const pSide = (this.data.players.left === socket.id) ? 'left' : (this.data.players.right === socket.id) ? 'right' : null;
                if (pSide) {
                    this.data.playersReady[pSide] = true;
                    console.log(`Player ${pSide} is ready.`);

                    if (this.data.playersReady.left && this.data.playersReady.right) {
                        this.data.paddleLeft = new ServerPaddle('left', 'human', CONFIG.PADDLE_X_LEFT);
                        this.data.paddleRight = new ServerPaddle('right', 'human', CONFIG.PADDLE_X_RIGHT);
                        this.startGame();
                    }
                }
            });

            socket.on('offlinePlayerReady', () => {
                this.data.paddleLeft = new ServerPaddle('left', 'human', CONFIG.PADDLE_X_LEFT);
                this.data.paddleRight = new ServerPaddle('right', 'bot', CONFIG.PADDLE_X_RIGHT);
                this.startGame();
            });

            socket.on('demo', () => {
                console.log(`Bot vs Bot demo`);
                this.data.paddleLeft = new ServerPaddle('left', 'bot', CONFIG.PADDLE_X_LEFT);
                this.data.paddleRight = new ServerPaddle('right', 'bot', CONFIG.PADDLE_X_RIGHT);
                this.startGame();
            });

            socket.on('pauseGame', () => {
                const now = Date.now();
                if (now - this.data.lastPauseToggle < CONFIG.PAUSE_COOLDOWN_MS) return;

                this.data.lastPauseToggle = now;
                if (this.data.status === GameStatus.RUNNING) {
                    this.data.status = GameStatus.PAUSED;
                    this.io.emit('gamePaused');
                } else if (this.data.status === GameStatus.PAUSED) {
                    this.data.status = GameStatus.RUNNING;
                    this.io.emit('gameResumed');
                }
            });

            socket.on('input', (data) => {
                if (side === 'left' && data.side === 'left') this.data.inputs.left = data.cmd;
                if (side === 'right' && data.side === 'right') this.data.inputs.right = data.cmd;
            });

            socket.on('disconnect', () => {
                console.log(`Client disconnected: ${socket.id}`);
                if (this.data.players.left === socket.id) this.data.players.left = null;
                if (this.data.players.right === socket.id) this.data.players.right = null;
            });
        });
    }
}

// --- HELPER FUNCTIONS (Static/Standalone) ---

function invertInput(cmd: Mov): Mov {
    if (cmd === mov.far) return mov.near;
    if (cmd === mov.near) return mov.far;
    return mov.null;
}

function getHellModeName(id: number): string {
    switch (id) {
        case hellMode.inverted_keys: return "INVERTED KEYS";
        case hellMode.small_paddles: return "SMALL PADDLES";
        case hellMode.slow_paddles: return "SLOW PADDLES";
        case hellMode.fast_balls: return "FAST BALLS";
        case hellMode.big_balls: return "BIG BALLS";
        case hellMode.multipleBalls: return "MULTIBALL CHAOS";
        case hellMode.twisted_view: return "TWISTED VIEW";
        case hellMode.drunk_view: return "DRUNK VIEW";
        default: return "HELL MODE";
    }
}

function getMagicEffectName(id: number): string {
    switch (id) {
        case magicEffect.big: return "BIG PADDLE";
        case magicEffect.small: return "SMALL PADDLE";
        case magicEffect.slow: return "SLOW MOTION";
        case magicEffect.fast: return "SPEED BOOST";
        case magicEffect.freeze: return "FROZEN PADDLE";
        case magicEffect.thick: return "THICK PADDLE";
        default: return "MYSTERY EFFECT";
    }
}