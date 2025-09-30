import type { Objects2D, SceneData } from "../../index.js";

/**
 * Updates the on-screen score labels.
 * @param obj2D - 2D UI objects
 * @param data - Scene/game state
 */
export function updateScoreLabels(obj2D: Objects2D, data: SceneData) {
    obj2D.left_score_label.text = String(data.score.left);
    obj2D.right_score_label.text = String(data.score.right);
}