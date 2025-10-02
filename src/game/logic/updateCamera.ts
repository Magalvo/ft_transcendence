import { BABYLON, side } from "../../index.js";
import type { Parts3D, SceneData } from "../../index.js";

/**
 * Smoothly updates the camera's position and orientation based on the game state.
 * @param data - Scene/game state
 * @param parts3D - 3D scene parts (camera, etc.)
 */
export function updateCamera(data: SceneData, parts3D: Parts3D) {
    // Extra rotation if viewing from the left side
    const extraRotation = !data.hell_side ? 0 : 4 * Math.PI;
    let cameraAlpha = 0;
    let cameraBeta = 0;

    // Camera preset positions
    if (data.camera_pos === 1) {
        cameraAlpha = -Math.PI / 2;
        cameraBeta = Math.PI / 4 + extraRotation;
    } else if (data.camera_pos === 2) {
        cameraAlpha = -Math.PI;
        cameraBeta = Math.PI / 2.5 + extraRotation;
    } else if (data.camera_pos === 3) {
        cameraAlpha = 0;
        cameraBeta = Math.PI / 2.5 + extraRotation;
    }

    const cameraRadius = 175;
    const camera = parts3D.camera;
    const smooth = 3;

    // Interpolate camera parameters for smooth movement
    camera.alpha += (cameraAlpha - camera.alpha) * Math.min(1, smooth * data.step);
    camera.beta += (cameraBeta - camera.beta) * Math.min(1, smooth * data.step);
    camera.radius += (cameraRadius - camera.radius) * Math.min(1, smooth * data.step);
    camera.target = new BABYLON.Vector3(0, 0, 0);
}

export function rotateCamera(parts3D: Parts3D, data: SceneData) {
    parts3D.camera.alpha += (data.step ? data.step * 0.05 : 0);
    parts3D.camera.beta += (data.step ? data.step * 0.03 : -0.001);
}