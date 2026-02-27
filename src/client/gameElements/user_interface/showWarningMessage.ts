import { GUI, BABYLON } from "../../index.js";

const MSG_CONFIG = {
    DEFAULT_WIDTH: "320px",
    DEFAULT_HEIGHT: "80px",
    CORNER_RADIUS: 12,
    THICKNESS: 2,
    FONT_SIZE: 24,
    OFFSET_BOTTOM: "-100px",
    OFFSET_SIDE: "40px",
    COLORS: {
        TEXT: "#fff",
        BORDER: "#fff",
        BG_RED: "rgba(255,0,0,0.5)",
        BG_GREEN: "rgba(0, 255, 76, 0.5)",
        BG_BLUE: "rgba(29, 109, 230, 0.5)"
    }
};

interface ActiveMessage {
    rect: GUI.Rectangle;
    guiTexture: GUI.AdvancedDynamicTexture;
    timer: number;
    fading: boolean;
}

const activeMessages: { [key: string]: ActiveMessage | null } = {
    left: null,
    right: null,
    center: null
};

export function showWarningMessage(
    { scene, message, pos, duration = 3, color = "red" }:
        { scene: BABYLON.Scene, message: string, pos: "left" | "right" | "center", duration?: number, color?: "red" | "green" | "blue" }
) {
    if (activeMessages[pos]) {
        try { activeMessages[pos]!.guiTexture.dispose(); } catch (e) { }
        activeMessages[pos] = null;
    }

    try {
        const gui = GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI_Message", true, scene);
        const rect = createUIContainer(color);
        positionContainer(rect, pos);

        const textBlock = new GUI.TextBlock();
        textBlock.text = message;
        textBlock.color = MSG_CONFIG.COLORS.TEXT;
        textBlock.fontSize = MSG_CONFIG.FONT_SIZE;
        textBlock.fontWeight = "bold";
        textBlock.textWrapping = true;
        textBlock.resizeToFit = true;

        rect.addControl(textBlock);
        gui.addControl(rect);

        activeMessages[pos] = {
            rect: rect,
            guiTexture: gui,
            timer: duration,
            fading: false
        };
    } catch (err) { console.error(err); }
}

export function updateWarningMessages(dt: number) {
    ["left", "right", "center"].forEach(pos => {
        const msg = activeMessages[pos];
        if (!msg) return;
        msg.timer -= dt;
        if (msg.timer <= 0.5 && !msg.fading) msg.fading = true;
        if (msg.fading) msg.rect.alpha = Math.max(0, msg.rect.alpha - (dt * 2));
        if (msg.timer <= 0) {
            try { msg.guiTexture.dispose(); } catch (e) { }
            activeMessages[pos] = null;
        }
    });
}

export function clearAllNotifications() {
    ["left", "right", "center"].forEach(side => {
        const msg = activeMessages[side];
        if (msg) {
            try { msg.guiTexture.dispose(); } catch (e) { }
            activeMessages[side] = null;
        }
    });
}

function createUIContainer(color: string): GUI.Rectangle {
    const rect = new GUI.Rectangle();
    rect.width = MSG_CONFIG.DEFAULT_WIDTH;
    rect.height = MSG_CONFIG.DEFAULT_HEIGHT;
    rect.cornerRadius = MSG_CONFIG.CORNER_RADIUS;
    rect.color = MSG_CONFIG.COLORS.BORDER;
    rect.thickness = MSG_CONFIG.THICKNESS;
    rect.alpha = 1;

    switch (color) {
        case "green": rect.background = MSG_CONFIG.COLORS.BG_GREEN; break;
        case "blue": rect.background = MSG_CONFIG.COLORS.BG_BLUE; break;
        default: rect.background = MSG_CONFIG.COLORS.BG_RED; break;
    }
    return rect;
}

function positionContainer(rect: GUI.Rectangle, pos: string) {
    rect.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
    rect.top = MSG_CONFIG.OFFSET_BOTTOM;

    switch (pos) {
        case "left":
            rect.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
            rect.left = MSG_CONFIG.OFFSET_SIDE;
            break;
        case "right":
            rect.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
            rect.left = `-${MSG_CONFIG.OFFSET_SIDE}`;
            break;
        case "center":
            rect.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
            rect.left = "0px";
            break;
    }
}