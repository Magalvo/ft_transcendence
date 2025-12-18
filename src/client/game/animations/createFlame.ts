import { BABYLON, randomFloat2, Vec3 } from "../../index.js";

/**
 * Creates a fire/flame particle system at a given position.
 * @param scene - The BabylonJS scene
 * @param position - Vector3 or {x, y, z} for emitter position
 * @param size - Base size for the flame
 * @param textureUrl - Flame texture URL (default: "textures/flame.png")
 * @returns {BABYLON.ParticleSystem}
 */
export function createFlame(
    {
        scene,
        pos: position,
        size = 1,
        textureUrl = "textures/flame.png",
        color1 = new BABYLON.Color4(1, 0.6, 0, 1.0),
        color2 = new BABYLON.Color4(1, 1, 0, 1.0),
    }: {
        scene: BABYLON.Scene,
        pos: Vec3 | { x: number; y: number; z: number },
        size?: number,
        textureUrl?: string,
        color1?: BABYLON.Color4,
        color2?: BABYLON.Color4,
    }
): BABYLON.ParticleSystem {
    // Generate a unique offset for each flame instance
    const offset = Math.random() * 1000;
    const particleSystem = new BABYLON.ParticleSystem("flame", Math.round(500 * size), scene);

    const emitterPos =
        position instanceof Vec3
            ? position
            : new Vec3(position.x, position.y, position.z);

    particleSystem.particleTexture = new BABYLON.Texture(textureUrl, scene);

    particleSystem.emitter = emitterPos;
    particleSystem.minEmitBox = new Vec3(-0.6 * size, 0, -0.6 * size);
    particleSystem.maxEmitBox = new Vec3(0.6 * size, 0, 0.6 * size);

    // Blend input colors with more saturation for colorfulness
    const blend = (c: BABYLON.Color4, factor = 0.7) => new BABYLON.Color4(
        Math.min(1, c.r * factor + 0.7 * (1 - factor)),
        Math.min(1, c.g * factor + 0.3 * (1 - factor)),
        Math.min(1, c.b * factor + 0.5 * (1 - factor)),
        c.a
    );
    particleSystem.color1 = blend(color1, 0.85);
    particleSystem.color2 = blend(color2, 0.65);
    particleSystem.colorDead = new BABYLON.Color4(color1.r, color1.g, color1.b, 0.0); // fade out to main color

    particleSystem.minSize = 0.6 * size;
    particleSystem.maxSize = 1.25 * size;

    particleSystem.minLifeTime = 0.1 * size;
    particleSystem.maxLifeTime = 0.2 * size;

    particleSystem.emitRate = 100 * size;

    // Initial random direction
    particleSystem.direction1 = new Vec3(
        randomFloat2(-0.1, 0.1),
        randomFloat2(0.2, 1.5),
        randomFloat2(-0.1, 0.1)
    );
    particleSystem.direction2 = new Vec3(
        randomFloat2(-0.1, 0.1),
        randomFloat2(0.2, 1.5),
        randomFloat2(-0.1, 0.1)
    );

    particleSystem.minEmitPower = 0.7 * size;
    particleSystem.maxEmitPower = 1.6 * size;
    particleSystem.updateSpeed = 0.012;
    particleSystem.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;

    // Animate direction, size, etc. for flame "jitter" effect
    scene.onBeforeRenderObservable.add(() => {
        const time = performance.now() * 0.001 + offset;
        const jitterX = Math.sin(time * 2.4) * 0.15 + Math.cos(time * 1.3) * 0.07;
        const jitterZ = Math.sin(time * 1.2) * 0.13 + Math.cos(time * 1.7) * 0.09;
        particleSystem.direction1 = new Vec3(-0.12 + jitterX, 1, -0.12 + jitterZ);
        particleSystem.direction2 = new Vec3(0.12 + jitterX, 1, 0.12 + jitterZ);

        // Optionally, smoothly vary flame size over time
        particleSystem.minSize = (0.6 + 0.08 * Math.sin(time * 2.1)) * size;
        particleSystem.maxSize = (1.25 + 0.1 * Math.cos(time * 2.4)) * size;
    });

    particleSystem.stop();
    return particleSystem;
}