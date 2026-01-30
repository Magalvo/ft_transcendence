import { Server } from 'socket.io';
import {
    ServerBall,
    ServerPaddle,
    ServerMagicBall,
    GameStatus,
    randomInt,
    hellMode,
    magicEffect,
    mov,
    getHellModeName,
    getMagicEffectName,
    CONFIG,
    type MagicEffect,
    type Mov,
    BALL_CONFIG,
    MAGIC_BALL_CONFIG,
    randomFloat2,
    ServerTable,
} from './index.js';

export type GameFeatures = {
    //
    readonly HELL_DURATION: number;
    readonly HEAVEN_DURATION: number;
    //
    readonly ROUNDS: number;
    readonly POWER_UPS: Boolean;
    readonly BOT_LEVEL: number; // 1-10
    //
    readonly GAME_DURATION: number;
    readonly PLAYERS_PER_SIDE: number;
};

// Define the State Interface
export interface IGameData {
    // Flow
    status: GameStatus;
    gameTime: number;
    phaseTimer: number;
    countdownTimer: number;
    lastCountdownInt: number;
    lastPauseToggle: number;

    // Entities
    balls: ServerBall[];
    magicBalls: ServerMagicBall[];
    paddlesLeft: ServerPaddle[];
    paddlesRight: ServerPaddle[];
    table: ServerTable;

    // Stats
    score: { left: number, right: number };
    scoreFlash: 'left' | 'right' | null;

    // Mechanics
    isHell: boolean;
    currentHellMode: number;
    magicBallTimer: number;
    nextMagicBallId: number;

    // Players
    inputs: { left: Mov[], right: Mov[] };
    players: { left: (string | null)[], right: (string | null)[] };
    playersReady: { left: boolean[], right: boolean[] };

    // Features
    features: GameFeatures;
}

export class GameEngine {
    public data: IGameData;
    private io: Server;

    constructor(io: Server, features: GameFeatures) {
        this.io = io;
        this.data = this.createInitialState(features);
    }

    // --- INITIALIZATION ---

    /**
     * Creates a clean state object.
     */
    private createInitialState(features: GameFeatures): IGameData {
        const inputsLeft = new Array(features.PLAYERS_PER_SIDE).fill(mov.null);
        const inputsRight = new Array(features.PLAYERS_PER_SIDE).fill(mov.null);
        const playersLeft = new Array(features.PLAYERS_PER_SIDE).fill(null);
        const playersRight = new Array(features.PLAYERS_PER_SIDE).fill(null);
        return {
            status: GameStatus.WAITING,
            gameTime: 0,
            phaseTimer: 0,
            countdownTimer: 3,
            lastCountdownInt: 0,
            lastPauseToggle: 0,

            balls: [],
            magicBalls: [],
            paddlesLeft: [],
            paddlesRight: [],
            table: new ServerTable(),

            score: { left: 0, right: 0 },
            scoreFlash: null,

            isHell: false,
            currentHellMode: hellMode.null,
            magicBallTimer: 0,
            nextMagicBallId: 1,

            inputs: { left: inputsLeft, right: inputsRight },
            players: { left: playersLeft, right: playersRight },
            playersReady: {
                left: new Array(features.PLAYERS_PER_SIDE).fill(false),
                right: new Array(features.PLAYERS_PER_SIDE).fill(false)
            },

            features: features
        };
    }

    public startGame() {
        console.log("Starting game...");
        this.resetGame();
        this.data.status = GameStatus.COUNTDOWN;
        this.data.countdownTimer = 3;
        this.data.lastCountdownInt = 4;
    }

    public resetGame() {
        // Reset Logic
        this.data.status = GameStatus.WAITING;
        this.data.gameTime = 0;
        this.data.phaseTimer = 0;
        this.data.score = { left: 0, right: 0 };
        this.data.isHell = false;

        // Reset Entities
        while (this.data.balls.length < BALL_CONFIG.min_amount) this.data.balls.push(new ServerBall(0, 0));
        this.data.magicBalls = [];

        this.data.paddlesLeft = this.createSidePaddles('left');
        this.data.paddlesRight = this.createSidePaddles('right');

        // Reset Inputs
        this.data.inputs.left.fill(mov.null);
        this.data.inputs.right.fill(mov.null);
        this.data.playersReady = {
            left: new Array(this.data.features.PLAYERS_PER_SIDE).fill(false),
            right: new Array(this.data.features.PLAYERS_PER_SIDE).fill(false)
        };
    }

