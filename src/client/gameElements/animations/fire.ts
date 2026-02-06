import { BABYLON, type GameData } from "../../index.js";

const TEXTURE_URL = "https://www.babylonjs-playground.com/textures/flare.png";
const FIRE_CAPACITY = 2000;

/**
 * Attaches a fire particle system to a mesh (Ball trails).
 */
export function addFireEffect(data: GameData, mesh: BABYLON.AbstractMesh, color: BABYLON.Color3, isMagic: boolean) {
    // 1. Fast exit via Metadata
    if (mesh.metadata?.firePS) return;

    // 2. Create System
    const ps = new BABYLON.ParticleSystem("fire", FIRE_CAPACITY, data.scene);
    ps.particleTexture = new BABYLON.Texture(TEXTURE_URL, data.scene);
    ps.emitter = mesh;
    ps.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;

    // 3. Colors (Core White -> Color -> Fade)
    ps.addColorGradient(0.0, new BABYLON.Color4(1, 1, 1, 1.0));
    ps.addColorGradient(0.2, new BABYLON.Color4(color.r, color.g, color.b, 1.0));
    ps.addColorGradient(1.0, new BABYLON.Color4(color.r, color.g, color.b, 0.0));

    // 4. Size & Physics (Trail effect)
    const baseSize = isMagic ? 1.2 : 3.0;
    
    ps.addSizeGradient(0.0, baseSize * 0.5);
    ps.addSizeGradient(0.2, baseSize * 1.5);
    ps.addSizeGradient(1.0, 0.0);

    ps.minLifeTime = 0.2; ps.maxLifeTime = 0.4;
    ps.emitRate = 300;
    ps.minEmitPower = 0.5; ps.maxEmitPower = 1.5;
    ps.updateSpeed = 0.01;

    ps.start();

    // 5. Register
    if (!mesh.metadata) mesh.metadata = {};
    mesh.metadata.firePS = ps;
}

/**
 * Cleanly removes the fire effect.
 */
export function removeFireFromMesh(data: GameData, mesh: BABYLON.AbstractMesh) {
    const ps = mesh.metadata?.firePS;
    if (ps) {
        ps.stop();
        ps.dispose();
        mesh.metadata.firePS = undefined;
    }
}

/**
 * Creates static environmental torches.
 */
export function createStaticFlame(
    scene: BABYLON.Scene,
    pos: { x: number, y: number, z: number },
    size: number,
): BABYLON.ParticleSystem {
    // Anchor mesh (invisible)
    const anchor = new BABYLON.Mesh("torch_anchor", scene);
    anchor.position.set(pos.x, pos.y, pos.z);

    const ps = new BABYLON.ParticleSystem("env_fire", 500, scene);
    ps.particleTexture = new BABYLON.Texture(TEXTURE_URL, scene);
    ps.emitter = anchor;
    ps.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;

    // Torch Colors
    ps.addColorGradient(0.0, new BABYLON.Color4(1, 1, 1, 0.5));
    ps.addColorGradient(0.2, new BABYLON.Color4(1, 0.8, 0.2, 0.8));
    ps.addColorGradient(0.5, new BABYLON.Color4(1, 0.2, 0, 0.5));
    ps.addColorGradient(1.0, new BABYLON.Color4(0.2, 0, 0, 0));

    // Torch Physics
    const s = size; // alias
    ps.addSizeGradient(0.0, s * 0.04);
    ps.addSizeGradient(0.3, s * 0.2);
    ps.addSizeGradient(1.0, s * 0.02);

    ps.minLifeTime = 0.5; ps.maxLifeTime = 1.0;
    ps.emitRate = 30 * s;
    ps.minEmitPower = 1; ps.maxEmitPower = 2 + s;
    ps.updateSpeed = 0.01;

    // Box Emitter (Base of the flame)
    const box = 0.05 * s;
    ps.createBoxEmitter(
        new BABYLON.Vector3(0, 1, 0),
        new BABYLON.Vector3(0, 1, 0),
        new BABYLON.Vector3(-box, -0.1, -box),
        new BABYLON.Vector3(box, 0.1, box)
    );

    ps.start();
    return ps;
}