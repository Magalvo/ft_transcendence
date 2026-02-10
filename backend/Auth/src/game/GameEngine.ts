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
    randomFloat2,
    ServerTable,
    GameConfiguration,
    type MagicEffect,
    type IGameData,
} from './index.js';

export class GameEngine {
    public data: IGameData;
    private io: Server;
    private config: GameConfiguration;

    constructor(io: Server, configurations: GameConfiguration) {
        this.io = io;
        this.config = configurations;
        this.data = this.createInitialState();
    }

    // --- INITIALIZATION ---

    /**
     * Creates a clean state object.
     */
    private createInitialState(): IGameData {
        const inputsLeft = new Array(this.config.players_per_side).fill(mov.null);
        const inputsRight = new Array(this.config.players_per_side).fill(mov.null);

        return {
            configs: this.config,
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
            table: new ServerTable(this.config),

            score: { left: 0, right: 0 },
            scoreFlash: null,

            isHell: false,
            currentHellMode: hellMode.null,
            magicBallTimer: 0,
            nextMagicBallId: 1,

            players: [],
            inputs: { left: inputsLeft, right: inputsRight }
        };
    }

    public initGameEntities() {
        this.data.balls = [];
        this.data.paddlesLeft = [];
        this.data.paddlesRight = [];
        for (let i = 0; i < this.data.configs.ball.min_amount; i++)
            this.data.balls.push(new ServerBall(0, 0, this.config));
        this.data.paddlesLeft = this.createSidePaddles('left');
        this.data.paddlesRight = this.createSidePaddles('right');
    }

    public startGame() {
        console.log("Starting game...");
        this.resetGame();
        this.data.countdownTimer = 3;
        this.data.lastCountdownInt = 4;
        this.data.status = GameStatus.COUNTDOWN;
    }

    public resetGame() {

        // Reset Logic
        this.data.status = GameStatus.WAITING;
        this.data.gameTime = 0;
        this.data.phaseTimer = 0;
        this.data.score = { left: 0, right: 0 };
        this.data.isHell = false;

        // Reset Entities
        while (this.data.balls.length < this.config.ball.min_amount) this.data.balls.push(new ServerBall(0, 0, this.config));
        this.data.magicBalls = [];

        this.data.paddlesLeft = this.createSidePaddles('left');
        this.data.paddlesRight = this.createSidePaddles('right');

        // Reset Inputs
        this.data.inputs.left.fill(mov.null);
        this.data.inputs.right.fill(mov.null);
    }

    private createSidePaddles(side: 'left' | 'right'): ServerPaddle[] {
        const paddles: ServerPaddle[] = [];
        const players_amount = this.config.players_per_side;

        const teamPlayers = this.data.players.filter(p => p.side === side);

        for (let i = 0; i < players_amount; i++) {
            const spacing = 20;
            const startZ = players_amount === 1 ? 0 : -((players_amount - 1) * spacing) / 2;
            const z = startZ + (i * spacing);

            const player = teamPlayers[i];
            const type = player ? player.type : 'bot';

            let team_paddles = 1;
            paddles.forEach(p => { if (p.side == side) team_paddles++; });
            let paddle: ServerPaddle;
            if (type == 'human')
                paddle = new ServerPaddle(team_paddles, player.nick, type, side, this.data);
            else
                paddle = new ServerPaddle(team_paddles, player.nick, type, side, this.data, player.level!);

            paddle.pos.z = z;
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
        if (this.config.power_ups) this.updateMagicBalls(dt);
        this.updatePaddles(dt);
        this.updateBalls(dt);

        // Check for Match End
        if (this.data.gameTime >= this.config.game_duration)
            this.endGame();
    }

    public endGame() {
        this.data.status = GameStatus.ENDGAME;
        this.data.countdownTimer = 3;
        this.data.lastCountdownInt = 4;
    }

    private updatePhases(dt: number) {
        this.data.phaseTimer += dt;

        if (!this.data.isHell && this.data.phaseTimer >= this.config.heaven_duration)
            this.enterHellMode();
        else if (this.data.isHell && this.data.phaseTimer >= this.config.hell_duration)
            this.exitHellMode();
    }

    private updateMagicBalls(dt: number) {
        // 1. Spawning
        if (!this.data.isHell) {
            this.data.magicBallTimer += dt;
            const interval = randomFloat2(this.config.magic_ball.min_interval, this.config.magic_ball.max_interval);
            if (this.data.magicBallTimer >= interval) {
                this.data.magicBallTimer = 0;
                if (this.data.magicBalls.length < this.config.magic_ball.max_balls) {
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
                    paddle.applyEffect(mb.effectType, this.config.magic_ball.effect_duration);
                    collected = true;
                    const teamPlayers = this.data.players.filter(p => p.side === paddle.side);
                    const player = teamPlayers[paddle.playerIndex];
                    if (player && player.type === 'human' && player.socket_id) {
                        this.io.to(player.socket_id).emit('gameMessage', {
                            message: getMagicEffectName(mb.effectType),
                            side: paddle.side,
                            color: "green",
                            duration: this.config.magic_ball.effect_duration,
                        });
                    }
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
            duration: this.config.hell_duration
        });

        // Apply Hell Effects
        switch (this.data.currentHellMode) {
            case hellMode.big_balls:
                this.data.balls.forEach(b => b.setSizeModifier(this.config.ball.big_ball_size_mod));
                break;
            case hellMode.small_paddles:
                [...this.data.paddlesLeft, ...this.data.paddlesRight].forEach(paddle => {
                    paddle.applyEffect(magicEffect.small, this.config.hell_duration)
                });
                break;
            case hellMode.slow_paddles:
                [...this.data.paddlesLeft, ...this.data.paddlesRight].forEach(paddle => {
                    paddle.applyEffect(magicEffect.slow, this.config.hell_duration)
                });
                break;
            case hellMode.multipleBalls:
                while (this.data.balls.length < this.config.ball.max_amount) this.data.balls.push(new ServerBall(0, 0, this.config));
                this.data.balls.forEach(b => { if (b.velocity === 0) b.throwBall(this.data.table); });
                break;
        }
    }

    private exitHellMode() {
        this.data.isHell = false;
        this.data.phaseTimer = 0;
        this.data.currentHellMode = hellMode.null;


        while (this.data.balls.length > this.config.ball.min_amount) this.data.balls.pop();
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
            sizeX: p.width,
            nickname: p.nickname,
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
            phaseTimer: this.data.isHell
                ? this.config.hell_duration - this.data.phaseTimer
                : this.config.heaven_duration - this.data.phaseTimer,
        };
    }
}