import {
    addFireEffect,
    BABYLON,
    createPaddle,
    createPlayingBall,
    flashZone,
    removeFireFromMesh,
    spawnHitParticles,
    type GameData,
} from "../index";

export function syncPaddles(data: GameData, serverPaddles: any[]) {
    const localPaddles = data.obj3D.paddles;

    while (localPaddles.length < serverPaddles.length) {
        localPaddles.push(createPaddle(0, 'left', data.scene));
    }

    while (localPaddles.length > serverPaddles.length) {
        const removed = localPaddles.pop();
        if (removed) removed.mesh.dispose();
    }

    serverPaddles.forEach((pData: any, i: number) => {
        const paddle = localPaddles[i];
        if (!paddle) return;

        paddle.side = pData.side;

        const [px, py, pz] = pData.pos;
        const visualX = getVisualX(data, px);

        paddle.mesh.position.set(visualX, py, pz);

        const serverZ = pData.size;  // Depth
        const serverX = pData.sizeX; // Width

        if (serverZ) {
            paddle.mesh.scaling.z = serverZ / data.gameConfigs.paddle.depth;
        }
        if (serverX) {
            paddle.mesh.scaling.x = serverX / data.gameConfigs.paddle.width;
        }

        if (paddle.update) paddle.update(data, pData.nickname);
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
        if (sb.particles === true)
            spawnHitParticles(data.scene, ball.mesh.position);
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

    for (let i = localBalls.length - 1; i >= 0; i--) {
        const ball = localBalls[i];
        if (!ball?.metadata) { ball?.dispose(); localBalls.splice(i, 1); continue; }

        if (!serverBalls.find((sb: any) => sb.id === ball.metadata.id)) {
            removeFireFromMesh(data, ball);
            ball.dispose();
            localBalls.splice(i, 1);
        }
    }

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

export function syncTable(data: GameData) {
    const table = data.obj3D.table;
    table.update(data);
}

export function syncGameStats(data: GameData, serverState: any) {
    if (serverState.score) {
        // If I am right, my score (right) should appear on the left UI
        if (data.mySide === 'right') {
            data.mods.score.me = serverState.score.right;
            data.mods.score.rival = serverState.score.left;
        } else {
            data.mods.score.me = serverState.score.left;
            data.mods.score.rival = serverState.score.right;
        }
    }
    if (serverState.scoreFlash) {
        const side =
            (data.mySide === 'left')
                ? (serverState.scoreFlash === 'right')
                    ? 'left'
                    : 'right'
                : serverState.scoreFlash
        flashZone(data, side, data.obj3D.table);
    }
    data.mods.time = serverState.time;
    data.mods.is_hell = serverState.isHell;
    data.mods.hell_mode = serverState.activeHellMode;
    data.mods.phaseTimer = serverState.phaseTimer | 0;
}

/**
   * Helper: Inverts X coordinate if the player is on the Right side.
   * This creates the "Mirror Mode" effect where local player is always Left.
   */
function getVisualX(data: GameData, x: number): number {
    return (data.mySide === 'right') ? -x : x;
}