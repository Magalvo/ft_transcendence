import {
  createFlame,
  Ball,
  magicEffect,
  type MagicEffect,
} from "../../index.js";
import { Vec3, type BallOptions, type Objects3D, type SceneData } from "../../index.js";

/**
 * BallOptions extends base GameObjectOptions with ball-specific fields.
 */
export type PlayingBallOptions = BallOptions & {
};

/**
 * Ball class: Handles ball logic, rendering, movement, collisions, respawn, and hell effects.
 */
export class PlayingBall extends Ball {

  constructor(options: PlayingBallOptions) {
    super(options);

    // Set up flame particle effect
    this.flame_animation = createFlame({
      scene: options.scene,
      pos: this.pos.value,
      size: 4,
    });
    this.flame_animation.emitter = this.pos.value;
  }


  /**
   * Main update: Handles ball respawn, movement, collisions, and hell mode.
   */
  public update(obj3D: Objects3D, data: SceneData) {
    if (this.updateRespawnTimer(data.step)) return;
    this.move(data);
    obj3D.paddles.forEach(paddle => this.paddleCollisions(paddle, data, obj3D));
    this.wallCollisions(obj3D.table, data);
    if (data.is_hell)
      this.handleEffects(this.hellEffects, data);
    else
      this.handleEffects(this.magicBallEffects, data);
  }

  private handleEffects(effects: MagicEffect[], data: SceneData) {
    let size: Vec3 = new Vec3(1, 1, 1);
    let speed: number = data.is_hell ? 2 : 1;

    for (let effect of effects) {
      switch (effect) {
        case magicEffect.big:
          size = new Vec3(3, 3, 3); break;
        case magicEffect.small:
          size = new Vec3(0.5, 0.5, 0.5); break;
        case magicEffect.slow:
          speed = 0.5; break;
        case magicEffect.medium_fast:
          speed = 1.5; break;
        case magicEffect.crazy_fast:
          speed = 4; break;
      }
    }
    this.changeSize(size);
    this.speed_modifier = speed;
  }

  protected changeSize(scale: Vec3 = new Vec3(1, 1, 1)) {
    super.changeSize(scale);
    this.radius.value = this.radius.original * scale.x;
  }
}