import {
  BABYLON,
  createEnvironment3D,
  create2DParts,
  gameUpdate,
  startMainMenu,
  createMainMenu,
  defineKeyEvents,
  hellMode,
  mov,
  undefineKeyEvents,
  createInitialObjects3D,
  type GameData,
  closeMainMenu,
  createPlayingBall,
  showWarningMessage,
  clearMagicNotifications,
  pauseScreen,
} from "../index.js";
import { io, Socket } from "socket.io-client";

// --- CONFIGURATION ---
const SCENE_CONFIG = {
  SERVER_URL: "http://localhost:3000",
  LERP_SPEED: 0.05,
  PADDLE_BASE_DEPTH: 30,
  PADDLE_BASE_WIDTH: 0.5,
  FIRE_PARTICLE: {
    TEXTURE_URL: "https://www.babylonjs-playground.com/textures/flare.png",
    CAPACITY: 2000,
    MIN_SIZE_MAGIC: 0.5,
    MAX_SIZE_MAGIC: 1.5,
    MIN_SIZE_NORMAL: 1.0,
    MAX_SIZE_NORMAL: 3.0,
  }
};

/**
 * Main class handling the game scene, socket connections, and the render loop.
 */
export class GameScene {
  private canvas: HTMLCanvasElement;
  private engine: BABYLON.Engine;
  private data: GameData;
  private scene!: BABYLON.Scene;
  private socket!: Socket;
  private wasHell: boolean = false;

  constructor() {
    this.canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
    this.engine = new BABYLON.Engine(this.canvas);
    window.addEventListener("resize", () => { this.engine.resize(); });
    this.data = {} as GameData;
  }

  // --- SCENE MANAGEMENT ---

  private resetScene(): void {
    undefineKeyEvents();

    if (this.scene) this.scene.dispose();
    if (this.socket) this.socket.disconnect();

    this.scene = new BABYLON.Scene(this.engine);
    this.initializeGameData();
  }

  private initializeGameData(): void {
    this.data.scene = this.scene;
    this.data.mods = {
      score: { left: 0, right: 0 },
      step: 0,
      time: 0,
      is_hell: false,
      hell_mode: hellMode.null,
      devilElapsed: 0,
      goodElapsed: 0,
    };
    this.data.input = {
      keysPressed: [],
      left_paddle_mov: mov.null,
      right_paddle_mov: mov.null,
      left_player_human: true,
      right_player_human: false,
    };
    this.data.magicBalls = {
      magic_balls_ref: [],
      next_magic_ball: 5,
      min_time: 5,
      max_time: 15,
      max_balls: 4,
    };
    this.data.flags = {
      game_running: false,
      pause_screen: false,
      return_main_menu: false,
      camera_pos: 1,
    };
    this.data.obj3D = createInitialObjects3D(this.scene);
    this.data.env = createEnvironment3D(this.data.obj3D, this.data.scene);
    this.data.obj2D = create2DParts();

    defineKeyEvents(this.data);
    this.connectToServer();
    this.data.socket = this.socket;
  }

  // --- NETWORKING ---

  private connectToServer() {
    this.socket = io(SCENE_CONFIG.SERVER_URL);
    this.setupSocketListeners();
  }

  private setupSocketListeners() {
    this.socket.on("connect", () => console.log("CLIENT: Connected to server!"));
    
    this.socket.on("init", (data: { side: string }) => {
      console.log("Player Side assigned:", data.side);
      this.data.mySide = data.side;
    });

    this.socket.on("gamePaused", () => this.handleGamePaused());
    this.socket.on("gameResumed", () => this.handleGameResumed());
    
    this.socket.on("gameMessage", (data: any) => {
      showWarningMessage({
        scene: this.scene,
        message: data.message,
        side: data.side,
        color: data.color,
        duration: data.duration
      });
    });

    // Main Game State Update (60 FPS)
    this.socket.on("gameState", (serverState: any) => this.handleGameState(serverState));
  }

  private handleGamePaused() {
    console.log("Game Paused by Server");
    // Force flag to true briefly so pauseScreen function allows creation
    this.data.flags.game_running = true; 
    pauseScreen(this.data);
    this.data.flags.game_running = false; 
  }

  private handleGameResumed() {
    console.log("Game Resumed");
    if (this.data.obj2D.guiPauseMenu) {
      this.data.obj2D.guiPauseMenu.dispose();
      this.data.obj2D.guiPauseMenu = undefined;
    }
    this.data.env.camera.detachControl();
    this.data.flags.game_running = true;
    this.data.flags.pause_screen = false;

    // Resume Music
    this.data.env.hellMusic.play();
    this.data.env.heavenMusic.play();
  }

