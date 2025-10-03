// Export all main modules and elements for easy import elsewhere in the project
export * from "./game/_GameScene_.js";
export * from "./game/initializations/createGameObjects.js";
export * from "./game/logic/_GameLogic_.js";
export * from "./game/logic/updateLabels.js";
export * from "./game/logic/updateTimer.js";
export * from "./game/logic/updateDevilTimer.js";
export * from "./game/logic/updateEnvironment.js";
export * from "./game/logic/updateCamera.js";
export * from "./game/logic/updateMusic.js";
export * from "./game/logic/updateHell.js";
export * from "./game/logic/handleHellModes.js";
export * from "./game/logic/handleKeyboard.js";
export * from "./game/initializations/createSceneParts.js";
export * from "./game/initializations/create2DParts.js";
export * from "./game/initializations/defineEvents.js";
export * from "./game/menus/mainMenu.js";
export * from "./game/menus/pauseScreen.js";
export * from "./game/animations/flashZone.js";
export * from "./game/animations/ballHitParticles.ts";
export * from "./game/animations/createFlame.js";
export * from "./game/animations/createSkybox.js";
export * from "./elements/_GameObject_.js";
export * from "./elements/ball.js";
export * from "./elements/paddle.js";
export * from "./elements/table.js";
export * from "./utils/utils.js";
export * from "./utils/strings.js";

// Re-export BabylonJS core and GUI modules under unified names
export * as BABYLON from "@babylonjs/core";
export * as GUI from "@babylonjs/gui";

// Import BabylonJS loaders to register all loaders globally (side-effect import)
import "@babylonjs/loaders";