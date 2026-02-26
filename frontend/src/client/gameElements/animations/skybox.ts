import { BABYLON, Color3 } from "../../index.js";

/**
 * Creates the skybox mesh and material.
 * @param scene - The BabylonJS scene
 * @returns {BABYLON.Mesh}
 */
export function createSkybox(scene: BABYLON.Scene): BABYLON.Mesh {
    const envTex = new BABYLON.CubeTexture("textures/skybox1/skybox", scene);
    scene.environmentTexture = envTex;

    let skyMaterial = new BABYLON.StandardMaterial("skybox", scene);
    skyMaterial.backFaceCulling = false;
    skyMaterial.reflectionTexture = scene.environmentTexture;
    skyMaterial.reflectionTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;
    skyMaterial.diffuseColor = new Color3(0, 0, 0);
    skyMaterial.specularColor = new Color3(0, 0, 0);
    let skybox = BABYLON.MeshBuilder.CreateBox("skyBox", { size: 700.0 }, scene);
    skybox.material = skyMaterial;
    return skybox;
}