  // --- GAME STATE SYNC LOGIC ---

  private handleGameState(serverState: any) {
    if (serverState.paddles) this.syncPaddles(serverState.paddles);
    if (serverState.balls) this.syncPlayingBalls(serverState.balls, serverState.isHell);
    if (serverState.magicBalls) this.syncMagicBalls(serverState.magicBalls);
    
    this.syncGameStats(serverState);
    this.handleGameStartTrigger(serverState.status);
    this.updateHellVisuals(serverState);
  }

  private syncPaddles(serverPaddles: any[]) {
    serverPaddles.forEach((pData: any) => {
      const paddle = this.data.obj3D.paddles.find(p => p.side === pData.side);
      if (!paddle) return;

      const [px, py, pz] = pData.pos;
      paddle.mesh.position.set(px, py, pz);

      // Handle Paddle Resizing
      // 'sizeZ' represents depth (length of paddle)
      // 'sizeX' represents width (thickness of paddle)
      const serverZ = pData.sizeZ || pData.size; 
      const serverX = pData.sizeX || SCENE_CONFIG.PADDLE_BASE_WIDTH;

      if (serverZ) {
        paddle.mesh.scaling.z = serverZ / SCENE_CONFIG.PADDLE_BASE_DEPTH;
        if (paddle.dimensions?.value) paddle.dimensions.value.z = serverZ;
        if (paddle.dimensions?.original) paddle.dimensions.original.z = serverZ;
      }

      if (serverX) {
        paddle.mesh.scaling.x = serverX / SCENE_CONFIG.PADDLE_BASE_WIDTH;
        if (paddle.dimensions?.value) paddle.dimensions.value.x = serverX;
        if (paddle.dimensions?.original) paddle.dimensions.original.x = serverX;
      }
    });
  }

  private syncGameStats(serverState: any) {
    if (serverState.score) {
      this.data.mods.score.left = serverState.score.left;
      this.data.mods.score.right = serverState.score.right;
    }
    this.data.mods.time = serverState.time;
    this.data.mods.is_hell = serverState.isHell;
    this.data.mods.hell_mode = serverState.activeHellMode;
  }

  private updateHellVisuals(serverState: any) {
    if (serverState.isHell) {
      this.data.mods.devilElapsed = serverState.hellTimer;
      this.data.mods.goodElapsed = 0;
    } else {
      this.data.mods.goodElapsed = serverState.hellTimer;
      this.data.mods.devilElapsed = 0;
    }
    
    // Update Table Colors
    this.data.obj3D.table.updateColor(serverState.isHell);
  }

  private handleGameStartTrigger(status: number) {
    // Status 1 = RUNNING
    if (status === 1 && !this.data.flags.game_running) {
      console.log("GAME STARTED! Closing menu...");
      closeMainMenu(this.data);
      this.data.flags.game_running = true;
    }
  }

  // --- ENTITY SYNC: BALLS ---

  private syncMagicBalls(serverBalls: any[]) {
    // Cast to any[] to allow metadata access
    const localBalls = this.data.magicBalls.magic_balls_ref as any[];

    // 1. Remove stale balls
    for (let i = localBalls.length - 1; i >= 0; i--) {
      const local = localBalls[i];
      if (!local || !local.metadata) {
        if (local) local.dispose();
        localBalls.splice(i, 1);
        continue;
      }

      const existsInServer = serverBalls.find((sb: any) => sb.id === local.metadata.id);
      if (!existsInServer) {
        this.removeFireFromMesh(local);
        local.dispose();
        localBalls.splice(i, 1);
      }
    }

    // 2. Update or Create balls
    serverBalls.forEach((sb: any) => {
      const local = localBalls.find((lb: any) => lb.metadata && lb.metadata.id === sb.id);

      if (local) {
        local.position.set(sb.x, sb.y, sb.z);
      } else {
        const newMesh = BABYLON.MeshBuilder.CreateSphere("mb", { diameter: 3 }, this.scene);
        newMesh.position.set(sb.x, sb.y, sb.z);

        const mat = new BABYLON.StandardMaterial("mbMat", this.scene);
        const ballColor = BABYLON.Color3.Random();
        mat.emissiveColor = ballColor;
        newMesh.material = mat;
        newMesh.metadata = { id: sb.id };

        this.addFireEffect(newMesh, ballColor, true);
        localBalls.push(newMesh);
      }
    });
  }

