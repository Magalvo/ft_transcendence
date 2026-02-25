import type { GameData } from "../../GameData.js";

export function updateTimerLabel(data: GameData) {
    const totalSeconds = Math.max(0, Math.floor(data.gameConfigs.game_duration - data.mods.time));

    const min = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
    const sec = String(totalSeconds % 60).padStart(2, '0');

    data.obj2D.timer_label.text = `${min}:${sec}`;
}

export function updateScoreLabels(data: GameData) {
    data.obj2D.left_score_label.text = data.mods.score.me.toString();
    data.obj2D.right_score_label.text = data.mods.score.rival.toString();
}

export function updateHellTimerLabel(data: GameData) {
    const label = data.obj2D.devil_timer_label;
    if (!label) return;

    const ticks = Math.max(0, Math.floor(data.mods.phaseTimer));
    label.text = "_".repeat(ticks);

    label.color = data.mods.is_hell ? "red" : "blue";
}