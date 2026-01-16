import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { ServerBall } from './elements/ServerBall.js';
import { ServerPaddle } from './elements/ServerPaddle.js';
import { HEAVEN_DURATION, HELL_DURATION, hellMode, MAGIC_BALL_INTERVAL, MAGIC_BALL_MAX, MAGIC_EFFECT_DURATION, magicEffect, mov, type MagicEffect, type Mov } from '../shared/strings.js';
import { GameStatus } from '../shared/types.js';
import { randomInt } from '../shared/utils.js';
import { ServerMagicBall } from './elements/ServerMagicBall.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*", // Em produção, muda isto para o URL do teu site
        methods: ["GET", "POST"]
    }
});

const PORT = 3000;

// --- ESTADO DO JOGO ---
let status: GameStatus = GameStatus.WAITING;

let balls: ServerBall[] = [];
balls.push(new ServerBall(0, 0));
const paddleLeft = new ServerPaddle('left', -68);
const paddleRight = new ServerPaddle('right', 68);
const score = { left: 0, right: 0 };

let lastPauseToggle = 0;
const PAUSE_COOLDOWN = 500;

const inputs = {
    left: mov.null,
    right: mov.null
};

const players: { [side: string]: string | null } = { left: null, right: null };
const playersReady: { [side: string]: boolean } = { left: false, right: false };

// Timers Globais
let gameTime = 0;
let phaseTimer = 0;
let isHell = false;
let currentHellMode: number = hellMode.null;

// Magic Balls
let magicBalls: ServerMagicBall[] = [];
let nextMagicBallId = 1;
let magicBallTimer = 0;

// --- SOCKET.IO EVENTOS ---
io.on('connection', (socket) => {
    console.log(`Cliente conectado: ${socket.id}`);

    // 1. Atribuir um lado ao novo jogador
    let side = 'spectator';

    if (players.left === null) {
        players.left = socket.id;
        side = 'left';
    } else if (players.right === null) {
        players.right = socket.id;
        side = 'right';
    }

    // 2. Avisar o cliente qual é o papel dele
    socket.emit('init', { side: side });
    console.log(`Jogador ${socket.id} atribuído a: ${side}`);

    socket.on('playerReady', () => {
        const side = (players.left === socket.id) ? 'left' : (players.right === socket.id) ? 'right' : null;

        if (side) {
            playersReady[side] = true;
            console.log(`Jogador ${side} está pronto!`);

            // Se ambos estiverem prontos, arranca o jogo!
            if (playersReady.left && playersReady.right) {
                startGame();
            }
        }
    });

    // --- NOVO: Pausa (Qualquer jogador pode pausar) ---
    socket.on('pauseGame', () => {
        const now = Date.now();

        if (now - lastPauseToggle < PAUSE_COOLDOWN) {
            return;
        }
        lastPauseToggle = now;

        if (status === GameStatus.RUNNING) {
            status = GameStatus.PAUSED;
            io.emit('gamePaused');
            console.log("JOGO PAUSADO");
        } else if (status === GameStatus.PAUSED) {
            status = GameStatus.RUNNING;
            io.emit('gameResumed');
            console.log("JOGO RETOMADO");
        }
    });

    // 3. Receber Input (Só aceita se for do dono da raquete)
    socket.on('input', (data) => {
        // Segurança básica: só aceita input se o socket for o dono desse lado
        if (side === 'left' && data.side === 'left') inputs.left = data.cmd;
        if (side === 'right' && data.side === 'right') inputs.right = data.cmd;
    });

    // 4. Lidar com desconexão
    socket.on('disconnect', () => {
        console.log(`Cliente desconectado: ${socket.id}`);
        if (players.left === socket.id) players.left = null;
        if (players.right === socket.id) players.right = null;
    });
});

function startGame() {
    console.log("AMBOS PRONTOS -> INICIAR JOGO!");
    status = GameStatus.RUNNING;
    // Resetar variáveis se necessário (score, tempo)
    gameTime = 0;
    phaseTimer = 0;
    isHell = false;
    currentHellMode = hellMode.null;
    score.left = 0;
    score.right = 0;
    balls = [new ServerBall(0, 0)];
    balls[0].throwBall();
}

// --- GAME LOOP (60 FPS) ---
const TICK_RATE = 60;
const TICK_MS = 1000 / TICK_RATE; // ~16.66 ms

