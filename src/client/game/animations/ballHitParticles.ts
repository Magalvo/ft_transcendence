import { BABYLON, Color3, Color4, Vec3 } from "../../index.js";

/**
 * Spawns a burst of particles at the given position (e.g., when the ball hits a side).
 * @param scene - The BabylonJS scene.
 * @param position - Where to spawn the particles (Vec3).
 * @param color - Optional: main color of the particles (Color4 or Color3).
 */
export function spawnHitParticles(
    scene: BABYLON.Scene,
    position: Vec3,
    color: Color4 | Color3 = new Color4(0.6, 0.8, 1, 1)
) {
    const particleSystem = new BABYLON.ParticleSystem("hitParticles", 30, scene);

    // Texture for particles (can be a small circle PNG or default)
    particleSystem.particleTexture = new BABYLON.Texture("https://playground.babylonjs.com/textures/flare.png", scene);

    // Where they spawn
    particleSystem.emitter = position.clone();
    particleSystem.minEmitBox = new Vec3(0, 0, 0); // point
    particleSystem.maxEmitBox = new Vec3(0, 0, 0);

    // Colors
    if (color instanceof Color3) {
        particleSystem.color1 = color.toColor4(1);
        particleSystem.color2 = color.toColor4(0.7);
    } else {
        particleSystem.color1 = color;
        particleSystem.color2 = new Color4(color.r, color.g, color.b, 0.5);
    }

    // Size
    particleSystem.minSize = 0.5;
    particleSystem.maxSize = 0.7;

    // Life time
    particleSystem.minLifeTime = 0.2;
    particleSystem.maxLifeTime = 0.5;

    // Speed
    particleSystem.emitRate = 0; // We'll use manual burst
    particleSystem.minEmitPower = 5;
    particleSystem.maxEmitPower = 10;
    particleSystem.direction1 = new Vec3(-1, 1, -1);
    particleSystem.direction2 = new Vec3(1, 1, 1);
    particleSystem.gravity = new Vec3(0, 0, 0);

    // Start, do one burst, and auto-dispose
    particleSystem.manualEmitCount = 30;
    particleSystem.start();

    setTimeout(() => {
        particleSystem.stop();
        particleSystem.dispose();
    }, 600); // Dispose after short time (enough for particles to fade out)
}