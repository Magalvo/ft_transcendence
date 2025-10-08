import { createFlame, Ball, magicEffect, Color4 } from "../../index.js";
import type { BallOptions, MagicEffect, Objects3D, Paddle, SceneData } from "../../index.js";

// Options for MagicBall
export type MagicBallOptions = BallOptions & { effect: MagicEffect };

// MagicBall: special ball with magic effect and purple flame
export class MagicBall extends Ball {
  private magic_effect: MagicEffect;
  private paddle_hit_timestamp: number = -1;
  private paddle_hit_ref?: Paddle;
  private color1!: Color4;
  private color2!: Color4;

  constructor(options: MagicBallOptions) {
    super(options);
    this.magic_effect = options.effect;

    // Set flame colors based on magic effect
    this.setEffectColor();

    this.flame_animation = createFlame({
      scene: options.scene,
      pos: this.pos.value,
      size: 4,
      color1: this.color1,
      color2: this.color2,
    });
    this.flame_animation.emitter = this.pos.value;
    this.flame_animation.start();
  }

  // Main update: move, check collisions
  public update(obj3D: Objects3D, data: SceneData) {
    if (this.paddle_hit_ref) { this.updateEffectTimer(obj3D, data); return; };
    if (this.updateRespawnTimer(data.step)) return;
    this.move(data);
    this.paddleCollisionsCheck(data, obj3D);
    this.wallCollisions(obj3D.table, data);

  }

  private updateEffectTimer(obj3D: Objects3D, data: SceneData) {
    const effect_duration = 5;

    if (data.time - this.paddle_hit_timestamp >= effect_duration && this.paddle_hit_ref) {
      // remove effect
      this.paddle_hit_ref.magicBallEffects.pop();
      // erase ball
      const index = obj3D.balls.indexOf(this);
      if (index !== -1)
        obj3D.balls.splice(index, 1);
    }
  }

  // Paddle collision: add hell effects
  protected paddleCollisionAction(paddle: Paddle, data: SceneData, obj3D: Objects3D) {
    super.paddleCollisionAction(paddle, data, obj3D);
    // apply effect
    paddle.magicBallEffects.push(this.magic_effect);
    // erase that ball
    this.paddle_hit_timestamp = data.time;
    this.paddle_hit_ref = paddle;
    this.dispose();
  }

  private setEffectColor() {
    const effectColors: Record<number, [Color4, Color4]> = {
      [magicEffect.big]: [new Color4(1.0, 0.5, 0.1, 1), new Color4(1.0, 0.7, 0.2, 1)],
      [magicEffect.small]: [new Color4(0.0, 1.0, 0.4, 1), new Color4(0.01, 0.44, 0.19, 1)],
      [magicEffect.slow]: [new Color4(0.09, 0.18, 0.84, 1), new Color4(0.09, 0.61, 0.84, 1)],
      [magicEffect.normal_speed]: [new Color4(1, 1, 1, 1), new Color4(0.8, 0.8, 0.8, 1)],
      [magicEffect.crazy_fast]: [new Color4(1, 1, 0.2, 1), new Color4(1, 0.9, 0.1, 1)],
      [magicEffect.freeze]: [new Color4(0.3, 0.8, 1, 1), new Color4(0.6, 0.9, 1, 1)],
      [magicEffect.thick]: [new Color4(0.7, 0.2, 1, 1), new Color4(0.5, 0.1, 0.7, 1)],
    };
    const def: [Color4, Color4] = [new Color4(0.9, 0.2, 1, 1), new Color4(0.5, 0.1, 0.4, 1)];
    [this.color1, this.color2] = effectColors[this.magic_effect] || def;
  }
}