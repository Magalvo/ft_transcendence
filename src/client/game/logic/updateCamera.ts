import { type GameData, hellMode } from "../../index.js";

/**
 * Smoothly updates the camera's position and orientation based on the game state.
 * @param data - Scene/game state
 */
function lerp(start: number, end: number, amt: number) {
    return (1 - amt) * start + amt * end;
}

export function updateCamera(data: GameData) {
    const camera = data.env.camera;
    const mode = data.mods.hell_mode;
    // const isHell = data.mods.is_hell; // Já não precisamos desta flag genérica para decidir a posição base

    // --- 1. DEFINIR VALORES PADRÃO (NORMAL / CÉU) ---
    // Estes são os valores para quando o jogo está normal OU
    // quando estamos num modo de inferno que não afeta a câmara (ex: Big Balls)
    let targetAlpha = -Math.PI / 2; // Posição normal (Lado do Player 1)
    let targetBeta = 1.0;           // Altura normal
    let targetRadius = 180;         // Zoom normal

    // --- 2. OVERRIDES ESPECÍFICOS ---

    if (mode === hellMode.twisted_view) {
        // MODO 8: TWISTED -> Vira 180 graus (Vê do lado do adversário)
        targetAlpha = Math.PI / 2;
        // targetBeta = 0.1; // Descomenta se quiseres também virar de cabeça para baixo
    }
    else if (mode === hellMode.drunk_view) {
        // MODO 9: DRUNK -> O efeito de oscilação que gostaste
        const time = Date.now() * 0.001;
        targetAlpha = -Math.PI / 2 + Math.sin(time) * 0.5; // Balança esquerda/direita
        targetBeta = 1.0 + Math.cos(time * 1.5) * 0.3;     // Balança cima/baixo
        targetRadius = 180 + Math.sin(time * 2) * 20;      // Zoom in/out ligeiro
    }

    // --- 3. APLICAR SUAVIZAÇÃO ---
    camera.alpha = lerp(camera.alpha, targetAlpha, 0.05);
    camera.beta = lerp(camera.beta, targetBeta, 0.05);
    camera.radius = lerp(camera.radius, targetRadius, 0.05);
}

export function rotateCamera(data: GameData) {
    data.env.camera.alpha += (data.mods.step ? data.mods.step * 0.05 : 0);
    data.env.camera.beta += (data.mods.step ? data.mods.step * 0.03 : -0.001);
}