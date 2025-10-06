import {
  createFlame,
  Ball,
  BABYLON,
} from "../../index.js";
import type { BallOptions, MagicEffect, Objects3D, Paddle, SceneData } from "../../index.js";

/**
 * BallOptions extends base GameObjectOptions with ball-specific fields.
 */
export type MagicBallOptions = BallOptions & {
  effect: MagicEffect;
};

/**
 * Ball class: Handles ball logic, rendering, movement, collisions, respawn, and hell effects.
 */
export class MagicBall extends Ball {
  private magic_effect: MagicEffect;
  constructor(options: MagicBallOptions) {
    super(options);
    this.magic_effect = options.effect;
    // purple
    let color1 = new BABYLON.Color4(0.9, 0.2, 1, 1);
    let color2 = new BABYLON.Color4(0.5, 0.1, 0.4, 1);

    // Set up flame particle effect
    this.flame_animation = createFlame({
      scene: options.scene,
      pos: this.pos.value,
      size: 6,
      color1: color1,
      color2: color2,
    });
    this.flame_animation.emitter = this.pos.value;
  }


  /**
   * Main update: Handles ball respawn, movement, collisions, and hell mode.
   */
  public update(obj3D: Objects3D, data: SceneData) {
    this.move(data);
    obj3D.paddles.forEach(paddle => this.paddleCollisions(paddle, data, obj3D));
    this.wallCollisions(obj3D.table, data);
  }

  // paddle collision alterations
  protected paddleCollisions(paddle: Paddle, data: SceneData, obj3D: Objects3D) {
    super.paddleCollisions(paddle, data, obj3D);
    // power
    paddle.hellEffects = this.hellEffects;
  }


}