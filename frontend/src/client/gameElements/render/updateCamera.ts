import { type GameData, hellMode, Vec3 } from "../../index.js";
/**
 * Smoothly updates the camera's position and orientation based on the game state.
 * @param data - Scene/game state
 */
function lerp(start: number, end: number, amt: number) {
    return (1 - amt) * start + amt * end;
}

export function updateCamera(data: GameData) {
    const camera = data.env3D.camera;
    const mode = data.mods.hell_mode;
    const isHell = data.mods.is_hell;

    let targetAlpha = -Math.PI / 2;
    let targetBeta = 1.0;
    const table_median = (data.obj3D.table.dimensions.x + data.obj3D.table.dimensions.z) / 2;
    let targetRadius = 0 + Math.pow(table_median, 2) * 0.01;

    if (data.flags.camera_pos == 2 && mode != hellMode.twisted_view) {
        targetAlpha = -Math.PI;
        targetBeta = 1.3;
    }

    if (data.flags.game_running == true)
        data.env3D.camera.target = new Vec3(0, 0, 0);

    if (isHell)
        targetBeta += Math.PI * 4;

    if (mode === hellMode.drunk_view) {
        const time = Date.now() * 0.001;
        targetAlpha = -Math.PI / 2 + Math.sin(time) * 0.6; // mov left/right
        targetBeta = 1.0 + Math.cos(time * 1.5) * 0.4;     // mov up/down
        targetRadius = 180 + Math.sin(time * 2) * 20;      // zoom in/out
    }

    camera.alpha = lerp(camera.alpha, targetAlpha, 0.05);
    camera.beta = lerp(camera.beta, targetBeta, 0.05);
    camera.radius = lerp(camera.radius, targetRadius, 0.05);
}

export function rotateCamera(data: GameData) {
    data.env3D.camera.alpha += (data.mods.step ? data.mods.step * 0.05 : 0);
    data.env3D.camera.beta += (data.mods.step ? data.mods.step * 0.03 : -0.001);
}