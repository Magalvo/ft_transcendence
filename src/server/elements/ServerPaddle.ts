import {
    PADDLE_CONFIG,
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
    public human: boolean;

    // Stats
    public width: number = PADDLE_CONFIG.width;
    public depth: number = PADDLE_CONFIG.depth;
    private speed: number = PADDLE_CONFIG.speed;

    // Effects
    private effectTimer: number = 0;
    public currentEffect: MagicEffect = magicEffect.null;
    private knockback: number = 0;

    private readonly limitsZ = 45; // Table half-height
    private baseX: number;
    private bot?: SmartBot;

    // --- CONSTRUCTOR ---
    constructor(side: 'left' | 'right', playerType: 'human' | 'bot', x: number, botLevel: number = 5) {
        this.side = side;
        this.baseX = x;
        this.pos = new Vector3(x, 3, 0);
        this.human = (playerType === 'human');

        if (!this.human) {
            this.bot = new SmartBot(side, botLevel);
        }
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
        this.clampPosition();
    }

    // --- LOGIC ---
    private getCommand(data: IGameData): Mov {
        if (!this.human && this.bot) {
            return this.bot.think(data, this);
        }

        let cmd = (this.side === 'left') ? data.inputs.left : data.inputs.right;

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
            this.knockback = Math.max(0, this.knockback - (dt * PADDLE_CONFIG.knockback_recover));

        const dir = (this.side === 'left') ? -1 : 1;
        this.pos.x = this.baseX + (dir * this.knockback);
    }

    private clampPosition() {
        const limit = this.limitsZ - (this.depth / 2);
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
        this.knockback += PADDLE_CONFIG.knockback_step;
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
        this.width = PADDLE_CONFIG.width;
        this.depth = PADDLE_CONFIG.depth;
        this.speed = PADDLE_CONFIG.speed;
        this.effectTimer = 0;
        this.currentEffect = magicEffect.null;
    }

    public reset() {
        this.resetEffects();
        this.pos = new Vector3(this.baseX, 3, 0);
    }
}