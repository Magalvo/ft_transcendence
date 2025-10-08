import { createMagicBall, MagicBall, magicEffect, randomInt, type MagicEffect, type Objects3D, type SceneData } from "../../index.js";

// Internal timers for each side (in seconds)
const min_time = 5;
const max_time = 15;
const max_balls = 4;
let next_magic_ball = randomInt(min_time, max_time);
let magic_balls_ref: MagicBall[] = [];

/**
 * Updates the side timer, the UI label, and switches sides when needed.
 * @param obj2D - UI objects for the scene
 * @param data - The current scene/game state
 */
export function magicBallsController(data: SceneData, obj3D: Objects3D) {
    // Update which side is "good" if needed
    if (!data.is_hell)
        advanceTimer(data, obj3D);
    else {
        if (magic_balls_ref.length)
            obj3D.paddles.forEach(paddle => paddle.magicBallEffects = []);
        for (let ball of magic_balls_ref) {
            const index = obj3D.balls.indexOf(ball);
            if (index !== -1) {
                ball.dispose();
                obj3D.balls.splice(index, 1);
            }
        }
    }
}

/**
 * Advances the timers and switches the "good" side when time runs out.
 * @param data - The current scene/game state
 */
function advanceTimer(data: SceneData, obj3D: Objects3D) {
    // get random spawn values
    const spawn_range_x = obj3D.table.dimensions.value.x * 0.1;
    const spawn_range_y = obj3D.table.dimensions.value.y * 0.1;
    const random_x = obj3D.table.pos.value.x + randomInt(-spawn_range_x, spawn_range_x);
    const random_z = obj3D.table.pos.value.y + randomInt(-spawn_range_y, spawn_range_y);

    // advance countdown for next magic ball
    next_magic_ball -= data.step;
    // spawn new magic ball if timer is up
    if (next_magic_ball <= 0) {
        next_magic_ball = randomInt(min_time, max_time);
        if (!data.is_hell && obj3D.balls.filter(e => e instanceof MagicBall).length < max_balls) {
            const new_ball = createMagicBall(data.scene, random_x, random_z, getRandomEffect());
            obj3D.balls.push(new_ball);
            magic_balls_ref.push(new_ball);
        }
    }
}


// Returns a random unused MagicEffect, resets when all are used
let used_modes_list: MagicEffect[] = [];
function getRandomEffect(): MagicEffect {
    if (used_modes_list.length === magicEffect.end_list) used_modes_list = [];
    let nb: MagicEffect;
    const all = Array.from({ length: magicEffect.end_list }, (_, i) => i + 1).filter(e => !used_modes_list.includes(e as MagicEffect));
    nb = all[randomInt(0, all.length - 1)] as MagicEffect;
    used_modes_list.push(nb);
    return nb;
}