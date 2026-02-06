import { GUI, BABYLON } from "../../index.js";

/* --- STATE --- */
const state = {
    texture: null as GUI.AdvancedDynamicTexture | null,
    text: null as GUI.TextBlock | null,
    life: 0,
    maxLife: 1
};

/* --- PUBLIC API --- */

export function showCountdownDisplay(scene: BABYLON.Scene, text: string, color: string, duration: number = 1.0) {
    disposeCountdown();

    try {
        state.texture = GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI_Countdown", true, scene);

        const t = new GUI.TextBlock();
        Object.assign(t, {
            text: text,
            color: color,
            fontSize: 150,
            fontWeight: "bold",
            fontFamily: "monospace",
            shadowColor: "black",
            shadowOffsetX: 5,
            shadowOffsetY: 5
        });

        state.texture.addControl(t);
        state.text = t;

        state.life = duration;
        state.maxLife = duration;
    } catch (e) {
        console.error("Countdown creation failed", e);
    }
}

export function updateCountdownUI(dt: number) {
    if (!state.texture || !state.text) return;

    state.life -= dt;
    if (state.life <= 0) return disposeCountdown();

    // Pulse Animation (1.5x -> 1.0x) & Fade Out
    const ratio = state.life / state.maxLife;
    const scale = 1.0 + (ratio * 0.5);

    state.text.scaleX = scale;
    state.text.scaleY = scale;
    state.text.alpha = ratio < 0.2 ? ratio * 5 : 1;
}

export function disposeCountdown() {
    state.texture?.dispose();
    state.texture = null;
    state.text = null;
}