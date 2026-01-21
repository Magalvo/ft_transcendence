import { GAME_DURATION, type GameData } from "../../index.js";

/**
 * Updates time, timer label and time events.
 * @param obj2D - 2D UI objects
 * @param data - Scene/game state
 */
export function updateTimer(data: GameData) {
    // advance timer
    // data.mods.time += data.mods.step;
    updateTimerLabel(data);
}

function updateTimerLabel(data: GameData) {
    // get total time rounded to to seconds
    const total_seconds = Math.max(0, Math.floor(GAME_DURATION - data.mods.time));
    // separate minutes and seconds
    const min = Math.floor(total_seconds / 60);
    const seconds = total_seconds % 60;
    // put a '0' if needed
    const formatted_min = String(min).padStart(2, '0');
    const formatted_seconds = String(seconds).padStart(2, '0');
    // update label
    data.obj2D.timer_label.text = formatted_min + ":" + formatted_seconds;
}
