import { GUI, type GameData } from "../../index.js";

/* --- PUBLIC INTERFACE --- */

export function pauseScreen(data: GameData) {
    cleanup(data);
    if (data.flags.game_running) {
        data.obj2D.guiPauseMenu = buildUI(data);
    }
}

export function resumeGame(data: GameData) {
    cleanup(data);
}

/* --- INTERNAL HELPERS --- */

function cleanup(data: GameData) {
    data.obj2D.guiPauseMenu?.dispose();
    data.obj2D.guiPauseMenu = undefined;
}

function buildUI(data: GameData) {
    // 1. Setup UI Texture with fixed scaling
    const gui = GUI.AdvancedDynamicTexture.CreateFullscreenUI("PauseUI", true);
    gui.idealWidth = 1920;
    gui.idealHeight = 1080;

    // 2. Helper: Text Creation
    const addText = (text: string, size: number, top: string) => {
        const t = new GUI.TextBlock();
        t.text = text; t.color = "white"; t.fontSize = size; t.top = top;
        gui.addControl(t);
    };

    // 3. Helper: Button Creation
    const addBtn = (label: string, left: string, action: () => void) => {
        const btn = GUI.Button.CreateSimpleButton(label, label);
        Object.assign(btn, {
            width: "200px", height: "60px", fontSize: 32,
            color: "white", background: "rgba(40, 71, 117, 1)",
            top: "20%", left: left
        });
        btn.onPointerUpObservable.add(action);
        gui.addControl(btn);
    };

    // 4. Build Layout
    addText("Heaven's Pong", 150, "-25%");
    addText("Good vs Evil", 80, "-15%");

    addBtn("RESUME", "-10%", () => data.socket?.emit('pauseGame'));
    addBtn("RETURN", "10%", () => { data.flags.return_main_menu = true; });

    return gui;
}