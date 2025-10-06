
import { createFlame, Ball, BABYLON } from "../../index.js";
import type { BallOptions, MagicEffect, Objects3D, Paddle, SceneData } from "../../index.js";

// Options for MagicBall
export type MagicBallOptions = BallOptions & { effect: MagicEffect };

// MagicBall: special ball with magic effect and purple flame
export class MagicBall extends Ball {
  private magic_effect: MagicEffect;

  constructor(options: MagicBallOptions) {
    super(options);
    this.magic_effect = options.effect;
    this.flame_animation = createFlame({
      scene: options.scene,
      pos: this.pos.value,
      size: 6,
      color1: new BABYLON.Color4(0.9, 0.2, 1, 1),
      color2: new BABYLON.Color4(0.5, 0.1, 0.4, 1),
    });
    this.flame_animation.emitter = this.pos.value;
  }

  // Main update: move, check collisions
  public update(obj3D: Objects3D, data: SceneData) {
    this.move(data);
    for (const paddle of obj3D.paddles) this.paddleCollisions(paddle, data, obj3D);
    this.wallCollisions(obj3D.table, data);
  }

  // Paddle collision: add hell effects
  protected paddleCollisions(paddle: Paddle, data: SceneData, obj3D: Objects3D) {
    super.paddleCollisions(paddle, data, obj3D);
    paddle.hellEffects = this.hellEffects;
  }
}