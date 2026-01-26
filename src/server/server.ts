import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import {
    ServerBall,
    ServerPaddle,
    ServerMagicBall,
    GameStatus,
    randomInt,
    HEAVEN_DURATION,
    HELL_DURATION,
    hellMode,
    MAGIC_BALL_INTERVAL,
    MAGIC_BALL_MAX,
    MAGIC_EFFECT_DURATION,
    magicEffect,
    mov,
    GAME_DURATION,
    type MagicEffect,
    type Mov,
    type Side
} from './index.js';

// --- CONFIGURATION ---
const CONFIG = {
    PORT: 3000,
    TICK_RATE: 60,
    PAUSE_COOLDOWN_MS: 500,
    PADDLE_X_LEFT: -68,
    PADDLE_X_RIGHT: 68,
    SPEED_MOD_FAST: 4,
    SPEED_MOD_NORMAL: 2
};

const TICK_MS = 1000 / CONFIG.TICK_RATE;

// --- SERVER SETUP ---
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// --- START SERVER ---
httpServer.listen(CONFIG.PORT, () => {
    console.log(`🚀 Server running on http://localhost:${CONFIG.PORT}`);
});

// --- GAME STATE ---
let status: GameStatus = GameStatus.WAITING;
let balls: ServerBall[] = [new ServerBall(0, 0)];
let magicBalls: ServerMagicBall[] = [];

// Initialize paddles immediately
let paddleLeft: ServerPaddle = new ServerPaddle('left', 'human', CONFIG.PADDLE_X_LEFT);
let paddleRight: ServerPaddle = new ServerPaddle('right', 'human', CONFIG.PADDLE_X_RIGHT);

const score = { left: 0, right: 0 };
let countdownTimer = 3;
let scoreFlash: 'left' | 'right' | null = null;

// Logic Control
let lastPauseToggle = 0;
let gameTime = 0;
let phaseTimer = 0;
let isHell = false;
let currentHellMode: number = hellMode.null;
let magicBallTimer = 0;
let nextMagicBallId = 1;
let lastCountdownInt = 0;

// Inputs & Players
const inputs = { left: mov.null, right: mov.null };
const players: { [side: string]: string | null } = { left: null, right: null };
const playersReady: { [side: string]: boolean } = { left: false, right: false };

// --- HELPER FUNCTIONS ---

/**
 * Resets the game state to the initial values.
 */
function resetGame() {
    status = GameStatus.WAITING;

    gameTime = 0;
    phaseTimer = 0;
    isHell = false;
    currentHellMode = hellMode.null;
    score.left = 0;
    score.right = 0;

    // Reset entities
    balls = [new ServerBall(0, 0)];
    // balls[0].pos.x = 0; 
    // balls[0].pos.z = 0;
    // balls[0].velocity = 0;

    paddleLeft.resetEffects();
    paddleRight.resetEffects();
    magicBalls = [];
    inputs.left = mov.null;
    inputs.right = mov.null;
    players.left = null;
    players.right = null;
    playersReady.left = false;
    playersReady.right = false;
}

function startGame() {
    console.log("Starting countdown...");
    status = GameStatus.COUNTDOWN;
    countdownTimer = 3;
    lastCountdownInt = 4;
}

/**
 * Activates Hell Mode and applies its specific initial effects.
 */
function enterHellMode() {
    isHell = true;
    phaseTimer = 0;

    // Clear previous effects
    paddleLeft.resetEffects();
    paddleRight.resetEffects();
    magicBalls = []; // Clear magic balls in Hell

    currentHellMode = randomInt(1, hellMode.end_list);

    // Notify clients
    io.emit('gameMessage', {
        message: getHellModeName(currentHellMode),
        side: "center",
        color: "red",
        duration: HELL_DURATION
    });

    // Apply specific mode logic
    switch (currentHellMode) {
        case hellMode.big_balls:
            balls.forEach(b => b.setBigBall(true));
            break;
        case hellMode.small_paddles:
            paddleLeft.applyPowerUp(magicEffect.small);
            paddleRight.applyPowerUp(magicEffect.small);
            break;
        case hellMode.slow_paddles:
            paddleLeft.applyPowerUp(magicEffect.slow);
            paddleRight.applyPowerUp(magicEffect.slow);
            break;
        case hellMode.multipleBalls:
            while (balls.length < 4)
                balls.push(new ServerBall(0, 0));
            balls.forEach(b => {
                if (b.velocity === 0) b.throwBall();
            });
            break;
        case hellMode.fast_balls:
            //  balls.forEach(b => b.setFastBall(true));
            break;
    }
}

