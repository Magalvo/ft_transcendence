import { createMagicBall, MagicBall, magicEffect, randomInt, type MagicEffect, type GameData } from "../../index.js";

/**
 * Updates the side timer, the UI label, and switches sides when needed.
 * @param obj2D - UI objects for the scene
 * @param data - The current scene/game state
 */
export function magicBallsController(data: GameData) {
    const obj3D = data.obj3D;
    const magicBalls = data.magicBalls;
    // Update which side is "good" if needed
    if (!data.mods.is_hell)
        advanceTimer(data);
    else {
        if (magicBalls.magic_balls_ref.length)
            obj3D.paddles.forEach(paddle => paddle.magicBallEffects = []);
        for (let ball of magicBalls.magic_balls_ref) {
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
function advanceTimer(data: GameData) {
    const obj3D = data.obj3D;
    const magicBalls = data.magicBalls;
    // get random spawn values
    const spawn_range_x = obj3D.table.dimensions.value.x * 0.1;
    const spawn_range_y = obj3D.table.dimensions.value.y * 0.1;
    const random_x = obj3D.table.pos.value.x + randomInt(-spawn_range_x, spawn_range_x);
    const random_z = obj3D.table.pos.value.y + randomInt(-spawn_range_y, spawn_range_y);

    // advance countdown for next magic ball
    magicBalls.next_magic_ball -= data.mods.step;
    // spawn new magic ball if timer is up
    if (magicBalls.next_magic_ball <= 0) {
        magicBalls.next_magic_ball = randomInt(magicBalls.min_time, magicBalls.max_time);
        if (!data.mods.is_hell && obj3D.balls.filter(e => e instanceof MagicBall).length < magicBalls.max_balls) {
            const new_ball = createMagicBall(data.scene, random_x, random_z, getRandomEffect());
            obj3D.balls.push(new_ball);
            magicBalls.magic_balls_ref.push(new_ball);
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