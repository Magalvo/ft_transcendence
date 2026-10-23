import type { GameData } from "../../GameData.js";

export function updateMusic(data: GameData) {
    if (!data.flags.game_running) {
        data.env3D.hellMusic.pause();
        data.env3D.heavenMusic.pause();
    }
    else if (!data.mods.is_hell) {
        data.env3D.hellMusic.pause();
        data.env3D.heavenMusic.play();
    }
    else {
        data.env3D.heavenMusic.pause();
        data.env3D.hellMusic.play();
    }
}