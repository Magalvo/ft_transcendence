import {
    ServerPaddle,
    mov,
    type IGameData,
    type Mov,
} from '../index.js';

export function smartBot(data: IGameData, paddle: ServerPaddle): Mov {
    // Find closest ball
    const closestBall = data.balls.reduce((prev, b) =>
        Math.abs(b.pos.x - paddle.pos.x) < Math.abs(prev.pos.x - paddle.pos.x) ? b : prev
    );

    // Calculate velocity vector X
    const vx = closestBall.velocity * Math.cos(closestBall.angle * Math.PI / 180);

    // Move only if ball is coming towards paddle
    if ((paddle.side == "left" && vx < 0) || (paddle.side == "right" && vx > 0)) {
        if (Math.abs(paddle.pos.z - closestBall.pos.z) > 2) {
            return paddle.pos.z < closestBall.pos.z ? mov.far : mov.near;
        }
    }
    return mov.null;




    /* 
    SMART BOT

    1 - persegue a bola de jogo mais próxima, sempre
    2 - se houver mais que uma bola tenta apanhar o máximo de bolas possíveis, dando prioridade às bolas de jogo
    3 - se houver mais que uma bola de jogo tenta apanhar o máximo de bolas possíveis, mesmo que isso implique ignorar a bola mais próxima
    4 - se houver

    */


}