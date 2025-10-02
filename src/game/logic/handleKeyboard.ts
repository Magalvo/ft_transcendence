import { hellMode, keyCode, mov } from "../../index.js";
import type { SceneData } from "../../index.js";

/**
 * Handles keyboard input to:
 * update camera position
 * put game on pause
 * move players
 * @param data - Scene/game state
 */
export function handleKeyboardEvents(data: SceneData) {
    cameraMov(data);
    gamePause(data);
    if (data.hell_mode == hellMode.inverted_keys)
        invertedPlayersMove(data);
    else
        normalPlayersMove(data);
}

function normalPlayersMove(data: SceneData) {
    // LEFT PLAYER 
    // move far 'A' 'W'
    // move near 'S' 'D'
    if (data.keysPressed[keyCode.W] || data.keysPressed[keyCode.A])
        data.left_paddle_mov = mov.far;
    else if (data.keysPressed[keyCode.S] || data.keysPressed[keyCode.D])
        data.left_paddle_mov = mov.near;
    else
        data.left_paddle_mov = mov.null;

    // RIGHT PLAYER 
    // move far '←' '↑'
    // move near '→' '↓'
    if (data.keysPressed[keyCode.LEFT_ARROW] || data.keysPressed[keyCode.UP_ARROW])
        data.right_paddle_mov = mov.far;
    else if (data.keysPressed[keyCode.RIGHT_ARROW] || data.keysPressed[keyCode.DOWN_ARROW])
        data.right_paddle_mov = mov.near;
    else
        data.right_paddle_mov = mov.null;
}

function invertedPlayersMove(data: SceneData) {
    // LEFT PLAYER 
    // move far 'A' 'W'
    // move near 'S' 'D'
    if (data.keysPressed[keyCode.W] || data.keysPressed[keyCode.A])
        data.left_paddle_mov = mov.near;
    else if (data.keysPressed[keyCode.S] || data.keysPressed[keyCode.D])
        data.left_paddle_mov = mov.far;
    else
        data.left_paddle_mov = mov.null;

    // RIGHT PLAYER 
    // move far '←' '↑'
    // move near '→' '↓'
    if (data.keysPressed[keyCode.LEFT_ARROW] || data.keysPressed[keyCode.UP_ARROW])
        data.right_paddle_mov = mov.near;
    else if (data.keysPressed[keyCode.RIGHT_ARROW] || data.keysPressed[keyCode.DOWN_ARROW])
        data.right_paddle_mov = mov.far;
    else
        data.right_paddle_mov = mov.null;
}

function cameraMov(data: SceneData) {
    // Switch camera presets with 'Z', 'X', 'C'
    if (data.keysPressed[keyCode.Z]) data.camera_pos = 2;
    if (data.keysPressed[keyCode.X]) data.camera_pos = 1;
    if (data.keysPressed[keyCode.C]) data.camera_pos = 3;
}

function gamePause(data: SceneData) {
    // Put game on pause with 'P'
    if (data.keysPressed[keyCode.P]) data.pause_screen = true;
    if (data.keysPressed[keyCode.ESC]) data.pause_screen = true;
}