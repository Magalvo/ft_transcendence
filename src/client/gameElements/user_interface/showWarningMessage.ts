import { GUI, BABYLON } from "../../index.js";

// --- CONFIGURATION ---
const MSG_CONFIG = {
    DEFAULT_WIDTH: "320px",
    DEFAULT_HEIGHT: "80px",
    BIG_WIDTH: "500px",
    BIG_HEIGHT: "250px",
    CORNER_RADIUS: 12,
    THICKNESS: 2,
    FONT_SIZE: 24,
    FONT_SIZE_BIG: 50,
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

// --- STATE MANAGEMENT ---
interface ActiveMessage {
    rect: GUI.Rectangle;
    guiTexture: GUI.AdvancedDynamicTexture;
    timer: number;
    fading: boolean;
}

// Global state to track active messages per position
const activeMessages: { [key: string]: ActiveMessage | null } = {
    left: null,
    right: null,
    center: null,
    big: null
};

/**
 * Displays a warning message on the UI.
 * Replaces any existing message at the same position.
 * @param params Configuration object for the message
 */
export function showWarningMessage(
    {
        scene,
        message,
        pos,
        duration = 10,
        color = "red",
    }: {
        scene: BABYLON.Scene,
        message: string,
        pos: "left" | "right" | "center" | "big",
        duration?: number,
        color?: "red" | "green" | "blue",
    }
) {
    // 1. Cleanup existing message at this position
    if (activeMessages[pos]) {
        activeMessages[pos]!.guiTexture.dispose();
        activeMessages[pos] = null;
    }

    // 2. Create New UI
    const gui = GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI_Message", true, scene);

    // Create Container
    const isBig = (pos === "big");
    const rect = createUIContainer(color, isBig);
    positionContainer(rect, pos);

    // Create Text
    const textBlock = new GUI.TextBlock();
    textBlock.text = message;
    textBlock.color = MSG_CONFIG.COLORS.TEXT;
    textBlock.fontSize = isBig ? MSG_CONFIG.FONT_SIZE_BIG : MSG_CONFIG.FONT_SIZE;
    textBlock.fontWeight = "bold";
    textBlock.textWrapping = true;
    textBlock.resizeToFit = true;

    rect.addControl(textBlock);
    gui.addControl(rect);

    // 3. Store State
    activeMessages[pos] = {
        rect: rect,
        guiTexture: gui,
        timer: duration,
        fading: false
    };
}

/**
 * Updates message timers and handles fade-out animations.
 * Should be called in the game loop.
 * @param dt Delta Time in seconds
 */
export function updateWarningMessages(dt: number) {
    const positions = ["left", "right", "center", "big"];

    positions.forEach(pos => {
        const msg = activeMessages[pos];
        if (!msg) return;

        // Decrease timer
        msg.timer -= dt;

        // Trigger Fade Out in the last 0.5 seconds
        if (msg.timer <= 0.5 && !msg.fading) {
            msg.fading = true;
        }

        // Apply Manual Fade Animation
        if (msg.fading) {
            msg.rect.alpha = Math.max(0, msg.rect.alpha - (dt * 2));
        }

        // Cleanup when time expires
        if (msg.timer <= 0) {
            msg.guiTexture.dispose();
            activeMessages[pos] = null;
        }
    });
}

/**
 * Immediately clears side notifications (used when Hell Mode starts).
 */
export function clearMagicNotifications() {
    ["left", "right"].forEach(side => {
        const msg = activeMessages[side];
        if (msg) {
            msg.guiTexture.dispose();
            activeMessages[side] = null;
        }
    });
}

export function clearAllNotifications() {
    ["left", "right", "center", "big"].forEach(side => {
        const msg = activeMessages[side];
        if (msg) {
            msg.guiTexture.dispose();
            activeMessages[side] = null;
        }
    });
}

// --- INTERNAL HELPERS ---

function createUIContainer(color: string, isBig: boolean): GUI.Rectangle {
    const rect = new GUI.Rectangle();
    rect.width = isBig ? MSG_CONFIG.BIG_WIDTH : MSG_CONFIG.DEFAULT_WIDTH;
    rect.height = isBig ? MSG_CONFIG.BIG_HEIGHT : MSG_CONFIG.DEFAULT_HEIGHT;
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
            // Center messages are slightly higher than bottom ones
            rect.top = MSG_CONFIG.OFFSET_BOTTOM;
            break;
        case "big":
            rect.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
            rect.left = "0px";
            rect.top = "-40%"; // Center of screen
            break;
    }
}