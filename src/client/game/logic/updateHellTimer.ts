import { handleHellModes, hellMode, showWarningMessage, updateHell, type GameData } from "../../index.js";

// Constants for how long each side is active (in seconds)
const HEll_DURATION = 20;
const HEAVEN_DURATION = 30;

/**
 * Updates the side timer, the UI label, and switches sides when needed.
 * @param data - The current scene/game state
 */
export function updateHellTimer(data: GameData) {
    // Update which side is "good" if needed
    // advanceAndSwitchSides(data);
    // Update the timer label in the UI
    updateTimerLabel(data);
}

/**
 * Updates the timer label to show remaining time and color for current side.
 * @param obj2D - UI objects for the scene
 */
function updateTimerLabel(data: GameData) {
    // Determine which timer to show based on the current side
    const remaining =
        data.mods.devilElapsed > 0
            ? HEll_DURATION - data.mods.devilElapsed
            : HEAVEN_DURATION - data.mods.goodElapsed;
    // Format to 1 decimal place
    data.obj2D.devil_timer_label.text = remaining.toFixed(1);
    // Color label based on active side
    data.obj2D.devil_timer_label.color = data.mods.devilElapsed > 0 ? "red" : "blue";
}

// /**
//  * Advances the timers and switches the "good" side when time runs out.
//  * @param data - The current scene/game state
//  */
// function advanceAndSwitchSides(data: GameData) {
//     const mods = data.mods;
//     // Advance the right timer depending on which side is good
//     if (!mods.is_hell) {
//         mods.goodElapsed += mods.step;
//     } else if (mods.is_hell) {
//         mods.devilElapsed += mods.step;
//     }
//     // Switch sides when the timer is up
//     if (mods.goodElapsed >= HEAVEN_DURATION) {
//         mods.goodElapsed = 0;
//         mods.is_hell = true;
//         updateHell(data);
//         showHellModeMessage(data);
//     }
//     if (mods.devilElapsed >= HEll_DURATION) {
//         mods.devilElapsed = 0;
//         mods.is_hell = false;
//         mods.hell_mode = hellMode.null;
//         handleHellModes(data);
//     }
// }

// function showHellModeMessage(data: GameData) {
//     const hellModeMessages: Record<number, string> = {
//         [hellMode.inverted_keys]: "Inverted keys!",
//         [hellMode.small_paddles]: "Paddles are now small!",
//         [hellMode.slow_paddles]: "Paddles are slowed!",
//         [hellMode.fast_balls]: "Balls are super fast!",
//         [hellMode.big_balls]: "Balls are now BIG!",
//         [hellMode.multipleBalls]: "Multiple balls!",
//         [hellMode.infinite_balls]: "Infinite balls mode!",
//         [hellMode.twisted_view]: "Twisted view!",
//     };
//     const msg = hellModeMessages[data.mods.hell_mode];
//     if (msg) showWarningMessage({ scene: data.scene, message: msg, side: "center", duration: HEll_DURATION * 1000 });
// }