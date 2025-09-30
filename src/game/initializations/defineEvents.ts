/**
 * Defines keydown/keyup event handlers to update the keysPressed array.
 * @param keysPressed - Array tracking pressed key states by keyCode
 */
export function defineEvents(keysPressed: boolean[] = []) {
    window.addEventListener("keydown", (e) => {
        keysPressed[e.keyCode] = true;
    });
    window.addEventListener("keyup", (e) => {
        keysPressed[e.keyCode] = false;
    });
}