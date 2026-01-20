
import {
  createFlame,
  Ball,
  type BallOptions,
  type GameData
} from "../../index.js";

// Options for PlayingBall
export type PlayingBallOptions = BallOptions & {};

// Main ball for gameplay
export class PlayingBall extends Ball {
  constructor(options: PlayingBallOptions) {
    super(options);
    this.flame_animation = createFlame({
      scene: options.scene,
      pos: this.pos.value,
      size: 4,
    });
    this.flame_animation.emitter = this.pos.value;
  }

  // Main update: move, check collisions, apply effects
  public update(data: GameData) {
  }
}