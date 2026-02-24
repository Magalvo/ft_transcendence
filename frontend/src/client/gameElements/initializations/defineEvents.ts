import type { GameData } from "../../GameData";

// functions reference
let keyDownListener: ((e: KeyboardEvent) => void) | null = null;
let keyUpListener: ((e: KeyboardEvent) => void) | null = null;

/**
 * Defines keydown/keyup event handlers to update the keysPressed array.
 * @param GameData
 */
export function defineKeyEvents(data: GameData) {
    keyDownListener = (e: KeyboardEvent) => {
        data.input.keysPressed[e.keyCode] = true;
    };
    keyUpListener = (e: KeyboardEvent) => {
        data.input.keysPressed[e.keyCode] = false;
    };

    window.addEventListener("keydown", keyDownListener);
    window.addEventListener("keyup", keyUpListener);
}

/**
 * Remove event listeners.
 */
export function undefineKeyEvents() {
    if (keyDownListener && keyUpListener) {
        window.removeEventListener("keydown", keyDownListener);
        window.removeEventListener("keyup", keyUpListener);

        keyDownListener = null;
        keyUpListener = null;
    }
}