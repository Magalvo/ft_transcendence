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
  pauseScreen,
} from "../index.js";
import { io, Socket } from "socket.io-client";

/**
 * Main class handling the game scene and loop.
 */
export class GameScene {
  private canvas: HTMLCanvasElement;
  private engine: BABYLON.Engine;
  private data: GameData;
  private scene!: BABYLON.Scene;
  private socket!: Socket;

  constructor() {
    this.canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
    this.engine = new BABYLON.Engine(this.canvas);
    window.addEventListener("resize", () => { this.engine.resize(); });
    this.data = {} as GameData;
  }

  private resetScene(): void {
    // clear listeners
    undefineKeyEvents();

    // destroy old scene (if any)
    if (this.scene)
      this.scene.dispose();

    if (this.socket) {
        this.socket.disconnect();
    }

    // create new scene
    this.scene = new BABYLON.Scene(this.engine);

    // initialize game data
    this.initializeGameData();
  }

  private initializeGameData(): void {
    // initialize data
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

    // define listeners
    defineKeyEvents(this.data);

    this.connectToServer();
    this.data.socket = this.socket;
  }

  private connectToServer() {
    // Conecta ao servidor que criámos no passo anterior
    this.socket = io("http://localhost:3000");

    this.socket.on("connect", () => {
      console.log("CLIENTE: Conectado ao servidor!");
    });

    this.socket.on("init", (data: { side: string }) => {
      console.log("Eu sou o jogador:", data.side);
      this.data.mySide = data.side;

      // Atualizar UI ou avisar o utilizador (opcional por agora)
      if (data.side === 'spectator') {
        console.log("A observar o jogo...");
      }
    });

    // OUVIR EVENTOS DE PAUSA DO SERVIDOR
    this.socket.on('gamePaused', () => {
        console.log("Jogo Pausado pelo Servidor");
        // Precisamos de importar a função 'pauseScreen' neste ficheiro se não estiver
        import("../index.js").then(({ pauseScreen }) => {
             // Forçamos a flag para true para a função pauseScreen criar a UI
             this.data.flags.game_running = true; // Truque para o pauseScreen aceitar criar menu
             pauseScreen(this.data);
             this.data.flags.game_running = false; // Estado real
        });
    });

    this.socket.on('gameResumed', () => {
        console.log("Jogo Retomado");
        // Removemos o menu de pausa manualmente se necessário, 
        // ou chamamos uma função de resume.
        // O jeito mais fácil é manipular os objetos diretamente ou usar o resumeGame se o exportares.
        
        if (this.data.obj2D.guiPauseMenu) {
            this.data.obj2D.guiPauseMenu.dispose();
            this.data.obj2D.guiPauseMenu = undefined;
        }
        this.data.env.camera.detachControl();
        this.data.flags.game_running = true;
        this.data.flags.pause_screen = false;
        
        // Retomar música
        this.data.env.hellMusic.play();
        this.data.env.heavenMusic.play();
    });

    // OUVIR O ESTADO DO JOGO (60 vezes por segundo)
    this.socket.on("gameState", (serverState: any) => {
      const ball = this.data.obj3D.balls[0];
      if (ball && serverState.ball) {
        const [x, y, z] = serverState.ball;
        ball.mesh.position.set(x, y, z);
        ball.pos.value.copyFromFloats(x, y, z);
      }

      if (serverState.paddles) {
        serverState.paddles.forEach((pData: any) => {
          const paddle = this.data.obj3D.paddles.find(p => p.side === pData.side);
          if (paddle) {
            const [px, py, pz] = pData.pos;
            paddle.mesh.position.set(px, py, pz);
          }
        });
      }

      if (serverState.score) {
        this.data.mods.score.left = serverState.score.left;
        this.data.mods.score.right = serverState.score.right;
      }

      this.data.mods.time = serverState.time;
      this.data.mods.is_hell = serverState.isHell;
      this.data.mods.hell_mode = serverState.activeHellMode;

      if (serverState.isHell) {
        this.data.mods.devilElapsed = serverState.hellTimer;
        this.data.mods.goodElapsed = 0;
      } else {
        this.data.mods.goodElapsed = serverState.hellTimer;
        this.data.mods.devilElapsed = 0;
      }

      if (serverState.status === 1 && !this.data.flags.game_running) {
        console.log("JOGO COMEÇOU! Fechando menu...");
        closeMainMenu(this.data);
        this.data.flags.game_running = true;
      }
    });
  }

  public startGame(): void {
    this.resetScene();

    createMainMenu();
    startMainMenu(this.data, () => {
      if (this.socket) {
        this.socket.emit('playerReady');
      }
    });

    let lastTime = performance.now();

    this.engine.runRenderLoop(() => {
      const now = performance.now();

      if (!this.data.flags.return_main_menu) {
        const deltaTime = (now - lastTime) / 1000;
        lastTime = now;

        gameUpdate(deltaTime, this.data);
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