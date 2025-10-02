import { createBall, hellMode } from "../../index.js";
import type { Objects3D, SceneData } from "../../index.js";


export function handleHellModes(data: SceneData, obj3D: Objects3D) {
    if (data.hell_mode == hellMode.multipleBalls)
        multipleBalls(data, obj3D);
    else
        removeExtraBalls(obj3D);

}

function multipleBalls(data: SceneData, obj3D: Objects3D) {
    const balls_amount = 5;
    while (obj3D.balls.length < balls_amount)
        obj3D.balls.push(createBall(obj3D.table.pos.x, data.scene));
}

function removeExtraBalls(obj3D: Objects3D) {
    const balls = obj3D.balls;
    while (balls.length > 1) {
        balls[balls.length - 1].dispose();
        balls.pop();
    }
}