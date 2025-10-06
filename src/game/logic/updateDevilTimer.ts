import { handleHellModes, hellMode, updateHell, type Objects2D, type Objects3D, type SceneData } from "../../index.js";

// Constants for how long each side is active (in seconds)
const DEVIL_DURATION = 7;
const GOOD_DURATION = 5;

// Internal timers for each side (in seconds)
let devilElapsed = 0;
let goodElapsed = 0;

/**
 * Updates the side timer, the UI label, and switches sides when needed.
 * @param obj2D - UI objects for the scene
 * @param data - The current scene/game state
 */
export function updateDevilTimer(obj2D: Objects2D, data: SceneData, obj3D: Objects3D) {
    // Update which side is "good" if needed
    advanceAndSwitchSides(data, obj3D);
    // Update the timer label in the UI
    updateTimerLabel(obj2D);
}

/**
 * Updates the timer label to show remaining time and color for current side.
 * @param obj2D - UI objects for the scene
 */
function updateTimerLabel(obj2D: Objects2D) {
    // Determine which timer to show based on the current side
    const remaining =
        devilElapsed > 0
            ? DEVIL_DURATION - devilElapsed
            : GOOD_DURATION - goodElapsed;
    // Format to 1 decimal place
    obj2D.devil_timer_label.text = remaining.toFixed(1);
    // Color label based on active side
    obj2D.devil_timer_label.color = devilElapsed > 0 ? "red" : "blue";
}

/**
 * Advances the timers and switches the "good" side when time runs out.
 * @param data - The current scene/game state
 */
function advanceAndSwitchSides(data: SceneData, obj3D: Objects3D) {
    // Advance the right timer depending on which side is good
    if (!data.is_hell) {
        goodElapsed += data.step;
    } else if (data.is_hell) {
        devilElapsed += data.step;
    }
    // Switch sides when the timer is up
    if (goodElapsed >= GOOD_DURATION) {
        goodElapsed = 0;
        data.is_hell = true;
        updateHell(data, obj3D);
    }
    if (devilElapsed >= DEVIL_DURATION) {
        devilElapsed = 0;
        data.is_hell = false;
        data.hell_mode = hellMode.null;
        handleHellModes(data, obj3D);
    }
}