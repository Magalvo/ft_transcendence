import {
    ServerPaddle,
    ServerBall,
    ServerMagicBall,
    mov,
    type IGameData,
    type Mov,
    hellMode,
} from '../index.js';

// Threat definition now includes a priority flag
interface Threat {
    ball: ServerBall | ServerMagicBall;
    impactZ: number;
    timeToImpact: number;
    type: 'normal' | 'magic';
}

export class SmartBot {
    private intelligence: number; // 1 to 10
    private side: 'left' | 'right';
    private lastThinkTime: number = 0;
    private currentDecision: Mov = mov.null;
    private reactionDelayMs: number;

    constructor(side: 'left' | 'right', intelligence: number = 5) {
        this.side = side;
        this.intelligence = Math.max(1, Math.min(10, intelligence));
        // Higher intelligence = lower delay
        this.reactionDelayMs = (10 - this.intelligence) * 60;
    }

    public think(data: IGameData, paddle: ServerPaddle): Mov {
        const now = Date.now();
        const delayModifier =
            data.currentHellMode == hellMode.drunk_view ||
                data.currentHellMode == hellMode.inverted_keys ||
                data.currentHellMode == hellMode.twisted_view
                ? 1.5
                : 1;

        // Simulate reaction time based on intelligence
        if (now - this.lastThinkTime < this.reactionDelayMs * delayModifier) {
            return this.currentDecision;
        }

        this.lastThinkTime = now;
        this.currentDecision = this.processEnvironment(data, paddle);
        return this.currentDecision;
    }

    private processEnvironment(data: IGameData, paddle: ServerPaddle): Mov {
        // 1. Analyze threats (Normal Balls) and opportunities (Magic Balls)
        const targets = this.analyzeTargets(data, paddle);

        // 2. Idle behavior if nothing is happening
        if (targets.length === 0) {
            return this.idleBehavior(paddle);
        }

        // 3. Decide where to go
        const targetZ = this.calculateBestTargetZ(targets, paddle.depth);

        // 4. Move there (accounting for speed)
        return this.moveToTarget(paddle, targetZ);
    }

    /**
     * Analyzes all balls (Game & Magic) to determine impact points and times.
     */
    private analyzeTargets(data: IGameData, paddle: ServerPaddle): Threat[] {
        const targets: Threat[] = [];

        // Helper to process any list of balls
        const processList = (list: (ServerBall | ServerMagicBall)[], type: 'normal' | 'magic') => {
            for (const ball of list) {
                // Calculate velocity components
                // Note: MagicBalls might not have 'angle' property depending on your implementation.
                // Assuming MagicBalls move linearly on X axis or have similar physics:
                let vx = 0;
                let vz = 0;

                if (ball instanceof ServerBall) {
                    const rad = ball.angle * (Math.PI / 180);
                    vx = ball.velocity * Math.cos(rad);
                    vz = ball.velocity * Math.sin(rad);
                } else {
                    // Magic balls usually float or move slower. 
                    // Assuming they have a simple velocity property or fixed movement:
                    // If your MagicBall doesn't have velocity, we assume a static approach or constant speed.
                    // Adapt this line based on your MagicBall class structure:
                    vx = (this.side === 'left') ? -0.2 : 0.2; // Example static speed towards paddle
                    vz = 0;
                }

                // Check if incoming
                const isIncoming = this.side === 'left' ? vx < 0 : vx > 0;

                if (isIncoming) {
                    const distX = Math.abs(paddle.pos.x - ball.pos.x);
                    // Avoid division by zero
                    const safeVx = Math.abs(vx) < 0.01 ? 0.01 : Math.abs(vx);
                    const timeToImpact = distX / safeVx;

                    // Simple linear prediction for Z impact
                    // For magic balls (vz=0), impact is just current Z
                    let impactZ = ball.pos.z + (vz * timeToImpact);

                    targets.push({ ball, impactZ, timeToImpact, type });
                }
            }
        };

        // Process Game Balls (High Priority)
        processList(data.balls, 'normal');

        // Process Magic Balls (Low Priority)
        // Only consider them if intelligence is decent (>3)
        if (this.intelligence > 3) {
            processList(data.magicBalls, 'magic');
        }

        // Sort Logic:
        // 1. Normal balls always come first (Survival)
        // 2. Within same type, shortest time to impact comes first
        return targets.sort((a, b) => {
            if (a.type !== b.type) {
                return a.type === 'normal' ? -1 : 1;
            }
            return a.timeToImpact - b.timeToImpact;
        });
    }

    private calculateBestTargetZ(targets: Threat[], paddleSize: number): number {
        // The list is already sorted: Normal balls first, then Magic balls.
        const primaryTarget = targets[0];

        // If the primary target is Magic (meaning no Normal balls are threatening), just go for it.
        // Or if intelligence is low, focus only on the immediate threat.
        if (targets.length === 1 || this.intelligence < 6) {
            return primaryTarget.impactZ;
        }

        // --- CLUSTERING STRATEGY ---
        // Try to catch multiple items if possible.
        // We only cluster if the primary target is a Normal Ball. 
        // We don't risk missing a Normal ball to catch two Magic balls.

        const catchableCluster: Threat[] = [primaryTarget];
        const timeWindow = 0.6; // Slightly larger window

        for (let i = 1; i < targets.length; i++) {
            const nextTarget = targets[i];

            // 1. Time Check: Is it arriving roughly at the same time?
            if (nextTarget.timeToImpact - primaryTarget.timeToImpact > timeWindow) break;

            // 2. Priority Check: 
            // If we are chasing a Normal ball, we can try to add a Magic ball 
            // ONLY IF it fits in the paddle range without losing the Normal ball.

            const currentZPoints = [...catchableCluster.map(t => t.impactZ), nextTarget.impactZ];
            const minZ = Math.min(...currentZPoints);
            const maxZ = Math.max(...currentZPoints);

            // Safety margin: 80% of paddle size
            if ((maxZ - minZ) < (paddleSize * 0.8)) {
                catchableCluster.push(nextTarget);
            }
        }

        // Calculate center of the cluster
        const averageZ = catchableCluster.reduce((sum, t) => sum + t.impactZ, 0) / catchableCluster.length;
        return averageZ;
    }

    private moveToTarget(paddle: ServerPaddle, targetZ: number): Mov {
        // Calculate distance to target
        const dist = targetZ - paddle.pos.z;

        // Threshold to stop jittering (deadzone)
        // We adjust this based on the paddle's current speed capability if available,
        // but generally a fixed small value works well for stability.
        const threshold = 0.5;

        if (Math.abs(dist) < threshold) {
            return mov.null;
        }

        // Movement Logic
        // We simply return the direction. The physics engine handles the actual speed/velocity.
        // However, if we wanted to account for momentum (if your physics has inertia), 
        // we would need 'paddle.velocity' here. Assuming standard pong movement (instant stop/start):
        return dist > 0 ? mov.far : mov.near;
    }

    private idleBehavior(paddle: ServerPaddle): Mov {
        if (Math.abs(paddle.pos.z) > 1.5) {
            return paddle.pos.z < 0 ? mov.far : mov.near;
        }
        return mov.null;
    }
}