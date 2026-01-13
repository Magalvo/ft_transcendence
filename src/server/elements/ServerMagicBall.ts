import { Vector3 } from "../../shared/Vector3.js";
import { randomInt, randomFloat2 } from "../../shared/utils.js";

export class ServerMagicBall {
    public id: number;
    public pos: Vector3;
    public radius: number = 1.5; // Tamanho para colisão
    public active: boolean = true;
    public effectType: number; // ID do efeito (1 a 4, por exemplo)

    // Movimento
    private velocity: Vector3;
    private tableLimits = { x: 170, z: 90 };

    constructor(id: number, effectType: number) {
        this.id = id;
        this.effectType = effectType;
        
        // Spawn numa posição aleatória (mas não muito perto das pontas)
        const x = randomInt(-50, 50);
        const z = randomInt(-30, 30);
        this.pos = new Vector3(x, 2, z);

        // Velocidade aleatória lenta para flutuar pela mesa
        this.velocity = new Vector3(
            randomFloat2(-15, 15), 
            0, 
            randomFloat2(-15, 15)
        );
    }

    public update(dt: number) {
        // Movimento simples
        this.pos.x += this.velocity.x * dt;
        this.pos.z += this.velocity.z * dt;

        // Ressalto nas paredes (Manter dentro da mesa)
        const halfWidth = this.tableLimits.x / 2;
        const halfDepth = this.tableLimits.z / 2;

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