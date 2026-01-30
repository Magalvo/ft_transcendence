import {
    Vector3,
    magicEffect,
    normalizeAngle180,
    ServerPaddle,
    BALL_CONFIG,
    ServerTable
} from "../index.js";

export class ServerBall {
    public pos: Vector3;
    public velocity: number = 0;
    public angle: number = 0;
    public radius: number = BALL_CONFIG.radius;
    public isColliding: boolean = false;

    // Configs
    private speedModifier: number = 1;
    private thickPaddleMod: boolean = false;

    constructor(x: number, z: number) {
        this.pos = new Vector3(x, 2, z);
        this.throwBall();
    }

    // --- MAIN UPDATE ---
    public update(dt: number, paddles: ServerPaddle[], table: ServerTable): 'left' | 'right' | null {
        this.isColliding = false;

        // 1. Calculate Movement
        const rad = this.angle * Math.PI / 180;
        const speed = this.velocity * dt * (this.thickPaddleMod ? 2.5 : this.speedModifier);
        
        this.pos.x += speed * Math.cos(rad);
        this.pos.z += speed * Math.sin(rad);

        // 2. Checks
        this.checkPaddleCollisions(paddles);
        return this.checkWallCollisions(table);
    }

    // --- PHYSICS LOGIC ---
    private checkPaddleCollisions(paddles: ServerPaddle[]) {
        for (const paddle of paddles) {
            const box = paddle.getBoundingBox();

            // AABB Collision Check
            if (this.pos.x + this.radius >= box.left &&
                this.pos.x - this.radius <= box.right &&
                this.pos.z + this.radius >= box.near &&
                this.pos.z - this.radius <= box.far) {
                
                this.resolvePaddleHit(paddle, box);
            }
        }
    }

    private resolvePaddleHit(paddle: ServerPaddle, box: any) {
        this.isColliding = true;
        
        // Push ball out of paddle to prevent sticking
        if (paddle.side === 'left') {
            this.pos.x = box.right + this.radius + 0.1;
            if (Math.abs(this.angle) > 90) this.angle = 180 - this.angle;
        } else {
            this.pos.x = box.left - this.radius - 0.1;
            if (Math.abs(this.angle) < 90) this.angle = 180 - this.angle;
        }

        // Apply Logic Effects
        if (this.radius > 2.5) paddle.applyImpact();
        this.thickPaddleMod = (paddle.currentEffect === magicEffect.thick);

        // Ricochet Angle based on impact point
        const hitOffset = this.pos.z - paddle.pos.z;
        this.angle = normalizeAngle180(this.angle + (hitOffset * 0.5));
        
        // Increase speed slightly
        this.velocity = Math.min(this.velocity * 1.05, BALL_CONFIG.speed * 2);
    }

    private checkWallCollisions(table: ServerTable): 'left' | 'right' | null {
        const limitX = table.width / 2;
        const limitZ = (table.depth / 2) - this.radius;

        // Score Goal
        if (this.pos.x > limitX) { this.throwBall(); return 'left'; }
        if (this.pos.x < -limitX) { this.throwBall(); return 'right'; }

        // Wall Bounce
        if (this.pos.z > limitZ) {
            this.pos.z = limitZ;
            this.angle *= -1;
            this.isColliding = true;
        } else if (this.pos.z < -limitZ) {
            this.pos.z = -limitZ;
            this.angle *= -1;
            this.isColliding = true;
        }
        return null;
    }

    // --- STATE MANAGEMENT ---
    public setSizeModifier(mod: number) {
        this.radius = BALL_CONFIG.radius * mod;
    }
    public resetSize() {
        this.radius = BALL_CONFIG.radius;
    }

    public setSpeedModifier(mod: number) {
        this.speedModifier = mod;
    }
    public resetSpeedModifier() {
        this.speedModifier = 1.0;
    }

    public throwBall() {
        this.pos.x = 0; 
        this.pos.z = 0;
        this.resetSpeedModifier();
        this.velocity = BALL_CONFIG.speed;
        this.thickPaddleMod = false;

        // Random start angle
        this.angle = (Math.random() < 0.5 ? 0 : 180) + ((Math.random() * 90) - 45);
        this.angle = normalizeAngle180(this.angle);
    }
}