    private createSidePaddles(side: 'left' | 'right'): ServerPaddle[] {
        const paddles: ServerPaddle[] = [];
        const players_amount = this.data.features.PLAYERS_PER_SIDE;
        const table_d = this.data.table.depth;

        for (let i = 0; i < players_amount; i++) {
            const z = (table_d * -0.5) + (table_d / (players_amount + 1) * (i + 1));
            // const z = (table_d * -0.5);
            // Verifica se este slot tem um jogador humano
            const hasPlayer = this.data.players[side][i] !== null;
            const type = hasPlayer ? 'human' : 'bot';

            // Criamos o paddle passando o ID do player (opcional) ou apenas o tipo
            const paddle = new ServerPaddle(side, type, this.data);

            // Força a posição Z inicial para não ficarem sobrepostos
            paddle.pos.z = z;
            // Guarda o índice para sabermos qual input usar
            paddle.playerIndex = i;

            paddles.push(paddle);
        }
        return paddles;
    }

    // --- MAIN UPDATE METHODS ---

    /**
     * Called every tick to update physics and logic.
     */
    public update(dt: number) {
        this.data.gameTime += dt;
        this.updatePhases(dt);
        if (this.data.features.POWER_UPS) this.updateMagicBalls(dt);
        this.updatePaddles(dt);
        this.updateBalls(dt);

        // Check for Match End
        if (this.data.gameTime >= this.data.features.GAME_DURATION)
            this.endGame();
    }

    public endGame() {
        this.data.status = GameStatus.ENDGAME;
        this.data.countdownTimer = 3;
        this.data.lastCountdownInt = 4;
    }

    private updatePhases(dt: number) {
        this.data.phaseTimer += dt;

        if (!this.data.isHell && this.data.phaseTimer >= this.data.features.HEAVEN_DURATION) {
            this.enterHellMode();
        } else if (this.data.isHell && this.data.phaseTimer >= this.data.features.HELL_DURATION) {
            this.exitHellMode();
        }
    }

    private updateMagicBalls(dt: number) {
        // 1. Spawning
        if (!this.data.isHell) {
            this.data.magicBallTimer += dt;
            const interval = randomFloat2(MAGIC_BALL_CONFIG.min_interval, MAGIC_BALL_CONFIG.max_interval);
            if (this.data.magicBallTimer >= interval) {
                this.data.magicBallTimer = 0;
                if (this.data.magicBalls.length < MAGIC_BALL_CONFIG.max_balls) {
                    const effect = randomInt(1, magicEffect.end_list) as MagicEffect;
                    const mb = new ServerMagicBall(this.data.nextMagicBallId++, effect);
                    this.data.magicBalls.push(mb);
                }
            }
        } else {
            // Clean up in Hell
            if (this.data.magicBalls.length > 0) this.data.magicBalls = [];
        }

        // 2. Collision & Physics
        for (let i = this.data.magicBalls.length - 1; i >= 0; i--) {
            const mb = this.data.magicBalls[i];
            mb.update(dt, this.data);

            let collected = false;
            const paddles = [...this.data.paddlesLeft, ...this.data.paddlesRight];

            for (const paddle of paddles) {
                if (this.checkCollision(mb, paddle)) {
                    paddle.applyEffect(mb.effectType, MAGIC_BALL_CONFIG.effect_duration);
                    collected = true;

                    // Emit effect message
                    this.io.emit('gameMessage', {
                        message: getMagicEffectName(mb.effectType),
                        side: paddle.side,
                        color: "green",
                        duration: MAGIC_BALL_CONFIG.effect_duration,
                    });
                    break;
                }
            }

            if (collected) this.data.magicBalls.splice(i, 1);
        }
    }

    private updatePaddles(dt: number) {
        [...this.data.paddlesLeft, ...this.data.paddlesRight].
            forEach(paddle => { paddle.update(dt, this.data); });
    }