/**
 * Deactivates Hell Mode and resets temporary effects.
 */
function exitHellMode() {
    isHell = false;
    phaseTimer = 0;
    currentHellMode = hellMode.null;

    // Reset to single ball
    balls = [new ServerBall(0, 0)];
    balls[0].throwBall();

    // Reset Paddles
    paddleLeft.resetEffects();
    paddleRight.resetEffects();
}

/**
 * Manages the transition between Heaven and Hell phases.
 */
function updateGamePhases(dt: number) {
    phaseTimer += dt;

    if (!isHell && phaseTimer >= HEAVEN_DURATION) {
        enterHellMode();
    } else if (isHell && phaseTimer >= HELL_DURATION) {
        exitHellMode();
    }
}

/**
 * Manages spawning and collision detection for Magic Balls.
 */
function updateMagicBalls(dt: number) {
    // 1. Spawning (Only in Heaven)
    if (!isHell) {
        magicBallTimer += dt;
        if (magicBallTimer >= MAGIC_BALL_INTERVAL) {
            magicBallTimer = 0;
            if (magicBalls.length < MAGIC_BALL_MAX) {
                const effect = randomInt(1, magicEffect.end_list) as MagicEffect;
                const mb = new ServerMagicBall(nextMagicBallId++, effect);
                magicBalls.push(mb);
            }
        }
    } else {
        // Ensure list is empty in Hell
        if (magicBalls.length > 0) magicBalls = [];
    }

    // 2. Physics & Collision
    // Iterate backwards to allow safe removal
    for (let i = magicBalls.length - 1; i >= 0; i--) {
        const mb = magicBalls[i];
        mb.update(dt);

        let collected = false;
        const paddles = [paddleLeft, paddleRight];

        for (const paddle of paddles) {
            const pBox = paddle.getBoundingBox();

            // Simple AABB Collision
            const collisionX = (mb.pos.x + mb.radius >= pBox.left) && (mb.pos.x - mb.radius <= pBox.right);
            const collisionZ = (mb.pos.z + mb.radius >= pBox.near) && (mb.pos.z - mb.radius <= pBox.far);

            if (collisionX && collisionZ) {
                paddle.applyPowerUp(mb.effectType);
                collected = true;

                io.emit('gameMessage', {
                    message: getMagicEffectName(mb.effectType),
                    side: paddle.side,
                    color: "green",
                    duration: MAGIC_EFFECT_DURATION
                });
                break;
            }
        }

        if (collected) {
            magicBalls.splice(i, 1);
        }
    }
}

/**
 * Inverts input command (Up becomes Down).
 */
function invertInput(cmd: Mov): Mov {
    if (cmd === mov.far) return mov.near;
    if (cmd === mov.near) return mov.far;
    return mov.null;
}

function handleBot(paddle: ServerPaddle): Mov {
    let moveCommand: Mov = mov.null;

    const closest = balls.reduce((prev, b) =>
        Math.abs(b.pos.x - paddle.pos.x) < Math.abs(prev.pos.x - paddle.pos.x) ? b : prev
    );
    const vx = closest.velocity * Math.cos(closest.angle * Math.PI / 180);

    if ((paddle.side == "left" && vx < 0) ||
        (paddle.side == "right" && vx > 0)) {

        if (Math.abs(paddle.pos.z - closest.pos.z) > 2) {
            moveCommand = paddle.pos.z < closest.pos.z ? mov.far : mov.near;
        }
    }

    return moveCommand;
}

