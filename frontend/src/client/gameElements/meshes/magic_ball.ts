import {
  Ball,
  type BallOptions,
  type MagicEffect,
  type GameData
} from "../../index.js";

// Options for MagicBall
export type MagicBallOptions = BallOptions & { effect: MagicEffect };

// MagicBall: special ball with magic effect and purple flame
export class MagicBall extends Ball {

  constructor(options: MagicBallOptions) {
    super(options);
  }

  public update(data: GameData) {
    this.pos.value = this.mesh.position;
  }
}