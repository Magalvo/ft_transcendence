import {
    Vector3,
    randomInt,
    randomFloat2,
    type MagicEffect,
    type IGameData,
} from "../index.js";

export class ServerMagicBall {
    public id: number;
    public pos: Vector3;
    public radius: number = 1.5;
    public active: boolean = true;
    public effectType: MagicEffect;

    // Movimento
    private velocity: Vector3;

    constructor(id: number, effectType: MagicEffect) {
        this.id = id;
        this.effectType = effectType;

        const x = randomInt(-30, 30);
        const z = randomInt(-30, 30);
        this.pos = new Vector3(x, 2, z);

        this.velocity = new Vector3(
            randomFloat2(30, 50) * (randomInt(0, 1) ? 1 : -1),
            0,
            randomFloat2(-20, 20)
        );
    }

    public update(dt: number, data: IGameData) {
        // Movimento simples
        this.pos.x += this.velocity.x * dt;
        this.pos.z += this.velocity.z * dt;

        // Ressalto nas paredes (Manter dentro da mesa)
        const halfWidth = data.table.width / 2;
        const halfDepth = data.table.depth / 2;

        if (this.pos.x > halfWidth - 5 || this.pos.x < -halfWidth + 5) {
            this.velocity.x *= -1;
        }
        if (this.pos.z > halfDepth - 5 || this.pos.z < -halfDepth + 5) {
            this.velocity.z *= -1;
        }
    }

    // Para enviar ao cliente
    public getData() {
        return {
            id: this.id,
            x: this.pos.x,
            y: this.pos.y,
            z: this.pos.z,
            type: this.effectType
        };
    }
}