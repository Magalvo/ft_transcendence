import { GUI, BABYLON } from "../../index.js";

export function showWarningMessage(scene: BABYLON.Scene, message: string, side: "left" | "right" | "center", duration = 3000) {
    const gui = GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI", true, scene);

    const rect = new GUI.Rectangle();
    rect.width = "320px";
    rect.height = "80px";
    rect.cornerRadius = 12;
    rect.color = "#fff";
    rect.thickness = 2;
    rect.background = "rgba(255,0,0,0.3)";
    if (side === "left") {
        rect.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        rect.left = "40px";
    } else if (side === "right") {
        rect.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
        rect.left = "-40px";
    } else {
        rect.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
        rect.left = "0px";
    }
    rect.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
    rect.top = "-40px";

    const textBlock = new GUI.TextBlock();
    textBlock.text = message;
    textBlock.color = "#fff";
    textBlock.fontSize = 24;
    textBlock.fontWeight = "bold";
    textBlock.textWrapping = true;
    textBlock.resizeToFit = true;
    textBlock.paddingTop = "20px";
    textBlock.paddingBottom = "20px";
    textBlock.paddingLeft = "40px";
    textBlock.paddingRight = "40px";
    rect.addControl(textBlock);
    gui.addControl(rect);

    setTimeout(() => {
        // Fade out animation
        const fadeAnim = new BABYLON.Animation(
            "fadeOut",
            "alpha",
            60,
            BABYLON.Animation.ANIMATIONTYPE_FLOAT,
            BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
        );
        const keys = [
            { frame: 0, value: 1 },
            { frame: 50, value: 0 }
        ];
        fadeAnim.setKeys(keys);
        rect.animations = [fadeAnim];
        scene.beginAnimation(rect, 0, 50, false, 1, () => {
            gui.removeControl(rect);
        });
    }, duration);
}
