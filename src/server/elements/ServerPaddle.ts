import {
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
    private bot!: SmartBot;

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

    /**
     * 
     * @param side left or right
     * @param player 'human' for human player OR bot level for bot
     * @param x x position, it depends on player side
     */
    constructor(side: 'left' | 'right', player: 'human' | 'bot', x: number, botLevel?: number) {
        this.side = side;
        this.baseX = x;
        this.pos = new Vector3(x, 3, 0);
        if (player == 'human') {
            this.human = true;
        }
        else {
            this.human = false;
            this.bot = new SmartBot(side, botLevel);
        }
    }

    public update(deltaTime: number, data: IGameData) {
        // 1. Gerir o Timer do Efeito
        if (this.effectTimer > 0) {
            this.effectTimer -= deltaTime;
            if (this.effectTimer <= 0) {
                this.resetEffects();
            }
        }

        // 2. Movimento
        const command = this.getMovementCommand(data);
        this.move(deltaTime, command);

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

    private getMovementCommand(data: IGameData): Mov {
        let command: Mov;
        if (this.human) {
            command =
                (this.side === 'left') ?
                    data.inputs.left :
                    data.inputs.right;
            if (data.currentHellMode === hellMode.inverted_keys)
                command = invertInput(command);

        }
        else {
            command = this.bot.think(data, this);
        }
        return command;
    }

    public applyImpact() {
        this.knockback += 5;
    }

    public getBoundingBox() {
        return {
            left: this.pos.x - this.width / 2,
            right: this.pos.x + this.width / 2,
            near: this.pos.z - this.depth / 2,
            far: this.pos.z + this.depth / 2
        };
    }

    public applyPowerUp(effect: MagicEffect, duration: number) {
        this.resetEffects();
        this.effectTimer = duration;
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

    public reset() {
        this.resetEffects();
        this.pos = new Vector3(this.baseX, 3, 0);
    }

}

