import {
  BABYLON,
  Ball,
  Paddle,
  Table,
  side,
  createBall,
  createPaddle,
  createTable,
  createSceneParts,
  create2DParts,
  gameUpdate,
  startMenu,
  createMenu,
  defineEvents as defineKeyEvents,
} from "../index.js";

import type { Parts3D, Objects2D, Side } from "../index.js";

/**
 * 3D game objects container type
 */
export type Objects3D = {
  table: Table;
  paddles: Paddle[];
  balls: Ball[];
};

/**
 * Global scene/game state type
 */
export type SceneData = {
  scene: BABYLON.Scene,
  score: { left: number, right: number },
  game_running: boolean,
  pause_screen: boolean,
  camera_pos: number,
  keysPressed: boolean[],
  step: number,
  good_side: Side,
  last_V_pressed: boolean,
  left_player_human: boolean,
  right_player_human: boolean,
  time: number,
};

/**
 * Main class handling the game scene and loop.
 */
export class GameScene {
  // Scene rendering engine (BabylonJS)
  private engine: BABYLON.Engine;
  // Scene instance
  private scene: BABYLON.Scene;

  // Game objects and data
  private obj3D!: Objects3D;
  private obj2D!: Objects2D;
  private parts3D!: Parts3D;
  private data!: SceneData;

  constructor(engine: BABYLON.Engine) {
    this.engine = engine;
    this.scene = this.createBabylonScene(engine);

    // Initialize game menus and data
    createMenu();
    this.data = this.createInitialSceneData();
    this.obj3D = this.createInitialObjects3D(this.scene);

    // Create scene and UI parts
    this.parts3D = createSceneParts(this.obj3D, this.scene);
    this.obj2D = create2DParts();

    // define key events
    defineKeyEvents(this.data.keysPressed);
  }

  /**
   * Initializes a new BabylonJS scene.
   */
  private createBabylonScene(engine: BABYLON.Engine): BABYLON.Scene {
    return new BABYLON.Scene(engine);
  }

  /**
   * Returns the initial game state (SceneData).
   */
  private createInitialSceneData(): SceneData {
    return {
      scene: this.scene,
      score: { left: 0, right: 0 },
      game_running: false,
      pause_screen: false,
      camera_pos: 1,
      keysPressed: [],
      step: 0,
      good_side: side.right,
      last_V_pressed: false,
      left_player_human: true,
      right_player_human: false,
      time: 0,
    };
  }

  /**
   * Creates and returns initial 3D objects.
   */
  private createInitialObjects3D(scene: BABYLON.Scene): Objects3D {
    const table = createTable(scene);

    return {
      table,
      balls: [
        createBall(table.pos.x, scene),
        // Add more balls here if needed
      ],
      paddles: [
        createPaddle(table.left_line * 0.9, side.left, scene),
        createPaddle(table.right_line * 0.9, side.right, scene),
      ],
    };
  }

  /**
   * Starts the game: shows menu, enters render loop, and updates state.
   */
  public startGame(): void {
    startMenu(this.data, this.parts3D);

    let lastTime = performance.now();

    this.engine.runRenderLoop(() => {
      const now = performance.now();
      const deltaTime = (now - lastTime) / 1000;
      lastTime = now;

      gameUpdate(deltaTime, this.data, this.obj3D, this.obj2D, this.parts3D);
      this.scene.render();
    });
  }
}