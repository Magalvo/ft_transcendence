import { hellMode } from "../../../shared/types.js";
import type { GameData } from "../../GameData.js";

/**
 * Updates the environment (e.g., flames, skybox) based on the current side.
 * @param data - Scene/game state
 */
export function updateEnvironment(data: GameData) {
    const env = data.env3D;
    const isHell = data.mods.is_hell;

    // 1. Skybox Rotation
    // Rotate faster in Hell Mode
    const rotationSpeed = isHell ? 0.05 : 0.001;
    env.sky_box.rotation.y += rotationSpeed;

    // 2. Environmental Flames (Torches)
    if (isHell) {
        if (!env.flame_L1.isStarted()) env.flame_L1.start();
        if (!env.flame_L2.isStarted()) env.flame_L2.start();
        if (!env.flame_R1.isStarted()) env.flame_R1.start();
        if (!env.flame_R2.isStarted()) env.flame_R2.start();
    } else {
        if (env.flame_L1.isStarted()) env.flame_L1.stop();
        if (env.flame_L2.isStarted()) env.flame_L2.stop();
        if (env.flame_R1.isStarted()) env.flame_R1.stop();
        if (env.flame_R2.isStarted()) env.flame_R2.stop();
    }

    // 3. Canvas Effects (Twisted View)
    const canvas = document.getElementById("renderCanvas");
    if (canvas) {
        if (data.mods.hell_mode === hellMode.twisted_view) {
            canvas.style.transform = "scaleX(-1)";
        } else {
            canvas.style.transform = "scaleX(1)";
        }
    }
}