/**
 * Processes player inputs and applies movement to paddles.
 */
function updatePaddles(dt: number) {
    let leftCmd = getPaddleMoveCmd(paddleLeft);
    let rightCmd = getPaddleMoveCmd(paddleRight);

    // Handle 'Inverted Keys' Hell Mode
    if (currentHellMode === hellMode.inverted_keys) {
        leftCmd = invertInput(leftCmd);
        rightCmd = invertInput(rightCmd);
    }

    paddleLeft.update(dt, leftCmd);
    paddleRight.update(dt, rightCmd);
}

/**
 * Determines the move command for a paddle based on whether it is Human or Bot.
 */
function getPaddleMoveCmd(paddle: ServerPaddle): Mov {
    if (paddle.player === 'human') {
        // CORREÇÃO: Verificar qual o lado da raquete para atribuir o input correto
        return (paddle.side === 'left') ? inputs.left as Mov : inputs.right as Mov;
    }
    return handleBot(paddle);
}

/**
 * Updates ball physics and handling scoring.
 */
function updateBalls(dt: number) {
    const paddles = [paddleLeft, paddleRight];
    scoreFlash = null;

    balls.forEach(ball => {
        // Apply speed modifiers for Hell Mode
        if (isHell) {
            const mod = (currentHellMode === hellMode.fast_balls) ? CONFIG.SPEED_MOD_FAST : CONFIG.SPEED_MOD_NORMAL;
            ball.setSpeedModifier(mod);
        }

        const result = ball.update(dt, paddles);
        if (scoreFlash === null)
            scoreFlash = result;

        if (result === 'left') {
            score.left++;
            ball.throwBall();
        } else if (result === 'right') {
            score.right++;
            ball.throwBall();
        }
    });
}

/**
 * Creates the snapshot object to be sent to clients.
 */
function createSnapshot() {
    return {
        status: status,
        balls: balls.map(b => ({
            pos: b.pos.asArray(),
            radius: b.radius,
            particles: b.isColliding,
        })),
        magicBalls: magicBalls.map(mb => mb.getData()),
        paddles: [
            { side: 'left', pos: paddleLeft.pos.asArray(), size: paddleLeft.depth, sizeX: paddleLeft.width },
            { side: 'right', pos: paddleRight.pos.asArray(), size: paddleRight.depth, sizeX: paddleRight.width }
        ],
        score: score,
        time: gameTime,
        hellTimer: phaseTimer,
        isHell: isHell,
        activeHellMode: currentHellMode,
        scoreFlash: scoreFlash,
    };
}

// --- SOCKET EVENT HANDLERS ---

