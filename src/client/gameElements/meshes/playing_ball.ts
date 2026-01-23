import {
  Ball,
  spawnHitParticles,
  type BallOptions,
  type GameData
} from "../../index.js";

// Options for PlayingBall
export type PlayingBallOptions = BallOptions & {};

// Main ball for gameplay
export class PlayingBall extends Ball {

  constructor(options: PlayingBallOptions) {
    super(options);
  }

  public update(data: GameData) {
    this.pos.value = this.mesh.position;
    this.paddleCollisions(data);
    this.wallCollisions(data);
  }
}