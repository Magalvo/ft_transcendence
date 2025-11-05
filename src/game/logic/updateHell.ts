import { handleHellModes, hellMode, randomInt, type HellMode, type GameObjects, type GameData } from "../../index.js";

let used_modes_list: HellMode[] = [];

/**
 * Returns a random valid HellMode value.
 * Assumes that HellMode is a numeric enum ranging from 1 to hellMode.end_list (inclusive).
 * @returns A randomly selected HellMode.
 */
function getRandomHellMod(): HellMode {
    // Generate a random integer between 1 and hellMode.end_list (inclusive)
    let nb: number = 1;
    while (1) {
        nb = randomInt(1, hellMode.end_list);
        if (!wasAlreadyUsed(nb as HellMode)) break;
    }
    // Type assertion: assumes nb is always a valid HellMode value
    return nb as HellMode;
}

function wasAlreadyUsed(random_mode: HellMode): boolean {

    // if list is full, reset it
    if (used_modes_list.length == hellMode.end_list)
        used_modes_list = [];

    // if list is not empty, read it
    if (used_modes_list.length) {
        for (let list_mode of used_modes_list) {
            if (random_mode == list_mode)
                return true;
        }
    }

    // if mode is not on list, use it
    used_modes_list.push(random_mode);
    return false;
}

/**
 * Randomly selects and updates the current hell mode for the game scene.
 * @param data - The current scene/game state object. Its hell_mode property will be updated.
 */
export function updateHell(data: GameData) {
    data.mods.hell_mode = getRandomHellMod();

    // Handle hell modes
    handleHellModes(data);
}