setInterval(() => {

    const dt = TICK_MS / 1000;

    if (status === GameStatus.RUNNING) {

        gameTime += dt;

        // --- LÓGICA DO INFERNO (SERVER SIDE) ---
        phaseTimer += dt;

        if (!isHell && phaseTimer >= HEAVEN_DURATION) {
            isHell = true;
            phaseTimer = 0;

            paddleLeft.resetEffects();
            paddleRight.resetEffects();
            magicBalls = [];


            /* SLOW PADDLES ARE NOT DONE */
            currentHellMode = randomInt(1, hellMode.end_list);

            io.emit('gameMessage', {
                message: getHellModeName(currentHellMode),
                side: "center",
                color: "red",
                duration: HELL_DURATION
            });

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
                    balls.push(new ServerBall(0, 0));
                    balls.push(new ServerBall(0, 0));
                    balls.forEach(b => {
                        if (b.velocity === 0) b.throwBall();
                    });
                    break;
            }
        }
        else if (isHell && phaseTimer >= HELL_DURATION) {
            // Voltar ao Céu
            isHell = false;
            phaseTimer = 0;
            currentHellMode = hellMode.null;

            // Resetar para apenas 1 bola
            balls = [new ServerBall(0, 0)];
            balls[0].throwBall();

            // CORREÇÃO: Remover 'ball.resetStats()', pois a nova bola já vem limpa
            // E remover efeitos dos paddles
            paddleLeft.resetEffects();
            paddleRight.resetEffects();
        }

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
            magicBalls = [];
        }

        // ATUALIZAR E COLIDIR BOLAS MÁGICAS
        // Percorrer ao contrário para poder remover elementos seguramente
        for (let i = magicBalls.length - 1; i >= 0; i--) {
            const mb = magicBalls[i];
            mb.update(dt);

            // Verificar colisão com Raquetes
            // Usamos uma lógica simples de distância ou AABB
            let collected = false;

            for (const paddle of [paddleLeft, paddleRight]) {
                const pBox = paddle.getBoundingBox();
                // Colisão simples AABB (reaproveitando a lógica mental da bola principal)
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
                magicBalls.splice(i, 1); // Remove da lista
            }
        }



        let leftCmd: Mov = inputs.left as Mov;
        let rightCmd: Mov = inputs.right as Mov;

        if (currentHellMode === hellMode.inverted_keys) {
            if (leftCmd === mov.far)
                leftCmd = mov.near;
            else if (leftCmd === mov.near)
                leftCmd = mov.far;
            //
            if (rightCmd === mov.far)
                rightCmd = mov.near;
            else if (rightCmd === mov.near)
                rightCmd = mov.far;
        }

        paddleLeft.update(dt, leftCmd);
        paddleRight.update(dt, rightCmd);

        // 1. Atualizar física
        const paddles = [paddleLeft, paddleRight];
        balls.forEach(ball => {
            if (isHell) {
                const speedMod =
                    (currentHellMode === hellMode.fast_balls)
                        ? 4
                        : 2;
                ball.setSpeedModifier(speedMod);
            }

            const updateResult = ball.update(dt, paddles);

            if (updateResult === 'left') {
                score.left++;
                // Opcional: Se uma bola marca golo, fazemos reset a essa bola específica
                ball.throwBall();
            }
            else if (updateResult === 'right') {
                score.right++;
                ball.throwBall();
            }

            // Aplicar modos de Inferno ativos às bolas novas também
            // if (currentHellMode === hellMode.big_balls) ball.setBigBall(true);
            // if (currentHellMode === hellMode.fast_balls) ball.setSpeedModifier(true);
        });
    }

    // 2. Snapshot
    const gameState = {
        status: status,
        balls: balls.map(b => ({
            pos: b.pos.asArray(),
            radius: b.radius
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
        activeHellMode: currentHellMode
    };

    // 3. Enviar
    io.emit('gameState', gameState);

}, TICK_MS);

// --- INICIAR SERVIDOR ---
httpServer.listen(PORT, () => {
    console.log(`🚀 server running on http://localhost:${PORT}`);
});

// --- HELPERS PARA NOTIFICAÇÕES ---

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
        case magicEffect.freeze: return "FREEZED PADDLE";
        case magicEffect.thick: return "STRONG PADDLE";
        default: return "MYSTERY EFFECT";
    }
}
