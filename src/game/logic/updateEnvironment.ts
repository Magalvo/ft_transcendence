import { hellMode, PlayingBall, type GameData } from "../../index.js";

/**
 * Updates the environment (e.g., flames, skybox) based on the current side.
 * @param data - Scene/game state
 */
export function updateEnvironment(data: GameData) {
    const env = data.env;
    // Heaven & Hell: different effects for right vs left side
    if (!data.mods.is_hell) {
        env.flame_L1.stop();
        env.flame_L2.stop();
        env.flame_R1.stop();
        env.flame_R2.stop();
        for (let ball of data.obj3D.balls)
            if (ball instanceof PlayingBall)
                ball.flame_animation.stop();
        env.sky_box.rotation.y += 0.001;
    } else if (data.mods.is_hell) {
        env.flame_L1.start();
        env.flame_L2.start();
        env.flame_R1.start();
        env.flame_R2.start();
        for (let ball of data.obj3D.balls)
            if (ball instanceof PlayingBall)
                ball.flame_animation.start();
        env.sky_box.rotation.y += 0.05;
    }

    const canvas = document.getElementById("renderCanvas");
    if (canvas) {
        // rotate all canvas (hell mode)
        if (data.mods.hell_mode == hellMode.twisted_view)
            canvas.style.transform = "scaleX(-1)";
        else
            canvas.style.transform = "scaleX(1)";
    }
}