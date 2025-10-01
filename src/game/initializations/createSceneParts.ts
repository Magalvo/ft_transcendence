import { BABYLON, createFlame, createSkybox } from "../../index.js";
import type { Objects3D } from "../../index.js";

/* ------------------- *
 *  SCENE PARTS (3D)   *
 * ------------------- */

/**
 * Container type for all 3D scene "parts" (camera, environment, effects, etc).
 */
export type Parts3D = {
  scene: BABYLON.Scene,
  hellMusic: HTMLAudioElement,
  heavenMusic: HTMLAudioElement,
  camera: BABYLON.ArcRotateCamera,
  environment: BABYLON.EnvironmentHelper,
  light: BABYLON.Light,
  sky_box: BABYLON.Mesh,
  flame_L1: BABYLON.ParticleSystem,
  flame_L2: BABYLON.ParticleSystem,
  flame_R1: BABYLON.ParticleSystem,
  flame_R2: BABYLON.ParticleSystem,
};

/**
 * Creates all main 3D scene parts for the game (camera, effects, environment, etc).
 * @param data - Current game/scene state
 * @param obj3D - All 3D game objects (needed for placement)
 * @param scene - The BabylonJS scene
 * @returns {Parts3D}
 */
export function createSceneParts(
  obj3D: Objects3D,
  scene: BABYLON.Scene
): Parts3D {
  // create all 3D parts
  return {
    camera: createCamera(scene),
    light: createLight(scene),
    environment: createEnvironment(scene),
    flame_R1: createFlame(scene, { x: obj3D.table.right_line * 1.1, y: 0, z: obj3D.table.far_line }, 10),
    flame_R2: createFlame(scene, { x: obj3D.table.right_line * 1.1, y: 0, z: obj3D.table.near_line }, 10),
    flame_L1: createFlame(scene, { x: obj3D.table.left_line * 1.1, y: 0, z: obj3D.table.far_line }, 10),
    flame_L2: createFlame(scene, { x: obj3D.table.left_line * 1.1, y: 0, z: obj3D.table.near_line }, 10),
    sky_box: createSkybox(scene),
    hellMusic: createAudio(1),
    heavenMusic: createAudio(2),
    scene: scene,
  };
}

/**
 * Adds background music to the scene.
 */
function createAudio(nb: number): HTMLAudioElement {
  let audio_name: string = "";
  switch (nb) {
    case 1: audio_name = "audio/hell.mp3"; break;
    case 2: audio_name = "audio/heaven.mp3"; break;
  }
  const audio = new Audio(audio_name);
  audio.loop = true;
  audio.volume = 0.3;
  return audio;
}

/**
 * Adds a hemispheric light above the scene.
 * @param scene - The BabylonJS scene
 */
function createLight(scene: BABYLON.Scene): BABYLON.Light {
  const light = new BABYLON.HemisphericLight(
    "hemiLight",
    new BABYLON.Vector3(0, 1, 0),
    scene
  );
  return light;
}

/**
 * Creates the scene's environment (ground, etc).
 * @param scene - The BabylonJS scene
 * @returns {BABYLON.EnvironmentHelper}
 */
function createEnvironment(scene: BABYLON.Scene): BABYLON.EnvironmentHelper {
  const glow = new BABYLON.GlowLayer("glow", scene);
  glow.intensity = 0.2;
  let environment = scene.createDefaultEnvironment({
    createSkybox: false,
    createGround: true,
    groundSize: 30,
    enableGroundShadow: true,
    groundYBias: 1,
  });
  return environment!;
}

/**
 * Creates and configures the main game camera.
 * @param scene - The BabylonJS scene
 * @returns {BABYLON.ArcRotateCamera}
 */
export function createCamera(scene: BABYLON.Scene): BABYLON.ArcRotateCamera {
  const camera = new BABYLON.ArcRotateCamera(
    "camera",
    -Math.PI / 2,
    Math.PI / 4,
    175,
    new BABYLON.Vector3(0, 0, 0),
    scene
  );
  camera.attachControl();
  camera.lowerBetaLimit = 0;
  camera.upperBetaLimit = Math.PI / 2.5 + 4 * Math.PI;
  camera.upperRadiusLimit = 250;
  camera.lowerRadiusLimit = 10;
  return camera;
}