// src/server/elements/ServerBall.ts
import { Vector3 } from "../../shared/Vector3.js";
import { mov, type Mov } from "../../shared/strings.js";
import { ServerPaddle } from "./ServerPaddle.js";
import { randomInt, normalizeAngle180 } from "../../shared/utils.js";

// Definição simples dos limites para colisão (Bounding Box)
interface ObjectLimits {
    left: number; right: number; upper: number; lower: number; near: number; far: number;
}

export class ServerBall {
    public pos: Vector3;
    public velocity: number = 0;
    public angle: number = 0;
    public radius: number = 2; // Raio fixo por defeito
    
    // Para simplificar, vamos hardcodar os limites da mesa por agora, 
    // ou podes passar um objeto "ServerTable" depois.
    private tableLimits = { x: 170, z: 90 }; 

    constructor(x: number, z: number) {
        this.pos = new Vector3(x, 2, z); // Y=2 altura padrão
        this.throwBall();
    }

    // Lógica de Movimento (Cópia da tua lógica original, sem Babylon)
    public update(deltaTime: number): 'left' | 'right' | null {
        const a = this.angle * Math.PI / 180;
        const moveStep = 50 * deltaTime; 
        const vx = moveStep * Math.cos(a);
        const vz = moveStep * Math.sin(a);

        this.pos.x += vx;
        this.pos.z += vz;

        // Verificar colisão com Paredes (Lógica simplificada do teu wallCollisions)
        return this.checkWallCollisions();
    }

    private checkWallCollisions(): 'left' | 'right' | null {
        const halfWidth = this.tableLimits.x / 2;
        const halfDepth = this.tableLimits.z / 2;
        let scorer: 'left' | 'right' | null = null;

        if (this.pos.x > halfWidth - this.radius) {
            scorer = 'left';
            this.throwBall();
        } else if (this.pos.x < -halfWidth + this.radius) {
            scorer = 'right';
            this.throwBall(); // Reset
        }

        if (this.pos.z > halfDepth - this.radius) {
            this.pos.z = halfDepth - this.radius;
            this.angle *= -1;
        } else if (this.pos.z < -halfDepth + this.radius) {
            this.pos.z = -halfDepth + this.radius;
            this.angle *= -1;
        }
        return scorer;
    }

    private throwBall() {
        this.pos.x = 0;
        this.pos.z = 0;
        // Lança para um lado aleatório
        this.angle = randomInt(0, 1) === 0 ? 0 : 180; 
        // Adiciona um pouco de aleatoriedade no ângulo (-45 a 45 graus)
        this.angle += randomInt(-45, 45);
        this.angle = normalizeAngle180(this.angle);
    }
}