import { hellMode, keyCode, mov } from "../../index.js";
import type { GameData } from "../../index.js";

/**
 * Handles keyboard input to:
 * update camera position
 * put game on pause
 * move players
 * @param data - Scene/game state
 */
export function handleKeyboardEvents(data: GameData) {
    cameraMov(data);
    gamePause(data);
    // if (data.mods.hell_mode == hellMode.inverted_keys)
    //     invertedPlayersMove(data);
    // else
    normalPlayersMove(data);
}

function normalPlayersMove(data: GameData) {
    const input = data.input;
    // LEFT PLAYER 
    // move far 'A' 'W' '←' '↑'
    // move near 'S' 'D' '→' '↓'
    if (
        input.keysPressed[keyCode.W] ||
        input.keysPressed[keyCode.A] ||
        input.keysPressed[keyCode.LEFT_ARROW] ||
        input.keysPressed[keyCode.UP_ARROW]
    )
        input.paddle_mov = mov.far;
    else if (
        input.keysPressed[keyCode.S] ||
        input.keysPressed[keyCode.D] ||
        input.keysPressed[keyCode.RIGHT_ARROW] ||
        input.keysPressed[keyCode.DOWN_ARROW]
    )
        input.paddle_mov = mov.near;
    else
        input.paddle_mov = mov.null;
}

function cameraMov(data: GameData) {
    // Switch camera presets with 'Z', 'X', 'C'
    if (data.input.keysPressed[keyCode.Z]) data.flags.camera_pos = 2;
    if (data.input.keysPressed[keyCode.X]) data.flags.camera_pos = 1;
}

function gamePause(data: GameData) {
    // Put game on pause with 'P'
    if (data.input.keysPressed[keyCode.P]) data.flags.pause_screen = true;
    if (data.input.keysPressed[keyCode.ESC]) data.flags.pause_screen = true;
}