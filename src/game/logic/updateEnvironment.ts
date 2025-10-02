import { hellMode, side } from "../../index.js";
import type { Objects3D, Parts3D, SceneData } from "../../index.js";

/**
 * Updates the environment (e.g., flames, skybox) based on the current side.
 * @param parts3D - 3D scene parts (flames, skybox, etc.)
 * @param data - Scene/game state
 */
export function updateEnvironment(parts3D: Parts3D, data: SceneData, obj3D: Objects3D) {
    // Heaven & Hell: different effects for right vs left side
    if (!data.hell_side) {
        parts3D.flame_L1.stop();
        parts3D.flame_L2.stop();
        parts3D.flame_R1.stop();
        parts3D.flame_R2.stop();
        for (let ball of obj3D.balls)
            ball.flame_animation.stop();
        parts3D.sky_box.rotation.y += 0.001;
    } else if (data.hell_side) {
        parts3D.flame_L1.start();
        parts3D.flame_L2.start();
        parts3D.flame_R1.start();
        parts3D.flame_R2.start();
        for (let ball of obj3D.balls)
            ball.flame_animation.start();
        parts3D.sky_box.rotation.y += 0.05;
    }

    const canvas = document.getElementById("renderCanvas");
    if (canvas)
    {
        // rotate all canvas (hell mode)
        if (data.hell_mode == hellMode.twisted_view) 
            canvas.style.transform = "scaleX(-1)";
        else 
            canvas.style.transform = "scaleX(1)";

    }
}