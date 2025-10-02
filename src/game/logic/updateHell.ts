import { hellMode, randomInt, type HellMode, type SceneData } from "../../index.js";

/**
 * Randomly selects and updates the current hell mode for the game scene.
 * @param data - The current scene/game state object. Its hell_mode property will be updated.
 */
export function updateHell(data: SceneData) {
    data.hell_mode = getRandomHellMod();
}

/**
 * Returns a random valid HellMode value.
 * Assumes that HellMode is a numeric enum ranging from 1 to hellMode.end_list (inclusive).
 * @returns A randomly selected HellMode.
 */
function getRandomHellMod(): HellMode {
    // Generate a random integer between 1 and hellMode.end_list (inclusive)
    const nb = randomInt(1, hellMode.end_list);
    // Type assertion: assumes nb is always a valid HellMode value
    return nb as HellMode;
}