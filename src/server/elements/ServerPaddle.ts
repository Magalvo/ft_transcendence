import {
    Vector3,
    MAGIC_EFFECT_DURATION,
    magicEffect,
    mov,
    type MagicEffect,
    type Mov,
} from "../index.js";

export class ServerPaddle {
    public pos: Vector3;
    public side: 'left' | 'right';
    public player: 'human' | 'bot';

    // Dimensões Físicas Atuais
    public width: number = 0.5;   // Eixo X (Espessura)
    public depth: number = 30;    // Eixo Z (Comprimento)
    private speed: number = 60;   // Velocidade

    // Valores Base
    private readonly BASE_WIDTH = 0.5;
    private readonly BASE_DEPTH = 30;
    private readonly BASE_SPEED = 60;

    // Timer do Efeito (em segundos de jogo)
    private effectTimer: number = 0;
    public currentEffect: MagicEffect = magicEffect.null;

    private tableLimits = { z: 90 };

    private baseX: number;
    private knockback: number = 0;

    constructor(side: 'left' | 'right', player: 'human' | 'bot', x: number) {
        this.side = side;
        this.player = player;
        this.baseX = x;
        this.pos = new Vector3(x, 3, 0);
    }

    public update(deltaTime: number, playerInput: Mov) {
        // 1. Gerir o Timer do Efeito
        if (this.effectTimer > 0) {
            this.effectTimer -= deltaTime;
            if (this.effectTimer <= 0) {
                this.resetEffects();
            }
        }

        // 2. Movimento
        this.move(deltaTime, playerInput);

        // 3. Limites (Clamping)
        const limit = (this.tableLimits.z / 2) - (this.depth / 2);
        if (this.pos.z > limit) this.pos.z = limit;
        if (this.pos.z < -limit) this.pos.z = -limit;
    }

    private move(deltaTime: number, moveCommand: Mov) {
        let dir = 0;
        if (moveCommand === mov.far) dir = 1;
        if (moveCommand === mov.near) dir = -1;

        if (dir !== 0) {
            this.pos.z += dir * this.speed * deltaTime;
        }

        if (this.knockback > 0) {
            this.knockback -= deltaTime * 0.3;
            if (this.knockback < 0) this.knockback = 0;
        }

        const direction = this.side === 'left' ? -1 : 1;
        this.pos.x = this.baseX + (direction * this.knockback);
    }

    public applyImpact() {
        this.knockback += 5;
        console.log(`${this.side} pushed back! New X: ${this.pos.x}`);
    }

    public getBoundingBox() {
        return {
            left: this.pos.x - this.width / 2,
            right: this.pos.x + this.width / 2,
            near: this.pos.z - this.depth / 2,
            far: this.pos.z + this.depth / 2
        };
    }

    public applyPowerUp(effect: MagicEffect) {
        this.resetEffects();
        this.effectTimer = MAGIC_EFFECT_DURATION;
        this.currentEffect = effect;

        switch (effect) {
            case magicEffect.big: // BIG (Z)
                this.depth = this.BASE_DEPTH * 2;
                break;
            case magicEffect.small: // SMALL (Z)
                this.depth = this.BASE_DEPTH * 0.4;
                break;
            case magicEffect.thick: // THICK (X - THICKNESS)
                this.width = this.BASE_WIDTH * 5;
                break;
            case magicEffect.fast:
                this.speed = this.BASE_SPEED * 4;
                break;
            case magicEffect.slow:
                this.speed = this.BASE_SPEED * 0.5;
                break;
            case magicEffect.freeze:
                this.speed = this.BASE_SPEED * 0.1;
                break;
            default:
                break;
        }
    }

    public resetEffects() {
        this.width = this.BASE_WIDTH;
        this.depth = this.BASE_DEPTH;
        this.speed = this.BASE_SPEED;
        this.effectTimer = 0;
        this.currentEffect = magicEffect.null;
    }
}   