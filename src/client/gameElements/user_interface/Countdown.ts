import { GUI, BABYLON } from "../../index.js";

// Estado interno do Countdown
let countdownTexture: GUI.AdvancedDynamicTexture | null = null;
let countdownTextControl: GUI.TextBlock | null = null;
let lifeTime = 0;
let maxLifeTime = 1.0; // Cada número dura 1 segundo (exceto o GO/EndGame que pode durar mais)

/**
 * Mostra um texto gigante no centro do ecrã.
 * Reinicia automaticamente se já houver um lá.
 */
export function showCountdownDisplay(scene: BABYLON.Scene, text: string, color: string, duration: number = 1.0) {
    // 1. Limpar anterior se existir
    disposeCountdown();

    // 2. Criar Nova UI
    try {
        countdownTexture = GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI_Countdown", true, scene);
        
        const textBlock = new GUI.TextBlock();
        textBlock.text = text;
        textBlock.color = color;
        textBlock.fontSize = 150; // Tamanho base gigante
        textBlock.fontWeight = "bold";
        textBlock.fontFamily = "monospace";
        
        // Sombra para melhor leitura
        textBlock.shadowColor = "black";
        textBlock.shadowOffsetX = 5;
        textBlock.shadowOffsetY = 5;

        countdownTexture.addControl(textBlock);
        countdownTextControl = textBlock;

        // 3. Configurar Timer
        lifeTime = duration;
        maxLifeTime = duration;

    } catch (e) {
        console.error("Failed to create countdown UI", e);
    }
}

/**
 * Atualiza a animação do countdown.
 * Deve ser chamado no render loop.
 */
export function updateCountdownUI(dt: number) {
    if (!countdownTexture || !countdownTextControl) return;

    lifeTime -= dt;

    // --- ANIMAÇÃO ---
    // Efeito de "Pulse": Começa grande e diminui ligeiramente
    // Ratio vai de 1.0 (inicio) a 0.0 (fim)
    const ratio = lifeTime / maxLifeTime;
    
    // Scale: Vai de 1.5x até 1.0x
    const scale = 1.0 + (ratio * 0.5); 
    countdownTextControl.scaleX = scale;
    countdownTextControl.scaleY = scale;

    // Alpha: Fade out rápido nos últimos 20% do tempo
    if (ratio < 0.2) {
        countdownTextControl.alpha = ratio * 5; // 0.2 * 5 = 1.0
    } else {
        countdownTextControl.alpha = 1;
    }

    // Cleanup
    if (lifeTime <= 0) {
        disposeCountdown();
    }
}

export function disposeCountdown() {
    if (countdownTexture) {
        try { countdownTexture.dispose(); } catch (e) {}
        countdownTexture = null;
        countdownTextControl = null;
    }
}