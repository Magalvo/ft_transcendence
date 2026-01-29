import { type GameData } from "../../index.js";

export function updateTimerLabel(data: GameData) {
    // get total time rounded to to seconds
    const total_seconds = Math.max(0, Math.floor(data.gameFeatures.GAME_DURATION - data.mods.time));
    // separate minutes and seconds
    const min = Math.floor(total_seconds / 60);
    const seconds = total_seconds % 60;
    // put a '0' if needed
    const formatted_min = String(min).padStart(2, '0');
    const formatted_seconds = String(seconds).padStart(2, '0');
    // update label
    data.obj2D.timer_label.text = formatted_min + ":" + formatted_seconds;
}

export function updateScoreLabels(data: GameData) {
    data.obj2D.left_score_label.text = String(data.mods.score.me);
    data.obj2D.right_score_label.text = String(data.mods.score.rival);
}

export function updateHellTimerLabel(data: GameData) {
    // Determine which timer to show based on the current side
    const remaining =
        data.mods.devilElapsed > 0
            ? data.gameFeatures.HELL_DURATION - data.mods.devilElapsed
            : data.gameFeatures.HEAVEN_DURATION - data.mods.goodElapsed;
    // Format to 1 decimal place
    data.obj2D.devil_timer_label.text = remaining.toFixed(1);
    // Color label based on active side
    data.obj2D.devil_timer_label.color = data.mods.devilElapsed > 0 ? "red" : "blue";
}