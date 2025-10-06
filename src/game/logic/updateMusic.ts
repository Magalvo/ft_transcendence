import { side } from "../../index.js";
import type { Parts3D, SceneData } from "../../index.js";

export function updateMusic(data: SceneData, parts3D: Parts3D) {
    if (!data.is_hell) {
        parts3D.hellMusic.pause();
        parts3D.heavenMusic.play();
    }
    else {
        parts3D.heavenMusic.pause();
        parts3D.hellMusic.play();
    }
}