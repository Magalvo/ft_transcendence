import { createFlame, Ball, magicEffect, Color4, showWarningMessage } from "../../index.js";
import type { BallOptions, MagicEffect, Paddle, GameData } from "../../index.js";

// Options for MagicBall
export type MagicBallOptions = BallOptions & { effect: MagicEffect };

// MagicBall: special ball with magic effect and purple flame
export class MagicBall extends Ball {
  private magic_effect: MagicEffect;
  private paddle_hit_timestamp: number = -1;
  private paddle_hit_ref?: Paddle;
  private color1!: Color4;
  private color2!: Color4;
  private effect_duration = 5;

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
  public update(data: GameData) {
    if (this.paddle_hit_ref) { this.updateEffectTimer(data); return; };
    if (this.updateRespawnTimer(data.mods.step)) return;
    this.move(data);
    this.paddleCollisionsCheck(data);
    this.wallCollisions(data);

  }

  private updateEffectTimer(data: GameData) {
    if (data.mods.time - this.paddle_hit_timestamp >= this.effect_duration && this.paddle_hit_ref) {
      // remove effect
      const index1 = this.paddle_hit_ref.magicBallEffects.indexOf(this.magic_effect);
      if (index1 !== -1)
        this.paddle_hit_ref.magicBallEffects.splice(index1, 1);
      // erase ball
      const index2 = data.obj3D.balls.indexOf(this);
      if (index2 !== -1)
        data.obj3D.balls.splice(index2, 1);
    }
  }

  // Paddle collision: add hell effects
  protected paddleCollisionAction(paddle: Paddle, data: GameData) {
    super.paddleCollisionAction(paddle, data);
    // apply effect
    paddle.magicBallEffects.push(this.magic_effect);
    // erase that ball
    this.paddle_hit_timestamp = data.mods.time;
    this.paddle_hit_ref = paddle;
    this.dispose();
    this.showMessage(data, paddle);
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

  private showMessage(data: GameData, paddle: Paddle) {
    const effectMessages: Record<number, string> = {
      [magicEffect.big]: "Your paddle is now BIG!",
      [magicEffect.small]: "Your paddle shrunk!",
      [magicEffect.slow]: "Your paddle is slowed!",
      [magicEffect.normal_speed]: "You have got no effect!",
      [magicEffect.crazy_fast]: "Super speed!",
      [magicEffect.freeze]: "Frozen paddle!",
      [magicEffect.thick]: "Your paddle is THICK!",
    };
    const msg = effectMessages[this.magic_effect];
    if (msg) showWarningMessage({ scene: data.scene, message: msg, side: paddle.side, duration: this.effect_duration * 1000 });
  }
}