    private updateBalls(dt: number) {
        const paddles = [...this.data.paddlesLeft, ...this.data.paddlesRight];
        this.data.scoreFlash = null;

        this.data.balls.forEach(ball => {
            // Apply speed modifiers
            if (this.data.isHell) {
                const mod = (this.data.currentHellMode === hellMode.fast_balls)
                    ? CONFIG.SPEED_MOD_FAST
                    : CONFIG.SPEED_MOD_NORMAL;
                ball.setSpeedModifier(mod);
            }

            const result = ball.update(dt, paddles, this.data.table);
            if (this.data.scoreFlash === null) this.data.scoreFlash = result;

            if (result === 'left') {
                this.data.score.left++;
                ball.throwBall(this.data.table);
            } else if (result === 'right') {
                this.data.score.right++;
                ball.throwBall(this.data.table);
            }
        });
    }

    // --- HELPER LOGIC ---

    private enterHellMode() {
        this.data.isHell = true;
        this.data.phaseTimer = 0;
        [...this.data.paddlesLeft, ...this.data.paddlesRight].forEach(paddle => { paddle.resetEffects() });
        this.data.magicBalls = [];

        this.data.currentHellMode = randomInt(1, hellMode.end_list);
        // this.data.currentHellMode = hellMode.multipleBalls;

        this.io.emit('gameMessage', {
            message: getHellModeName(this.data.currentHellMode),
            side: "center",
            color: "red",
            duration: this.data.features.HELL_DURATION
        });

        // Apply Hell Effects
        switch (this.data.currentHellMode) {
            case hellMode.big_balls:
                this.data.balls.forEach(b => b.setSizeModifier(BALL_CONFIG.big_ball_size_mod));
                break;
            case hellMode.small_paddles:
                [...this.data.paddlesLeft, ...this.data.paddlesRight].forEach(paddle => {
                    paddle.applyEffect(magicEffect.small, this.data.features.HELL_DURATION)
                });
                break;
            case hellMode.slow_paddles:
                [...this.data.paddlesLeft, ...this.data.paddlesRight].forEach(paddle => {
                    paddle.applyEffect(magicEffect.slow, this.data.features.HELL_DURATION)
                });
                break;
            case hellMode.multipleBalls:
                while (this.data.balls.length < BALL_CONFIG.max_amount) this.data.balls.push(new ServerBall(0, 0));
                this.data.balls.forEach(b => { if (b.velocity === 0) b.throwBall(this.data.table); });
                break;
        }
    }

    private exitHellMode() {
        this.data.isHell = false;
        this.data.phaseTimer = 0;
        this.data.currentHellMode = hellMode.null;


        while (this.data.balls.length > BALL_CONFIG.min_amount) this.data.balls.pop();
        this.data.balls.forEach(b => {
            b.resetSize();
            b.resetSpeedModifier();
        });
        [...this.data.paddlesLeft, ...this.data.paddlesRight].forEach(paddle => { paddle.resetEffects() });
    }

    private checkCollision(mb: ServerMagicBall, paddle: ServerPaddle): boolean {
        const pBox = paddle.getBoundingBox();
        const colX = (mb.pos.x + mb.radius >= pBox.left) && (mb.pos.x - mb.radius <= pBox.right);
        const colZ = (mb.pos.z + mb.radius >= pBox.near) && (mb.pos.z - mb.radius <= pBox.far);
        return colX && colZ;
    }

    /**
     * Generates a DTO (Data Transfer Object) for the client.
     */
    public getSnapshot() {
        const allPaddles = [...this.data.paddlesLeft, ...this.data.paddlesRight].map(p => ({
            side: p.side,
            index: p.playerIndex,
            pos: p.pos.asArray(),
            size: p.depth,
            sizeX: p.width
        }));
        return {
            status: this.data.status,
            balls: this.data.balls.map(b => ({
                pos: b.pos.asArray(),
                radius: b.radius,
                particles: b.isColliding,
            })),
            magicBalls: this.data.magicBalls.map(mb => mb.getData()),
            paddles: allPaddles,
            table: {
                sizeX: this.data.table.width,
                sizeZ: this.data.table.depth
            },
            score: this.data.score,
            time: this.data.gameTime,
            hellTimer: this.data.phaseTimer,
            isHell: this.data.isHell,
            activeHellMode: this.data.currentHellMode,
            scoreFlash: this.data.scoreFlash,
        };
    }
}