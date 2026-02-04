import {
    GameConfiguration,
    ServerTable,
    SmartBot,
    Vector3,
    hellMode,
    invertInput,
    magicEffect,
    mov,
    type IGameData,
    type MagicEffect,
    type Mov,
} from "../index.js";

export class ServerPaddle {
    public pos: Vector3;
    public side: 'left' | 'right';
    public playerType: 'human' | 'bot';
    public playerIndex: number = -1;

    // Stats
    public width: number;
    public depth: number;
    private speed: number;

    private configs: GameConfiguration;

    // Effects
    private effectTimer: number = 0;
    public currentEffect: MagicEffect = magicEffect.null;
    private knockback: number = 0;

    private baseX: number;
    private bot?: SmartBot;

    // --- CONSTRUCTOR ---
    constructor(nb: number, playerType: 'human', side: 'left' | 'right', data: IGameData)
    constructor(nb: number, playerType: 'bot', side: 'left' | 'right', data: IGameData, bot_level: number)
    constructor(nb: number, playerType: 'human' | 'bot', side: 'left' | 'right', data: IGameData, bot_level?: number) {
        this.configs = data.configs;
        this.width = data.configs.paddle.width;
        this.depth = data.configs.paddle.depth;
        this.speed = data.configs.paddle.speed;
        this.side = side;
        this.baseX = data.table.width / 2 * (0.9 - nb * 0.2) * (side == 'left' ? -1 : 1);
        // this.baseX = data.table.width / 0.4 * nb * (side == 'left' ? -1 : 1);
        this.pos = new Vector3(this.baseX, 3, 0);
        this.playerType = playerType;
        if (playerType == 'bot')
            this.bot = new SmartBot(side, bot_level);
    }

    // --- MAIN UPDATE ---
    public update(dt: number, data: IGameData) {
        // 1. Effects
        if (this.effectTimer > 0) {
            this.effectTimer -= dt;
            if (this.effectTimer <= 0) this.resetEffects();
        }

        // 2. Movement
        const command = this.getCommand(data);
        this.applyMovement(dt, command);

        // 3. Constraints
        this.clampPosition(data.table);
    }

    // --- LOGIC ---
    private getCommand(data: IGameData): Mov {
        if (this.playerType == 'bot' && this.bot) {
            return this.bot.think(data, this);
        }

        let cmd = (this.side === 'left') ? data.inputs.left[this.playerIndex] : data.inputs.right[this.playerIndex];

        if (data.currentHellMode === hellMode.inverted_keys) {
            cmd = invertInput(cmd);
        }
        return cmd;
    }

    private applyMovement(dt: number, cmd: Mov) {
        // Z-Axis Move
        if (cmd === mov.far) this.pos.z += this.speed * dt;
        if (cmd === mov.near) this.pos.z -= this.speed * dt;

        // X-Axis Knockback recovery
        if (this.knockback > 0)
            this.knockback = Math.max(0, this.knockback - (dt * this.configs.paddle.knockback_recover));

        const dir = (this.side === 'left') ? -1 : 1;
        this.pos.x = this.baseX + (dir * this.knockback);
    }

    private clampPosition(table: ServerTable) {
        const limit = (table.depth / 2) - (this.depth / 2);
        if (this.pos.z > limit) this.pos.z = limit;
        if (this.pos.z < -limit) this.pos.z = -limit;
    }

    // --- PUBLIC API ---
    public getBoundingBox() {
        return {
            left: this.pos.x - this.width / 2,
            right: this.pos.x + this.width / 2,
            near: this.pos.z - this.depth / 2,
            far: this.pos.z + this.depth / 2
        };
    }

    public applyImpact() {
        this.knockback += this.configs.paddle.knockback_step;
    }

    public applyEffect(effect: MagicEffect, duration: number) {
        this.resetEffects();
        this.currentEffect = effect;
        this.effectTimer = duration;

        switch (effect) {
            case magicEffect.big: this.depth = 60; break;
            case magicEffect.small: this.depth = 12; break;
            case magicEffect.thick: this.width = 2.5; break;
            case magicEffect.fast: this.speed = 240; break;
            case magicEffect.slow: this.speed = 30; break;
            case magicEffect.freeze: this.speed = 1; break;
        }
    }

    public resetEffects() {
        this.width = this.configs.paddle.width;
        this.depth = this.configs.paddle.depth;
        this.speed = this.configs.paddle.speed;
        this.effectTimer = 0;
        this.currentEffect = magicEffect.null;
    }

    public reset() {
        this.resetEffects();
        this.pos = new Vector3(this.baseX, 3, 0);
    }
}