import { GUI } from "../../index.js";
import type { Environment3D, GameData } from "../../index.js";

/**
 * Stores the menu GUI texture globally for use within this module.
 */
let guiTexture!: GUI.AdvancedDynamicTexture;

// --- CONFIGURATION ---
const MENU_CONFIG = {
    BUTTON_WIDTH: "300px",
    BUTTON_HEIGHT: "80px",
    BUTTON_COLOR: "white",
    BUTTON_BG: "rgba(40, 71, 117, 1)",
    FONT_SIZE: 32,
    TITLE_SIZE: 150,
    SUBTITLE_SIZE: 80
};

/**
 * Initializes the menu by creating a fullscreen GUI texture.
 */
export function createMainMenu() {
    guiTexture = GUI.AdvancedDynamicTexture.CreateFullscreenUI("menu_GUI", true, { width: 1920, height: 1080 });
    guiTexture.idealWidth = 1920;
    guiTexture.idealHeight = 1080;
}

/**
 * Starts and displays the game menu.
 * @param data Game data object
 * @param onOptionSelected Callback function receiving the selected mode ('online' | 'bot')
 */
export function startMainMenu(data: GameData, onOptionSelected: (mode: 'online' | 'bot' | 'demo') => void) {
    positionCamera(data.env);
    createTitle();

    // Show loading overlay, then reveal buttons
    const hideLoading = showLoadingOverlay({ minDuration: 2000 });

    Promise.all([
        waitForScene(data.scene)
    ]).then(() => {
        hideLoading(() => {
            createButtons(onOptionSelected);
        });
    });
}

function waitForScene(scene: any): Promise<void> {
    return new Promise(resolve => {
        scene.executeWhenReady(() => resolve());
    });
}

/**
 * Destroys the menu GUI and releases camera control.
 */
export function closeMainMenu(data: GameData) {
    data.env.camera.detachControl();
    if (guiTexture) {
        guiTexture.dispose();
    }
}

/**
 * Creates the main interaction buttons (Online vs Bot).
 */
function createButtons(onOptionSelected: (mode: 'online' | 'bot' | 'demo') => void) {

    // 1. ONLINE MATCH BUTTON
    const btnOnline = GUI.Button.CreateSimpleButton("btnOnline", "ONLINE MATCH");
    styleButton(btnOnline);
    btnOnline.top = "30%";
    btnOnline.left = "-15%";

    btnOnline.onPointerUpObservable.add(() => {
        btnOnline.textBlock!.text = "SEARCHING...";
        // Disable buttons to prevent double click
        btnOnline.isEnabled = false;
        if (guiTexture.getControlByName("btnBot")) guiTexture.getControlByName("btnBot")!.isEnabled = false;

        onOptionSelected('online');
    });
    guiTexture.addControl(btnOnline);

    // 2. VS BOT BUTTON
    const btnBot = GUI.Button.CreateSimpleButton("btnBot", "VS BOT");
    styleButton(btnBot);
    btnBot.top = "30%";
    btnBot.left = "15%";

    btnBot.onPointerUpObservable.add((info) => {
        btnBot.textBlock!.text = "LOADING...";
        btnBot.isEnabled = false;
        if (guiTexture.getControlByName("btnOnline")) guiTexture.getControlByName("btnOnline")!.isEnabled = false;
        if (info.buttonIndex === 2)
            onOptionSelected('demo');
        else
            onOptionSelected('bot');
    });
    guiTexture.addControl(btnBot);
}

/**
 * Applies common styling to menu buttons.
 */
function styleButton(btn: GUI.Button) {
    btn.width = MENU_CONFIG.BUTTON_WIDTH;
    btn.height = MENU_CONFIG.BUTTON_HEIGHT;
    btn.color = MENU_CONFIG.BUTTON_COLOR;
    btn.background = MENU_CONFIG.BUTTON_BG;
    btn.fontSize = MENU_CONFIG.FONT_SIZE;
    btn.cornerRadius = 10;
    btn.thickness = 2;
}

function createTitle() {
    const title = new GUI.TextBlock();
    title.text = "Heaven's Pong";
    title.color = "white";
    title.fontSize = MENU_CONFIG.TITLE_SIZE;
    title.top = "-25%";
    guiTexture.addControl(title);

    const subtitle = new GUI.TextBlock();
    subtitle.text = "Good vs Evil";
    subtitle.color = "white";
    subtitle.fontSize = MENU_CONFIG.SUBTITLE_SIZE;
    subtitle.top = "-15%";
    guiTexture.addControl(subtitle);
}

function positionCamera(parts3D: Environment3D) {
    parts3D.camera.beta = Math.PI; // Look from behind/top
    parts3D.camera.radius = 250;
}

/**
 * Shows a loading spinner overlay.
 */
export function showLoadingOverlay({ minDuration = 0 } = {}) {
    const spinner = new GUI.Ellipse();
    spinner.width = "100px";
    spinner.height = "100px";
    spinner.thickness = 5;
    spinner.color = "yellow";
    spinner.background = "transparent";
    spinner.zIndex = 10;
    guiTexture.addControl(spinner);

    let disposed = false;
    let startTime = Date.now();

    // Spinner animation
    let angle = 0;
    const anim = () => {
        if (disposed) return;
        angle += 0.1;
        spinner.rotation = angle;
        requestAnimationFrame(anim);
    };
    anim();

    return (onFinish?: () => void) => {
        const elapsed = Date.now() - startTime;
        const delay = Math.max(0, minDuration - elapsed);
        setTimeout(() => {
            disposed = true;
            spinner.dispose();
            if (onFinish) onFinish();
        }, delay);
    };
}