import { Vector3 } from "../../shared/Vector3.ts";
import { randomInt, normalizeAngle180 } from "../../shared/utils.ts";
import { ServerPaddle } from "./ServerPaddle.ts";

export class ServerBall {
    public pos: Vector3;
    public velocity: number = 0; // Velocidade escalar
    public angle: number = 0;    // Ângulo em graus
    public radius: number = 2;
    private speedBase: number = 50; // Velocidade base

    private tableLimits = { x: 170, z: 90 }; 

    constructor(x: number, z: number) {
        this.pos = new Vector3(x, 2, z);
        this.throwBall();
    }

    // O update agora recebe as raquetes
    public update(deltaTime: number, paddles: ServerPaddle[]): 'left' | 'right' | null {
        const a = this.angle * Math.PI / 180;
        
        // Calcular vetor de movimento
        const moveStep = this.velocity * deltaTime; 
        const vx = moveStep * Math.cos(a);
        const vz = moveStep * Math.sin(a);

        // Mover
        this.pos.x += vx;
        this.pos.z += vz;

        // Verificar colisões
        this.checkPaddleCollisions(paddles); // <--- NOVO
        return this.checkWallCollisions();
    }

    private checkPaddleCollisions(paddles: ServerPaddle[]) {
        for (const paddle of paddles) {
            const pBox = paddle.getBoundingBox();

            // Lógica AABB (Axis-Aligned Bounding Box)
            // Verifica se a bola (ponto + raio) sobrepõe a caixa da raquete
            const collisionX = 
                (this.pos.x + this.radius >= pBox.left) && 
                (this.pos.x - this.radius <= pBox.right);
            
            const collisionZ = 
                (this.pos.z + this.radius >= pBox.near) && 
                (this.pos.z - this.radius <= pBox.far);

            if (collisionX && collisionZ) {
                // HOUVE COLISÃO!
                
                // 1. Determinar direção do ressalto
                // Se bateu na raquete Esquerda (side='left'), a bola tem de ir para a Direita (X positivo)
                // Se bateu na Direita, tem de ir para a Esquerda.
                
                // Correção simples para evitar que a bola "cole" dentro da raquete:
                // Forçamos a posição da bola para fora da raquete imediatamente.
                if (paddle.side === 'left') {
                    this.pos.x = pBox.right + this.radius + 0.1;
                    // Ângulos que vão para a direita: -90 a 90. 
                    // Vamos inverter o X mantendo o componente Z.
                    if (Math.abs(this.angle) > 90) { // Se estava a ir para a esquerda
                         this.angle = 180 - this.angle; 
                    }
                } else {
                    this.pos.x = pBox.left - this.radius - 0.1;
                    if (Math.abs(this.angle) < 90) { // Se estava a ir para a direita
                        this.angle = 180 - this.angle;
                    }
                }

                // 2. Adicionar "Efeito" (English) dependendo de onde bateu na raquete (Z)
                // Se bater nas pontas, o ângulo abre mais.
                const hitOffset = this.pos.z - paddle.pos.z;
                // Ex: hitOffset é -10 (bateu em baixo). Alteramos ligeiramente o ângulo.
                this.angle += hitOffset * 0.5; 

                // 3. Normalizar ângulo e aumentar velocidade (Gameplay)
                this.angle = normalizeAngle180(this.angle);
                this.velocity = Math.min(this.velocity * 1.05, this.speedBase * 2); // Acelera 5% até ao dobro
                
                console.log(`SERVER: Ping! Paddle ${paddle.side}`);
            }
        }
    }

    private checkWallCollisions(): 'left' | 'right' | null {
        // ... (Mantém o código igual ao passo anterior) ...
        // Apenas certifica-te que quando fazes this.throwBall(), resetas a velocidade:
        // this.velocity = this.speedBase; 
        
        // Copia a tua função checkWallCollisions do Passo 7, 
        // mas garante que dentro dela usas o throwBall correto.
        const halfWidth = this.tableLimits.x / 2;
        const halfDepth = this.tableLimits.z / 2;

        if (this.pos.x > halfWidth - this.radius) {
            this.throwBall(); return 'left';
        } else if (this.pos.x < -halfWidth + this.radius) {
            this.throwBall(); return 'right';
        }

        if (this.pos.z > halfDepth - this.radius) {
            this.pos.z = halfDepth - this.radius;
            this.angle *= -1;
        } else if (this.pos.z < -halfDepth + this.radius) {
            this.pos.z = -halfDepth + this.radius;
            this.angle *= -1;
        }
        return null;
    }

    public throwBall() {
        this.pos.x = 0;
        this.pos.z = 0;
        this.velocity = this.speedBase; // Reset velocidade
        this.angle = randomInt(0, 1) === 0 ? 0 : 180; 
        this.angle += randomInt(-45, 45);
        this.angle = normalizeAngle180(this.angle);
    }
}