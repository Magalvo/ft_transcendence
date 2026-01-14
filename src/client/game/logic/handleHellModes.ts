import { createPlayingBall, hellMode, magicEffect } from "../../index.js";
import type { GameObjects, GameData } from "../../index.js";


export function handleHellModes(data: GameData) {
    const obj3D = data.obj3D;
    // extra balls modes
    if (data.mods.hell_mode == hellMode.multipleBalls)
        multipleBalls(data, obj3D);
    else if (data.mods.hell_mode == hellMode.infinite_balls) { }
    else
        removeExtraBalls(obj3D);

    // effect modes
    switch (data.mods.hell_mode) {
        case hellMode.big_balls:
            obj3D.balls.forEach(ball => ball.hellEffects.push(magicEffect.big)); break;
        case hellMode.fast_balls:
            obj3D.balls.forEach(ball => ball.hellEffects.push(magicEffect.fast)); break;
        case hellMode.small_paddles:
            obj3D.paddles.forEach(paddle => paddle.hellEffects.push(magicEffect.small)); break;
        case hellMode.slow_paddles:
            obj3D.paddles.forEach(paddle => paddle.hellEffects.push(magicEffect.slow)); break;
        case hellMode.infinite_balls:
            obj3D.balls.forEach(ball => ball.hellEffects.push(magicEffect.normal_speed)); break;
        default:
            obj3D.paddles.forEach(paddle => paddle.hellEffects = []);
            obj3D.balls.forEach(ball => ball.hellEffects = []);
            break;
    }
}

function multipleBalls(data: GameData, obj3D: GameObjects) {
    const balls_amount = 3;
    while (obj3D.balls.length <= balls_amount)
        obj3D.balls.push(createPlayingBall(data.scene, obj3D.table.pos.value.x, obj3D.table.pos.value.z));
}

export function infiniteBallsAdd(data: GameData, x: number, z: number) {
    const max_balls = 15;
    if (data.obj3D.balls.length < max_balls)
        data.obj3D.balls.push(createPlayingBall(data.scene, x, z));
}

function removeExtraBalls(obj3D: GameObjects) {
    const balls = obj3D.balls;
    while (balls.length > 1) {
        balls[balls.length - 1].dispose();
        balls.pop();
    }
}