  private syncPlayingBalls(serverBalls: any[], isHell: boolean) {
    const localBalls = this.data.obj3D.balls;

    // 1. Create missing balls
    while (localBalls.length < serverBalls.length) {
      const newBall = createPlayingBall(this.scene, 0, 0);
      localBalls.push(newBall);
    }

    // 2. Sync properties
    serverBalls.forEach((sb: any, index: number) => {
      if (!localBalls[index]) return;
      
      const ball = localBalls[index];
      const [bx, by, bz] = sb.pos;
      ball.mesh.position.set(bx, by, bz);

      const radius = sb.radius || 2;
      const scale = radius / 2;
      ball.mesh.scaling.set(scale, scale, scale);

      // Fire Logic
      if (isHell) {
        this.addFireEffect(ball.mesh, new BABYLON.Color3(1, 0.5, 0), false);
      } else {
        this.removeFireFromMesh(ball.mesh);
      }
    });

    // 3. Remove excess balls
    while (localBalls.length > serverBalls.length) {
      const removedBall = localBalls.pop();
      if (removedBall) {
        this.removeFireFromMesh(removedBall.mesh);
        removedBall.dispose();
      }
    }
  }

  // --- PARTICLE SYSTEMS ---

  private addFireEffect(mesh: BABYLON.AbstractMesh, color: BABYLON.Color3, isMagic: boolean) {
    // Check Metadata first
    if (mesh.metadata && mesh.metadata.particleSystem) return;

    // Check Scene Registry (Brute Force prevention)
    const existingSystem = this.scene.particleSystems.find(ps => ps.emitter === mesh && ps.name === "fire");
    if (existingSystem) {
      if (!mesh.metadata) mesh.metadata = {};
      mesh.metadata.particleSystem = existingSystem;
      return;
    }

    const particleSystem = new BABYLON.ParticleSystem("fire", SCENE_CONFIG.FIRE_PARTICLE.CAPACITY, this.scene);
    particleSystem.particleTexture = new BABYLON.Texture(SCENE_CONFIG.FIRE_PARTICLE.TEXTURE_URL, this.scene);
    particleSystem.emitter = mesh;

    particleSystem.color1 = new BABYLON.Color4(color.r, color.g, color.b, 1.0);
    particleSystem.color2 = new BABYLON.Color4(1, 0, 0, 1.0);
    particleSystem.colorDead = new BABYLON.Color4(0, 0, 0, 0.0);

    particleSystem.minSize = isMagic ? SCENE_CONFIG.FIRE_PARTICLE.MIN_SIZE_MAGIC : SCENE_CONFIG.FIRE_PARTICLE.MIN_SIZE_NORMAL;
    particleSystem.maxSize = isMagic ? SCENE_CONFIG.FIRE_PARTICLE.MAX_SIZE_MAGIC : SCENE_CONFIG.FIRE_PARTICLE.MAX_SIZE_NORMAL;
    particleSystem.minLifeTime = 0.2;
    particleSystem.maxLifeTime = 0.5;
    particleSystem.emitRate = 300;
    particleSystem.minEmitPower = 1;
    particleSystem.maxEmitPower = 3;
    particleSystem.updateSpeed = 0.005;

    particleSystem.start();

    if (!mesh.metadata) mesh.metadata = {};
    mesh.metadata.particleSystem = particleSystem;
  }

  private removeFireFromMesh(mesh: BABYLON.AbstractMesh) {
    // 1. Metadata Check
    if (mesh.metadata && mesh.metadata.particleSystem) {
      mesh.metadata.particleSystem.stop();
      mesh.metadata.particleSystem.dispose();
      mesh.metadata.particleSystem = undefined;
    }

    // 2. Scene Registry Check (Cleanup orphan particles)
    this.scene.particleSystems.forEach(ps => {
      if (ps.emitter === mesh) {
        ps.stop();
        ps.dispose();
      }
    });
  }

  // --- MAIN LOOP ---

  public startGame(): void {
    this.resetScene();

    createMainMenu();
    startMainMenu(this.data, () => {
      if (this.socket) this.socket.emit('playerReady');
    });

    let lastTime = performance.now();

    this.engine.runRenderLoop(() => {
      const now = performance.now();

      if (!this.data.flags.return_main_menu) {
        const deltaTime = (now - lastTime) / 1000;
        lastTime = now;
        gameUpdate(deltaTime, this.data);
      }

      const isHell = this.data.mods.is_hell;

      // Handle Hell Transition Effects
      if (isHell !== this.wasHell) {
        if (isHell) clearMagicNotifications();
        this.wasHell = isHell;
      }

      this.scene.render();

      if (this.data.flags.return_main_menu) {
        this.data.flags.return_main_menu = false;
        this.engine.stopRenderLoop();
        this.startGame();
      }
    });
  }
}