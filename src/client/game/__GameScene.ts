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
      if (serverState.paddles) {
        serverState.paddles.forEach((pData: any) => {
          const paddle = this.data.obj3D.paddles.find(p => p.side === pData.side);
          if (paddle) {
            const [px, py, pz] = pData.pos;
            paddle.mesh.position.set(px, py, pz);

            // --- ATUALIZAÇÃO DE TAMANHO (X e Z) ---
            const baseDepth = 30;
            const baseWidth = 0.5;

            // Se o servidor enviar sizeZ (Comprimento/Depth)
            // Nota: Verifica se renomeaste no servidor para sizeZ ou mantiveste size.
            // Vou assumir que usaste sizeZ como sugeri acima.
            const serverZ = pData.sizeZ || pData.size; // fallback
            const serverX = pData.sizeX || baseWidth;

            if (serverZ) {
              paddle.mesh.scaling.z = serverZ / baseDepth;
              // Atualizar memória interna
              if (paddle.dimensions?.value) paddle.dimensions.value.z = serverZ;
              if (paddle.dimensions?.original) paddle.dimensions.original.z = serverZ;
            }

            if (serverX) {
              paddle.mesh.scaling.x = serverX / baseWidth;
              // Atualizar memória interna
              if (paddle.dimensions?.value) paddle.dimensions.value.x = serverX;
              if (paddle.dimensions?.original) paddle.dimensions.original.x = serverX;
            }
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

      if (serverState.balls) {
        this.syncPlayingBalls(serverState.balls, serverState.isHell);
      }

      if (serverState.isHell) {
        this.data.mods.devilElapsed = serverState.hellTimer;
        this.data.mods.goodElapsed = 0;
        this.data.obj3D.table.updateColor("hell");
      } else {
        this.data.mods.goodElapsed = serverState.hellTimer;
        this.data.mods.devilElapsed = 0;
        this.data.obj3D.table.updateColor("heaven");
      }

      
      if (serverState.status === 1 && !this.data.flags.game_running) {
        console.log("JOGO COMEÇOU! Fechando menu...");
        closeMainMenu(this.data);
        this.data.flags.game_running = true;
      }

      if (serverState.magicBalls) {
        this.syncMagicBalls(serverState.magicBalls);
      }
    });
  }

  // Versão segura que não crasha se faltar metadata
  private syncMagicBalls(serverBalls: any[]) {
    // Forçamos o cast para any[] para o TypeScript aceitar os Meshes
    const localBalls = this.data.magicBalls.magic_balls_ref as any[];

    // 1. Remover bolas que já não existem no servidor
    for (let i = localBalls.length - 1; i >= 0; i--) {
      const local = localBalls[i];

      // VERIFICAÇÃO DE SEGURANÇA: Se o objeto ou metadata não existir, removemos logo (é lixo)
      if (!local || !local.metadata) {
        if (local) local.dispose();
        localBalls.splice(i, 1);
        continue;
      }

      // Procura se esta bola local ainda existe no servidor
      const existsInServer = serverBalls.find((sb: any) => sb.id === local.metadata.id);

      if (!existsInServer) {
        if (local.metadata && local.metadata.particleSystem) {
          local.metadata.particleSystem.stop();
          local.metadata.particleSystem.dispose();
        }
        local.dispose();
        localBalls.splice(i, 1);
      }
    }

    // 2. Atualizar ou Criar bolas novas
    serverBalls.forEach((sb: any) => {
      // VERIFICAÇÃO DE SEGURANÇA: Só compara se lb.metadata existir
      const local = localBalls.find((lb: any) => lb.metadata && lb.metadata.id === sb.id);

      if (local) {
        // Já existe, ATUALIZA a posição (Isto é que faz a bola mexer!)
        local.position.set(sb.x, sb.y, sb.z);
      } else {
        // É nova! Criar Mesh.
        const newMesh = BABYLON.MeshBuilder.CreateSphere("mb", { diameter: 3 }, this.scene);
        newMesh.position.set(sb.x, sb.y, sb.z);

        const mat = new BABYLON.StandardMaterial("mbMat", this.scene);
        // Cores baseadas no tipo de efeito
        if (sb.type === 1) mat.emissiveColor = BABYLON.Color3.Red();
        if (sb.type === 2) mat.emissiveColor = BABYLON.Color3.Blue();
        if (sb.type === 3) mat.emissiveColor = BABYLON.Color3.Green();
        newMesh.material = mat;

        // IMPORTANTE: Definir o ID
        newMesh.metadata = { id: sb.id };

        let fireColor = new BABYLON.Color3(1, 1, 1);
        if (sb.type === 1) fireColor = new BABYLON.Color3(1, 0, 0); // Red
        if (sb.type === 2) fireColor = new BABYLON.Color3(0, 0, 1); // Blue
        if (sb.type === 3) fireColor = new BABYLON.Color3(0, 1, 0); // Green

        this.addFireEffect(newMesh, fireColor, true);

        localBalls.push(newMesh);
      }
    });
  }

  private addFireEffect(mesh: BABYLON.AbstractMesh, color: BABYLON.Color3, isMagic: boolean) {
    // Se já tiver sistema de partículas, não cria outro
    if (mesh.metadata && mesh.metadata.particleSystem) return;

    // Cria o sistema
    const particleSystem = new BABYLON.ParticleSystem("fire", 2000, this.scene);
    particleSystem.particleTexture = new BABYLON.Texture("https://www.babylonjs-playground.com/textures/flare.png", this.scene);

    particleSystem.emitter = mesh; // O fogo segue a bola

    // Cores
    particleSystem.color1 = new BABYLON.Color4(color.r, color.g, color.b, 1.0);
    particleSystem.color2 = new BABYLON.Color4(1, 0, 0, 1.0); // Vermelho no fim
    particleSystem.colorDead = new BABYLON.Color4(0, 0, 0, 0.0);

    // Tamanho e Vida (Ajusta a gosto)
    particleSystem.minSize = isMagic ? 0.5 : 1.0;
    particleSystem.maxSize = isMagic ? 1.5 : 3.0;
    particleSystem.minLifeTime = 0.2;
    particleSystem.maxLifeTime = 0.5;
    particleSystem.emitRate = 300;

    // Velocidade de emissão (fogo fica para trás quando a bola anda)
    particleSystem.minEmitPower = 1;
    particleSystem.maxEmitPower = 3;
    particleSystem.updateSpeed = 0.005;

    particleSystem.start();

    // Guardar referência no metadata para podermos apagar depois!
    if (!mesh.metadata) mesh.metadata = {};
    mesh.metadata.particleSystem = particleSystem;
  }

  private syncPlayingBalls(serverBalls: any[], isHell: boolean) {
    const localBalls = this.data.obj3D.balls;

    // 1. Criar novas bolas se necessário (Bolas Multiplas)
    while (localBalls.length < serverBalls.length) {
      // Cria a bola imediatamente
      const newBall = createPlayingBall(this.scene, 0, 0);
      localBalls.push(newBall);
    }

    // 2. Sincronizar Posição e FOGO
    serverBalls.forEach((sb: any, index: number) => {
      if (localBalls[index]) {
        const ball = localBalls[index];
        const [bx, by, bz] = sb.pos;
        ball.mesh.position.set(bx, by, bz);

        // Escala
        const radius = sb.radius || 2;
        const scale = radius / 2;
        ball.mesh.scaling.set(scale, scale, scale);

        // --- LÓGICA DE FOGO CORRIGIDA ---
        if (isHell) {
          // Se estamos no inferno, ADICIONA fogo a TODAS (principal e extras)
          this.addFireEffect(ball.mesh, new BABYLON.Color3(1, 0.5, 0), false);
        } else {
          // Se NÃO estamos no inferno, REMOVE fogo de TODAS
          if (ball.mesh.metadata && ball.mesh.metadata.particleSystem) {
            ball.mesh.metadata.particleSystem.stop();
            ball.mesh.metadata.particleSystem.dispose();
            ball.mesh.metadata.particleSystem = undefined;
          }
        }
      }
    });

    // 3. Remover bolas extra e limpar partículas
    while (localBalls.length > serverBalls.length) {
      const removedBall = localBalls.pop();
      if (removedBall) {
        if (removedBall.mesh.metadata && removedBall.mesh.metadata.particleSystem) {
          removedBall.mesh.metadata.particleSystem.stop();
          removedBall.mesh.metadata.particleSystem.dispose();
        }
        removedBall.mesh.dispose();
      }
    }
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

      const tableMesh = this.data.obj3D.table.mesh;
      const isHell = this.data.mods.is_hell;

      if (tableMesh) {
        const targetRot = isHell ? Math.PI : 0;
        tableMesh.rotation.z = BABYLON.Scalar.Lerp(tableMesh.rotation.z, targetRot, 0.05);
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

