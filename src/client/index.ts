// Export all main modules and elements for easy import elsewhere in the project
export * from "./GameScene.js";
export * from "./serverConnections/socketListeners.ts";
export * from "./serverConnections/HandleEvents.ts";
export * from "./serverConnections/syncFunctions.ts";
export * from "./GameData.js";
export * from "./gameElements/initializations/createObjects3D.js";
export * from "./gameElements/render/RenderGame.js";
export * from "./gameElements/render/updateScoreLabels.js";
export * from "./gameElements/render/updateTimer.js";
export * from "./gameElements/render/updateHellTimer.js";
export * from "./gameElements/render/updateEnvironment.js";
export * from "./gameElements/render/updateCamera.js";
export * from "./gameElements/render/updateMusic.js";
export * from "./gameElements/render/updateHell.js";
export * from "./gameElements/render/handleHellModes.js";
export * from "./gameElements/render/handleKeyboard.js";
export * from "./gameElements/initializations/environment3D.js";
export * from "./gameElements/initializations/createObjects2D.js";
export * from "./gameElements/initializations/defineEvents.js";
export * from "./gameElements/user_interface/mainMenu.js";
export * from "./gameElements/user_interface/pauseScreen.js";
export * from "./gameElements/user_interface/showWarningMessage.js";
export * from "./gameElements/animations/flashZone.js";
export * from "./gameElements/animations/ballHitParticles.ts";
export * from "./gameElements/animations/fire.js";
export * from "./gameElements/animations/skybox.js";
export * from "./gameElements/meshes/AGameObject.js";
export * from "./gameElements/meshes/Ball.js";
export * from "./gameElements/meshes/Ball.js";
export * from "./gameElements/meshes/Paddle.js";
export * from "./gameElements/meshes/Table.js";
export * from "../shared/utils.js";
export * from "../shared/config.js";
export * from "../shared/types.js";

// Re-export BabylonJS core and GUI modules under unified names
export * as BABYLON from "@babylonjs/core";
export { Vector3 as Vec3, Color3 as Color3, Color4 as Color4 } from "@babylonjs/core";
export * as GUI from "@babylonjs/gui";

// Import BabylonJS loaders to register all loaders globally (side-effect import)
import "@babylonjs/loaders";