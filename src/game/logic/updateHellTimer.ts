import { handleHellModes, hellMode, showWarningMessage, updateHell, type Objects2D, type Objects3D, type SceneData } from "../../index.js";

// Constants for how long each side is active (in seconds)
const HEll_DURATION = 20;
const HEAVEN_DURATION = 30;

// Internal timers for each side (in seconds)
let devilElapsed = 0;
let goodElapsed = 0;

/**
 * Updates the side timer, the UI label, and switches sides when needed.
 * @param obj2D - UI objects for the scene
 * @param data - The current scene/game state
 */
export function updateHellTimer(obj2D: Objects2D, data: SceneData, obj3D: Objects3D) {
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
            ? HEll_DURATION - devilElapsed
            : HEAVEN_DURATION - goodElapsed;
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
    if (goodElapsed >= HEAVEN_DURATION) {
        goodElapsed = 0;
        data.is_hell = true;
        updateHell(data, obj3D);
        showHellModeMessage(data);
    }
    if (devilElapsed >= HEll_DURATION) {
        devilElapsed = 0;
        data.is_hell = false;
        data.hell_mode = hellMode.null;
        handleHellModes(data, obj3D);
    }
}

function showHellModeMessage(data: SceneData) {
    const hellModeMessages: Record<number, string> = {
        [hellMode.inverted_keys]: "Inverted keys!",
        [hellMode.small_paddles]: "Paddles are now small!",
        [hellMode.slow_paddles]: "Paddles are slowed!",
        [hellMode.fast_balls]: "Balls are super fast!",
        [hellMode.big_balls]: "Balls are now BIG!",
        [hellMode.multipleBalls]: "Multiple balls!",
        [hellMode.infinite_balls]: "Infinite balls mode!",
        [hellMode.twisted_view]: "Twisted view!",
    };
    const msg = hellModeMessages[data.hell_mode];
    if (msg) showWarningMessage({ scene: data.scene, message: msg, side: "center", duration: HEll_DURATION * 1000 });
}