io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    // Assign Role
    let side: Side = 'spectator';
    if (players.left === null) {
        players.left = socket.id;
        side = 'left';
    } else if (players.right === null) {
        players.right = socket.id;
        side = 'right';
    }

    socket.emit('init', { side });
    console.log(`Player ${socket.id} assigned to: ${side}`);

    // Player Ready (ONLINE)
    socket.on('onlinePlayerReady', () => {
        const pSide = (players.left === socket.id) ? 'left' : (players.right === socket.id) ? 'right' : null;
        if (pSide) {
            playersReady[pSide] = true;
            console.log(`Player ${pSide} is ready.`);

            if (playersReady.left && playersReady.right) {
                // Both are HUMAN
                paddleLeft = new ServerPaddle('left', 'human', CONFIG.PADDLE_X_LEFT);
                paddleRight = new ServerPaddle('right', 'human', CONFIG.PADDLE_X_RIGHT);
                startGame();
            }
        }
    });

    // Player Ready (BOT MATCH)
    socket.on('offlinePlayerReady', () => {
        // Human vs Bot
        paddleLeft = new ServerPaddle('left', 'human', CONFIG.PADDLE_X_LEFT);
        paddleRight = new ServerPaddle('right', 'bot', CONFIG.PADDLE_X_RIGHT);
        startGame();
    });

    socket.on('demo', () => {
        // Bot vs Bot
        console.log(`Bot vs Bot demo`);
        paddleLeft = new ServerPaddle('left', 'bot', CONFIG.PADDLE_X_LEFT);
        paddleRight = new ServerPaddle('right', 'bot', CONFIG.PADDLE_X_RIGHT);
        startGame();
    });


    // Pause Game
    socket.on('pauseGame', () => {
        const now = Date.now();
        if (now - lastPauseToggle < CONFIG.PAUSE_COOLDOWN_MS) return;

        lastPauseToggle = now;
        if (status === GameStatus.RUNNING) {
            status = GameStatus.PAUSED;
            io.emit('gamePaused');
            console.log("GAME PAUSED");
        } else if (status === GameStatus.PAUSED) {
            status = GameStatus.RUNNING;
            io.emit('gameResumed');
            console.log("GAME RESUMED");
        }
    });

    // Input Handling
    socket.on('input', (data) => {
        if (side === 'left' && data.side === 'left') inputs.left = data.cmd;
        if (side === 'right' && data.side === 'right') inputs.right = data.cmd;
    });

    // Disconnect
    socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`);
        if (players.left === socket.id) players.left = null;
        if (players.right === socket.id) players.right = null;
    });
});

// --- MAIN GAME LOOP ---
setInterval(() => {
    const dt = TICK_MS / 1000;

    if (status === GameStatus.WAITING || status === GameStatus.PAUSED) {
        io.emit('gameState', createSnapshot());
        return;
    }

    if (status === GameStatus.COUNTDOWN) {
        countdownTimer -= dt;
        const currentInt = Math.ceil(countdownTimer);
        if (currentInt < lastCountdownInt) {
            lastCountdownInt = currentInt;
            if (currentInt > 0) {
                io.emit('countdown', { count: currentInt });
            }
        }
        if (countdownTimer <= 0) {
            status = GameStatus.RUNNING;
            io.emit('countdown', { count: 0 });
            balls[0].throwBall();
        }
        io.emit('gameState', createSnapshot());
        return;
    }


    if (status === GameStatus.ENDGAME) {
        countdownTimer -= dt / 2;
        const currentInt = Math.ceil(countdownTimer);
        if (currentInt < lastCountdownInt) {
            lastCountdownInt = currentInt;
            if (currentInt > 0) {
                io.emit('endGame', { count: currentInt });
            }
        }
        if (countdownTimer <= 0) {
            io.emit('endGame', { count: 0 });
            // reset game etc.
            resetGame();
        }
        io.emit('gameState', createSnapshot());
        return;
    }

    gameTime += dt;
    updateGamePhases(dt);
    updateMagicBalls(dt);
    updatePaddles(dt);
    updateBalls(dt);

    // Broadcast State
    io.emit('gameState', createSnapshot());

    if (gameTime >= GAME_DURATION) {
        countdownTimer = 3;
        lastCountdownInt = 4;
        status = GameStatus.ENDGAME;
    }

}, TICK_MS);

// --- HELPER STRINGS ---

function getHellModeName(id: number): string {
    switch (id) {
        case hellMode.inverted_keys: return "INVERTED KEYS";
        case hellMode.small_paddles: return "SMALL PADDLES";
        case hellMode.slow_paddles: return "SLOW PADDLES";
        case hellMode.fast_balls: return "FAST BALLS";
        case hellMode.big_balls: return "BIG BALLS";
        case hellMode.multipleBalls: return "MULTIBALL CHAOS";
        case hellMode.twisted_view: return "TWISTED VIEW";
        case hellMode.drunk_view: return "DRUNK VIEW";
        default: return "HELL MODE";
    }
}

function getMagicEffectName(id: number): string {
    switch (id) {
        case magicEffect.big: return "BIG PADDLE";
        case magicEffect.small: return "SMALL PADDLE";
        case magicEffect.slow: return "SLOW MOTION";
        case magicEffect.fast: return "SPEED BOOST";
        case magicEffect.freeze: return "FROZEN PADDLE";
        case magicEffect.thick: return "THICK PADDLE";
        default: return "MYSTERY EFFECT";
    }
}