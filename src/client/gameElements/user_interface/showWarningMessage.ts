import { GUI, BABYLON } from "../../index.js";

// Estrutura para guardar a mensagem ativa
interface ActiveMessage {
    rect: GUI.Rectangle;
    guiTexture: GUI.AdvancedDynamicTexture;
    timer: number;
    fading: boolean;
}

// Estado global do módulo (uma mensagem por lado)
const activeMessages: { [side: string]: ActiveMessage | null } = {
    left: null,
    right: null,
    center: null
};

/**
 * Cria uma mensagem nova. Se já existir uma nesse lado, substitui-a.
 */
export function showWarningMessage(
    {
        scene,
        message,
        pos,
        duration = 10, // Duração em SEGUNDOS agora (não ms)
        color = "red",
    }: {
        scene: BABYLON.Scene,
        message: string,
        pos: "left" | "right" | "center" | "big",
        duration?: number,
        color?: "red" | "green" | "blue",
    }
) {
    // 1. Limpar mensagem anterior nesse lado (Sem acumular!)
    if (activeMessages[pos]) {
        const oldMsg = activeMessages[pos]!;
        oldMsg.guiTexture.dispose(); // Apaga a UI antiga
        activeMessages[pos] = null;
    }

    // 2. Criar nova UI
    const gui = GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI_Message", true, scene);

    const rect = new GUI.Rectangle();
    rect.width = "320px";
    rect.height = "80px";
    rect.cornerRadius = 12;
    rect.color = "#fff";
    rect.thickness = 2;
    rect.alpha = 1; // Começa totalmente visível

    const textBlock = new GUI.TextBlock();
    textBlock.text = message;
    textBlock.color = "#fff";
    textBlock.fontSize = 24;
    textBlock.fontWeight = "bold";
    textBlock.textWrapping = true;
    textBlock.resizeToFit = true;

    if (color == "red")
        rect.background = "rgba(255,0,0,0.5)"; // Um pouco mais opaco para leitura
    else if (color == "green")
        rect.background = "rgba(0, 255, 76, 0.5)";
    else if (color == "blue")
        rect.background = "rgba(29, 109, 230, 0.5)";

    // Posicionamento Fixo (Sem offsets dinâmicos)
    rect.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
    rect.top = "-100px"; // Distância fixa do fundo

    if (pos === "left") {
        rect.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        rect.left = "40px";
    } else if (pos === "right") {
        rect.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
        rect.left = "-40px";
    } else if (pos === "center") {
        rect.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
        rect.left = "0px";
        rect.top = "-100px"; // O centro fica um pouco mais acima
    } else if (pos === "big") {
        rect.width = "500px";
        rect.height = "250px";
        textBlock.fontSize = 50;
        rect.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
        rect.left = "0px";
        rect.top = "-40%";
    }
    rect.addControl(textBlock);
    gui.addControl(rect);

    // 3. Guardar no estado
    activeMessages[pos] = {
        rect: rect,
        guiTexture: gui,
        timer: duration, // Ex: 10 segundos
        fading: false
    };
}

/**
 * Atualiza os timers das mensagens. Deve ser chamado no Game Loop.
 * @param dt Delta Time em segundos
 */
export function updateWarningMessages(dt: number) {
    const sides = ["left", "right", "center", "big"];

    sides.forEach(side => {
        const msg = activeMessages[side];
        if (msg) {
            // Decrementar tempo
            msg.timer -= dt;

            // Lógica de Fade Out nos últimos 0.5 segundos
            if (msg.timer <= 0.5 && !msg.fading) {
                msg.fading = true;
                const fadeAnim = new BABYLON.Animation(
                    "fadeOut", "alpha", 60,
                    BABYLON.Animation.ANIMATIONTYPE_FLOAT,
                    BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
                );
                fadeAnim.setKeys([{ frame: 0, value: 1 }, { frame: 30, value: 0 }]);
                msg.rect.animations = [fadeAnim];
                // Usamos beginDirectAnimation para não depender da scene global time se possível,
                // mas aqui a scene time avança com o render loop, o que é OK.
                // Mas como queremos controlar tudo manualmente, podemos manipular o alpha diretamente:
            }

            // Animação manual de fade (mais seguro contra pausas)
            if (msg.fading) {
                msg.rect.alpha = Math.max(0, msg.rect.alpha - (dt * 2));
            }

            // Destruir quando o tempo acaba
            if (msg.timer <= 0) {
                msg.guiTexture.dispose();
                activeMessages[side] = null;
            }
        }
    });
}

export function clearMagicNotifications() {
    const sides = ["left", "right"];

    sides.forEach(side => {
        const msg = activeMessages[side];
        if (msg) {
            msg.guiTexture.dispose(); // Destrói a UI
            activeMessages[side] = null; // Limpa o estado
        }
    });
}