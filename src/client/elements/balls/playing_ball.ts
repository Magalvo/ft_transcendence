
import {
  createFlame,
  Ball,
  magicEffect,
  Vec3,
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
    if (this.updateRespawnTimer(data.mods.step)) return;
    this.moveWithPaddleCollisions(data);
    this.wallCollisions(data);
    this.applyEffects(data);
  }

  // Move and check paddle collisions at each mini-step
  private moveWithPaddleCollisions(data: GameData) {
    this.move(data, undefined, undefined, () => {
      this.paddleCollisionsCheck(data);
    });
  }

  // Apply magic/hell effects
  private applyEffects(data: GameData) {
    const effects = data.mods.is_hell ? this.hellEffects : this.magicBallEffects;
    let size = new Vec3(1, 1, 1);
    let speed = 1;
    for (let effect of effects) {
      if (effect === magicEffect.big) size = new Vec3(3, 3, 3);
      if (effect === magicEffect.small) size = new Vec3(0.5, 0.5, 0.5);
      if (effect === magicEffect.slow) speed = 0.5;
      if (effect === magicEffect.normal_speed) speed = 1;
      if (effect === magicEffect.fast) speed = 4;
    }
    this.changeSize(size);
    this.speed_modifier = speed;
  }

  // Change ball size and update radius
  protected changeSize(scale: Vec3 = new Vec3(1, 1, 1)) {
    super.changeSize(scale);
    this.radius.value = this.radius.original * scale.x;
  }
}