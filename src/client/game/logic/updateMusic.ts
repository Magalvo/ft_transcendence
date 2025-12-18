import { type GameData } from "../../index.js";

export function updateMusic(data: GameData) {
    if (!data.mods.is_hell) {
        data.env.hellMusic.pause();
        data.env.heavenMusic.play();
    }
    else {
        data.env.heavenMusic.pause();
        data.env.hellMusic.play();
    }
}