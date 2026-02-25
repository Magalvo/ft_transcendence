import * as BABYLON from "@babylonjs/core";
import { io, Socket } from "socket.io-client";
import { createObjects3D } from "./gameElements/initializations/createObjects3D.js";
import { createEnvironment3D } from "./gameElements/initializations/environment3D.js";
import { createObjects2D } from "./gameElements/initializations/createObjects2D.js";
import { renderGame } from "./gameElements/render/RenderGame.js";
import { defineKeyEvents, undefineKeyEvents } from "./gameElements/initializations/defineEvents.js";
import { HandleEvents } from "./serverConnections/HandleEvents.js";
import { setupSocketListeners } from "./serverConnections/socketListeners.js";
import type { GameData } from "./GameData.js";
import { SERVER_URL } from "./configs.js";
import { hellMode, mov, type GameConfiguration } from "./index.js";

export class GameScene {
  private canvas: HTMLCanvasElement;
  private engine: BABYLON.Engine;
  private data: GameData;
  private handleEvents: HandleEvents;
  private scene!: BABYLON.Scene;
  public socket!: Socket;

  constructor() {
    this.canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
    this.engine = new BABYLON.Engine(this.canvas, true);
    window.addEventListener("resize", () => { this.engine.resize(); });
    this.data = {} as GameData;
    this.handleEvents = new HandleEvents(this);
  }

  public startConnection(existingSocket?: Socket): void {
    this.socket = existingSocket || io(SERVER_URL);
    setupSocketListeners(this.socket, this.handleEvents);

    this.engine.runRenderLoop(() => {
      if (this.scene) {
        this.scene.render();
      }
    });
  }

  public resetScene(serverConfigs: GameConfiguration): void {
    undefineKeyEvents();
    if (this.scene) this.scene.dispose();
    this.scene = new BABYLON.Scene(this.engine);
    this.initializeGameData(serverConfigs);
    this.data.obj3D = createObjects3D(this.scene, serverConfigs);
    this.data.obj2D = createObjects2D();
    this.data.env3D = createEnvironment3D(this.data.obj3D, this.scene);
    defineKeyEvents(this.data);

    this.scene.registerBeforeRender(() => {
      const dt = this.engine.getDeltaTime() / 1000;
      renderGame(dt, this.data);
      if (this.data.flags.return_main_menu) { /* RETURN MAIN PAGE */ };
    });
    this.engine.resize();
  }

  private initializeGameData(configs: any): void {
    this.data.scene = this.scene;
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
}