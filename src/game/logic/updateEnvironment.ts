import { side } from "../../index.js";
import type { Parts3D, SceneData } from "../../index.js";

/**
 * Updates the environment (e.g., flames, skybox) based on the current side.
 * @param parts3D - 3D scene parts (flames, skybox, etc.)
 * @param data - Scene/game state
 */
export function updateEnvironment(parts3D: Parts3D, data: SceneData) {
    // Heaven & Hell: different effects for right vs left side
    if (data.good_side === side.right) {
        parts3D.flame_L1.stop();
        parts3D.flame_L2.stop();
        parts3D.flame_R1.stop();
        parts3D.flame_R2.stop();
        parts3D.sky_box.rotation.y += 0.001;
    } else if (data.good_side === side.left) {
        parts3D.flame_L1.start();
        parts3D.flame_L2.start();
        parts3D.flame_R1.start();
        parts3D.flame_R2.start();
        parts3D.sky_box.rotation.y += 0.05;
    }
    // Skybox rotation is always updated above
}