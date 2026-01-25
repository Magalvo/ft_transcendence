import {
  BABYLON,
  createEnvironment3D,
  create2DParts,
  renderGame,
  startMainMenu,
  createMainMenu,
  defineKeyEvents,
  hellMode,
  mov,
  undefineKeyEvents,
  createObjects3D,
  clearMagicNotifications,
  setupSocketListeners,
  HandleEvents,
  type GameData,
  SERVER_URL,
} from "./index.js";
import { io, Socket } from "socket.io-client";

export class GameScene {
  private canvas: HTMLCanvasElement;
  private engine: BABYLON.Engine;
  private data: GameData;
  private handleEvents: HandleEvents;
  private scene!: BABYLON.Scene;
  private socket!: Socket;
  private wasHell: boolean = false;
  private resizeHandler: () => void;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    this.engine = new BABYLON.Engine(this.canvas, true);

    this.resizeHandler = () => { this.engine.resize(); };
    window.addEventListener("resize", this.resizeHandler);

    this.data = {} as GameData;
    this.handleEvents = new HandleEvents();
  }

  public startGame(): void {
    this.resetScene();
    this.handleEvents.setData(this.data);
    
    createMainMenu();
    startMainMenu(this.data, (mode) => {
      if (!this.socket) return;
      
      switch (mode) {
        case 'online': this.socket.emit('onlinePlayerReady'); break;
        case 'bot': this.socket.emit('offlinePlayerReady'); break;
        case 'demo': this.socket.emit('demo'); break;
      }
    });
    
    let lastTime = performance.now();
    
    // --- MAIN LOOP ---
    this.engine.runRenderLoop(() => {
      const now = performance.now();

      if (!this.data.flags.return_main_menu) {
        const deltaTime = (now - lastTime) / 1000;
        lastTime = now;
        renderGame(deltaTime, this.data);
      }

      const isHell = this.data.mods.is_hell;
      if (isHell !== this.wasHell) {
        if (isHell) clearMagicNotifications();
        this.wasHell = isHell;
      }

      if (this.scene) {
        this.scene.render();
      }

      if (this.data.flags.return_main_menu) {
        this.data.flags.return_main_menu = false;
        this.engine.stopRenderLoop();
        this.startGame();
      }
    });
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
      paddle_mov: mov.null,
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
    this.data.obj3D = createObjects3D(this.scene);
    this.data.env = createEnvironment3D(this.data.obj3D, this.data.scene);
    this.data.obj2D = create2DParts();

    defineKeyEvents(this.data);
    this.connectToServer();
    this.data.socket = this.socket;
  }

  // --- NETWORKING ---

  private connectToServer() {
    this.socket = io(SERVER_URL);
    setupSocketListeners(this.socket, this.handleEvents);
  }

  public dispose(): void {
    console.log("GameScene: Cleaning up resources...");


    this.engine.stopRenderLoop();

    window.removeEventListener("resize", this.resizeHandler);
    undefineKeyEvents();

    if (this.socket) {
        this.socket.disconnect();
    }

    if (this.scene) {
        this.scene.dispose();
    }
    this.engine.dispose();
  }

  public onGameOver?: (winner: string) => void;
}