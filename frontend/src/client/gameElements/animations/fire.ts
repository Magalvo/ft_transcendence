import { BABYLON, type GameData } from "../../index.js";

// Shared configuration for fire particles
const FIRE_CONFIG = {
    TEXTURE_URL: "https://www.babylonjs-playground.com/textures/flare.png",
    CAPACITY: 2000,
    MIN_SIZE_MAGIC_BALL: 0.5,
    MAX_SIZE_MAGIC_BALL: 1.5,
    MIN_SIZE_BALL: 1.0,
    MAX_SIZE_BALL: 3.0,
    MIN_SIZE_TABLE: 5.0,
    MAX_SIZE_TABLE: 10.0,
};

/**
 * Attaches a fire particle system to a mesh.
 * Improved to create a realistic trail effect instead of "solid balls".
 */
export function addFireEffect(data: GameData, mesh: BABYLON.AbstractMesh, color: BABYLON.Color3, isMagic: boolean) {
    // 1. Quick check via Metadata
    if (mesh.metadata?.particleSystem) return;

    // 2. Safety check in scene (prevents visual duplicates)
    const existing = data.scene.particleSystems.find(ps => ps.emitter === mesh && ps.name === "fire");
    if (existing) {
        if (!mesh.metadata) mesh.metadata = {};
        mesh.metadata.particleSystem = existing;
        return;
    }

    // 3. Create Particle System
    const ps = new BABYLON.ParticleSystem("fire", FIRE_CONFIG.CAPACITY, data.scene);
    ps.particleTexture = new BABYLON.Texture(FIRE_CONFIG.TEXTURE_URL, data.scene);
    ps.emitter = mesh;

    // --- MELHORIA DE REALISMO ---
    
    // Blend Mode: Essencial para parecer fogo/luz e não bolas sólidas
    ps.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;

    // Color Gradients: Núcleo quente (Branco) -> Cor da Bola -> Transparente
    ps.addColorGradient(0.0, new BABYLON.Color4(1, 1, 1, 1.0)); // Branco no início
    ps.addColorGradient(0.2, new BABYLON.Color4(color.r, color.g, color.b, 1.0)); // Cor principal
    ps.addColorGradient(1.0, new BABYLON.Color4(color.r, color.g, color.b, 0.0)); // Desvanece no fim

    // Base size calculation
    const baseSize = isMagic ? 1.2 : 3; // Ajuste fino do tamanho base

    // Size Gradients: Nasce pequena -> Cresce -> Desaparece (Evita o efeito "pipoca")
    ps.addSizeGradient(0.0, baseSize * 0.5); 
    ps.addSizeGradient(0.2, baseSize * 1.5); 
    ps.addSizeGradient(1.0, 0.0); // Morre com tamanho 0

    // Lifetime: Mais curto para criar um rasto rápido
    ps.minLifeTime = 0.2;
    ps.maxLifeTime = 0.4;
    
    ps.emitRate = 300;

    // Physics: Menos velocidade de emissão para o rasto ficar colado à bola
    ps.minEmitPower = 0.5;
    ps.maxEmitPower = 1.5;
    ps.updateSpeed = 0.01; // Velocidade de animação mais suave

    ps.start();

    // 4. Register in metadata
    if (!mesh.metadata) mesh.metadata = {};
    mesh.metadata.particleSystem = ps;
}

/**
 * Stops and disposes of the fire effect on a specific mesh.
 */
export function removeFireFromMesh(data: GameData, mesh: BABYLON.AbstractMesh) {
    // 1. Clean via metadata reference (fastest)
    if (mesh.metadata?.particleSystem) {
        mesh.metadata.particleSystem.stop();
        mesh.metadata.particleSystem.dispose();
        mesh.metadata.particleSystem = undefined;
    }

    // 2. Brute force cleanup (safety net for orphan particles)
    data.scene.particleSystems.forEach(ps => {
        if (ps.emitter === mesh) {
            ps.stop();
            ps.dispose();
        }
    });
}

/**
 * Helper to create static environmental flames (Torches).
 * Replaces the old createFlame function.
 */
export function createStaticFlame(
    scene: BABYLON.Scene,
    pos: { x: number, y: number, z: number },
    size: number,
): BABYLON.ParticleSystem {
    const anchor = new BABYLON.Mesh("torch_anchor", scene);
    anchor.position = new BABYLON.Vector3(pos.x, pos.y, pos.z);

    const capacity = Math.min(500, Math.round(50 * size));
    const ps = new BABYLON.ParticleSystem("env_fire", capacity, scene);

    ps.particleTexture = new BABYLON.Texture(FIRE_CONFIG.TEXTURE_URL, scene);
    ps.emitter = anchor;

    ps.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;

    // Colors
    ps.addColorGradient(0.0, new BABYLON.Color4(1, 1, 1, 0.5));
    ps.addColorGradient(0.2, new BABYLON.Color4(1, 0.8, 0.2, 0.8));
    ps.addColorGradient(0.5, new BABYLON.Color4(1, 0.2, 0, 0.5));
    ps.addColorGradient(1.0, new BABYLON.Color4(0.2, 0, 0, 0));

    // Size
    const particleScale = 0.2;
    const baseSize = 1;

    ps.addSizeGradient(0.0, baseSize * size * particleScale * 0.2);
    ps.addSizeGradient(0.3, baseSize * size * particleScale);
    ps.addSizeGradient(1.0, baseSize * size * particleScale * 0.1);

    ps.minLifeTime = 0.5;
    ps.maxLifeTime = 1.0;

    ps.emitRate = 30 * size;

    // Emitter
    const emitBoxSize = 0.05 * size;
    ps.createBoxEmitter(
        new BABYLON.Vector3(0, 1, 0),
        new BABYLON.Vector3(0, 1, 0),
        new BABYLON.Vector3(-emitBoxSize, -0.1, -emitBoxSize),
        new BABYLON.Vector3(emitBoxSize, 0.1, emitBoxSize)
    );

    ps.minEmitPower = 1;
    ps.maxEmitPower = 2 + (size);
    ps.updateSpeed = 0.01;

    ps.minAngularSpeed = 0;
    ps.maxAngularSpeed = Math.PI / 2;

    ps.start();
    return ps;
}