import {
    Vector3,
    magicEffect,
    randomInt,
    normalizeAngle180,
    ServerPaddle
} from "../index.js";

export class ServerBall {
    public pos: Vector3;
    public velocity: number = 0; // Velocidade escalar
    public angle: number = 0;    // Ângulo em graus
    public radius: number = 2;
    public isColliding: boolean = false;
    private readonly BASE_RADIUS = 2;
    private readonly BASE_SPEED = 50;
    private speedModifier: number = 1;
    private thickPaddleSpeedModifier: boolean = false;
    private tableLimits = { x: 170, z: 90 };


    constructor(x: number, z: number) {
        this.pos = new Vector3(x, 2, z);
        this.throwBall();
        this.resetStats();
    }

    // O update agora recebe as raquetes
    public update(deltaTime: number, paddles: ServerPaddle[]): 'left' | 'right' | null {
        this.isColliding = false;
        const a = this.angle * Math.PI / 180;
        const finalSpeedMod =
            this.thickPaddleSpeedModifier == true
                ? 2.5
                : this.speedModifier;

        // Calcular vetor de movimento
        const moveStep = this.velocity * deltaTime * finalSpeedMod;
        const vx = moveStep * Math.cos(a);
        const vz = moveStep * Math.sin(a);

        // Mover
        this.pos.x += vx;
        this.pos.z += vz;

        // Verificar colisões
        this.checkPaddleCollisions(paddles);
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
                this.isColliding = true;
                if (paddle.side === 'left') {
                    this.pos.x = pBox.right + this.radius + 0.1;
                    if (Math.abs(this.angle) > 90) {
                        this.angle = 180 - this.angle;
                    }
                } else {
                    this.pos.x = pBox.left - this.radius - 0.1;
                    if (Math.abs(this.angle) < 90) {
                        this.angle = 180 - this.angle;
                    }
                }

                if (this.radius > 2.5) {
                    paddle.applyImpact();
                }

                this.thickPaddleSpeedModifier =
                    (paddle.currentEffect == magicEffect.thick)
                        ? true
                        : false;

                const hitOffset = this.pos.z - paddle.pos.z;
                this.angle += hitOffset * 0.5;

                this.angle = normalizeAngle180(this.angle);
                this.velocity = Math.min(this.velocity * 1.05, this.BASE_SPEED * 2);
            }
        }
    }

    private checkWallCollisions(): 'left' | 'right' | null {
        // ... (Mantém o código igual ao passo anterior) ...
        // Apenas certifica-te que quando fazes this.throwBall(), resetas a velocidade:
        // this.velocity = this.BASE_SPEED; 

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
            this.isColliding = true;
            this.pos.z = halfDepth - this.radius;
            this.angle *= -1;
        } else if (this.pos.z < -halfDepth + this.radius) {
            this.isColliding = true;
            this.pos.z = -halfDepth + this.radius;
            this.angle *= -1;
        }
        return null;
    }

    public setBigBall(active: boolean) {
        if (active) {
            this.radius = 5;
        } else {
            this.radius = this.BASE_RADIUS;
        }
    }

    public setSpeedModifier(modifier: number) {
        this.speedModifier = modifier;
    }

    public resetStats() {
        this.radius = this.BASE_RADIUS;
        this.speedModifier = 1.0;
        this.velocity = this.BASE_SPEED;
    }

    public throwBall() {
        if (this.pos.x && this.pos.y) {
            this.pos.x = randomInt(-10, 10);
            this.pos.z = randomInt(-10, 10);
        }
        this.velocity = this.BASE_SPEED;
        this.angle = Math.random() < 0.5 ? 0 : 180;
        this.angle += (Math.random() * 90) - 45;
        this.angle = normalizeAngle180(this.angle);
        this.thickPaddleSpeedModifier = false;
    }
}