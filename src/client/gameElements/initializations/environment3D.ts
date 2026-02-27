import { BABYLON, createSkybox, createStaticFlame, Vec3 } from "../../index.js";
import type { GameObjects } from "../../index.js";

/* ------------------- *
 * SCENE PARTS (3D)   *
 * ------------------- */

/**
 * Container type for all 3D scene "parts" (camera, environment, effects, etc).
 */
export type Environment3D = {
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
 * Creates all 3D environment parts for the game (camera, effects, environment, etc).
 * @param obj3D - All 3D game objects (needed for placement)
 * @param scene - The BabylonJS scene
 * @returns {Environment3D}
 */
export function createEnvironment3D(
  obj3D: GameObjects,
  scene: BABYLON.Scene
): Environment3D {
  return {
    camera: createCamera(scene),
    light: createLight(scene),
    environment: createEnvironment(scene),
    // Use local helper for static torches
    flame_R1: createStaticFlame(scene, { x: obj3D.table.limits.right, y: 0, z: obj3D.table.limits.far }, 60),
    flame_R2: createStaticFlame(scene, { x: obj3D.table.limits.right, y: 0, z: obj3D.table.limits.near }, 60),
    flame_L1: createStaticFlame(scene, { x: obj3D.table.limits.left, y: 0, z: obj3D.table.limits.far }, 60),
    flame_L2: createStaticFlame(scene, { x: obj3D.table.limits.left, y: 0, z: obj3D.table.limits.near }, 60),
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
    case 1: audio_name = "/audio/hell.mp3"; break;
    case 2: audio_name = "/audio/heaven.mp3"; break;
  }
  const audio = new Audio();
  audio.src = audio_name;
  audio.loop = true;
  audio.volume = 0.3;
  const canPlay = audio.canPlayType('audio/mpeg') || audio.canPlayType('audio/mp3');
  if (!canPlay) console.warn('Browser cannot play audio source', audio_name);
  return audio;
}

/**
 * Adds a hemispheric light above the scene.
 * @param scene - The BabylonJS scene
 */
function createLight(scene: BABYLON.Scene): BABYLON.Light {
  const light = new BABYLON.HemisphericLight(
    "hemiLight",
    new Vec3(0, 1, 0),
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
    createGround: false,
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
    new Vec3(0, 0, 0),
    scene
  );
  camera.attachControl();
  camera.lowerBetaLimit = 0;
  camera.upperBetaLimit = Math.PI / 2.5 + 4 * Math.PI;
  camera.upperRadiusLimit = 250;
  camera.lowerRadiusLimit = 10;
  return camera;
}