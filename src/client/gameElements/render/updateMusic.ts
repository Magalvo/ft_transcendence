import { type GameData } from "../../index.js";

export function updateMusic(data: GameData) {
    if (!data.mods.is_hell) {
        data.env3D.hellMusic.pause();
        data.env3D.heavenMusic.play();
    }
    else {
        data.env3D.heavenMusic.pause();
        data.env3D.hellMusic.play();
    }
}