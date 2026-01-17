import { type GameData, hellMode, Vec3 } from "../../index.js";

/**
 * Smoothly updates the camera's position and orientation based on the game state.
 * @param data - Scene/game state
 */
export function updateCamera(data: GameData) {
    // Extra rotation if viewing from the left side
    const extraRotation = !data.mods.is_hell ? 0 : 4 * Math.PI;
    let cameraAlpha = 0;
    let cameraBeta = 0;

    // change camera_pos (hell mode)
    if (data.mods.hell_mode == hellMode.twisted_view)
        data.flags.camera_pos = 1;

    // Camera preset positions
    if (data.flags.camera_pos === 1) {
        cameraAlpha = -Math.PI / 2;
        cameraBeta = Math.PI / 4 + extraRotation;
    } else if (data.flags.camera_pos === 2) {
        cameraAlpha = -Math.PI;
        cameraBeta = Math.PI / 2.5 + extraRotation;
    } else if (data.flags.camera_pos === 3) {
        cameraAlpha = 0;
        cameraBeta = Math.PI / 2.5 + extraRotation;
    }

    const cameraRadius = 175;
    const camera = data.env.camera;
    const smooth = 3;

    // Interpolate camera parameters for smooth movement
    camera.alpha += (cameraAlpha - camera.alpha) * Math.min(1, smooth * data.mods.step);
    camera.beta += (cameraBeta - camera.beta) * Math.min(1, smooth * data.mods.step);
    camera.radius += (cameraRadius - camera.radius) * Math.min(1, smooth * data.mods.step);
    camera.target = new Vec3(0, 0, 0);
}

export function rotateCamera(data: GameData) {
    data.env.camera.alpha += (data.mods.step ? data.mods.step * 0.05 : 0);
    data.env.camera.beta += (data.mods.step ? data.mods.step * 0.03 : -0.001);
}