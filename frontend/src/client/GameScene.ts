import {
  BABYLON,
  createObjects3D,
  createEnvironment3D,
  createObjects2D,
  renderGame,
  defineKeyEvents,
  undefineKeyEvents,
  HandleEvents,
  setupSocketListeners,
  type GameData,
  SERVER_URL,
  hellMode,
  mov,
  GameConfiguration,
} from "./index.js";
import { io, Socket } from "socket.io-client";

export class GameScene {
  private canvas: HTMLCanvasElement | null;
  private engine?: BABYLON.Engine;
  private data: GameData;
  private handleEvents: HandleEvents;
  private resizeHandler: (() => void) | null = null;
  private scene: BABYLON.Scene | null = null;
  public socket!: Socket;

  constructor() {
    this.canvas = document.getElementById("renderCanvas") as HTMLCanvasElement | null;
    this.data = {} as GameData;
    this.handleEvents = new HandleEvents(this);
  }

  public startConnection(existingSocket?: Socket): void {
    this.socket = existingSocket || io(SERVER_URL);
    setupSocketListeners(this.socket, this.handleEvents);

    if (!this.canvas) {
      this.canvas = document.getElementById("renderCanvas") as HTMLCanvasElement | null;
      if (!this.canvas) {
        throw new Error('renderCanvas element not found when starting GameScene');
      }
    }

    if (!this.engine) {
      this.engine = new BABYLON.Engine(this.canvas, true);
      this.resizeHandler = () => { this.engine && this.engine.resize(); };
      window.addEventListener("resize", this.resizeHandler);
    }

    this.engine.runRenderLoop(() => {
      if (this.scene && !this.scene.isDisposed && this.scene.activeCamera) {
        this.scene.render();
      }
    });
  }

  public resetScene(serverConfigs: GameConfiguration): void {
    undefineKeyEvents();
    if (this.scene && !this.scene.isDisposed) this.scene.dispose();
    if (!this.engine) throw new Error('Engine not initialized before resetScene');
    const scene = new BABYLON.Scene(this.engine);
    this.scene = scene;
    this.initializeGameData(serverConfigs, scene);
    this.data.obj3D = createObjects3D(scene, serverConfigs);
    this.data.obj2D = createObjects2D(scene);
    this.data.env3D = createEnvironment3D(this.data.obj3D, scene);
    defineKeyEvents(this.data);

    scene.registerBeforeRender(() => {
      const dt = this.engine!.getDeltaTime() / 1000;
      renderGame(dt, this.data);
      if (this.data.flags.return_main_menu) { /* RETURN MAIN PAGE */ };
    });
    this.engine!.resize();
  }

  private initializeGameData(configs: any, scene: BABYLON.Scene): void {
    this.data.scene = scene;
    this.data.socket = this.socket;
    this.data.gameConfigs = configs;
    this.data.mods = {
      score: { me: 0, rival: 0 },
      step: 0,
      time: 0,
      is_hell: false,
      hell_mode: hellMode.null,
      phaseTimer: 0,
    };
    this.data.input = {
      keysPressed: [],
      paddle_mov: mov.null,
      left_player_human: true,
      right_player_human: false,
    };
    this.data.magicBalls = {
      magic_balls_ref: [],
      next_magic_ball: 0,
      min_time: configs.magic_ball?.min_interval || 3,
      max_time: configs.magic_ball?.max_interval || 7,
      max_balls: configs.magic_ball?.max_balls || 5,
    };
    this.data.flags = {
      game_running: false,
      pause_screen: false,
      return_main_menu: false,
      camera_pos: 1,
    };
  }

  public dispose(): void {
    try {
      if (this.data?.env3D) {
        try {
          if (this.data.env3D.hellMusic) {
            this.data.env3D.hellMusic.pause();
            this.data.env3D.hellMusic.currentTime = 0;
            this.data.env3D.hellMusic.src = '';
          }
          if (this.data.env3D.heavenMusic) {
            this.data.env3D.heavenMusic.pause();
            this.data.env3D.heavenMusic.currentTime = 0;
            this.data.env3D.heavenMusic.src = '';
          }
        } catch (e) {
          console.error('Error stopping music:', e);
        }
      }
    } catch (e) {
      console.error('Error cleaning up audio:', e);
    }

    try {
      
      if (this.socket && this.socket.connected) {
        try {
          this.socket.emit('leaveGame', {
            side: (this.data as any).mySide || 'unknown',
            reason: 'scene_disposal'
          });
        } catch (e) {
          console.warn('Could not emit leaveGame:', e);
        }
        
        try {
          this.socket.off('init');
          this.socket.off('gamePaused');
          this.socket.off('gameResumed');
          this.socket.off('gameMessage');
          this.socket.off('countdown');
          this.socket.off('endGame');
          this.socket.off('matchRecorded');
          this.socket.off('gameState');
          console.log('🧹 Cleaned up game socket listeners');
        } catch (e) {
          console.warn('Error removing socket listeners:', e);
        }
      }
    } catch (e) {
      console.error('Error in socket cleanup:', e);
    }

    try {
      undefineKeyEvents();
    } catch (e) {
      // ignore if not registered
    }

    try {
      if (this.engine) this.engine.stopRenderLoop();
    } catch (e) {
      // ignore
    }

    try {
      if (this.scene && !this.scene.isDisposed) this.scene.dispose();
    } catch (e) {
      // ignore disposal errors
    }

    try {
      if (this.engine) this.engine.dispose();
    } catch (e) {
      // ignore
    }

    try {
      if (this.resizeHandler) window.removeEventListener("resize", this.resizeHandler);
    } catch (e) {
      // ignore
    }

    this.scene = null;
    this.data = {} as GameData;
  }

  public getTournamentWinnerSide(): "A" | "B" | null {
    if (!this.data?.mods?.score) return null;
    if (this.data.mySide !== "left" && this.data.mySide !== "right") return null;

    const myScore = this.data.mods.score.me;
    const rivalScore = this.data.mods.score.rival;

    const leftScore = this.data.mySide === "left" ? myScore : rivalScore;
    const rightScore = this.data.mySide === "left" ? rivalScore : myScore;

    if (leftScore === rightScore) return null;
    return leftScore > rightScore ? "A" : "B";
  }
}
