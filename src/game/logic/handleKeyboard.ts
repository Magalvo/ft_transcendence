import { keyCode } from "../../index.js";
import type { SceneData } from "../../index.js";

/**
 * Handles keyboard input to:
 * update camera position
 * put game on pause
 * @param data - Scene/game state
 */
export function handleKeyboardEvents(data: SceneData) {
    // Switch camera presets with 'Z', 'X', 'C'
    if (data.keysPressed[keyCode.Z]) data.camera_pos = 2;
    if (data.keysPressed[keyCode.X]) data.camera_pos = 1;
    if (data.keysPressed[keyCode.C]) data.camera_pos = 3;

    // Put game on pause with 'P'
    if (data.keysPressed[keyCode.P]) data.pause_screen = true;
    if (data.keysPressed[keyCode.ESC]) data.pause_screen = true;
}