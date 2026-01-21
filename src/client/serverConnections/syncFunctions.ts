import {
    BABYLON,
    createPlayingBall,
    type GameData,
} from "../index";

const SCENE_CONFIG = {
    PADDLE_BASE_DEPTH: 30,
    PADDLE_BASE_WIDTH: 0.5,
    FIRE_PARTICLE: {
        TEXTURE_URL: "https://www.babylonjs-playground.com/textures/flare.png",
        CAPACITY: 2000,
        MIN_SIZE_MAGIC: 0.5,
        MAX_SIZE_MAGIC: 1.5,
        MIN_SIZE_NORMAL: 1.0,
        MAX_SIZE_NORMAL: 3.0,
    },
};

export function syncPaddles(data: GameData, serverPaddles: any[]) {
    serverPaddles.forEach((pData: any) => {
        // Determine visual association (My paddle is always Left visually)
        let visualSide = pData.side;
        if (data.mySide === 'right') {
            visualSide = (pData.side === 'right') ? 'left' : 'right';
        }

        const paddle = data.obj3D.paddles.find(p => p.side === visualSide);
        if (!paddle) return;

        // Apply mirrored position
        const [px, py, pz] = pData.pos;
        paddle.mesh.position.set(getVisualX(data, px), py, pz);

        // Sync Dimensions
        const serverZ = pData.sizeZ || pData.size;
        const serverX = pData.sizeX || SCENE_CONFIG.PADDLE_BASE_WIDTH;

        if (serverZ) paddle.mesh.scaling.z = serverZ / SCENE_CONFIG.PADDLE_BASE_DEPTH;
        if (serverX) paddle.mesh.scaling.x = serverX / SCENE_CONFIG.PADDLE_BASE_WIDTH;
    });
}

export function syncPlayingBalls(data: GameData, serverBalls: any[], isHell: boolean) {
    const localBalls = data.obj3D.balls;

    // 1. Create missing
    while (localBalls.length < serverBalls.length) {
        localBalls.push(createPlayingBall(data.scene, 0, 0));
    }

    // 2. Sync
    serverBalls.forEach((sb: any, index: number) => {
        if (!localBalls[index]) return;
        const ball = localBalls[index];
        const [bx, by, bz] = sb.pos;

        ball.mesh.position.set(getVisualX(data, bx), by, bz);

        const scale = (sb.radius || 2) / 2;
        ball.mesh.scaling.set(scale, scale, scale);

        if (isHell) {
            addFireEffect(data, ball.mesh, new BABYLON.Color3(1, 0.5, 0), false);
        } else {
            removeFireFromMesh(data, ball.mesh);
        }
    });

    // 3. Cleanup excess
    while (localBalls.length > serverBalls.length) {
        const removed = localBalls.pop();
        if (removed) {
            removeFireFromMesh(data, removed.mesh);
            removed.dispose();
        }
    }
}

export function syncMagicBalls(data: GameData, serverBalls: any[]) {
    const localBalls = data.magicBalls.magic_balls_ref as any[];

    // 1. Remove stale
    for (let i = localBalls.length - 1; i >= 0; i--) {
        const local = localBalls[i];
        if (!local?.metadata) { local?.dispose(); localBalls.splice(i, 1); continue; }

        if (!serverBalls.find((sb: any) => sb.id === local.metadata.id)) {
            removeFireFromMesh(data, local);
            local.dispose();
            localBalls.splice(i, 1);
        }
    }

    // 2. Update/Create
    serverBalls.forEach((sb: any) => {
        const local = localBalls.find((lb: any) => lb.metadata && lb.metadata.id === sb.id);
        const visualX = getVisualX(data, sb.x);

        if (local) {
            local.position.set(visualX, sb.y, sb.z);
        } else {
            const newMesh = BABYLON.MeshBuilder.CreateSphere("mb", { diameter: 3 }, data.scene);
            newMesh.position.set(visualX, sb.y, sb.z);

            const mat = new BABYLON.StandardMaterial("mbMat", data.scene);
            const color = BABYLON.Color3.Random();
            mat.emissiveColor = color;
            newMesh.material = mat;
            newMesh.metadata = { id: sb.id };

            addFireEffect(data, newMesh, color, true);
            localBalls.push(newMesh);
        }
    });
}

export function syncGameStats(data: GameData, serverState: any) {
    if (serverState.score) {
        // If I am right, my score (right) should appear on the left UI
        if (data.mySide === 'right') {
            data.mods.score.left = serverState.score.right;
            data.mods.score.right = serverState.score.left;
        } else {
            data.mods.score.left = serverState.score.left;
            data.mods.score.right = serverState.score.right;
        }
    }
    data.mods.time = serverState.time;
    data.mods.is_hell = serverState.isHell;
    data.mods.hell_mode = serverState.activeHellMode;
}

/**
   * Helper: Inverts X coordinate if the player is on the Right side.
   * This creates the "Mirror Mode" effect where local player is always Left.
   */
function getVisualX(data: GameData, x: number): number {
    return (data.mySide === 'right') ? -x : x;
}


// --- VISUAL EFFECTS ---

function addFireEffect(data: GameData, mesh: BABYLON.AbstractMesh, color: BABYLON.Color3, isMagic: boolean) {
    if (mesh.metadata?.particleSystem) return;

    // Double check scene registry to prevent duplicates
    const existing = data.scene.particleSystems.find(ps => ps.emitter === mesh && ps.name === "fire");
    if (existing) {
        if (!mesh.metadata) mesh.metadata = {};
        mesh.metadata.particleSystem = existing;
        return;
    }

    const ps = new BABYLON.ParticleSystem("fire", SCENE_CONFIG.FIRE_PARTICLE.CAPACITY, data.scene);
    ps.particleTexture = new BABYLON.Texture(SCENE_CONFIG.FIRE_PARTICLE.TEXTURE_URL, data.scene);
    ps.emitter = mesh;

    ps.color1 = new BABYLON.Color4(color.r, color.g, color.b, 1.0);
    ps.color2 = new BABYLON.Color4(1, 0, 0, 1.0);
    ps.colorDead = new BABYLON.Color4(0, 0, 0, 0.0);

    ps.minSize = isMagic ? SCENE_CONFIG.FIRE_PARTICLE.MIN_SIZE_MAGIC : SCENE_CONFIG.FIRE_PARTICLE.MIN_SIZE_NORMAL;
    ps.maxSize = isMagic ? SCENE_CONFIG.FIRE_PARTICLE.MAX_SIZE_MAGIC : SCENE_CONFIG.FIRE_PARTICLE.MAX_SIZE_NORMAL;
    ps.minLifeTime = 0.2;
    ps.maxLifeTime = 0.5;
    ps.emitRate = 300;
    ps.minEmitPower = 1;
    ps.maxEmitPower = 3;
    ps.updateSpeed = 0.005;

    ps.start();

    if (!mesh.metadata) mesh.metadata = {};
    mesh.metadata.particleSystem = ps;
}

function removeFireFromMesh(data: GameData, mesh: BABYLON.AbstractMesh) {
    // 1. Clear via metadata
    if (mesh.metadata?.particleSystem) {
        mesh.metadata.particleSystem.stop();
        mesh.metadata.particleSystem.dispose();
        mesh.metadata.particleSystem = undefined;
    }
    // 2. Brute force cleanup
    data.scene.particleSystems.forEach(ps => {
        if (ps.emitter === mesh) { ps.stop(); ps.dispose(); }
    });
}