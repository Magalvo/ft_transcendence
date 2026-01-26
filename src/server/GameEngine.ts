import { Server } from 'socket.io';
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
    getHellModeName,
    getMagicEffectName,
    invertInput,
    CONFIG,
    type MagicEffect,
    type Mov
} from './index.js';

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
    paddleLeft: ServerPaddle;
    paddleRight: ServerPaddle;

    // Stats
    score: { left: number, right: number };
    scoreFlash: 'left' | 'right' | null;

    // Mechanics
    isHell: boolean;
    currentHellMode: number;
    magicBallTimer: number;
    nextMagicBallId: number;

    // Players
    inputs: { left: Mov, right: Mov };
    players: { left: string | null, right: string | null };
    playersReady: { left: boolean, right: boolean };
}

export class GameEngine {
    public data: IGameData;
    private io: Server; // Reference to IO for emitting game events (messages)

    constructor(io: Server) {
        this.io = io;
        this.data = this.createInitialState();
    }

    // --- INITIALIZATION ---

    /**
     * Creates a clean state object.
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

    public startGame() {
        console.log("Starting countdown...");
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
        this.data.balls = [new ServerBall(0, 0)];
        this.data.magicBalls = [];
        this.data.paddleLeft.resetEffects();
        this.data.paddleRight.resetEffects();

        // Reset Inputs
        this.data.inputs = { left: mov.null, right: mov.null };
        this.data.playersReady = { left: false, right: false };
    }

    // --- MAIN UPDATE METHODS ---

    /**
     * Called every tick to update physics and logic.
     */
    public update(dt: number) {
        this.data.gameTime += dt;
        this.updatePhases(dt);
        this.updateMagicBalls(dt);
        this.updatePaddles(dt);
        this.updateBalls(dt);

        // Check for Match End
        if (this.data.gameTime >= GAME_DURATION) {
            this.data.status = GameStatus.ENDGAME;
            this.data.countdownTimer = 3;
            this.data.lastCountdownInt = 4;
        }
    }

    private updatePhases(dt: number) {
        this.data.phaseTimer += dt;

        if (!this.data.isHell && this.data.phaseTimer >= HEAVEN_DURATION) {
            this.enterHellMode();
        } else if (this.data.isHell && this.data.phaseTimer >= HELL_DURATION) {
            this.exitHellMode();
        }
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
            // Clean up in Hell
            if (this.data.magicBalls.length > 0) this.data.magicBalls = [];
        }

        // 2. Collision & Physics
        for (let i = this.data.magicBalls.length - 1; i >= 0; i--) {
            const mb = this.data.magicBalls[i];
            mb.update(dt);

            let collected = false;
            const paddles = [this.data.paddleLeft, this.data.paddleRight];

            for (const paddle of paddles) {
                if (this.checkCollision(mb, paddle)) {
                    paddle.applyPowerUp(mb.effectType);
                    collected = true;

                    // Emit effect message
                    this.io.emit('gameMessage', {
                        message: getMagicEffectName(mb.effectType),
                        side: paddle.side,
                        color: "green",
                        duration: MAGIC_EFFECT_DURATION
                    });
                    break;
                }
            }

            if (collected) this.data.magicBalls.splice(i, 1);
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

    private updateBalls(dt: number) {
        const paddles = [this.data.paddleLeft, this.data.paddleRight];
        this.data.scoreFlash = null;

        this.data.balls.forEach(ball => {
            // Apply speed modifiers
            if (this.data.isHell) {
                const mod = (this.data.currentHellMode === hellMode.fast_balls)
                    ? CONFIG.SPEED_MOD_FAST
                    : CONFIG.SPEED_MOD_NORMAL;
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

    // --- HELPER LOGIC ---

    private enterHellMode() {
        this.data.isHell = true;
        this.data.phaseTimer = 0;
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

        // Apply Hell Effects
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
        }
    }

    private exitHellMode() {
        this.data.isHell = false;
        this.data.phaseTimer = 0;
        this.data.currentHellMode = hellMode.null;

        this.data.balls = [new ServerBall(0, 0)];
        this.data.balls[0].throwBall();

        this.data.paddleLeft.resetEffects();
        this.data.paddleRight.resetEffects();
    }

    private getPaddleMoveCmd(paddle: ServerPaddle): Mov {
        if (paddle.player === 'human') {
            return (paddle.side === 'left') ? this.data.inputs.left : this.data.inputs.right;
        }
        return this.handleBot(paddle);
    }

    private handleBot(paddle: ServerPaddle): Mov {
        // Find closest ball
        const closest = this.data.balls.reduce((prev, b) =>
            Math.abs(b.pos.x - paddle.pos.x) < Math.abs(prev.pos.x - paddle.pos.x) ? b : prev
        );

        // Calculate velocity vector X
        const vx = closest.velocity * Math.cos(closest.angle * Math.PI / 180);

        // Move only if ball is coming towards paddle
        if ((paddle.side == "left" && vx < 0) || (paddle.side == "right" && vx > 0)) {
            if (Math.abs(paddle.pos.z - closest.pos.z) > 2) {
                return paddle.pos.z < closest.pos.z ? mov.far : mov.near;
            }
        }
        return mov.null;
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
}