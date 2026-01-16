import { type GameData, HEAVEN_DURATION, HELL_DURATION} from "../../index.js";


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
            ? HELL_DURATION - data.mods.devilElapsed
            : HEAVEN_DURATION - data.mods.goodElapsed;
    // Format to 1 decimal place
    data.obj2D.devil_timer_label.text = remaining.toFixed(1);
    // Color label based on active side
    data.obj2D.devil_timer_label.color = data.mods.devilElapsed > 0 ? "red" : "blue";
}