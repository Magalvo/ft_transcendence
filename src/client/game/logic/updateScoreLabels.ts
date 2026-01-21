import type { GameData } from "../../index.js";

/**
 * Updates the on-screen score labels.
 * @param obj2D - 2D UI objects
 * @param data - Scene/game state
 */
export function updateScoreLabels(data: GameData) {
    data.obj2D.left_score_label.text = String(data.mods.score.left);
    data.obj2D.right_score_label.text = String(data.mods.score.right);
}